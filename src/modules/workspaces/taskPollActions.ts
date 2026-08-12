'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';

export interface PollTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: number | null;
  start_at?: number | null;
  created_at: number;
  task_type: string;
  parent_task_id: string | null;
  revision_note?: string | null;
  sparks?: number | null;
}

export interface PollAssignmentRow {
  id: string;
  task_id: string;
  user_id: string;
  assignment_role: string;
  status: string;
  result_url: string | null;
  revision_note: string | null;
  appreciation_note?: string | null;
  submitted_at: number | null;
  user_name: string | null;
  lead_approved: number;
  mentor_approved: number;
  coordinator_approved: number;
  sparks: number | null;
  deadline: number | null;
}

export interface WorkspaceTaskData {
  tasks: PollTaskRow[];
  assignmentsByTask: Record<string, PollAssignmentRow[]>;
}

/**
 * Lightweight server action used by LiveTaskAccordion to poll
 * tasks + assignments for a workspace without a full page reload.
 */
export async function getWorkspaceTaskData(wsId: string): Promise<WorkspaceTaskData | null> {
  const session = await getSession();
  if (!session) return null;

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const { results: tasksRaw } = await db
    .prepare(
      `SELECT id, title, description, status, priority, deadline, start_at, created_at, task_type, parent_task_id, revision_note, sparks
       FROM tasks
       WHERE workspace_id = ? AND status != 'DELETED'
       ORDER BY
         CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC,
         deadline ASC,
         created_at ASC`
    )
    .bind(wsId)
    .all();

  const isMentorUser = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const isManagerUser = ctx.userType === 'STAFF' || isMentorUser || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE');

  const now = Date.now();
  const allTasks = ((tasksRaw as unknown as PollTaskRow[]) || []).filter((t) => t.status !== 'DELETED');
  const tasks = isManagerUser
    ? allTasks
    : allTasks.filter((t) => {
        if (t.start_at && t.start_at > now) return false;
        if (t.task_type === 'ASSESSMENT') return t.status === 'APPROVED';
        return true;
      });

  if (tasks.length === 0) {
    return { tasks: [], assignmentsByTask: {} };
  }

  const { results: assignmentsRaw } = await db
    .prepare(
      `SELECT ta.id, ta.task_id, ta.user_id, ta.assignment_role,
              ta.status, ta.result_url, ta.revision_note,
              COALESCE(ta.appreciation_note, (SELECT note FROM workflow_events WHERE entity_id = ta.id AND note IS NOT NULL AND note != '' ORDER BY created_at DESC LIMIT 1)) AS appreciation_note,
              ta.submitted_at, ta.lead_approved, ta.mentor_approved, ta.coordinator_approved,
              ta.sparks, ta.deadline, u.name as user_name
       FROM task_assignments ta
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE ta.task_id IN (${tasks.map(() => '?').join(',')})
       ORDER BY ta.created_at ASC`
    )
    .bind(...tasks.map((t) => t.id))
    .all();

  const assignments = (assignmentsRaw as unknown as PollAssignmentRow[]) || [];

  const assignmentsByTask: Record<string, PollAssignmentRow[]> = {};
  for (const a of assignments) {
    if (!assignmentsByTask[a.task_id]) assignmentsByTask[a.task_id] = [];
    assignmentsByTask[a.task_id].push(a);
  }

  return { tasks, assignmentsByTask };
}
