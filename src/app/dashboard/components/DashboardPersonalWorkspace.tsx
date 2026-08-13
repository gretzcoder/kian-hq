'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TaskSmartReminderButton } from '@/components/SendReminderButton';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';
import { cleanAppreciationNote } from '@/lib/noteUtils';
import { CollapsibleNoteViewer } from '@/components/CollapsibleNoteViewer';

export interface RawAssignmentRow {
  id: string;
  task_id: string;
  user_id: string;
  assigned_name: string | null;
  assigned_email: string | null;
  assignment_role: string;
  status: string;
  result_url: string | null;
  revision_note: string | null;
  appreciation_note: string | null;
  revision_requested_by_name?: string | null;
  revision_requested_by_role?: string | null;
  sparks: number | null;
  mentor_approved?: number | null;
  coordinator_approved?: number | null;
  lead_approved?: number | null;
  submitted_at: number | null;
  reviewed_at: number | null;

  // Joined task metadata
  task_title: string;
  task_type: string;
  task_status: string;
  task_created_by: string | null;
  creator_name: string | null;
  project_id: string;
  project_name: string;
  workspace_id: string | null;
  deadline: number | null;
  start_at: number | null;
}

export interface GroupedTask {
  id: string; // parent task_id
  title: string;
  task_type: string;
  status: string;
  task_created_by: string | null;
  creator_name: string | null;
  project_id: string;
  project_name: string;
  workspace_id: string | null;
  deadline: number | null;
  start_at: number | null;
  assignments: RawAssignmentRow[];
}

const roleIcons: Record<string, string> = {
  RESEARCHER: '🔍 Research',
  PLANNER: '🧠 Planning',
  CREATOR: '💡 Content',
  DESIGNER: '🎨 Design',
  VIDEO_EDITOR: '🎬 Video',
};

const roleBadgeStyles: Record<string, string> = {
  RESEARCHER: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  PLANNER: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  CREATOR: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  DESIGNER: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
  VIDEO_EDITOR: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
};

const ROLE_ORDER = ['RESEARCHER', 'PLANNER', 'CREATOR', 'DESIGNER', 'VIDEO_EDITOR'];

function groupTasksByParent(rawAssignments: any[]): GroupedTask[] {
  const map = new Map<string, GroupedTask>();

  for (const row of rawAssignments) {
    if (!row) continue;
    const taskId = row.task_id || row.id;
    if (!taskId) continue;

    if (!map.has(taskId)) {
      map.set(taskId, {
        id: taskId,
        title: row.title || row.task_title || 'Penugasan Tim',
        task_type: row.task_type || '',
        status: row.task_status || row.status || '',
        task_created_by: row.task_created_by || null,
        creator_name: row.creator_name || null,
        project_id: row.project_id || '',
        project_name: row.project_name || 'PROJECT',
        workspace_id: row.workspace_id || null,
        deadline: row.deadline || null,
        start_at: row.start_at || null,
        assignments: [],
      });
    }

    const item = map.get(taskId)!;
    item.assignments.push(row);
  }

  return Array.from(map.values());
}

function sortAssignments(assignments: RawAssignmentRow[]): RawAssignmentRow[] {
  return [...assignments].sort((a, b) => {
    const idxA = ROLE_ORDER.indexOf(a.assignment_role);
    const idxB = ROLE_ORDER.indexOf(b.assignment_role);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.assignment_role.localeCompare(b.assignment_role);
  });
}

function TaskCardItem({
  parentTask,
  isCoordinator,
  canReview = false,
  activeTab,
  currentUserId,
}: {
  parentTask: GroupedTask;
  isCoordinator: boolean;
  canReview?: boolean;
  activeTab: string;
  currentUserId?: string;
}) {
  const waitingReviewSteps = parentTask.assignments.filter((a) =>
    ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(a.status)
  );

  const revisionSteps = parentTask.assignments.filter(
    (a) => a.status === 'REVISION_REQUESTED'
  );

  const initialFilter =
    activeTab === 'REVIEW' && waitingReviewSteps.length > 0
      ? 'SUBMITTED'
      : activeTab.includes('REVISION') && revisionSteps.length > 0
      ? 'REVISION'
      : 'ALL';

  const [isExpanded, setIsExpanded] = useState(false);
  const [stepFilter, setStepFilter] = useState<'ALL' | 'SUBMITTED' | 'REVISION' | 'APPROVED' | 'UNSUBMITTED'>(initialFilter);
  const isTaskMentor =
    currentUserId != null &&
    (parentTask.task_created_by === currentUserId ||
      parentTask.assignments.some((a) => a.task_created_by === currentUserId));

  const sortedAssignments = sortAssignments(parentTask.assignments);
  const totalSteps = parentTask.assignments.length;

  const uniqueAssignees = Array.from(
    new Set(parentTask.assignments.map((a) => a.assigned_name).filter(Boolean))
  );

  const submittedSteps = parentTask.assignments.filter(
    (a) =>
      ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'DONE', 'PUBLISHED'].includes(a.status) ||
      (a.result_url && a.result_url.trim() !== '')
  );

  const approvedSteps = parentTask.assignments.filter((a) =>
    ['APPROVED', 'DONE', 'PUBLISHED'].includes(a.status)
  );

  const unsubmittedAssignments = parentTask.assignments.filter(
    (a) =>
      !['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'DONE', 'PUBLISHED'].includes(a.status) &&
      (!a.result_url || a.result_url.trim() === '')
  );

  const displayAssignments = sortedAssignments.filter((sub) => {
    if (stepFilter === 'SUBMITTED') return ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(sub.status);
    if (stepFilter === 'REVISION') return sub.status === 'REVISION_REQUESTED';
    if (stepFilter === 'APPROVED') return ['APPROVED', 'DONE', 'PUBLISHED'].includes(sub.status);
    if (stepFilter === 'UNSUBMITTED') return ['ASSIGNED', 'IN_PROGRESS', 'DRAFT'].includes(sub.status);

    // Contextual filtering based on activeTab when stepFilter === 'ALL'
    if (activeTab === 'REVIEW') {
      return ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(sub.status);
    }
    if (activeTab.includes('REVISION')) {
      return sub.status === 'REVISION_REQUESTED';
    }
    if (activeTab === 'COMPLETED') {
      return ['APPROVED', 'DONE', 'PUBLISHED'].includes(sub.status);
    }
    return true;
  });

  return (
    <div className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/50 hover:border-purple-500/30 p-3.5 sm:p-4 rounded-2xl space-y-2.5 transition-all duration-200 shadow-xs">
      {/* Main Top Row: Info Left, Actions Right */}
      <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="min-w-0 flex-1 space-y-1">
          {/* Project & Mentor Micro Tag */}
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="font-mono font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
              {parentTask.project_name}
            </span>
            {parentTask.creator_name && (
              <span className="text-zinc-400 font-medium">
                • 🎓 Mentor: <strong className="text-zinc-600 dark:text-zinc-300">{parentTask.creator_name}</strong>
              </span>
            )}
          </div>

          <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">
            {parentTask.title}
          </h3>
        </div>

        {/* Compact Right-Aligned Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 px-2.5 py-1 rounded-xl border border-purple-500/20 bg-purple-500/5 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>{isExpanded ? '▲ Sembunyikan' : `▼ Rincian (${totalSteps} Step)`}</span>
          </button>

          {isCoordinator && activeTab !== 'COMPLETED' && (unsubmittedAssignments.length > 0 || (waitingReviewSteps.length > 0 && !isTaskMentor)) && (
            <TaskSmartReminderButton
              taskId={parentTask.id}
              unsubmittedCount={unsubmittedAssignments.length}
              waitingReviewCount={waitingReviewSteps.length}
              mentorName={parentTask.creator_name}
            />
          )}

          <Link
            href={
              parentTask.workspace_id
                ? `/dashboard/workspace/${parentTask.workspace_id}`
                : `/dashboard/projects/${parentTask.project_id}`
            }
            className="text-xs border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-purple-600 hover:text-white px-3 py-1 rounded-xl transition-all font-bold flex items-center gap-1 text-zinc-800 dark:text-zinc-200 shadow-xs"
          >
            <span>Workspace</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Summary Status Badges Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-zinc-100 dark:border-zinc-800/50">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
            👥 {uniqueAssignees.length} Trooper ({totalSteps} Step)
          </span>

          {activeTab === 'COMPLETED' || approvedSteps.length === totalSteps ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              ✅ Selesai & Full ACC ({approvedSteps.length}/{totalSteps})
            </span>
          ) : (
            <>
              {approvedSteps.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                  ✓ {approvedSteps.length}/{totalSteps} ACC
                </span>
              )}
              {waitingReviewSteps.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 animate-pulse">
                  ⏳ {waitingReviewSteps.length} Step Perlu Review
                </span>
              )}
              {revisionSteps.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                  🔄 {revisionSteps.length} Perlu Revisi
                </span>
              )}
              {unsubmittedAssignments.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800">
                  ⚡ {unsubmittedAssignments.length} Belum Submit
                </span>
              )}
            </>
          )}
        </div>

        {parentTask.deadline && (
          <span className="text-[10px] text-zinc-400 font-mono">
            Deadline: {new Date(parentTask.deadline).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Expanded Workflow Detail Steps View */}
      {isExpanded && (
        <div className="space-y-2.5 pt-2.5 border-t border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Rincian Step Workflow ({totalSteps} Step):
            </p>
            {submittedSteps.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {[
                  { id: 'ALL', label: `Semua (${totalSteps})` },
                  ...(waitingReviewSteps.length > 0 ? [{ id: 'SUBMITTED', label: `📥 Review (${waitingReviewSteps.length})` }] : []),
                  ...(revisionSteps.length > 0 ? [{ id: 'REVISION', label: `🔄 Revisi (${revisionSteps.length})` }] : []),
                  ...(approvedSteps.length > 0 ? [{ id: 'APPROVED', label: `✅ ACC (${approvedSteps.length})` }] : []),
                  ...(unsubmittedAssignments.length > 0 && unsubmittedAssignments.length < totalSteps ? [{ id: 'UNSUBMITTED', label: `⚡ Belum (${unsubmittedAssignments.length})` }] : []),
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStepFilter(f.id as any)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                      stepFilter === f.id
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {displayAssignments.map((sub, sIdx) => {
              const cleanedNote = cleanAppreciationNote(sub.appreciation_note);
              const roleLabel = roleIcons[sub.assignment_role || ''] || sub.assignment_role || 'SUB-TASK';
              const roleStyle = roleBadgeStyles[sub.assignment_role || ''] || 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20';

              const isSubmittedForReview = ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(sub.status);
              const hasResultLink = sub.result_url && sub.result_url.trim() !== '';
              const isRevision = sub.status === 'REVISION_REQUESTED';

              return (
                <div
                  key={`${sub.id}-${sub.assignment_role}-${sIdx}`}
                  className={`p-2.5 rounded-xl border flex flex-col gap-2 transition-all ${
                    isRevision
                      ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30'
                      : isSubmittedForReview
                      ? sub.mentor_approved === 1
                        ? 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/30'
                        : 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                      : sub.status === 'APPROVED'
                      ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${roleStyle}`}>
                        {roleLabel}
                      </span>
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        {sub.assigned_name ?? 'Unassigned'}
                      </span>
                      {sub.assigned_email && (
                        <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                          ({sub.assigned_email})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {sub.status === 'APPROVED' ? (
                        <span className="text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                          ✅ ACC ({sub.sparks ?? 8} ✨)
                        </span>
                      ) : isRevision ? (
                        <span className="text-[10px] font-black bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 px-2 py-0.5 rounded-md">
                          🔄 Perlu Revisi
                        </span>
                      ) : isSubmittedForReview ? (
                        sub.mentor_approved === 1 ? (
                          <span className="text-[10px] font-black bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-md animate-pulse">
                            ⏳ Review Koordinator
                          </span>
                        ) : (
                          <span className="text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md animate-pulse">
                            ⏳ Review Mentor
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md">
                          ⚡ Belum Submit
                        </span>
                      )}
                    </div>
                  </div>

                  {hasResultLink && (
                    <div className="text-xs">
                      <SubmittedLinkPreviewer url={sub.result_url!} autoExpand={false} />
                    </div>
                  )}

                  {sub.revision_note && (
                    <CollapsibleNoteViewer
                      content={sub.revision_note}
                      type="REVISION"
                      authorName={sub.revision_requested_by_name || 'Evaluator QC'}
                      authorRole={sub.revision_requested_by_role || 'QC'}
                    />
                  )}

                  {cleanedNote && (
                    <CollapsibleNoteViewer
                      content={cleanedNote}
                      type="APPRECIATION"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPersonalWorkspace({
  personalTasks = [],
  trooperTasks = [],
  mentorTasks = [],
  reviewTasks = [],
  completedTasks = [],
  allRawTasks,
  currentUserId,
  userType = 'STAFF',
  roles = [],
  permissions = [],
  canReview: canReviewProp,
  widgetTitle = 'Personal Task Workspace',
  widgetDesc = 'Daftar penugasan aktif dan riwayat tugas Anda yang telah disetujui.',
}: {
  personalTasks?: any[];
  trooperTasks?: any[];
  mentorTasks?: any[];
  reviewTasks?: any[];
  completedTasks?: any[];
  allRawTasks?: any[];
  currentUserId: string;
  userType?: 'STAFF' | 'OJT' | 'EXTERNAL';
  roles?: string[];
  permissions?: string[];
  canReview?: boolean;
  widgetTitle?: string;
  widgetDesc?: string;
}) {
  const [activeTab, setActiveTab] = useState<string>('ACTIVE');

  const isCoordinator =
    userType === 'STAFF' &&
    (roles.includes('COORDINATOR') ||
      roles.includes('EXECUTIVE') ||
      permissions.includes('MANAGE') ||
      permissions.includes('ADMIN_SYSTEM'));

  const canReview = canReviewProp ?? (permissions.includes('TASK_REVIEW') || permissions.includes('MANAGE') || isCoordinator);
  const isMentorUser = roles.some((r) => r.toUpperCase().includes('MENTOR'));

  const rawList = allRawTasks || [
    ...personalTasks,
    ...trooperTasks,
    ...mentorTasks,
    ...reviewTasks,
    ...completedTasks,
  ];

  const mapById = new Map<string, any>();
  for (const item of rawList) {
    if (!item) continue;
    const assignKey =
      item.assignment_id ||
      (item.user_id && item.assignment_role ? `${item.task_id || item.id}-${item.user_id}-${item.assignment_role}` : item.id);
    if (assignKey) mapById.set(assignKey, item);
  }
  const combinedRawTasks = Array.from(mapById.values());

  // Group ALL raw assignments into complete GroupedTask objects FIRST.
  // This ensures parentTask.assignments ALWAYS retains all workflow steps (realtime live status).
  const allGroupedTasks = groupTasksByParent(combinedRawTasks);

  const nowUnix = Math.floor(Date.now() / 1000);

  // Helper to check if a GroupedTask belongs to a Mentor Workspace
  const isMentorGroupedTask = (gt: GroupedTask) =>
    gt.assignments.some(
      (t: any) =>
        t.workspace_type === 'MENTOR' ||
        t.task_type === 'MENTOR' ||
        (t.project_name && t.project_name.toUpperCase().includes('MENTOR'))
    ) || (gt.project_name && gt.project_name.toUpperCase().includes('MENTOR'));

  // Filter 1: Active Grouped Tasks (has active steps not fully completed)
  const activeGrouped = allGroupedTasks.filter((gt) =>
    gt.assignments.some(
      (t) =>
        (!t.start_at || t.start_at <= nowUnix) &&
        !['APPROVED', 'DONE', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(t.status)
    )
  );

  // Filter 2: Completed / Approved Grouped Tasks (all steps approved/completed)
  const completedGrouped = allGroupedTasks.filter((gt) =>
    gt.assignments.length > 0 &&
    gt.assignments.every((t) => ['APPROVED', 'DONE', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(t.status))
  );

  // Filter 3: Perlu Revisi untuk User Ini
  const myRevisionGrouped = allGroupedTasks.filter((gt) =>
    gt.assignments.some((t) => t.user_id === currentUserId && t.status === 'REVISION_REQUESTED')
  );

  // Filter 3b: Troopers Revisi
  const trooperRevisionGrouped = allGroupedTasks.filter(
    (gt) => !isMentorGroupedTask(gt) && gt.assignments.some((t) => t.status === 'REVISION_REQUESTED')
  );

  // Filter 3c: Mentor Revisi
  const mentorRevisionGrouped = allGroupedTasks.filter(
    (gt) => isMentorGroupedTask(gt) && gt.assignments.some((t) => t.status === 'REVISION_REQUESTED')
  );

  // Filter 3d: Troopers Task (active tasks in TROOPERS workspace)
  const trooperGrouped = activeGrouped.filter((gt) => !isMentorGroupedTask(gt));

  // Filter 3e: Mentor Task (active tasks in MENTOR workspace)
  const mentorGrouped = activeGrouped.filter((gt) => isMentorGroupedTask(gt));

  // Filter 4: Review Grouped Tasks (tasks that have at least 1 step waiting for review)
  const reviewGrouped = allGroupedTasks.filter((gt) =>
    gt.assignments.some((t) => ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(t.status))
  );

  // Filter 5: Task Plan (Dijadwalkan / Draft)
  const taskPlanGrouped = allGroupedTasks.filter((gt) =>
    gt.assignments.some((t) => (t.start_at && t.start_at > nowUnix) || t.status === 'DRAFT')
  );

  // Filter 6: Expired Task
  const expiredGrouped = allGroupedTasks.filter((gt) =>
    gt.deadline != null &&
    gt.deadline < nowUnix &&
    gt.assignments.some((t) => !['APPROVED', 'DONE', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(t.status))
  );

  let displayedGroupedTasks = activeGrouped;
  if (activeTab === 'MY_REVISION') displayedGroupedTasks = myRevisionGrouped;
  if (activeTab === 'TROOPER_REVISION') displayedGroupedTasks = trooperRevisionGrouped;
  if (activeTab === 'MENTOR_REVISION') displayedGroupedTasks = mentorRevisionGrouped;
  if (activeTab === 'TROOPER') displayedGroupedTasks = trooperGrouped;
  if (activeTab === 'MENTOR') displayedGroupedTasks = mentorGrouped;
  if (activeTab === 'REVIEW') displayedGroupedTasks = reviewGrouped;
  if (activeTab === 'TASK_PLAN') displayedGroupedTasks = taskPlanGrouped;
  if (activeTab === 'EXPIRED') displayedGroupedTasks = expiredGrouped;
  if (activeTab === 'COMPLETED') displayedGroupedTasks = completedGrouped;

  const tabsConfig = [
    {
      id: 'ACTIVE',
      label: isCoordinator ? 'All Active Tasks' : 'Task Aktif',
      icon: '📌',
      count: activeGrouped.length,
      show: true,
      accent: 'purple',
    },
    {
      id: 'MY_REVISION',
      label: 'Perlu Revisi Saya',
      icon: '⚠️',
      count: myRevisionGrouped.length,
      show: myRevisionGrouped.length > 0,
      accent: 'red',
    },
    {
      id: 'TROOPER_REVISION',
      label: 'Troopers Revisi',
      icon: '🔄',
      count: trooperRevisionGrouped.length,
      show: isCoordinator || isMentorUser || userType === 'STAFF',
      accent: 'rose',
    },
    {
      id: 'MENTOR_REVISION',
      label: 'Mentor Revisi',
      icon: '🎓',
      count: mentorRevisionGrouped.length,
      show: isCoordinator || userType === 'STAFF',
      accent: 'amber',
    },
    {
      id: 'TROOPER',
      label: 'Troopers Task',
      icon: '👥',
      count: trooperGrouped.length,
      show: isCoordinator || isMentorUser,
      accent: 'indigo',
    },
    {
      id: 'MENTOR',
      label: 'Mentor Task',
      icon: '🎓',
      count: mentorGrouped.length,
      show: isCoordinator,
      accent: 'amber',
    },
    {
      id: 'REVIEW',
      label: 'Perlu Di-Review',
      icon: '⏳',
      count: reviewGrouped.length,
      show: isCoordinator || isMentorUser,
      accent: 'orange',
    },
    {
      id: 'TASK_PLAN',
      label: 'Task Plan (Dijadwalkan)',
      icon: '📅',
      count: taskPlanGrouped.length,
      show: isCoordinator || userType === 'STAFF',
      accent: 'sky',
    },
    {
      id: 'EXPIRED',
      label: 'Expired Task',
      icon: '⏰',
      count: expiredGrouped.length,
      show: isCoordinator || userType === 'STAFF',
      accent: 'red',
    },
    {
      id: 'COMPLETED',
      label: 'Selesai & ACC',
      icon: '✅',
      count: completedGrouped.length,
      show: true,
      accent: 'emerald',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header & Sleek Single-Line Scrollable Category Filter Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {widgetTitle}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{widgetDesc}</p>
          </div>
        </div>

        {/* Sleek Horizontal Scrollable Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar text-xs">
          {tabsConfig
            .filter((t) => t.show)
            .map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap border ${
                    isActive
                      ? 'bg-purple-600 text-white border-purple-500 shadow-2xs font-extrabold'
                      : t.count > 0
                      ? 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/40 hover:text-purple-600 dark:hover:text-purple-400'
                      : 'bg-transparent text-zinc-400 hover:text-zinc-200 border-transparent'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-mono rounded-md font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Task List */}
      {displayedGroupedTasks.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-8 text-center text-zinc-500 text-sm">
          {activeTab === 'ACTIVE'
            ? '🎉 Tidak ada penugasan aktif menggantung saat ini.'
            : activeTab === 'MY_REVISION'
            ? '✨ Bagus! Tidak ada tugas Anda yang perlu direvisi saat ini.'
            : activeTab === 'TROOPER_REVISION'
            ? '👍 Mantap! Belum ada tugas troopers bimbingan yang meminta revisi.'
            : activeTab === 'TROOPER'
            ? '👥 Tidak ada tugas Troopers yang sedang berjalan.'
            : activeTab === 'MENTOR'
            ? '🎓 Tidak ada tugas Mentor yang menggantung.'
            : activeTab === 'REVIEW'
            ? '✨ Semua tugas telah ditinjau! Tidak ada tugas yang menunggu review.'
            : '📂 Belum ada penugasan yang selesai / di-ACC.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {displayedGroupedTasks.map((parentTask, pIdx) => (
            <TaskCardItem
              key={`${activeTab}-${parentTask.id}-${pIdx}`}
              parentTask={parentTask}
              isCoordinator={isCoordinator}
              canReview={canReview}
              activeTab={activeTab}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
