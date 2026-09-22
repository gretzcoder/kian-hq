'use client';

import { useState, useEffect } from 'react';
import {
  AvailabilityType,
  CreateAvailabilityPayload,
  DayOfWeekNumber,
  DAY_OF_WEEK_NAMES,
  UserAvailabilityItem,
} from '../availabilityTypes';
import { createAvailabilityAction, updateAvailabilityAction } from '../availabilityActions';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editItem?: UserAvailabilityItem | null;
  defaultType?: AvailabilityType;
  defaultDate?: string;
  defaultSemester?: string;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  editItem,
  defaultType = 'KULIAH',
  defaultDate,
  defaultSemester = 'Semester Ganjil 2026/2027',
}: ScheduleModalProps) {
  const [type, setType] = useState<AvailabilityType>(defaultType);
  const [semesterLabel, setSemesterLabel] = useState(defaultSemester);
  
  // Kuliah fields
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [campusName, setCampusName] = useState('');
  const [lecturerCode, setLecturerCode] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [room, setRoom] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeekNumber>(1);
  
  // Appointment fields
  const [title, setTitle] = useState('');
  const [specificDate, setSpecificDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:30');
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editItem) {
      setType(editItem.type);
      setSemesterLabel(editItem.semesterLabel || defaultSemester);
      setCourseCode(editItem.courseCode || '');
      setCourseName(editItem.courseName || '');
      setClassCode(editItem.classCode || '');
      setCampusName(editItem.campusName || '');
      setLecturerCode(editItem.lecturerCode || '');
      setLecturerName(editItem.lecturerName || '');
      setRoom(editItem.room || '');
      setDayOfWeek((editItem.dayOfWeek || 1) as DayOfWeekNumber);
      setTitle(editItem.title || '');
      setSpecificDate(editItem.specificDate || new Date().toISOString().split('T')[0]);
      setStartTime(editItem.startTime || '08:00');
      setEndTime(editItem.endTime || '10:30');
      setIsAllDay(editItem.isAllDay || false);
      setLocation(editItem.location || '');
      setNotes(editItem.notes || '');
    } else {
      setType(defaultType);
      setSemesterLabel(defaultSemester);
      setCourseCode('');
      setCourseName('');
      setClassCode('');
      setCampusName('');
      setLecturerCode('');
      setLecturerName('');
      setRoom('');
      setDayOfWeek(1);
      setTitle('');
      setSpecificDate(defaultDate || new Date().toISOString().split('T')[0]);
      setStartTime('08:00');
      setEndTime('10:30');
      setIsAllDay(false);
      setLocation('');
      setNotes('');
    }
    setError(null);
  }, [editItem, defaultType, defaultDate, defaultSemester, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: CreateAvailabilityPayload = {
        type,
        semesterLabel: type === 'KULIAH' ? semesterLabel : undefined,
        courseCode: type === 'KULIAH' ? courseCode.trim() : undefined,
        courseName: type === 'KULIAH' ? courseName.trim() : undefined,
        classCode: type === 'KULIAH' ? classCode.trim() : undefined,
        campusName: type === 'KULIAH' ? campusName.trim() : undefined,
        lecturerCode: type === 'KULIAH' ? lecturerCode.trim() : undefined,
        lecturerName: type === 'KULIAH' ? lecturerName.trim() : undefined,
        room: room.trim() || undefined,
        dayOfWeek: type === 'KULIAH' ? dayOfWeek : undefined,
        title: type === 'APPOINTMENT' ? title.trim() : undefined,
        specificDate: type === 'APPOINTMENT' ? specificDate : undefined,
        startTime,
        endTime,
        isAllDay,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editItem) {
        const res = await updateAvailabilityAction(editItem.id, payload);
        if (!res.success) {
          setError(res.message || 'Gagal memperbarui jadwal.');
          setLoading(false);
          return;
        }
      } else {
        const res = await createAvailabilityAction(payload);
        if (!res.success) {
          setError(res.message || 'Gagal menyimpan jadwal.');
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan sistem.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
              {editItem ? 'Edit Jadwal' : 'Input Jadwal Mandiri'}
            </span>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
              {editItem ? 'Perbarui Jadwal & Ketersediaan' : 'Tambah Jadwal Baru'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector (Jadwal Kuliah vs Appointment) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Kategori Jadwal
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('KULIAH')}
                className={`py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all border ${
                  type === 'KULIAH'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                    : 'bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40'
                }`}
              >
                <span>🎓</span>
                <span>Jadwal Kuliah (Semester)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('APPOINTMENT')}
                className={`py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all border ${
                  type === 'APPOINTMENT'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                    : 'bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40'
                }`}
              >
                <span>🗓️</span>
                <span>Agenda / Appointment</span>
              </button>
            </div>
          </div>

          {/* =============================================================== */}
          {/* FIELDS UNTUK JADWAL KULIAH */}
          {/* =============================================================== */}
          {type === 'KULIAH' ? (
            <div className="space-y-4 pt-1">
              {/* Semester Info */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Periode Semester
                </label>
                <input
                  type="text"
                  value={semesterLabel}
                  onChange={(e) => setSemesterLabel(e.target.value)}
                  placeholder="Contoh: Semester Ganjil 2026/2027 atau Semester 5"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  required
                />
              </div>

              {/* 1. Kode & Nama Matakuliah */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    1. Kode MK
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. TI101"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nama Matakuliah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Contoh: Pemrograman Web & Aplikasi Bergerak"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    required
                  />
                </div>
              </div>

              {/* 2. Waktu Perkuliahan: Hari, Jam Mulai, Jam Selesai */}
              <div className="p-3.5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-3">
                <label className="block text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  2. Waktu Perkuliahan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Hari Rutin
                    </label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10) as DayOfWeekNumber)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {DAY_OF_WEEK_NAMES[d].name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Jam Selesai
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 3. Kode Kelas & Nama Kampus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    3. Kode Kelas
                  </label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    placeholder="Contoh: 12.4A.01 / TI-2024"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nama Kampus / Institusi
                  </label>
                  <input
                    type="text"
                    value={campusName}
                    onChange={(e) => setCampusName(e.target.value)}
                    placeholder="Contoh: UBSI Margonda / Nusa Mandiri"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>

              {/* 4. Kode & Nama Dosen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    4. Kode Dosen
                  </label>
                  <input
                    type="text"
                    value={lecturerCode}
                    onChange={(e) => setLecturerCode(e.target.value)}
                    placeholder="e.g. DS01"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nama Dosen Pengampu
                  </label>
                  <input
                    type="text"
                    value={lecturerName}
                    onChange={(e) => setLecturerName(e.target.value)}
                    placeholder="Contoh: Dr. Budi Santoso, M.Kom"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>

              {/* Ruangan & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Ruangan / Lab (Opsional)
                  </label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Contoh: Lab 402 / Gd B Lt 3"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Perkuliahan tatap muka / hybrid"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* =============================================================== */
            /* FIELDS UNTUK APPOINTMENT / KEGIATAN LAIN */
            /* =============================================================== */
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Nama Kegiatan / Appointment <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Bimbingan Skripsi / Ujian / Meeting Client"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Tanggal Kegiatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    disabled={isAllDay}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    disabled={isAllDay}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalAllDay"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <label htmlFor="modalAllDay" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  Sepanjang Hari (All Day Event)
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Lokasi / Tempat (Opsional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Gedung Rektorat Lt. 2 / Online via Google Meet"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Catatan / Keterangan Tambahan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Tuliskan keterangan penting atau instruksi..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-2xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambahkan Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
