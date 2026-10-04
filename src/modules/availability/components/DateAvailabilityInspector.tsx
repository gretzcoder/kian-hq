'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  AvailabilityStatusCategory,
  UserDateAvailabilityDetail,
} from '../availabilityTypes';
import { useAvailabilityExclusions } from '../useAvailabilityExclusions';
import ExclusionSettingsModal from './ExclusionSettingsModal';

interface DateAvailabilityInspectorProps {
  dateStr: string;
  dayName: string;
  counts: {
    avail: number;
    kuliah: number;
    kuliahOnline: number;
    kerja: number;
    berkegiatan: number;
    bertugas: number;
    total: number;
  };
  users: UserDateAvailabilityDetail[];
  loading?: boolean;
  isStaffOrManager?: boolean;
}

export default function DateAvailabilityInspector({
  dateStr,
  dayName,
  counts,
  users,
  loading = false,
  isStaffOrManager = false,
}: DateAvailabilityInspectorProps) {
  // Main status filter
  const [activeStatusTab, setActiveStatusTab] = useState<'ALL' | AvailabilityStatusCategory>('ALL');
  
  // Role category filter
  const [selectedRoleCategory, setSelectedRoleCategory] = useState<string>('ALL');
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Copy success indicator
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyDetailSuccess, setCopyDetailSuccess] = useState(false);

  // Selected user for modal detail inspector
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDateAvailabilityDetail | null>(null);

  // Centralized Exclusion Hook
  const {
    exclusionSettings,
    saveExclusions,
    resetExclusions,
    filterUsers,
    hasActiveExclusions,
  } = useAvailabilityExclusions();
  const [showExclusionModal, setShowExclusionModal] = useState(false);

  const openExclusionModal = () => {
    if (!isStaffOrManager) return;
    setShowExclusionModal(true);
  };

  // Format date in Indonesian: e.g. "Kamis, 24 September 2026"
  const formattedDate = useMemo(() => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dateObj);
    } catch {
      return dateStr;
    }
  }, [dateStr]);

  // Apply exclusion filter first (for counting and display)
  const nonExcludedUsers = useMemo(() => {
    const { excludedRoles, excludedUserIds } = exclusionSettings;
    const excludedRoleSet = new Set(excludedRoles.map((r) => r.toLowerCase()));
    const excludedUserSet = new Set(excludedUserIds);

    return users.filter((u) => {
      if (excludedUserSet.has(u.user.id)) return false;
      const role = (u.user.roleName || 'Trooper').toLowerCase().trim();
      if (excludedRoleSet.has(role)) return false;
      return true;
    });
  }, [users, exclusionSettings]);

  // Total excluded count
  const excludedCount = users.length - nonExcludedUsers.length;

  // Dynamically recalculated counts based on active (non-excluded) users
  const activeCounts = useMemo(() => {
    let avail = 0;
    let kuliah = 0;
    let kuliahOnline = 0;
    let kerja = 0;
    let berkegiatan = 0;
    let bertugas = 0;

    nonExcludedUsers.forEach((u) => {
      if (u.status === 'AVAIL') avail++;
      else if (u.status === 'KULIAH') kuliah++;
      else if (u.status === 'KULIAH_ONLINE') kuliahOnline++;
      else if (u.status === 'KERJA') kerja++;
      else if (u.status === 'BERTUGAS') bertugas++;
      else berkegiatan++;
    });

    return {
      avail,
      kuliah,
      kuliahOnline,
      kerja,
      berkegiatan,
      bertugas,
      total: nonExcludedUsers.length,
    };
  }, [nonExcludedUsers]);

  // Active role categories in non-excluded users
  const activeRoleCategories = useMemo(() => {
    const roleMap = new Map<string, number>();
    nonExcludedUsers.forEach((u) => {
      const rName = (u.user.roleName || 'Trooper').trim();
      roleMap.set(rName, (roleMap.get(rName) || 0) + 1);
    });
    return Array.from(roleMap.entries()).map(([name, count]) => ({
      name,
      count,
    })).sort((a, b) => b.count - a.count);
  }, [nonExcludedUsers]);

  // Filtered users for final display
  const filteredUsers = useMemo(() => {
    let result = nonExcludedUsers;

    // Filter by Status Tab
    if (activeStatusTab !== 'ALL') {
      if (activeStatusTab === 'AVAIL') {
        result = result.filter((u) => u.status === 'AVAIL');
      } else if (activeStatusTab === 'KULIAH') {
        result = result.filter((u) => u.status === 'KULIAH' || u.kuliahList.some(k => k.deliveryMode !== 'ONLINE'));
      } else if (activeStatusTab === 'KULIAH_ONLINE') {
        result = result.filter((u) => u.status === 'KULIAH_ONLINE' || u.kuliahList.some(k => k.deliveryMode === 'ONLINE'));
      } else if (activeStatusTab === 'KERJA') {
        result = result.filter((u) => u.status === 'KERJA' || (u.kerjaList && u.kerjaList.length > 0));
      } else if (activeStatusTab === 'BERTUGAS') {
        result = result.filter((u) => u.status === 'BERTUGAS');
      } else if (activeStatusTab === 'BERKEGIATAN') {
        result = result.filter((u) => u.status === 'BERKEGIATAN' || u.status === 'KULIAH' || u.status === 'KULIAH_ONLINE' || u.status === 'KERJA');
      }
    }

    // Filter by Role Category
    if (selectedRoleCategory !== 'ALL') {
      result = result.filter(
        (u) => (u.user.roleName || 'Trooper').toLowerCase() === selectedRoleCategory.toLowerCase()
      );
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((u) => {
        const nameMatch = u.user.name.toLowerCase().includes(q);
        const emailMatch = u.user.email.toLowerCase().includes(q);
        const uniMatch = (u.user.university || '').toLowerCase().includes(q);
        const roleMatch = (u.user.roleName || '').toLowerCase().includes(q);
        const nipMatch = (u.user.studentIdNumber || '').toLowerCase().includes(q);
        const courseMatch = (u.kuliahList || []).some(
          (c) =>
            (c.courseName || c.title).toLowerCase().includes(q) ||
            (c.courseCode || '').toLowerCase().includes(q)
        );
        const kerjaMatch = (u.kerjaList || []).some(
          (k) =>
            (k.title || '').toLowerCase().includes(q) ||
            (k.campusName || '').toLowerCase().includes(q) ||
            (k.courseName || '').toLowerCase().includes(q)
        );
        const dutyMatch = (u.suratTugasList || []).some(
          (d) =>
            d.eventName.toLowerCase().includes(q) ||
            d.dutyRole.toLowerCase().includes(q) ||
            d.documentNumber.toLowerCase().includes(q)
        );
        return nameMatch || emailMatch || uniMatch || roleMatch || nipMatch || courseMatch || kerjaMatch || dutyMatch;
      });
    }

    return result;
  }, [nonExcludedUsers, activeStatusTab, selectedRoleCategory, searchQuery]);

  // Copy avail users to clipboard for quick coordinator dispatch
  const handleCopyAvailList = () => {
    const availUsers = nonExcludedUsers.filter((u) => u.status === 'AVAIL');
    const text =
      `📋 DAFTAR TROOPER AVAIL (SIAP TUGAS)\nTanggal: ${formattedDate}\nTotal: ${availUsers.length} Orang\n\n` +
      availUsers
        .map(
          (u, i) =>
            `${i + 1}. ${u.user.name} (${u.user.university || 'Kian HQ'}${
              u.user.roleName ? ' - ' + u.user.roleName : ''
            })`
        )
        .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  return (
    <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Rincian Ketersediaan Harian
            </span>
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
              • {dayName}
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mt-1">
            {formattedDate}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Daftar ketersediaan seluruh troopers & staff untuk penugasan, perkuliahan tatap muka/online, dan jadwal kerja.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Exclusion Settings Button (Admin & Koordinator only) */}
          {isStaffOrManager && (
            <button
              type="button"
              onClick={openExclusionModal}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold border flex items-center gap-1.5 transition-all active:scale-95 ${
                excludedCount > 0
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 ring-1 ring-amber-500/20'
                  : 'bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
              }`}
              title="Atur role atau personil yang dikecualikan dari list ini"
            >
              <span>⚙️</span>
              <span>Setting Pengecualian</span>
              {excludedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-black">
                  {excludedCount} Dikecualikan
                </span>
              )}
            </button>
          )}

          {/* Ajukan Dispensasi Kuliah (Koordinator & Admin) */}
          {isStaffOrManager && (
            <Link
              href={`/dashboard/documents/create?fromEventDays=${encodeURIComponent(formattedDate)}&specificDate=${dateStr}`}
              className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
              title="Buat Surat Dispensasi Perkuliahan untuk personil pada tanggal ini"
            >
              <span>🎓</span>
              <span>Ajukan Dispensasi Kuliah</span>
            </Link>
          )}

          {/* Copy Avail List */}
          <button
            type="button"
            onClick={handleCopyAvailList}
            className="px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
            title="Salin list personil yang kosong untuk penugasan"
          >
            <span>{copySuccess ? '✅' : '📋'}</span>
            <span>{copySuccess ? 'Tersalin ke Clipboard!' : 'Salin List Avail'}</span>
          </button>
        </div>
      </div>

      {/* Exclusion Banner Warning (If any role/user is excluded) */}
      {excludedCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <div>
              <span className="font-bold">Pengaturan Pengecualian Aktif:</span>{' '}
              <span>
                <strong>{excludedCount} personil</strong> disembunyikan dari daftar & perhitungan ketersediaan
                {exclusionSettings.excludedRoles.length > 0 && (
                  <> (Role: <em>{exclusionSettings.excludedRoles.join(', ')}</em>)</>
                )}
                .
              </span>
            </div>
          </div>
          {isStaffOrManager && (
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={openExclusionModal}
                className="text-[11px] font-bold text-amber-800 dark:text-amber-200 underline hover:no-underline"
              >
                Ubah Setting
              </button>
              <span className="text-amber-400">•</span>
              <button
                type="button"
                onClick={resetExclusions}
                className="text-[11px] font-bold text-amber-800 dark:text-amber-200 hover:text-amber-950 dark:hover:text-white"
              >
                Tampilkan Semua
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Counters (6 Cards: Total, Avail, Kuliah Tatap Muka, Kuliah Online, Kerja, Bertugas) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveStatusTab('ALL')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'ALL'
              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 shadow-sm'
              : 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Personil
          </p>
          <p className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
            {activeCounts.total}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('AVAIL')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'AVAIL'
              ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm'
              : 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20 hover:border-emerald-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            🟢 Avail (Kosong)
          </p>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {activeCounts.avail}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('KULIAH')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'KULIAH'
              ? 'bg-purple-500/15 border-purple-500/40 shadow-sm'
              : 'bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20 hover:border-purple-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
            🟣 Kuliah (Offline)
          </p>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
            {activeCounts.kuliah}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('KULIAH_ONLINE')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'KULIAH_ONLINE'
              ? 'bg-cyan-500/15 border-cyan-500/40 shadow-sm'
              : 'bg-cyan-500/5 dark:bg-cyan-950/20 border-cyan-500/20 hover:border-cyan-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
            💻 Kuliah Online
          </p>
          <p className="text-lg font-black text-cyan-600 dark:text-cyan-400 mt-0.5">
            {activeCounts.kuliahOnline}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('KERJA')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'KERJA'
              ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
              : 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/20 hover:border-amber-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
            💼 Kerja / Shift
          </p>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {activeCounts.kerja}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('BERTUGAS')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'BERTUGAS'
              ? 'bg-blue-500/15 border-blue-500/40 shadow-sm'
              : 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/20 hover:border-blue-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
            🔵 Bertugas (Surat)
          </p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {activeCounts.bertugas}
          </p>
        </button>
      </div>

      {/* Role Category Tabs Filter & Status Filter Tabs */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 shrink-0">
            Kategori Role:
          </span>
          <button
            type="button"
            onClick={() => setSelectedRoleCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedRoleCategory === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Semua Role ({nonExcludedUsers.length})
          </button>
          {activeRoleCategories.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => setSelectedRoleCategory(r.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedRoleCategory.toLowerCase() === r.name.toLowerCase()
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {r.name} ({r.count})
            </button>
          ))}
        </div>

        {/* Status Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Quick Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveStatusTab('ALL')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'ALL'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Semua ({nonExcludedUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab('AVAIL')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'AVAIL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              🟢 Avail ({activeCounts.avail})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab('KULIAH')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'KULIAH'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-purple-700 dark:text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              🟣 Kuliah Offline ({activeCounts.kuliah})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab('KULIAH_ONLINE')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'KULIAH_ONLINE'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10'
              }`}
            >
              💻 Online ({activeCounts.kuliahOnline})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab('KERJA')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'KERJA'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              💼 Kerja ({activeCounts.kerja})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab('BERTUGAS')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'BERTUGAS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-500/10'
              }`}
            >
              🔵 Tugas ({activeCounts.bertugas})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, kampus, kerja, role..."
              className="w-full pl-9 pr-4 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
            <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User Cards Grid */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400 font-bold">Memuat rincian ketersediaan anggota...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-3xl">👥</span>
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-2">
            Tidak ada data personil ditemukan
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {searchQuery
              ? `Tidak ada hasil untuk pencarian "${searchQuery}"`
              : selectedRoleCategory !== 'ALL'
              ? `Tidak ada anggota dengan role "${selectedRoleCategory}" pada filter status ini.`
              : 'Semua filter kosong untuk kategori ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredUsers.map((item) => {
            const isAvail = item.status === 'AVAIL';
            const isBertugas = item.status === 'BERTUGAS';
            const isKerja = item.status === 'KERJA';
            const isKuliahOnline = item.status === 'KULIAH_ONLINE';
            const isKuliahOffline = item.status === 'KULIAH';
            const isBerkegiatan = item.status === 'BERKEGIATAN';

            const hasKuliah = item.kuliahList && item.kuliahList.length > 0;
            const hasKerja = item.kerjaList && item.kerjaList.length > 0;
            const hasAppt = item.appointmentList && item.appointmentList.length > 0;

            // Generate clean activity summary text
            let activitySummaryLabel = '';
            if (isBertugas) {
              const duty = item.suratTugasList[0];
              activitySummaryLabel = `📜 Surat Tugas: ${duty?.eventName || 'Penugasan Resmi'}`;
            } else if (isKerja) {
              const kerja = item.kerjaList[0];
              activitySummaryLabel = `💼 Kerja: ${kerja?.title || 'Jadwal Kerja'} (${kerja?.startTime} - ${kerja?.endTime})`;
            } else if (isKuliahOnline) {
              const kuliah = item.kuliahList[0];
              activitySummaryLabel = `💻 Kuliah Online: ${kuliah?.courseName || kuliah?.title} (${kuliah?.startTime} - ${kuliah?.endTime})`;
            } else if (isKuliahOffline) {
              const kuliah = item.kuliahList[0];
              activitySummaryLabel = `🏛️ Tatap Muka: ${kuliah?.courseName || kuliah?.title} (${kuliah?.startTime} - ${kuliah?.endTime})`;
            } else if (isBerkegiatan && hasAppt) {
              const appt = item.appointmentList[0];
              activitySummaryLabel = `📌 Agenda: ${appt?.title} (${appt?.startTime} - ${appt?.endTime})`;
            } else {
              activitySummaryLabel = '✨ Bebas Perkuliahan, Kerja & Tugas';
            }

            return (
              <div
                key={item.user.id}
                onClick={() => setSelectedUserDetail(item)}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between group hover:shadow-md hover:scale-[1.008] ${
                  isBertugas
                    ? 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30 hover:border-blue-500/70 hover:bg-blue-500/10'
                    : isKerja
                    ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/30 hover:border-amber-500/70 hover:bg-amber-500/10'
                    : isKuliahOnline
                    ? 'bg-cyan-500/5 dark:bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/70 hover:bg-cyan-500/10'
                    : isKuliahOffline
                    ? 'bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20 hover:border-purple-500/60 hover:bg-purple-500/10'
                    : isBerkegiatan
                    ? 'bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20 hover:border-purple-500/60 hover:bg-purple-500/10'
                    : 'bg-emerald-500/5 dark:bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/60 hover:bg-emerald-500/10'
                }`}
                title="Klik untuk melihat rincian jadwal lengkap"
              >
                <div>
                  {/* Card Header: Avatar, Name, Role & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        src={item.user.avatarUrl}
                        name={item.user.name}
                        size="md"
                        square
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {item.user.name}
                          </h4>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                            {item.user.roleName || 'Trooper'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {item.user.university || 'Kian HQ'}
                          {item.user.studyProgram ? ` • ${item.user.studyProgram}` : ''}
                          {item.user.semester ? ` (${item.user.semester})` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isBertugas ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-xs flex items-center gap-1">
                          <span>🔵</span>
                          <span>BERTUGAS</span>
                        </span>
                      ) : isKerja ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-600 text-white shadow-xs flex items-center gap-1">
                          <span>💼</span>
                          <span>KERJA</span>
                        </span>
                      ) : isKuliahOnline ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-600 text-white shadow-xs flex items-center gap-1">
                          <span>💻</span>
                          <span>ONLINE</span>
                        </span>
                      ) : isKuliahOffline ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-xs flex items-center gap-1">
                          <span>🏛️</span>
                          <span>KULIAH</span>
                        </span>
                      ) : isBerkegiatan ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-xs flex items-center gap-1">
                          <span>🟣</span>
                          <span>BERKEGIATAN</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                          <span>🟢</span>
                          <span>AVAIL</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Activity Summary Pill */}
                  <div className="mt-3.5 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5">
                    <div
                      className={`px-3 py-2 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold ${
                        isBertugas
                          ? 'bg-white dark:bg-zinc-900/90 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                          : isKerja
                          ? 'bg-white dark:bg-zinc-900/90 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                          : isKuliahOnline
                          ? 'bg-white dark:bg-zinc-900/90 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30'
                          : isKuliahOffline || isBerkegiatan
                          ? 'bg-white dark:bg-zinc-900/90 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      <span className="truncate">{activitySummaryLabel}</span>
                      
                      {isBertugas && item.suratTugasList[0] && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 font-bold">
                          {item.suratTugasList[0].dutyRole}
                        </span>
                      )}
                      {isKerja && item.kerjaList[0] && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0 font-bold">
                          {item.kerjaList[0].deliveryMode || 'WFO'}
                        </span>
                      )}
                      {isKuliahOnline && item.kuliahList[0] && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 shrink-0 font-bold">
                          💻 Daring
                        </span>
                      )}
                      {isKuliahOffline && item.kuliahList[0] && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 font-bold">
                          🏛️ Tatap Muka
                        </span>
                      )}
                      {isAvail && (
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 shrink-0">
                          SIAP TUGAS
                        </span>
                      )}
                    </div>

                    {/* Additional Sub-tags for multi-commitment troopers */}
                    {isKerja && hasKuliah && (
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1 font-medium">
                        + Juga ada {item.kuliahList.length} jadwal kuliah ({item.kuliahList.some(k => k.deliveryMode === 'ONLINE') ? 'Ada Kuliah Online' : 'Tatap Muka'}).
                      </p>
                    )}
                    {isBertugas && (hasKuliah || hasKerja) && (
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1 font-medium">
                        + Ada jadwal {hasKuliah ? `${item.kuliahList.length} perkuliahan` : ''} {hasKerja ? ' & shift kerja' : ''} pada hari ini.
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-2.5 border-t border-zinc-200/40 dark:border-zinc-800/40 flex items-center justify-between text-xs">
                  {item.user.whatsappNumber ? (
                    <a
                      href={`https://wa.me/${item.user.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <span>💬 WhatsApp</span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {item.user.studentIdNumber ? `NIP/NIM: ${item.user.studentIdNumber}` : ''}
                    </span>
                  )}

                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Lihat Detail</span>
                    <span>➔</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED SCHEDULE INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={selectedUserDetail.user.avatarUrl}
                  name={selectedUserDetail.user.name}
                  size="md"
                  square
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                      {selectedUserDetail.user.name}
                    </h3>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                      {selectedUserDetail.user.roleName || 'Trooper'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {selectedUserDetail.user.university || 'Kian HQ'}
                    {selectedUserDetail.user.studyProgram ? ` • ${selectedUserDetail.user.studyProgram}` : ''}
                    {selectedUserDetail.user.semester ? ` (${selectedUserDetail.user.semester})` : ''}
                    {selectedUserDetail.user.studentIdNumber ? ` • NIM/NIP: ${selectedUserDetail.user.studentIdNumber}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Date & Overall Status Pill */}
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Ketersediaan Pada Tanggal
                  </span>
                  <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {formattedDate}
                  </p>
                </div>
                <div>
                  {selectedUserDetail.status === 'BERTUGAS' ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-blue-600 text-white shadow-xs flex items-center gap-1.5">
                      <span>🔵</span>
                      <span>BERTUGAS (SURAT TUGAS)</span>
                    </span>
                  ) : selectedUserDetail.status === 'KERJA' ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-600 text-white shadow-xs flex items-center gap-1.5">
                      <span>💼</span>
                      <span>SEDANG BEKERJA (KERJA)</span>
                    </span>
                  ) : selectedUserDetail.status === 'KULIAH_ONLINE' ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-cyan-600 text-white shadow-xs flex items-center gap-1.5">
                      <span>💻</span>
                      <span>KULIAH ONLINE (DARING)</span>
                    </span>
                  ) : selectedUserDetail.status === 'KULIAH' ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-600 text-white shadow-xs flex items-center gap-1.5">
                      <span>🏛️</span>
                      <span>KULIAH TATAP MUKA</span>
                    </span>
                  ) : selectedUserDetail.status === 'BERKEGIATAN' ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-600 text-white shadow-xs flex items-center gap-1.5">
                      <span>🟣</span>
                      <span>BERKEGIATAN</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-xs flex items-center gap-1.5">
                      <span>🟢</span>
                      <span>AVAIL (SIAP TUGAS)</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 1. SECTION: SURAT TUGAS */}
              {selectedUserDetail.suratTugasList && selectedUserDetail.suratTugasList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      Penugasan Resmi (Surat Tugas)
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {selectedUserDetail.suratTugasList.map((duty, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/30 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                            Surat Tugas Resmi
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 font-bold">
                            {duty.documentNumber}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {duty.eventName}
                        </h5>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 pt-1 border-t border-blue-500/15">
                          <p>🎯 Peran Tugas: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{duty.dutyRole}</strong></p>
                          <p>⏰ Waktu: {duty.eventTime}</p>
                          <p>📍 Lokasi: {duty.eventLocation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. SECTION: JADWAL KERJA */}
              {selectedUserDetail.kerjaList && selectedUserDetail.kerjaList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Jadwal Kerja / Pekerjaan ({selectedUserDetail.kerjaList.length} Jadwal)
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {selectedUserDetail.kerjaList.map((kerja) => (
                      <div
                        key={kerja.id}
                        className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md">
                            {kerja.deliveryMode === 'WFH' ? '🏠 WFH (Remote)' : kerja.deliveryMode === 'HYBRID' ? '🔄 Hybrid' : '🏢 WFO (Di Kantor)'}
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                            ⏰ {kerja.startTime} - {kerja.endTime} WIB
                          </span>
                        </div>

                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {kerja.title || kerja.courseName || 'Jadwal Kerja'}
                        </h5>

                        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 pt-1 border-t border-amber-500/15">
                          {kerja.campusName && (
                            <p>🏢 Tempat / Perusahaan: <strong className="text-zinc-800 dark:text-zinc-200">{kerja.campusName}</strong></p>
                          )}
                          {kerja.location && (
                            <p>📍 Lokasi: {kerja.location}</p>
                          )}
                          {kerja.notes && (
                            <p className="italic text-zinc-400">📝 {kerja.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. SECTION: JADWAL KULIAH */}
              {selectedUserDetail.kuliahList && selectedUserDetail.kuliahList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Jadwal Perkuliahan Hari Ini ({selectedUserDetail.kuliahList.length} Matakuliah)
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {selectedUserDetail.kuliahList.map((kuliah) => {
                      const isOnline = kuliah.deliveryMode === 'ONLINE';
                      const isHybrid = kuliah.deliveryMode === 'HYBRID';

                      return (
                        <div
                          key={kuliah.id}
                          className={`p-4 rounded-2xl border space-y-2 text-xs ${
                            isOnline
                              ? 'bg-cyan-500/5 dark:bg-cyan-950/20 border-cyan-500/25'
                              : 'bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              isOnline
                                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                : isHybrid
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}>
                              {isOnline ? '💻 Kuliah Online (Daring)' : isHybrid ? '🔄 Kuliah Hybrid' : '🏛️ Tatap Muka (Offline)'}
                            </span>
                            <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                              ⏰ {kuliah.startTime} - {kuliah.endTime} WIB
                            </span>
                          </div>

                          <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {kuliah.courseCode ? `[${kuliah.courseCode}] ` : ''}{kuliah.courseName || kuliah.title}
                          </h5>

                          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 pt-1 border-t border-purple-500/15">
                            {(kuliah.classCode || kuliah.campusName) && (
                              <p>
                                🏛️ Kelas: <strong className="text-zinc-800 dark:text-zinc-200">{kuliah.classCode || '-'}</strong> ({kuliah.campusName || selectedUserDetail.user.university || '-'})
                              </p>
                            )}
                            {(kuliah.lecturerName || kuliah.lecturerCode) && (
                              <p>
                                👨‍🏫 Dosen: <strong className="text-zinc-800 dark:text-zinc-200">{kuliah.lecturerCode ? `[${kuliah.lecturerCode}] ` : ''}{kuliah.lecturerName}</strong>
                              </p>
                            )}
                            {kuliah.room && (
                              <p>📍 Ruangan / Platform: <strong className="text-zinc-800 dark:text-zinc-200">{kuliah.room}</strong></p>
                            )}
                            {kuliah.notes && (
                              <p className="italic text-zinc-400">📝 {kuliah.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. SECTION: AGENDA / APPOINTMENT */}
              {selectedUserDetail.appointmentList && selectedUserDetail.appointmentList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Agenda / Janji Temu Pribadi
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {selectedUserDetail.appointmentList.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                            Agenda Pribadi
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                            {appt.isAllDay ? 'Sepanjang Hari' : `⏰ ${appt.startTime} - ${appt.endTime} WIB`}
                          </span>
                        </div>

                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {appt.title}
                        </h5>

                        {appt.location && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">📍 Lokasi: {appt.location}</p>
                        )}
                        {appt.notes && (
                          <p className="text-xs text-zinc-400 italic">📝 {appt.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between">
              {selectedUserDetail.user.whatsappNumber ? (
                <a
                  href={`https://wa.me/${selectedUserDetail.user.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all"
                >
                  <span>💬</span>
                  <span>Hubungi via WhatsApp</span>
                </a>
              ) : (
                <span className="text-xs text-zinc-400 font-medium">Nomor WhatsApp belum diisi</span>
              )}

              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusion Settings Modal */}
      {showExclusionModal && (
        <ExclusionSettingsModal
          isOpen={showExclusionModal}
          onClose={() => setShowExclusionModal(false)}
          initialSettings={exclusionSettings}
          allUsers={users.map((u) => u.user)}
          distinctRoles={activeRoleCategories}
          onSave={saveExclusions}
          onReset={resetExclusions}
        />
      )}
    </div>
  );
}
