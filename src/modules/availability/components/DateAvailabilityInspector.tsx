'use client';

import { useState, useMemo, useEffect } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  AvailabilityStatusCategory,
  UserDateAvailabilityDetail,
} from '../availabilityTypes';

interface DateAvailabilityInspectorProps {
  dateStr: string;
  dayName: string;
  counts: {
    avail: number;
    berkegiatan: number;
    bertugas: number;
    total: number;
  };
  users: UserDateAvailabilityDetail[];
  loading?: boolean;
  isStaffOrManager?: boolean;
}

interface ExclusionSettings {
  excludedRoles: string[];
  excludedUserIds: string[];
}

const STORAGE_KEY_EXCLUSIONS = 'kian_availability_exclusions_v1';

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

  // Exclusion Settings State
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [exclusionSettings, setExclusionSettings] = useState<ExclusionSettings>({
    excludedRoles: [],
    excludedUserIds: [],
  });

  // Temp settings for modal editing
  const [tempExclusionSettings, setTempExclusionSettings] = useState<ExclusionSettings>({
    excludedRoles: [],
    excludedUserIds: [],
  });
  const [exclusionUserSearch, setExclusionUserSearch] = useState('');

  // Load exclusion settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXCLUSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.excludedRoles) || Array.isArray(parsed?.excludedUserIds)) {
          setExclusionSettings({
            excludedRoles: Array.isArray(parsed.excludedRoles) ? parsed.excludedRoles : [],
            excludedUserIds: Array.isArray(parsed.excludedUserIds) ? parsed.excludedUserIds : [],
          });
        }
      }
    } catch {
      // Ignore JSON parse error
    }
  }, []);

  // Save exclusion settings to localStorage
  const handleSaveExclusions = (newSettings: ExclusionSettings) => {
    setExclusionSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY_EXCLUSIONS, JSON.stringify(newSettings));
    } catch (err) {
      console.error('Failed to save exclusion settings:', err);
    }
    setShowExclusionModal(false);
  };

  const handleResetExclusions = () => {
    const emptySettings = { excludedRoles: [], excludedUserIds: [] };
    setExclusionSettings(emptySettings);
    setTempExclusionSettings(emptySettings);
    try {
      localStorage.removeItem(STORAGE_KEY_EXCLUSIONS);
    } catch {
      // Ignore
    }
  };

  const openExclusionModal = () => {
    if (!isStaffOrManager) return;
    setTempExclusionSettings({ ...exclusionSettings });
    setExclusionUserSearch('');
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

  // Extract all distinct roles present in the system
  const allDistinctRoles = useMemo(() => {
    const roleMap = new Map<string, number>();
    users.forEach((u) => {
      const rName = (u.user.roleName || 'Trooper').trim();
      roleMap.set(rName, (roleMap.get(rName) || 0) + 1);
    });
    return Array.from(roleMap.entries()).map(([name, count]) => ({
      name,
      count,
    })).sort((a, b) => b.count - a.count);
  }, [users]);

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
    let berkegiatan = 0;
    let bertugas = 0;

    nonExcludedUsers.forEach((u) => {
      if (u.status === 'AVAIL') avail++;
      else if (u.status === 'BERKEGIATAN') berkegiatan++;
      else if (u.status === 'BERTUGAS') bertugas++;
    });

    return {
      avail,
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
      result = result.filter((u) => u.status === activeStatusTab);
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
        const courseMatch = u.kuliahList.some(
          (c) =>
            (c.courseName || c.title).toLowerCase().includes(q) ||
            (c.courseCode || '').toLowerCase().includes(q)
        );
        const dutyMatch = u.suratTugasList.some(
          (d) =>
            d.eventName.toLowerCase().includes(q) ||
            d.dutyRole.toLowerCase().includes(q) ||
            d.documentNumber.toLowerCase().includes(q)
        );
        return nameMatch || emailMatch || uniMatch || roleMatch || nipMatch || courseMatch || dutyMatch;
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

  // Copy user schedule detail
  const handleCopySingleUserSchedule = (item: UserDateAvailabilityDetail) => {
    let text = `👤 JADWAL & STATUS: ${item.user.name} (${item.user.roleName || 'Trooper'})\n`;
    text += `📅 Tanggal: ${formattedDate}\n`;
    text += `📌 Status: ${item.status}\n`;
    text += `🏛️ Kampus: ${item.user.university || '-'}\n\n`;

    if (item.suratTugasList.length > 0) {
      text += `📜 PENUGASAN (SURAT TUGAS):\n`;
      item.suratTugasList.forEach((d, i) => {
        text += `${i + 1}. [${d.documentNumber}] ${d.eventName}\n   Tugas: ${d.dutyRole}\n   Waktu: ${d.eventTime}\n   Lokasi: ${d.eventLocation}\n`;
      });
      text += '\n';
    }

    if (item.kuliahList.length > 0) {
      text += `📚 JADWAL KULIAH:\n`;
      item.kuliahList.forEach((k, i) => {
        text += `${i + 1}. ${k.courseCode ? `[${k.courseCode}] ` : ''}${k.courseName || k.title}\n   Waktu: ${k.startTime} - ${k.endTime} WIB\n   Dosen: ${k.lecturerName || '-'}\n   Ruang: ${k.room || '-'}\n`;
      });
      text += '\n';
    }

    if (item.appointmentList.length > 0) {
      text += `📌 AGENDA / APPOINTMENT:\n`;
      item.appointmentList.forEach((a, i) => {
        text += `${i + 1}. ${a.title} (${a.startTime} - ${a.endTime})\n   Lokasi: ${a.location || '-'}\n`;
      });
      text += '\n';
    }

    if (item.status === 'AVAIL') {
      text += `✨ Bebas jadwal (Siap Ditugaskan)\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopyDetailSuccess(true);
      setTimeout(() => setCopyDetailSuccess(false), 2500);
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
            Daftar ketersediaan seluruh troopers & staff untuk penugasan dan koordinasi kerja.
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
                onClick={handleResetExclusions}
                className="text-[11px] font-bold text-amber-800 dark:text-amber-200 hover:text-amber-950 dark:hover:text-white"
              >
                Tampilkan Semua
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveStatusTab('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'ALL'
              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 shadow-sm'
              : 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Personil
          </p>
          <p className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
            {activeCounts.total}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('AVAIL')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'AVAIL'
              ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm'
              : 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              🟢 Avail (Kosong)
            </p>
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {activeCounts.avail}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('BERKEGIATAN')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'BERKEGIATAN'
              ? 'bg-purple-500/15 border-purple-500/40 shadow-sm'
              : 'bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20 hover:border-purple-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
            🟣 Berkegiatan
          </p>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
            {activeCounts.berkegiatan}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStatusTab('BERTUGAS')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeStatusTab === 'BERTUGAS'
              ? 'bg-blue-500/15 border-blue-500/40 shadow-sm'
              : 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/20 hover:border-blue-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
            🔵 Bertugas (Surat Tugas)
          </p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {activeCounts.bertugas}
          </p>
        </button>
      </div>

      {/* Role Category Tabs Filter */}
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'AVAIL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              🟢 Avail ({activeCounts.avail})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab('BERKEGIATAN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'BERKEGIATAN'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-purple-700 dark:text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              🟣 Berkegiatan ({activeCounts.berkegiatan})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatusTab('BERTUGAS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeStatusTab === 'BERTUGAS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-500/10'
              }`}
            >
              🔵 Bertugas ({activeCounts.bertugas})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, kampus, role..."
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

      {/* User Cards Grid (Compact, Clean, Non-Spammy) */}
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
            const isBerkegiatan = item.status === 'BERKEGIATAN';

            const hasKuliah = item.kuliahList.length > 0;
            const hasAppt = item.appointmentList.length > 0;

            // Generate clean activity summary text
            let activitySummaryLabel = '';
            if (isBertugas) {
              const duty = item.suratTugasList[0];
              activitySummaryLabel = `📜 Surat Tugas: ${duty?.eventName || 'Penugasan Resmi'}`;
            } else if (isBerkegiatan) {
              if (hasKuliah && hasAppt) {
                activitySummaryLabel = `📚 Perkuliahan (${item.kuliahList.length} MK) & 📌 Agenda (${item.appointmentList.length})`;
              } else if (hasKuliah) {
                activitySummaryLabel = `📚 Perkuliahan (${item.kuliahList.length} Matakuliah)`;
              } else if (hasAppt) {
                activitySummaryLabel = `📌 Agenda / Janji Temu (${item.appointmentList.length})`;
              }
            } else {
              activitySummaryLabel = '✨ Bebas Perkuliahan & Tugas';
            }

            return (
              <div
                key={item.user.id}
                onClick={() => setSelectedUserDetail(item)}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between group hover:shadow-md hover:scale-[1.008] ${
                  isBertugas
                    ? 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30 hover:border-blue-500/70 hover:bg-blue-500/10'
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

                  {/* Compact Activity Summary Pill (Clean & Non-Spammy) */}
                  <div className="mt-3.5 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5">
                    {/* Primary Activity Pill */}
                    <div
                      className={`px-3 py-2 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold ${
                        isBertugas
                          ? 'bg-white dark:bg-zinc-900/90 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                          : isBerkegiatan
                          ? 'bg-white dark:bg-zinc-900/90 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      <span className="truncate">{activitySummaryLabel}</span>
                      
                      {/* Secondary quick info tag */}
                      {isBertugas && item.suratTugasList[0] && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 font-bold">
                          {item.suratTugasList[0].dutyRole}
                        </span>
                      )}
                      {isBerkegiatan && hasKuliah && item.kuliahList[0] && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 font-bold">
                          ⏰ {item.kuliahList[0].startTime} WIB
                        </span>
                      )}
                      {isAvail && (
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 shrink-0">
                          SIAP TUGAS
                        </span>
                      )}
                    </div>

                    {/* Sub-tag if user is BERTUGAS but also has classes */}
                    {isBertugas && hasKuliah && (
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1 font-medium">
                        + Ada {item.kuliahList.length} jadwal perkuliahan pada hari ini.
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer: WhatsApp quick link & Modal Trigger CTA */}
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
      {/* DETAILED SCHEDULE INSPECTOR MODAL (Full details when card is clicked) */}
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

              {/* 1. SECTION: SURAT TUGAS (If Any) */}
              {selectedUserDetail.suratTugasList.length > 0 && (
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
                          <p>
                            🎯 Peran Tugas: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{duty.dutyRole}</strong>
                          </p>
                          <p>⏰ Waktu: {duty.eventTime}</p>
                          <p>📍 Lokasi: {duty.eventLocation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. SECTION: JADWAL KULIAH (If Any) */}
              {selectedUserDetail.kuliahList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Jadwal Perkuliahan Hari Ini ({selectedUserDetail.kuliahList.length} Matakuliah)
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {selectedUserDetail.kuliahList.map((kuliah) => (
                      <div
                        key={kuliah.id}
                        className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                            Perkuliahan
                          </span>
                          <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                            ⏰ {kuliah.startTime} - {kuliah.endTime} WIB
                          </span>
                        </div>

                        {/* Kode & Nama MK */}
                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {kuliah.courseCode ? `[${kuliah.courseCode}] ` : ''}{kuliah.courseName || kuliah.title}
                        </h5>

                        {/* Detail Kelas, Kampus, Dosen, Ruang */}
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
                            <p>📍 Ruangan: <strong className="text-zinc-800 dark:text-zinc-200">{kuliah.room}</strong></p>
                          )}
                          {kuliah.notes && (
                            <p className="italic text-zinc-400">📝 {kuliah.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. SECTION: AGENDA / APPOINTMENT (If Any) */}
              {selectedUserDetail.appointmentList.length > 0 && (
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
                            Agenda
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                            {appt.isAllDay ? 'Sepanjang Hari' : `⏰ ${appt.startTime} - ${appt.endTime} WIB`}
                          </span>
                        </div>

                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {appt.title}
                        </h5>

                        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 pt-1 border-t border-amber-500/15">
                          {appt.location && <p>📍 Lokasi: {appt.location}</p>}
                          {appt.notes && <p className="italic text-zinc-400">📝 Catatan: {appt.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. SECTION: AVAIL (No active tasks) */}
              {selectedUserDetail.status === 'AVAIL' && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <span className="text-3xl">✨</span>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    Bebas Jadwal Kuliah & Penugasan
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
                    Anggota ini tidak memiliki agenda perkuliahan maupun penugasan resmi pada {formattedDate}. Siap dialokasikan untuk penugasan baru.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2">
                {selectedUserDetail.user.whatsappNumber ? (
                  <a
                    href={`https://wa.me/${selectedUserDetail.user.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 transition-all"
                  >
                    <span>💬 Hubungi via WhatsApp</span>
                  </a>
                ) : (
                  <span className="text-[11px] text-zinc-400 font-medium">
                    No WhatsApp belum disetel
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleCopySingleUserSchedule(selectedUserDetail)}
                  className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 transition-colors"
                >
                  {copyDetailSuccess ? '✅ Tersalin' : '📋 Salin Info'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="px-5 py-2 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXCLUSION SETTINGS MODAL (Admin & Koordinator Setting Pengecualian) */}
      {/* ========================================================================= */}
      {showExclusionModal && isStaffOrManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Pengaturan Koordinator
                  </span>
                </div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                  Pengaturan Pengecualian Personil & Role
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Kecualikan role tertentu (misal Executive/Koordinator) atau user tertentu agar tidak muncul di daftar tugas harian.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowExclusionModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 1. Pengecualian Berdasarkan Role */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>1. Pengecualian Berdasarkan Role</span>
                  </h4>
                  <span className="text-[10px] text-zinc-400">
                    Centang role yang ingin <strong>disembunyikan</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {allDistinctRoles.map((r) => {
                    const isChecked = tempExclusionSettings.excludedRoles.some(
                      (role) => role.toLowerCase() === r.name.toLowerCase()
                    );

                    return (
                      <label
                        key={r.name}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-950 dark:text-amber-200'
                            : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTempExclusionSettings({
                                  ...tempExclusionSettings,
                                  excludedRoles: [...tempExclusionSettings.excludedRoles, r.name],
                                });
                              } else {
                                setTempExclusionSettings({
                                  ...tempExclusionSettings,
                                  excludedRoles: tempExclusionSettings.excludedRoles.filter(
                                    (role) => role.toLowerCase() !== r.name.toLowerCase()
                                  ),
                                });
                              }
                            }}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-xs font-bold">
                            {r.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {r.count} Orang
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. Pengecualian User Spesifik */}
              <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>👤</span>
                    <span>2. Pengecualian Personil Spesifik</span>
                  </h4>
                  <span className="text-[10px] text-zinc-400">
                    {tempExclusionSettings.excludedUserIds.length} personil terpilih
                  </span>
                </div>

                {/* Quick Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={exclusionUserSearch}
                    onChange={(e) => setExclusionUserSearch(e.target.value)}
                    placeholder="Cari nama personil untuk dikecualikan..."
                    className="w-full pl-8 pr-3 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400">🔍</span>
                </div>

                {/* User selection list */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {users
                    .filter((u) => {
                      if (!exclusionUserSearch.trim()) return true;
                      const q = exclusionUserSearch.toLowerCase();
                      return (
                        u.user.name.toLowerCase().includes(q) ||
                        (u.user.roleName || '').toLowerCase().includes(q)
                      );
                    })
                    .map((u) => {
                      const isUserExcluded = tempExclusionSettings.excludedUserIds.includes(u.user.id);
                      const isRoleExcluded = tempExclusionSettings.excludedRoles.some(
                        (r) => r.toLowerCase() === (u.user.roleName || 'Trooper').toLowerCase()
                      );

                      return (
                        <label
                          key={u.user.id}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                            isUserExcluded
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isUserExcluded}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTempExclusionSettings({
                                    ...tempExclusionSettings,
                                    excludedUserIds: [
                                      ...tempExclusionSettings.excludedUserIds,
                                      u.user.id,
                                    ],
                                  });
                                } else {
                                  setTempExclusionSettings({
                                    ...tempExclusionSettings,
                                    excludedUserIds: tempExclusionSettings.excludedUserIds.filter(
                                      (id) => id !== u.user.id
                                    ),
                                  });
                                }
                              }}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 shrink-0"
                            />
                            <UserAvatar src={u.user.avatarUrl} name={u.user.name} size="xs" square />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {u.user.name}
                              </p>
                              <p className="text-[10px] text-zinc-500 truncate">
                                {u.user.roleName || 'Trooper'} • {u.user.university || 'Kian HQ'}
                              </p>
                            </div>
                          </div>

                          {isRoleExcluded && (
                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                              Otomatis (Role)
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              <button
                type="button"
                onClick={() => {
                  setTempExclusionSettings({ excludedRoles: [], excludedUserIds: [] });
                }}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
              >
                Kosongkan Semua Pengecualian
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExclusionModal(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveExclusions(tempExclusionSettings)}
                  className="px-5 py-2 rounded-2xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-all active:scale-95"
                >
                  Terapkan & Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
