'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addPersonalAppreciationSparksAction,
  resetUserSparksAction,
  restoreUserSparksAction,
} from '@/modules/sparks/sparksActions';
import SparksHistoryModal from '@/modules/leaderboard/components/SparksHistoryModal';

interface ProfileSparksActionsProps {
  targetUserId: string;
  targetUserName: string;
  canManageSparks: boolean;
  totalSparks: number;
}

export default function ProfileSparksActions({
  targetUserId,
  targetUserName,
  canManageSparks,
  totalSparks,
}: ProfileSparksActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAppreciationModal, setShowAppreciationModal] = useState(false);
  const [appreciationAmount, setAppreciationAmount] = useState<number>(10);
  const [appreciationNote, setAppreciationNote] = useState('');

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetNote, setResetNote] = useState('');

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreCategory, setRestoreCategory] = useState<'ALL' | 'TASKS' | 'ASSESSMENT' | 'APPRECIATION'>('ALL');
  const [restoreNote, setRestoreNote] = useState('');

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddAppreciationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await addPersonalAppreciationSparksAction(
        targetUserId,
        appreciationAmount,
        appreciationNote
      );
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Apresiasi Sparks berhasil diberikan!' });
        setShowAppreciationModal(false);
        setAppreciationNote('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal memberikan apresiasi' });
      }
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await resetUserSparksAction(targetUserId, resetNote);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Sparks pengguna berhasil di-reset!' });
        setShowResetModal(false);
        setResetNote('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal mereset Sparks' });
      }
    });
  };

  const handleRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await restoreUserSparksAction(targetUserId, restoreCategory, restoreNote);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Sparks pengguna berhasil dikembalikan!' });
        setShowRestoreModal(false);
        setRestoreNote('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal mengembalikan Sparks' });
      }
    });
  };

  return (
    <div className="flex flex-col items-center sm:items-end gap-2 shrink-0">
      {/* Alert Msg */}
      {msg && (
        <div
          className={`w-full p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-between animate-in fade-in ${
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

      {/* Clickable Total Sparks Badge Card (Original Right Position) */}
      <button
        type="button"
        onClick={() => setShowHistoryModal(true)}
        className="flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl shrink-0 transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-xs cursor-pointer group"
        title="Klik untuk melihat riwayat lengkap perolehan Sparks"
      >
        <span className="text-lg sm:text-xl group-hover:rotate-12 transition-transform">✨</span>
        <div className="text-center sm:text-left">
          <p className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-300 leading-none">
            {totalSparks} Sparks
          </p>
          <p className="text-[8px] sm:text-[9px] text-purple-600/80 dark:text-purple-400/80 font-bold uppercase tracking-wider flex items-center gap-0.5 mt-0.5">
            <span>Total Terkumpul</span>
            <span className="text-[9px] font-mono group-hover:translate-x-0.5 transition-transform">↗</span>
          </p>
        </div>
      </button>

      {/* Coordinator Actions ONLY (Aligned Underneath) */}
      {canManageSparks && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
          <button
            onClick={() => setShowAppreciationModal(true)}
            className="px-2 py-1 text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition-all"
            title="Beri Sparks Apresiasi Personal (Koordinator)"
          >
            ✨ + Apresiasi
          </button>
          <button
            onClick={() => setShowRestoreModal(true)}
            className="px-2 py-1 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all"
            title="Kembalikan Sparks Historis (Koordinator)"
          >
            ↩ Restore
          </button>
          <button
            onClick={() => setShowResetModal(true)}
            className="px-2 py-1 text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all"
            title="Reset Saldo Sparks ke 0 (Koordinator)"
          >
            🔄 Reset
          </button>
        </div>
      )}

      {/* History Log Modal */}
      <SparksHistoryModal
        userId={targetUserId}
        userName={targetUserName}
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        period="all"
        canManageSparks={canManageSparks}
      />

      {/* Appreciation Modal */}
      {showAppreciationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                    Beri Apresiasi Personal (Koordinator)
                  </h3>
                  <p className="text-[11px] text-zinc-500">{targetUserName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAppreciationModal(false)}
                className="text-zinc-400 hover:text-zinc-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAppreciationSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                  Jumlah Sparks ✨ <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={appreciationAmount}
                  onChange={(e) => setAppreciationAmount(Number(e.target.value))}
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-bold rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                  Catatan Apresiasi <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={appreciationNote}
                  onChange={(e) => setAppreciationNote(e.target.value)}
                  required
                  rows={2}
                  placeholder="e.g. Apresiasi atas kinerja luar biasa"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppreciationModal(false)}
                  className="flex-1 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl disabled:opacity-50"
                >
                  {pending ? 'Menyimpan...' : `Kirim +${appreciationAmount} ✨`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔄</span>
                <div>
                  <h3 className="text-sm font-black text-red-600 dark:text-red-400">
                    Reset Sparks Pengguna (Koordinator)
                  </h3>
                  <p className="text-[11px] text-zinc-500">{targetUserName}</p>
                </div>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-zinc-400 hover:text-zinc-700 text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-red-500/5 p-3 rounded-xl border border-red-500/10">
              Tindakan ini akan me-reset total saldo Sparks milik <strong>{targetUserName}</strong> (saat ini {totalSparks} ✨) menjadi 0. <strong>Riwayat log historis tetap tersimpan 100%.</strong>
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                  Catatan Reset (Opsional)
                </label>
                <input
                  type="text"
                  value={resetNote}
                  onChange={(e) => setResetNote(e.target.value)}
                  placeholder="e.g. Reset saldo periode baru"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3.5 py-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl disabled:opacity-50"
                >
                  {pending ? 'Mereset...' : 'Konfirmasi Reset ke 0'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">↩</span>
                <div>
                  <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    Kembalikan Sparks / Restore (Koordinator)
                  </h3>
                  <p className="text-[11px] text-zinc-500">{targetUserName}</p>
                </div>
              </div>
              <button onClick={() => setShowRestoreModal(false)} className="text-zinc-400 hover:text-zinc-700 text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
              Pilih kategori Sparks historis yang ingin dikembalikan. Nilai Sparks yang dikembalikan akan **ditambahkan secara additif** ke total saldo pengguna saat ini.
            </p>

            <form onSubmit={handleRestoreSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                  Kategori Sumber Pengembalian <span className="text-red-500">*</span>
                </label>
                <select
                  value={restoreCategory}
                  onChange={(e) => setRestoreCategory(e.target.value as any)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="ALL">👥 Semua Kategori Historis</option>
                  <option value="TASKS">🎨 Troopers Tasks Sparks</option>
                  <option value="ASSESSMENT">📝 Brief Assessment Sparks</option>
                  <option value="APPRECIATION">✨ Apresiasi Personal Sparks</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                  Catatan Pengembalian (Opsional)
                </label>
                <input
                  type="text"
                  value={restoreNote}
                  onChange={(e) => setRestoreNote(e.target.value)}
                  placeholder="e.g. Pengembalian Sparks setelah penyesuaian"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3.5 py-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="flex-1 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-50"
                >
                  {pending ? 'Mengembalikan...' : 'Konfirmasi Pengembalian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
