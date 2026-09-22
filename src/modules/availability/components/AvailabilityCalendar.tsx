'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DayAvailabilitySummary,
  UserDateAvailabilityDetail,
} from '../availabilityTypes';
import {
  getMonthlyAvailabilityOverviewAction,
  getDateAvailabilityDetailsAction,
} from '../availabilityActions';
import DateAvailabilityInspector from './DateAvailabilityInspector';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const WEEK_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface AvailabilityCalendarProps {
  isStaffOrManager?: boolean;
}

export default function AvailabilityCalendar({
  isStaffOrManager = false,
}: AvailabilityCalendarProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1..12

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [monthlySummaries, setMonthlySummaries] = useState<DayAvailabilitySummary[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    dateStr: string;
    dayOfWeek: number;
    dayName: string;
    counts: { avail: number; berkegiatan: number; bertugas: number; total: number };
    users: UserDateAvailabilityDetail[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Load monthly overview
  const loadMonthData = useCallback(async (year: number, month: number) => {
    setLoadingMonth(true);
    try {
      const data = await getMonthlyAvailabilityOverviewAction(year, month);
      setMonthlySummaries(data);
    } catch (err) {
      console.error('Failed to load monthly overview:', err);
    } finally {
      setLoadingMonth(false);
    }
  }, []);

  // Load details for selected date
  const loadDateDetails = useCallback(async (dateStr: string) => {
    setLoadingDetails(true);
    try {
      const details = await getDateAvailabilityDetailsAction(dateStr);
      setSelectedDayDetails(details);
    } catch (err) {
      console.error('Failed to load date details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    loadMonthData(currentYear, currentMonth);
  }, [currentYear, currentMonth, loadMonthData]);

  useEffect(() => {
    loadDateDetails(selectedDate);
  }, [selectedDate, loadDateDetails]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const n = new Date();
    setCurrentYear(n.getFullYear());
    setCurrentMonth(n.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  // Calendar grid calculations
  // First day of month: 0 = Sun, 1 = Mon ... 6 = Sat
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  // Monday-based offset: 0 for Monday, 6 for Sunday
  const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Map summary lookup by day
  const summaryByDate = new Map<string, DayAvailabilitySummary>();
  monthlySummaries.forEach((s) => summaryByDate.set(s.dateStr, s));

  return (
    <div className="space-y-6">
      {/* Calendar Control Card */}
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-6 shadow-sm">
        {/* Top Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-900">
          <div className="flex items-center gap-3">
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h3>
            {loadingMonth && (
              <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoToday}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 transition-all active:scale-95"
            >
              ⚡ Hari Ini
            </button>
            <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-all"
                title="Bulan Sebelumnya"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-all"
                title="Bulan Berikutnya"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-900">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Petunjuk Status:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>🟢 Avail (Bebas Kuliah)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>🟣 Berkegiatan (Ada Kuliah/Appt)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>🔵 Bertugas (Surat Tugas)</span>
          </span>
        </div>

        {/* Calendar Table Grid */}
        <div className="pt-4">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {WEEK_DAYS.map((day, idx) => (
              <div
                key={day}
                className={`py-2 text-center text-[11px] font-black uppercase tracking-wider ${
                  idx >= 5 ? 'text-purple-600/80 dark:text-purple-400/80' : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty padding cells before start of month */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[72px] sm:min-h-[96px] rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/10 border border-transparent opacity-30 pointer-events-none"
              />
            ))}

            {/* Actual Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayStrPadded = String(dayNum).padStart(2, '0');
              const monthStrPadded = String(currentMonth).padStart(2, '0');
              const cellDateStr = `${currentYear}-${monthStrPadded}-${dayStrPadded}`;

              const isSelected = selectedDate === cellDateStr;
              const isToday = todayStr === cellDateStr;
              const summary = summaryByDate.get(cellDateStr);

              return (
                <button
                  key={cellDateStr}
                  type="button"
                  onClick={() => setSelectedDate(cellDateStr)}
                  className={`min-h-[76px] sm:min-h-[100px] p-2 sm:p-2.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-purple-500/10 dark:bg-purple-950/30 border-purple-500 shadow-md ring-2 ring-purple-500/30'
                      : isToday
                      ? 'bg-white dark:bg-[#121216] border-purple-500/50 hover:border-purple-500'
                      : 'bg-white dark:bg-[#101014] border-zinc-200/70 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                  }`}
                >
                  {/* Top: Day Number & Today indicator */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs sm:text-sm font-black rounded-lg w-6 h-6 flex items-center justify-center ${
                        isToday
                          ? 'bg-purple-600 text-white shadow-xs'
                          : isSelected
                          ? 'text-purple-600 dark:text-purple-400 font-black'
                          : 'text-zinc-800 dark:text-zinc-200 group-hover:text-purple-500'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {isToday && (
                      <span className="hidden sm:inline-block text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded-md">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  {/* Bottom: Availability Badges / Dots */}
                  {summary && (
                    <div className="space-y-1 mt-1">
                      {/* Desktop pill badges */}
                      <div className="hidden sm:flex flex-col gap-0.5">
                        {summary.availCount > 0 && (
                          <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md truncate flex items-center justify-between">
                            <span>Avail</span>
                            <span className="font-black">{summary.availCount}</span>
                          </div>
                        )}
                        {summary.berkegiatanCount > 0 && (
                          <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md truncate flex items-center justify-between">
                            <span>Kuliah</span>
                            <span className="font-black">{summary.berkegiatanCount}</span>
                          </div>
                        )}
                        {summary.bertugasCount > 0 && (
                          <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded-md truncate flex items-center justify-between animate-pulse">
                            <span>Tugas</span>
                            <span className="font-black">{summary.bertugasCount}</span>
                          </div>
                        )}
                      </div>

                      {/* Mobile compact dots */}
                      <div className="flex sm:hidden items-center justify-center gap-1 pt-1">
                        {summary.availCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`Avail: ${summary.availCount}`} />
                        )}
                        {summary.berkegiatanCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title={`Kuliah: ${summary.berkegiatanCount}`} />
                        )}
                        {summary.bertugasCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title={`Tugas: ${summary.bertugasCount}`} />
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Date Detail Inspector */}
      {selectedDayDetails && (
        <DateAvailabilityInspector
          dateStr={selectedDayDetails.dateStr}
          dayName={selectedDayDetails.dayName}
          counts={selectedDayDetails.counts}
          users={selectedDayDetails.users}
          loading={loadingDetails}
          isStaffOrManager={isStaffOrManager}
        />
      )}
    </div>
  );
}
