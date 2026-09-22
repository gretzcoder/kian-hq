'use client';

import React, { useState, useEffect } from 'react';
import { DispensationAssigneeRow, DispensationCourseItem } from '../documentTypes';
import {
  searchTroopersAction,
  getUsersCourseSchedulesForDispensationAction,
} from '../documentActions';

interface DispensationTableInputProps {
  value: DispensationAssigneeRow[];
  onChange: (newValue: DispensationAssigneeRow[]) => void;
  eventDays?: string;
  specificDate?: string;
  annexThreshold?: number;
}

export const DispensationTableInput: React.FC<DispensationTableInputProps> = ({
  value = [],
  onChange,
  eventDays,
  specificDate,
  annexThreshold = 3,
}) => {
  const [rows, setRows] = useState<DispensationAssigneeRow[]>(value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);

  useEffect(() => {
    setRows(value);
  }, [value]);

  const updateParent = (updated: DispensationAssigneeRow[]) => {
    const numbered = updated.map((r, i) => ({ ...r, no: i + 1 }));
    setRows(numbered);
    onChange(numbered);
  };

  // Add a manual empty student row
  const handleAddManualStudent = () => {
    const newRow: DispensationAssigneeRow = {
      no: rows.length + 1,
      name: '',
      nim: '',
      studyProgram: 'Sistem Informasi',
      university: 'Universitas Bina Sarana Informatika (UBSI)',
      classCode: '17.4A.07',
      courses: [
        {
          id: `c_${Date.now()}`,
          courseName: '',
          startTime: '08:00',
          endTime: '10:30',
          room: '',
          classCode: '17.4A.07',
          selected: true,
        },
      ],
    };
    updateParent([...rows, newRow]);
  };

  const handleRemoveStudent = (index: number) => {
    const updated = rows.filter((_, i) => i !== index);
    updateParent(updated);
  };

  const handleMoveStudent = (index: number, direction: 'UP' | 'DOWN') => {
    if (
      (direction === 'UP' && index === 0) ||
      (direction === 'DOWN' && index === rows.length - 1)
    )
      return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...rows];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateParent(updated);
  };

  const handleStudentFieldChange = (
    index: number,
    field: keyof DispensationAssigneeRow,
    val: any
  ) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    updateParent(updated);
  };

  // Course management within a student
  const handleToggleCourseSelected = (studentIndex: number, courseIndex: number) => {
    const updated = [...rows];
    const courses = [...(updated[studentIndex].courses || [])];
    courses[courseIndex] = {
      ...courses[courseIndex],
      selected: !courses[courseIndex].selected,
    };
    updated[studentIndex] = { ...updated[studentIndex], courses };
    updateParent(updated);
  };

  const handleCourseFieldChange = (
    studentIndex: number,
    courseIndex: number,
    field: keyof DispensationCourseItem,
    val: any
  ) => {
    const updated = [...rows];
    const courses = [...(updated[studentIndex].courses || [])];
    courses[courseIndex] = {
      ...courses[courseIndex],
      [field]: val,
    };
    updated[studentIndex] = { ...updated[studentIndex], courses };
    updateParent(updated);
  };

  const handleAddCourseToStudent = (studentIndex: number) => {
    const updated = [...rows];
    const student = updated[studentIndex];
    const newCourse: DispensationCourseItem = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseName: '',
      startTime: '08:00',
      endTime: '10:30',
      room: '',
      classCode: student.classCode || '',
      selected: true,
    };
    const courses = [...(student.courses || []), newCourse];
    updated[studentIndex] = { ...student, courses };
    updateParent(updated);
  };

  const handleRemoveCourseFromStudent = (studentIndex: number, courseIndex: number) => {
    const updated = [...rows];
    const courses = (updated[studentIndex].courses || []).filter((_, i) => i !== courseIndex);
    updated[studentIndex] = { ...updated[studentIndex], courses };
    updateParent(updated);
  };

  // DB search & select
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    try {
      const res = await searchTroopersAction(query);
      setSearchResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTrooper = async (trooper: any) => {
    setIsAddingUser(true);
    try {
      // Auto fetch their courses matching the event days
      const schedules = await getUsersCourseSchedulesForDispensationAction({
        userIds: [trooper.id],
        eventDaysText: eventDays,
        specificDateStr: specificDate,
      });

      if (schedules && schedules.length > 0) {
        const fetchedRow = schedules[0];
        // If they have no courses saved in database, provide a blank course row ready to type
        if (!fetchedRow.courses || fetchedRow.courses.length === 0) {
          fetchedRow.courses = [
            {
              id: `c_${Date.now()}`,
              courseName: '',
              startTime: '08:00',
              endTime: '10:30',
              room: '',
              classCode: fetchedRow.classCode || '17.4A.07',
              selected: true,
            },
          ];
        }
        updateParent([...rows, fetchedRow]);
      } else {
        // Fallback with profile data
        const newRow: DispensationAssigneeRow = {
          no: rows.length + 1,
          userId: trooper.id,
          name: trooper.name,
          nim: trooper.nip || '',
          studyProgram: trooper.department || 'Sistem Informasi',
          university: 'Universitas Bina Sarana Informatika (UBSI)',
          classCode: '17.4A.07',
          courses: [
            {
              id: `c_${Date.now()}`,
              courseName: '',
              startTime: '08:00',
              endTime: '10:30',
              room: '',
              classCode: '17.4A.07',
              selected: true,
            },
          ],
        };
        updateParent([...rows, newRow]);
      }
    } catch (err) {
      console.error('Failed to preload courses for trooper:', err);
    } finally {
      setIsAddingUser(false);
      setIsModalOpen(false);
    }
  };

  const totalSelectedCourses = rows.reduce((acc, row) => {
    return acc + (row.courses || []).filter((c) => c.selected !== false).length;
  }, 0);

  const isMultiPageAnnex = rows.length >= annexThreshold;

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-purple-500/5 dark:bg-purple-500/10 rounded-2xl border border-purple-500/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>🎓</span> Daftar Mahasiswa &amp; Perkuliahan ({rows.length} Mahasiswa)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white shadow-xs">
              {totalSelectedCourses} Matakuliah Dipilih
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {isMultiPageAnnex ? (
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                ℹ️ Jumlah &ge; {annexThreshold} mahasiswa: Otomatis dimuat rapi pada <strong>Lampiran Halaman 2+</strong>.
              </span>
            ) : (
              <span>
                Jumlah &lt; {annexThreshold} mahasiswa: Dirender langsung di halaman utama.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsModalOpen(true);
              handleSearch('');
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>🔍</span> Cari dari DB Troopers
          </button>
          <button
            type="button"
            onClick={handleAddManualStudent}
            className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all flex items-center gap-1"
          >
            <span>+</span> Tambah Manual
          </button>
        </div>
      </div>

      {/* Student Cards List */}
      {rows.length === 0 ? (
        <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 space-y-2">
          <span className="text-2xl">📋</span>
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            Belum ada mahasiswa yang diajukan dispensasi
          </p>
          <p className="text-[11px] text-zinc-400">
            Klik &quot;Cari dari DB Troopers&quot; untuk otomatis menarik data profil &amp; jadwal kuliah, atau &quot;Tambah Manual&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row, sIdx) => {
            const selectedCoursesCount = (row.courses || []).filter((c) => c.selected !== false).length;

            return (
              <div
                key={sIdx}
                className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3.5 transition-all"
              >
                {/* Student Header & Ordering */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {row.no || sIdx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        {row.name || `Mahasiswa #${sIdx + 1}`}
                        {row.nim && (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                            NIM: {row.nim}
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-zinc-500">
                        {row.studyProgram} • {row.university} {row.classCode ? `(${row.classCode})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-lg border border-purple-500/20 mr-1">
                      {selectedCoursesCount} Matakuliah Aktif
                    </span>
                    <button
                      type="button"
                      disabled={sIdx === 0}
                      onClick={() => handleMoveStudent(sIdx, 'UP')}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 text-xs"
                      title="Geser ke atas"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={sIdx === rows.length - 1}
                      onClick={() => handleMoveStudent(sIdx, 'DOWN')}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 text-xs"
                      title="Geser ke bawah"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveStudent(sIdx)}
                      className="ml-1 p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs font-bold"
                      title="Hapus Mahasiswa"
                    >
                      ✕ Hapus
                    </button>
                  </div>
                </div>

                {/* Profile Detail Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Nama Mahasiswa
                    </label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => handleStudentFieldChange(sIdx, 'name', e.target.value)}
                      placeholder="Nama Lengkap"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      NIM / NIP
                    </label>
                    <input
                      type="text"
                      value={row.nim}
                      onChange={(e) => handleStudentFieldChange(sIdx, 'nim', e.target.value)}
                      placeholder="NIM / No. Induk"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Program Studi &amp; Kelas
                    </label>
                    <div className="grid grid-cols-[1fr_80px] gap-1.5">
                      <input
                        type="text"
                        value={row.studyProgram}
                        onChange={(e) => handleStudentFieldChange(sIdx, 'studyProgram', e.target.value)}
                        placeholder="Prodi"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100"
                      />
                      <input
                        type="text"
                        value={row.classCode}
                        onChange={(e) => handleStudentFieldChange(sIdx, 'classCode', e.target.value)}
                        placeholder="Kelas"
                        className="w-full px-2 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-center text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Asal Kampus / Universitas
                    </label>
                    <input
                      type="text"
                      value={row.university}
                      onChange={(e) => handleStudentFieldChange(sIdx, 'university', e.target.value)}
                      placeholder="Nama Kampus / Universitas"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Courses Checklist & Inputs */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span>📚</span> Rincian Mata Kuliah yang Dimohonkan Izin Dispensasi:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddCourseToStudent(sIdx)}
                      className="text-[10.5px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      + Tambah Matakuliah
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(row.courses || []).length === 0 ? (
                      <p className="text-center py-2 text-[11px] text-zinc-400 italic">
                        Belum ada matakuliah ditambahkan. Klik &quot;+ Tambah Matakuliah&quot;.
                      </p>
                    ) : (
                      row.courses.map((course, cIdx) => {
                        const isChecked = course.selected !== false;

                        return (
                          <div
                            key={course.id || cIdx}
                            className={`p-2.5 rounded-xl border transition-all flex flex-wrap lg:flex-nowrap items-center gap-2.5 ${
                              isChecked
                                ? 'bg-white dark:bg-zinc-900 border-purple-500/40 shadow-xs'
                                : 'bg-zinc-100/60 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 opacity-60'
                            }`}
                          >
                            {/* Checkbox Toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCourseSelected(sIdx, cIdx)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                Ajukan
                              </span>
                            </label>

                            {/* Course Name */}
                            <div className="flex-1 min-w-[160px]">
                              <input
                                type="text"
                                value={course.courseName}
                                onChange={(e) =>
                                  handleCourseFieldChange(sIdx, cIdx, 'courseName', e.target.value)
                                }
                                placeholder="Nama Mata Kuliah (e.g. Pemrograman Web)"
                                className="w-full px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                              />
                            </div>

                            {/* Day & Time */}
                            <div className="flex items-center gap-1 shrink-0">
                              {course.dayName && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                  {course.dayName}
                                </span>
                              )}
                              <input
                                type="text"
                                value={course.startTime}
                                onChange={(e) =>
                                  handleCourseFieldChange(sIdx, cIdx, 'startTime', e.target.value)
                                }
                                placeholder="08:00"
                                className="w-16 px-1.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-xs font-mono text-center"
                              />
                              <span className="text-zinc-400 font-bold">-</span>
                              <input
                                type="text"
                                value={course.endTime}
                                onChange={(e) =>
                                  handleCourseFieldChange(sIdx, cIdx, 'endTime', e.target.value)
                                }
                                placeholder="10:30"
                                className="w-16 px-1.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-xs font-mono text-center"
                              />
                            </div>

                            {/* Room & Class */}
                            <div className="w-24 shrink-0">
                              <input
                                type="text"
                                value={course.room || ''}
                                onChange={(e) =>
                                  handleCourseFieldChange(sIdx, cIdx, 'room', e.target.value)
                                }
                                placeholder="Ruang / Lab"
                                className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-xs text-center"
                              />
                            </div>

                            {/* Delete Course Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveCourseFromStudent(sIdx, cIdx)}
                              className="text-red-500 hover:text-red-700 p-1 text-xs shrink-0"
                              title="Hapus Matakuliah"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trooper Selector Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>👥</span> Pilih Mahasiswa / Trooper dari Database
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ketik nama, email, atau NIM/NIP..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 divide-y divide-zinc-100 dark:divide-zinc-800">
              {isSearching ? (
                <p className="text-center text-xs py-4 text-zinc-400">
                  Mencari personil...
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-xs py-4 text-zinc-400">
                  Tidak ada user yang cocok.
                </p>
              ) : (
                searchResults.map((t) => (
                  <div
                    key={t.id}
                    className="pt-1.5 flex items-center justify-between gap-2 p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-xl cursor-pointer"
                    onClick={() => handleSelectTrooper(t)}
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {t.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        NIM/NIP: {t.nip} • {t.email}
                      </p>
                      {t.department && (
                        <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                          {t.department}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isAddingUser}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 shrink-0 flex items-center gap-1"
                    >
                      {isAddingUser ? 'Memuat...' : '+ Tambah & Cek Kuliah'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
