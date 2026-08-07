'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { logWorkflowEvent } from '@/modules/workflow/events';
import { sendPushNotificationToUsers } from '@/modules/notifications/pushActions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssessmentTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: number;
  deadline?: number | null;
  start_at?: number | null;
  exec_type: string; // DESIGNER | VIDEO_EDITOR (the assignment_role used)
  revision_note?: string | null;
  sparks?: number | null;
}

export interface AssessmentSubmissionRow {
  id: string;            // assignment id
  task_id: string;
  user_id: string;
  user_name: string | null;
  assignment_role: string;
  status: string;
  result_url: string | null;
  revision_note: string | null;
  submitted_at: number | null;
  lead_approved: number;
  mentor_approved: number;
  coordinator_approved: number;
  sparks: number | null;
}

// ---------------------------------------------------------------------------
// CREATE ASSESSMENT TASK + MASS AUTO-ASSIGN
// ---------------------------------------------------------------------------

/**
 * Creates an Assessment task and auto-assigns ALL OJT members (MEMBER role)
 * of the workspace to it with the specified execution role (DESIGNER / VIDEO_EDITOR).
 */
export async function createAssessmentTask(workspaceId: string, formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isLeaderRow = await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(workspaceId, session.userId)
    .first();

  const isMentorRole = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const isLeader = !!isLeaderRow || isMentorRole;
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));

  if (!isLeader && !isCoordinator) {
    return { success: false, error: 'Hanya mentor atau koordinator yang dapat membuat assessment.' };
  }

  const title       = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const execType    = (formData.get('exec_type') as string) || 'DESIGNER';
  const deadlineStr = formData.get('deadline') as string | null;
  const startAtStr  = (formData.get('start_at') as string) || (formData.get('startAt') as string);

  if (!title) return { success: false, error: 'Judul assessment wajib diisi.' };

  let deadline: number | null = null;
  if (deadlineStr) {
    deadline = new Date(deadlineStr).getTime();
    if (isNaN(deadline)) return { success: false, error: 'Format tanggal tenggat waktu tidak valid.' };
  }

  let startAt: number | null = null;
  if (startAtStr?.trim()) {
    startAt = new Date(startAtStr).getTime();
    if (isNaN(startAt)) startAt = null;
  }

  const ws = await db
    .prepare('SELECT project_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { project_id: string } | null;

  if (!ws) return { success: false, error: 'Workspace tidak ditemukan.' };

  const taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`;
  // If created directly by Coordinator, it's auto-approved. If created by Mentor, it goes to WAITING_REVIEW for Coordinator approval.
  const initialStatus = isCoordinator ? 'APPROVED' : 'WAITING_REVIEW';

  try {
    // 1. Create task
    await db
      .prepare(`
        INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, task_type, deadline, start_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'NORMAL', 'ASSESSMENT', ?, ?, ?, strftime('%s', 'now'))
      `)
      .bind(taskId, workspaceId, ws.project_id, title, description, initialStatus, deadline, startAt, session.userId)
      .run();

    // 2. Create task_assignments for all Trooper / OJT members with the selected execType (e.g. VIDEO_EDITOR / DESIGNER).
    // If created by Coordinator, status is 'ASSIGNED'. If created by Mentor, status is 'WAITING_REVIEW'.
    const { results: ojtMembers } = await db
      .prepare(`
        SELECT DISTINCT u.id AS user_id
        FROM users u
        JOIN workspace_members wm ON u.id = wm.user_id
        WHERE wm.workspace_id = ?
          AND wm.team_role != 'LEADER'
          AND (u.user_type IS NULL OR u.user_type != 'STAFF')
          AND u.status = 'ACTIVE'
          AND u.id NOT IN (
            SELECT ur.user_id
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE r.id IN ('role_mentor_troopers', 'role_mentor')
               OR UPPER(r.name) LIKE '%MENTOR%'
          )
          AND u.id NOT IN (
            SELECT ojt_coordinator_id
            FROM workspaces
            WHERE id = ? AND ojt_coordinator_id IS NOT NULL
          )
      `)
      .bind(workspaceId, workspaceId)
      .all();

    const assignmentInitialStatus = isCoordinator ? 'ASSIGNED' : 'WAITING_REVIEW';

    for (const m of ojtMembers as { user_id: string }[]) {
      const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
      await db
        .prepare(`
          INSERT OR IGNORE INTO task_assignments
            (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        `)
        .bind(assignId, taskId, m.user_id, execType, session.userId, assignmentInitialStatus, deadline, startAt)
        .run();
    }

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: null,
      toStatus: initialStatus,
      triggeredBy: session.userId,
      note: isCoordinator
        ? `Assessment "${title}" (${execType}) dipublikasikan oleh Koordinator dan di-assign ke OJT`
        : `Assessment "${title}" (${execType}) diajukan oleh Mentor ke Koordinator untuk di-review`,
    });

    // Async Web Push for assigned OJT members if published directly
    if (isCoordinator && ojtMembers.length > 0) {
      try {
        const assignedIds = ojtMembers.map((m) => m.user_id as string);
        sendPushNotificationToUsers(assignedIds, 'TASK', {
          title: `📝 Assessment Baru: ${title}`,
          body: description?.slice(0, 100) || `Assessment baru telah ditugaskan di workspace.`,
          url: `/dashboard/workspace/${workspaceId}`,
          category: 'TASK',
          tag: `task_${taskId}`,
        }).catch(() => {});
      } catch (pushErr) {
        console.error('Failed to trigger assessment Web Push:', pushErr);
      }
    }

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return {
      success: true,
      taskId,
      message: isCoordinator
        ? '✓ Assessment dipublikasikan & langsung di-assign ke seluruh OJT.'
        : '📥 Assessment berhasil diajukan ke Koordinator untuk di-review & disetujui.',
    };
  } catch (err: any) {
    console.error('createAssessmentTask failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Coordinator approves mentor's assessment draft -> changes task status to APPROVED, sets sparks, & mass-assigns all OJT.
 */
export async function approveAssessmentTask(
  taskId: string,
  workspaceId: string,
  execType: string = 'DESIGNER',
  sparksAmount?: number
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));

  if (!isCoordinator) {
    return { success: false, error: 'Hanya Koordinator yang memiliki wewenang menyetujui ajuan assessment.' };
  }

  const task = await db
    .prepare('SELECT id, deadline, status, start_at FROM tasks WHERE id = ? AND workspace_id = ?')
    .bind(taskId, workspaceId)
    .first() as { id: string; deadline: number | null; status: string; start_at: number | null } | null;

  if (!task) return { success: false, error: 'Task assessment tidak ditemukan.' };

  const now = Date.now();
  let updatedStartAt = task.start_at;

  // If start_at was not set, OR was planned for today / earlier than now, adjust to now
  if (!task.start_at) {
    updatedStartAt = now;
  } else {
    const startDate = new Date(task.start_at);
    const nowDate = new Date(now);

    const isSameDay =
      startDate.getFullYear() === nowDate.getFullYear() &&
      startDate.getMonth() === nowDate.getMonth() &&
      startDate.getDate() === nowDate.getDate();

    if (isSameDay || task.start_at <= now) {
      updatedStartAt = now;
    }
  }

  const finalSparks = sparksAmount && sparksAmount >= 1 && sparksAmount <= 10 ? sparksAmount : null;

  try {
    // 1. Update task status to APPROVED (Published), set sparks & clear revision note
    await db
      .prepare("UPDATE tasks SET status = 'APPROVED', start_at = ?, sparks = ?, revision_note = NULL WHERE id = ?")
      .bind(updatedStartAt, finalSparks, taskId)
      .run();

    // 2. Check if assignments already exist
    const { results: existingAssignments } = await db
      .prepare('SELECT id FROM task_assignments WHERE task_id = ?')
      .bind(taskId)
      .all();

    if (existingAssignments && existingAssignments.length > 0) {
      await db
        .prepare("UPDATE task_assignments SET status = 'ASSIGNED', start_at = ? WHERE task_id = ? AND status = 'WAITING_REVIEW'")
        .bind(updatedStartAt, taskId)
        .run();
    } else {
      // Mass-assign to all Trooper / OJT members
      const { results: ojtMembers } = await db
        .prepare(`
          SELECT DISTINCT u.id AS user_id
          FROM users u
          JOIN workspace_members wm ON u.id = wm.user_id
          WHERE wm.workspace_id = ?
            AND wm.team_role != 'LEADER'
            AND (u.user_type IS NULL OR u.user_type != 'STAFF')
            AND u.status = 'ACTIVE'
            AND u.id NOT IN (
              SELECT ur.user_id
              FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
              WHERE r.id IN ('role_mentor_troopers', 'role_mentor')
                 OR UPPER(r.name) LIKE '%MENTOR%'
            )
            AND u.id NOT IN (
              SELECT ojt_coordinator_id
              FROM workspaces
              WHERE id = ? AND ojt_coordinator_id IS NOT NULL
            )
        `)
        .bind(workspaceId, workspaceId)
        .all();

      for (const m of ojtMembers as { user_id: string }[]) {
        const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
        await db
          .prepare(`
            INSERT OR IGNORE INTO task_assignments
              (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
            VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, strftime('%s', 'now'))
          `)
          .bind(assignId, taskId, m.user_id, execType, session.userId, task.deadline, updatedStartAt)
          .run();
      }
    }

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: task.status,
      toStatus: 'APPROVED',
      triggeredBy: session.userId,
      note: finalSparks
        ? `Koordinator menyetujui ajuan assessment brief [Sparks: ${finalSparks}] dan mempublikasikannya ke OJT`
        : `Koordinator menyetujui ajuan assessment brief dan mempublikasikannya ke OJT`,
    });

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('approveAssessmentTask failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Coordinator requests revision on mentor's assessment brief -> sets task status to REVISION_REQUESTED.
 */
export async function requestAssessmentBriefRevision(
  taskId: string,
  workspaceId: string,
  revisionNote: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!revisionNote?.trim()) return { success: false, error: 'Catatan revisi brief wajib diisi.' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));

  if (!isCoordinator) {
    return { success: false, error: 'Hanya Koordinator yang memiliki wewenang meminta revisi brief assessment.' };
  }

  try {
    await db
      .prepare("UPDATE tasks SET status = 'REVISION_REQUESTED', revision_note = ? WHERE id = ? AND workspace_id = ?")
      .bind(revisionNote.trim(), taskId, workspaceId)
      .run();

    await db
      .prepare("UPDATE task_assignments SET status = 'REVISION_REQUESTED', revision_note = ? WHERE task_id = ? AND status = 'WAITING_REVIEW'")
      .bind(revisionNote.trim(), taskId)
      .run();

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: 'WAITING_REVIEW',
      toStatus: 'REVISION_REQUESTED',
      triggeredBy: session.userId,
      note: `Koordinator meminta revisi brief assessment: "${revisionNote.trim()}"`,
    });

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('requestAssessmentBriefRevision failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// SUBMIT ASSESSMENT WORK (OJT)
// ---------------------------------------------------------------------------

/**
 * OJT submits their result for an assessment task assignment.
 */
export async function submitAssessmentWork(assignmentId: string, resultUrl: string, workspaceId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!resultUrl?.trim()) return { success: false, error: 'Link hasil kerja wajib diisi.' };

  const db = await getDB();

  // Security: only the assigned user can submit
  const assignment = await db
    .prepare('SELECT id, task_id, user_id, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; user_id: string; status: string } | null;

  if (!assignment) return { success: false, error: 'Assignment tidak ditemukan.' };
  if (assignment.user_id !== session.userId) return { success: false, error: 'Forbidden.' };
  if (assignment.status === 'APPROVED') return { success: false, error: 'Sudah disetujui, tidak bisa diubah.' };

  // Validate parent task approval & start date
  const parentTask = await db
    .prepare('SELECT status, start_at FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { status: string; start_at: number | null } | null;

  if (!parentTask || parentTask.status !== 'APPROVED') {
    return { success: false, error: 'Assessment ini belum disetujui / ACC oleh Koordinator.' };
  }

  const now = Date.now();
  if (parentTask.start_at && parentTask.start_at > now) {
    return { success: false, error: 'Assessment ini belum dimulai.' };
  }

  try {
    await db
      .prepare(`
        UPDATE task_assignments
        SET status = 'WAITING_REVIEW', result_url = ?, submitted_at = strftime('%s', 'now')
        WHERE id = ?
      `)
      .bind(resultUrl.trim(), assignmentId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: 'WAITING_REVIEW',
      triggeredBy: session.userId,
      note: 'Assessment submission submitted',
    });

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('submitAssessmentWork failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// APPROVE / REVISE ASSESSMENT (Mentor / Coordinator)
// ---------------------------------------------------------------------------

export async function approveAssessmentSubmission(
  assignmentId: string,
  workspaceId: string,
  sparksAmount: number
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));

  if (!isCoordinator) {
    return { success: false, error: 'Hanya Koordinator yang berwenang menyetujui submission dan memberikan Sparks.' };
  }

  try {
    await db
      .prepare(`
        UPDATE task_assignments
        SET coordinator_approved = 1,
            sparks = ?,
            status = 'APPROVED',
            reviewed_at = strftime('%s', 'now')
        WHERE id = ?
      `)
      .bind(sparksAmount, assignmentId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: 'WAITING_REVIEW',
      toStatus: 'APPROVED',
      triggeredBy: session.userId,
      note: `Koordinator menyetujui assessment dan memberikan ${sparksAmount} Sparks`,
    });

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('approveAssessmentSubmission failed:', err);
    return { success: false, error: err.message };
  }
}

export async function requestAssessmentRevision(
  assignmentId: string,
  workspaceId: string,
  revisionNote: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isLeaderRow = await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(workspaceId, session.userId)
    .first();

  const isMentorRole = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const isLeader = !!isLeaderRow || isMentorRole;
  const isCoordinator =
    (ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'))) || isMentorRole;

  if (!isLeader && !isCoordinator) return { success: false, error: 'Forbidden.' };
  if (!revisionNote?.trim()) return { success: false, error: 'Catatan revisi wajib diisi.' };

  try {
    await db
      .prepare(`
        UPDATE task_assignments
        SET status = 'REVISION_REQUESTED', revision_note = ?, reviewed_at = strftime('%s', 'now')
        WHERE id = ?
      `)
      .bind(revisionNote.trim(), assignmentId)
      .run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('requestAssessmentRevision failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mentor/Coordinator/Admin updates an assessment task.
 */
export async function updateAssessmentTask(taskId: string, workspaceId: string, formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isLeaderRow = await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(workspaceId, session.userId)
    .first();

  const isMentorRole = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const isLeader = !!isLeaderRow || isMentorRole;
  const isCoordinator =
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'))) ||
    isMentorRole;

  if (!isLeader && !isCoordinator) {
    return { success: false, error: 'Hanya Mentor, Koordinator, atau Admin yang dapat mengedit assessment.' };
  }

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const execType = (formData.get('exec_type') as string) || 'DESIGNER';
  const deadlineStr = formData.get('deadline') as string | null;
  const startAtStr = (formData.get('start_at') as string) || (formData.get('startAt') as string);

  if (!title) return { success: false, error: 'Judul assessment wajib diisi.' };

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
    const currentTask = await db
      .prepare('SELECT status FROM tasks WHERE id = ?')
      .bind(taskId)
      .first() as { status: string } | null;

    const newStatus = currentTask?.status === 'REVISION_REQUESTED' ? 'WAITING_REVIEW' : (currentTask?.status || 'WAITING_REVIEW');

    await db
      .prepare(`
        UPDATE tasks
        SET title = ?, description = ?, deadline = ?, start_at = ?, status = ?, revision_note = NULL
        WHERE id = ? AND workspace_id = ?
      `)
      .bind(title, description, deadline, startAt, newStatus, taskId, workspaceId)
      .run();

    await db
      .prepare(`
        UPDATE task_assignments
        SET assignment_role = ?, deadline = ?, start_at = ?
        WHERE task_id = ?
      `)
      .bind(execType, deadline, startAt, taskId)
      .run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('updateAssessmentTask failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mentor/Coordinator/Admin soft-deletes an assessment task and associated assignments.
 */
export async function deleteAssessmentTask(taskId: string, workspaceId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isLeaderRow = await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(workspaceId, session.userId)
    .first();

  const isMentorRole = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const isLeader = !!isLeaderRow || isMentorRole;
  const isCoordinator =
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'))) ||
    isMentorRole;

  if (!isLeader && !isCoordinator) {
    return { success: false, error: 'Hanya Mentor, Koordinator, atau Admin yang dapat menghapus tugas assessment.' };
  }

  try {
    await db
      .prepare("UPDATE tasks SET status = 'DELETED', sparks = NULL WHERE id = ? AND workspace_id = ?")
      .bind(taskId, workspaceId)
      .run();

    await db
      .prepare("DELETE FROM task_assignments WHERE task_id = ?")
      .bind(taskId)
      .run();

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: 'ACTIVE',
      toStatus: 'DELETED',
      triggeredBy: session.userId,
      note: 'Assessment task dihapus',
    });

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('deleteAssessmentTask failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Toggles an emoji reaction on a specific assessment submission.
 */
export async function toggleAssessmentReaction(
  assignmentId: string,
  emoji: string,
  workspaceId: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!emoji?.trim()) return { success: false, error: 'Emoji wajib diisi.' };

  const db = await getDB();

  try {
    const existing = await db
      .prepare('SELECT 1 FROM assessment_submission_reactions WHERE assignment_id = ? AND user_id = ? AND emoji = ?')
      .bind(assignmentId, session.userId, emoji)
      .first();

    if (existing) {
      await db
        .prepare('DELETE FROM assessment_submission_reactions WHERE assignment_id = ? AND user_id = ? AND emoji = ?')
        .bind(assignmentId, session.userId, emoji)
        .run();
    } else {
      await db
        .prepare('INSERT INTO assessment_submission_reactions (assignment_id, user_id, emoji) VALUES (?, ?, ?)')
        .bind(assignmentId, session.userId, emoji)
        .run();
    }

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('toggleAssessmentReaction failed:', err);
    return { success: false, error: err.message };
  }
}
