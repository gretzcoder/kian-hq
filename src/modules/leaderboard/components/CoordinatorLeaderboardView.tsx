'use client';

import { useState } from 'react';
import Link from 'next/link';
import SparksHistoryModal from '@/modules/leaderboard/components/SparksHistoryModal';

interface CoordinatorItem {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  reviewsProcessed: number;
  avgSparksAwarded: number;
  totalSparksGiven: number;
  speedBonusCount: number;
  coordinatorScore: number;
}

export function CoordinatorLeaderboardView({
  data,
  currentUserId,
  period,
  canManageSparks = false,
}: {
  data: CoordinatorItem[];
  currentUserId: string;
  period?: 'month' | 'week' | 'all';
  canManageSparks?: boolean;
}) {
  const [selectedMentor, setSelectedMentor] = useState<{
    id: string;
    name: string;
    coordinatorMeta?: {
      reviewsProcessed: number;
      totalSparksGiven: number;
      speedBonusCount: number;
      coordinatorScore: number;
    };
  } | null>(null);

  if (data.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
        <p className="text-4xl mb-3">👑</p>
        <p className="text-zinc-500 text-sm font-medium">Belum ada data peringkat mentor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sparks History Modal */}
      <SparksHistoryModal
        userId={selectedMentor?.id ?? null}
        userName={selectedMentor ? `Mentor: ${selectedMentor.name}` : null}
        category="coordinator"
        period={period}
        isOpen={!!selectedMentor}
        onClose={() => setSelectedMentor(null)}
        canManageSparks={canManageSparks}
        coordinatorMeta={selectedMentor?.coordinatorMeta}
      />

      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>Peringkat Kepemimpinan Mentor & Koordinator</span>
          <span className="text-[10px] text-amber-500 font-normal">💡 Klik poin Sparks ✨ untuk lihat riwayat bimbingan</span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {data.map((c) => {
            const isMe = c.userId === currentUserId;
            return (
              <div
                key={c.userId}
                className={`p-6 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                  isMe ? 'bg-amber-500/10 font-bold' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 text-center text-sm font-black font-mono text-zinc-400">
                    #{c.rank}
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Link
                        href={`/dashboard/profile?userId=${c.userId}`}
                        className="hover:text-amber-500 hover:underline transition-colors flex items-center gap-1"
                        title="Kunjungi Profil Pengguna"
                      >
                        <span>{c.userName}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">↗</span>
                      </Link>
                      {isMe && (
                        <span className="text-[9px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                          Anda
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {c.reviewsProcessed} Reviews • Avg {c.avgSparksAwarded} ✨ • ⚡ {c.speedBonusCount} Speed Bonus
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedMentor({
                      id: c.userId,
                      name: c.userName,
                      coordinatorMeta: {
                        reviewsProcessed: c.reviewsProcessed,
                        totalSparksGiven: c.totalSparksGiven,
                        speedBonusCount: c.speedBonusCount,
                        coordinatorScore: c.coordinatorScore,
                      },
                    })
                  }
                  className="text-right group p-2 rounded-2xl hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all cursor-pointer"
                  title="Klik untuk melihat riwayat bimbingan mentor ini"
                >
                  <div className="text-lg font-black text-amber-500 flex items-center justify-end gap-1 group-hover:scale-105 transition-transform">
                    <span>{c.coordinatorScore.toLocaleString()}</span>
                    <span>🏅</span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono group-hover:text-amber-500 transition-colors">
                    Coordinator Score 🔍
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
