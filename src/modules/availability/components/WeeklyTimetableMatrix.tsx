'use client';

import { useState, useEffect, useMemo } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  DAY_OF_WEEK_NAMES,
  UserAvailabilityItem,
  UserProfileSnapshot,
} from '../availabilityTypes';
import { getWeeklyTimetableMatrixAction } from '../availabilityActions';

export default function WeeklyTimetableMatrix() {
  const [users, setUsers] = useState<UserProfileSnapshot[]>([]);
  const [schedules, setSchedules] = useState<UserAvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected schedule item for clean pop-up inspector
  const [selectedSchedule, setSelectedSchedule] = useState<{
    item: UserAvailabilityItem;
    user?: UserProfileSnapshot;
  } | null>(null);

  const loadMatrix = async () => {
    setLoading(true);
    try {
      const data = await getWeeklyTimetableMatrixAction();
      setUsers(data.users || []);
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error('Failed to load timetable matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    let result = schedules;

    if (selectedUserId !== 'ALL') {
      result = result.filter((s) => s.userId === selectedUserId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const titleMatch = (s.title || '').toLowerCase().includes(q);
        const codeMatch = (s.courseCode || '').toLowerCase().includes(q);
        const classMatch = (s.classCode || '').toLowerCase().includes(q);
        const lecturerMatch = (s.lecturerName || '').toLowerCase().includes(q);
        const campusMatch = (s.campusName || '').toLowerCase().includes(q);
        const user = users.find((u) => u.id === s.userId);
        const userNameMatch = user ? user.name.toLowerCase().includes(q) : false;
        return titleMatch || codeMatch || classMatch || lecturerMatch || campusMatch || userNameMatch;
      });
    }

    return result;
  }, [schedules, selectedUserId, searchQuery, users]);

  // Group schedules by day of week (1..7)
  const schedulesByDay = useMemo(() => {
    const map = new Map<number, UserAvailabilityItem[]>();
    for (let d = 1; d <= 7; d++) {
      map.set(d, []);
    }
    filteredSchedules.forEach((s) => {
      if (s.dayOfWeek && map.has(s.dayOfWeek)) {
        map.get(s.dayOfWeek)!.push(s);
      }
    });
    // Sort each day by start time
    map.forEach((list) => {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [filteredSchedules]);

  // User map lookup
  const userMap = useMemo(() => {
    const map = new Map<string, UserProfileSnapshot>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  return (
    <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Matriks Mingguan Perkuliahan
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1">
            Jadwal Kuliah Mingguan Tim (Senin - Minggu)
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Klik jadwal matakuliah manapun untuk melihat rincian lengkap dosen, kelas, kampus, dan ruangan.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {/* User Filter Dropdown */}
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            <option value="ALL">👥 Semua Personil ({users.length})</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.roleName || 'Trooper'})
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari matakuliah / dosen..."
              className="w-full pl-8 pr-3 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
            <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400">🔍</span>
          </div>
        </div>
      </div>

      {/* Timetable Grid (7 Days Columns) */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400 font-bold">Memuat matriks perkuliahan mingguan...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
            const dayMeta = DAY_OF_WEEK_NAMES[dayNum];
            const list = schedulesByDay.get(dayNum) || [];
            const isWeekend = dayNum >= 6;

            return (
              <div
                key={dayNum}
                className={`rounded-3xl border flex flex-col min-h-[380px] p-3 transition-all ${
                  isWeekend
                    ? 'bg-zinc-50/40 dark:bg-zinc-900/30 border-zinc-200/50 dark:border-zinc-800/50'
                    : 'bg-white dark:bg-[#101014] border-zinc-200/80 dark:border-zinc-800/80'
                }`}
              >
                {/* Day Column Header */}
                <div className="pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                      {dayMeta.name}
                    </h4>
                    <span className="text-[10px] text-zinc-400 font-semibold">
                      {list.length} Kelas
                    </span>
                  </div>
                  {list.length === 0 && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Bebas
                    </span>
                  )}
                </div>

                {/* Day Schedule Cards (Clean, Compact, Non-Spammy) */}
                <div className="pt-2.5 space-y-2 flex-1 overflow-y-auto">
                  {list.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-3">
                      <span className="text-xl opacity-30">✨</span>
                      <p className="text-[11px] text-zinc-400 mt-1 font-medium">
                        Tidak ada perkuliahan
                      </p>
                    </div>
                  ) : (
                    list.map((item) => {
                      const user = userMap.get(item.userId);

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedSchedule({ item, user })}
                          className="p-2.5 rounded-2xl bg-zinc-50 dark:bg-[#15151c] border border-purple-500/20 hover:border-purple-500/60 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-all cursor-pointer space-y-1.5 shadow-2xs group"
                          title="Klik untuk melihat rincian jadwal lengkap"
                        >
                          {/* Time badge */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md">
                              ⏰ {item.startTime} - {item.endTime}
                            </span>
                            <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              Lihat ➔
                            </span>
                          </div>

                          {/* Course title (clean line clamped) */}
                          <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {item.courseCode ? `[${item.courseCode}] ` : ''}{item.courseName || item.title}
                          </p>

                          {/* Student Info chip */}
                          {user && (
                            <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                              <UserAvatar src={user.avatarUrl} name={user.name} size="xs" square />
                              <p className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 truncate flex-1">
                                {user.name}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED SCHEDULE INSPECTOR POPUP (Non-spammy Modal) */}
      {/* ========================================================================= */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                {selectedSchedule.user && (
                  <UserAvatar
                    src={selectedSchedule.user.avatarUrl}
                    name={selectedSchedule.user.name}
                    size="md"
                    square
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-zinc-900 dark:text-white">
                      {selectedSchedule.user?.name || 'Jadwal Kuliah'}
                    </h3>
                    {selectedSchedule.user?.roleName && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                        {selectedSchedule.user.roleName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {selectedSchedule.user?.university || 'Kian HQ'}
                    {selectedSchedule.user?.studyProgram ? ` • ${selectedSchedule.user.studyProgram}` : ''}
                    {selectedSchedule.user?.semester ? ` (${selectedSchedule.user.semester})` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSchedule(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-md">
                    {selectedSchedule.item.dayOfWeek ? DAY_OF_WEEK_NAMES[selectedSchedule.item.dayOfWeek]?.name : 'Jadwal'}
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                    ⏰ {selectedSchedule.item.startTime} - {selectedSchedule.item.endTime} WIB
                  </span>
                </div>

                {/* 1. Kode & Nama Matakuliah */}
                <h4 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  {selectedSchedule.item.courseCode ? `[${selectedSchedule.item.courseCode}] ` : ''}
                  {selectedSchedule.item.courseName || selectedSchedule.item.title}
                </h4>

                {/* 3. Kelas & Kampus, 4. Dosen, Ruangan */}
                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  {(selectedSchedule.item.classCode || selectedSchedule.item.campusName) && (
                    <p className="flex items-center gap-1.5">
                      <span>🏛️</span>
                      <span>
                        Kelas: <strong className="text-zinc-800 dark:text-zinc-200">{selectedSchedule.item.classCode || '-'}</strong> ({selectedSchedule.item.campusName || selectedSchedule.user?.university || '-'})
                      </span>
                    </p>
                  )}
                  {(selectedSchedule.item.lecturerName || selectedSchedule.item.lecturerCode) && (
                    <p className="flex items-center gap-1.5">
                      <span>👨‍🏫</span>
                      <span>
                        Dosen: <strong className="text-zinc-800 dark:text-zinc-200">{selectedSchedule.item.lecturerCode ? `[${selectedSchedule.item.lecturerCode}] ` : ''}{selectedSchedule.item.lecturerName}</strong>
                      </span>
                    </p>
                  )}
                  {selectedSchedule.item.room && (
                    <p className="flex items-center gap-1.5">
                      <span>📍</span>
                      <span>Ruangan: <strong className="text-zinc-800 dark:text-zinc-200">{selectedSchedule.item.room}</strong></span>
                    </p>
                  )}
                  {selectedSchedule.item.semesterLabel && (
                    <p className="flex items-center gap-1.5 text-zinc-500">
                      <span>🎓</span>
                      <span>Periode: {selectedSchedule.item.semesterLabel}</span>
                    </p>
                  )}
                  {selectedSchedule.item.notes && (
                    <p className="flex items-center gap-1.5 text-zinc-400 italic pt-1">
                      <span>📝</span>
                      <span>{selectedSchedule.item.notes}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              {selectedSchedule.user?.whatsappNumber ? (
                <a
                  href={`https://wa.me/${selectedSchedule.user.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 transition-all"
                >
                  <span>💬 Hubungi via WhatsApp</span>
                </a>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedSchedule(null)}
                className="px-5 py-2 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
