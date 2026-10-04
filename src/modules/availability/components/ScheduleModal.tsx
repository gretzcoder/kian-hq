'use client';

import { useState, useEffect } from 'react';
import {
  AvailabilityType,
  CreateAvailabilityPayload,
  DayOfWeekNumber,
  DAY_OF_WEEK_NAMES,
  UserAvailabilityItem,
} from '../availabilityTypes';
import {
  createAvailabilityAction,
  updateAvailabilityAction,
  getUserAcademicDefaultsAction,
} from '../availabilityActions';

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
  
  // Kuliah & Kerja fields
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [campusName, setCampusName] = useState('');
  const [lecturerCode, setLecturerCode] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [room, setRoom] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<string>('TATAP_MUKA');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeekNumber>(1);
  const [selectedWorkDays, setSelectedWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  
  // Appointment & generic fields
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
      setDeliveryMode(editItem.deliveryMode || (editItem.type === 'KERJA' ? 'WFO' : 'TATAP_MUKA'));
      setDayOfWeek((editItem.dayOfWeek || 1) as DayOfWeekNumber);
      setSelectedWorkDays([editItem.dayOfWeek || 1]);
      setTitle(editItem.title || '');
      setSpecificDate(editItem.specificDate || new Date().toISOString().split('T')[0]);
      setStartTime(editItem.startTime || (editItem.type === 'KERJA' ? '09:00' : '08:00'));
      setEndTime(editItem.endTime || (editItem.type === 'KERJA' ? '17:00' : '10:30'));
      setIsAllDay(editItem.isAllDay || false);
      setLocation(editItem.location || '');
      setNotes(editItem.notes || '');
    } else {
      setType(defaultType);
      setSemesterLabel(defaultSemester);
      setCourseCode('');
      setCourseName('');
      setLecturerCode('');
      setLecturerName('');
      setRoom('');
      setDeliveryMode(defaultType === 'KERJA' ? 'WFO' : 'TATAP_MUKA');
      setDayOfWeek(1);
      setSelectedWorkDays([1, 2, 3, 4, 5]);
      setTitle('');
      setSpecificDate(defaultDate || new Date().toISOString().split('T')[0]);
      setStartTime(defaultType === 'KERJA' ? '09:00' : '08:00');
      setEndTime(defaultType === 'KERJA' ? '17:00' : '10:30');
      setIsAllDay(false);
      setLocation('');
      setNotes('');

      // Auto-fetch defaults from user profile & previously input schedules
      if (isOpen) {
        getUserAcademicDefaultsAction().then((defaults) => {
          if (defaults.campusName) setCampusName(defaults.campusName);
          if (defaults.classCode) setClassCode(defaults.classCode);
          if (defaults.semesterLabel) setSemesterLabel(defaults.semesterLabel);
        }).catch(() => {});
      }
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
        courseName: type === 'KULIAH' || type === 'KERJA' ? courseName.trim() : undefined,
        classCode: type === 'KULIAH' ? classCode.trim() : undefined,
        campusName: type === 'KULIAH' || type === 'KERJA' ? campusName.trim() : undefined,
        lecturerCode: type === 'KULIAH' ? lecturerCode.trim() : undefined,
        lecturerName: type === 'KULIAH' ? lecturerName.trim() : undefined,
        room: type === 'KULIAH' ? (room.trim() || undefined) : undefined,
        deliveryMode: type === 'KULIAH' || type === 'KERJA' ? deliveryMode : undefined,
        dayOfWeek: type === 'KERJA' && !editItem ? (selectedWorkDays[0] || 1) : (type === 'KULIAH' || type === 'KERJA' ? dayOfWeek : undefined),
        daysOfWeek: type === 'KERJA' && !editItem ? selectedWorkDays : undefined,
        title: type === 'APPOINTMENT' ? title.trim() : type === 'KERJA' ? (title.trim() || `${courseName.trim()} @ ${campusName.trim()}`) : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
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

          {/* Type Selector (Jadwal Kuliah vs Jadwal Kerja vs Appointment) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Kategori Jadwal
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('KULIAH');
                  if (deliveryMode === 'WFO' || deliveryMode === 'WFH') setDeliveryMode('TATAP_MUKA');
                }}
                className={`py-2.5 px-3 rounded-2xl text-xs font-black flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all border ${
                  type === 'KULIAH'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                    : 'bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40'
                }`}
              >
                <span>🎓</span>
                <span className="text-center">Jadwal Kuliah</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType('KERJA');
                  if (deliveryMode === 'TATAP_MUKA' || deliveryMode === 'ONLINE') setDeliveryMode('WFO');
                }}
                className={`py-2.5 px-3 rounded-2xl text-xs font-black flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all border ${
                  type === 'KERJA'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20'
                    : 'bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-500/40'
                }`}
              >
                <span>💼</span>
                <span className="text-center">Jadwal Kerja</span>
              </button>

              <button
                type="button"
                onClick={() => setType('APPOINTMENT')}
                className={`py-2.5 px-3 rounded-2xl text-xs font-black flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all border ${
                  type === 'APPOINTMENT'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                    : 'bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40'
                }`}
              >
                <span>🗓️</span>
                <span className="text-center">Appointment</span>
              </button>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 1. FIELDS UNTUK JADWAL KULIAH */}
          {/* =============================================================== */}
          {type === 'KULIAH' && (
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

              {/* Status / Metode Perkuliahan (Form Option Tatap Muka vs Online vs Hybrid) */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Metode Perkuliahan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('TATAP_MUKA')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                      deliveryMode === 'TATAP_MUKA'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-400'
                    }`}
                  >
                    🏛️ Tatap Muka (Offline)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('ONLINE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                      deliveryMode === 'ONLINE'
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-cyan-400'
                    }`}
                  >
                    💻 Kuliah Online (Daring)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('HYBRID')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                      deliveryMode === 'HYBRID'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-indigo-400'
                    }`}
                  >
                    🔄 Hybrid
                  </button>
                </div>
              </div>

              {/* 3. Kode Kelas & Nama Kampus */}
              <div className="space-y-1.5">
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
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  💡 Terisi otomatis dari riwayat / profil Anda. Anda dapat mengubahnya jika ada perbedaan kelas/kampus.
                </p>
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

              {/* Ruangan & Catatan Murni */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Ruangan / Platform (Opsional)
                  </label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Contoh: Lab 402 / Zoom Meet"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Presentasi kelompok, praktikum wajib, dll"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 2. FIELDS UNTUK JADWAL KERJA (Kuliah Sambil Kerja) */}
          {/* =============================================================== */}
          {type === 'KERJA' && (
            <div className="space-y-4 pt-1">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <span>💼</span>
                <span>
                  <strong>Jadwal Kerja:</strong> Untuk Anda yang kuliah sambil bekerja / freelance / part-time agar jam kerja rutin terdata di kalender ketersediaan tim.
                </span>
              </div>

              {/* Posisi & Perusahaan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Posisi / Profesi Pekerjaan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Contoh: Graphic Designer, Barista, Staff IT"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nama Perusahaan / Tempat Kerja <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={campusName}
                    onChange={(e) => setCampusName(e.target.value)}
                    placeholder="Contoh: PT Kian Digital / Kopi Kenangan / Freelance"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    required
                  />
                </div>
              </div>

              {/* Waktu Kerja Rutin: Hari (Multi-Day), Jam Mulai, Jam Selesai */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Waktu & Shift Kerja
                  </label>
                  {!editItem && (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1 w-fit">
                      <span>⚡</span> Multi-Hari Fleksibel
                    </span>
                  )}
                </div>

                {!editItem ? (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        Pilih Hari Kerja (Bisa Lebih Dari 1 Hari)
                      </label>
                      {/* Preset Shortcuts */}
                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setSelectedWorkDays([1, 2, 3, 4, 5])}
                          className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                            selectedWorkDays.length === 5 && [1, 2, 3, 4, 5].every((d) => selectedWorkDays.includes(d))
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                          }`}
                        >
                          Senin - Jumat
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedWorkDays([1, 2, 3, 4, 5, 6])}
                          className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                            selectedWorkDays.length === 6 && [1, 2, 3, 4, 5, 6].every((d) => selectedWorkDays.includes(d))
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                          }`}
                        >
                          Senin - Sabtu
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedWorkDays([1, 2, 3, 4, 5, 6, 7])}
                          className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                            selectedWorkDays.length === 7
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                          }`}
                        >
                          Setiap Hari
                        </button>
                      </div>
                    </div>

                    {/* Multi-day Selection Chips */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {[
                        { day: 1, name: 'Senin', short: 'Sen' },
                        { day: 2, name: 'Selasa', short: 'Sel' },
                        { day: 3, name: 'Rabu', short: 'Rab' },
                        { day: 4, name: 'Kamis', short: 'Kam' },
                        { day: 5, name: "Jum'at", short: 'Jum' },
                        { day: 6, name: 'Sabtu', short: 'Sab' },
                        { day: 7, name: 'Minggu', short: 'Min' },
                      ].map((d) => {
                        const isSelected = selectedWorkDays.includes(d.day);
                        return (
                          <button
                            key={d.day}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (selectedWorkDays.length > 1) {
                                  setSelectedWorkDays(selectedWorkDays.filter((x) => x !== d.day));
                                }
                              } else {
                                setSelectedWorkDays([...selectedWorkDays, d.day].sort());
                              }
                            }}
                            className={`py-2 px-1 sm:px-2 rounded-xl text-xs font-black flex flex-col items-center justify-center transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/20'
                                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                            }`}
                          >
                            <span>{d.short}</span>
                            <span className="text-[9px] opacity-80 mt-0.5">{isSelected ? '✓' : '+'}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 font-medium bg-amber-500/10 px-2.5 py-1.5 rounded-xl border border-amber-500/20">
                      <span>🗓️</span>
                      <span>
                        Diterapkan untuk <strong>{selectedWorkDays.length} hari</strong>: {selectedWorkDays.map((d) => DAY_OF_WEEK_NAMES[d].name).join(', ')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Hari Rutin Kerja
                    </label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10) as DayOfWeekNumber)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {DAY_OF_WEEK_NAMES[d].name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Jam Masuk (Mulai)
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Jam Pulang (Selesai)
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Sistem / Format Kerja (WFO / WFH / Hybrid) */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Sistem / Format Kerja <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('WFO')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                      deliveryMode === 'WFO'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                    }`}
                  >
                    🏢 WFO (Di Kantor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('WFH')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                      deliveryMode === 'WFH'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                    }`}
                  >
                    🏠 WFH (Remote)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('HYBRID')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                      deliveryMode === 'HYBRID'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                    }`}
                  >
                    🔄 Hybrid
                  </button>
                </div>
              </div>

              {/* Lokasi Kantor & Catatan Kerja */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Lokasi / Cabang Kantor (Opsional)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: Sudirman Jakarta / Remote"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Catatan Shift / Kerja (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Fleksibel, bisa izin jika ada tugas"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 3. FIELDS UNTUK APPOINTMENT / KEGIATAN LAIN */}
          {/* =============================================================== */}
          {type === 'APPOINTMENT' && (
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
              className={`px-6 py-2.5 rounded-2xl text-xs font-black text-white shadow-md transition-all active:scale-95 disabled:opacity-50 ${
                type === 'KERJA'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                  : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/25'
              }`}
            >
              {loading ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambahkan Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
