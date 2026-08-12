'use client';

import { useState } from 'react';
import Link from 'next/link';
import SendReminderButton from '@/components/SendReminderButton';
import { cleanAppreciationNote } from '@/lib/noteUtils';

export interface PersonalTaskRow {
  id: string; // task_id
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

export interface GroupedTask {
  id: string; // task_id
  title: string;
  project_id: string;
  project_name: string;
  workspace_id: string | null;
  deadline: number | null;
  creator_name?: string | null;
  assignments: PersonalTaskRow[];
}

interface DashboardPersonalWorkspaceProps {
  personalTasks: PersonalTaskRow[];
  trooperTasks?: PersonalTaskRow[];
  mentorTasks?: PersonalTaskRow[];
  completedTasks?: PersonalTaskRow[];
  userType: string;
  canReview: boolean;
  widgetTitle: string;
  widgetDesc: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80',
  ASSIGNED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  SUBMITTED: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  WAITING_REVIEW: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  REVISION_REQUESTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  RESUBMITTED: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  DONE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  LOCKED: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
  PUBLISHED: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  ARCHIVED: 'bg-zinc-500/5 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800',
};

const roleIcons: Record<string, string> = {
  RESEARCHER: '🔬 RESEARCHER',
  PLANNER: '📋 PLANNER',
  DESIGNER: '🎨 DESIGNER',
  CREATOR: '💡 CREATOR',
  VIDEO_EDITOR: '🎬 VIDEO EDITOR',
  PIC: '👑 PIC',
  REVIEWER: '👁️ REVIEWER',
  APPROVER: '✅ APPROVER',
  HELPER: '🤝 HELPER',
};

const roleBadgeStyles: Record<string, string> = {
  RESEARCHER: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
  PLANNER: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  DESIGNER: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  CREATOR: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
  VIDEO_EDITOR: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
  PIC: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  REVIEWER: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  APPROVER: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  HELPER: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
};

function groupTasksByParent(rows: PersonalTaskRow[]): GroupedTask[] {
  const map = new Map<string, GroupedTask>();

  for (const row of rows || []) {
    const taskId = row.id;
    if (!map.has(taskId)) {
      map.set(taskId, {
        id: taskId,
        title: row.title,
        project_id: row.project_id,
        project_name: row.project_name,
        workspace_id: row.workspace_id,
        deadline: row.deadline,
        creator_name: row.creator_name,
        assignments: [],
      });
    }

    const item = map.get(taskId)!;
    const exists = item.assignments.some(
      (a) =>
        (row.assignment_id && a.assignment_id === row.assignment_id) ||
        (!row.assignment_id && a.assignment_role === row.assignment_role && a.assigned_name === row.assigned_name)
    );

    if (!exists) {
      item.assignments.push(row);
    }
  }

  return Array.from(map.values());
}

export default function DashboardPersonalWorkspace({
  personalTasks = [],
  trooperTasks = [],
  mentorTasks = [],
  completedTasks = [],
  userType,
  canReview,
  widgetTitle,
  widgetDesc,
}: DashboardPersonalWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'TROOPER' | 'MENTOR' | 'COMPLETED'>('ACTIVE');

  const isCoordinator = userType === 'STAFF' || canReview;
  const isMentorUser = userType === 'EXTERNAL' || userType === 'CREATOR';

  // Group task assignments by parent task
  const activeGrouped = groupTasksByParent(personalTasks);
  const trooperGrouped = groupTasksByParent(trooperTasks);
  const mentorGrouped = groupTasksByParent(mentorTasks);
  const completedGrouped = groupTasksByParent(completedTasks);

  let displayedGroupedTasks = activeGrouped;
  if (activeTab === 'TROOPER') displayedGroupedTasks = trooperGrouped;
  if (activeTab === 'MENTOR') displayedGroupedTasks = mentorGrouped;
  if (activeTab === 'COMPLETED') displayedGroupedTasks = completedGrouped;

  return (
    <div className="space-y-4">
      {/* Header & Category Filter Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {widgetTitle}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{widgetDesc}</p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex-wrap">
          {/* Tab 1: Task Aktif / All Task */}
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <span>📌 {isCoordinator ? 'All Active Tasks' : 'Task Aktif'}</span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-[10px] font-mono font-bold">
              {activeGrouped.length} Task
            </span>
          </button>

          {/* Tab 2: Troopers Task (Visible for Coordinator & Mentor) */}
          {(isCoordinator || isMentorUser) && (
            <button
              type="button"
              onClick={() => setActiveTab('TROOPER')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TROOPER'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <span>👥 Troopers Task</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-[10px] font-mono font-bold">
                {trooperGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 3: Mentor Task (Visible ONLY for Coordinator/Admin) */}
          {isCoordinator && (
            <button
              type="button"
              onClick={() => setActiveTab('MENTOR')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'MENTOR'
                  ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <span>🎓 Mentor Task</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-[10px] font-mono font-bold">
                {mentorGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 4: Selesai & ACC */}
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
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-[10px] font-mono font-bold">
              {completedGrouped.length} Task
            </span>
          </button>
        </div>
      </div>

      {displayedGroupedTasks.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-10 text-center text-zinc-500 text-sm">
          {activeTab === 'ACTIVE'
            ? '🎉 Tidak ada penugasan aktif menggantung saat ini.'
            : activeTab === 'TROOPER'
            ? '👥 Tidak ada tugas Troopers yang sedang berjalan.'
            : activeTab === 'MENTOR'
            ? '🎓 Tidak ada tugas Mentor yang menggantung.'
            : '📂 Belum ada penugasan yang selesai / di-ACC.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedGroupedTasks.map((parentTask, pIdx) => {
            const totalRoles = parentTask.assignments.length;
            const submittedRoles = parentTask.assignments.filter((a) =>
              ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'DONE'].includes(a.status)
            ).length;
            const approvedRoles = parentTask.assignments.filter((a) =>
              ['APPROVED', 'DONE', 'PUBLISHED'].includes(a.status)
            ).length;

            return (
              <div
                key={`${activeTab}-${parentTask.id}-${pIdx}`}
                className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 p-5 rounded-2xl space-y-4 transition-all duration-300 shadow-xs"
              >
                {/* Task Header */}
                <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/60 pb-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                        {parentTask.project_name}
                      </span>
                      {parentTask.creator_name && (
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          • 🎓 Mentor: <strong className="text-zinc-800 dark:text-zinc-200">{parentTask.creator_name}</strong>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      {parentTask.title}
                    </h3>
                  </div>

                  {/* Task Progress Summary & Deadline */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                      📊 Progress: {approvedRoles}/{totalRoles} ACC ({submittedRoles} Submitted)
                    </span>
                    {parentTask.deadline && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Deadline: {new Date(parentTask.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-Tasks / Roles List Inside This Task */}
                <div className="space-y-2.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Kategori Sub-Task & Troopers ({totalRoles} Role):
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {parentTask.assignments.map((sub, sIdx) => {
                      const cleanedNote = cleanAppreciationNote(sub.appreciation_note);
                      const assignId = sub.assignment_id || sub.id;
                      const roleLabel = roleIcons[sub.assignment_role || ''] || sub.assignment_role || 'SUB-TASK';
                      const roleStyle = roleBadgeStyles[sub.assignment_role || ''] || 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20';

                      const isSubmittedForReview = ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(sub.status);
                      const isNotSubmittedYet = ['ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVISION_REQUESTED'].includes(sub.status);

                      return (
                        <div
                          key={`${sub.id}-${sub.assignment_role}-${sIdx}`}
                          className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 flex-wrap min-w-0">
                            {/* Role Badge */}
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${roleStyle}`}
                            >
                              {roleLabel}
                            </span>

                            {/* Assignee Trooper Name */}
                            {sub.assigned_name && (
                              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                                👤 {sub.assigned_name}
                              </span>
                            )}

                            {/* Status Badge */}
                            <span
                              className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${
                                statusColors[sub.status] ?? statusColors.DRAFT
                              }`}
                            >
                              {sub.status === 'APPROVED' ? '✅ ACC / Approved' : sub.status.replace('_', ' ')}
                            </span>

                            {/* Sparks Badge */}
                            {sub.sparks != null && sub.sparks > 0 && (
                              <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                                💎 +{sub.sparks} Sparks
                              </span>
                            )}
                          </div>

                          {/* Right Action Items for Sub-Task */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {sub.result_url && (
                              <a
                                href={sub.result_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                              >
                                <span>🔗 Link Hasil Karya</span>
                              </a>
                            )}

                            {/* Smart Reminder Buttons */}
                            {isCoordinator && activeTab !== 'COMPLETED' && assignId && (
                              <>
                                {isNotSubmittedYet && (
                                  <SendReminderButton
                                    assignmentId={assignId}
                                    targetRole="TROOPER"
                                    assigneeName={sub.assigned_name}
                                  />
                                )}
                                {(isNotSubmittedYet || isSubmittedForReview) && (
                                  <SendReminderButton
                                    assignmentId={assignId}
                                    targetRole="MENTOR"
                                    mentorName={parentTask.creator_name}
                                  />
                                )}
                              </>
                            )}
                          </div>

                          {/* Appreciation Note if approved */}
                          {['APPROVED', 'DONE', 'PUBLISHED'].includes(sub.status) && cleanedNote && (
                            <div className="w-full mt-1 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15">
                              <p className="text-[11px] text-zinc-700 dark:text-zinc-300 italic">
                                "💬 Feedback Evaluator: {cleanedNote}"
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Task Footer Link */}
                <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                  <Link
                    href={
                      parentTask.workspace_id
                        ? `/dashboard/workspace/${parentTask.workspace_id}`
                        : `/dashboard/projects/${parentTask.project_id}`
                    }
                    className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900 px-4 py-1.5 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-2xs flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200"
                  >
                    <span>Open Task Workspace</span>
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
