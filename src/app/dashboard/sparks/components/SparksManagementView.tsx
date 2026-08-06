'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SparksOverviewData,
  UserSparksRankItem,
  addPersonalAppreciationSparksAction,
  resetUserSparksAction,
  restoreUserSparksAction,
} from '@/modules/sparks/sparksActions';
import SparksHistoryModal from '@/modules/leaderboard/components/SparksHistoryModal';

interface SparksManagementViewProps {
  overview: SparksOverviewData;
  period: 'all' | 'month' | 'week';
}

export default function SparksManagementView({ overview, period }: SparksManagementViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [pending, startTransition] = useTransition();

  // Modals state
  const [appreciationModalUser, setAppreciationModalUser] = useState<UserSparksRankItem | null>(null);
  const [appreciationAmount, setAppreciationAmount] = useState<number>(10);
  const [appreciationNote, setAppreciationNote] = useState('');

  const [resetModalUser, setResetModalUser] = useState<UserSparksRankItem | null>(null);
  const [resetNote, setResetNote] = useState('');

  const [restoreModalUser, setRestoreModalUser] = useState<UserSparksRankItem | null>(null);
  const [restoreCategory, setRestoreCategory] = useState<'ALL' | 'TASKS' | 'ASSESSMENT' | 'APPRECIATION'>('ALL');
  const [restoreNote, setRestoreNote] = useState('');

  const [historyModalUserId, setHistoryModalUserId] = useState<string | null>(null);
  const [historyModalUserName, setHistoryModalUserName] = useState<string | null>(null);

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Period Change
  const handlePeriodChange = (newPeriod: 'all' | 'month' | 'week') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', newPeriod);
    router.push(`/dashboard/sparks?${params.toString()}`);
  };

  // Actions
  const handleAddAppreciationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appreciationModalUser) return;

    startTransition(async () => {
      const res = await addPersonalAppreciationSparksAction(
        appreciationModalUser.userId,
        appreciationAmount,
        appreciationNote
      );
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Apresiasi berhasil diberikan!' });
        setAppreciationModalUser(null);
        setAppreciationNote('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal memberikan apresiasi' });
      }
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;

    startTransition(async () => {
      const res = await resetUserSparksAction(resetModalUser.userId, resetNote);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Sparks pengguna berhasil di-reset!' });
        setResetModalUser(null);
        setResetNote('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal mereset Sparks' });
      }
    });
  };

  const handleRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreModalUser) return;

    startTransition(async () => {
      const res = await restoreUserSparksAction(restoreModalUser.userId, restoreCategory, restoreNote);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Sparks pengguna berhasil dikembalikan!' });
        setRestoreModalUser(null);
        setRestoreNote('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: res.error || 'Gagal mengembalikan Sparks' });
      }
    });
  };

  // Filtered Users
  const filteredUsers = overview.users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = u.userName.toLowerCase().includes(q) || u.userEmail.toLowerCase().includes(q);

    if (roleFilter === 'ALL') return matchesSearch;
    const rUpper = (u.roleNames || '').toUpperCase() + ' ' + u.userType.toUpperCase();
    if (roleFilter === 'TROOPERS') return matchesSearch && (rUpper.includes('TROOPER') || rUpper.includes('OJT'));
    if (roleFilter === 'MENTOR') return matchesSearch && rUpper.includes('MENTOR');
    if (roleFilter === 'COORDINATOR') return matchesSearch && rUpper.includes('COORDINATOR');

    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-purple-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-purple-500/20">
              ✨
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                Sparks Management
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Kelola distribusi poin apresiasi Sparks, reset saldo, dan apresiasi personal pengguna.
              </p>
            </div>
          </div>
        </div>

        {/* Period Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          {[
            { id: 'month', label: '🗓️ Bulan Ini' },
            { id: 'week', label: '📅 Minggu Ini' },
            { id: 'all', label: '♾️ All-Time' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePeriodChange(p.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === p.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Success/Error Alerts */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between animate-in fade-in duration-150 ${
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

      {/* ── Category Statistics Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
            ⚡ Total Sparks Terdistribusi
          </p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {overview.stats.totalDistributed.toLocaleString()} ✨
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
            🎨 Troopers Tasks
          </p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 font-mono">
            {overview.stats.troopersSparks.toLocaleString()} ✨
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
            📝 Brief Assessments
          </p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 font-mono">
            {overview.stats.assessmentSparks.toLocaleString()} ✨
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400">
            ✨ Apresiasi Personal
          </p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 font-mono">
            {overview.stats.appreciationSparks.toLocaleString()} ✨
          </p>
        </div>
      </div>

      {/* ── User Ranking & Actions Table ── */}
      <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm">
        {/* Table Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pengguna berdasarkan nama/email..."
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'ALL', label: '👥 Semua' },
              { id: 'TROOPERS', label: '👤 Troopers' },
              { id: 'MENTOR', label: '🎓 Mentor' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRoleFilter(r.id)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
                  roleFilter === r.id
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rankings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-black">
                <th className="pb-3 px-3">Rank</th>
                <th className="pb-3 px-3">Pengguna</th>
                <th className="pb-3 px-3">Role</th>
                <th className="pb-3 px-3 text-center">Troopers Tasks</th>
                <th className="pb-3 px-3 text-center">Assessments</th>
                <th className="pb-3 px-3 text-center">Apresiasi</th>
                <th className="pb-3 px-3 text-right">Total Sparks</th>
                <th className="pb-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400 italic">
                    Tidak ada pengguna yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const rankBadge =
                    u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`;

                  return (
                    <tr key={u.userId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20 transition-all">
                      <td className="py-3.5 px-3 font-mono font-bold text-zinc-500">{rankBadge}</td>
                      <td className="py-3.5 px-3">
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{u.userName}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{u.userEmail}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                          {u.roleNames || u.userType}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-zinc-600 dark:text-zinc-400">
                        {u.tasksCompleted}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-zinc-600 dark:text-zinc-400">
                        {u.assessmentsCount}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-zinc-600 dark:text-zinc-400">
                        {u.appreciationCount}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <span className="font-mono font-black text-sm text-purple-600 dark:text-purple-400">
                          {u.totalSparks.toLocaleString()} ✨
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setAppreciationModalUser(u)}
                            className="px-2.5 py-1 text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-all"
                            title="Beri Sparks Apresiasi Personal"
                          >
                            ✨ + Apresiasi
                          </button>
                          <button
                            onClick={() => setRestoreModalUser(u)}
                            className="px-2 py-1 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-all"
                            title="Kembalikan Sparks Historis"
                          >
                            ↩ Restore
                          </button>
                          <button
                            onClick={() => setResetModalUser(u)}
                            className="px-2 py-1 text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
                            title="Reset Saldo Sparks ke 0"
                          >
                            🔄 Reset
                          </button>
                          <button
                            onClick={() => {
                              setHistoryModalUserId(u.userId);
                              setHistoryModalUserName(u.userName);
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg transition-all"
                            title="Lihat Riwayat Sparks"
                          >
                            📜 Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal 1: Personal Appreciation ── */}
      {appreciationModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                    Beri Apresiasi Personal
                  </h3>
                  <p className="text-[11px] text-zinc-500">{appreciationModalUser.userName}</p>
                </div>
              </div>
              <button
                onClick={() => setAppreciationModalUser(null)}
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
                  placeholder="e.g. Apresiasi atas kontribusi luar biasa pada project X"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAppreciationModalUser(null)}
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

      {/* ── Modal 2: Reset Sparks ── */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔄</span>
                <div>
                  <h3 className="text-sm font-black text-red-600 dark:text-red-400">
                    Reset Sparks Pengguna
                  </h3>
                  <p className="text-[11px] text-zinc-500">{resetModalUser.userName}</p>
                </div>
              </div>
              <button onClick={() => setResetModalUser(null)} className="text-zinc-400 hover:text-zinc-700 text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-red-500/5 p-3 rounded-xl border border-red-500/10">
              Tindakan ini akan me-reset total saldo Sparks milik <strong>{resetModalUser.userName}</strong> (saat ini {resetModalUser.totalSparks} ✨) menjadi 0. <strong>Riwayat log historis tetap tersimpan 100%.</strong>
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
                  onClick={() => setResetModalUser(null)}
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

      {/* ── Modal 3: Restore Sparks (Category Selectable) ── */}
      {restoreModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">↩</span>
                <div>
                  <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    Kembalikan Sparks (Restore)
                  </h3>
                  <p className="text-[11px] text-zinc-500">{restoreModalUser.userName}</p>
                </div>
              </div>
              <button onClick={() => setRestoreModalUser(null)} className="text-zinc-400 hover:text-zinc-700 text-sm">
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
                  onClick={() => setRestoreModalUser(null)}
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

      {/* ── Sparks History Log Modal ── */}
      <SparksHistoryModal
        userId={historyModalUserId}
        userName={historyModalUserName}
        isOpen={!!historyModalUserId}
        onClose={() => setHistoryModalUserId(null)}
        period={period}
      />
    </div>
  );
}
