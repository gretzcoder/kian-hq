'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { getSparksHistory, SparksHistoryItem } from '@/modules/leaderboard/actions';
import {
  addPersonalAppreciationSparksAction,
  resetUserSparksAction,
  restoreUserSparksAction,
  deleteSparksAdjustmentAction,
  clearAllSparksAdjustmentsAction,
} from '@/modules/sparks/sparksActions';

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
  canManageSparks?: boolean;
  isWorkspaceMember?: boolean;
  coordinatorMeta?: CoordinatorMeta;
  leaderMeta?: LeaderMeta;
}

export default function SparksHistoryModal({
  userId,
  userName,
  category,
  period = 'week',
  isOpen,
  onClose,
  canManageSparks = false,
  isWorkspaceMember = false,
  coordinatorMeta,
  leaderMeta,
}: SparksHistoryModalProps) {
  const [activePeriod, setActivePeriod] = useState<'month' | 'week' | 'all'>(period);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'ALL' | 'TASKS' | 'APPRECIATION' | 'ADJUSTMENT'>('ALL');
  const [history, setHistory] = useState<SparksHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Submodals state
  const [showAppreciationModal, setShowAppreciationModal] = useState(false);
  const [appreciationAmount, setAppreciationAmount] = useState<number>(10);
  const [appreciationNote, setAppreciationNote] = useState('');

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetNote, setResetNote] = useState('');

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreCategory, setRestoreCategory] = useState<'ALL' | 'TASKS' | 'ASSESSMENT' | 'APPRECIATION'>('ALL');
  const [restoreNote, setRestoreNote] = useState('');

  // Delete & Clear state
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deletingItemTitle, setDeletingItemTitle] = useState<string | null>(null);

  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearAllCategory, setClearAllCategory] = useState<'ALL' | 'APPRECIATION' | 'ADJUSTMENT'>('ALL');

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHistory = (uId: string, cat?: string, p?: 'month' | 'week' | 'all') => {
    setLoading(true);
    getSparksHistory(uId, cat, p || activePeriod)
      .then((data) => {
        setHistory(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch sparks history:', err);
        setHistory([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !userId) return;
    fetchHistory(userId, category, activePeriod);
  }, [isOpen, userId, category, activePeriod]);

  if (!isOpen || !userId) return null;

  const totalSparks = history.reduce((sum, item) => sum + item.sparks, 0);

  // Categorize log entries
  const taskItems = history.filter((i) => !['APPRECIATION', 'RESET', 'RESTORE'].includes(i.assignmentRole));
  const appreciationItems = history.filter((i) => i.assignmentRole === 'APPRECIATION');
  const adjustmentItems = history.filter((i) => ['RESET', 'RESTORE'].includes(i.assignmentRole));

  const filteredHistory = history.filter((item) => {
    if (activeCategoryTab === 'TASKS') return !['APPRECIATION', 'RESET', 'RESTORE'].includes(item.assignmentRole);
    if (activeCategoryTab === 'APPRECIATION') return item.assignmentRole === 'APPRECIATION';
    if (activeCategoryTab === 'ADJUSTMENT') return ['RESET', 'RESTORE'].includes(item.assignmentRole);
    return true;
  });

  const displayedTotalSparks = filteredHistory.reduce((sum, item) => sum + item.sparks, 0);

  // Actions
  const handleAddAppreciationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await addPersonalAppreciationSparksAction(userId, appreciationAmount, appreciationNote);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Apresiasi berhasil diberikan!' });
        setShowAppreciationModal(false);
        setAppreciationNote('');
        fetchHistory(userId, category, activePeriod);
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal memberikan apresiasi' });
      }
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await resetUserSparksAction(userId, resetNote);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Sparks berhasil di-reset!' });
        setShowResetModal(false);
        setResetNote('');
        fetchHistory(userId, category, activePeriod);
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal mereset Sparks' });
      }
    });
  };

  const handleRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await restoreUserSparksAction(userId, restoreCategory, restoreNote);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Sparks berhasil dikembalikan!' });
        setShowRestoreModal(false);
        setRestoreNote('');
        fetchHistory(userId, category, activePeriod);
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal mengembalikan Sparks' });
      }
    });
  };

  const handleConfirmDeleteItem = () => {
    if (!deletingItemId || !userId) return;
    startTransition(async () => {
      const res = await deleteSparksAdjustmentAction(deletingItemId);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Entri log berhasil dihapus!' });
        fetchHistory(userId, category, activePeriod);
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal menghapus entri log' });
      }
      setDeletingItemId(null);
      setDeletingItemTitle(null);
    });
  };

  const handleConfirmClearAll = () => {
    if (!userId) return;
    startTransition(async () => {
      const res = await clearAllSparksAdjustmentsAction(userId, clearAllCategory);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Seluruh log berhasil dibersihkan!' });
        fetchHistory(userId, category, activePeriod);
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal membersihkan log' });
      }
      setShowClearAllModal(false);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-900">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                ✨ Sparks History
              </span>
              {userId && (
                category === 'workspace' ? (
                  (canManageSparks || isWorkspaceMember) && (
                    <Link
                      href={`/dashboard/workspace/${userId}`}
                      className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline flex items-center gap-1 bg-purple-500/5 hover:bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/15 transition-all"
                      title="Buka Halaman Workspace Ini"
                    >
                      <span>📁</span>
                      <span>Buka Workspace</span>
                      <span className="text-[9px] font-mono">↗</span>
                    </Link>
                  )
                ) : (
                  <Link
                    href={`/dashboard/profile?userId=${userId}`}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline flex items-center gap-1 bg-purple-500/5 hover:bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/15 transition-all"
                    title="Kunjungi Halaman Profil Pengguna Ini"
                  >
                    <span>👤</span>
                    <span>Lihat Profil</span>
                    <span className="text-[9px] font-mono">↗</span>
                  </Link>
                )
              )}
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
              Riwayat Perolehan Sparks: {userName || 'User'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Rincian poin apresiasi dari tugas, assessment, dan penyesuaian sistem.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Message Alert */}
        {msg && (
          <div
            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
            }`}
          >
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className="text-zinc-400 hover:text-zinc-700 ml-2">
              ✕
            </button>
          </div>
        )}

        {/* Controls Bar: Period Filter Selector & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900/60 rounded-2xl w-fit border border-zinc-200/80 dark:border-zinc-800/80">
            {[
              { id: 'week', label: '📅 Weekly' },
              { id: 'month', label: '🗓️ Monthly' },
              { id: 'all', label: '♾️ All-Time' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePeriod(p.id as any)}
                className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                  activePeriod === p.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {canManageSparks && category !== 'workspace' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowAppreciationModal(true)}
                className="px-2.5 py-1 text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition-all"
                title="Beri Sparks Apresiasi Personal"
              >
                ✨ + Apresiasi
              </button>
              <button
                onClick={() => setShowRestoreModal(true)}
                className="px-2.5 py-1 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all"
                title="Kembalikan Sparks Historis"
              >
                ↩ Restore
              </button>
              <button
                onClick={() => setShowResetModal(true)}
                className="px-2.5 py-1 text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all"
                title="Reset Saldo Sparks ke 0"
              >
                🔄 Reset
              </button>
              <button
                onClick={() => setShowClearAllModal(true)}
                className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1"
                title="Hapus / Bersihkan Log Penyesuaian & Apresiasi"
              >
                <span>🗑️</span>
                <span>Bersihkan Log</span>
              </button>
            </div>
          )}
        </div>

        {/* Category Filter Tabs for Easy Log Tracking */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-100 dark:border-zinc-800/60">
          <span className="text-[10px] font-black uppercase text-zinc-400 mr-1 shrink-0">Filter:</span>
          {[
            { id: 'ALL', label: `Semua Log (${history.length})` },
            { id: 'TASKS', label: `🎨 Tugas & Brief (${taskItems.length})` },
            { id: 'APPRECIATION', label: `✨ Apresiasi (${appreciationItems.length})` },
            { id: 'ADJUSTMENT', label: `🔄 Log System (${adjustmentItems.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategoryTab(tab.id as any)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition-all ${
                activeCategoryTab === tab.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Summary Card — Rincian Terpisah per Kategori ── */}
        {category === 'coordinator' && coordinatorMeta ? (
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
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                Total Sparks {activeCategoryTab === 'TASKS' ? 'Tugas & Brief' : activeCategoryTab === 'APPRECIATION' ? 'Apresiasi' : activeCategoryTab === 'ADJUSTMENT' ? 'Log System' : ''} ({activePeriod === 'week' ? 'Minggu Ini' : activePeriod === 'month' ? 'Bulan Ini' : 'All-Time'})
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                  {Math.max(0, displayedTotalSparks).toLocaleString()} ✨
                </span>
                {activeCategoryTab !== 'ALL' && (
                  <span className="text-xs text-zinc-400 font-mono font-medium">
                    (dari total {Math.max(0, totalSparks).toLocaleString()} ✨)
                  </span>
                )}
              </div>
            </div>

            {/* Counter Breakdown */}
            <div className="flex items-center gap-2 flex-wrap sm:justify-end text-xs font-mono">
              <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-xl font-bold">
                🎨 {taskItems.length} Tugas
              </span>
              <span className="bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 px-2.5 py-1 rounded-xl font-bold">
                ✨ {appreciationItems.length} Apresiasi
              </span>
              {adjustmentItems.length > 0 && (
                <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-xl font-bold">
                  🔄 {adjustmentItems.length} Log System
                </span>
              )}
            </div>
          </div>
        )}

        {/* History Item List */}
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-8 text-xs text-zinc-400 animate-pulse">
              Memuat riwayat Sparks...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400 italic">
              Belum ada entri log untuk filter ini.
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isAdjustment = ['APPRECIATION', 'RESET', 'RESTORE'].includes(item.assignmentRole);

              // Badge styling per role/type
              let roleBadgeStyle = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
              let roleBadgeLabel = item.assignmentRole;

              if (item.assignmentRole === 'APPRECIATION') {
                roleBadgeStyle = 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
                roleBadgeLabel = '✨ APPRECIATION';
              } else if (item.assignmentRole === 'RESTORE') {
                roleBadgeStyle = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
                roleBadgeLabel = '↩ RESTORE';
              } else if (item.assignmentRole === 'RESET') {
                roleBadgeStyle = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
                roleBadgeLabel = '🔄 RESET';
              } else if (item.assignmentRole === 'MENTOR') {
                roleBadgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                roleBadgeLabel = '📝 BRIEF ASSESSMENT';
              }

              return (
                <div
                  key={item.assignmentId}
                  className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl p-3.5 space-y-2 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {item.taskTitle}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${roleBadgeStyle}`}>
                          {roleBadgeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        📁 {item.workspaceName} • 📌 {item.projectName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className={`text-sm font-black font-mono ${item.sparks >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-500'}`}>
                          {item.sparks >= 0 ? `+${item.sparks}` : item.sparks} ✨
                        </span>
                        {item.reviewedAt > 0 && (() => {
                          const ms = item.reviewedAt > 100000000000 ? item.reviewedAt : item.reviewedAt * 1000;
                          return (
                            <p className="text-[9px] text-zinc-400 font-mono">
                              {new Date(ms).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          );
                        })()}
                      </div>

                      {canManageSparks && isAdjustment && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingItemId(item.assignmentId);
                            setDeletingItemTitle(item.taskTitle);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-xs"
                          title="Hapus entri log ini"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {!isAdjustment && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-wrap gap-2 text-[10px] text-zinc-500 font-mono">
                      <span>Base: {item.rawSparks}</span>
                      <span>• Role Mult: x{item.roleMultiplier}</span>
                      <span>• Quality Mult: x{item.qualityMultiplier}</span>
                      {item.coordinatorMultiplier && item.coordinatorMultiplier !== 1.0 && (
                        <span className="font-bold text-amber-500">• Coordinator Mult: x{item.coordinatorMultiplier}</span>
                      )}
                    </div>
                  )}

                  {item.revisionNote && (
                    <p className="text-[10px] italic text-zinc-400 bg-zinc-100 dark:bg-zinc-800/40 px-2.5 py-1 rounded-lg">
                      💬 Catatan: {item.revisionNote}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Submodal 1: Appreciation */}
      {showAppreciationModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Beri Apresiasi Personal</h3>
            <form onSubmit={handleAddAppreciationSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Jumlah Sparks</label>
                <input
                  type="number"
                  min={1}
                  value={appreciationAmount}
                  onChange={(e) => setAppreciationAmount(Number(e.target.value))}
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Catatan</label>
                <textarea
                  value={appreciationNote}
                  onChange={(e) => setAppreciationNote(e.target.value)}
                  required
                  rows={2}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAppreciationModal(false)} className="flex-1 py-1.5 text-xs font-bold border rounded-xl text-zinc-500">Batal</button>
                <button type="submit" disabled={pending} className="flex-1 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-xl">Kirim</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submodal 2: Reset */}
      {showResetModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-red-600">Reset Sparks Pengguna</h3>
            <p className="text-xs text-zinc-500">Reset saldo ke 0. Log riwayat historis tetap tersimpan.</p>
            <form onSubmit={handleResetSubmit} className="space-y-3">
              <input
                type="text"
                value={resetNote}
                onChange={(e) => setResetNote(e.target.value)}
                placeholder="Catatan reset..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100"
              />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 py-1.5 text-xs font-bold border rounded-xl text-zinc-500">Batal</button>
                <button type="submit" disabled={pending} className="flex-1 py-1.5 text-xs font-bold bg-red-600 text-white rounded-xl">Mereset ke 0</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submodal 3: Restore */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-indigo-600">Kembalikan Sparks (Restore)</h3>
            <p className="text-xs text-zinc-500">Sparks historis (sebelum reset) akan ditambahkan secara additif ke total saldo pengguna saat ini.</p>
            <form onSubmit={handleRestoreSubmit} className="space-y-3">
              <select
                value={restoreCategory}
                onChange={(e) => setRestoreCategory(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ALL">👥 Semua Kategori Historis</option>
                <option value="TASKS">🎨 Troopers Tasks Sparks</option>
                <option value="ASSESSMENT">📝 Brief Assessment Sparks</option>
                <option value="APPRECIATION">✨ Apresiasi Personal Sparks</option>
              </select>
              <input
                type="text"
                value={restoreNote}
                onChange={(e) => setRestoreNote(e.target.value)}
                placeholder="Catatan restore..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100"
              />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowRestoreModal(false)} className="flex-1 py-1.5 text-xs font-bold border rounded-xl text-zinc-500">Batal</button>
                <button type="submit" disabled={pending} className="flex-1 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl">Konfirmasi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submodal 4: Delete Single Item Confirm */}
      {deletingItemId && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-rose-600">Hapus Entri Log Sparks?</h3>
            <p className="text-xs text-zinc-500">
              Apakah Anda yakin ingin menghapus entri log <span className="font-bold text-zinc-800 dark:text-zinc-200">"{deletingItemTitle}"</span>? Pengaruh penyesuaian/apresiasi poin ini akan dihapus dari saldo Sparks.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingItemId(null);
                  setDeletingItemTitle(null);
                }}
                className="flex-1 py-1.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                disabled={pending}
                className="flex-1 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all"
              >
                {pending ? 'Menghapus...' : 'Hapus Entri'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submodal 5: Clear All Adjustments Confirm */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-rose-600">Bersihkan Log Penyesuaian Sparks</h3>
            <p className="text-xs text-zinc-500">
              Pilih kategori log yang ingin dibersihkan secara massal untuk pengguna ini.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Cakupan Pembersihan</label>
                <select
                  value={clearAllCategory}
                  onChange={(e) => setClearAllCategory(e.target.value as any)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="ALL">👥 Semua Log Penyesuaian & Apresiasi</option>
                  <option value="APPRECIATION">✨ Log Apresiasi Personal Saja</option>
                  <option value="ADJUSTMENT">🔄 Log Reset & Restore Saja</option>
                </select>
              </div>
              <p className="text-[11px] text-rose-500 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                ⚠️ Tindakan ini akan menghapus seluruh entri log yang dipilih dan tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(false)}
                  className="flex-1 py-1.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  disabled={pending}
                  className="flex-1 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all"
                >
                  {pending ? 'Membersihkan...' : 'Bersihkan Log'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
