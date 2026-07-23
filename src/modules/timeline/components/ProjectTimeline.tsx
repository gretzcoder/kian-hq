'use client';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: number | null;
  assigned_name: string | null;
}

export default function ProjectTimeline({ tasks }: { tasks: Task[] }) {
  // Sort tasks by deadline or created_at (deadline first, if exists)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline - b.deadline;
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const statusColors: Record<string, string> = {
    TODO: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400',
    IN_PROGRESS: 'border-blue-500 bg-blue-500/5 text-blue-600 dark:text-blue-400',
    IN_REVIEW: 'border-yellow-500 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400',
    APPROVED: 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    COMPLETED: 'border-purple-500 bg-purple-500/5 text-purple-600 dark:text-purple-400',
  };

  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center text-zinc-500 text-sm bg-white dark:bg-transparent">
        No task milestones to display in the timeline. Create tasks to build the timeline milestones automatically.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-8">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Dynamic Campaign Timeline</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Automatic progressive schedule generated from task milestones.</p>
      </div>

      <div className="relative pl-8 border-l border-zinc-200 dark:border-zinc-800 space-y-10 ml-3 py-1">
        {sortedTasks.map((task, idx) => {
          const statusClass = statusColors[task.status] || statusColors.TODO;

          return (
            <div key={task.id} className="relative">
              {/* Vertical node circle */}
              <div className={`absolute left-[-42px] top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-black bg-zinc-50 dark:bg-black z-10 transition-colors duration-300 ${statusClass}`}>
                {idx + 1}
              </div>

              {/* Card content */}
              <div className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all duration-300 hover:shadow-md shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                  <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{task.title}</h4>
                  <span className={`text-[9px] px-2.5 py-0.5 rounded-full border font-black uppercase tracking-wider ${statusClass}`}>
                    {task.status}
                  </span>
                </div>
                
                {task.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-4 font-medium">
                    {task.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900/60">
                  <div>
                    Owner: <span className="text-zinc-700 dark:text-zinc-300 font-bold">{task.assigned_name || 'Unassigned'}</span>
                  </div>
                  {task.deadline && (
                    <div className="font-mono">
                      Due: {new Date(task.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
