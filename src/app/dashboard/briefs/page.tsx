import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import Link from 'next/link';
import BriefActions from './components/BriefActions';

interface BriefRow {
  brief_id:     string;
  brief_status: string;
  title:        string | null;
  audience:     string | null;
  objectives:   string | null;
  key_messages: string | null;
  visual_style: string | null;
  revision_note: string | null;
  submitted_at: number | null;
  approved_at:  number | null;
  locked_at:    number | null;
  created_by:   string;
  author_name:  string | null;
  approved_by_name: string | null;
  project_id:   string | null;
  project_name: string | null;
}

const STATUS_FLOW = ['DRAFT', 'SUBMITTED', 'WAITING_REVIEW', 'APPROVED', 'LOCKED', 'PROJECT_CREATED', 'ARCHIVED'];

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:           { label: 'Draft',          color: 'text-zinc-600 dark:text-zinc-400',     bg: 'bg-zinc-100 dark:bg-zinc-800',     border: 'border-zinc-200 dark:border-zinc-700' },
  SUBMITTED:       { label: 'Submitted',       color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/5',                    border: 'border-blue-500/15' },
  WAITING_REVIEW:  { label: 'Waiting Review',  color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/5',                  border: 'border-yellow-500/15' },
  APPROVED:        { label: 'Approved',        color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5',               border: 'border-emerald-500/15' },
  LOCKED:          { label: 'Locked',          color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/5',                  border: 'border-purple-500/15' },
  PROJECT_CREATED: { label: 'Project Created', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/5',                  border: 'border-indigo-500/15' },
  ARCHIVED:        { label: 'Archived',        color: 'text-zinc-400 dark:text-zinc-500',     bg: 'bg-zinc-50 dark:bg-zinc-900/20',   border: 'border-zinc-200 dark:border-zinc-800' },
};

export default async function BriefsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);

  // Must have any brief sub-permission to access
  const hasBriefPermission =
    ctx.can('CREATE_BRIEF') ||
    ctx.can('APPROVE_BRIEF') ||
    ctx.can('SUBMIT_BRIEF') ||
    ctx.can('REQUEST_CHANGES') ||
    ctx.can('UNLOCK_BRIEF');

  if (!hasBriefPermission) redirect('/dashboard');

  const db = await getDB();

  const { results: rawBriefs } = await db.prepare(`
    SELECT
      cb.id           AS brief_id,
      cb.status       AS brief_status,
      cb.title,
      cb.audience,
      cb.objectives,
      cb.key_messages,
      cb.visual_style,
      cb.revision_note,
      cb.submitted_at,
      cb.approved_at,
      cb.locked_at,
      cb.created_by,
      u.name          AS author_name,
      ab.name         AS approved_by_name,
      cb.project_id,
      p.name          AS project_name
    FROM content_briefs cb
    LEFT JOIN users u    ON cb.created_by = u.id
    LEFT JOIN users ab   ON cb.approved_by = ab.id
    LEFT JOIN projects p ON cb.project_id = p.id
    ORDER BY
      CASE cb.status
        WHEN 'WAITING_REVIEW' THEN 1
        WHEN 'DRAFT'          THEN 2
        WHEN 'SUBMITTED'      THEN 3
        WHEN 'LOCKED'         THEN 4
        WHEN 'APPROVED'       THEN 5
        WHEN 'PROJECT_CREATED'THEN 6
        WHEN 'ARCHIVED'       THEN 7
      END,
      cb.created_at DESC
  `).all();

  const briefs = rawBriefs as unknown as BriefRow[];

  const canCreate       = ctx.can('CREATE_BRIEF');
  const canApprove      = ctx.can('APPROVE_BRIEF');
  const canRequestChg   = ctx.can('REQUEST_CHANGES');
  const canUnlock       = ctx.can('UNLOCK_BRIEF');
  const canCreateProject = ctx.can('CREATE_PROJECT');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Content Briefs
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            The starting point of every campaign. Briefs drive projects.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/briefs/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.2)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.3)] active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Brief
          </Link>
        )}
      </div>

      {/* Brief State Flow Guide */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-wrap gap-y-2">
        {STATUS_FLOW.map((s, i) => {
          const cfg = statusConfig[s];
          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                {cfg.label}
              </span>
              {i < STATUS_FLOW.length - 1 && (
                <span className="text-zinc-300 dark:text-zinc-700 text-xs">→</span>
              )}
            </div>
          );
        })}
      </div>

      {briefs.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold">No briefs yet.</p>
          {canCreate && (
            <Link href="/dashboard/briefs/new" className="inline-block mt-4 text-sm font-bold text-purple-600 dark:text-purple-400 hover:underline">
              Create your first brief &rarr;
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {briefs.map((b) => {
            const cfg = statusConfig[b.brief_status] ?? statusConfig.DRAFT;
            const isLocked = ['LOCKED', 'PROJECT_CREATED', 'ARCHIVED'].includes(b.brief_status);
            const isWaiting = b.brief_status === 'WAITING_REVIEW';

            return (
              <div
                key={b.brief_id}
                className={`border bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm flex flex-col gap-4 transition-all ${
                  isWaiting
                    ? 'border-yellow-500/20 dark:border-yellow-500/20'
                    : isLocked
                    ? 'border-purple-500/15 dark:border-purple-500/15'
                    : 'border-zinc-200/80 dark:border-zinc-800/80'
                }`}
              >
                {/* Brief Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                      {isLocked && <span className="text-[10px]">🔒</span>}
                      {b.project_name && (
                        <Link href={`/dashboard/projects/${b.project_id}`} className="text-[9px] font-bold text-purple-600 dark:text-purple-400 hover:underline uppercase tracking-widest">
                          → {b.project_name}
                        </Link>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 mt-1">{b.title || 'Untitled Brief'}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">By: {b.author_name ?? 'Unknown'}</p>
                  </div>
                  {b.locked_at && (
                    <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                      Locked {new Date(b.locked_at * 1000).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Revision Note */}
                {b.revision_note && b.brief_status === 'DRAFT' && (
                  <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide mb-1">Changes Requested</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{b.revision_note}</p>
                  </div>
                )}

                {/* Brief summary */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {b.audience && (
                    <div>
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Audience</p>
                      <p className="text-zinc-700 dark:text-zinc-300 line-clamp-2">{b.audience}</p>
                    </div>
                  )}
                  {b.objectives && (
                    <div>
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Objectives</p>
                      <p className="text-zinc-700 dark:text-zinc-300 line-clamp-2">{b.objectives}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <BriefActions
                  briefId={b.brief_id}
                  status={b.brief_status}
                  canApprove={canApprove}
                  canRequestChanges={canRequestChg}
                  canUnlock={canUnlock}
                  canSubmit={canCreate}
                  canCreateProject={canCreateProject}
                  isOwner={b.created_by === session.userId}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
