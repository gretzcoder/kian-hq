'use client';

import { useState, useEffect, useTransition } from 'react';
import { getSparksHistory, SparksHistoryItem } from '@/modules/leaderboard/actions';
import {
  addPersonalAppreciationSparksAction,
  resetUserSparksAction,
  restoreUserSparksAction,
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
  coordinatorMeta?: CoordinatorMeta;
  leaderMeta?: LeaderMeta;
}

export default function SparksHistoryModal({
  userId,
  userName,
  category,
  period = 'month',
  isOpen,
  onClose,
  canManageSparks = true,
  coordinatorMeta,
  leaderMeta,
}: SparksHistoryModalProps) {
  const [activePeriod, setActivePeriod] = useState<'month' | 'week' | 'all'>(period);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
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
              { id: 'month', label: '🗓️ Bulan Ini' },
              { id: 'week', label: '📅 Minggu Ini' },
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

          {canManageSparks && (
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
            </div>
          )}
        </div>

        {/* ── Summary Card — berbeda per kategori ── */}
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
          <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                Total Sparks ({activePeriod === 'week' ? 'Minggu Ini' : activePeriod === 'month' ? 'Bulan Ini' : 'All-Time'})
              </span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                {Math.max(0, totalSparks).toLocaleString()} ✨
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                Jumlah Entri Log
              </span>
              <span className="text-lg font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                {history.length} tugas/penyesuaian
              </span>
            </div>
          </div>
        )}

        {/* History Item List */}
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-8 text-xs text-zinc-400 animate-pulse">
              Memuat riwayat Sparks...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400 italic">
              Belum ada riwayat perolehan Sparks untuk periode ini.
            </div>
          ) : (
            history.map((item) => {
              const isAdjustment = ['APPRECIATION', 'RESET', 'RESTORE'].includes(item.assignmentRole);

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
                        <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md border border-purple-500/20">
                          {item.assignmentRole}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        📁 {item.workspaceName} • 📌 {item.projectName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-sm font-black font-mono ${item.sparks >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-500'}`}>
                        {item.sparks >= 0 ? `+${item.sparks}` : item.sparks} ✨
                      </span>
                      {item.reviewedAt > 0 && (
                        <p className="text-[9px] text-zinc-400 font-mono">
                          {new Date(item.reviewedAt * 1000).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isAdjustment && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-wrap gap-2 text-[10px] text-zinc-500 font-mono">
                      <span>Base: {item.rawSparks}</span>
                      <span>• Role Mult: x{item.roleMultiplier}</span>
                      <span>• Quality Mult: x{item.qualityMultiplier}</span>
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
    </div>
  );
}
