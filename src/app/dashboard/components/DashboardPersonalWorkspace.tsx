'use client';

import { useState } from 'react';
import Link from 'next/link';
import SendReminderButton from '@/components/SendReminderButton';
import { cleanAppreciationNote } from '@/lib/noteUtils';

export interface PersonalTaskRow {
  id: string;
  assignment_id?: string;
  project_id: string;
  workspace_id: string | null;
  title: string;
  status: string;
  deadline: number | null;
  project_name: string;
  assigned_name?: string | null;
  creator_name?: string | null;
  assignment_role?: string | null;
  sparks?: number | null;
  appreciation_note?: string | null;
  result_url?: string | null;
  submitted_at?: number | null;
  reviewed_at?: number | null;
}

interface DashboardPersonalWorkspaceProps {
  personalTasks: PersonalTaskRow[];
  completedTasks?: PersonalTaskRow[];
  canReview: boolean;
  widgetTitle: string;
  widgetDesc: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80',
  SUBMITTED: 'bg-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-500/10 dark:border-orange-500/20',
  WAITING_REVIEW: 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10 dark:border-yellow-500/20',
  REVISION_REQUESTED: 'bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/10 dark:border-red-500/20',
  RESUBMITTED: 'bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/10 dark:border-indigo-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  DONE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  LOCKED: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
  PUBLISHED: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  ARCHIVED: 'bg-zinc-500/5 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800',
  DECLINED: 'bg-red-800/10 text-red-800 dark:text-red-500 border-red-800/20',
};

const roleColors: Record<string, string> = {
  PIC: 'text-purple-600 dark:text-purple-400',
  REVIEWER: 'text-blue-600 dark:text-blue-400',
  HELPER: 'text-emerald-600 dark:text-emerald-400',
  APPROVER: 'text-amber-600 dark:text-amber-400',
  DESIGNER: 'text-purple-600 dark:text-purple-400',
  VIDEO_EDITOR: 'text-pink-600 dark:text-pink-400',
  CREATOR: 'text-indigo-600 dark:text-indigo-400',
};

export default function DashboardPersonalWorkspace({
  personalTasks = [],
  completedTasks = [],
  canReview,
  widgetTitle,
  widgetDesc,
}: DashboardPersonalWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');

  // Filter tasks strictly by tab status
  const activeList = (personalTasks || []).filter(
    (t) => !['APPROVED', 'DONE', 'PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(t.status)
  );

  const completedList = (completedTasks || []).filter((t) =>
    ['APPROVED', 'DONE', 'PUBLISHED', 'LOCKED'].includes(t.status)
  );

  // Deduplicate items by unique assignment_id / task identifier
  const cleanActiveTasks = Array.from(
    new Map(
      activeList.map((t) => [
        t.assignment_id || `${t.id}-${t.assignment_role}-${t.assigned_name}`,
        t,
      ])
    ).values()
  );

  const cleanCompletedTasks = Array.from(
    new Map(
      completedList.map((t) => [
        t.assignment_id || `${t.id}-${t.assignment_role}-${t.assigned_name}`,
        t,
      ])
    ).values()
  );

  const displayedTasks = activeTab === 'ACTIVE' ? cleanActiveTasks : cleanCompletedTasks;

  return (
    <div className="space-y-4">
      {/* Header & Filter Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {widgetTitle}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{widgetDesc}</p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <span>📌 Tasks Aktif</span>
            <span className="px-1.5 py-0.2 rounded-md bg-purple-500/10 text-[10px] font-mono">
              {cleanActiveTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'COMPLETED'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <span>✅ Selesai & ACC</span>
            <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-[10px] font-mono">
              {cleanCompletedTasks.length}
            </span>
          </button>
        </div>
      </div>

      {displayedTasks.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-10 text-center text-zinc-500 text-sm">
          {activeTab === 'ACTIVE'
            ? canReview
              ? '✅ Tidak ada penugasan aktif yang menggantung saat ini.'
              : '🎉 Tidak ada penugasan aktif. Kerja bagus!'
            : '📂 Belum ada penugasan yang selesai / di-ACC.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {displayedTasks.map((task, idx) => {
            const cleanedNote = cleanAppreciationNote(task.appreciation_note);
            const itemKey = `${activeTab}-${task.assignment_id || task.id}-${task.assignment_role || 'role'}-${idx}`;

            return (
              <div
                key={itemKey}
                className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-3 transition-all duration-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest truncate max-w-[140px]">
                        {task.project_name}
                      </span>
                      {task.assignment_role && (
                        <span
                          className={`text-[9px] font-black uppercase tracking-widest ${
                            roleColors[task.assignment_role] ?? 'text-zinc-400'
                          }`}
                        >
                          {task.assignment_role}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          statusColors[task.status] ?? statusColors.DRAFT
                        }`}
                      >
                        {task.status === 'APPROVED' ? '✅ ACC / Approved' : task.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {task.title}
                    </h4>

                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-1 flex-wrap font-medium">
                      {task.assigned_name && <span>👤 Assignee: <strong>{task.assigned_name}</strong></span>}
                      {task.creator_name && <span>🎓 Mentor: <strong>{task.creator_name}</strong></span>}
                    </div>
                  </div>

                  {/* Right Spark / Status Badge */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {task.sparks != null && (
                      <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-2xs">
                        💎 +{task.sparks} Sparks ✨
                      </span>
                    )}
                    {task.deadline && (
                      <span className="text-[10px] text-zinc-400 font-mono hidden sm:block">
                        Due: {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Appreciation Note Box (if completed or approved task has feedback note) */}
                {cleanedNote && (
                  <div className="mt-1 p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/15 space-y-1">
                    <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>💬 Catatan Apresiasi & Feedback Evaluator</span>
                    </div>
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 italic font-medium leading-relaxed">
                      "{cleanedNote}"
                    </p>
                  </div>
                )}

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 mt-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.result_url && (
                      <a
                        href={task.result_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <span>🔗 Link Hasil Kerja</span>
                      </a>
                    )}

                    {/* Send Reminder button for Coordinators/Admins on Active tasks */}
                    {canReview && activeTab === 'ACTIVE' && (task.assignment_id || task.id) && (
                      <SendReminderButton
                        assignmentId={task.assignment_id || task.id}
                        mentorName={task.creator_name}
                      />
                    )}
                  </div>

                  <Link
                    href={
                      task.workspace_id
                        ? `/dashboard/workspace/${task.workspace_id}`
                        : `/dashboard/projects/${task.project_id}`
                    }
                    className="text-[11px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900/60 px-3.5 py-1.5 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-xs flex items-center gap-1"
                  >
                    <span>Open Task</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
