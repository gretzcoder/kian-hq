'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { logWorkflowEvent } from '@/modules/workflow/events';
import { sendPushNotificationToUsers } from '@/modules/notifications/pushActions';

export interface AssessmentTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: number;
  deadline?: number | null;
  start_at?: number | null;
  exec_type: string; // DESIGNER | VIDEO_EDITOR (the assignment_role used)
  assessment_category?: string | null; // INDIVIDUAL | GROUP
  revision_note?: string | null;
  sparks?: number | null;
}

export interface AssessmentSubmissionRow {
  id: string;            // assignment id
  task_id: string;
  user_id: string;
  user_name: string | null;
  assignment_role: string;
  group_name?: string | null; // e.g. 'Kelompok 1'
  status: string;
  result_url: string | null;
  revision_note: string | null;
  submitted_at: number | null;
  lead_approved: number;
  mentor_approved: number;
  coordinator_approved: number;
  sparks: number | null;
}

/**
 * Helper to parse HTML datetime-local input string into Unix timestamp (ms).
 * If dateStr has no explicit timezone offset, it is parsed as Indonesia WIB (Asia/Jakarta, UTC+7).
 */
function parseIndonesiaDate(dateStr: string | null | undefined): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  const timePart = trimmed.includes('T') ? trimmed.split('T')[1] : trimmed;
  const hasTimezone = timePart.includes('Z') || timePart.includes('+') || (timePart.includes('-') && timePart.indexOf('-') > 0);
  const isoStr = hasTimezone ? trimmed : `${trimmed}:00+07:00`;
  const ts = new Date(isoStr).getTime();
  return isNaN(ts) ? null : ts;
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

  if (!isCoordinator) {
    return { success: false, error: 'Hanya Koordinator yang dapat melakukan inisiasi assessment baru.' };
  }

  const title              = (formData.get('title') as string)?.trim();
  const description        = (formData.get('description') as string)?.trim() || null;
  const execType           = (formData.get('exec_type') as string) || 'DESIGNER';
  const assessmentCategory = (formData.get('assessment_category') as string) === 'GROUP' ? 'GROUP' : 'INDIVIDUAL';
  const groupDataRaw       = formData.get('group_data') as string | null;
  const assignedMentorsRaw = formData.get('assigned_mentors') as string | null;
  const deadlineStr        = formData.get('deadline') as string | null;
  const startAtStr         = (formData.get('start_at') as string) || (formData.get('startAt') as string);

  if (!title) return { success: false, error: 'Judul assessment wajib diisi.' };

  let assignedMentorIds: string[] = [];
  if (assignedMentorsRaw) {
    try {
      assignedMentorIds = JSON.parse(assignedMentorsRaw);
    } catch (_e) {
      assignedMentorIds = assignedMentorsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  const deadline = parseIndonesiaDate(deadlineStr);
  const startAt  = parseIndonesiaDate(startAtStr);

  const ws = await db
    .prepare('SELECT project_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { project_id: string } | null;

  if (!ws) return { success: false, error: 'Workspace tidak ditemukan.' };

  const taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`;
  // New Flow: If created without brief, status is BRIEF_PENDING. If created with brief & by coordinator, WAITING_REVIEW or APPROVED.
  const initialStatus = description && description.trim() ? (isCoordinator ? 'WAITING_REVIEW' : 'WAITING_REVIEW') : 'BRIEF_PENDING';
  const assignedMentorsJson = assignedMentorIds.length > 0 ? JSON.stringify(assignedMentorIds) : null;

  try {
    // 1. Create task
    await db
      .prepare(`
        INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, task_type, assessment_category, assigned_mentors, deadline, start_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'NORMAL', 'ASSESSMENT', ?, ?, ?, ?, ?, strftime('%s', 'now'))
      `)
      .bind(taskId, workspaceId, ws.project_id, title, description, initialStatus, assessmentCategory, assignedMentorsJson, deadline, startAt, session.userId)
      .run();

    const assignmentInitialStatus = 'ASSIGNED';
    let assignedUserIds: string[] = [];

    if (assessmentCategory === 'GROUP' && groupDataRaw) {
      let groups: Array<{ name: string; userIds: string[] }> = [];
      try {
        groups = JSON.parse(groupDataRaw);
      } catch (err) {
        console.error('Failed to parse group_data JSON:', err);
      }

      for (const grp of groups) {
        if (!grp.userIds || grp.userIds.length === 0) continue;
        for (const uId of grp.userIds) {
          assignedUserIds.push(uId);
          const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
          await db
            .prepare(`
              INSERT OR IGNORE INTO task_assignments
                (id, task_id, user_id, assignment_role, group_name, assigned_by, status, deadline, start_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            `)
            .bind(assignId, taskId, uId, execType, grp.name, session.userId, assignmentInitialStatus, deadline, startAt)
            .run();
        }
      }
    } else {
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
        assignedUserIds.push(m.user_id);
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
    }

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: null,
      toStatus: initialStatus,
      triggeredBy: session.userId,
      note: `Assessment "${title}" (${execType}) diinisiasi oleh Koordinator. Status: ${initialStatus}`,
    });

    // Notify assigned mentor(s) via Web Push
    if (assignedMentorIds.length > 0) {
      try {
        sendPushNotificationToUsers(assignedMentorIds, 'TASK', {
          title: `📝 Ditugaskan Input Brief Assessment: ${title}`,
          body: `Koordinator telah menugaskan Anda untuk mengisi brief & instruksi assessment.`,
          url: `/dashboard/workspace/${workspaceId}`,
          category: 'TASK',
          tag: `task_${taskId}`,
        }).catch(() => {});
      } catch (pushErr) {
        console.error('Failed to trigger mentor push notification:', pushErr);
      }
    }

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return {
      success: true,
      taskId,
      message: assignedMentorIds.length > 0
        ? '✓ Assessment diinisiasi. Mentor yang bertugas telah ditugaskan untuk menginput brief/instruksi.'
        : '✓ Assessment diinisiasi. Silakan minta mentor bertugas menginput brief.',
    };
  } catch (err: any) {
    console.error('createAssessmentTask failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mentor fills or updates brief / instructions for an assessment task.
 * Sets status to 'WAITING_REVIEW' so Coordinator can review & ACC.
 */
export async function submitAssessmentBriefByMentor(
  taskId: string,
  workspaceId: string,
  description: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!description?.trim()) return { success: false, error: 'Brief / Instruksi Pengerjaan wajib diisi.' };

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
    return { success: false, error: 'Hanya mentor atau koordinator yang dapat menginput brief assessment.' };
  }

  const task = await db
    .prepare('SELECT title, status, created_by FROM tasks WHERE id = ? AND workspace_id = ?')
    .bind(taskId, workspaceId)
    .first() as { title: string; status: string; created_by: string | null } | null;

  if (!task) return { success: false, error: 'Task assessment tidak ditemukan.' };

  try {
    await db
      .prepare(`
        UPDATE tasks
        SET description = ?, status = 'WAITING_REVIEW', revision_note = NULL
        WHERE id = ? AND workspace_id = ?
      `)
      .bind(description.trim(), taskId, workspaceId)
      .run();

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: task.status,
      toStatus: 'WAITING_REVIEW',
      triggeredBy: session.userId,
      note: `Mentor telah menginput brief assessment "${task.title}" dan mengajukan ke Koordinator untuk ACC`,
    });

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true, message: '✓ Brief berhasil diisi dan diajukan ke Koordinator untuk ACC.' };
  } catch (err: any) {
    console.error('submitAssessmentBriefByMentor failed:', err);
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
        .prepare("UPDATE task_assignments SET status = 'ASSIGNED', start_at = ? WHERE task_id = ? AND result_url IS NULL")
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

    // Brief revision request applies to the parent task (Mentor's brief), not OJT member work submissions.

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
    .prepare('SELECT id, task_id, user_id, group_name, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; user_id: string; group_name: string | null; status: string } | null;

  if (!assignment) return { success: false, error: 'Assignment tidak ditemukan.' };
  if (assignment.user_id !== session.userId) return { success: false, error: 'Forbidden.' };
  if (assignment.status === 'APPROVED') return { success: false, error: 'Sudah disetujui, tidak bisa diubah.' };

  // Validate parent task approval, start date & deadline
  const parentTask = await db
    .prepare('SELECT status, start_at, deadline, extended_deadline, assessment_category FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { status: string; start_at: number | null; deadline: number | null; extended_deadline: number | null; assessment_category: string | null } | null;

  if (!parentTask || parentTask.status !== 'APPROVED') {
    return { success: false, error: 'Assessment ini belum disetujui / ACC oleh Koordinator.' };
  }

  const now = Date.now();
  if (parentTask.start_at && parentTask.start_at > now) {
    return { success: false, error: 'Assessment ini belum dimulai.' };
  }

  const effectiveDeadline = Math.max(parentTask.extended_deadline || 0, parentTask.deadline || 0) || null;
  if (effectiveDeadline && effectiveDeadline < now) {
    return { success: false, error: 'Tenggat waktu (deadline) assessment ini telah berakhir. Pengumpulan tidak dapat dilakukan.' };
  }

  try {
    const isGroup = parentTask.assessment_category === 'GROUP' && assignment.group_name;
    if (isGroup) {
      await db
        .prepare(`
          UPDATE task_assignments
          SET status = 'WAITING_REVIEW', result_url = ?, submitted_at = strftime('%s', 'now'),
              revision_note = NULL, mentor_approved = 0, coordinator_approved = 0, lead_approved = 0
          WHERE task_id = ? AND group_name = ?
        `)
        .bind(resultUrl.trim(), assignment.task_id, assignment.group_name)
        .run();
    } else {
      await db
        .prepare(`
          UPDATE task_assignments
          SET status = 'WAITING_REVIEW', result_url = ?, submitted_at = strftime('%s', 'now'),
              revision_note = NULL, mentor_approved = 0, coordinator_approved = 0, lead_approved = 0
          WHERE id = ?
        `)
        .bind(resultUrl.trim(), assignmentId)
        .run();
    }

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
  sparksAmount: number = 8,
  appreciationNote?: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));

  // Fetch the assignment and its parent task
  const assignment = await db
    .prepare('SELECT id, task_id, group_name, mentor_approved FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; group_name: string | null; mentor_approved: number } | null;

  if (!assignment) return { success: false, error: 'Assignment tidak ditemukan.' };

  const task = await db
    .prepare('SELECT created_by, assessment_category FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { created_by: string | null; assessment_category: string | null } | null;

  const isGroup = task?.assessment_category === 'GROUP' && assignment.group_name;
  const isTaskCreator = task?.created_by != null && task.created_by === session.userId;
  const noteValue = appreciationNote?.trim() || null;

  // Step 2: Coordinator approval (mentor must have already approved)
  if (isCoordinator) {
    if (assignment.mentor_approved !== 1) {
      return { success: false, error: 'Menunggu ACC Mentor pembuat tugas terlebih dahulu.' };
    }

    try {
      if (isGroup) {
        await db
          .prepare(`
            UPDATE task_assignments
            SET coordinator_approved = 1,
                sparks = ?,
                status = 'APPROVED',
                appreciation_note = COALESCE(?, appreciation_note),
                revision_note = NULL,
                reviewed_at = strftime('%s', 'now')
            WHERE task_id = ? AND group_name = ?
          `)
          .bind(sparksAmount, noteValue, assignment.task_id, assignment.group_name)
          .run();
      } else {
        await db
          .prepare(`
            UPDATE task_assignments
            SET coordinator_approved = 1,
                sparks = ?,
                status = 'APPROVED',
                appreciation_note = COALESCE(?, appreciation_note),
                revision_note = NULL,
                reviewed_at = strftime('%s', 'now')
            WHERE id = ?
          `)
          .bind(sparksAmount, noteValue, assignmentId)
          .run();
      }

      await logWorkflowEvent({
        entityType: 'task_assignment',
        entityId: assignmentId,
        fromStatus: 'WAITING_REVIEW',
        toStatus: 'APPROVED',
        triggeredBy: session.userId,
        note: `Koordinator menyetujui assessment dan memberikan ${sparksAmount} Sparks${noteValue ? ` (Note: ${noteValue})` : ''}`,
      });

      // Resolve workspaceId for revalidation
      const wsRow = await db
        .prepare('SELECT workspace_id FROM tasks WHERE id = ?')
        .bind(assignment.task_id)
        .first() as { workspace_id: string | null } | null;
      const resolvedWsId = workspaceId || wsRow?.workspace_id || '';

      revalidatePath(`/dashboard/workspace/${resolvedWsId}`);
      revalidatePath('/dashboard/review');
      revalidatePath('/dashboard');
      return { success: true };
    } catch (err: any) {
      console.error('approveAssessmentSubmission (coordinator) failed:', err);
      return { success: false, error: err.message };
    }
  }

  // Step 1: Creator mentor approval (no sparks, sets mentor_approved + lead_approved)
  if (isTaskCreator) {
    try {
      if (isGroup) {
        await db
          .prepare(`
            UPDATE task_assignments
            SET mentor_approved = 1,
                lead_approved = 1,
                appreciation_note = COALESCE(?, appreciation_note),
                reviewed_at = strftime('%s', 'now')
            WHERE task_id = ? AND group_name = ?
          `)
          .bind(noteValue, assignment.task_id, assignment.group_name)
          .run();
      } else {
        await db
          .prepare(`
            UPDATE task_assignments
            SET mentor_approved = 1,
                lead_approved = 1,
                appreciation_note = COALESCE(?, appreciation_note),
                reviewed_at = strftime('%s', 'now')
            WHERE id = ?
          `)
          .bind(noteValue, assignmentId)
          .run();
      }

      await logWorkflowEvent({
        entityType: 'task_assignment',
        entityId: assignmentId,
        fromStatus: 'WAITING_REVIEW',
        toStatus: 'WAITING_REVIEW',
        triggeredBy: session.userId,
        note: 'Mentor pembuat tugas ACC submission, diteruskan ke Koordinator untuk approval & Sparks',
      });

      const wsRow = await db
        .prepare('SELECT workspace_id FROM tasks WHERE id = ?')
        .bind(assignment.task_id)
        .first() as { workspace_id: string | null } | null;
      const resolvedWsId = workspaceId || wsRow?.workspace_id || '';

      revalidatePath(`/dashboard/workspace/${resolvedWsId}`);
      revalidatePath('/dashboard/review');
      revalidatePath('/dashboard');
      return { success: true };
    } catch (err: any) {
      console.error('approveAssessmentSubmission (mentor) failed:', err);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Anda tidak memiliki wewenang untuk menyetujui submission ini.' };
}

/**
 * Step 1: Mentor (task creator) approves an assessment submission.
 * Sets mentor_approved=1 and lead_approved=1, keeps status=WAITING_REVIEW.
 * The submission then appears in the Coordinator queue for Step 2 (Sparks).
 */
export async function approveAssessmentMentorStep(
  assignmentId: string,
  workspaceId: string,
  note?: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, group_name FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; group_name: string | null } | null;

  if (!assignment) return { success: false, error: 'Assignment tidak ditemukan.' };

  const task = await db
    .prepare('SELECT created_by, workspace_id, assessment_category FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { created_by: string | null; workspace_id: string | null; assessment_category: string | null } | null;

  if (!task) return { success: false, error: 'Task tidak ditemukan.' };

  if (task.created_by !== session.userId) {
    return { success: false, error: 'Hanya mentor pembuat tugas assessment yang berhak melakukan ACC Mentor.' };
  }

  const isGroup = task.assessment_category === 'GROUP' && assignment.group_name;
  const cleanNote = note?.trim() || null;

  try {
    if (isGroup) {
      await db
        .prepare(`
          UPDATE task_assignments
          SET mentor_approved = 1,
              lead_approved = 1,
              appreciation_note = COALESCE(?, appreciation_note),
              reviewed_at = strftime('%s', 'now')
          WHERE task_id = ? AND group_name = ?
        `)
        .bind(cleanNote, assignment.task_id, assignment.group_name)
        .run();
    } else {
      await db
        .prepare(`
          UPDATE task_assignments
          SET mentor_approved = 1,
              lead_approved = 1,
              appreciation_note = COALESCE(?, appreciation_note),
              reviewed_at = strftime('%s', 'now')
          WHERE id = ?
        `)
        .bind(cleanNote, assignmentId)
        .run();
    }

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: 'WAITING_REVIEW',
      toStatus: 'WAITING_REVIEW',
      triggeredBy: session.userId,
      note: cleanNote
        ? `Mentor ACC dengan catatan improvement: ${cleanNote.replace(/<[^>]*>/g, '').substring(0, 100)}`
        : 'Mentor pembuat tugas ACC submission — menunggu approval & Sparks dari Koordinator',
    });

    const resolvedWsId = workspaceId || task.workspace_id || '';
    if (resolvedWsId) {
      revalidatePath(`/dashboard/workspace/${resolvedWsId}`);
    }
    revalidatePath('/dashboard/review');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('approveAssessmentMentorStep failed:', err);
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

  if (!revisionNote?.trim()) return { success: false, error: 'Catatan revisi wajib diisi.' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const assignment = await db
    .prepare('SELECT id, task_id, group_name, status FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as { id: string; task_id: string; group_name: string | null; status: string } | null;

  if (!assignment) return { success: false, error: 'Penugasan tidak ditemukan.' };

  const task = await db
    .prepare('SELECT id, workspace_id, created_by, assessment_category FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; workspace_id: string | null; created_by: string | null; assessment_category: string | null } | null;

  const targetWsId = workspaceId || task?.workspace_id || '';
  try {
    const nextStatus = 'REVISION_REQUESTED';

    await db
      .prepare(`
        UPDATE task_assignments
        SET status = ?, revision_note = ?, reviewed_at = strftime('%s', 'now'), mentor_approved = 0, coordinator_approved = 0
        WHERE id = ?
      `)
      .bind(nextStatus, revisionNote.trim(), assignmentId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: nextStatus,
      triggeredBy: session.userId,
      note: revisionNote.trim(),
    });



    if (targetWsId) {
      revalidatePath(`/dashboard/workspace/${targetWsId}`);
    }
    revalidatePath('/dashboard/review');
    revalidatePath('/dashboard');
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

  const deadline = parseIndonesiaDate(deadlineStr);
  const startAt  = parseIndonesiaDate(startAtStr);

  try {
    const currentTask = await db
      .prepare('SELECT status, created_by FROM tasks WHERE id = ? AND workspace_id = ?')
      .bind(taskId, workspaceId)
      .first() as { status: string; created_by: string | null } | null;

    if (!currentTask) return { success: false, error: 'Assessment tidak ditemukan.' };

    const isPureCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));
    const isTaskCreator = currentTask.created_by != null && currentTask.created_by === session.userId;

    if (!isTaskCreator && !isPureCoordinator) {
      return { success: false, error: 'Hanya pembuat assessment atau Koordinator/Admin yang dapat mengedit assessment ini.' };
    }

    const newStatus = currentTask?.status === 'REVISION_REQUESTED' ? 'WAITING_REVIEW' : (currentTask?.status || 'WAITING_REVIEW');

    await db
      .prepare(`
        UPDATE tasks
        SET title = ?, description = ?, deadline = ?, start_at = ?, status = ?, revision_note = NULL
        WHERE id = ? AND workspace_id = ?
      `)
      .bind(title, description, deadline, startAt, newStatus, taskId, workspaceId)
      .run();

    if (deadline) {
      await db
        .prepare('UPDATE tasks SET extended_deadline = NULL WHERE id = ? AND (extended_deadline IS NOT NULL AND extended_deadline <= ?)')
        .bind(taskId, deadline)
        .run();
    }

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

  try {
    const currentTask = await db
      .prepare('SELECT created_by FROM tasks WHERE id = ? AND workspace_id = ?')
      .bind(taskId, workspaceId)
      .first() as { created_by: string | null } | null;

    if (!currentTask) return { success: false, error: 'Assessment tidak ditemukan.' };

    const isPureCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));
    const isTaskCreator = currentTask.created_by != null && currentTask.created_by === session.userId;

    if (!isTaskCreator && !isPureCoordinator) {
      return { success: false, error: 'Hanya pembuat assessment atau Koordinator/Admin yang dapat menghapus assessment ini.' };
    }
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

// ---------------------------------------------------------------------------
// MANUAL PARTICIPANT MANAGEMENT (Add / Remove OJT Assignment)
// ---------------------------------------------------------------------------

/**
 * Manually removes an OJT participant assignment from an assessment task.
 */
export async function removeAssessmentAssignment(assignmentId: string, workspaceId: string) {
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
    return { success: false, error: 'Hanya Mentor, Koordinator, atau Admin yang dapat mengubah kepesertaan.' };
  }

  try {
    await db
      .prepare('DELETE FROM task_assignments WHERE id = ?')
      .bind(assignmentId)
      .run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('removeAssessmentAssignment failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Manually adds an OJT participant assignment to an assessment task.
 */
export async function addAssessmentAssignment(
  taskId: string,
  userId: string,
  workspaceId: string,
  execType: string = 'DESIGNER'
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
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'))) ||
    isMentorRole;

  if (!isLeader && !isCoordinator) {
    return { success: false, error: 'Hanya Mentor, Koordinator, atau Admin yang dapat menambah kepesertaan.' };
  }

  const task = await db
    .prepare('SELECT deadline, start_at FROM tasks WHERE id = ? AND workspace_id = ?')
    .bind(taskId, workspaceId)
    .first() as { deadline: number | null; start_at: number | null } | null;

  if (!task) return { success: false, error: 'Task assessment tidak ditemukan.' };

  const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(`
        INSERT INTO task_assignments
          (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
        VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, strftime('%s', 'now'))
      `)
      .bind(assignId, taskId, userId, execType, session.userId, task.deadline, task.start_at)
      .run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('addAssessmentAssignment failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Auto-repairs assessment tasks that were corrupted to 'WAITING_REVIEW'
 * even though their assignments have been submitted or approved.
 */
export async function repairAssessmentTaskStatuses(db: any, workspaceId?: string) {
  try {
    const wsClause = workspaceId ? ' AND workspace_id = ?' : '';
    const params = workspaceId ? [workspaceId] : [];
    await db.prepare(`
      UPDATE tasks
      SET status = 'APPROVED', revision_note = NULL
      WHERE task_type = 'ASSESSMENT'
        AND status = 'WAITING_REVIEW'
        ${wsClause}
        AND id IN (
          SELECT DISTINCT task_id
          FROM task_assignments
          WHERE result_url IS NOT NULL
             OR status IN ('WAITING_REVIEW', 'APPROVED', 'REVISION_REQUESTED')
             OR mentor_approved = 1
             OR coordinator_approved = 1
        )
    `).bind(...params).run();
  } catch (err) {
    console.error('repairAssessmentTaskStatuses error:', err);
  }
}

