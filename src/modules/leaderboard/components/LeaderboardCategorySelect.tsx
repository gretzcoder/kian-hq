'use client';

import { useRouter } from 'next/navigation';

interface LeaderboardCategorySelectProps {
  categories: Array<{ id: string; label: string }>;
  activeCategory: string;
  activePeriod: string;
}

export default function LeaderboardCategorySelect({
  categories,
  activeCategory,
  activePeriod,
}: LeaderboardCategorySelectProps) {
  const router = useRouter();

  return (
    <div className="block md:hidden">
      <div className="relative">
        <select
          value={activeCategory}
          onChange={(e) => {
            router.push(`/dashboard/leaderboard?category=${e.target.value}&period=${activePeriod}`);
          }}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-extrabold text-xs rounded-2xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-purple-500 shadow-sm transition-all"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold">
              {cat.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">
          ▼
        </div>
      </div>
    </div>
  );
}
