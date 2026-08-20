'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TaskActions from '@/modules/tasks/components/TaskActions';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import TiptapEditor, { DocxDocumentViewer } from '@/components/editor/TiptapEditor';
import TaskAssignmentPanel from './TaskAssignmentPanel';
import { updateTask, deleteTask } from '@/modules/tasks/actions';

import EditTaskMultiplierModal from '@/modules/tasks/components/EditTaskMultiplierModal';
import { ExtendDeadlineModal } from '@/components/ExtendDeadlineModal';
import { formatDatetimeLocalInput } from '@/lib/dateUtils';

interface TaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  assignment_role: string;
  status: string;
  result_url: string | null;
  revision_note: string | null;
  submitted_at: number | null;
  user_name: string | null;
  lead_approved?: number;
  mentor_approved?: number;
  coordinator_approved?: number;
  deadline?: number | null;
}


interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: number | null;
  extended_deadline?: number | null;
  start_at?: number | null;
  created_at: number;
  created_by?: string | null;
  task_type: string;
  parent_task_id: string | null;
  sparks_multiplier?: number;
}

interface Member {
  userId: string;
  userName: string | null;
  userEmail: string;
  teamRoles: ('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR')[];
}

interface UserRow {
  id: string;
  name: string;
}

interface TaskAccordionProps {
  tasks: TaskRow[];
  workspaceType?: string;
  assignmentsByTask: Record<string, TaskAssignment[]>;
  currentUserId: string;
  canDeleteTask: boolean;
  canAssignTask: boolean;
  isLeader: boolean;
  isMentor: boolean;
  isCoordinator: boolean;
  isOjtWorkspace: boolean;
  users: UserRow[];
  members: Member[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:              { label: 'Draft',              color: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' },
  SUBMITTED:          { label: 'Submitted',          color: 'text-orange-600 dark:text-orange-400 bg-orange-500/5 border-orange-500/15' },
  WAITING_REVIEW:     { label: 'Waiting Review',     color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 border-yellow-500/15' },
  REVISION_REQUESTED: { label: 'Revision Requested', color: 'text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/15' },
  RESUBMITTED:        { label: 'Resubmitted',        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/15' },
  APPROVED:           { label: 'Approved',           color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/15' },
  LOCKED:             { label: 'Locked',             color: 'text-zinc-700 dark:text-zinc-300 bg-zinc-500/10 border-zinc-500/20' },
  PUBLISHED:          { label: 'Published (Done)',   color: 'text-purple-600 dark:text-purple-400 bg-purple-500/5 border-purple-500/15' },
  ARCHIVED:           { label: 'Archived',           color: 'text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800' },
  DECLINED:           { label: 'Declined',           color: 'text-red-800 dark:text-red-500 bg-red-800/10 border-red-800/20' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW:    { label: 'Low',    color: 'text-zinc-400' },
  NORMAL: { label: 'Normal', color: 'text-zinc-500' },
  HIGH:   { label: 'High',   color: 'text-orange-500' },
  URGENT: { label: 'Urgent', color: 'text-red-500 font-black' },
};

function getBorderColor(status: string): string {
  if (['REVISION_REQUESTED', 'DECLINED'].includes(status))
    return 'border-red-500/20 dark:border-red-500/20';
  if (['WAITING_REVIEW'].includes(status))
    return 'border-yellow-500/15 dark:border-yellow-500/15';
  if (['APPROVED', 'LOCKED'].includes(status))
    return 'border-emerald-500/15 dark:border-emerald-500/15';
  if (['PUBLISHED'].includes(status))
    return 'border-purple-500/15 dark:border-purple-500/15';
  return 'border-zinc-200/80 dark:border-zinc-800/80';
}

function getTaskDeadlineBadge(deadline: number | null, status: string, extendedDeadline?: number | null) {
  const activeDeadline = Math.max(extendedDeadline || 0, deadline || 0) || null;
  if (!activeDeadline) return null;
  const isFinished = ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE', 'COMPLETED', 'ARCHIVED'].includes(status);
  const now = Date.now();
  const diffDays = Math.ceil((activeDeadline - now) / (1000 * 60 * 60 * 24));
  const dateStr = new Date(activeDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

  if (isFinished) {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        ✅ Selesai: {dateStr}
      </span>
    );
  }

  if (extendedDeadline && extendedDeadline > (deadline || 0)) {
    const daysLate = deadline && now > deadline ? Math.ceil((now - deadline) / (24 * 3600 * 1000)) : 0;
    const penalty = Math.min(100, daysLate * 10);
    const hText = daysLate > 0 ? `H+${daysLate}` : 'Extend';

    if (diffDays < 0) {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse">
          ⚠️ Extend Melewati Deadline ({dateStr})
        </span>
      );
    }

    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 font-mono">
        <span>⏳ Extended ({hText} • Sparks -{penalty}%)</span>
        <span className="text-[9px] font-normal opacity-80">({dateStr})</span>
      </span>
    );
  }

  if (diffDays < 0) {
    const lateDays = Math.abs(diffDays);
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse">
        ⚠️ Terlambat {lateDays} hr ({dateStr})
      </span>
    );
  } else if (diffDays === 0) {
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        ⏳ Jatuh Tempo Hari Ini ({dateStr})
      </span>
    );
  } else if (diffDays <= 3) {
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
        ⏱️ H-{diffDays} ({dateStr})
      </span>
    );
  } else {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
        📅 Deadline: {dateStr}
      </span>
    );
  }
}

export default function TaskAccordion({
  tasks,
  workspaceType,
  assignmentsByTask,
  currentUserId,
  canDeleteTask,
  canAssignTask,
  isLeader,
  isMentor,
  isCoordinator,
  isOjtWorkspace,
  users,
  members,
}: TaskAccordionProps) {
  const searchParams = useSearchParams();
  const targetTaskId = searchParams ? searchParams.get('taskId') : null;

  // Target task open if in URL searchParams, otherwise ALL tasks start collapsed
  const [openTaskId, setOpenTaskId] = useState<string | null>(targetTaskId || null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [extendTask, setExtendTask] = useState<TaskRow | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [multiplierTask, setMultiplierTask] = useState<TaskRow | null>(null);

  useEffect(() => {
    if (targetTaskId) {
      setOpenTaskId(targetTaskId);
      const timer = setTimeout(() => {
        const el = document.getElementById(`task_card_${targetTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [targetTaskId]);

  const toggle = (id: string) => {
    setOpenTaskId((prev) => (prev === id ? null : id));
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.deadline && !b.deadline) return a.created_at - b.created_at;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline - b.deadline;
  });

  return (
    <div className="space-y-3">
      {sortedTasks.map((task) => {
        const isOpen = openTaskId === task.id;
        const isTarget = targetTaskId === task.id;
        const taskAssignments = assignmentsByTask[task.id] ?? [];
        const cfg = statusConfig[task.status] ?? statusConfig.DRAFT;
        const pCfg = priorityConfig[task.priority] ?? priorityConfig.NORMAL;
        const borderColor = isTarget
          ? 'border-purple-500 ring-2 ring-purple-500 shadow-xl shadow-purple-500/20'
          : getBorderColor(task.status);
        const totalTaskSparks = taskAssignments.reduce((acc, a) => acc + ((a as any).sparks || 0), 0);

        return (
          <div
            key={task.id}
            id={`task_card_${task.id}`}
            className={`border bg-white dark:bg-[#09090b]/40 rounded-3xl shadow-sm overflow-hidden transition-all duration-300 ${borderColor}`}
          >
              {/* Accordion Header — always visible, click to toggle */}
              <button
                type="button"
                onClick={() => toggle(task.id)}
                className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 group hover:bg-zinc-50/60 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${pCfg.color}`}>
                      {pCfg.label}
                    </span>
                    {/* Output Type Badge (Design vs Video) */}
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                      task.task_type === 'VIDEO'
                        ? 'text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/20'
                        : 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20'
                    }`}>
                      {task.task_type === 'VIDEO' ? '🎬 Video Task' : '🎨 Design Task'}
                    </span>
                    {(task.task_type === 'DIRECT_BRIEF' || (task.description && task.description.includes('[DIRECT_BRIEF]'))) && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <span>⚡</span> Brief Direct Koordinator
                      </span>
                    )}
                    {totalTaskSparks > 0 && (
                      <span className="text-[10px] font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <span>✨</span> {totalTaskSparks} Total Sparks
                      </span>
                    )}
                    {task.start_at && (
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                        task.start_at > Date.now()
                          ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/20 font-bold'
                          : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                      }`}>
                        <span>📅</span>
                        <span>Mulai: {new Date(task.start_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}</span>
                        {task.start_at > Date.now() && <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.2 rounded-full">Dijadwalkan</span>}
                      </span>
                    )}
                    {task.parent_task_id && (
                      <span className="text-[8px] font-bold text-amber-600 bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/10">
                        🔒 Sequential Lock
                      </span>
                    )}
                  </div>

                {/* Title */}
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors break-words">
                  {task.title}
                </h3>

                {/* Description — only show when collapsed */}
                {!isOpen && task.description && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate leading-relaxed">
                    {task.description.replace(/\[DIRECT_BRIEF\]/g, '').replace(/<[^>]*>/g, '').trim()}
                  </p>
                )}
              </div>

              {/* Far right side: Task Deadline Badge + Multiplier Badge + Edit/Delete Buttons + chevron */}
              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/50 shrink-0">
                {task.sparks_multiplier && task.sparks_multiplier > 1.0 && (
                  <span
                    onClick={(e) => {
                      if (isCoordinator) {
                        e.stopPropagation();
                        setMultiplierTask(task);
                      }
                    }}
                    title={isCoordinator ? "Set Sparks Multiplier Khusus Task" : "Sparks Multiplier Khusus Task"}
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 font-mono transition-all ${
                      isCoordinator ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                    }`}
                  >
                    ⚡ {task.sparks_multiplier}x
                  </span>
                )}

                {getTaskDeadlineBadge(task.deadline, task.status, task.extended_deadline)}

                {(workspaceType === 'MENTOR' ? isCoordinator : (canDeleteTask || isLeader || isMentor || isCoordinator || (task.created_by != null && task.created_by === currentUserId))) && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setExtendTask(task)}
                      title="Extend Deadline Task (Admin/Koordinator/Pembuat Task)"
                      className="w-7 h-7 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all flex items-center justify-center text-xs shrink-0 cursor-pointer"
                    >
                      ⏳
                    </button>
                    {isCoordinator && (
                      <button
                        type="button"
                        onClick={() => setMultiplierTask(task)}
                        title="Set Sparks Multiplier Khusus Task (Koordinator/Admin)"
                        className="w-7 h-7 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all flex items-center justify-center text-xs font-black"
                      >
                        ⚡
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingTask(task)}
                      title="Edit Tugas"
                      className="w-7 h-7 rounded-xl bg-zinc-100/80 hover:bg-purple-500/10 dark:bg-zinc-800/80 dark:hover:bg-purple-500/20 text-zinc-400 hover:text-purple-500 transition-all flex items-center justify-center text-xs"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingTaskId(task.id)}
                      title="Hapus Tugas"
                      className="w-7 h-7 rounded-xl bg-zinc-100/80 hover:bg-red-500/10 dark:bg-zinc-800/80 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                )}

                <span
                  className={`text-zinc-400 dark:text-zinc-600 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : 'rotate-0'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </button>

            {/* Accordion Body — collapsible */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                isOpen ? 'max-h-[9999px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              {(() => {
                const isDirectBriefTask = task.task_type === 'DIRECT_BRIEF' || Boolean(task.description && task.description.includes('[DIRECT_BRIEF]'));
                return (
                  <>
                    <div className="px-5 pb-5">
                      {/* Description & Brief Viewer Container when expanded */}
                      {task.description && (
                        <div className="mb-4">
                          <DocxDocumentViewer
                            content={task.description.replace('[DIRECT_BRIEF]', '')}
                            docTitle="Brief / Instruksi Pengerjaan"
                            roleName={isDirectBriefTask ? "Brief Direct Koordinator" : "Catatan & Instruksi Tugas"}
                            badgeText={isDirectBriefTask ? "⚡ Brief Direct" : "Brief Active"}
                          />
                        </div>
                      )}
                      {/* Assignments + Actions */}
                      <TaskActions
                        taskId={task.id}
                        taskTitle={task.title}
                        taskDeadline={task.deadline}
                        taskExtendedDeadline={task.extended_deadline}
                        taskType={task.task_type}
                        taskDescription={task.description}
                        isDirectBrief={isDirectBriefTask}
                        workspaceType={workspaceType}
                        assignments={taskAssignments}
                        currentUserId={currentUserId}
                        canDelete={canDeleteTask}
                        isLeader={isLeader}
                        isMentor={isMentor}
                        isCoordinator={isCoordinator}
                        isOjt={isOjtWorkspace}
                      />
                    </div>

                    {/* Assignment Panel — Leader/Mentor only (Not needed for Direct Brief Tasks) */}
                    {canAssignTask && !isDirectBriefTask && (
                      <div className="border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 px-5 py-4">
                        <TaskAssignmentPanel
                          taskId={task.id}
                          taskType={task.task_type}
                          taskDeadline={task.deadline}
                          existingAssignments={taskAssignments}
                          users={users}
                          members={members}
                          isOjt={isOjtWorkspace}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })}
      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Edit Task Multiplier Modal */}
      {multiplierTask && (
        <EditTaskMultiplierModal
          taskId={multiplierTask.id}
          taskTitle={multiplierTask.title}
          currentMultiplier={multiplierTask.sparks_multiplier || 1.0}
          isOpen={!!multiplierTask}
          onClose={() => setMultiplierTask(null)}
          onSuccess={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}

      {/* Extend Task Deadline Modal */}
      {extendTask && (
        <ExtendDeadlineModal
          taskId={extendTask.id}
          taskTitle={extendTask.title}
          currentDeadline={extendTask.deadline}
          currentExtendedDeadline={extendTask.extended_deadline}
          isOpen={!!extendTask}
          onClose={() => setExtendTask(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-md bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-2xl mx-auto">
              ⚠️
            </div>
            <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
              Hapus Tugas Ini?
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Tugas ini beserta seluruh penugasannya akan dihapus dari sistem.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTaskId(null)}
                className="flex-1 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteTask(deletingTaskId);
                  setDeletingTaskId(null);
                }}
                className="flex-1 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-md shadow-red-500/20"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit Task Modal ───────────────────────────────────────────────────────────

function EditTaskModal({
  task,
  onClose,
}: {
  task: TaskRow;
  onClose: () => void;
}) {
  const [priority, setPriority] = useState(task.priority || 'NORMAL');
  const [outputType, setOutputType] = useState(task.task_type || 'DESIGN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawDesc = task.description ?? '';
  const isDirectBrief = rawDesc.includes('[DIRECT_BRIEF]') || task.task_type === 'DIRECT_BRIEF';
  const initialHtml = rawDesc.replace(/^\[DIRECT_BRIEF\]\s*/i, '');
  const [description, setDescription] = useState(initialHtml);

  const defaultStartAt = formatDatetimeLocalInput(task.start_at);
  const defaultDeadline = formatDatetimeLocalInput(task.deadline);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set('priority', priority);
    formData.set('outputType', outputType);

    const finalDescription = isDirectBrief
      ? `[DIRECT_BRIEF]\n${description}`
      : description;
    formData.set('description', finalDescription);

    try {
      const res = await updateTask(task.id, formData);
      if (res.success) {
        onClose();
      } else {
        setError(res.error ?? 'Gagal memperbarui tugas.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-5xl xl:max-w-6xl max-h-[92vh] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl my-auto text-left flex flex-col overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 px-6 sm:px-8 py-4.5 shrink-0 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold">
              ✏️
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Edit Tugas</span>
                {isDirectBrief && (
                  <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full uppercase">
                    ⚡ Brief Direct Koordinator
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Perbarui judul, instruksi brief, tenggat waktu, atau tanggal mulai tugas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center text-sm transition-all cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="edit-task-form" onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 scroll-smooth">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 font-medium">
              ⚠️ {error}
            </p>
          )}

          {/* Grid Layout: Left Meta Fields, Right Tiptap Editor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Judul Tugas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={task.title}
                  required
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Tanggal & Jam Mulai (Start Date)
                </label>
                <input
                  type="datetime-local"
                  name="start_at"
                  defaultValue={defaultStartAt}
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3.5 py-3 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Tenggat Waktu (Deadline) <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="deadline"
                  defaultValue={defaultDeadline}
                  required
                  onClick={(e) => {
                    try { e.currentTarget.showPicker?.(); } catch {}
                  }}
                  className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3.5 py-3 focus:outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            </div>

            {/* Tiptap Editor Column */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Brief / Instruksi Pengerjaan
              </label>
              <TiptapEditor
                value={description}
                onChange={setDescription}
                placeholder="Edit rincian brief tugas dengan format lengkap..."
                minHeight="min-h-[350px]"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions Bar */}
        <div className="flex items-center justify-end gap-3 px-6 sm:px-8 py-4 border-t border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-zinc-50/50 dark:bg-[#09090b] z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form="edit-task-form"
            disabled={loading}
            className="px-8 py-2.5 text-xs font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-60 cursor-pointer active:scale-[0.98]"
          >
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}

