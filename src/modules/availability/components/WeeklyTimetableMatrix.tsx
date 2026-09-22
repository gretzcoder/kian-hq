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
            Peta jadwal kuliah seluruh personil untuk mempermudah alokasi waktu luang dan penugasan event.
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
                className={`rounded-3xl border flex flex-col min-h-[380px] p-3.5 transition-all ${
                  isWeekend
                    ? 'bg-zinc-50/40 dark:bg-zinc-900/30 border-zinc-200/50 dark:border-zinc-800/50'
                    : 'bg-white dark:bg-[#101014] border-zinc-200/80 dark:border-zinc-800/80'
                }`}
              >
                {/* Day Column Header */}
                <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
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

                {/* Day Schedule Cards */}
                <div className="pt-3 space-y-2.5 flex-1 overflow-y-auto">
                  {list.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-3">
                      <span className="text-xl opacity-40">✨</span>
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
                          className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-purple-500/20 hover:border-purple-500/50 transition-all space-y-1.5 shadow-xs"
                        >
                          {/* Time & User */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md">
                              ⏰ {item.startTime} - {item.endTime}
                            </span>
                            {item.semesterLabel && (
                              <span className="text-[8px] font-mono text-zinc-400 truncate max-w-[70px]">
                                {item.semesterLabel}
                              </span>
                            )}
                          </div>

                          {/* Course title */}
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                            {item.courseCode ? `[${item.courseCode}] ` : ''}{item.courseName || item.title}
                          </p>

                          {/* Student Info */}
                          {user && (
                            <div className="flex items-center gap-1.5 pt-1">
                              <UserAvatar src={user.avatarUrl} name={user.name} size="xs" square />
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                  {user.name}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Class, Campus, Lecturer details */}
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 space-y-0.5 pt-0.5 border-t border-zinc-200/50 dark:border-zinc-800/50">
                            {(item.classCode || item.campusName) && (
                              <p className="truncate">
                                🏛️ {item.classCode ? `${item.classCode} • ` : ''}{item.campusName || user?.university || '-'}
                              </p>
                            )}
                            {(item.lecturerName || item.lecturerCode) && (
                              <p className="truncate">
                                👨‍🏫 {item.lecturerName || item.lecturerCode}
                              </p>
                            )}
                            {item.room && (
                              <p className="truncate text-zinc-400">
                                📍 {item.room}
                              </p>
                            )}
                          </div>
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
    </div>
  );
}
