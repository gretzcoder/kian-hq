'use client';

import { useState } from 'react';
import Link from 'next/link';
import SendReminderButton, { TaskSmartReminderButton } from '@/components/SendReminderButton';
import { cleanAppreciationNote } from '@/lib/noteUtils';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';
import ReviewActions from '@/app/dashboard/review/components/ReviewActions';
import { submitResult } from '@/modules/tasks/actions';
import { useUI } from '@/components/ui/UIProvider';
import { CollapsibleNoteViewer } from '@/components/CollapsibleNoteViewer';

export interface PersonalTaskRow {
  id: string; // task_id
  assignment_id?: string;
  user_id?: string | null;
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
  mentor_approved?: number | null;
  coordinator_approved?: number | null;
  task_type?: string | null;
  task_created_by?: string | null;
  revision_note?: string | null;
  revision_requested_by_name?: string | null;
  revision_requested_by_role?: string | null;
  workspace_type?: string | null;
}

export interface GroupedTask {
  id: string; // task_id
  title: string;
  project_id: string;
  project_name: string;
  workspace_id: string | null;
  deadline: number | null;
  creator_name?: string | null;
  task_created_by?: string | null;
  assignments: PersonalTaskRow[];
}

interface DashboardPersonalWorkspaceProps {
  personalTasks: PersonalTaskRow[];
  trooperTasks?: PersonalTaskRow[];
  mentorTasks?: PersonalTaskRow[];
  reviewTasks?: PersonalTaskRow[];
  completedTasks?: PersonalTaskRow[];
  userType?: string;
  roles?: string[];
  canReview: boolean;
  widgetTitle: string;
  widgetDesc: string;
  currentUserId?: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80',
  ASSIGNED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  SUBMITTED: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  WAITING_REVIEW: 'bg-yellow-500/10 text-yellow-700 dark:text-amber-400 border-amber-500/20',
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

function sortAssignments(list: PersonalTaskRow[]): PersonalTaskRow[] {
  const priority: Record<string, number> = {
    REVISION_REQUESTED: 0,
    WAITING_REVIEW: 1,
    SUBMITTED: 1,
    RESUBMITTED: 1,
    APPROVED: 2,
    DONE: 2,
    PUBLISHED: 2,
    IN_PROGRESS: 3,
    ASSIGNED: 4,
    DRAFT: 5,
  };

  return [...list].sort((a, b) => {
    const pA = priority[a.status] ?? 99;
    const pB = priority[b.status] ?? 99;
    if (pA !== pB) return pA - pB;
    return (b.submitted_at || 0) - (a.submitted_at || 0);
  });
}

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
        task_created_by: row.task_created_by,
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

/**
 * Inline Resubmit Box Component for tasks requiring revision
 */
function InlineResubmitBox({
  assignmentId,
  currentResultUrl,
  revisionNote,
  revisionRequestedByName,
  revisionRequestedByRole,
}: {
  assignmentId: string;
  currentResultUrl?: string | null;
  revisionNote?: string | null;
  revisionRequestedByName?: string | null;
  revisionRequestedByRole?: string | null;
}) {
  const [resultUrl, setResultUrl] = useState(currentResultUrl || '');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useUI();

  const handleResubmit = async () => {
    if (!resultUrl.trim()) {
      toast('Harap masukkan tautan / URL hasil revisi terbaru.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await submitResult(assignmentId, resultUrl.trim());
      if (res.success) {
        setSubmitted(true);
        toast('Hasil revisi berhasil diajukan ulang! Menunggu review Mentor/Koordinator.', 'success');
      } else {
        toast(res.error || 'Gagal mengajukan revisi.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan saat submit.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
        <span>✓ Hasil revisi berhasil diajukan ulang! Halaman akan diperbarui otomatis.</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-amber-500/8 dark:bg-amber-500/15 border border-amber-500/30 space-y-4 shadow-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚡ Form Perbaikan & Submit Ulang Revisi</span>
        </span>
        <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
          Perlu Revisi
        </span>
      </div>

      {/* Styled Collapsible Revision Note Card */}
      {revisionNote && (
        <CollapsibleNoteViewer
          content={revisionNote}
          authorName={revisionRequestedByName || 'Koordinator / Evaluator QC'}
          authorRole={revisionRequestedByRole || 'Koordinator / Mentor QC'}
          badgeLabel="⚠️ Catatan Evaluator"
          type="REVISION"
        />
      )}

      {/* URL Input Form */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
          Masukkan Link Hasil Revisi Terbaru (Canva / Drive / Dokumen):
        </label>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="url"
            value={resultUrl}
            onChange={(e) => setResultUrl(e.target.value)}
            placeholder="https://canva.com/design/... atau https://drive.google.com/..."
            className="flex-1 min-w-[200px] px-3.5 py-2.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono shadow-2xs"
          />
          <button
            type="button"
            onClick={handleResubmit}
            disabled={loading || !resultUrl.trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>{loading ? '⏳ Mengirim...' : '🚀 Ajukan Ulang Revisi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [stepFilter, setStepFilter] = useState<'ALL' | 'SUBMITTED' | 'REVISION' | 'APPROVED' | 'UNSUBMITTED'>('ALL');
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

  const waitingReviewSteps = parentTask.assignments.filter((a) =>
    ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(a.status)
  );

  const approvedSteps = parentTask.assignments.filter((a) =>
    ['APPROVED', 'DONE', 'PUBLISHED'].includes(a.status)
  );

  const revisionSteps = parentTask.assignments.filter(
    (a) => a.status === 'REVISION_REQUESTED'
  );

  const unsubmittedAssignments = parentTask.assignments.filter(
    (a) =>
      !['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'DONE', 'PUBLISHED'].includes(a.status) &&
      (!a.result_url || a.result_url.trim() === '')
  );

  const activeSteps = parentTask.assignments.filter(
    (a) => a.status !== 'ASSIGNED' && a.status !== 'IN_PROGRESS' && a.status !== 'DRAFT'
  );

  const displayAssignments = sortedAssignments.filter((sub) => {
    if (stepFilter === 'SUBMITTED') return ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(sub.status);
    if (stepFilter === 'REVISION') return sub.status === 'REVISION_REQUESTED';
    if (stepFilter === 'APPROVED') return ['APPROVED', 'DONE', 'PUBLISHED'].includes(sub.status);
    if (stepFilter === 'UNSUBMITTED') return ['ASSIGNED', 'IN_PROGRESS', 'DRAFT'].includes(sub.status);
    return true;
  });

  return (
    <div className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 sm:p-5 rounded-2xl space-y-3.5 transition-all duration-300 shadow-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
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
            {waitingReviewSteps.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                ⏳ {waitingReviewSteps.length} Step Perlu Review
              </span>
            )}
          </div>
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {parentTask.title}
          </h3>
        </div>

        {/* Real-Time Statistics Badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeTab === 'COMPLETED' || approvedSteps.length === totalSteps ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
                ✅ Selesai & Full ACC ({approvedSteps.length}/{totalSteps})
              </span>
            ) : waitingReviewSteps.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                ⏳ {waitingReviewSteps.length} Step Perlu Review
              </span>
            ) : revisionSteps.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
                🔄 {revisionSteps.length} Step Perlu Revisi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                👥 {uniqueAssignees.length} Trooper ({totalSteps} Step)
              </span>
            )}
          </div>
          {parentTask.deadline && (
            <span className="text-[10px] text-zinc-400 font-mono">
              Deadline: {new Date(parentTask.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Step Quick Breakdown Summary Bar */}
      {activeTab === 'COMPLETED' || approvedSteps.length === totalSteps ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl flex items-center gap-1.5">
            <span>✅</span> Seluruh {totalSteps} Step Workflow telah disetujui & diberikan ACC
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {approvedSteps.length > 0 && (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
              ✓ {approvedSteps.length}/{totalSteps} ACC
            </span>
          )}
          {waitingReviewSteps.length > 0 && (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 animate-pulse">
              📥 {waitingReviewSteps.length} Submit (Wait QC)
            </span>
          )}
          {revisionSteps.length > 0 && (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
              🔄 {revisionSteps.length} Perlu Revisi
            </span>
          )}
          {unsubmittedAssignments.length > 0 && (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800">
              ⚡ {unsubmittedAssignments.length} Belum Submit
            </span>
          )}

          {/* Active chips ONLY for items that are submitted or in revision */}
          {activeSteps
            .filter((s) => s.status !== 'APPROVED')
            .slice(0, 5)
            .map((st, idx) => {
              const roleLabel = roleIcons[st.assignment_role || ''] || st.assignment_role || `Step ${idx + 1}`;
              const isRevision = st.status === 'REVISION_REQUESTED';

              return (
                <span
                  key={`quick-${st.id}-${idx}`}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5 ${
                    isRevision
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-black'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-black'
                  }`}
                >
                  <span>{roleLabel}</span>
                  {st.assigned_name && <span className="opacity-80">({st.assigned_name.split(' ')[0]})</span>}:
                  <strong className="uppercase font-mono">{st.status.replace('_', ' ')}</strong>
                </span>
              );
            })}
        </div>
      )}

      {/* Control Bar: Expand Detail, Smart Batch Reminder, Open Workspace */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-xl hover:bg-purple-500/10 bg-purple-500/5 transition-all border border-purple-500/10"
          >
            <span>
              {isExpanded
                ? '▲ Sembunyikan Rincian Step'
                : `▼ Lihat Rincian ${totalSteps} Step Workflow (${submittedSteps.length} Submit)`}
            </span>
          </button>

          {isCoordinator && activeTab !== 'COMPLETED' && (unsubmittedAssignments.length > 0 || (waitingReviewSteps.length > 0 && !isTaskMentor)) && (
            <TaskSmartReminderButton
              taskId={parentTask.id}
              unsubmittedCount={unsubmittedAssignments.length}
              waitingReviewCount={waitingReviewSteps.length}
              mentorName={parentTask.creator_name}
            />
          )}
        </div>

        <Link
          href={
            parentTask.workspace_id
              ? `/dashboard/workspace/${parentTask.workspace_id}`
              : `/dashboard/projects/${parentTask.project_id}`
          }
          className="text-xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-1.5 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-2xs flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200"
        >
          <span>Open Task Workspace</span>
          <span>&rarr;</span>
        </Link>
      </div>

      {/* Detail Workflow Steps View */}
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Detail Rincian Step & Status Pengerjaan ({totalSteps} Step Workflow):
            </p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { id: 'ALL', label: `Semua (${totalSteps})` },
                ...(waitingReviewSteps.length > 0 ? [{ id: 'SUBMITTED', label: `📥 Review (${waitingReviewSteps.length})` }] : []),
                ...(revisionSteps.length > 0 ? [{ id: 'REVISION', label: `🔄 Revisi (${revisionSteps.length})` }] : []),
                ...(approvedSteps.length > 0 ? [{ id: 'APPROVED', label: `✅ ACC (${approvedSteps.length})` }] : []),
                ...(unsubmittedAssignments.length > 0 ? [{ id: 'UNSUBMITTED', label: `⚡ Belum (${unsubmittedAssignments.length})` }] : []),
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStepFilter(f.id as any)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    stepFilter === f.id
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
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
                  className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
                    isRevision
                      ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30'
                      : isSubmittedForReview || hasResultLink
                      ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                      : 'bg-zinc-50/70 dark:bg-zinc-900/60 border-zinc-200/70 dark:border-zinc-800/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${roleStyle}`}>
                        {roleLabel}
                      </span>

                      {sub.assigned_name && (
                        <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                          👤 {sub.assigned_name}
                        </span>
                      )}

                      <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${statusColors[sub.status] ?? statusColors.DRAFT}`}>
                        {sub.status === 'APPROVED' ? '✅ ACC / Approved' : sub.status.replace('_', ' ')}
                      </span>

                      {sub.sparks != null && sub.sparks > 0 && (
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                          💎 +{sub.sparks} Sparks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submitted Content Link & Live Preview */}
                  {sub.result_url && (
                    <SubmittedLinkPreviewer url={sub.result_url} autoExpand={false} />
                  )}

                  {/* Inline Form Resubmit for REVISION_REQUESTED items (When viewing in MY_REVISION tab or by assigned user) */}
                  {isRevision && sub.assignment_id && activeTab === 'MY_REVISION' && (
                    <InlineResubmitBox
                      assignmentId={sub.assignment_id}
                      currentResultUrl={sub.result_url}
                      revisionNote={sub.revision_note}
                      revisionRequestedByName={sub.revision_requested_by_name}
                      revisionRequestedByRole={sub.revision_requested_by_role}
                    />
                  )}

                  {/* Styled Collapsible Revision Note Card when viewing under TROOPER_REVISION or outside MY_REVISION tab */}
                  {isRevision && sub.revision_note && activeTab !== 'MY_REVISION' && (
                    <CollapsibleNoteViewer
                      content={sub.revision_note}
                      authorName={sub.revision_requested_by_name || 'Koordinator / Evaluator QC'}
                      authorRole={sub.revision_requested_by_role || 'Koordinator / Mentor QC'}
                      badgeLabel="⚠️ Catatan Evaluator"
                      type="REVISION"
                    />
                  )}

                  {/* Inline QC Review Actions for WAITING_REVIEW items */}
                  {isSubmittedForReview && sub.assignment_id && (isCoordinator || canReview) && (
                    <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/60">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        ⚡ Quick Review / Persetujuan QC
                      </p>
                      <ReviewActions
                        assignmentId={sub.assignment_id}
                        canRequestRevision={true}
                        taskType={sub.task_type}
                        creatorName={sub.creator_name}
                        isStaffOrCoord={isCoordinator}
                        mentorApproved={sub.mentor_approved ?? 0}
                        coordinatorApproved={sub.coordinator_approved ?? 0}
                        isTaskMentor={isTaskMentor}
                        isMentorWs={sub.workspace_type === 'MENTOR' || sub.task_type === 'MENTOR' || isTaskMentor}
                      />
                    </div>
                  )}

                  {/* Collapsible Appreciation Note */}
                  {['APPROVED', 'DONE', 'PUBLISHED'].includes(sub.status) && cleanedNote && (
                    <CollapsibleNoteViewer
                      content={cleanedNote}
                      badgeLabel="✨ Apresiasi"
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
  userType,
  roles,
  canReview,
  widgetTitle,
  widgetDesc,
  currentUserId,
}: DashboardPersonalWorkspaceProps) {
  type DashboardTab =
    | 'ACTIVE'
    | 'MY_REVISION'
    | 'TROOPER_REVISION'
    | 'MENTOR_REVISION'
    | 'TROOPER'
    | 'MENTOR'
    | 'REVIEW'
    | 'TASK_PLAN'
    | 'EXPIRED'
    | 'COMPLETED';

  const [activeTab, setActiveTab] = useState<DashboardTab>('ACTIVE');

  const userRoles = roles || [];
  const isCoordinator =
    userRoles.includes('COORDINATOR') ||
    userRoles.includes('EXECUTIVE') ||
    userRoles.includes('ADMIN') ||
    userType === 'STAFF' ||
    canReview;

  const isMentorUser = userRoles.includes('MENTOR') || userType === 'EXTERNAL' || userType === 'CREATOR';
  const isTrooperUser = userRoles.includes('TROOPERS') || (!isCoordinator && !isMentorUser);

  const isMentorRow = (t: PersonalTaskRow) =>
    t.workspace_type === 'MENTOR' ||
    t.task_type === 'MENTOR' ||
    t.user_type === 'EXTERNAL' ||
    ['PIC', 'REVIEWER', 'APPROVER', 'HELPER', 'MENTOR'].includes(t.assignment_role || '');

  // Group task assignments by parent task
  const activeGrouped = groupTasksByParent(personalTasks);
  const trooperGrouped = groupTasksByParent(trooperTasks);
  const mentorGrouped = groupTasksByParent(mentorTasks);
  const reviewGrouped = groupTasksByParent(reviewTasks);
  const completedGrouped = groupTasksByParent(completedTasks);

  // Combine all raw assignment rows
  const allRawTasks = [...personalTasks, ...trooperTasks, ...mentorTasks, ...reviewTasks, ...completedTasks];

  const nowUnix = Math.floor(Date.now() / 1000);

  // Filter 1: Perlu Revisi (STRICTLY for the user assigned to perform/resubmit the revision: row.user_id === currentUserId)
  const myRevisionTasks = allRawTasks.filter((t) => {
    if (t.status !== 'REVISION_REQUESTED') return false;
    if (currentUserId && t.user_id) {
      return t.user_id === currentUserId;
    }
    return isTrooperUser && personalTasks.some((pt) => pt.id === t.id);
  });
  const myRevisionGrouped = groupTasksByParent(myRevisionTasks);

  // Filter 2: Troopers Revisi (For Mentors & Coordinators to track troopers' requested revisions: row.user_id !== currentUserId)
  const trooperRevisionTasks = allRawTasks.filter((t) => {
    if (t.status !== 'REVISION_REQUESTED') return false;
    if (isMentorRow(t)) return false;
    if (currentUserId && t.user_id) {
      return t.user_id !== currentUserId;
    }
    return !isTrooperUser;
  });
  const trooperRevisionGrouped = groupTasksByParent(trooperRevisionTasks);

  // Filter 3: Mentor Revisi (Revisions requested for tasks assigned to Mentors/PICs)
  const mentorRevisionTasks = allRawTasks.filter((t) => {
    if (t.status !== 'REVISION_REQUESTED') return false;
    return isMentorRow(t);
  });
  const mentorRevisionGrouped = groupTasksByParent(mentorRevisionTasks);

  // Filter 4: Task Plan (Dijadwalkan / Draft)
  const taskPlanTasks = allRawTasks.filter(
    (t) => (t.start_at && t.start_at > nowUnix) || t.status === 'DRAFT'
  );
  const taskPlanGrouped = groupTasksByParent(taskPlanTasks);

  // Filter 5: Expired Task (Deadline passed & not finished)
  const expiredTasks = allRawTasks.filter(
    (t) =>
      t.deadline != null &&
      t.deadline < nowUnix &&
      !['APPROVED', 'DONE', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(t.status)
  );
  const expiredGrouped = groupTasksByParent(expiredTasks);

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

          {/* Tab 2: Perlu Revisi (HANYA untuk user yang ditugaskan & harus melakukan revisi) */}
          {myRevisionGrouped.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('MY_REVISION')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'MY_REVISION'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-500/20'
                  : 'text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20'
              }`}
            >
              <span>⚠️ Perlu Revisi</span>
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-mono font-bold">
                {myRevisionGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 3: Troopers Revisi (Untuk Mentor & Koordinator memantau status revisi Troopers) */}
          {(isCoordinator || isMentorUser || userType === 'STAFF') && (
            <button
              type="button"
              onClick={() => setActiveTab('TROOPER_REVISION')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TROOPER_REVISION'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                  : trooperRevisionGrouped.length > 0
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <span>🔄 Troopers Revisi</span>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-[10px] font-mono font-bold">
                {trooperRevisionGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 4: Mentor Revisi (Untuk Koordinator/Admin memantau revisi tugas mentor/PIC) */}
          {(isCoordinator || userType === 'STAFF') && (
            <button
              type="button"
              onClick={() => setActiveTab('MENTOR_REVISION')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'MENTOR_REVISION'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                  : mentorRevisionGrouped.length > 0
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <span>🎓 Mentor Revisi</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-[10px] font-mono font-bold">
                {mentorRevisionGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 5: Troopers Task */}
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

          {/* Tab 6: Mentor Task */}
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

          {/* Tab 7: Perlu Di-Review */}
          {(isCoordinator || isMentorUser) && (
            <button
              type="button"
              onClick={() => setActiveTab('REVIEW')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'REVIEW'
                  ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <span>⏳ Perlu Di-Review</span>
              <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-[10px] font-mono font-bold">
                {reviewGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 8: Task Plan (Dijadwalkan) */}
          {(isCoordinator || userType === 'STAFF') && (
            <button
              type="button"
              onClick={() => setActiveTab('TASK_PLAN')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TASK_PLAN'
                  ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <span>📅 Task Plan (Dijadwalkan)</span>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-[10px] font-mono font-bold">
                {taskPlanGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 9: Expired Task */}
          {(isCoordinator || userType === 'STAFF') && (
            <button
              type="button"
              onClick={() => setActiveTab('EXPIRED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'EXPIRED'
                  ? 'bg-red-700 text-white shadow-sm shadow-red-600/20'
                  : expiredGrouped.length > 0
                  ? 'text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <span>⏰ Expired Task</span>
              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-[10px] font-mono font-bold">
                {expiredGrouped.length} Task
              </span>
            </button>
          )}

          {/* Tab 10: Selesai & ACC */}
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
        <div className="grid grid-cols-1 gap-4">
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
