'use client';

import { useState } from 'react';
import SparksHistoryModal from '@/modules/leaderboard/components/SparksHistoryModal';

export function IndividualLeaderboardView({
  data,
  currentUserId,
  category,
}: {
  data: any[];
  currentUserId: string;
  category?: string;
}) {
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; userData?: any } | null>(null);

  if (data.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-zinc-500 text-sm font-medium">Belum ada data peringkat untuk periode ini.</p>
      </div>
    );
  }

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className="space-y-8">
      {/* Sparks History Modal */}
      <SparksHistoryModal
        userId={selectedUser?.id ?? null}
        userName={selectedUser?.name ?? null}
        category={category}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        leaderMeta={
          category === 'role_leader' && selectedUser?.userData
            ? {
                personalSparks: selectedUser.userData.personalSparks ?? 0,
                workspaceSparks: selectedUser.userData.workspaceSparks ?? 0,
                totalSparks: selectedUser.userData.totalSparks ?? 0,
              }
            : undefined
        }
      />

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
          {/* #2 Silver (Left) */}
          {top3[1] ? (
            <PodiumCard
              user={top3[1]}
              rank={2}
              medal="🥈"
              color="border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40"
              onOpenHistory={(id, name, userData) => setSelectedUser({ id, name, userData })}
            />
          ) : (
            <div className="hidden md:block" />
          )}

          {/* #1 Gold (Center - Higher) */}
          {top3[0] && (
            <PodiumCard
              user={top3[0]}
              rank={1}
              medal="🥇"
              color="border-amber-400 dark:border-amber-500/60 bg-amber-500/10 dark:bg-amber-500/10 -translate-y-2 md:-translate-y-4 shadow-lg shadow-amber-500/10"
              onOpenHistory={(id, name, userData) => setSelectedUser({ id, name, userData })}
            />
          )}

          {/* #3 Bronze (Right) */}
          {top3[2] ? (
            <PodiumCard
              user={top3[2]}
              rank={3}
              medal="🥉"
              color="border-amber-700/40 dark:border-amber-800/40 bg-amber-900/5 dark:bg-amber-900/10"
              onOpenHistory={(id, name, userData) => setSelectedUser({ id, name, userData })}
            />
          ) : (
            <div className="hidden md:block" />
          )}
        </div>
      )}

      {/* Rest Rankings Table */}
      {rest.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Peringkat Keseluruhan Tim</span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">💡 Klik poin Sparks ✨ untuk lihat riwayat</span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {rest.map((user) => {
              const isMe = user.userId === currentUserId;
              return (
                <div
                  key={user.userId}
                  className={`px-6 py-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                    isMe ? 'bg-purple-500/10 dark:bg-purple-500/10 font-bold' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 text-center text-xs font-black font-mono text-zinc-400">
                      #{user.rank}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300">
                      {user.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span>{user.userName}</span>
                        {isMe && (
                          <span className="text-[9px] bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full">
                            Anda
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                        {user.primaryRole} • {user.tasksCompleted} Tasks Completed
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <button
                      type="button"
                      onClick={() => setSelectedUser({ id: user.userId, name: user.userName, userData: user })}
                      className="text-right group p-2 rounded-2xl hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all cursor-pointer"
                      title="Klik untuk melihat riwayat Sparks"
                    >
                      <div className="text-sm font-black text-purple-600 dark:text-purple-400 flex items-center justify-end gap-1 group-hover:scale-105 transition-transform">
                        <span>{user.totalSparks}</span>
                        <span>✨</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {user.zeroRevisionCount} Direct Pass 🔍
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  user,
  rank,
  medal,
  color,
  onOpenHistory,
}: {
  user: any;
  rank: number;
  medal: string;
  color: string;
  onOpenHistory: (userId: string, userName: string, userData?: any) => void;
}) {
  return (
    <div className={`border rounded-3xl p-6 text-center space-y-3 relative overflow-hidden ${color}`}>
      <div className="text-4xl">{medal}</div>
      <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-purple-500/30 flex items-center justify-center mx-auto text-xl font-bold text-zinc-800 dark:text-zinc-200">
        {user.userName.charAt(0).toUpperCase()}
      </div>
      <div>
        <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{user.userName}</h4>
        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest block mt-0.5">
          {user.primaryRole}
        </span>
      </div>
      <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <button
          type="button"
          onClick={() => onOpenHistory(user.userId, user.userName, user)}
          className="w-full p-2 rounded-2xl hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all cursor-pointer group"
          title="Klik untuk melihat riwayat Sparks"
        >
          <div className="text-xl font-black text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1 group-hover:scale-105 transition-transform">
            <span>{user.totalSparks}</span>
            <span>✨</span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {user.tasksCompleted} Tasks Approved 🔍
          </div>
        </button>
      </div>
    </div>
  );
}
