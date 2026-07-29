import Link from 'next/link';

interface PersonalTaskRow {
  id: string;
  project_id: string;
  workspace_id: string | null;
  title: string;
  status: string;
  deadline: number | null;
  project_name: string;
  assigned_name?: string | null;
  assignment_role?: string | null;
}

interface DashboardPersonalWorkspaceProps {
  personalTasks: PersonalTaskRow[];
  canReview: boolean;
  widgetTitle: string;
  widgetDesc: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80',
  SUBMITTED: 'bg-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-500/10 dark:border-orange-500/20',
  WAITING_REVIEW: 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10 dark:border-yellow-500/20',
  REVISION_REQUESTED: 'bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/10 dark:border-red-500/20',
  RESUBMITTED: 'bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/10 dark:border-indigo-500/20',
  APPROVED: 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10 dark:border-emerald-500/20',
  LOCKED: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
  PUBLISHED: 'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/10 dark:border-purple-500/20',
  ARCHIVED: 'bg-zinc-500/5 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800',
  DECLINED: 'bg-red-800/10 text-red-800 dark:text-red-500 border-red-800/20',
};

const roleColors: Record<string, string> = {
  PIC: 'text-purple-600 dark:text-purple-400',
  REVIEWER: 'text-blue-600 dark:text-blue-400',
  HELPER: 'text-emerald-600 dark:text-emerald-400',
  APPROVER: 'text-amber-600 dark:text-amber-400',
};

export default function DashboardPersonalWorkspace({
  personalTasks,
  canReview,
  widgetTitle,
  widgetDesc,
}: DashboardPersonalWorkspaceProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {widgetTitle}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{widgetDesc}</p>
      </div>

      {personalTasks.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-10 text-center text-zinc-500 text-sm">
          {canReview
            ? '✅ No pending reviews right now.'
            : '🎉 No active assignments. Check back later!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {personalTasks.map((task) => (
            <div
              key={`${task.id}-${task.assignment_role}`}
              className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 hover:shadow-md"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest truncate max-w-[140px]">
                    {task.project_name}
                  </span>
                  {task.assignment_role && (
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest ${
                        roleColors[task.assignment_role] ?? ''
                      }`}
                    >
                      {task.assignment_role}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                      statusColors[task.status] ?? statusColors.DRAFT
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                  {task.title}
                </h4>
                {task.assigned_name && (
                  <p className="text-[10px] text-zinc-500 mt-1">By: {task.assigned_name}</p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {task.deadline && (
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono hidden sm:block">
                    Due: {new Date(task.deadline).toLocaleDateString()}
                  </span>
                )}
                <Link
                  href={
                    task.workspace_id
                      ? `/dashboard/workspace/${task.workspace_id}`
                      : `/dashboard/projects/${task.project_id}`
                  }
                  className="text-[11px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900/60 px-3.5 py-2 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-sm"
                >
                  Open &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
