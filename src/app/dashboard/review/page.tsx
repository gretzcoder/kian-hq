import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import Link from 'next/link';
import ReviewActions from './components/ReviewActions';
import AssessmentBriefReviewCard, { PendingAssessmentBrief } from './components/AssessmentBriefReviewCard';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { DocxDocumentViewer } from '@/components/editor/TiptapEditor';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';
import { CollapsibleNoteViewer } from '@/components/CollapsibleNoteViewer';

interface ReviewRow {
  assignment_id:   string;
  assignment_role: string;
  result_url:      string | null;
  submitted_at:    number | null;
  appreciation_note?: string | null;
  revision_note?:     string | null;
  task_id:         string;
  task_title:      string;
  task_priority:   string;
  task_type:       string | null;
  task_created_by: string | null;
  task_creator_name?: string | null;
  assigned_mentors?:  string | null;
  workspace_id:    string | null;
  workspace_name:  string | null;
  workspace_type:  string | null;
  project_id:      string;
  project_name:    string;
  creator_id:      string;
  creator_name:    string | null;
}

export default async function ReviewPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);

  // Gate: only TASK_REVIEW permission holders
  if (!ctx.can('TASK_REVIEW')) redirect('/dashboard');

  const db = await getDB();

  const isCoordinator =
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') ||
        ctx.roles.includes('EXECUTIVE') ||
        ctx.can('MANAGE') ||
        ctx.can('WORKSPACE_MANAGE'))) ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.can('WORKSPACE_MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  // 1. Pending Assessment Task Briefs (Brief is auto-approved upon mentor submission)
  const pendingBriefReviews: PendingAssessmentBrief[] = [];

  // 2. Pending Submission Reviews (OJT / Task Assignments)
  const { results: rawReviews } = await db.prepare(`
    SELECT
      ta.id            AS assignment_id,
      ta.user_id       AS creator_id,
      ta.assignment_role,
      ta.result_url,
      ta.submitted_at,
      ta.lead_approved,
      ta.mentor_approved,
      ta.coordinator_approved,
      ta.appreciation_note,
      ta.revision_note,
      t.id             AS task_id,
      t.title          AS task_title,
      t.priority       AS task_priority,
      t.task_type       AS task_type,
      t.created_by      AS task_created_by,
      t.assigned_mentors,
      t.deadline,
      t.extended_deadline,
      tu.name          AS task_creator_name,
      t.workspace_id,
      t.project_id,
      ws.name          AS workspace_name,
      ws.workspace_type AS workspace_type,
      ws.ojt_coordinator_id,
      p.name           AS project_name,
      u.name           AS creator_name
    FROM task_assignments ta
    JOIN tasks t       ON ta.task_id = t.id
    JOIN projects p    ON t.project_id = p.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    LEFT JOIN users u  ON ta.user_id = u.id
    LEFT JOIN users tu ON t.created_by = tu.id
    WHERE ta.status IN ('WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED')
      AND ta.result_url IS NOT NULL
      AND TRIM(ta.result_url) != ''
      AND t.status != 'DELETED'
      AND (ws.id IS NULL OR ws.deleted_at IS NULL)
    ORDER BY ta.submitted_at ASC
  `).all();

  const reviewRows = (rawReviews as any[]) || [];
  let leaderWsSet = new Set<string>();
  let coordProjSet = new Set<string>();

  if (reviewRows.length > 0) {
    const [leadRows, coordRows] = await Promise.all([
      db.prepare(`SELECT workspace_id FROM workspace_members WHERE user_id = ? AND team_role = 'LEADER'`).bind(session.userId).all(),
      db.prepare(`SELECT project_id FROM project_coordinators WHERE user_id = ?`).bind(session.userId).all(),
    ]);
    leaderWsSet = new Set(((leadRows.results as any[]) || []).map((r) => r.workspace_id));
    coordProjSet = new Set(((coordRows.results as any[]) || []).map((r) => r.project_id));
  }

  const allReviews = reviewRows.map((r) => ({
    ...r,
    is_leader: r.workspace_id ? (leaderWsSet.has(r.workspace_id) ? 1 : 0) : 0,
    is_mentor: (r.ojt_coordinator_id === session.userId || (r.project_id && coordProjSet.has(r.project_id)) || r.task_created_by === session.userId) ? 1 : 0,
  })) as unknown as (ReviewRow & {
    lead_approved: number;
    mentor_approved: number;
    coordinator_approved: number;
    is_leader: number;
    is_mentor: number;
  })[];

  // Filter reviews based on role-specific visibility rules
  const reviews = allReviews.filter((r) => {
    // ── Exclude own submissions ──
    if (r.creator_id === session.userId) return false;

    // ── Assessment 1-step flow ──
    if (r.task_type === 'ASSESSMENT') {
      let isTaskMentor = false;
      if (r.assigned_mentors) {
        try {
          const ids: string[] = JSON.parse(r.assigned_mentors);
          if (Array.isArray(ids) && ids.length > 0) {
            isTaskMentor = ids.includes(session.userId);
          }
        } catch (_e) {}
      }
      if (!isTaskMentor) {
        isTaskMentor = (r.task_created_by != null && r.task_created_by === session.userId) || r.is_mentor === 1;
      }
      return (isCoordinator || isTaskMentor) && r.coordinator_approved === 0;
    }

    // ── Mentor Workspaces: ONLY Coordinators/Admins OR Task Creator evaluate submissions ──
    const isMentorWs = r.workspace_type === 'MENTOR' || r.task_type === 'MENTOR';
    if (isMentorWs) {
      const isTaskCreator = r.task_created_by != null && r.task_created_by === session.userId;
      return (isCoordinator || isTaskCreator) && r.coordinator_approved === 0;
    }

    // ── Regular / Troopers tasks: show if user is Coordinator, Mentor, or Leader and step is pending ──
    if (isCoordinator && r.coordinator_approved === 0) return true;
    if (r.is_mentor && r.mentor_approved === 0) return true;
    if (r.is_leader && r.lead_approved === 0) return true;

    return false;
  });

  const totalPendingCount = reviews.length + pendingBriefReviews.length;
  const canRequestRevision = ctx.can('REQUEST_REVISION');

  const priorityColors: Record<string, string> = {
    LOW:    'text-zinc-400',
    NORMAL: 'text-zinc-500',
    HIGH:   'text-orange-500',
    URGENT: 'text-red-500 font-black',
  };

  const roleColors: Record<string, string> = {
    PIC:      'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/15',
    REVIEWER: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/15',
    HELPER:   'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/15',
    APPROVER: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/15',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Review Queue
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Submitted work and assessment briefs awaiting your review. Approve or send back for revision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-[10px] font-black px-3 py-1.5 rounded-full border ${
            totalPendingCount > 0
              ? 'text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/15'
              : 'text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800'
          }`}>
            {totalPendingCount} pending review{totalPendingCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Security reminder */}
      {totalPendingCount > 0 && (
        <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-4">
          <span className="text-yellow-500 text-lg shrink-0">⚡</span>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium leading-relaxed">
            Review submissions and assessment briefs carefully before approving. Requesting revision requires a written note explaining the changes needed.
          </p>
        </div>
      )}

      {totalPendingCount === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold">No pending reviews.</p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">All submitted work and assessment briefs have been reviewed. Great job!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Pending Assessment Briefs Section (Coordinator ACC) ── */}
          {pendingBriefReviews.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                  Ajuan Brief Assessment Memerlukan ACC Koordinator ({pendingBriefReviews.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {pendingBriefReviews.map((brief) => (
                  <AssessmentBriefReviewCard key={brief.task_id} brief={brief} />
                ))}
              </div>
            </div>
          )}

          {/* ── Pending Submissions Section (OJT / Member Work) ── */}
          {reviews.length > 0 && (
            <div className="space-y-4">
              {pendingBriefReviews.length > 0 && (
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="text-lg">📥</span>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                    Hasil Submit Peserta Memerlukan Review ({reviews.length})
                  </h2>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {reviews.map((r) => (
                  <div
                    key={r.assignment_id}
                    className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm flex flex-col gap-4"
                  >
                    {/* Task info */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest truncate">
                            {r.project_name}
                          </span>
                          {r.workspace_name && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700">›</span>
                              <span className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                                {r.workspace_name}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{r.task_title}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${roleColors[r.assignment_role] ?? 'text-zinc-500 bg-zinc-100 border-zinc-200'}`}>
                          {r.assignment_role}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${priorityColors[r.task_priority] ?? 'text-zinc-500'}`}>
                          {r.task_priority}
                        </span>
                      </div>
                    </div>

                    {/* Creator, Task Owner Mentor, Shortcut Link & timestamp */}
                    <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center justify-between gap-2 flex-wrap font-bold">
                        <span className="flex items-center gap-1.5">
                          <span>👤 Peserta:</span>
                          <strong className="text-zinc-900 dark:text-zinc-200 font-semibold">{r.creator_name ?? 'Unknown'}</strong>
                        </span>
                        {r.submitted_at && (
                          <span className="font-mono text-zinc-400 text-[10px]">
                            Submitted: {new Date(r.submitted_at * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                        <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <span>🎯 Mentor Pembuat Task:</span>
                          <strong className="text-zinc-900 dark:text-zinc-200 font-black">
                            {r.task_created_by === session.userId ? 'Anda (Pemilik Task)' : (r.task_creator_name ?? 'Mentor')}
                          </strong>
                        </span>

                        {r.workspace_id && (
                          <Link
                            href={`/dashboard/workspace/${r.workspace_id}?taskId=${r.task_id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-[11px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-xl hover:bg-purple-500/20 transition-all active:scale-95 shadow-xs"
                            title="Buka sumber informasi task ini langsung di Workspace"
                          >
                            <span>🔗 Buka Task di Workspace</span>
                            <span>↗</span>
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Result link / Text report */}
                    {r.result_url ? (
                      r.result_url.includes('<') || r.result_url.includes('\n') ? (
                        <DocxDocumentViewer
                          content={r.result_url}
                          roleName={`Tugas: ${r.task_title} (${r.assignment_role})`}
                        />
                      ) : (
                        <SubmittedLinkPreviewer url={r.result_url} />
                      )
                    ) : (
                      <div className="text-xs text-zinc-400 italic">No result URL submitted</div>
                    )}

                    {/* Appreciation / Catatan Improvement Viewer */}
                    {r.appreciation_note && (
                      <CollapsibleNoteViewer
                        content={r.appreciation_note}
                        badgeLabel="✨ Catatan Improvement Mentor"
                        type="APPRECIATION"
                      />
                    )}

                    {/* Revision Note Viewer */}
                    {r.revision_note && (
                      <CollapsibleNoteViewer
                        content={r.revision_note}
                        badgeLabel="💬 Catatan Revisi Evaluator"
                        type="REVISION"
                      />
                    )}

                    {/* Action buttons — client component */}
                    <ReviewActions
                      assignmentId={r.assignment_id}
                      canRequestRevision={true}
                      taskType={r.task_type}
                      isAssessmentMentorStep={r.task_type === 'ASSESSMENT'}
                      creatorName={r.creator_name}
                      isStaffOrCoord={isCoordinator}
                      mentorApproved={(r as any).mentor_approved ?? 0}
                      coordinatorApproved={(r as any).coordinator_approved ?? 0}
                      isMentorWs={(r as any).workspace_type === 'MENTOR'}
                      taskId={r.task_id}
                      taskTitle={r.task_title}
                      taskDeadline={(r as any).deadline}
                      taskExtendedDeadline={(r as any).extended_deadline}
                      workspaceId={r.workspace_id || ''}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

