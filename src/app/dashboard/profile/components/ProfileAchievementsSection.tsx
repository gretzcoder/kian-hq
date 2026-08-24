'use client';

import React, { useState } from 'react';
import { UserAchievementSummary, AchievementItem } from '@/modules/achievements/actions';
import { AchievementHistoryModal } from '@/components/AchievementHistoryModal';

interface ProfileAchievementsSectionProps {
  targetUserId: string;
  userName?: string;
  userAvatar?: string | null;
  userAchievements: UserAchievementSummary[];
  allAchievementHistory: AchievementItem[];
}

export function ProfileAchievementsSection({
  targetUserId,
  userName,
  userAvatar,
  userAchievements,
  allAchievementHistory,
}: ProfileAchievementsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const handleOpenModal = (category = 'ALL') => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Gelar Keahlian & Riwayat Achievement:
          </p>
          <button
            onClick={() => handleOpenModal('ALL')}
            className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
          >
            <span>Lihat All Achievement History ↗</span>
          </button>
        </div>

        {userAchievements.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-400 font-medium">
            Belum ada riwayat gelar juara atau keahlian utama yang tercatat. Selesaikan tugas & kumpulkan Sparks untuk meraih posisi teratas Leaderboard!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userAchievements.map((ach) => (
              <button
                key={ach.achievementType}
                onClick={() => handleOpenModal(ach.category)}
                className="p-3.5 rounded-2xl border bg-white/80 dark:bg-zinc-900/80 hover:border-purple-500/50 transition-all flex items-center justify-between gap-3 shadow-xs group cursor-pointer text-left w-full"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl p-2 rounded-xl bg-purple-500/10 shrink-0">{ach.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 transition-colors flex items-center gap-1.5 truncate">
                      <span className="truncate">{ach.title}</span>
                      {ach.streakCount > 1 && (
                        <span className="text-[9px] font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-full shrink-0">
                          🔥 {ach.streakCount}x Streak
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                      <span className="font-bold text-purple-600 dark:text-purple-400">{ach.totalCount}× Champion</span> • Last:{' '}
                      {new Date(ach.lastEarnedAt * 1000).toLocaleDateString('id-ID', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0 font-mono">↗</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Achievement History Modal */}
      <AchievementHistoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={allAchievementHistory}
        initialCategory={selectedCategory}
        userName={userName}
        userAvatar={userAvatar}
      />
    </>
  );
}
