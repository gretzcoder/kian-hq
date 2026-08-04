'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TaskAccordion from './TaskAccordion';
import { getWorkspaceTaskData, PollTaskRow, PollAssignmentRow } from '@/modules/workspaces/taskPollActions';

/** Poll interval when the tab is visible */
const POLL_INTERVAL_MS = 15_000;

interface UserRow {
  id: string;
  name: string;
}

interface LiveTaskAccordionProps {
  workspaceId: string;
  initialTasks: PollTaskRow[];
  initialAssignmentsByTask: Record<string, PollAssignmentRow[]>;
  currentUserId: string;
  canCreateTask: boolean;
  canDeleteTask: boolean;
  canAssignTask: boolean;
  isLeader: boolean;
  isMentor: boolean;
  isCoordinator: boolean;
  isOjtWorkspace: boolean;
  users: UserRow[];
  members: any[];
}

export function LiveTaskAccordion({
  workspaceId,
  initialTasks,
  initialAssignmentsByTask,
  currentUserId,
  canCreateTask,
  canDeleteTask,
  canAssignTask,
  isLeader,
  isMentor,
  isCoordinator,
  isOjtWorkspace,
  users,
  members,
}: LiveTaskAccordionProps) {
  const [tasks, setTasks] = useState<PollTaskRow[]>(initialTasks);
  const [assignmentsByTask, setAssignmentsByTask] = useState<Record<string, PollAssignmentRow[]>>(
    initialAssignmentsByTask
  );
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  const fetchLatest = useCallback(async () => {
    // Don't fetch while tab is hidden — saves D1 quota
    if (document.hidden) return;

    setIsRefreshing(true);
    try {
      const data = await getWorkspaceTaskData(workspaceId);
      if (isMountedRef.current && data) {
        setTasks(data.tasks);
        setAssignmentsByTask(data.assignmentsByTask);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('[LiveTaskAccordion] poll failed:', err);
    } finally {
      if (isMountedRef.current) setIsRefreshing(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    isMountedRef.current = true;

    // Periodic poll
    const interval = setInterval(fetchLatest, POLL_INTERVAL_MS);

    // Immediate refetch when user returns to this tab
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchLatest();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchLatest]);

  const updatedTime = lastUpdated.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Empty state (also handles live-fetch resolving to 0 tasks)
  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center bg-white dark:bg-transparent">
        <p className="text-3xl mb-3">📋</p>
        <p className="text-zinc-500 font-bold dark:text-zinc-400">Belum ada tugas di workspace ini.</p>
        {canCreateTask && (
          <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">
            Klik tombol &quot;+ Buat Tugas&quot; di atas untuk memulai penugasan.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Live status indicator */}
      <div className="flex items-center justify-end gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-colors ${
            isRefreshing
              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRefreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
            }`}
          />
          {isRefreshing ? 'Memperbarui…' : `Live · ${updatedTime}`}
        </span>
      </div>

      <TaskAccordion
        tasks={tasks as any}
        assignmentsByTask={assignmentsByTask as any}
        currentUserId={currentUserId}
        canDeleteTask={canDeleteTask}
        canAssignTask={canAssignTask}
        isLeader={isLeader}
        isMentor={isMentor}
        isCoordinator={isCoordinator}
        isOjtWorkspace={isOjtWorkspace}
        users={users}
        members={members}
      />
    </div>
  );
}
