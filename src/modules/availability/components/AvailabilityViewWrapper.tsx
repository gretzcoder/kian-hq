'use client';

import { useState } from 'react';
import AvailabilityCalendar from './AvailabilityCalendar';
import AllUsersCourseDirectory from './AllUsersCourseDirectory';
import WeeklyTimetableMatrix from './WeeklyTimetableMatrix';
import MyScheduleManager from './MyScheduleManager';

interface AvailabilityViewWrapperProps {
  currentUserId: string;
  currentUserName: string;
  isStaffOrManager: boolean;
}

export default function AvailabilityViewWrapper({
  currentUserId,
  currentUserName,
  isStaffOrManager,
}: AvailabilityViewWrapperProps) {
  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'COURSES' | 'TIMETABLE' | 'MY_SCHEDULE'>('CALENDAR');

  return (
    <div className="space-y-6">
      {/* Top View Selector Tabs */}
      <div className="bg-white dark:bg-[#09090b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-1.5 shadow-2xs flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('CALENDAR')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'CALENDAR'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <span>📅</span>
          <span>Kalender Ketersediaan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('COURSES')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'COURSES'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <span>🎓</span>
          <span>Perkuliahan Seluruh User</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TIMETABLE')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'TIMETABLE'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <span>🗓️</span>
          <span>Matriks Mingguan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MY_SCHEDULE')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'MY_SCHEDULE'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <span>👤</span>
          <span>Kelola Jadwal Saya</span>
        </button>
      </div>

      {/* Main View Area */}
      {activeTab === 'CALENDAR' && <AvailabilityCalendar isStaffOrManager={isStaffOrManager} />}
      {activeTab === 'COURSES' && <AllUsersCourseDirectory isStaffOrManager={isStaffOrManager} />}
      {activeTab === 'TIMETABLE' && <WeeklyTimetableMatrix isStaffOrManager={isStaffOrManager} />}
      {activeTab === 'MY_SCHEDULE' && (
        <MyScheduleManager
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}
    </div>
  );
}
