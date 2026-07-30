'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, hasPermission, hasWorkspacePermission, getSessionContext } from '@/modules/roles/rbac';
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
// Helper: Check OJT sequential rundown prerequisites
// ---------------------------------------------------------------------------
async function checkOJTPrerequisites(db: any, taskId: string, role: string): Promise<{ allowed: boolean; error?: string }> {
  if (role === 'PLANNER') {
    // Check if RESEARCHER step exists and is approved
    const res = await db
      .prepare("SELECT status FROM task_assignments WHERE task_id = ? AND assignment_role = 'RESEARCHER'")
      .bind(taskId)
      .first() as { status: string } | null;
    if (res && !['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(res.status)) {
      return { allowed: false, error: 'Tidak dapat melanjutkan step Planning sebelum step Research disetujui QC.' };
    }
  } else if (['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(role)) {
    // Check if PLANNER step exists and is approved
    const planner = await db
      .prepare("SELECT status FROM task_assignments WHERE task_id = ? AND assignment_role = 'PLANNER'")
      .bind(taskId)
      .first() as { status: string } | null;
    if (planner && !['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(planner.status)) {
      return { allowed: false, error: 'Tidak dapat melanjutkan step ini sebelum step Planning disetujui QC.' };
    }

    // Check if RESEARCHER step exists and is approved (if planner wasn't assigned)
    const researcher = await db
      .prepare("SELECT status FROM task_assignments WHERE task_id = ? AND assignment_role = 'RESEARCHER'")
      .bind(taskId)
      .first() as { status: string } | null;
    if (researcher && !['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(researcher.status)) {
      return { allowed: false, error: 'Tidak dapat melanjutkan step ini sebelum step Research disetujui QC.' };
    }
  }
  return { allowed: true };
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
  const outputType = (formData.get('outputType') as string) || 'DESIGN';
  
  // OJT fields
  const parentTaskId = formData.get('parentTaskId') as string || null;

  if (!title?.trim()) {
    return { success: false, error: 'Judul tugas wajib diisi.' };
  }

  if (!deadlineStr?.trim()) {
    return { success: false, error: 'Tenggat waktu (Deadline) wajib diisi.' };
  }

  if (!['DESIGN', 'VIDEO'].includes(outputType)) {
    return { success: false, error: 'Jenis output karya wajib dipilih (Design atau Video).' };
  }

  const taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`;
  const deadline = new Date(deadlineStr).getTime();

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
        outputType,
        parentTaskId
      )
      .run();

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: null,
      toStatus: initialStatus,
      triggeredBy: session.userId,
      note: `Task "${title}" created (Output: ${outputType})`,
    });

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
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
  role: 'PIC' | 'REVIEWER' | 'HELPER' | 'APPROVER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'DESIGNER' | 'VIDEO_EDITOR',
  deadline?: number | null,
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
        INSERT INTO task_assignments (id, task_id, user_id, assignment_role, assigned_by, status, deadline)
        VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)
      `)
      .bind(assignmentId, taskId, userId, role, session.userId, deadline ?? null)
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
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
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

/**
 * Assigns multiple users to a task with their respective roles and deadlines in a single batch call.
 * Requires: ASSIGN_TASK permission.
 */
export async function assignMultipleCreatorsToTask(
  taskId: string,
  assignments: Array<{
    userId: string;
    role: 'PIC' | 'REVIEWER' | 'HELPER' | 'APPROVER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'DESIGNER' | 'VIDEO_EDITOR';
    deadline?: number | null;
  }>,
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!assignments || assignments.length === 0) {
    return { success: false, error: 'No assignments provided.' };
  }

  const db = await getDB();

  const task = await db
    .prepare('SELECT id, project_id, workspace_id FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as TaskRow | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'ASSIGN_TASK');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to assign tasks in this workspace.');
  }

  try {
    for (const item of assignments) {
      if (!item.userId || !item.role) continue;
      const assignmentId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;

      await db
        .prepare(`
          INSERT INTO task_assignments (id, task_id, user_id, assignment_role, assigned_by, status, deadline)
          VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)
        `)
        .bind(assignmentId, taskId, item.userId, item.role, session.userId, item.deadline ?? null)
        .run();

      await logWorkflowEvent({
        entityType: 'task_assignment',
        entityId: assignmentId,
        fromStatus: null,
        toStatus: 'DRAFT',
        triggeredBy: session.userId,
        note: `Batch assigned as ${item.role}`,
      });
    }

    if (task.workspace_id) {
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('assignMultipleCreatorsToTask failed:', err);
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
      revalidatePath(`/dashboard/workspace/${assignment.workspace_id}`);
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

    // Check OJT step prerequisites
    const ojtCheck = await checkOJTPrerequisites(db, assignment.task_id, assignment.assignment_role);
    if (!ojtCheck.allowed) {
      return { success: false, error: ojtCheck.error };
    }

    if (task?.workspace_id) {
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
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

    // Check OJT step prerequisites
    const ojtCheck = await checkOJTPrerequisites(db, assignment.task_id, assignment.assignment_role);
    if (!ojtCheck.allowed) {
      return { success: false, error: ojtCheck.error };
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
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
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
export async function approveAssignment(assignmentId: string, appreciationBadge?: string | number, appreciationNote?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, status, assignment_role, lead_approved, mentor_approved, coordinator_approved FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as {
      id: string;
      task_id: string;
      status: string;
      assignment_role: string;
      lead_approved: number;
      mentor_approved: number;
      coordinator_approved: number;
    } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const task = await db
    .prepare('SELECT id, project_id, workspace_id, status, task_type FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string; task_type: string } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';

  const ctx = await getSessionContext(session.userId);
  const isLeader = (await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(workspaceId, session.userId)
    .first()) !== null;

  const isMentor = (await db
    .prepare('SELECT 1 FROM workspaces WHERE id = ? AND ojt_coordinator_id = ?')
    .bind(workspaceId, session.userId)
    .first()) !== null;

  const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

  const isOjtRole = ['RESEARCHER', 'PLANNER', 'CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assignment.assignment_role);

  if (isOjtRole) {
    if (!isLeader && !isMentor && !isCoordinator) {
      throw new Error('Forbidden: You do not have permission to approve this step.');
    }
  } else {
    const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'APPROVE');
    if (!authorized) {
      throw new Error('Forbidden: You do not have permission to approve assignments in this workspace.');
    }
  }

  try {
    let nextStatus = assignment.status;
    let newLeadApproved = assignment.lead_approved;
    let newMentorApproved = assignment.mentor_approved;
    let newCoordinatorApproved = assignment.coordinator_approved;

    if (isOjtRole) {
      if (isLeader) newLeadApproved = 1;
      if (isMentor) newMentorApproved = 1;
      if (isCoordinator) newCoordinatorApproved = 1;

      if (newLeadApproved === 1 && newMentorApproved === 1 && newCoordinatorApproved === 1) {
        nextStatus = 'APPROVED';
      } else {
        nextStatus = 'WAITING_REVIEW';
      }
    } else {
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
    }

    const now = Math.floor(Date.now() / 1000);

    const sparksValue = (isCoordinator && typeof appreciationBadge === 'number') ? appreciationBadge : null;

    if (sparksValue !== null) {
      await db
        .prepare('UPDATE task_assignments SET status = ?, reviewed_at = ?, lead_approved = ?, mentor_approved = ?, coordinator_approved = ?, sparks = ? WHERE id = ?')
        .bind(nextStatus, now, newLeadApproved, newMentorApproved, newCoordinatorApproved, sparksValue, assignmentId)
        .run();
    } else {
      await db
        .prepare('UPDATE task_assignments SET status = ?, reviewed_at = ?, lead_approved = ?, mentor_approved = ?, coordinator_approved = ? WHERE id = ?')
        .bind(nextStatus, now, newLeadApproved, newMentorApproved, newCoordinatorApproved, assignmentId)
        .run();
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: nextStatus,
      triggeredBy: session.userId,
      note: `Approved by: ${isLeader ? 'Leader ' : ''}${isMentor ? 'Mentor ' : ''}${isCoordinator ? 'Coordinator ' : ''}(Status: ${nextStatus})${appreciationBadge ? ` [Sparks: ${appreciationBadge}]` : ''}${appreciationNote ? ` Note: ${appreciationNote}` : ''}`,
    });

    if (nextStatus === 'APPROVED') {
      const { results: pending } = await db
        .prepare("SELECT id FROM task_assignments WHERE task_id = ? AND status NOT IN ('APPROVED', 'DONE', 'PUBLISHED', 'IN_PRODUCTION', 'IN_UPLOAD')")
        .bind(task.id)
        .all();

      if (pending.length === 0 && task.status !== 'APPROVED') {
        await db
          .prepare('UPDATE tasks SET status = ? WHERE id = ?')
          .bind('APPROVED', task.id)
          .run();

        await logWorkflowEvent({
          entityType: 'task',
          entityId: task.id,
          fromStatus: task.status,
          toStatus: 'APPROVED',
          triggeredBy: session.userId,
          note: `Task stage auto-progressed to APPROVED`,
        });
      }
    } else if (isOjtRole) {
      if (task.status !== 'WAITING_REVIEW') {
        await db
          .prepare('UPDATE tasks SET status = ? WHERE id = ?')
          .bind('WAITING_REVIEW', task.id)
          .run();
      }
    }

    if (task.workspace_id) {
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
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
    .prepare('SELECT id, task_id, status, assignment_role FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; status: string; assignment_role: string } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  if (['APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(assignment.status)) {
    return { success: false, error: 'Penugasan yang sudah disetujui (Approved) tidak dapat diminta revisi kembali.' };
  }

  const task = await db
    .prepare('SELECT id, project_id, workspace_id, status, task_type FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string; task_type: string } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';
  const ctx = await getSessionContext(session.userId);

  const isOjtRole = ['RESEARCHER', 'PLANNER', 'CREATOR'].includes(assignment.assignment_role);

  if (isOjtRole) {
    const isLeader = (await db
      .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
      .bind(workspaceId, session.userId)
      .first()) !== null;

    const isMentor = (await db
      .prepare('SELECT 1 FROM workspaces WHERE id = ? AND ojt_coordinator_id = ?')
      .bind(workspaceId, session.userId)
      .first()) !== null;

    const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

    if (!isLeader && !isMentor && !isCoordinator) {
      throw new Error('Forbidden: You do not have permission to request revision for this step.');
    }
  } else {
    const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'REQUEST_REVISION');
    if (!authorized) {
      throw new Error('Forbidden: You do not have permission to request revisions in this workspace.');
    }
  }

  const nextStatus = 'REVISION_REQUESTED';
  validateTransition('task_assignment', assignment.status, nextStatus);

  try {
    await db
      .prepare('UPDATE task_assignments SET status = ?, revision_note = ?, reviewed_at = ?, lead_approved = 0, mentor_approved = 0, coordinator_approved = 0 WHERE id = ?')
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
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
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
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
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
    .prepare('SELECT id, task_id, status, assignment_role FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; status: string; assignment_role: string } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const task = await db
    .prepare('SELECT id, project_id, workspace_id, status FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';
  const ctx = await getSessionContext(session.userId);

  const isOjtRole = ['RESEARCHER', 'PLANNER', 'CREATOR'].includes(assignment.assignment_role);

  if (isOjtRole) {
    const isLeader = (await db
      .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
      .bind(workspaceId, session.userId)
      .first()) !== null;

    const isMentor = (await db
      .prepare('SELECT 1 FROM workspaces WHERE id = ? AND ojt_coordinator_id = ?')
      .bind(workspaceId, session.userId)
      .first()) !== null;

    const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

    if (!isLeader && !isMentor && !isCoordinator) {
      throw new Error('Forbidden: You do not have permission to decline this step.');
    }
  } else {
    const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'REQUEST_REVISION');
    if (!authorized) {
      throw new Error('Forbidden: You do not have permission to decline assignments in this workspace.');
    }
  }

  const nextStatus = 'DECLINED';
  validateTransition('task_assignment', assignment.status, nextStatus);

  try {
    await db
      .prepare('UPDATE task_assignments SET status = ?, revision_note = ?, reviewed_at = ?, lead_approved = 0, mentor_approved = 0, coordinator_approved = 0 WHERE id = ?')
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
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
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
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('resetDeclinedAssignment failed:', err);
    return { success: false, error: err.message };
  }
}
