import Link from 'next/link';

interface DashboardStatsProps {
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  canManage: boolean;
  isOJT: boolean;
}

export default function DashboardStats({
  totalUsers,
  totalProjects,
  totalTasks,
  canManage,
  isOJT,
}: DashboardStatsProps) {
  if (isOJT) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {/* Members card — clickable only with MANAGE */}
      {canManage ? (
        <Link
          href="/dashboard/users"
          className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group"
        >
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Active Members
              </p>
              <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">
                {totalUsers}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/5 text-purple-600 dark:text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">
            Manage team clearance mapping &rarr;
          </div>
        </Link>
      ) : (
        <div className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">
                Active Members
              </p>
              <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">
                {totalUsers}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-500/5 text-zinc-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">
            Synced D1 Relational Engine
          </div>
        </div>
      )}

      <Link
        href="/dashboard/projects"
        className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group"
      >
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Active Projects
            </p>
            <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">
              {totalProjects}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/5 text-blue-600 dark:text-blue-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">
          Browse creative registry &rarr;
        </div>
      </Link>

      <Link
        href="/dashboard/analytics"
        className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group"
      >
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Total Tasks
            </p>
            <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">
              {totalTasks}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-pink-500/5 text-pink-600 dark:text-pink-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
        </div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">
          View analytics dashboard &rarr;
        </div>
      </Link>
    </div>
  );
}
