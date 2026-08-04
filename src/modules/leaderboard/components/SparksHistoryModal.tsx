'use client';

import { useState, useEffect } from 'react';
import { getSparksHistory, SparksHistoryItem } from '@/modules/leaderboard/actions';

interface CoordinatorMeta {
  reviewsProcessed: number;
  totalSparksGiven: number;
  speedBonusCount: number;
  coordinatorScore: number;
}

interface LeaderMeta {
  personalSparks: number;
  workspaceSparks: number;
  totalSparks: number;
}

interface SparksHistoryModalProps {
  userId: string | null;
  userName: string | null;
  category?: string;
  period?: 'month' | 'week' | 'all';
  isOpen: boolean;
  onClose: () => void;
  /** Pass when category === 'coordinator' to show score formula breakdown */
  coordinatorMeta?: CoordinatorMeta;
  /** Pass when category === 'role_leader' to show personal vs workspace split */
  leaderMeta?: LeaderMeta;
}

export default function SparksHistoryModal({
  userId,
  userName,
  category,
  period = 'month',
  isOpen,
  onClose,
  coordinatorMeta,
  leaderMeta,
}: SparksHistoryModalProps) {
  const [history, setHistory] = useState<SparksHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setLoading(true);

    getSparksHistory(userId, category, period)
      .then((data) => {
        if (isMounted) {
          setHistory(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch sparks history:', err);
        if (isMounted) {
          setHistory([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  if (!isOpen || !userId) return null;

  const totalSparks = history.reduce((sum, item) => sum + item.sparks, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                ✨ Sparks History
              </span>
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
              Riwayat Perolehan Sparks: {userName || 'User'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Rincian poin apresiasi dari setiap tugas yang diselesaikan.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* ── Summary Card — berbeda per kategori ── */}
        {category === 'coordinator' && coordinatorMeta ? (
          /* Coordinator: tampilkan breakdown formula lengkap */
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-950/20 border border-amber-500/20 rounded-2xl p-4 space-y-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
              📊 Coordinator Score Breakdown
            </span>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Reviews Diproses × 5</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">
                  {coordinatorMeta.reviewsProcessed} × 5 ={' '}
                  <span className="text-amber-500">+{coordinatorMeta.reviewsProcessed * 5}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Sparks Tim Workspace × 10</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">
                  {coordinatorMeta.totalSparksGiven} × 10 ={' '}
                  <span className="text-amber-500">+{(coordinatorMeta.totalSparksGiven * 10).toLocaleString()}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Speed Bonus ({'<'}2 jam) × 3</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">
                  {coordinatorMeta.speedBonusCount} × 3 ={' '}
                  <span className="text-amber-500">+{coordinatorMeta.speedBonusCount * 3}</span>
                </span>
              </div>
              <div className="border-t border-amber-500/20 pt-2.5 flex justify-between items-center">
                <span className="font-black text-amber-600 dark:text-amber-400 uppercase text-[11px] tracking-wider">
                  Total Coordinator Score
                </span>
                <span className="text-xl font-black text-amber-500 font-mono">
                  🏅 {coordinatorMeta.coordinatorScore.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 border-t border-amber-500/10 pt-2">
              Riwayat task di bawah adalah seluruh task tim workspace yang dibimbing mentor ini.
            </p>
          </div>
        ) : category === 'role_leader' && leaderMeta ? (
          /* Team Leader: tampilkan split poin pribadi vs workspace */
          <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-purple-950/20 border border-purple-500/20 rounded-2xl p-4 space-y-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
              👑 Leader Score Breakdown
            </span>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Poin Task Pribadi</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  +{leaderMeta.personalSparks} ✨
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Total Sparks Tim Workspace</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  +{leaderMeta.workspaceSparks} ✨
                </span>
              </div>
              <div className="border-t border-purple-500/20 pt-2.5 flex justify-between items-center">
                <span className="font-black text-purple-600 dark:text-purple-400 uppercase text-[11px] tracking-wider">
                  Total Leader Score
                </span>
                <span className="text-xl font-black text-purple-500 dark:text-purple-400 font-mono">
                  ✨ {leaderMeta.totalSparks}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 border-t border-purple-500/10 pt-2">
              Riwayat task di bawah adalah poin pribadi dari task yang dikerjakan leader ini.
            </p>
          </div>
        ) : (
          /* Default: total sparks biasa */
          <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-purple-950/20 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                {category === 'workspace' ? 'Total Poin Task Seluruh Tim' : 'Total Poin Task'}
              </span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                ✨ {totalSparks} Sparks Poin
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Tugas Disetujui</span>
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                {history.length} Tasks
              </span>
            </div>
          </div>
        )}

        {/* Content History List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-400 font-bold animate-pulse">
            Memuat riwayat Sparks...
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 font-bold border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            Belum ada perolehan Sparks yang tercatat.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {history.map((item) => (
              <div
                key={item.assignmentId}
                className="border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-purple-500/30 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/15">
                        {item.assignmentRole}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {item.projectName} {item.workspaceName ? `› ${item.workspaceName}` : ''}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
                      {item.taskTitle}
                    </h4>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-base font-black text-purple-600 dark:text-purple-400 font-mono bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-xl block w-fit sm:ml-auto">
                      + {item.sparks} ✨
                    </span>
                  </div>
                </div>

                {/* Formula Breakdown per task */}
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-bold">
                      Base: {item.rawSparks}
                    </span>
                    <span>×</span>
                    <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-bold">
                      Role ({item.assignmentRole}): {item.roleMultiplier}x
                    </span>
                    <span>×</span>
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-bold">
                      Disiplin ({item.qualityMultiplier}x)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.isZeroRevision && <span className="text-emerald-500 font-bold">✓ Direct Pass</span>}
                    {item.isOnTime && <span className="text-blue-500 font-bold">⚡ On-Time</span>}
                    {item.reviewedAt > 0 && (
                      <span>
                        {new Date(item.reviewedAt * 1000).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
