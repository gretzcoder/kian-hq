import Link from 'next/link';

interface DashboardStatsProps {
  pendingQCCount: number;
  inProgressTasksCount: number;
  totalOjtCount: number;
  isOJT: boolean;
}

export default function DashboardStats({
  pendingQCCount,
  inProgressTasksCount,
  totalOjtCount,
  isOJT,
}: DashboardStatsProps) {
  if (isOJT) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
      {/* 1. Pending QC Reviews */}
      <Link
        href="/dashboard/review"
        className="block border border-amber-500/20 dark:border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group col-span-1 min-w-0 overflow-hidden"
      >
        <div className="flex justify-between items-start gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest group-hover:underline truncate">
              Pending QC
            </p>
            <p className="text-2xl sm:text-4xl font-black mt-1 sm:mt-2 text-zinc-900 dark:text-zinc-100">
              {pendingQCCount}
            </p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="text-[9px] sm:text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-2 sm:mt-4 font-bold tracking-wide truncate">
          Awaiting approval &rarr;
        </div>
      </Link>

      {/* 2. Tasks In-Progress */}
      <Link
        href="/dashboard/workspace"
        className="block border border-purple-500/20 dark:border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group col-span-1 min-w-0 overflow-hidden"
      >
        <div className="flex justify-between items-start gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-widest group-hover:underline truncate">
              In-Progress
            </p>
            <p className="text-2xl sm:text-4xl font-black mt-1 sm:mt-2 text-zinc-900 dark:text-zinc-100">
              {inProgressTasksCount}
            </p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="text-[9px] sm:text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-2 sm:mt-4 font-bold tracking-wide truncate">
          Operational tasks &rarr;
        </div>
      </Link>

      {/* 3. Total OJT Interns */}
      <Link
        href="/dashboard/ojt"
        className="block border border-blue-500/20 dark:border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group col-span-2 sm:col-span-1 min-w-0 overflow-hidden"
      >
        <div className="flex justify-between items-start gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest group-hover:underline truncate">
              Total OJT Interns
            </p>
            <p className="text-2xl sm:text-4xl font-black mt-1 sm:mt-2 text-zinc-900 dark:text-zinc-100">
              {totalOjtCount}
            </p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
        <div className="text-[9px] sm:text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-2 sm:mt-4 font-bold tracking-wide truncate">
          OJT Directory &rarr;
        </div>
      </Link>
    </div>
  );
}
