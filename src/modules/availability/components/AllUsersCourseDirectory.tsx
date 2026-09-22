'use client';

import { useState, useEffect, useMemo } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  DAY_OF_WEEK_NAMES,
  UserAvailabilityItem,
  UserProfileSnapshot,
} from '../availabilityTypes';
import { getAllUsersCourseSchedulesAction } from '../availabilityActions';
import { useAvailabilityExclusions } from '../useAvailabilityExclusions';
import ExclusionSettingsModal from './ExclusionSettingsModal';

interface UserCourseGroup {
  user: UserProfileSnapshot;
  totalCourses: number;
  daysCount: number;
  daysActive: number[];
  latestSemester: string | null;
  courses: UserAvailabilityItem[];
}

interface AllUsersCourseDirectoryProps {
  isStaffOrManager?: boolean;
}

export default function AllUsersCourseDirectory({
  isStaffOrManager = false,
}: AllUsersCourseDirectoryProps) {
  const [userGroups, setUserGroups] = useState<UserCourseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'ALL'>('ALL');
  const [selectedRoleCategory, setSelectedRoleCategory] = useState<string>('ALL');

  // Selected user for modal schedule detail
  const [selectedUserGroup, setSelectedUserGroup] = useState<UserCourseGroup | null>(null);

  // Exclusion hook
  const {
    exclusionSettings,
    saveExclusions,
    resetExclusions,
    filterUsers,
    hasActiveExclusions,
  } = useAvailabilityExclusions();
  const [showExclusionModal, setShowExclusionModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllUsersCourseSchedulesAction();
      setUserGroups(data.usersWithCourses || []);
    } catch (err) {
      console.error('Failed to load courses directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // All distinct roles in system
  const allDistinctRoles = useMemo(() => {
    const roleMap = new Map<string, number>();
    userGroups.forEach((g) => {
      const rName = (g.user.roleName || 'Trooper').trim();
      roleMap.set(rName, (roleMap.get(rName) || 0) + 1);
    });
    return Array.from(roleMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [userGroups]);

  // Non-excluded user groups
  const nonExcludedGroups = useMemo(() => {
    return filterUsers(userGroups);
  }, [userGroups, filterUsers]);

  const excludedCount = userGroups.length - nonExcludedGroups.length;

  // Active role categories in non-excluded groups
  const activeRoleCategories = useMemo(() => {
    const roleMap = new Map<string, number>();
    nonExcludedGroups.forEach((g) => {
      const rName = (g.user.roleName || 'Trooper').trim();
      roleMap.set(rName, (roleMap.get(rName) || 0) + 1);
    });
    return Array.from(roleMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [nonExcludedGroups]);

  // Filter user groups
  const filteredGroups = useMemo(() => {
    let result = nonExcludedGroups;

    // Filter by Role Category
    if (selectedRoleCategory !== 'ALL') {
      result = result.filter(
        (g) => (g.user.roleName || 'Trooper').toLowerCase() === selectedRoleCategory.toLowerCase()
      );
    }

    // Filter by Day of Week
    if (selectedDayFilter !== 'ALL') {
      result = result.filter((g) => g.daysActive.includes(selectedDayFilter));
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((g) => {
        const nameMatch = g.user.name.toLowerCase().includes(q);
        const uniMatch = (g.user.university || '').toLowerCase().includes(q);
        const programMatch = (g.user.studyProgram || '').toLowerCase().includes(q);
        const roleMatch = (g.user.roleName || '').toLowerCase().includes(q);
        const courseMatch = g.courses.some(
          (c) =>
            (c.courseName || c.title).toLowerCase().includes(q) ||
            (c.courseCode || '').toLowerCase().includes(q) ||
            (c.lecturerName || '').toLowerCase().includes(q) ||
            (c.classCode || '').toLowerCase().includes(q)
        );
        return nameMatch || uniMatch || programMatch || roleMatch || courseMatch;
      });
    }

    return result;
  }, [nonExcludedGroups, selectedRoleCategory, selectedDayFilter, searchQuery]);

  // Total stats based on non-excluded users
  const totalCoursesInSystem = useMemo(() => {
    return nonExcludedGroups.reduce((acc, g) => acc + g.totalCourses, 0);
  }, [nonExcludedGroups]);

  const activeStudentsCount = useMemo(() => {
    return nonExcludedGroups.filter((g) => g.totalCourses > 0).length;
  }, [nonExcludedGroups]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Direktori Perkuliahan Seluruh User
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mt-1">
              Daftar Jadwal Kuliah Troopers & Tim
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Klik pada kartu jadwal user untuk melihat rincian lengkap seluruh matakuliah perkuliahan mereka.
            </p>
          </div>

          {/* Quick Counter Badges & Exclusion Settings */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isStaffOrManager && (
              <button
                type="button"
                onClick={() => setShowExclusionModal(true)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold border flex items-center gap-1.5 transition-all active:scale-95 ${
                  hasActiveExclusions
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 ring-1 ring-amber-500/20'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                }`}
                title="Atur role atau personil yang dikecualikan dari direktori"
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

            <div className="px-3.5 py-2 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 font-bold">
              <span>🎓 <strong>{activeStudentsCount}</strong> Mahasiswa Aktif</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-bold">
              <span>📚 <strong>{totalCoursesInSystem}</strong> Total Matakuliah</span>
            </div>
          </div>
        </div>

        {/* Exclusion Banner Warning */}
        {hasActiveExclusions && excludedCount > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <div>
                <span className="font-bold">Pengaturan Pengecualian Aktif:</span>{' '}
                <span>
                  <strong>{excludedCount} personil</strong> disembunyikan dari direktori perkuliahan
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
                  onClick={() => setShowExclusionModal(true)}
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
              Semua Role ({nonExcludedGroups.length})
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

          {/* Filters and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            {/* Day Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedDayFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedDayFilter === 'ALL'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Semua Hari
              </button>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDayFilter(d)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedDayFilter === d
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {DAY_OF_WEEK_NAMES[d].name}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari user, matakuliah, dosen, kampus..."
                className="w-full pl-9 pr-4 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
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

        {/* User Cards Directory */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-zinc-400 font-bold">Memuat direktori perkuliahan...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 bg-zinc-50/50 dark:bg-zinc-900/20">
            <span className="text-3xl">🎓</span>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-2">
              Tidak ada data jadwal perkuliahan yang cocok
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {searchQuery
                ? `Tidak ada hasil untuk pencarian "${searchQuery}"`
                : selectedRoleCategory !== 'ALL'
                ? `Tidak ada personil dengan role "${selectedRoleCategory}" pada filter ini.`
                : 'Belum ada anggota yang menginput jadwal kuliah.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredGroups.map((group) => {
              const hasCourses = group.totalCourses > 0;
              const activeDaysFormatted = group.daysActive
                .map((d) => DAY_OF_WEEK_NAMES[d]?.short)
                .join(', ');

              return (
                <div
                  key={group.user.id}
                  onClick={() => setSelectedUserGroup(group)}
                  className="p-5 rounded-3xl bg-zinc-50/70 dark:bg-[#121216] border border-zinc-200/80 dark:border-zinc-800/80 hover:border-purple-500/50 hover:bg-zinc-50 dark:hover:bg-[#15151a] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                >
                  <div>
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          src={group.user.avatarUrl}
                          name={group.user.name}
                          size="md"
                          square
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {group.user.name}
                            </h4>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                              {group.user.roleName || 'Trooper'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {group.user.university || 'Kian HQ'}
                            {group.user.studyProgram ? ` • ${group.user.studyProgram}` : ''}
                            {group.user.semester ? ` (${group.user.semester})` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Course Count Pill */}
                      <div className="shrink-0">
                        {hasCourses ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-xs">
                            {group.totalCourses} MK
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                            0 MK
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compact Schedule Summary */}
                    <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
                      {hasCourses ? (
                        <>
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>📅 Hari Kuliah:</span>
                            <strong className="text-zinc-800 dark:text-zinc-200 font-bold">
                              {activeDaysFormatted || '-'}
                            </strong>
                          </div>

                          {/* Preview 1st / 2nd course as compact chips */}
                          <div className="space-y-1 pt-1">
                            {group.courses.slice(0, 2).map((c) => (
                              <div
                                key={c.id}
                                className="p-2 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200/60 dark:border-zinc-800/60 text-[11px] flex items-center justify-between gap-2"
                              >
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                  {c.courseCode ? `[${c.courseCode}] ` : ''}{c.courseName || c.title}
                                </span>
                                <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 shrink-0 font-bold">
                                  {c.dayOfWeek ? DAY_OF_WEEK_NAMES[c.dayOfWeek]?.short : ''} {c.startTime}
                                </span>
                              </div>
                            ))}

                            {group.totalCourses > 2 && (
                              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold text-center pt-0.5">
                                +{group.totalCourses - 2} matakuliah lainnya...
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="py-2 text-center text-xs text-zinc-400 italic">
                          Belum ada jadwal kuliah yang diinput
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-zinc-400 font-medium truncate">
                      {group.latestSemester || 'Semester Aktif'}
                    </span>
                    <span className="text-xs font-black text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Lihat Lengkap</span>
                      <span>➔</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedUserGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={selectedUserGroup.user.avatarUrl}
                  name={selectedUserGroup.user.name}
                  size="md"
                  square
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                      {selectedUserGroup.user.name}
                    </h3>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                      {selectedUserGroup.user.roleName || 'Trooper'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {selectedUserGroup.user.university || 'Kian HQ'}
                    {selectedUserGroup.user.studyProgram ? ` • ${selectedUserGroup.user.studyProgram}` : ''}
                    {selectedUserGroup.user.semester ? ` (${selectedUserGroup.user.semester})` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserGroup(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="p-3.5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span>🎓</span>
                  <span className="font-bold text-purple-900 dark:text-purple-300">
                    {selectedUserGroup.latestSemester || 'Jadwal Kuliah Semester Aktif'}
                  </span>
                </div>
                <span className="font-black text-purple-600 dark:text-purple-400">
                  Total {selectedUserGroup.totalCourses} Matakuliah
                </span>
              </div>

              {selectedUserGroup.totalCourses === 0 ? (
                <div className="py-12 text-center text-zinc-400">
                  <span className="text-3xl">✨</span>
                  <p className="text-xs font-semibold mt-2">
                    User ini belum menginput jadwal perkuliahan.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                    const dayMeta = DAY_OF_WEEK_NAMES[dayNum];
                    const classesForDay = selectedUserGroup.courses.filter(
                      (c) => c.dayOfWeek === dayNum
                    );
                    if (classesForDay.length === 0) return null;

                    return (
                      <div key={dayNum} className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
                            {dayMeta.name} ({classesForDay.length} Kelas)
                          </h4>
                        </div>

                        <div className="space-y-2.5">
                          {classesForDay.map((kuliah) => (
                            <div
                              key={kuliah.id}
                              className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-purple-500/20 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                                  Perkuliahan
                                </span>
                                <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                                  ⏰ {kuliah.startTime} - {kuliah.endTime} WIB
                                </span>
                              </div>

                              <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                {kuliah.courseCode ? `[${kuliah.courseCode}] ` : ''}
                                {kuliah.courseName || kuliah.title}
                              </h5>

                              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                                {(kuliah.classCode || kuliah.campusName) && (
                                  <p>
                                    🏛️ Kelas:{' '}
                                    <strong className="text-zinc-800 dark:text-zinc-200">
                                      {kuliah.classCode || '-'}
                                    </strong>{' '}
                                    ({kuliah.campusName || selectedUserGroup.user.university || '-'})
                                  </p>
                                )}
                                {(kuliah.lecturerName || kuliah.lecturerCode) && (
                                  <p>
                                    👨‍🏫 Dosen:{' '}
                                    <strong className="text-zinc-800 dark:text-zinc-200">
                                      {kuliah.lecturerCode ? `[${kuliah.lecturerCode}] ` : ''}
                                      {kuliah.lecturerName}
                                    </strong>
                                  </p>
                                )}
                                {kuliah.room && (
                                  <p className="text-zinc-500">📍 Ruangan: {kuliah.room}</p>
                                )}
                                {kuliah.notes && (
                                  <p className="text-zinc-400 italic">📝 {kuliah.notes}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
              {selectedUserGroup.user.whatsappNumber ? (
                <a
                  href={`https://wa.me/${selectedUserGroup.user.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 transition-all"
                >
                  <span>💬 Hubungi via WhatsApp</span>
                </a>
              ) : (
                <span className="text-[11px] text-zinc-400 font-medium">
                  WhatsApp belum diisi di profil
                </span>
              )}

              <button
                type="button"
                onClick={() => setSelectedUserGroup(null)}
                className="px-5 py-2 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusion Settings Modal */}
      {isStaffOrManager && (
        <ExclusionSettingsModal
          isOpen={showExclusionModal}
          onClose={() => setShowExclusionModal(false)}
          initialSettings={exclusionSettings}
          onSave={(newSettings) => {
            saveExclusions(newSettings);
            setShowExclusionModal(false);
          }}
          onReset={resetExclusions}
          allUsers={userGroups.map((g) => g.user)}
          distinctRoles={allDistinctRoles}
        />
      )}
    </div>
  );
}
