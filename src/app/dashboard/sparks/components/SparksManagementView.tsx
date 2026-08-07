'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
                          <Link
                            href={`/dashboard/profile?userId=${u.userId}`}
                            className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors flex items-center gap-1.5"
                            title="Kunjungi Profil Pengguna"
                          >
                            <span>{u.userName}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">↗</span>
                          </Link>
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
                            onClick={() => {
                              setHistoryModalUserId(u.userId);
                              setHistoryModalUserName(u.userName);
                            }}
                            className="px-3 py-1.5 text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Kelola & Lihat Riwayat Sparks Pengguna Ini"
                          >
                            <span>✨</span>
                            <span>Kelola & Log Sparks</span>
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

      {/* ── Sparks History & Management Modal (Single Source Design) ── */}
      <SparksHistoryModal
        userId={historyModalUserId}
        userName={historyModalUserName}
        isOpen={!!historyModalUserId}
        onClose={() => setHistoryModalUserId(null)}
        period={period}
        canManageSparks={true}
      />
    </div>
  );
}
