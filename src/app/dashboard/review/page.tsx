import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import Link from 'next/link';
import ReviewActions from './components/ReviewActions';

interface ReviewRow {
  assignment_id:   string;
  assignment_role: string;
  result_url:      string | null;
  submitted_at:    number | null;
  task_id:         string;
  task_title:      string;
  task_priority:   string;
  workspace_id:    string | null;
  workspace_name:  string | null;
  project_id:      string;
  project_name:    string;
  creator_id:      string;
  creator_name:    string | null;
}

export default async function ReviewPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);

  // Gate: only APPROVE or REQUEST_REVISION permission holders
  if (!ctx.can('APPROVE') && !ctx.can('REQUEST_REVISION')) redirect('/dashboard');

  const db = await getDB();

  const { results: rawReviews } = await db.prepare(`
    SELECT
      ta.id            AS assignment_id,
      ta.assignment_role,
      ta.result_url,
      ta.submitted_at,
      t.id             AS task_id,
      t.title          AS task_title,
      t.priority       AS task_priority,
      t.workspace_id,
      ws.name          AS workspace_name,
      t.project_id,
      p.name           AS project_name,
      u.id             AS creator_id,
      u.name           AS creator_name
    FROM task_assignments ta
    JOIN tasks t       ON ta.task_id = t.id
    JOIN projects p    ON t.project_id = p.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    LEFT JOIN users u  ON ta.user_id = u.id
    WHERE ta.status = 'IN_REVIEW'
    ORDER BY ta.submitted_at ASC
  `).all();

  const reviews = rawReviews as unknown as ReviewRow[];

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
            Submitted work awaiting your review. Approve or send back for revision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-[10px] font-black px-3 py-1.5 rounded-full border ${
            reviews.length > 0
              ? 'text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/15'
              : 'text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800'
          }`}>
            {reviews.length} pending review{reviews.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Security reminder */}
      {reviews.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-4">
          <span className="text-yellow-500 text-lg shrink-0">⚡</span>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium leading-relaxed">
            Review submissions carefully before approving. Requesting revision requires a written note explaining the changes needed.
          </p>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold">No pending reviews.</p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">All submitted work has been reviewed. Great job!</p>
        </div>
      ) : (
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

              {/* Creator & timestamp */}
              <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">
                <span>👤 {r.creator_name ?? 'Unknown'}</span>
                {r.submitted_at && (
                  <span className="font-mono">
                    Submitted: {new Date(r.submitted_at * 1000).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Result link */}
              {r.result_url ? (
                <a
                  href={r.result_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-500 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/10 dark:border-purple-500/20 px-4 py-3 rounded-xl transition-all"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Submitted Result
                </a>
              ) : (
                <div className="text-xs text-zinc-400 italic">No result URL submitted</div>
              )}

              {/* Action buttons — client component */}
              <ReviewActions
                assignmentId={r.assignment_id}
                canRequestRevision={canRequestRevision}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
