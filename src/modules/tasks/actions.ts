'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, hasPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { validateTransition } from '@/modules/workflow/engine';
import { logWorkflowEvent } from '@/modules/workflow/events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  workspace_id: string | null;
  project_id: string;
  status: string;
}

interface AssignmentRow {
  id: string;
  task_id: string;
  user_id: string;
  assignment_role: string;
  status: string;
}

// ---------------------------------------------------------------------------
// CREATE TASK (now under a workspace, not directly under a project)
// ---------------------------------------------------------------------------

/**
 * Creates a new task inside a workspace.
 * Requires: CREATE_TASK permission.
 */
export async function createTask(workspaceId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'CREATE_TASK');

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const priority = (formData.get('priority') as string) || 'NORMAL';
  const deadlineStr = formData.get('deadline') as string;

  if (!title?.trim()) {
    return { success: false, error: 'Task title is required.' };
  }

  const db = await getDB();

  // Fetch workspace to get project_id
  const ws = await db
    .prepare('SELECT id, project_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { id: string; project_id: string } | null;

  if (!ws) return { success: false, error: 'Workspace not found.' };

  const taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`;
  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;

  try {
    await db
      .prepare(`
        INSERT INTO tasks
          (id, project_id, workspace_id, title, description, status, priority, created_by, deadline)
        VALUES (?, ?, ?, ?, ?, 'TODO', ?, ?, ?)
      `)
      .bind(taskId, ws.project_id, workspaceId, title.trim(), description || null, priority, session.userId, deadline)
      .run();

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: null,
      toStatus: 'TODO',
      triggeredBy: session.userId,
      note: `Task "${title}" created`,
    });

    revalidatePath(`/dashboard/projects/${ws.project_id}/workspace/${workspaceId}`);
    revalidatePath('/dashboard/workspace');
    return { success: true, taskId };
  } catch (err: any) {
    console.error('createTask failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// ASSIGN CREATOR TO TASK
// ---------------------------------------------------------------------------

/**
 * Assigns a user to a task with a specific role (PIC, REVIEWER, HELPER, APPROVER).
 * One user can only have one assignment per task (enforced by UNIQUE constraint).
 * Requires: ASSIGN_TASK permission.
 */
export async function assignCreatorToTask(
  taskId: string,
  userId: string,
  role: 'PIC' | 'REVIEWER' | 'HELPER' | 'APPROVER',
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ASSIGN_TASK');

  const db = await getDB();

  const task = await db
    .prepare('SELECT id, project_id, workspace_id FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as TaskRow | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const assignmentId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(`
        INSERT INTO task_assignments (id, task_id, user_id, assignment_role, assigned_by, status)
        VALUES (?, ?, ?, ?, ?, 'ASSIGNED')
      `)
      .bind(assignmentId, taskId, userId, role, session.userId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: null,
      toStatus: 'ASSIGNED',
      triggeredBy: session.userId,
      note: `Assigned as ${role}`,
    });

    if (task.workspace_id) {
      revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true, assignmentId };
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      return { success: false, error: 'This user is already assigned to this task.' };
    }
    console.error('assignCreatorToTask failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// REMOVE ASSIGNMENT
// ---------------------------------------------------------------------------

/**
 * Removes a creator from a task assignment.
 * Requires: ASSIGN_TASK permission.
 */
export async function removeTaskAssignment(assignmentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ASSIGN_TASK');

  const db = await getDB();

  const assignment = await db
    .prepare(`
      SELECT ta.id, t.project_id, t.workspace_id
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.id = ?
    `)
    .bind(assignmentId)
    .first() as { id: string; project_id: string; workspace_id: string | null } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  try {
    await db
      .prepare('DELETE FROM task_assignments WHERE id = ?')
      .bind(assignmentId)
      .run();

    if (assignment.workspace_id) {
      revalidatePath(`/dashboard/projects/${assignment.project_id}/workspace/${assignment.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('removeTaskAssignment failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// START WORK  (ASSIGNED → IN_PROGRESS)
// ---------------------------------------------------------------------------

/**
 * Marks a task assignment as IN_PROGRESS.
 * Only the assigned user can start their own assignment.
 */
export async function startWork(assignmentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, user_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };
  if (assignment.user_id !== session.userId) {
    return { success: false, error: 'You can only start your own assignments.' };
  }

  try {
    validateTransition('task_assignment', assignment.status, 'IN_PROGRESS');

    await db
      .prepare("UPDATE task_assignments SET status = 'IN_PROGRESS' WHERE id = ?")
      .bind(assignmentId)
      .run();

    // Also update parent task status if it's still TODO
    const task = await db
      .prepare('SELECT id, project_id, workspace_id, status FROM tasks WHERE id = ?')
      .bind(assignment.task_id)
      .first() as TaskRow | null;

    if (task && task.status === 'TODO') {
      await db
        .prepare("UPDATE tasks SET status = 'IN_PROGRESS' WHERE id = ?")
        .bind(task.id)
        .run();
      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: 'TODO',
        toStatus: 'IN_PROGRESS',
        triggeredBy: session.userId,
      });
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: 'IN_PROGRESS',
      triggeredBy: session.userId,
    });

    if (task?.workspace_id) {
      revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('startWork failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// SUBMIT RESULT  (IN_PROGRESS → SUBMITTED → IN_REVIEW)
// ---------------------------------------------------------------------------

/**
 * Submits a result URL (Google Drive link) for review.
 * Transitions: IN_PROGRESS → SUBMITTED → IN_REVIEW (auto-chained).
 * Only the assigned user can submit (or anyone with UPLOAD perm).
 */
export async function submitResult(assignmentId: string, resultUrl: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!resultUrl?.trim()) {
    return { success: false, error: 'Result URL is required.' };
  }

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, user_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const isOwner = assignment.user_id === session.userId;
  const canUpload = await hasPermission(session.userId, 'UPLOAD');

  if (!isOwner && !canUpload) {
    return { success: false, error: 'You can only submit results for your own assignments.' };
  }

  try {
    validateTransition('task_assignment', assignment.status, 'SUBMITTED');

    const now = Math.floor(Date.now() / 1000);

    // Chain: SUBMITTED → IN_REVIEW immediately
    await db
      .prepare(`
        UPDATE task_assignments
        SET status = 'IN_REVIEW', result_url = ?, submitted_at = ?
        WHERE id = ?
      `)
      .bind(resultUrl.trim(), now, assignmentId)
      .run();

    const task = await db
      .prepare('SELECT id, project_id, workspace_id, status FROM tasks WHERE id = ?')
      .bind(assignment.task_id)
      .first() as TaskRow | null;

    // Elevate task status to SUBMITTED if not already in review/approved
    if (task && !['IN_REVIEW', 'APPROVED', 'DONE'].includes(task.status)) {
      await db
        .prepare("UPDATE tasks SET status = 'SUBMITTED' WHERE id = ?")
        .bind(task.id)
        .run();
      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: task.status,
        toStatus: 'SUBMITTED',
        triggeredBy: session.userId,
      });
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: 'IN_REVIEW',
      triggeredBy: session.userId,
      note: `Result submitted: ${resultUrl.trim()}`,
    });

    if (task?.workspace_id) {
      revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    revalidatePath('/dashboard/review');
    return { success: true };
  } catch (err: any) {
    console.error('submitResult failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// APPROVE ASSIGNMENT  (IN_REVIEW → APPROVED)
// ---------------------------------------------------------------------------

/**
 * Approves a submitted assignment.
 * Requires: APPROVE permission.
 */
export async function approveAssignment(assignmentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'APPROVE');

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  try {
    validateTransition('task_assignment', assignment.status, 'APPROVED');

    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare("UPDATE task_assignments SET status = 'APPROVED', reviewed_at = ? WHERE id = ?")
      .bind(now, assignmentId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: 'APPROVED',
      triggeredBy: session.userId,
    });

    // Check if ALL assignments for this task are approved → auto-complete task
    const task = await db
      .prepare('SELECT id, project_id, workspace_id, status FROM tasks WHERE id = ?')
      .bind(assignment.task_id)
      .first() as TaskRow | null;

    if (task) {
      const { results: pending } = await db
        .prepare("SELECT id FROM task_assignments WHERE task_id = ? AND status NOT IN ('APPROVED', 'DONE')")
        .bind(task.id)
        .all();

      if (pending.length === 0 && task.status !== 'APPROVED') {
        await db
          .prepare("UPDATE tasks SET status = 'APPROVED' WHERE id = ?")
          .bind(task.id)
          .run();
        await logWorkflowEvent({
          entityType: 'task',
          entityId: task.id,
          fromStatus: task.status,
          toStatus: 'APPROVED',
          triggeredBy: session.userId,
          note: 'All assignments approved — task auto-approved',
        });
      }

      if (task.workspace_id) {
        revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
      }
    }

    revalidatePath('/dashboard/review');
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('approveAssignment failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// REQUEST REVISION  (IN_REVIEW → REVISION)
// ---------------------------------------------------------------------------

/**
 * Sends an assignment back for revision with a mandatory note.
 * Requires: REQUEST_REVISION permission.
 */
export async function requestRevision(assignmentId: string, note: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'REQUEST_REVISION');

  if (!note?.trim()) {
    return { success: false, error: 'A revision note is required.' };
  }

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  try {
    validateTransition('task_assignment', assignment.status, 'REVISION');

    await db
      .prepare(`
        UPDATE task_assignments
        SET status = 'REVISION', revision_note = ?, reviewed_at = ?
        WHERE id = ?
      `)
      .bind(note.trim(), Math.floor(Date.now() / 1000), assignmentId)
      .run();

    const task = await db
      .prepare('SELECT id, project_id, workspace_id, status FROM tasks WHERE id = ?')
      .bind(assignment.task_id)
      .first() as TaskRow | null;

    if (task && task.status !== 'REVISION') {
      await db
        .prepare("UPDATE tasks SET status = 'REVISION' WHERE id = ?")
        .bind(task.id)
        .run();
      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: task.status,
        toStatus: 'REVISION',
        triggeredBy: session.userId,
        note,
      });
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: 'REVISION',
      triggeredBy: session.userId,
      note: note.trim(),
    });

    if (task?.workspace_id) {
      revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/review');
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('requestRevision failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// DELETE TASK
// ---------------------------------------------------------------------------

/**
 * Deletes a task and all its assignments (cascade).
 * Requires: DELETE permission.
 */
export async function deleteTask(taskId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'DELETE');

  const db = await getDB();

  const task = await db
    .prepare('SELECT project_id, workspace_id FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { project_id: string; workspace_id: string | null } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  try {
    await db.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();

    if (task.workspace_id) {
      revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('deleteTask failed:', err);
    return { success: false, error: err.message };
  }
}
