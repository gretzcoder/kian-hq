'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
import { AchievementItem } from '@/modules/achievements/actions';
import { getAchievementMeta } from '@/modules/achievements/utils';

interface AchievementHistoryViewProps {
  initialData: AchievementItem[];
  initialCategory?: string;
}

export function AchievementHistoryView({ initialData, initialCategory = 'ALL' }: AchievementHistoryViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory.toUpperCase());
  const [search, setSearch] = useState<string>('');

  const categories = [
    { id: 'ALL', label: '🌐 Semua' },
    { id: 'WEEKLY', label: '🏆 Weekly' },
    { id: 'MONTHLY', label: '👑 Monthly' },
    { id: 'DESIGNER', label: '🎨 Designer' },
    { id: 'VIDEO_EDITOR', label: '🎬 Video Editor' },
    { id: 'PLANNER', label: '🧠 Planner' },
    { id: 'RESEARCHER', label: '🔍 Researcher' },
    { id: 'MENTOR', label: '🎓 Mentor' },
  ];

  const filteredItems = useMemo(() => {
    return initialData.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        item.userName.toLowerCase().includes(q) ||
        item.userEmail.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.period.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (categoryFilter === 'ALL') return true;

      const catUpper = item.category.toUpperCase();
      const typeUpper = item.achievementType.toUpperCase();

      if (categoryFilter === 'WEEKLY') return catUpper === 'WEEKLY' || typeUpper.includes('WEEKLY');
      if (categoryFilter === 'MONTHLY') return catUpper === 'MONTHLY' || typeUpper.includes('MONTHLY');
      if (categoryFilter === 'DESIGNER') return catUpper === 'DESIGNER' || typeUpper.includes('DESIGN');
      if (categoryFilter === 'VIDEO_EDITOR') return catUpper === 'VIDEO_EDITOR' || typeUpper.includes('EDITOR') || typeUpper.includes('VIDEO');
      if (categoryFilter === 'PLANNER') return catUpper === 'PLANNER' || typeUpper.includes('PLANNER');
      if (categoryFilter === 'RESEARCHER') return catUpper === 'RESEARCHER' || typeUpper.includes('RESEARCH');
      if (categoryFilter === 'MENTOR') return catUpper === 'MENTOR' || typeUpper.includes('MENTOR');

      return true;
    });
  }, [initialData, categoryFilter, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full min-w-0">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5 min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-purple-500/20">
            🏆
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              Achievement History
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Riwayat pencapaian gelar juara & gelar keahlian utama seluruh anggota dari Leaderboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl font-mono">
            {filteredItems.length} Record Achievement
          </span>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm">
        {/* Search & Category Filter Controls */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="w-full lg:w-80 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pengguna, gelar, atau periode..."
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full lg:w-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat.id
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20 scale-105'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Achievement Table (Matching User's Reference Image media_1787561163770.png) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-black">
                <th className="pb-3 px-3">User</th>
                <th className="pb-3 px-3">Achievement</th>
                <th className="pb-3 px-3">Period</th>
                <th className="pb-3 px-3 text-center">Rank</th>
                <th className="pb-3 px-3 text-right">Score</th>
                <th className="pb-3 px-3 text-right">Earned Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400 italic">
                    Tidak ada riwayat achievement yang ditemukan untuk kategori ini.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const meta = getAchievementMeta(item.achievementType, item.category);

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20 transition-all">
                      {/* User Column */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar src={item.userAvatar} name={item.userName} size="sm" />
                          <div>
                            <Link
                              href={`/dashboard/profile?userId=${item.userId}`}
                              className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors flex items-center gap-1"
                            >
                              <span>{item.userName}</span>
                              <span className="text-[10px] text-zinc-400 font-mono">↗</span>
                            </Link>
                            <p className="text-[10px] text-zinc-400 font-mono">{item.userEmail}</p>
                          </div>
                        </div>
                      </td>

                      {/* Achievement Title Column */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border ${meta.badgeBg}`}>
                          <span>{meta.emoji}</span>
                          <span>{item.title}</span>
                        </span>
                      </td>

                      {/* Period Column */}
                      <td className="py-3.5 px-3 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        {item.period}
                      </td>

                      {/* Rank Column */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-mono font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                          #{item.rank}
                        </span>
                      </td>

                      {/* Score Column */}
                      <td className="py-3.5 px-3 text-right font-mono font-black text-purple-600 dark:text-purple-400 text-sm">
                        {item.score.toLocaleString()} ✨
                      </td>

                      {/* Earned Date Column */}
                      <td className="py-3.5 px-3 text-right font-mono text-zinc-400 text-[11px]">
                        {new Date(item.earnedAt * 1000).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View List */}
        <div className="block md:hidden divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 text-xs italic">
              Tidak ada riwayat achievement yang ditemukan.
            </div>
          ) : (
            filteredItems.map((item) => {
              const meta = getAchievementMeta(item.achievementType, item.category);

              return (
                <div key={item.id} className="py-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={item.userAvatar} name={item.userName} size="xs" />
                      <Link
                        href={`/dashboard/profile?userId=${item.userId}`}
                        className="font-bold text-xs text-zinc-900 dark:text-zinc-100 hover:text-purple-600"
                      >
                        {item.userName}
                      </Link>
                    </div>
                    <span className="font-mono font-black text-xs text-purple-600 dark:text-purple-400">
                      {item.score.toLocaleString()} ✨
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${meta.badgeBg}`}>
                      <span>{meta.emoji}</span>
                      <span>{item.title}</span>
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400 font-bold">
                      {item.period} • #{item.rank}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
