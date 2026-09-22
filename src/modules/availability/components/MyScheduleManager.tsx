'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  DAY_OF_WEEK_NAMES,
  SuratTugasDutyItem,
  UserAvailabilityItem,
} from '../availabilityTypes';
import {
  getUserAvailabilitiesAction,
  deleteAvailabilityAction,
  toggleAvailabilityStatusAction,
  clearUserSemesterSchedulesAction,
} from '../availabilityActions';
import ScheduleModal from './ScheduleModal';

interface MyScheduleManagerProps {
  currentUserId: string;
  currentUserName: string;
}

export default function MyScheduleManager({
  currentUserId,
  currentUserName,
}: MyScheduleManagerProps) {
  const [schedules, setSchedules] = useState<UserAvailabilityItem[]>([]);
  const [suratTugasDuties, setSuratTugasDuties] = useState<SuratTugasDutyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'KULIAH' | 'APPOINTMENT' | 'SURAT_TUGAS'>('KULIAH');
  const [activeSemester, setActiveSemester] = useState('Semester Ganjil 2026/2027');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEditItem, setModalEditItem] = useState<UserAvailabilityItem | null>(null);
  const [modalDefaultType, setModalDefaultType] = useState<'KULIAH' | 'APPOINTMENT'>('KULIAH');

  // Clear Semester Modal State
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getUserAvailabilitiesAction(currentUserId);
      setSchedules(data.schedules || []);
      setSuratTugasDuties(data.suratTugasDuties || []);
    } catch (err) {
      console.error('Failed to load user availabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUserId]);

  const kuliahList = useMemo(() => {
    return schedules.filter((s) => s.type === 'KULIAH');
  }, [schedules]);

  const appointmentList = useMemo(() => {
    return schedules.filter((s) => s.type === 'APPOINTMENT');
  }, [schedules]);

  // Group kuliah by day of week
  const kuliahByDay = useMemo(() => {
    const map = new Map<number, UserAvailabilityItem[]>();
    for (let d = 1; d <= 7; d++) {
      map.set(d, []);
    }
    kuliahList.forEach((k) => {
      if (k.dayOfWeek && map.has(k.dayOfWeek)) {
        map.get(k.dayOfWeek)!.push(k);
      }
    });
    return map;
  }, [kuliahList]);

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) return;
    try {
      const res = await deleteAvailabilityAction(id);
      if (res.success) {
        setMessage({ type: 'success', text: 'Jadwal berhasil dihapus.' });
        loadData();
      } else {
        setMessage({ type: 'error', text: res.message || 'Gagal menghapus jadwal.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Terjadi kesalahan sistem.' });
    }
  };

  // Handle Toggle Active
  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await toggleAvailabilityStatusAction(id, !currentActive);
      loadData();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Handle Clear Semester
  const handleClearSemester = async () => {
    setClearing(true);
    try {
      const res = await clearUserSemesterSchedulesAction();
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Jadwal semester berhasil dibersihkan.' });
        setShowClearConfirm(false);
        loadData();
      } else {
        setMessage({ type: 'error', text: res.message || 'Gagal membersihkan jadwal semester.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Profile Info */}
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-900">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Manajemen Jadwal Mandiri
            </span>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mt-1">
              Pengaturan Jadwal Kuliah & Kegiatan {currentUserName}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Input jadwal perkuliahan semester aktif dan agenda kegiatan pribadi agar koordinator mengetahui waktu luang Anda.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setModalDefaultType('KULIAH');
                setModalEditItem(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/25 flex items-center gap-2 transition-all active:scale-95"
            >
              <span>➕</span>
              <span>Tambah Jadwal Kuliah</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModalDefaultType('APPOINTMENT');
                setModalEditItem(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl text-xs font-black bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 flex items-center gap-2 transition-all active:scale-95"
            >
              <span>🗓️</span>
              <span>Tambah Appointment</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
            }`}
          >
            <span>{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-zinc-400 hover:text-zinc-600 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 pt-5 border-b border-zinc-100 dark:border-zinc-900 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('KULIAH')}
            className={`pb-3 px-3 text-xs font-black transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'KULIAH'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>🎓</span>
            <span>Jadwal Perkuliahan Rutin</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600">
              {kuliahList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPOINTMENT')}
            className={`pb-3 px-3 text-xs font-black transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'APPOINTMENT'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>🗓️</span>
            <span>Agenda & Appointment</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600">
              {appointmentList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SURAT_TUGAS')}
            className={`pb-3 px-3 text-xs font-black transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'SURAT_TUGAS'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>📋</span>
            <span>Penugasan Surat Tugas (Otomatis)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600">
              {suratTugasDuties.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Jadwal Perkuliahan (Semester) */}
        {activeTab === 'KULIAH' && (
          <div className="pt-5 space-y-6">
            {/* Semester Renewal Banner & Clear Action */}
            <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📚</span>
                <div>
                  <h4 className="text-xs font-black text-purple-900 dark:text-purple-300">
                    Pengelolaan Jadwal Per Semester
                  </h4>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Ketika memasuki semester baru, Anda dapat memperbarui atau menghapus seluruh jadwal kuliah lama sekaligus.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={kuliahList.length === 0}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shrink-0"
                title="Hapus semua jadwal kuliah untuk persiapan semester baru"
              >
                🗑️ Bersihkan Jadwal Semester Ini
              </button>
            </div>

            {/* List by Day of Week */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-zinc-400 font-bold">Memuat jadwal perkuliahan Anda...</p>
              </div>
            ) : kuliahList.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 bg-zinc-50/50 dark:bg-zinc-900/20">
                <span className="text-3xl">🎓</span>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-2">
                  Belum ada jadwal perkuliahan yang disimpan
                </p>
                <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                  Tambahkan jadwal matakuliah semester aktif Anda untuk memudahkan penentuan ketersediaan waktu tim.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModalDefaultType('KULIAH');
                    setModalEditItem(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-5 py-2.5 rounded-2xl text-xs font-black bg-purple-600 text-white shadow-md shadow-purple-500/20 hover:bg-purple-700 transition-all"
                >
                  ➕ Tambah Matakuliah Pertama
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                  const dayMeta = DAY_OF_WEEK_NAMES[dayNum];
                  const dayClasses = kuliahByDay.get(dayNum) || [];
                  if (dayClasses.length === 0) return null;

                  return (
                    <div key={dayNum} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
                          {dayMeta.name}
                        </h4>
                        <span className="text-[10px] text-zinc-400 font-bold">
                          ({dayClasses.length} Matakuliah)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dayClasses.map((item) => (
                          <div
                            key={item.id}
                            className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                              item.isActive
                                ? 'bg-zinc-50 dark:bg-[#121216] border-zinc-200/80 dark:border-zinc-800/80'
                                : 'bg-zinc-100/50 dark:bg-zinc-900/40 border-zinc-200/40 dark:border-zinc-800/40 opacity-60'
                            }`}
                          >
                            {/* Card Top */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-black font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md">
                                  ⏰ {item.startTime} - {item.endTime} WIB
                                </span>
                                {item.semesterLabel && (
                                  <span className="text-[10px] text-zinc-400 ml-2 font-medium">
                                    • {item.semesterLabel}
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggle(item.id, item.isActive)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    item.isActive
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                                  }`}
                                  title="Toggle status aktif"
                                >
                                  {item.isActive ? 'Aktif' : 'Non-aktif'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalEditItem(item);
                                    setIsModalOpen(true);
                                  }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs"
                                  title="Edit jadwal"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                                  title="Hapus jadwal"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {/* 1. Kode & Nama Matakuliah */}
                            <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                              {item.courseCode ? `[${item.courseCode}] ` : ''}{item.courseName || item.title}
                            </h5>

                            {/* 3. Kelas & Kampus, 4. Dosen */}
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                              {(item.classCode || item.campusName) && (
                                <p>
                                  🏛️ Kelas: <strong className="text-zinc-800 dark:text-zinc-200">{item.classCode || '-'}</strong> ({item.campusName || '-'})
                                </p>
                              )}
                              {(item.lecturerName || item.lecturerCode) && (
                                <p>
                                  👨‍🏫 Dosen: <strong className="text-zinc-800 dark:text-zinc-200">{item.lecturerCode ? `[${item.lecturerCode}] ` : ''}{item.lecturerName}</strong>
                                </p>
                              )}
                              {item.room && (
                                <p className="text-[11px] text-zinc-500">
                                  📍 Ruangan: {item.room}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-[11px] text-zinc-500 italic">
                                  📝 {item.notes}
                                </p>
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
        )}

        {/* Tab 2: Agenda & Appointment */}
        {activeTab === 'APPOINTMENT' && (
          <div className="pt-5 space-y-4">
            {appointmentList.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 bg-zinc-50/50 dark:bg-zinc-900/20">
                <span className="text-3xl">🗓️</span>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-2">
                  Belum ada agenda atau appointment mandiri
                </p>
                <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                  Catat kegiatan satu kali (misal bimbingan skripsi, ujian praktikum, atau konsultasi) agar terdata di kalender ketersediaan.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModalDefaultType('APPOINTMENT');
                    setModalEditItem(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-5 py-2.5 rounded-2xl text-xs font-black bg-purple-600 text-white shadow-md shadow-purple-500/20 hover:bg-purple-700 transition-all"
                >
                  ➕ Tambah Appointment
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {appointmentList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#121216] border border-amber-500/20 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          🗓️ {item.specificDate || 'Tanggal Khusus'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 ml-2">
                          {item.isAllDay ? 'Sepanjang Hari' : `⏰ ${item.startTime} - ${item.endTime}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setModalEditItem(item);
                            setIsModalOpen(true);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-purple-600 text-xs"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-600 text-xs"
                          title="Hapus"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </h5>

                    {item.location && (
                      <p className="text-xs text-zinc-500">📍 {item.location}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-zinc-400 italic">📝 {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Surat Tugas (Automatic Integration) */}
        {activeTab === 'SURAT_TUGAS' && (
          <div className="pt-5 space-y-4">
            <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <h4 className="text-xs font-black text-blue-900 dark:text-blue-300">
                  Sinkronisasi Otomatis Surat Tugas Resmi
                </h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Setiap kali Anda ditugaskan dalam Surat Tugas resmi KIAN HQ, jadwal bertugas akan otomatis muncul di kalender availability tanpa perlu diinput manual.
                </p>
              </div>
            </div>

            {suratTugasDuties.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 bg-zinc-50/50 dark:bg-zinc-900/20">
                <span className="text-3xl">📋</span>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-2">
                  Belum ada penugasan Surat Tugas resmi yang terbit
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Ketika manajemen menerbitkan Surat Tugas yang mencantumkan nama atau NIP Anda, jadwal penugasan akan otomatis terhubung di sini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suratTugasDuties.map((duty, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-3xl bg-white dark:bg-[#121216] border border-blue-500/30 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                        Surat Tugas Resmi KIAN
                      </span>
                      <span className="text-[10px] font-mono font-bold text-zinc-500">
                        {duty.documentNumber}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                      {duty.eventName}
                    </h4>

                    <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                      <p>🎯 Peran / Tugas: <strong className="text-zinc-900 dark:text-zinc-100">{duty.dutyRole}</strong></p>
                      <p>📅 Jadwal: <strong className="text-zinc-900 dark:text-zinc-100">{duty.eventDays}</strong></p>
                      <p>⏰ Waktu: {duty.eventTime}</p>
                      <p>📍 Lokasi: {duty.eventLocation}</p>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-right">
                      <Link
                        href={`/dashboard/documents`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>Lihat Dokumen Lengkap ➔</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule Input/Edit Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalEditItem(null);
        }}
        onSuccess={() => {
          setMessage({ type: 'success', text: 'Jadwal berhasil disimpan.' });
          loadData();
        }}
        editItem={modalEditItem}
        defaultType={modalDefaultType}
        defaultSemester={activeSemester}
      />

      {/* Clear Semester Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                Bersihkan Jadwal Semester?
              </h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Tindakan ini akan menghapus semua jadwal perkuliahan semester Anda yang sudah tersimpan. Gunakan fitur ini ketika Anda berganti semester dan ingin menginput jadwal baru dari awal.
            </p>
            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearSemester}
                className="px-5 py-2 rounded-2xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition-all disabled:opacity-50"
              >
                {clearing ? 'Membersihkan...' : 'Ya, Bersihkan Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
