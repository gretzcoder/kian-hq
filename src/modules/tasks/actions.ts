'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, hasPermission, hasWorkspacePermission, getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { validateTransition } from '@/modules/workflow/engine';
import { logWorkflowEvent } from '@/modules/workflow/events';
import { sendPushNotificationToUser, sendPushNotificationToUsers } from '@/modules/notifications/pushActions';

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
async function checkOJTPrerequisites(db: any, taskId: string, role: string, userId?: string): Promise<{ allowed: boolean; error?: string }> {
  let userClause = '';
  const params: any[] = [taskId];
  if (userId) {
    userClause = ' AND user_id = ?';
    params.push(userId);
  }

  if (role === 'PLANNER') {
    // Check if RESEARCHER step exists for this user and is approved
    const res = await db
      .prepare(`SELECT status FROM task_assignments WHERE task_id = ? ${userClause} AND assignment_role = 'RESEARCHER'`)
      .bind(...params)
      .first() as { status: string } | null;
    if (res && !['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(res.status)) {
      return { allowed: false, error: 'Tidak dapat melanjutkan step Planning sebelum step Research disetujui QC.' };
    }
  } else if (['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(role)) {
    // Check if PLANNER step exists for this user and is approved
    const planner = await db
      .prepare(`SELECT status FROM task_assignments WHERE task_id = ? ${userClause} AND assignment_role = 'PLANNER'`)
      .bind(...params)
      .first() as { status: string } | null;
    if (planner && !['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(planner.status)) {
      return { allowed: false, error: 'Tidak dapat melanjutkan step ini sebelum step Planning disetujui QC.' };
    }

    // Check if RESEARCHER step exists for this user and is approved (if planner wasn't assigned)
    const researcher = await db
      .prepare(`SELECT status FROM task_assignments WHERE task_id = ? ${userClause} AND assignment_role = 'RESEARCHER'`)
      .bind(...params)
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

  // Fetch workspace to get project_id and workspace_type
  const ws = await db
    .prepare('SELECT id, project_id, ojt_coordinator_id, workspace_type FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { id: string; project_id: string; ojt_coordinator_id: string | null; workspace_type: string } | null;

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
  const startAtStr = (formData.get('start_at') as string) || (formData.get('startAt') as string);
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

  let startAt: number | null = null;
  if (startAtStr?.trim()) {
    startAt = new Date(startAtStr).getTime();
    if (isNaN(startAt)) startAt = null;
  }

  // Determine initial status based on task type
  const initialStatus = 'DRAFT';

  try {
    await db
      .prepare(`
        INSERT INTO tasks
          (id, project_id, workspace_id, title, description, status, priority, created_by, deadline, start_at, task_type, parent_task_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        startAt,
        outputType,
        parentTaskId
      )
      .run();

    // If this is a MENTOR workspace, auto-assign all mentor members to EVERY step of the task
    if (ws.workspace_type === 'MENTOR') {
      const { results: mentorMembers } = await db
        .prepare(`
          SELECT DISTINCT u.id AS user_id
          FROM users u
          JOIN workspace_members wm ON u.id = wm.user_id
          WHERE wm.workspace_id = ?
            AND u.status = 'ACTIVE'
        `)
        .bind(workspaceId)
        .all();

      const stepRoles = outputType === 'VIDEO'
        ? ['RESEARCHER', 'PLANNER', 'VIDEO_EDITOR']
        : ['RESEARCHER', 'PLANNER', 'DESIGNER'];

      for (const m of (mentorMembers as { user_id: string }[])) {
        for (const role of stepRoles) {
          const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
          await db
            .prepare(`
              INSERT OR IGNORE INTO task_assignments
                (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
              VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, strftime('%s', 'now'))
            `)
            .bind(assignId, taskId, m.user_id, role, session.userId, deadline, startAt)
            .run();
        }
      }
    }

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: null,
      toStatus: initialStatus,
      triggeredBy: session.userId,
      note: `Task "${title}" created (Output: ${outputType}${ws.workspace_type === 'MENTOR' ? ', Workspace: MENTOR' : ''})`,
    });

    // Async Web Push to workspace members
    try {
      const { results: memberRows } = await db
        .prepare('SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id != ?')
        .bind(workspaceId, session.userId)
        .all();

      const memberIds = (memberRows as any[] || []).map((m) => m.user_id as string);
      if (memberIds.length > 0) {
        sendPushNotificationToUsers(memberIds, 'TASK', {
          title: `📋 Tugas Baru: ${title}`,
          body: description?.slice(0, 100) || `Tugas baru telah ditambahkan di workspace.`,
          url: `/dashboard/workspace/${workspaceId}`,
          category: 'TASK',
          tag: `task_${taskId}`,
        }).catch(() => {});
      }
    } catch (pushErr) {
      console.error('Failed to trigger task Web Push:', pushErr);
    }

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
    const ojtCheck = await checkOJTPrerequisites(db, assignment.task_id, assignment.assignment_role, assignment.user_id);
    if (!ojtCheck.allowed) {
      return { success: false, error: ojtCheck.error };
    }

    const auditStatus = (assignment.status === 'REVISION_REQUESTED' || assignment.status === 'WAITING_REVIEW' || assignment.status === 'RESUBMITTED') ? 'RESUBMITTED' : 'SUBMITTED';

    validateTransition('task_assignment', assignment.status, auditStatus);
    validateTransition('task_assignment', auditStatus, 'WAITING_REVIEW');

    const now = Math.floor(Date.now() / 1000);
    const nextStatus = 'WAITING_REVIEW';

    // Option A: If the submitter is Leader, Mentor, or Coordinator, auto-approve their own QC slot
    const workspaceId = task?.workspace_id || '';
    const isLeader = workspaceId
      ? (await db
          .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
          .bind(workspaceId, session.userId)
          .first()) !== null
      : false;

    const isMentor = workspaceId
      ? (await db
          .prepare('SELECT 1 FROM workspaces WHERE id = ? AND ojt_coordinator_id = ?')
          .bind(workspaceId, session.userId)
          .first()) !== null
      : false;

    const ctx = await getSessionContext(session.userId);
    const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

    await db
      .prepare(`
        UPDATE task_assignments
        SET status = ?, result_url = ?, submitted_at = ?, revision_note = NULL,
            lead_approved = CASE WHEN ? THEN 1 ELSE 0 END,
            mentor_approved = CASE WHEN ? THEN 1 ELSE 0 END,
            coordinator_approved = CASE WHEN ? THEN 1 ELSE 0 END
        WHERE id = ?
      `)
      .bind(nextStatus, resultUrl.trim(), now, isLeader ? 1 : 0, isMentor ? 1 : 0, isCoordinator ? 1 : 0, assignmentId)
      .run();

    if (task) {
      await db
        .prepare('UPDATE tasks SET status = ?, revision_note = NULL WHERE id = ?')
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
    .prepare('SELECT id, user_id, task_id, status, assignment_role, lead_approved, mentor_approved, coordinator_approved FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as {
      id: string;
      user_id: string;
      task_id: string;
      status: string;
      assignment_role: string;
      lead_approved: number;
      mentor_approved: number;
      coordinator_approved: number;
    } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const task = await db
    .prepare('SELECT id, title, project_id, workspace_id, status, task_type FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; title: string; project_id: string; workspace_id: string | null; status: string; task_type: string } | null;

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
  const isMentorWs = task.task_type === 'MENTOR' || (await db.prepare('SELECT workspace_type FROM workspaces WHERE id = ?').bind(workspaceId).first() as any)?.workspace_type === 'MENTOR';

  if (isMentorWs) {
    if (!isCoordinator) {
      return { success: false, error: 'Forbidden: Hanya Koordinator atau Admin yang dapat memberikan penilaian/QC pada workspace Mentor.' };
    }
  } else if (isOjtRole) {
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

    if (isMentorWs) {
      newCoordinatorApproved = 1;
      nextStatus = 'APPROVED';
    } else if (isOjtRole) {
      if (isLeader) newLeadApproved = 1;
      if (isMentor) newMentorApproved = 1;
      if (isCoordinator) newCoordinatorApproved = 1;

      if (newLeadApproved === 1 || newMentorApproved === 1 || newCoordinatorApproved === 1) {
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
    const sparksValue = typeof appreciationBadge === 'number' ? appreciationBadge : null;
    const noteValue = appreciationNote?.trim() || null;

    if (sparksValue !== null) {
      await db
        .prepare('UPDATE task_assignments SET status = ?, reviewed_at = ?, lead_approved = ?, mentor_approved = ?, coordinator_approved = ?, sparks = ?, appreciation_note = COALESCE(?, appreciation_note), revision_note = NULL WHERE id = ?')
        .bind(nextStatus, now, newLeadApproved, newMentorApproved, newCoordinatorApproved, sparksValue, noteValue, assignmentId)
        .run();
    } else {
      await db
        .prepare('UPDATE task_assignments SET status = ?, reviewed_at = ?, lead_approved = ?, mentor_approved = ?, coordinator_approved = ?, appreciation_note = COALESCE(?, appreciation_note), revision_note = NULL WHERE id = ?')
        .bind(nextStatus, now, newLeadApproved, newMentorApproved, newCoordinatorApproved, noteValue, assignmentId)
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

    if (assignment.user_id) {
      sendPushNotificationToUser(assignment.user_id, 'TASK', {
        title: `🎉 Tugas Disetujui!`,
        body: `Tugas ${task?.title || ''} telah disetujui.${sparksValue ? ` (+${sparksValue} Sparks ✨)` : ''}`,
        url: `/dashboard/workspace/${task?.workspace_id || ''}`,
        category: 'TASK',
      }).catch(() => {});
    }

    if (nextStatus === 'APPROVED') {
      const { results: pending } = await db
        .prepare("SELECT id FROM task_assignments WHERE task_id = ? AND status NOT IN ('APPROVED', 'DONE', 'PUBLISHED', 'IN_PRODUCTION', 'IN_UPLOAD')")
        .bind(task.id)
        .all();

      if (pending.length === 0 || task.status !== 'APPROVED') {
        await db
          .prepare('UPDATE tasks SET status = ?, revision_note = NULL WHERE id = ?')
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

/**
 * Directly updates Sparks points for an assignment.
 * Allowed for Leader, Mentor, and Coordinator.
 */
export async function updateSparks(assignmentId: string, sparks: number) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, assignment_role FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; assignment_role: string } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const task = await db
    .prepare('SELECT workspace_id FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { workspace_id: string | null } | null;

  const workspaceId = task?.workspace_id || '';

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

  if (!isLeader && !isMentor && !isCoordinator) {
    return { success: false, error: 'Only Leader, Mentor, or Coordinator can update Sparks.' };
  }

  try {
    await db
      .prepare('UPDATE task_assignments SET sparks = ? WHERE id = ?')
      .bind(sparks, assignmentId)
      .run();

    if (workspaceId) {
      revalidatePath(`/dashboard/workspace/${workspaceId}`);
    }
    revalidatePath('/dashboard/review');
    revalidatePath('/dashboard/workspace');
    revalidatePath('/dashboard/leaderboard');
    return { success: true };
  } catch (err: any) {
    console.error('updateSparks failed:', err);
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
    .prepare('SELECT id, user_id, task_id, status, assignment_role FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; user_id: string; task_id: string; status: string; assignment_role: string } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  if (['APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(assignment.status)) {
    return { success: false, error: 'Penugasan yang sudah disetujui (Approved) tidak dapat diminta revisi kembali.' };
  }

  const task = await db
    .prepare('SELECT id, title, project_id, workspace_id, status, task_type FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; title: string; project_id: string; workspace_id: string | null; status: string; task_type: string } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';
  const ctx = await getSessionContext(session.userId);

  const isOjtRole = ['RESEARCHER', 'PLANNER', 'CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assignment.assignment_role);

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

    if (task) {
      await db
        .prepare('UPDATE tasks SET status = ?, revision_note = ? WHERE id = ?')
        .bind(nextStatus, note.trim(), task.id)
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

    if (assignment.user_id) {
      sendPushNotificationToUser(assignment.user_id, 'TASK', {
        title: `⚠️ Revisi Tugas Required`,
        body: `Catatan Revisi: ${note.trim().slice(0, 90)}`,
        url: `/dashboard/workspace/${task?.workspace_id || ''}`,
        category: 'TASK',
      }).catch(() => {});
    }

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
// UPDATE TASK
// ---------------------------------------------------------------------------

/**
 * Updates a task.
 * Requires: UPDATE permission.
 */
export async function updateTask(taskId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  const task = await db
    .prepare('SELECT id, project_id, workspace_id FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { id: string; project_id: string; workspace_id: string | null } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'UPDATE');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to update this task.');
  }

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const priority = (formData.get('priority') as string) || 'NORMAL';
  const deadlineStr = formData.get('deadline') as string;
  const startAtStr = (formData.get('start_at') as string) || (formData.get('startAt') as string);
  const outputType = (formData.get('outputType') as string) || 'DESIGN';
  const parentTaskId = (formData.get('parentTaskId') as string) || null;

  if (!title) {
    return { success: false, error: 'Judul tugas wajib diisi.' };
  }

  let deadline: number | null = null;
  if (deadlineStr) {
    deadline = new Date(deadlineStr).getTime();
  }

  let startAt: number | null = null;
  if (startAtStr?.trim()) {
    startAt = new Date(startAtStr).getTime();
    if (isNaN(startAt)) startAt = null;
  }

  try {
    await db
      .prepare(`
        UPDATE tasks
        SET title = ?, description = ?, priority = ?, deadline = ?, start_at = ?, task_type = ?, parent_task_id = ?
        WHERE id = ?
      `)
      .bind(title, description, priority, deadline, startAt, outputType, parentTaskId, taskId)
      .run();

    if (task.workspace_id) {
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    console.error('updateTask failed:', err);
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
    await db.prepare('DELETE FROM workflow_events WHERE entity_id = ? OR entity_id IN (SELECT id FROM task_assignments WHERE task_id = ?)').bind(taskId, taskId).run();
    await db.prepare('DELETE FROM task_assignments WHERE task_id = ?').bind(taskId).run();
    await db.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();

    if (task.workspace_id) {
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard');
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

/**
 * Server action allowing Coordinators/Admins to send a review reminder notification
 * to the mentor/creator of a task.
 */
export async function sendReviewReminderToMentor(assignmentId: string, customMessage?: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isStaffOrCoord =
    ctx.userType === 'STAFF' ||
    ctx.can('MANAGE') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE');

  if (!isStaffOrCoord) {
    return { success: false, error: 'Hanya Koordinator atau Admin yang dapat mengirim notifikasi reminder.' };
  }

  const assign = (await db
    .prepare(
      `
      SELECT ta.id, ta.task_id, ta.user_id, ta.status, t.title AS task_title, t.created_by,
             t.workspace_id, u_assignee.name AS assignee_name, u_creator.name AS creator_name,
             ws.name AS workspace_name
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      LEFT JOIN users u_assignee ON ta.user_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE ta.id = ?
    `
    )
    .bind(assignmentId)
    .first()) as any;

  if (!assign) return { success: false, error: 'Penugasan tidak ditemukan.' };

  const targetMentorId = assign.created_by;
  if (!targetMentorId) {
    return { success: false, error: 'Pembuat/Mentor tugas tidak terdefinisi.' };
  }

  const sender = (await db
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(session.userId)
    .first()) as { name: string } | null;

  const senderName = sender?.name || 'Koordinator QC';

  await sendPushNotificationToUser(targetMentorId, 'TASK', {
    title: `🔔 Reminder Review Tugas: ${assign.task_title}`,
    body: `${senderName} mengingatkan Anda untuk segera meninjau submission dari ${assign.assignee_name || 'Trooper'}.${
      customMessage ? ` Catatan: ${customMessage}` : ''
    }`,
    url: assign.workspace_id ? `/dashboard/workspace/${assign.workspace_id}` : '/dashboard/review',
  });

  await logWorkflowEvent({
    entityType: 'task_assignment',
    entityId: assignmentId,
    fromStatus: assign.status,
    toStatus: assign.status,
    triggeredBy: session.userId,
    note: `Koordinator (${senderName}) mengirimkan reminder review ke Mentor (${assign.creator_name || 'Mentor'})`,
  });

  return {
    success: true,
    message: `Reminder berhasil dikirim ke Mentor ${assign.creator_name ? `(${assign.creator_name})` : ''}!`,
  };
}

/**
 * Sends a push notification and in-app reminder to the assigned Trooper/Participant
 * reminding them to complete & submit their active task assignment.
 */
export async function sendSubmissionReminderToTrooper(
  assignmentId: string,
  customMessage?: string
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isStaffOrCoordOrMentor =
    ctx.userType === 'STAFF' ||
    ctx.userType === 'EXTERNAL' ||
    (ctx.userType as string) === 'CREATOR' ||
    ctx.can('MANAGE') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('MENTOR');

  if (!isStaffOrCoordOrMentor) {
    return { success: false, error: 'Hanya Koordinator/Admin atau Mentor yang dapat mengirim notifikasi reminder.' };
  }

  const assign = (await db
    .prepare(
      `
      SELECT ta.id, ta.task_id, ta.user_id, ta.status, t.title AS task_title,
             t.workspace_id, u_assignee.name AS assignee_name, u_creator.name AS creator_name
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN users u_assignee ON ta.user_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE ta.id = ?
    `
    )
    .bind(assignmentId)
    .first()) as any;

  if (!assign) return { success: false, error: 'Penugasan tidak ditemukan.' };

  const targetTrooperId = assign.user_id;
  if (!targetTrooperId) {
    return { success: false, error: 'Assignee / Trooper tugas ini belum ditentukan.' };
  }

  const sender = (await db
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(session.userId)
    .first()) as { name: string } | null;

  const senderName = sender?.name || 'Tim Evaluator';

  await sendPushNotificationToUser(targetTrooperId, 'TASK', {
    title: `⏰ Reminder Pengerjaan Tugas: ${assign.task_title}`,
    body: `${senderName} mengingatkan Anda untuk segera menyelesaikan & mengunggah hasil karya.${
      customMessage ? ` Catatan: ${customMessage}` : ''
    }`,
    url: assign.workspace_id ? `/dashboard/workspace/${assign.workspace_id}` : '/dashboard',
  });

  await logWorkflowEvent({
    entityType: 'task_assignment',
    entityId: assignmentId,
    fromStatus: assign.status,
    toStatus: assign.status,
    triggeredBy: session.userId,
    note: `${senderName} mengirimkan reminder pengerjaan ke Peserta (${assign.assignee_name || 'Trooper'})`,
  });

  return {
    success: true,
    message: `Reminder pengerjaan berhasil dikirim ke Peserta ${assign.assignee_name ? `(${assign.assignee_name})` : ''}!`,
  };
}
