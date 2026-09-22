'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
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
}

export default function DateAvailabilityInspector({
  dateStr,
  dayName,
  counts,
  users,
  loading = false,
}: DateAvailabilityInspectorProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | AvailabilityStatusCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Format date in Indonesian: e.g. "Selasa, 22 September 2026"
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

  // Filtered users
  const filteredUsers = useMemo(() => {
    let result = users;

    if (activeTab !== 'ALL') {
      result = result.filter((u) => u.status === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((u) => {
        const nameMatch = u.user.name.toLowerCase().includes(q);
        const emailMatch = u.user.email.toLowerCase().includes(q);
        const uniMatch = (u.user.university || '').toLowerCase().includes(q);
        const roleMatch = (u.user.roleName || '').toLowerCase().includes(q);
        const nipMatch = (u.user.studentIdNumber || '').toLowerCase().includes(q);
        return nameMatch || emailMatch || uniMatch || roleMatch || nipMatch;
      });
    }

    return result;
  }, [users, activeTab, searchQuery]);

  // Copy avail users to clipboard for quick coordinator dispatch
  const handleCopyAvailList = () => {
    const availUsers = users.filter((u) => u.status === 'AVAIL');
    const text = `📋 DAFTAR TROOPER AVAIL (SIAP TUGAS)\nTanggal: ${formattedDate}\nTotal: ${availUsers.length} Orang\n\n` +
      availUsers.map((u, i) => `${i + 1}. ${u.user.name} (${u.user.university || 'Kian HQ'}${u.user.roleName ? ' - ' + u.user.roleName : ''})`).join('\n');

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
            Daftar ketersediaan seluruh troopers & staff untuk penugasan dan koordinasi kerja.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
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

      {/* Status Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'ALL'
              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 shadow-sm'
              : 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Personil
          </p>
          <p className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
            {counts.total}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AVAIL')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'AVAIL'
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
            {counts.avail}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BERKEGIATAN')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'BERKEGIATAN'
              ? 'bg-purple-500/15 border-purple-500/40 shadow-sm'
              : 'bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20 hover:border-purple-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
            🟣 Berkegiatan
          </p>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
            {counts.berkegiatan}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BERTUGAS')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'BERTUGAS'
              ? 'bg-blue-500/15 border-blue-500/40 shadow-sm'
              : 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/20 hover:border-blue-500/40'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
            🔵 Bertugas (Surat Tugas)
          </p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {counts.bertugas}
          </p>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {/* Quick Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Semua ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AVAIL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'AVAIL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            🟢 Avail ({counts.avail})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BERKEGIATAN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'BERKEGIATAN'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-700 dark:text-purple-400 hover:bg-purple-500/10'
            }`}
          >
            🟣 Berkegiatan ({counts.berkegiatan})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BERTUGAS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'BERTUGAS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-700 dark:text-blue-400 hover:bg-blue-500/10'
            }`}
          >
            🔵 Bertugas ({counts.bertugas})
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
            Tidak ada data user ditemukan
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : 'Semua filter kosong untuk kategori ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredUsers.map((item) => {
            const isAvail = item.status === 'AVAIL';
            const isBertugas = item.status === 'BERTUGAS';
            const isBerkegiatan = item.status === 'BERKEGIATAN';

            return (
              <div
                key={item.user.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                  isBertugas
                    ? 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30 dark:border-blue-500/30'
                    : isBerkegiatan
                    ? 'bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20 dark:border-purple-500/20'
                    : 'bg-emerald-500/5 dark:bg-emerald-950/10 border-emerald-500/20 dark:border-emerald-500/20'
                }`}
              >
                <div>
                  {/* Card Header: User Avatar & Info */}
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
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {item.user.name}
                          </h4>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
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
                          <span>AVAIL (KOSONG)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Schedule Details Breakdown */}
                  <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2.5">
                    {/* 1. If BERTUGAS (Surat Tugas) */}
                    {isBertugas && item.suratTugasList.map((duty, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-white dark:bg-zinc-900/80 border border-blue-500/30 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                            Surat Tugas Resmi
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 font-bold">
                            {duty.documentNumber}
                          </span>
                        </div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">
                          {duty.eventName}
                        </p>
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
                          <span>🎯 Tugas: <strong className="text-zinc-800 dark:text-zinc-200">{duty.dutyRole}</strong></span>
                          <span>⏰ {duty.eventTime}</span>
                          <span>📍 {duty.eventLocation}</span>
                        </div>
                      </div>
                    ))}

                    {/* 2. If KULIAH */}
                    {item.kuliahList.map((kuliah) => (
                      <div
                        key={kuliah.id}
                        className="p-3 rounded-2xl bg-white dark:bg-zinc-900/80 border border-purple-500/20 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                            Jadwal Kuliah
                          </span>
                          <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 font-mono">
                            ⏰ {kuliah.startTime} - {kuliah.endTime} WIB
                          </span>
                        </div>

                        {/* 1. Kode & Nama Matakuliah */}
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">
                          {kuliah.courseCode ? `[${kuliah.courseCode}] ` : ''}{kuliah.courseName || kuliah.title}
                        </p>

                        {/* 3. Kode Kelas & Kampus, 4. Dosen */}
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
                          {(kuliah.classCode || kuliah.campusName) && (
                            <p>
                              🏛️ Kelas: <strong className="text-zinc-800 dark:text-zinc-200">{kuliah.classCode || '-'}</strong> ({kuliah.campusName || item.user.university || '-'})
                            </p>
                          )}
                          {(kuliah.lecturerName || kuliah.lecturerCode) && (
                            <p>
                              👨‍🏫 Dosen: <strong className="text-zinc-800 dark:text-zinc-200">{kuliah.lecturerCode ? `[${kuliah.lecturerCode}] ` : ''}{kuliah.lecturerName}</strong>
                            </p>
                          )}
                          {kuliah.room && (
                            <p className="text-[10px] text-zinc-500">
                              📍 Ruangan: {kuliah.room}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* 3. If APPOINTMENT */}
                    {item.appointmentList.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-3 rounded-2xl bg-white dark:bg-zinc-900/80 border border-amber-500/20 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                            Agenda / Appointment
                          </span>
                          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono">
                            {appt.isAllDay ? 'Sepanjang Hari' : `⏰ ${appt.startTime} - ${appt.endTime}`}
                          </span>
                        </div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">
                          {appt.title}
                        </p>
                        {appt.location && (
                          <p className="text-[11px] text-zinc-500">📍 {appt.location}</p>
                        )}
                        {appt.notes && (
                          <p className="text-[10px] text-zinc-400 italic">{appt.notes}</p>
                        )}
                      </div>
                    ))}

                    {/* 4. If AVAIL */}
                    {isAvail && (
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
                        <span className="text-base">✨</span>
                        <span>Tidak ada agenda perkuliahan atau penugasan hari ini. Siap berkolaborasi & menerima tugas!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Quick Action */}
                {item.user.whatsappNumber && (
                  <div className="mt-3 pt-2 text-right">
                    <a
                      href={`https://wa.me/${item.user.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <span>💬 Hubungi via WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
