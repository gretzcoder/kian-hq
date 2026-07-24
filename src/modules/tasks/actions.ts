'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, hasPermission, hasWorkspacePermission } from '@/modules/roles/rbac';
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

  const db = await getDB();

  // Fetch workspace to get project_id
  const ws = await db
    .prepare('SELECT id, project_id, ojt_coordinator_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { id: string; project_id: string; ojt_coordinator_id: string | null } | null;

  if (!ws) return { success: false, error: 'Workspace not found.' };

  // Authorization check (Unified Permission Engine)
  const allowed = await hasWorkspacePermission(session.userId, workspaceId, 'CREATE_TASK');
  if (!allowed) {
    throw new Error('Forbidden: You do not have permission to create tasks in this workspace.');
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const priority = (formData.get('priority') as string) || 'NORMAL';
  const deadlineStr = formData.get('deadline') as string;
  
  // OJT fields
  const taskType = (formData.get('taskType') as string) || 'REGULAR';
  const parentTaskId = formData.get('parentTaskId') as string || null;

  if (!title?.trim()) {
    return { success: false, error: 'Task title is required.' };
  }

  const taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`;
  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;

  // Determine initial status based on task type
  const initialStatus = 'DRAFT';

  try {
    await db
      .prepare(`
        INSERT INTO tasks
          (id, project_id, workspace_id, title, description, status, priority, created_by, deadline, task_type, parent_task_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        taskId, 
        ws.project_id, 
        workspaceId, 
        title.trim(), 
        description || null, 
        initialStatus, 
        priority, 
        session.userId, 
        deadline,
        taskType,
        parentTaskId
      )
      .run();

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: null,
      toStatus: initialStatus,
      triggeredBy: session.userId,
      note: `Task "${title}" created (${taskType})`,
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

  const db = await getDB();

  const task = await db
    .prepare('SELECT id, project_id, workspace_id FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as TaskRow | null;

  if (!task) return { success: false, error: 'Task not found.' };

  // Check authority (Unified Permission Engine)
  const workspaceId = task.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'ASSIGN_TASK');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to assign tasks in this workspace.');
  }

  const assignmentId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(`
        INSERT INTO task_assignments (id, task_id, user_id, assignment_role, assigned_by, status)
        VALUES (?, ?, ?, ?, ?, 'DRAFT')
      `)
      .bind(assignmentId, taskId, userId, role, session.userId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: null,
      toStatus: 'DRAFT',
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
    const task = await db
      .prepare('SELECT id, parent_task_id, project_id, workspace_id, status FROM tasks WHERE id = ?')
      .bind(assignment.task_id)
      .first() as { id: string; parent_task_id: string | null; project_id: string; workspace_id: string | null; status: string } | null;

    if (task?.parent_task_id) {
      const parent = await db
        .prepare('SELECT status FROM tasks WHERE id = ?')
        .bind(task.parent_task_id)
        .first() as { status: string } | null;

      if (parent && !['APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(parent.status)) {
        return { success: false, error: 'Cannot start this task until the prerequisite task is Approved.' };
      }
    }

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
    const task = await db
      .prepare('SELECT id, project_id, workspace_id, status, task_type, parent_task_id FROM tasks WHERE id = ?')
      .bind(assignment.task_id)
      .first() as { id: string; project_id: string; workspace_id: string | null; status: string; task_type: string; parent_task_id: string | null } | null;

    if (task?.parent_task_id) {
      const parent = await db
        .prepare('SELECT status FROM tasks WHERE id = ?')
        .bind(task.parent_task_id)
        .first() as { status: string } | null;

      if (parent && !['APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(parent.status)) {
        return { success: false, error: 'Cannot submit this task until the prerequisite task is Approved.' };
      }
    }

    const auditStatus = assignment.status === 'REVISION_REQUESTED' ? 'RESUBMITTED' : 'SUBMITTED';

    validateTransition('task_assignment', assignment.status, auditStatus);
    validateTransition('task_assignment', auditStatus, 'WAITING_REVIEW');

    const now = Math.floor(Date.now() / 1000);
    const nextStatus = 'WAITING_REVIEW';

    await db
      .prepare(`
        UPDATE task_assignments
        SET status = ?, result_url = ?, submitted_at = ?
        WHERE id = ?
      `)
      .bind(nextStatus, resultUrl.trim(), now, assignmentId)
      .run();

    if (task && task.status !== nextStatus) {
      await db
        .prepare('UPDATE tasks SET status = ? WHERE id = ?')
        .bind(nextStatus, task.id)
        .run();

      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: task.status,
        toStatus: auditStatus,
        triggeredBy: session.userId,
      });

      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: auditStatus,
        toStatus: nextStatus,
        triggeredBy: session.userId,
      });
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: auditStatus,
      triggeredBy: session.userId,
      note: `Result submitted: ${resultUrl.trim()}`,
    });

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: auditStatus,
      toStatus: nextStatus,
      triggeredBy: session.userId,
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

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const task = await db
    .prepare('SELECT id, project_id, workspace_id, status, task_type FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string; task_type: string } | null;

  // Local Coordinator check OR global APPROVE permission (Unified Permission Engine)
  const workspaceId = task?.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'APPROVE');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to approve assignments in this workspace.');
  }

  let nextStatus = 'APPROVED';
  if (assignment.status === 'WAITING_REVIEW') {
    nextStatus = 'APPROVED';
  } else if (assignment.status === 'APPROVED') {
    nextStatus = 'LOCKED';
  } else if (assignment.status === 'LOCKED') {
    nextStatus = 'PUBLISHED';
  } else if (assignment.status === 'PUBLISHED') {
    nextStatus = 'ARCHIVED';
  } else {
    validateTransition('task_assignment', assignment.status, 'APPROVED');
  }

  try {
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare('UPDATE task_assignments SET status = ?, reviewed_at = ? WHERE id = ?')
      .bind(nextStatus, now, assignmentId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: nextStatus,
      triggeredBy: session.userId,
      note: `Approved stage transition to ${nextStatus}`,
    });

    if (task) {
      // Check if all assignments are ready for the new status
      const { results: pending } = await db
        .prepare("SELECT id FROM task_assignments WHERE task_id = ? AND status NOT IN ('APPROVED', 'DONE', 'PUBLISHED', 'IN_PRODUCTION', 'IN_UPLOAD')")
        .bind(task.id)
        .all();

      if (pending.length === 0 && task.status !== nextStatus) {
        await db
          .prepare('UPDATE tasks SET status = ? WHERE id = ?')
          .bind(nextStatus, task.id)
          .run();

        await logWorkflowEvent({
          entityType: 'task',
          entityId: task.id,
          fromStatus: task.status,
          toStatus: nextStatus,
          triggeredBy: session.userId,
          note: `Task stage auto-progressed to ${nextStatus}`,
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

export async function requestRevision(assignmentId: string, note: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!note?.trim()) {
    return { success: false, error: 'A revision note is required.' };
  }

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const task = await db
    .prepare('SELECT id, project_id, workspace_id, status, task_type FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string; task_type: string } | null;

  // Local Coordinator check OR global REQUEST_REVISION permission (Unified Permission Engine)
  const workspaceId = task?.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'REQUEST_REVISION');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to request revisions in this workspace.');
  }

  const nextStatus = 'REVISION_REQUESTED';
  validateTransition('task_assignment', assignment.status, nextStatus);

  try {
    await db
      .prepare('UPDATE task_assignments SET status = ?, revision_note = ?, reviewed_at = ? WHERE id = ?')
      .bind(nextStatus, note.trim(), Math.floor(Date.now() / 1000), assignmentId)
      .run();

    if (task && task.status !== nextStatus) {
      await db
        .prepare('UPDATE tasks SET status = ? WHERE id = ?')
        .bind(nextStatus, task.id)
        .run();
      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: task.status,
        toStatus: nextStatus,
        triggeredBy: session.userId,
        note,
      });
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: nextStatus,
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

  const db = await getDB();

  const task = await db
    .prepare('SELECT project_id, workspace_id FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { project_id: string; workspace_id: string | null } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  // Check authority (Unified Permission Engine)
  const workspaceId = task.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'DELETE');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to delete this task.');
  }

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

/**
 * Declines a submitted assignment.
 * Requires: REQUEST_REVISION permission.
 */
export async function declineAssignment(assignmentId: string, note: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!note?.trim()) {
    return { success: false, error: 'A decline note/reason is required.' };
  }

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const task = await db
    .prepare('SELECT id, project_id, workspace_id, status FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string } | null;

  const workspaceId = task?.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'REQUEST_REVISION');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to decline assignments in this workspace.');
  }

  const nextStatus = 'DECLINED';
  validateTransition('task_assignment', assignment.status, nextStatus);

  try {
    await db
      .prepare('UPDATE task_assignments SET status = ?, revision_note = ?, reviewed_at = ? WHERE id = ?')
      .bind(nextStatus, note.trim(), Math.floor(Date.now() / 1000), assignmentId)
      .run();

    if (task && task.status !== nextStatus) {
      await db
        .prepare('UPDATE tasks SET status = ? WHERE id = ?')
        .bind(nextStatus, task.id)
        .run();
      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: task.status,
        toStatus: nextStatus,
        triggeredBy: session.userId,
        note,
      });
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: nextStatus,
      triggeredBy: session.userId,
      note: note.trim(),
    });

    if (task?.workspace_id) {
      revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    revalidatePath('/dashboard/review');
    return { success: true };
  } catch (err: any) {
    console.error('declineAssignment failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Resets a DECLINED assignment back to DRAFT so the creator can edit/re-create.
 * Transition: DECLINED → DRAFT ("Create Again").
 */
export async function resetDeclinedAssignment(assignmentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, user_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as AssignmentRow | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  if (assignment.user_id !== session.userId) {
    return { success: false, error: 'You can only reset your own assignments.' };
  }

  const task = await db
    .prepare('SELECT id, project_id, workspace_id, status FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string } | null;

  const nextStatus = 'DRAFT';
  validateTransition('task_assignment', assignment.status, nextStatus);

  try {
    await db
      .prepare("UPDATE task_assignments SET status = ?, revision_note = NULL, result_url = NULL, submitted_at = NULL WHERE id = ?")
      .bind(nextStatus, assignmentId)
      .run();

    if (task && task.status !== nextStatus) {
      await db
        .prepare('UPDATE tasks SET status = ? WHERE id = ?')
        .bind(nextStatus, task.id)
        .run();
      await logWorkflowEvent({
        entityType: 'task',
        entityId: task.id,
        fromStatus: task.status,
        toStatus: nextStatus,
        triggeredBy: session.userId,
      });
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: nextStatus,
      triggeredBy: session.userId,
    });

    if (task?.workspace_id) {
      revalidatePath(`/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('resetDeclinedAssignment failed:', err);
    return { success: false, error: err.message };
  }
}
