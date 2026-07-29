import Link from 'next/link';

interface DashboardQuickActionsProps {
  canCreate: boolean;
  canCreateBrief: boolean;
  canReview: boolean;
}

export default function DashboardQuickActions({
  canCreate,
  canCreateBrief,
  canReview,
}: DashboardQuickActionsProps) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-5 shadow-sm space-y-2">
      <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
        Quick Actions
      </h3>
      {canCreate && (
        <Link
          href="/dashboard/projects"
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group"
        >
          <div className="p-1.5 rounded-lg bg-blue-500/5 text-blue-600 dark:text-blue-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            New Project
          </span>
        </Link>
      )}
      {canCreateBrief && (
        <Link
          href="/dashboard/briefs"
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group"
        >
          <div className="p-1.5 rounded-lg bg-yellow-500/5 text-yellow-600 dark:text-yellow-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            Content Briefs
          </span>
        </Link>
      )}
      {canReview && (
        <Link
          href="/dashboard/review"
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group"
        >
          <div className="p-1.5 rounded-lg bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" />
            </svg>
          </div>
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            Review Queue
          </span>
        </Link>
      )}
      {!canReview && (
        <Link
          href="/dashboard/workspace"
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group"
        >
          <div className="p-1.5 rounded-lg bg-purple-500/5 text-purple-600 dark:text-purple-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            My Workspace
          </span>
        </Link>
      )}
    </div>
  );
}
