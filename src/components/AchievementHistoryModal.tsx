'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
import { AchievementItem } from '@/modules/achievements/actions';
import { getAchievementMeta } from '@/modules/achievements/utils';

interface AchievementHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: AchievementItem[];
  initialCategory?: string;
  userName?: string;
  userAvatar?: string | null;
}

export function AchievementHistoryModal({
  isOpen,
  onClose,
  initialData,
  initialCategory = 'ALL',
  userName,
  userAvatar,
}: AchievementHistoryModalProps) {
  const normalizedCat = useMemo(() => {
    const raw = (initialCategory || 'ALL').toUpperCase();
    if (raw.includes('MENTOR')) return 'MENTOR';
    if (raw.includes('DESIGN')) return 'DESIGNER';
    if (raw.includes('EDITOR') || raw.includes('VIDEO')) return 'VIDEO_EDITOR';
    if (raw.includes('PLAN')) return 'PLANNER';
    if (raw.includes('RESEARCH')) return 'RESEARCHER';
    if (raw.includes('LEADER')) return 'TEAM_LEADER';
    if (raw.includes('PRODUCTIVE')) return 'PRODUCTIVE';
    if (raw.includes('QUALITY')) return 'QUALITY';
    if (raw.includes('WORKSPACE')) return 'WORKSPACE';
    if (raw.includes('CHAMPION')) return 'CHAMPION';
    return raw;
  }, [initialCategory]);

  const [categoryFilter, setCategoryFilter] = useState<string>(normalizedCat);
  const [groupFilter, setGroupFilter] = useState<'ALL' | 'TROOPERS' | 'MENTOR'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'WEEKLY' | 'MONTHLY'>('ALL');
  const [search, setSearch] = useState<string>('');

  // Synchronize categoryFilter when modal opens with new initialCategory
  React.useEffect(() => {
    if (isOpen) {
      setCategoryFilter(normalizedCat);
    }
  }, [isOpen, normalizedCat]);

  const categories = [
    { id: 'ALL', label: '🌐 Semua Kategori' },
    { id: 'CHAMPION', label: '🏆 Champion' },
    { id: 'PRODUCTIVE', label: '⚡ Most Productive' },
    { id: 'QUALITY', label: '🎯 High Quality' },
    { id: 'WORKSPACE', label: '🏢 Top Workspaces' },
    { id: 'TEAM_LEADER', label: '👑 Team Leaders' },
    { id: 'DESIGNER', label: '🎨 Designers' },
    { id: 'VIDEO_EDITOR', label: '🎬 Video Editors' },
    { id: 'PLANNER', label: '🧠 Planners' },
    { id: 'RESEARCHER', label: '🔍 Researchers' },
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

      // Group Filter Check (Semua / Troopers / Mentor)
      const isMentor =
        item.title.toLowerCase().includes('(mentor)') ||
        item.achievementType.toUpperCase().includes('MENTOR') ||
        (item.userRole && item.userRole.toUpperCase().includes('MENTOR')) ||
        item.category.toUpperCase() === 'MENTOR';

      if (groupFilter === 'TROOPERS' && isMentor) return false;
      if (groupFilter === 'MENTOR' && !isMentor) return false;

      // Period Filter Check (Weekly / Monthly)
      if (periodFilter === 'WEEKLY') {
        const isWeekly = item.period.toLowerCase().includes('week') || item.title.toLowerCase().includes('weekly') || item.achievementType.toUpperCase().includes('WEEKLY');
        if (!isWeekly) return false;
      } else if (periodFilter === 'MONTHLY') {
        const isMonthly = (!item.period.toLowerCase().includes('week') && !item.title.toLowerCase().includes('weekly')) || item.title.toLowerCase().includes('monthly') || item.achievementType.toUpperCase().includes('MONTHLY');
        if (!isMonthly) return false;
      }

      // Category Filter Check
      if (categoryFilter === 'ALL') return true;

      const catUpper = item.category.toUpperCase();
      const typeUpper = item.achievementType.toUpperCase();
      const titleUpper = item.title.toUpperCase();

      if (categoryFilter === 'CHAMPION') return catUpper === 'CHAMPION' || catUpper === 'WEEKLY' || catUpper === 'MONTHLY' || titleUpper.includes('CHAMPION');
      if (categoryFilter === 'PRODUCTIVE') return catUpper === 'PRODUCTIVE' || titleUpper.includes('PRODUCTIVE');
      if (categoryFilter === 'QUALITY') return catUpper === 'QUALITY' || titleUpper.includes('QUALITY');
      if (categoryFilter === 'WORKSPACE') return catUpper === 'WORKSPACE' || titleUpper.includes('WORKSPACE');
      if (categoryFilter === 'MENTOR') return catUpper === 'MENTOR' || catUpper.includes('MENTOR') || titleUpper.includes('MENTOR');
      if (categoryFilter === 'TEAM_LEADER') return catUpper === 'TEAM_LEADER' || catUpper.includes('LEADER') || titleUpper.includes('LEADER');
      if (categoryFilter === 'DESIGNER') return catUpper === 'DESIGNER' || catUpper.includes('DESIGN') || titleUpper.includes('DESIGN');
      if (categoryFilter === 'VIDEO_EDITOR') return catUpper === 'VIDEO_EDITOR' || catUpper.includes('EDITOR') || titleUpper.includes('VIDEO');
      if (categoryFilter === 'PLANNER') return catUpper === 'PLANNER' || catUpper.includes('PLAN') || titleUpper.includes('PLANNER');
      if (categoryFilter === 'RESEARCHER') return catUpper === 'RESEARCHER' || catUpper.includes('RESEARCH') || titleUpper.includes('RESEARCH');

      return true;
    });
  }, [initialData, categoryFilter, groupFilter, periodFilter, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            {userAvatar ? (
              <UserAvatar src={userAvatar} name={userName || 'User'} size="md" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                🏆
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Riwayat Achievement</span>
                {userName && <span className="text-purple-600 dark:text-purple-400 font-bold">• {userName}</span>}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Pencapaian peringkat 3 besar mingguan (Sabtu 24:00) & bulanan (akhir bulan) Leaderboard.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center font-bold text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Controls & Filters */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-4 bg-white dark:bg-zinc-950 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cari gelar, periode, atau nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
              <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Group Switcher */}
              <div className="grid grid-cols-3 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
                {[
                  { id: 'ALL', label: '🌐 Semua' },
                  { id: 'TROOPERS', label: '🚀 Troopers' },
                  { id: 'MENTOR', label: '🎓 Mentor' },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGroupFilter(g.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      groupFilter === g.id
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Period Switcher */}
              <div className="grid grid-cols-3 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'WEEKLY', label: '🗓️ Weekly' },
                  { id: 'MONTHLY', label: '📅 Monthly' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodFilter(p.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      periodFilter === p.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category Tabs Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
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

        {/* Modal Content Table / List */}
        <div className="p-6 overflow-y-auto flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-3xl opacity-50">🏆</span>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                Tidak ada riwayat achievement yang ditemukan untuk kategori ini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {filteredItems.map((item) => {
                    const meta = getAchievementMeta(item.achievementType, item.category);

                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20 transition-all">
                        {/* User Column */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar src={item.userAvatar} name={item.userName} size="sm" />
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.userName}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{item.userEmail}</p>
                            </div>
                          </div>
                        </td>

                        {/* Achievement Title Column */}
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border ${meta.badgeBg}`}>
                            <span>{meta.emoji}</span>
                            <span>{item.title}</span>
                          </span>
                        </td>

                        {/* Period Column */}
                        <td className="py-3 px-3 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          {item.period}
                        </td>

                        {/* Rank Column */}
                        <td className="py-3 px-3 text-center">
                          {item.rank === 1 && (
                            <span className="font-mono font-extrabold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                              🥇 #1
                            </span>
                          )}
                          {item.rank === 2 && (
                            <span className="font-mono font-extrabold text-slate-400 bg-slate-400/10 px-2.5 py-1 rounded-lg border border-slate-400/30">
                              🥈 #2
                            </span>
                          )}
                          {item.rank === 3 && (
                            <span className="font-mono font-extrabold text-amber-700 dark:text-amber-600 bg-amber-700/10 px-2.5 py-1 rounded-lg border border-amber-700/30">
                              🥉 #3
                            </span>
                          )}
                          {item.rank > 3 && (
                            <span className="font-mono font-extrabold text-zinc-500 bg-zinc-500/10 px-2.5 py-1 rounded-lg border border-zinc-500/20">
                              #{item.rank}
                            </span>
                          )}
                        </td>

                        {/* Score Column */}
                        <td className="py-3 px-3 text-right font-mono font-black text-purple-600 dark:text-purple-400 text-sm">
                          {item.score.toLocaleString()} ✨
                        </td>

                        {/* Earned Date Column */}
                        <td className="py-3 px-3 text-right font-mono text-zinc-400 text-[11px]">
                          {new Date(item.earnedAt * 1000).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
            {filteredItems.length} Record Achievement Tampil
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all cursor-pointer"
          >
            Tutup Modal
          </button>
        </div>
      </div>
    </div>
  );
}
