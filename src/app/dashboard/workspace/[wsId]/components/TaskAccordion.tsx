'use client';

import { useState } from 'react';
import TaskActions from '@/modules/tasks/components/TaskActions';
import TaskAssignmentPanel from './TaskAssignmentPanel';

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
  created_at: number;
  task_type: string;
  parent_task_id: string | null;
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

function getTaskDeadlineBadge(deadline: number | null, status: string) {
  if (!deadline) return null;
  const isFinished = ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE', 'COMPLETED', 'ARCHIVED'].includes(status);
  const now = Date.now();
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const dateStr = new Date(deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  if (isFinished) {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        📅 Task Selesai: {dateStr}
      </span>
    );
  }

  if (diffDays < 0) {
    const lateDays = Math.abs(diffDays);
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse">
        ⚠️ Task Terlambat {lateDays} hr ({dateStr})
      </span>
    );
  } else if (diffDays === 0) {
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        ⏳ Task Jatuh Tempo Hari Ini ({dateStr})
      </span>
    );
  } else if (diffDays <= 3) {
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
        ⏱️ Task H-{diffDays} ({dateStr})
      </span>
    );
  } else {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
        📅 Deadline Task: {dateStr}
      </span>
    );
  }
}

export default function TaskAccordion({
  tasks,
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
  // First task is open by default
  const [openTaskId, setOpenTaskId] = useState<string | null>(tasks[0]?.id ?? null);

  const toggle = (id: string) => {
    setOpenTaskId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const isOpen = openTaskId === task.id;
        const taskAssignments = assignmentsByTask[task.id] ?? [];
        const cfg = statusConfig[task.status] ?? statusConfig.DRAFT;
        const pCfg = priorityConfig[task.priority] ?? priorityConfig.NORMAL;
        const borderColor = getBorderColor(task.status);
        const totalTaskSparks = taskAssignments.reduce((acc, a) => acc + ((a as any).sparks || 0), 0);

        return (
          <div
            key={task.id}
            className={`border bg-white dark:bg-[#09090b]/40 rounded-3xl shadow-sm overflow-hidden transition-all duration-300 ${borderColor}`}
          >
              {/* Accordion Header — always visible, click to toggle */}
              <button
                type="button"
                onClick={() => toggle(task.id)}
                className="w-full text-left p-5 flex items-start justify-between gap-3 group hover:bg-zinc-50/60 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${pCfg.color}`}>
                      {pCfg.label}
                    </span>
                    {totalTaskSparks > 0 && (
                      <span className="text-[10px] font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <span>✨</span> {totalTaskSparks} Total Sparks
                      </span>
                    )}
                    {task.parent_task_id && (
                      <span className="text-[8px] font-bold text-amber-600 bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/10">
                        🔒 Sequential Lock
                      </span>
                    )}
                  </div>

                {/* Title */}
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                  {task.title}
                </h3>

                {/* Description — only show when collapsed */}
                {!isOpen && task.description && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Far right side: Task Deadline Badge + chevron */}
              <div className="flex items-center gap-2.5 shrink-0 self-center">
                {getTaskDeadlineBadge(task.deadline, task.status)}
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
              <div className="px-5 pb-5">
                {/* Description when expanded */}
                {task.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
                    {task.description}
                  </p>
                )}
                {/* Assignments + Actions */}
                <TaskActions
                  taskId={task.id}
                  taskType={task.task_type}
                  assignments={taskAssignments}
                  currentUserId={currentUserId}
                  canDelete={canDeleteTask}
                  isLeader={isLeader}
                  isMentor={isMentor}
                  isCoordinator={isCoordinator}
                  isOjt={isOjtWorkspace}
                />
              </div>

              {/* Assignment Panel — Leader/Mentor only */}
              {canAssignTask && (
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

            </div>
          </div>
        );
      })}
    </div>
  );
}

