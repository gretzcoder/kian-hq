'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, hasPermission, hasWorkspacePermission, getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { validateTransition } from '@/modules/workflow/engine';
import { logWorkflowEvent } from '@/modules/workflow/events';
import { sendPushNotificationToUser, sendPushNotificationToUsers } from '@/modules/notifications/pushActions';
import { parseIndonesiaDate } from '@/lib/dateUtils';
import { invalidateWorkspaceTaskCache } from '@/modules/workspaces/taskPollActions';
import { invalidateLeaderboardCache } from '@/modules/leaderboard/actions';
import { syncGroupAndTeamTaskAssignments } from '@/modules/workspaces/assessmentActions';

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
  const checkRolePrereq = async (prevRole: string, roleName: string) => {
    const allPrev = await db
      .prepare(`SELECT user_id, status FROM task_assignments WHERE task_id = ? AND assignment_role = ?`)
      .bind(taskId, prevRole)
      .all();
    const rows = (allPrev.results as any[]) || [];
    if (rows.length === 0) return { allowed: true };

    if (userId) {
      const myRow = rows.find((r) => r.user_id === userId);
      if (myRow) {
        if (!['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(myRow.status)) {
          return { allowed: false, error: `Tidak dapat melanjutkan step ${role} sebelum step ${roleName} Anda disetujui QC.` };
        }
        return { allowed: true };
      }
    }

    const hasApproved = rows.some((r) => ['APPROVED', 'LOCKED', 'PUBLISHED', 'DONE'].includes(r.status));
    if (!hasApproved) {
      return { allowed: false, error: `Tidak dapat melanjutkan step ${role} sebelum step ${roleName} disetujui QC.` };
    }
    return { allowed: true };
  };

  if (role === 'PLANNER') {
    return checkRolePrereq('RESEARCHER', 'Research');
  } else if (['CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(role)) {
    const planCheck = await checkRolePrereq('PLANNER', 'Planning');
    if (!planCheck.allowed) return planCheck;

    const resCheck = await checkRolePrereq('RESEARCHER', 'Research');
    if (!resCheck.allowed) return resCheck;
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Helper: Parse Direct Brief Output Slots
// ---------------------------------------------------------------------------
function parseSlotsFromDescription(description: string | null | undefined): Array<{
  id: string;
  name: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  deadline?: string | null;
  specificBrief?: string | null;
}> {
  if (!description) return [];
  const match = description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*(\[[\s\S]*?\])\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => {
          if (typeof item === 'string') {
            return { id: `slot_${idx + 1}`, name: item.trim() };
          }
          return {
            id: item.id || `slot_${idx + 1}`,
            name: (item.name || '').trim(),
            assignedUserId: item.assignedUserId || null,
            assignedUserName: item.assignedUserName || null,
            deadline: item.deadline || null,
            specificBrief: item.specificBrief || null,
          };
        }).filter((s) => s.name.length > 0);
      }
    } catch {}
  }
  return [];
}

// ---------------------------------------------------------------------------
// Helper: Calculate Fair Rolling Creative Assignments (Researcher, Planner, Creator)
// ---------------------------------------------------------------------------
export async function calculateNextRollingAssignments(
  db: any,
  workspaceId: string,
  outputType: 'DESIGN' | 'VIDEO' | 'OTHER'
): Promise<{
  researcherId: string | null;
  plannerId: string | null;
  creatorId: string | null;
  assignments: Array<{ userId: string; role: string }>;
}> {
  // 1. Fetch all active Troopers in this workspace (excluding staff/mentors)
  const { results: rawTroopers } = await db
    .prepare(`
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN workspace_members wm ON u.id = wm.user_id
      LEFT JOIN workspace_mentors wmen ON wmen.workspace_id = wm.workspace_id AND wmen.user_id = u.id
      WHERE wm.workspace_id = ?
        AND wmen.user_id IS NULL
        AND (u.user_type IS NULL OR u.user_type != 'STAFF')
        AND u.status = 'ACTIVE'
      ORDER BY wm.created_at ASC
    `)
    .bind(workspaceId)
    .all();

  const troopers = (rawTroopers as { id: string; name: string }[]) || [];
  if (troopers.length === 0) {
    return { researcherId: null, plannerId: null, creatorId: null, assignments: [] };
  }

  const creatorRole = outputType === 'VIDEO' ? 'VIDEO_EDITOR' : outputType === 'OTHER' ? 'CREATOR' : 'DESIGNER';

  if (troopers.length === 1) {
    const single = troopers[0].id;
    return {
      researcherId: single,
      plannerId: single,
      creatorId: single,
      assignments: [
        { userId: single, role: 'RESEARCHER' },
        { userId: single, role: 'PLANNER' },
        { userId: single, role: creatorRole },
      ],
    };
  }

  // 2. Fetch past task assignments history in this workspace
  const { results: rawHistory } = await db
    .prepare(`
      SELECT ta.user_id, ta.assignment_role, ta.created_at, t.created_at as task_created_at
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE t.workspace_id = ? AND t.status != 'DELETED'
      ORDER BY ta.created_at DESC
    `)
    .bind(workspaceId)
    .all();

  const history = (rawHistory as any[]) || [];

  // Group stats per trooper
  const userStats = new Map<
    string,
    {
      userId: string;
      totalAssigned: number;
      lastAssignedTime: number;
      roleCounts: Record<string, number>;
      lastRole: string | null;
    }
  >();

  for (const tr of troopers) {
    userStats.set(tr.id, {
      userId: tr.id,
      totalAssigned: 0,
      lastAssignedTime: 0,
      roleCounts: { RESEARCHER: 0, PLANNER: 0, CREATOR: 0 },
      lastRole: null,
    });
  }

  for (const h of history) {
    const stat = userStats.get(h.user_id);
    if (stat) {
      stat.totalAssigned++;
      const time = Number(h.created_at || h.task_created_at || 0);
      if (time > stat.lastAssignedTime) {
        stat.lastAssignedTime = time;
        if (!stat.lastRole) {
          const norm = ['DESIGNER', 'VIDEO_EDITOR', 'CREATOR'].includes(h.assignment_role)
            ? 'CREATOR'
            : h.assignment_role;
          stat.lastRole = norm;
        }
      }
      const roleKey = ['DESIGNER', 'VIDEO_EDITOR', 'CREATOR'].includes(h.assignment_role)
        ? 'CREATOR'
        : h.assignment_role;
      if (stat.roleCounts[roleKey] !== undefined) {
        stat.roleCounts[roleKey]++;
      }
    }
  }

  // 3. Selection & Rotation Logic: Prioritize members who haven't worked or worked least
  const candidateList = Array.from(userStats.values()).sort((a, b) => {
    if (a.totalAssigned !== b.totalAssigned) {
      return a.totalAssigned - b.totalAssigned;
    }
    return a.lastAssignedTime - b.lastAssignedTime;
  });

  const selectedTroopers = candidateList.slice(0, Math.min(3, candidateList.length));

  if (selectedTroopers.length === 2) {
    const [u0, u1] = selectedTroopers;
    if (u0.lastRole === 'RESEARCHER') {
      return {
        researcherId: u1.userId,
        plannerId: u0.userId,
        creatorId: u1.userId,
        assignments: [
          { userId: u1.userId, role: 'RESEARCHER' },
          { userId: u0.userId, role: 'PLANNER' },
          { userId: u1.userId, role: creatorRole },
        ],
      };
    } else {
      return {
        researcherId: u0.userId,
        plannerId: u1.userId,
        creatorId: u0.userId,
        assignments: [
          { userId: u0.userId, role: 'RESEARCHER' },
          { userId: u1.userId, role: 'PLANNER' },
          { userId: u0.userId, role: creatorRole },
        ],
      };
    }
  }

  // 3 Troopers selected: Cyclic permutation / Fair role distribution
  // Role sequence: RESEARCHER -> PLANNER -> CREATOR -> RESEARCHER
  const nextRoleOf = (r: string | null) => {
    if (r === 'RESEARCHER') return 'PLANNER';
    if (r === 'PLANNER') return 'CREATOR';
    if (r === 'CREATOR') return 'RESEARCHER';
    return null;
  };

  const users = [selectedTroopers[0], selectedTroopers[1], selectedTroopers[2]];
  const assignedRoles: Record<string, string> = {};
  const unassignedRoles = new Set(['RESEARCHER', 'PLANNER', 'CREATOR']);

  for (const u of users) {
    const preferred = nextRoleOf(u.lastRole);
    if (preferred && unassignedRoles.has(preferred)) {
      assignedRoles[preferred] = u.userId;
      unassignedRoles.delete(preferred);
    }
  }

  // Fill remaining unassigned roles
  const remainingUsers = users.filter((u) => !Object.values(assignedRoles).includes(u.userId));
  for (const role of Array.from(unassignedRoles)) {
    const u = remainingUsers.shift() || users[0];
    assignedRoles[role] = u.userId;
  }

  const rId = assignedRoles['RESEARCHER'] || users[0].userId;
  const pId = assignedRoles['PLANNER'] || users[1].userId;
  const cId = assignedRoles['CREATOR'] || users[2].userId;

  return {
    researcherId: rId,
    plannerId: pId,
    creatorId: cId,
    assignments: [
      { userId: rId, role: 'RESEARCHER' },
      { userId: pId, role: 'PLANNER' },
      { userId: cId, role: creatorRole },
    ],
  };
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
  const taskExecutionMode = (formData.get('taskExecutionMode') as string) || 'ROLLING'; // 'ROLLING' | 'ALL_MEMBERS'
  
  // OJT fields
  const parentTaskId = formData.get('parentTaskId') as string || null;

  if (!title?.trim()) {
    return { success: false, error: 'Judul tugas wajib diisi.' };
  }

  if (!deadlineStr?.trim()) {
    return { success: false, error: 'Tenggat waktu (Deadline) wajib diisi.' };
  }

  if (!['DESIGN', 'VIDEO', 'OTHER'].includes(outputType)) {
    return { success: false, error: 'Jenis output karya wajib dipilih (Design, Video, atau Other).' };
  }

  const isDirectBrief = (formData.get('isDirectBrief') as string) === 'true' || (formData.get('briefSource') as string) === 'DIRECT_COORDINATOR';
  const directBriefCategoriesStr = formData.get('directBriefCategories') as string;
  let parsedSlots: any[] = [];
  if (directBriefCategoriesStr) {
    try {
      const rawParsed = JSON.parse(directBriefCategoriesStr);
      if (Array.isArray(rawParsed)) {
        parsedSlots = rawParsed.map((item, idx) => {
          if (typeof item === 'string') {
            return { id: `slot_${idx + 1}`, name: item.trim() };
          }
          return {
            id: item.id || `slot_${idx + 1}`,
            name: (item.name || '').trim(),
            assignedUserId: item.assignedUserId || null,
            assignedUserName: item.assignedUserName || null,
            deadline: item.deadline || null,
            specificBrief: item.specificBrief || null,
          };
        }).filter((s: any) => s.name && s.name.length > 0);
      }
    } catch {}
  }

  const briefUrl = (formData.get('briefUrl') as string) || (formData.get('brief_url') as string);
  const assigneeUserId = (formData.get('assigneeUserId') as string) || (formData.get('assigned_user_id') as string);

  let finalDescription = description ? description.trim() : '';
  if (isDirectBrief) {
    if (parsedSlots.length > 0) {
      finalDescription = `[DIRECT_BRIEF_CATEGORIES: ${JSON.stringify(parsedSlots)}]\n[DIRECT_BRIEF]\n${finalDescription}`;
    } else if (!finalDescription.includes('[DIRECT_BRIEF]')) {
      finalDescription = `[DIRECT_BRIEF]\n${finalDescription}`;
    }
  }
  if (briefUrl && briefUrl.trim() && !finalDescription.includes(briefUrl.trim())) {
    finalDescription = `${finalDescription}\n📎 Link Brief: ${briefUrl.trim()}`;
  }

  const taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`;
  const deadline = parseIndonesiaDate(deadlineStr) ?? new Date(deadlineStr).getTime();
  const startAt = parseIndonesiaDate(startAtStr);

  const taskTypeValue = isDirectBrief ? 'DIRECT_BRIEF' : outputType;
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
        finalDescription || null, 
        initialStatus, 
        priority, 
        session.userId, 
        deadline,
        startAt,
        taskTypeValue,
        parentTaskId
      )
      .run();

    const defaultRole = outputType === 'VIDEO' ? 'VIDEO_EDITOR' : outputType === 'OTHER' ? 'CREATOR' : 'DESIGNER';
    const stepRoles = outputType === 'VIDEO'
      ? ['RESEARCHER', 'PLANNER', 'VIDEO_EDITOR']
      : outputType === 'OTHER'
      ? ['RESEARCHER', 'PLANNER', 'CREATOR']
      : ['RESEARCHER', 'PLANNER', 'DESIGNER'];

    if (assigneeUserId && assigneeUserId.trim()) {
      // Direct assignment: assign ONLY the selected Trooper to the task step roles
      for (const role of stepRoles) {
        const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
        await db
          .prepare(`
            INSERT OR IGNORE INTO task_assignments
              (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
            VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, strftime('%s', 'now'))
          `)
          .bind(assignId, taskId, assigneeUserId.trim(), role, session.userId, deadline, startAt)
          .run();
      }
    } else if (isDirectBrief) {
      const assignedSlotUserIds = new Set<string>();
      // 1. Assign users assigned to specific slots
      for (const slot of parsedSlots) {
        if (slot.assignedUserId) {
          assignedSlotUserIds.add(slot.assignedUserId);
          const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
          const slotDeadline = slot.deadline ? (parseIndonesiaDate(slot.deadline) ?? new Date(slot.deadline).getTime()) : deadline;
          await db
            .prepare(`
              INSERT OR IGNORE INTO task_assignments
                (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
              VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, strftime('%s', 'now'))
            `)
            .bind(assignId, taskId, slot.assignedUserId, slot.name, session.userId, slotDeadline, startAt)
            .run();
        }
      }

      // 2. Mass auto-assign active OJT / Trooper members of workspace ONLY if no specific slots were assigned
      if (assignedSlotUserIds.size === 0) {
        const { results: ojtMembers } = await db
          .prepare(`
            SELECT DISTINCT u.id AS user_id
            FROM users u
            JOIN workspace_members wm ON u.id = wm.user_id
            WHERE wm.workspace_id = ?
              AND wm.team_role != 'LEADER'
              AND (u.user_type IS NULL OR u.user_type != 'STAFF')
              AND u.status = 'ACTIVE'
          `)
          .bind(workspaceId)
          .all();

        for (const m of (ojtMembers as { user_id: string }[])) {
          const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
          await db
            .prepare(`
              INSERT OR IGNORE INTO task_assignments
                (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
              VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, strftime('%s', 'now'))
            `)
            .bind(assignId, taskId, m.user_id, defaultRole, session.userId, deadline, startAt)
            .run();
        }
      }
    } else if (ws.workspace_type === 'MENTOR') {
      // Auto-assign all mentor members ONLY if no specific assignee was selected
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
    } else {
      // ── Standard Troopers Workspace ──────────────────────────────────────
      if (taskExecutionMode === 'ALL_MEMBERS') {
        // Mode 2: Semua Anggota Ikut Serta Semua Peran (Tugas Individu)
        const { results: trooperMembers } = await db
          .prepare(`
            SELECT DISTINCT u.id AS user_id
            FROM users u
            JOIN workspace_members wm ON u.id = wm.user_id
            LEFT JOIN workspace_mentors wmen ON wmen.workspace_id = wm.workspace_id AND wmen.user_id = u.id
            WHERE wm.workspace_id = ?
              AND wmen.user_id IS NULL
              AND (u.user_type IS NULL OR u.user_type != 'STAFF')
              AND u.status = 'ACTIVE'
          `)
          .bind(workspaceId)
          .all();

        for (const m of (trooperMembers as { user_id: string }[])) {
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
      } else {
        // Mode 1: Sistem Role Rolling Otomatis (Kolaborasi Tim)
        const rolling = await calculateNextRollingAssignments(db, workspaceId, outputType as any);
        for (const item of rolling.assignments) {
          const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
          await db
            .prepare(`
              INSERT OR IGNORE INTO task_assignments
                (id, task_id, user_id, assignment_role, assigned_by, status, deadline, start_at, created_at)
              VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, strftime('%s', 'now'))
            `)
            .bind(assignId, taskId, item.userId, item.role, session.userId, deadline, startAt)
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
      note: `Task "${title}" created (Output: ${outputType}, Mode: ${taskExecutionMode}${ws.workspace_type === 'MENTOR' ? ', Workspace: MENTOR' : ''})`,
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

    if (workspaceId) {
      await invalidateWorkspaceTaskCache(workspaceId);
    }
    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    revalidatePath('/dashboard/workspace');
    return { success: true, taskId };
  } catch (err: any) {
    console.error('createTask failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Automatically syncs the overall task status based on the current state of its assignments.
 */
export async function syncTaskOverallStatus(db: any, taskId: string): Promise<string> {
  const { results: assignments } = await db
    .prepare('SELECT status FROM task_assignments WHERE task_id = ?')
    .bind(taskId)
    .all();

  const task = await db
    .prepare('SELECT id, status FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { id: string; status: string } | null;

  if (!task) return 'TODO';

  const rows = (assignments as any[]) || [];
  let nextStatus = 'IN_PROGRESS';

  if (rows.length === 0) {
    nextStatus = 'TODO';
  } else {
    const isAllApproved = rows.every((a) => ['APPROVED', 'DONE', 'PUBLISHED', 'IN_PRODUCTION', 'IN_UPLOAD', 'LOCKED'].includes(a.status));
    if (isAllApproved) {
      nextStatus = 'APPROVED';
    } else {
      const isAllWaitingReview = rows.every((a) => ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'DONE', 'PUBLISHED', 'LOCKED'].includes(a.status)) &&
        rows.some((a) => ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(a.status));
      if (isAllWaitingReview) {
        nextStatus = 'WAITING_REVIEW';
      } else {
        nextStatus = 'IN_PROGRESS';
      }
    }
  }

  if (task.status !== nextStatus && task.status !== 'DELETED') {
    await db
      .prepare('UPDATE tasks SET status = ? WHERE id = ?')
      .bind(nextStatus, taskId)
      .run();
  }

  return nextStatus;
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

    await syncTaskOverallStatus(db, taskId);

    if (task.workspace_id) {
      await invalidateWorkspaceTaskCache(task.workspace_id);
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

    await syncTaskOverallStatus(db, taskId);

    if (task.workspace_id) {
      await invalidateWorkspaceTaskCache(task.workspace_id);
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

  const db = await getDB();

  const assignment = await db
    .prepare(`
      SELECT ta.id, ta.task_id, t.project_id, t.workspace_id
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.id = ?
    `)
    .bind(assignmentId)
    .first() as { id: string; task_id: string; project_id: string; workspace_id: string | null } | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const workspaceId = assignment.workspace_id || '';
  const authorized = await hasWorkspacePermission(session.userId, workspaceId, 'ASSIGN_TASK');
  if (!authorized) {
    throw new Error('Forbidden: You do not have permission to modify task assignments in this workspace.');
  }

  try {
    await db
      .prepare('DELETE FROM task_assignments WHERE id = ?')
      .bind(assignmentId)
      .run();

    await syncTaskOverallStatus(db, assignment.task_id);

    if (assignment.workspace_id) {
      await invalidateWorkspaceTaskCache(assignment.workspace_id);
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

    await db
      .prepare("UPDATE task_assignments SET status = 'IN_PROGRESS' WHERE id = ?")
      .bind(assignmentId)
      .run();

    await logWorkflowEvent({
      entityType: 'task_assignment',
      entityId: assignmentId,
      fromStatus: assignment.status,
      toStatus: 'IN_PROGRESS',
      triggeredBy: session.userId,
      note: 'Started work',
    });

    await syncTaskOverallStatus(db, assignment.task_id);

    if (task?.workspace_id) {
      await invalidateWorkspaceTaskCache(task.workspace_id);
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
export async function submitResult(assignmentId: string, resultUrl: string, selectedCategory?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!resultUrl?.trim()) {
    return { success: false, error: 'Result URL is required.' };
  }

  const db = await getDB();

  const assignment = await db
    .prepare('SELECT id, task_id, user_id, status, assignment_role, submitted_at, result_url FROM task_assignments WHERE id = ?')
    .bind(assignmentId)
    .first() as (AssignmentRow & { assignment_role: string; submitted_at?: number | null; result_url?: string | null }) | null;

  if (!assignment) return { success: false, error: 'Assignment not found.' };

  const isOwner = assignment.user_id === session.userId;
  const canUpload = await hasPermission(session.userId, 'UPLOAD');

  if (!isOwner && !canUpload) {
    return { success: false, error: 'You can only submit results for your own assignments.' };
  }

  try {
    const task = await db
      .prepare('SELECT id, project_id, workspace_id, status, task_type, description, parent_task_id, start_at, deadline, extended_deadline FROM tasks WHERE id = ?')
      .bind(assignment.task_id)
      .first() as { id: string; project_id: string; workspace_id: string | null; status: string; task_type: string; description: string | null; parent_task_id: string | null; start_at: number | null; deadline: number | null; extended_deadline: number | null } | null;

    const nowMs = Date.now();
    if (task?.start_at && task.start_at > nowMs) {
      return { success: false, error: 'Tugas ini belum dimulai.' };
    }

    const isFirstSubmission = !assignment.submitted_at && (!assignment.result_url || assignment.result_url.trim() === '') && !['WAITING_REVIEW', 'REVISION_REQUESTED', 'RESUBMITTED', 'APPROVED', 'DONE', 'PUBLISHED'].includes(assignment.status);

    const effectiveDeadline = Math.max(task?.extended_deadline || 0, task?.deadline || 0) || null;
    if (isFirstSubmission && effectiveDeadline && effectiveDeadline < nowMs) {
      return { success: false, error: 'Tenggat waktu (deadline) submit pertama telah berakhir. Pengumpulan tugas ditutup.' };
    }

    if (task?.parent_task_id) {
      const parent = await db
        .prepare('SELECT status FROM tasks WHERE id = ?')
        .bind(task.parent_task_id)
        .first() as { status: string } | null;

      if (parent && !['APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(parent.status)) {
        return { success: false, error: 'Cannot submit this task until the prerequisite task is Approved.' };
      }
    }

    // Direct Brief Category Claim & Slot Validation
    const effectiveCategory = (selectedCategory && selectedCategory.trim())
      ? selectedCategory.trim()
      : (assignment.assignment_role.startsWith('Kategori: ') ? assignment.assignment_role.replace('Kategori: ', '') : assignment.assignment_role);

    if (task?.description && (task.description.includes('[DIRECT_BRIEF]') || task.task_type === 'DIRECT_BRIEF')) {
      const slots = parseSlotsFromDescription(task.description);
      const matchedSlot = slots.find(s => s.name.trim().toLowerCase() === effectiveCategory.toLowerCase());

      if (matchedSlot) {
        if (matchedSlot.assignedUserId && matchedSlot.assignedUserId !== session.userId) {
          return {
            success: false,
            error: `Slot output "${matchedSlot.name}" dialokasikan khusus untuk ${matchedSlot.assignedUserName || 'peserta lain'}.`,
          };
        }

        if (isFirstSubmission && matchedSlot.deadline) {
          const slotDeadline = parseIndonesiaDate(matchedSlot.deadline) ?? new Date(matchedSlot.deadline).getTime();
          if (slotDeadline && slotDeadline < nowMs) {
            return {
              success: false,
              error: `Tenggat waktu (deadline) khusus slot "${matchedSlot.name}" telah berakhir.`,
            };
          }
        }
      }
    }

    if (selectedCategory && selectedCategory.trim()) {
      const cleanCat = selectedCategory.trim();
      const existingClaim = await db
        .prepare(`
          SELECT ta.id, u.name as user_name
          FROM task_assignments ta
          JOIN users u ON ta.user_id = u.id
          WHERE ta.task_id = ?
            AND ta.id != ?
            AND (ta.assignment_role = ? OR ta.assignment_role = ?)
            AND (ta.result_url IS NOT NULL OR ta.status IN ('WAITING_REVIEW', 'APPROVED', 'DONE', 'PUBLISHED', 'RESUBMITTED', 'SUBMITTED'))
        `)
        .bind(assignment.task_id, assignmentId, cleanCat, `Kategori: ${cleanCat}`)
        .first() as { id: string; user_name: string } | null;

      if (existingClaim) {
        return {
          success: false,
          error: `Kategori output "${cleanCat}" sudah diambil oleh ${existingClaim.user_name || 'peserta lain'}. Silakan pilih kategori output lain yang masih tersedia.`,
        };
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

    const updatedRole = selectedCategory && selectedCategory.trim() ? selectedCategory.trim() : assignment.assignment_role;

    // Delete any conflicting unsubmitted duplicate assignment record for the same user and role to prevent UNIQUE constraint collisions
    await db
      .prepare(`
        DELETE FROM task_assignments 
        WHERE task_id = ? AND user_id = ? AND assignment_role = ? AND id != ?
      `)
      .bind(assignment.task_id, session.userId, updatedRole, assignmentId)
      .run();

    await db
      .prepare(`
        UPDATE task_assignments
        SET status = ?, result_url = ?, submitted_at = ?, revision_note = NULL,
            assignment_role = ?,
            lead_approved = CASE WHEN ? THEN 1 ELSE 0 END,
            mentor_approved = CASE WHEN ? THEN 1 ELSE 0 END,
            coordinator_approved = CASE WHEN ? THEN 1 ELSE 0 END
        WHERE id = ?
      `)
      .bind(nextStatus, resultUrl.trim(), now, updatedRole, isLeader ? 1 : 0, isMentor ? 1 : 0, isCoordinator ? 1 : 0, assignmentId)
      .run();

    // Auto-sync group members if task has group assignments
    await syncGroupAndTeamTaskAssignments(db, workspaceId, assignment.task_id);
    if (task) {
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

    await syncTaskOverallStatus(db, assignment.task_id);

    if (task?.workspace_id) {
      await invalidateWorkspaceTaskCache(task.workspace_id);
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

/**
 * Allows ANY active workspace member (Mentor, Leader, Trooper, Coordinator)
 * to submit a result for a Direct Brief Task.
 * If no assignment exists for the user yet, it auto-creates an assignment row for them!
 */
export async function submitDirectTaskResult(taskId: string, resultUrl: string, selectedCategory?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!resultUrl?.trim()) {
    return { success: false, error: 'Link hasil karya wajib diisi.' };
  }

  const db = await getDB();

  const task = await db
    .prepare('SELECT id, workspace_id, task_type, description, deadline, extended_deadline, start_at FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { id: string; workspace_id: string | null; task_type: string; description: string | null; deadline: number | null; extended_deadline: number | null; start_at: number | null } | null;

  if (!task) return { success: false, error: 'Tugas tidak ditemukan.' };

  const nowMs = Date.now();
  if (task.start_at && task.start_at > nowMs) {
    return { success: false, error: 'Tugas ini belum dimulai.' };
  }

  const cleanCat = selectedCategory ? selectedCategory.trim() : null;

  // Check all assignments for this user on this task
  const { results: userAssignments } = await db
    .prepare('SELECT id, assignment_role, status, submitted_at, result_url FROM task_assignments WHERE task_id = ? AND user_id = ?')
    .bind(taskId, session.userId)
    .all();

  const allAss = (userAssignments || []) as { id: string; assignment_role: string; status: string; submitted_at: number | null; result_url: string | null }[];

  // 1. Prefer assignment matching the selected category slot
  let assignment = cleanCat
    ? allAss.find(a => a.assignment_role.toLowerCase() === cleanCat.toLowerCase() || a.assignment_role.toLowerCase() === `kategori: ${cleanCat.toLowerCase()}`)
    : null;

  // 2. Otherwise pick the first assignment
  if (!assignment && allAss.length > 0) {
    assignment = allAss[0];
  }

  // 3. Clean up any redundant unsubmitted duplicate assignments for this user on this task
  if (assignment && allAss.length > 1) {
    for (const a of allAss) {
      if (a.id !== assignment.id && !a.result_url && a.status === 'ASSIGNED') {
        await db.prepare('DELETE FROM task_assignments WHERE id = ?').bind(a.id).run();
      }
    }
  }

  const isFirstSubmission = !assignment || (!assignment.submitted_at && (!assignment.result_url || assignment.result_url.trim() === ''));

  if (cleanCat) {
    const slots = parseSlotsFromDescription(task.description);
    const matchedSlot = slots.find(s => s.name.trim().toLowerCase() === cleanCat.toLowerCase());

    if (matchedSlot) {
      if (matchedSlot.assignedUserId && matchedSlot.assignedUserId !== session.userId) {
        return {
          success: false,
          error: `Slot output "${matchedSlot.name}" dialokasikan khusus untuk ${matchedSlot.assignedUserName || 'peserta lain'}.`,
        };
      }

      if (isFirstSubmission && matchedSlot.deadline) {
        const slotDeadline = parseIndonesiaDate(matchedSlot.deadline) ?? new Date(matchedSlot.deadline).getTime();
        if (slotDeadline && slotDeadline < nowMs) {
          return {
            success: false,
            error: `Tenggat waktu (deadline) khusus untuk slot "${matchedSlot.name}" telah berakhir.`,
          };
        }
      }
    }

    const existingClaim = await db
      .prepare(`
        SELECT ta.id, u.name as user_name
        FROM task_assignments ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id = ?
          AND ta.user_id != ?
          AND (ta.assignment_role = ? OR ta.assignment_role = ?)
          AND (ta.result_url IS NOT NULL OR ta.status IN ('WAITING_REVIEW', 'APPROVED', 'DONE', 'PUBLISHED', 'RESUBMITTED', 'SUBMITTED'))
      `)
      .bind(taskId, session.userId, cleanCat, `Kategori: ${cleanCat}`)
      .first() as { id: string; user_name: string } | null;

    if (existingClaim) {
      return {
        success: false,
        error: `Kategori output "${cleanCat}" telah diambil oleh ${existingClaim.user_name || 'peserta lain'}. Silakan pilih kategori output lain yang masih tersedia.`,
      };
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const roleValue = cleanCat || (task.task_type === 'VIDEO' ? 'VIDEO_EDITOR' : task.task_type === 'OTHER' ? 'CREATOR' : 'DESIGNER');

  if (!assignment) {
    const effectiveDeadline = Math.max(task?.extended_deadline || 0, task?.deadline || 0) || null;
    if (isFirstSubmission && effectiveDeadline && effectiveDeadline < nowMs) {
      return { success: false, error: 'Tenggat waktu (deadline) submit pertama telah berakhir. Pengumpulan tugas ditutup.' };
    }

    const newId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
    await db
      .prepare(`
        INSERT INTO task_assignments
          (id, task_id, user_id, assignment_role, assigned_by, status, result_url, submitted_at, created_at)
        VALUES (?, ?, ?, ?, ?, 'WAITING_REVIEW', ?, ?, ?)
      `)
      .bind(newId, taskId, session.userId, roleValue, session.userId, resultUrl.trim(), now, now)
      .run();

    if (task.workspace_id) {
      await invalidateWorkspaceTaskCache(task.workspace_id);
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
    }
    revalidatePath('/dashboard/workspace');
    revalidatePath('/dashboard/review');
    return { success: true };
  } else {
    // Reuse submitResult logic for existing assignment
    return submitResult(assignment.id, resultUrl, selectedCategory);
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
    .prepare('SELECT id, title, project_id, workspace_id, status, task_type, created_by, assigned_mentors FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; title: string; project_id: string; workspace_id: string | null; status: string; task_type: string; created_by: string | null; assigned_mentors?: string | null } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';

  if (assignment.user_id === session.userId) {
    return { success: false, error: 'Forbidden: Anda tidak dapat menilai atau menyetujui hasil karya milik Anda sendiri.' };
  }

  const ctx = await getSessionContext(session.userId);
  const isLeader = (await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(workspaceId, session.userId)
    .first()) !== null;

  let isAssignedTaskMentor = false;
  if (task.assigned_mentors) {
    try {
      const ids = JSON.parse(task.assigned_mentors);
      if (Array.isArray(ids) && ids.includes(session.userId)) {
        isAssignedTaskMentor = true;
      }
    } catch (_e) {}
  }

  const isTaskMentor = (await db
    .prepare(`
      SELECT 1 FROM workspace_mentors WHERE workspace_id = ? AND user_id = ?
    `)
    .bind(workspaceId, session.userId)
    .first()) !== null || isAssignedTaskMentor || (task.created_by != null && task.created_by === session.userId);

  const isProjectCoordinator = (await db
    .prepare(`
      SELECT 1 FROM workspaces WHERE id = ? AND ojt_coordinator_id = ?
      UNION ALL
      SELECT 1 FROM project_coordinators WHERE project_id = ? AND user_id = ?
    `)
    .bind(workspaceId, session.userId, task.project_id || '', session.userId)
    .first()) !== null;

  const isCoordinator =
    isProjectCoordinator ||
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') ||
        ctx.roles.includes('EXECUTIVE') ||
        ctx.can('MANAGE') ||
        ctx.can('WORKSPACE_MANAGE'))) ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  const isOjtRole = ['RESEARCHER', 'PLANNER', 'CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assignment.assignment_role);
  const isMentorWs = task.task_type === 'MENTOR' || (await db.prepare('SELECT workspace_type FROM workspaces WHERE id = ?').bind(workspaceId).first() as any)?.workspace_type === 'MENTOR';
  const isTaskCreator = (task.created_by != null && task.created_by === session.userId) || (assignment as any).assigned_by === session.userId;

  const hasMentorsInWs = (await db
    .prepare('SELECT 1 FROM workspace_mentors WHERE workspace_id = ?')
    .bind(workspaceId)
    .first()) !== null || Boolean(task.assigned_mentors && task.assigned_mentors.length > 2) || (task.created_by && task.created_by !== session.userId);

  if (isMentorWs) {
    if (!isCoordinator && !isTaskCreator) {
      return { success: false, error: 'Forbidden: Hanya Koordinator/Admin atau Pembuat Task yang dapat memberikan penilaian/QC pada workspace Mentor.' };
    }
  } else if (isOjtRole) {
    if (!isLeader && !isTaskMentor && !isCoordinator) {
      throw new Error('Forbidden: You do not have permission to approve this step.');
    }
    if (assignment.mentor_approved === 0 && hasMentorsInWs && !isTaskMentor && isCoordinator) {
      return {
        success: false,
        error: 'Tugas ini masih dalam Review Tahap 1 oleh Mentor. Koordinator belum dapat memberikan persetujuan & Sparks sebelum Mentor menyetujui hasil submit ini.',
      };
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
      if (isTaskMentor) {
        newMentorApproved = 1;
        if (!hasMentorsInWs || isCoordinator) {
          newCoordinatorApproved = 1;
        }
        nextStatus = 'APPROVED';
      } else if (isCoordinator) {
        newCoordinatorApproved = 1;
        newMentorApproved = 1;
        nextStatus = 'APPROVED';
      } else if (isLeader) {
        newLeadApproved = 1;
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
      note: `Approved by: ${isLeader ? 'Leader ' : ''}${isTaskMentor ? 'Mentor ' : ''}${isCoordinator ? 'Coordinator ' : ''}(Status: ${nextStatus})${appreciationBadge ? ` [Sparks: ${appreciationBadge}]` : ''}${appreciationNote ? ` Note: ${appreciationNote}` : ''}`,
    });

    if (assignment.user_id) {
      if (isLeader && nextStatus === 'WAITING_REVIEW') {
        sendPushNotificationToUser(assignment.user_id, 'TASK', {
          title: `✓ Lolos QC Ketua Tim`,
          body: `Step ${assignment.assignment_role} pada ${task?.title || 'tugas'} telah disetujui Ketua Tim dan diteruskan ke Mentor.`,
          url: `/dashboard/workspace/${task?.workspace_id || ''}`,
          category: 'TASK',
        }).catch(() => {});
      } else {
        sendPushNotificationToUser(assignment.user_id, 'TASK', {
          title: `🎉 Tugas Disetujui!`,
          body: `Tugas ${task?.title || ''} telah disetujui.${sparksValue ? ` (+${sparksValue} Sparks ✨)` : ''}`,
          url: `/dashboard/workspace/${task?.workspace_id || ''}`,
          category: 'TASK',
        }).catch(() => {});
      }
    }

    await syncTaskOverallStatus(db, task.id);

    if (task.workspace_id) {
      await invalidateWorkspaceTaskCache(task.workspace_id);
      revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
    }
    await syncGroupAndTeamTaskAssignments(db, task.workspace_id || undefined, task.id);
    await invalidateLeaderboardCache();
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
    .prepare('SELECT workspace_id, task_type, created_by FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { workspace_id: string | null; task_type: string; created_by: string | null } | null;

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

  const isMentorWs = task?.task_type === 'MENTOR' || (await db.prepare('SELECT workspace_type FROM workspaces WHERE id = ?').bind(workspaceId).first() as any)?.workspace_type === 'MENTOR';
  const isTaskCreator = (task?.created_by != null && task.created_by === session.userId) || (assignment as any).assigned_by === session.userId;

  if (isMentorWs) {
    if (!isCoordinator && !isTaskCreator) {
      return { success: false, error: 'Forbidden: Hanya Koordinator/Admin atau Pembuat Task yang dapat mengubah Sparks pada workspace Mentor.' };
    }
  } else if (!isLeader && !isMentor && !isCoordinator) {
    return { success: false, error: 'Only Leader, Mentor, or Coordinator can update Sparks.' };
  }

  try {
    await db
      .prepare('UPDATE task_assignments SET sparks = ? WHERE id = ?')
      .bind(sparks, assignmentId)
      .run();

    if (workspaceId) {
      await invalidateWorkspaceTaskCache(workspaceId);
      revalidatePath(`/dashboard/workspace/${workspaceId}`);
    }
    await invalidateLeaderboardCache();
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

  if (assignment.user_id === session.userId) {
    return { success: false, error: 'Forbidden: Anda tidak dapat meminta revisi untuk hasil karya milik Anda sendiri.' };
  }

  if (['APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED'].includes(assignment.status)) {
    return { success: false, error: 'Penugasan yang sudah disetujui (Approved) tidak dapat diminta revisi kembali.' };
  }

  const task = await db
    .prepare('SELECT id, title, project_id, workspace_id, status, task_type, created_by, assigned_mentors FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; title: string; project_id: string; workspace_id: string | null; status: string; task_type: string; created_by: string | null; assigned_mentors?: string | null } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';
  const ctx = await getSessionContext(session.userId);

  const isOjtRole = ['RESEARCHER', 'PLANNER', 'CREATOR', 'DESIGNER', 'VIDEO_EDITOR'].includes(assignment.assignment_role);
  const isMentorWs = task.task_type === 'MENTOR' || (await db.prepare('SELECT workspace_type FROM workspaces WHERE id = ?').bind(workspaceId).first() as any)?.workspace_type === 'MENTOR';
  const isTaskCreator = (task.created_by != null && task.created_by === session.userId) || (assignment as any).assigned_by === session.userId;
  const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM'));

  if (isMentorWs) {
    if (!isCoordinator && !isTaskCreator) {
      return { success: false, error: 'Forbidden: Hanya Koordinator/Admin atau Pembuat Task yang dapat meminta revisi pada workspace Mentor.' };
    }
  } else if (isOjtRole) {
    const isLeader = (await db
      .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
      .bind(workspaceId, session.userId)
      .first()) !== null;

    let isAssignedTaskMentor = false;
    if (task.assigned_mentors) {
      try {
        const ids = JSON.parse(task.assigned_mentors);
        if (Array.isArray(ids) && ids.includes(session.userId)) {
          isAssignedTaskMentor = true;
        }
      } catch (_e) {}
    }

    const isMentor = (await db
      .prepare(`
        SELECT 1 FROM workspaces WHERE id = ? AND ojt_coordinator_id = ?
        UNION ALL
        SELECT 1 FROM workspace_mentors WHERE workspace_id = ? AND user_id = ?
        UNION ALL
        SELECT 1 FROM project_coordinators WHERE project_id = ? AND user_id = ?
      `)
      .bind(workspaceId, session.userId, workspaceId, session.userId, task.project_id || '', session.userId)
      .first()) !== null || isAssignedTaskMentor || (task.created_by != null && task.created_by === session.userId);

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

    await syncTaskOverallStatus(db, task?.id || assignment.task_id);



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
      await invalidateWorkspaceTaskCache(task.workspace_id);
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

  const deadline = parseIndonesiaDate(deadlineStr);
  const startAt = parseIndonesiaDate(startAtStr);

  try {
    await db
      .prepare(`
        UPDATE tasks
        SET title = ?, description = ?, priority = ?, deadline = ?, start_at = ?, task_type = ?, parent_task_id = ?
        WHERE id = ?
      `)
      .bind(title, description, priority, deadline, startAt, outputType, parentTaskId, taskId)
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
        SET deadline = ?, start_at = ?
        WHERE task_id = ?
      `)
      .bind(deadline, startAt, taskId)
      .run();

    if (task.workspace_id) {
      await invalidateWorkspaceTaskCache(task.workspace_id);
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
      await invalidateWorkspaceTaskCache(task.workspace_id);
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
    .prepare('SELECT id, project_id, workspace_id, status, task_type, created_by, assigned_mentors FROM tasks WHERE id = ?')
    .bind(assignment.task_id)
    .first() as { id: string; project_id: string; workspace_id: string | null; status: string; task_type: string; created_by: string | null; assigned_mentors?: string | null } | null;

  if (!task) return { success: false, error: 'Task not found.' };

  const workspaceId = task.workspace_id || '';
  const ctx = await getSessionContext(session.userId);

  const isOjtRole = ['RESEARCHER', 'PLANNER', 'CREATOR'].includes(assignment.assignment_role);
  const isMentorWs = task.task_type === 'MENTOR' || (await db.prepare('SELECT workspace_type FROM workspaces WHERE id = ?').bind(workspaceId).first() as any)?.workspace_type === 'MENTOR';
  const isTaskCreator = (task.created_by != null && task.created_by === session.userId) || (assignment as any).assigned_by === session.userId;
  const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM'));

  if (isMentorWs) {
    if (!isCoordinator && !isTaskCreator) {
      return { success: false, error: 'Forbidden: Hanya Koordinator/Admin atau Pembuat Task yang dapat menolak karya pada workspace Mentor.' };
    }
  } else if (isOjtRole) {
    const isLeader = (await db
      .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
      .bind(workspaceId, session.userId)
      .first()) !== null;

    let isAssignedTaskMentor = false;
    if (task.assigned_mentors) {
      try {
        const ids = JSON.parse(task.assigned_mentors);
        if (Array.isArray(ids) && ids.includes(session.userId)) {
          isAssignedTaskMentor = true;
        }
      } catch (_e) {}
    }

    const isMentor = (await db
      .prepare(`
        SELECT 1 FROM workspaces WHERE id = ? AND ojt_coordinator_id = ?
        UNION ALL
        SELECT 1 FROM workspace_mentors WHERE workspace_id = ? AND user_id = ?
        UNION ALL
        SELECT 1 FROM project_coordinators WHERE project_id = ? AND user_id = ?
      `)
      .bind(workspaceId, session.userId, workspaceId, session.userId, task.project_id || '', session.userId)
      .first()) !== null || isAssignedTaskMentor || (task.created_by != null && task.created_by === session.userId);

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
      await invalidateWorkspaceTaskCache(task.workspace_id);
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
      await invalidateWorkspaceTaskCache(task.workspace_id);
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
      SELECT ta.id, ta.task_id, ta.user_id, ta.status, t.title AS task_title, t.created_by, t.assigned_mentors,
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

  let targetMentorIds: string[] = [];
  if (assign.assigned_mentors) {
    try {
      const ids: string[] = JSON.parse(assign.assigned_mentors);
      if (Array.isArray(ids) && ids.length > 0) {
        targetMentorIds = ids;
      }
    } catch (_e) {}
  }
  if (targetMentorIds.length === 0 && assign.created_by) {
    targetMentorIds = [assign.created_by];
  }

  if (targetMentorIds.length === 0) {
    return { success: false, error: 'Mentor petugas tidak terdefinisi.' };
  }

  const sender = (await db
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(session.userId)
    .first()) as { name: string } | null;

  const senderName = sender?.name || 'Koordinator QC';

  for (const mentorId of targetMentorIds) {
    await sendPushNotificationToUser(mentorId, 'TASK', {
      title: `🔔 Reminder Review Tugas: ${assign.task_title}`,
      body: `${senderName} mengingatkan Anda untuk segera meninjau submission dari ${assign.assignee_name || 'Trooper'}.${
        customMessage ? ` Catatan: ${customMessage}` : ''
      }`,
      url: assign.workspace_id ? `/dashboard/workspace/${assign.workspace_id}` : '/dashboard/review',
    });
  }

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
    message: `Reminder berhasil dikirim ke Mentor!`,
  };
}

/**
 * Sends a push notification and in-app reminder to the Coordinator/QC
 * reminding them to complete Stage 2 QC review.
 */
export async function sendReviewReminderToCoordinator(
  assignmentId: string,
  customMessage?: string
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const assign = (await db
    .prepare(
      `
      SELECT ta.id, ta.status, t.title AS task_title, t.workspace_id,
             u_assignee.name AS assignee_name, ws.ojt_coordinator_id
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      LEFT JOIN users u_assignee ON ta.user_id = u_assignee.id
      WHERE ta.id = ?
    `
    )
    .bind(assignmentId)
    .first()) as any;

  if (!assign) return { success: false, error: 'Penugasan tidak ditemukan.' };

  let targetCoordId = assign.ojt_coordinator_id;
  if (!targetCoordId) {
    const staffRow = (await db
      .prepare("SELECT id FROM users WHERE user_type = 'STAFF' AND status = 'ACTIVE' LIMIT 1")
      .first()) as { id: string } | null;
    targetCoordId = staffRow?.id;
  }

  if (!targetCoordId) {
    return { success: false, error: 'Koordinator QC tidak ditemukan.' };
  }

  const sender = (await db
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(session.userId)
    .first()) as { name: string } | null;

  const senderName = sender?.name || 'Mentor';

  await sendPushNotificationToUser(targetCoordId, 'TASK', {
    title: `🔔 Reminder QC Review: ${assign.task_title}`,
    body: `${senderName} mengingatkan Anda untuk melanjut QC Review submission dari ${assign.assignee_name || 'Trooper'}.${
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
    note: `Mentor (${senderName}) mengirimkan reminder QC Review ke Koordinator`,
  });

  return {
    success: true,
    message: 'Reminder QC Review berhasil dikirim ke Koordinator!',
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

/**
 * Sends a smart batch reminder for an entire Task card:
 * 1. Notifies ALL assigned Troopers who haven't submitted yet (ASSIGNED, IN_PROGRESS).
 * 2. Notifies the Mentor if there are submissions waiting review (WAITING_REVIEW, SUBMITTED).
 */
export async function sendTaskSmartReminder(taskId: string, categoryMode?: string) {
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
    return { success: false, error: 'Hanya Koordinator/Admin atau Mentor yang dapat mengirim reminder.' };
  }

  // Get task info & creator mentor
  const task = (await db
    .prepare(
      `SELECT t.id, t.title, t.workspace_id, t.created_by, t.assigned_mentors, u_creator.name AS creator_name
       FROM tasks t
       LEFT JOIN users u_creator ON t.created_by = u_creator.id
       WHERE t.id = ? AND t.status != 'DELETED'`
    )
    .bind(taskId)
    .first()) as any;

  if (!task) return { success: false, error: 'Tugas tidak ditemukan.' };

  // Fetch all assignments for this task
  const { results: assignments } = await db
    .prepare(
      `SELECT ta.id, ta.user_id, ta.status, ta.mentor_approved, ta.coordinator_approved, u.name AS user_name
       FROM task_assignments ta
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE ta.task_id = ?`
    )
    .bind(taskId)
    .all();

  const assignList = (assignments as any[]) || [];

  // Exclude approved/done participants
  const needRevision = assignList.filter(
    (a) => a.status === 'REVISION_REQUESTED' && a.user_id
  );
  const unsubmitted = assignList.filter(
    (a) => ['ASSIGNED', 'IN_PROGRESS', 'DRAFT'].includes(a.status) && a.user_id
  );
  const waitingReview = assignList.filter(
    (a) => ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(a.status)
  );

  const sender = (await db
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(session.userId)
    .first()) as { name: string } | null;

  const senderName = sender?.name || 'Tim Evaluator';
  let notifiedCount = 0;
  let messagesSent: string[] = [];

  const isRevisionCategory = categoryMode && categoryMode.includes('REVISION');
  const isReviewCategory = categoryMode === 'REVIEW';
  const isUnsubmittedCategory = categoryMode === 'TROOPER' || categoryMode === 'UNSUBMITTED';

  // 1. Notify troopers who need revision (if in revision tab or general batch)
  if (needRevision.length > 0 && (!categoryMode || isRevisionCategory)) {
    for (const sub of needRevision) {
      await sendPushNotificationToUser(sub.user_id, 'TASK', {
        title: `🔄 Reminder Revisi Tugas: ${task.title}`,
        body: `${senderName} mengingatkan: Ada catatan revisi pada tugas Anda. Mohon perbaiki & unggah hasil revisi terbaru.`,
        url: task.workspace_id ? `/dashboard/workspace/${task.workspace_id}` : '/dashboard',
      });
      notifiedCount++;
    }
    messagesSent.push(`Reminder Revisi dikirim ke ${needRevision.length} Peserta`);
  }

  // 2. Notify troopers who haven't submitted (if in unsubmitted/trooper tab or general batch)
  if (unsubmitted.length > 0 && (!categoryMode || isUnsubmittedCategory || categoryMode === 'ACTIVE' || categoryMode === 'MENTOR')) {
    if (!isRevisionCategory && !isReviewCategory) {
      for (const sub of unsubmitted) {
        await sendPushNotificationToUser(sub.user_id, 'TASK', {
          title: `⏰ Reminder Pengerjaan Tugas: ${task.title}`,
          body: `${senderName} mengingatkan Anda untuk segera menyelesaikan & mengunggah hasil karya.`,
          url: task.workspace_id ? `/dashboard/workspace/${task.workspace_id}` : '/dashboard',
        });
        notifiedCount++;
      }
      messagesSent.push(`Reminder Pengerjaan dikirim ke ${unsubmitted.length} Peserta`);
    }
  }

  // 3. Notify mentor/coordinator if there are submissions waiting review (if in review tab or general batch)
  if (waitingReview.length > 0 && (!categoryMode || isReviewCategory || categoryMode === 'ACTIVE' || categoryMode === 'MENTOR')) {
    if (!isRevisionCategory && !isUnsubmittedCategory) {
      const waitingMentorStage = waitingReview.filter((a) => (a.mentor_approved ?? 0) === 0);
      const waitingCoordStage = waitingReview.filter((a) => (a.mentor_approved ?? 0) === 1 && (a.coordinator_approved ?? 0) === 0);

      if (waitingMentorStage.length > 0) {
        let targetMentorIds: string[] = [];
        if (task.assigned_mentors) {
          try {
            const ids: string[] = JSON.parse(task.assigned_mentors);
            if (Array.isArray(ids) && ids.length > 0) {
              targetMentorIds = ids;
            }
          } catch (_e) {}
        }
        if (targetMentorIds.length === 0 && task.workspace_id) {
          const { results: wsMentors } = await db
            .prepare(`SELECT user_id FROM workspace_mentors WHERE workspace_id = ?`)
            .bind(task.workspace_id)
            .all();
          if (wsMentors && wsMentors.length > 0) {
            targetMentorIds = (wsMentors as any[]).map((m) => m.user_id);
          }
        }
        if (targetMentorIds.length === 0 && task.created_by) {
          targetMentorIds = [task.created_by];
        }

        const effectiveMentorIds = targetMentorIds.filter((id) => id !== session.userId);
        const finalMentorIds = effectiveMentorIds.length > 0 ? effectiveMentorIds : targetMentorIds;

        for (const mId of finalMentorIds) {
          await sendPushNotificationToUser(mId, 'TASK', {
            title: `🔔 Reminder Review Tahap 1: ${task.title}`,
            body: `${senderName} mengingatkan Anda untuk segera meninjau ${waitingMentorStage.length} karya peserta (Review Tahap 1 Mentor).`,
            url: task.workspace_id ? `/dashboard/workspace/${task.workspace_id}` : '/dashboard/review',
          });
          notifiedCount++;
        }
        if (finalMentorIds.length > 0) {
          messagesSent.push(`Notifikasi review Tahap 1 dikirim ke Mentor`);
        }
      }

      if (waitingCoordStage.length > 0) {
        const { results: coordUsers } = await db
          .prepare(
            `SELECT id FROM users 
             WHERE (user_type = 'STAFF' AND (role_flags LIKE '%COORDINATOR%' OR role_flags LIKE '%EXECUTIVE%' OR role_flags LIKE '%ADMIN%'))
                OR id IN (SELECT user_id FROM project_coordinators WHERE project_id = (SELECT project_id FROM tasks WHERE id = ?))`
          )
          .bind(taskId)
          .all();

        const coordIds = ((coordUsers as any[]) || []).map((u) => u.id).filter((id) => id !== session.userId);
        for (const cId of coordIds) {
          await sendPushNotificationToUser(cId, 'TASK', {
            title: `⚡ Reminder QC Final & Sparks: ${task.title}`,
            body: `${senderName} mengingatkan: ${waitingCoordStage.length} karya peserta telah disetujui Mentor & siap untuk QC Final / Sparks.`,
            url: task.workspace_id ? `/dashboard/workspace/${task.workspace_id}` : '/dashboard/review',
          });
          notifiedCount++;
        }
        if (coordIds.length > 0) {
          messagesSent.push(`Notifikasi review Tahap 2 dikirim ke Koordinator`);
        }
      }
    }
  }

  if (notifiedCount === 0) {
    return { success: false, error: 'Tidak ada peserta atau mentor yang perlu diingatkan saat ini.' };
  }

  await logWorkflowEvent({
    entityType: 'task',
    entityId: taskId,
    fromStatus: 'REMINDER_SENT',
    toStatus: 'REMINDER_SENT',
    triggeredBy: session.userId,
    note: `${senderName} mengirimkan Smart Batch Reminder: ${messagesSent.join(', ')}`,
  });

  return {
    success: true,
    message: `✅ Smart Reminder berhasil dikirim! (${messagesSent.join(' & ')})`,
  };
}

/**
 * Extends the deadline of a task.
 * Permitted for: Admin, Coordinator, or Task Creator (Mentor owner).
 */
export async function extendTaskDeadline(
  taskId: string,
  newDeadline: number, // Unix timestamp in ms
  workspaceId?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  // Fetch task
  const task = await db
    .prepare('SELECT id, workspace_id, created_by, deadline, extended_deadline FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { id: string; workspace_id: string | null; created_by: string | null; deadline: number | null; extended_deadline: number | null } | null;

  if (!task) return { success: false, error: 'Task tidak ditemukan.' };

  const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));
  const isCreator = task.created_by != null && task.created_by === session.userId;
  const isAdmin = ctx.permissions.has('ADMIN_SYSTEM') || (ctx.userType as string) === 'ADMIN';
  const isMentor = ctx.roles.includes('MENTOR') || ctx.can('TASK_REVIEW') || ctx.can('SPARKS_MANAGE');

  if (!isCoordinator && !isCreator && !isAdmin && !isMentor) {
    return { success: false, error: 'Hanya Admin, Koordinator, Mentor, atau Pembuat Task yang dapat memperpanjang deadline.' };
  }

  const baseDeadline = task.deadline || 0;
  if (newDeadline <= baseDeadline) {
    return { success: false, error: 'Deadline perpanjangan harus lebih lama dari deadline awal.' };
  }

  try {
    await db
      .prepare('UPDATE tasks SET extended_deadline = ? WHERE id = ?')
      .bind(newDeadline, taskId)
      .run();

    try {
      await db
        .prepare('UPDATE task_assignments SET deadline = ? WHERE task_id = ?')
        .bind(newDeadline, taskId)
        .run();
    } catch (_e) {}

    await logWorkflowEvent({
      entityType: 'task',
      entityId: taskId,
      fromStatus: 'DEADLINE_EXPIRED',
      toStatus: 'DEADLINE_EXTENDED',
      triggeredBy: session.userId,
      note: `Deadline diperpanjang hingga ${new Date(newDeadline).toLocaleString('id-ID')}`,
    });

    const targetWsId = workspaceId || task.workspace_id;
    if (targetWsId) {
      await invalidateWorkspaceTaskCache(targetWsId);
      revalidatePath(`/dashboard/workspace/${targetWsId}`);
    }
    revalidatePath('/dashboard/review');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err: any) {
    console.error('extendTaskDeadline error:', err);
    return { success: false, error: err.message || 'Gagal memperpanjang deadline.' };
  }
}

/**
 * Auto-repairs task statuses in DB so that a task is ONLY marked 'APPROVED'
 * when ALL of its assignments have been completed/approved.
 * If any assignment is still pending (e.g., ASSIGNED, IN_PROGRESS, REVISION_REQUESTED),
 * and the task was prematurely set to 'APPROVED', it reverts the task status to 'IN_PROGRESS'.
 */
export async function syncAndRepairTaskStatuses(db: any, workspaceId?: string) {
  try {
    const wsClause = workspaceId ? 'WHERE workspace_id = ? AND status != "DELETED"' : 'WHERE status != "DELETED"';
    const params = workspaceId ? [workspaceId] : [];

    const { results: tasks } = await db
      .prepare(`
        SELECT t.id, t.status, t.task_type, ws.workspace_type
        FROM tasks t
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        ${wsClause}
      `)
      .bind(...params)
      .all();

    for (const t of (tasks as any[] || [])) {
      if (t.task_type === 'ASSESSMENT' || t.task_type === 'DIRECT_BRIEF' || t.workspace_type === 'ASSESSMENT') continue;

      const { results: assignments } = await db
        .prepare(`SELECT status FROM task_assignments WHERE task_id = ?`)
        .bind(t.id)
        .all();

      const assignList = (assignments as any[]) || [];
      if (assignList.length === 0) continue;

      const unapprovedCount = assignList.filter(
        (a) => !['APPROVED', 'DONE', 'PUBLISHED', 'IN_PRODUCTION', 'IN_UPLOAD', 'LOCKED'].includes(a.status)
      ).length;

      if (unapprovedCount > 0 && ['APPROVED', 'PUBLISHED', 'DONE', 'COMPLETED'].includes(t.status)) {
        await db
          .prepare("UPDATE tasks SET status = 'IN_PROGRESS' WHERE id = ?")
          .bind(t.id)
          .run();
      } else if (unapprovedCount === 0 && !['APPROVED', 'PUBLISHED', 'DONE', 'COMPLETED', 'ARCHIVED'].includes(t.status)) {
        await db
          .prepare("UPDATE tasks SET status = 'APPROVED', revision_note = NULL WHERE id = ?")
          .bind(t.id)
          .run();
      }
    }

    // Auto-sync group/team assignments
    await syncGroupAndTeamTaskAssignments(db, workspaceId);
  } catch (err) {
    console.error('syncAndRepairTaskStatuses error:', err);
  }
}

/**
 * Server Action for Ketua Tim to propose a custom Role Rolling arrangement.
 */
export async function proposeTaskRoleRollingAction(
  taskId: string,
  proposal: {
    researcherId: string;
    plannerId: string;
    creatorId: string;
    reason?: string;
  }
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const task = await db
    .prepare('SELECT id, workspace_id, title, description, status FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { id: string; workspace_id: string; title: string; description: string | null; status: string } | null;

  if (!task) return { success: false, error: 'Task tidak ditemukan.' };

  // Check if session user is LEADER, Mentor, or Coordinator
  const isLeader = (await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(task.workspace_id, session.userId)
    .first()) !== null;

  const ctx = await getSessionContext(session.userId);
  const isManager = ctx.can('MANAGE') || ctx.userType === 'STAFF';

  if (!isLeader && !isManager) {
    return { success: false, error: 'Hanya Ketua Tim yang dapat mengajukan usulan rolling role.' };
  }

  const proposalData = {
    proposedBy: session.userId,
    proposedAt: Date.now(),
    researcherId: proposal.researcherId,
    plannerId: proposal.plannerId,
    creatorId: proposal.creatorId,
    reason: proposal.reason || '',
    status: 'PENDING',
  };

  let desc = task.description || '';
  desc = desc.replace(/\[ROLE_PROPOSAL:[\s\S]*?\]/g, '').trim();
  desc = `[ROLE_PROPOSAL:${JSON.stringify(proposalData)}]\n${desc}`;

  await db.prepare('UPDATE tasks SET description = ? WHERE id = ?').bind(desc, taskId).run();

  await logWorkflowEvent({
    entityType: 'task',
    entityId: taskId,
    fromStatus: task.status || null,
    toStatus: task.status || 'IN_PROGRESS',
    triggeredBy: session.userId,
    note: `Ketua Tim mengajukan usulan rolling role: ${proposal.reason || 'Tanpa catatan'}`,
  });

  if (task.workspace_id) {
    await invalidateWorkspaceTaskCache(task.workspace_id);
    revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
  }

  return { success: true, message: 'Usulan rolling role berhasil dikirim ke Mentor untuk ditinjau.' };
}

/**
 * Server Action for Mentor/Coordinator to approve or reject Ketua Tim's role rolling proposal.
 */
export async function decideTaskRoleProposalAction(taskId: string, approved: boolean) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const task = await db
    .prepare('SELECT id, workspace_id, title, description, task_type, deadline, status FROM tasks WHERE id = ?')
    .bind(taskId)
    .first() as { id: string; workspace_id: string; title: string; description: string | null; task_type: string; deadline: number | null; status: string } | null;

  if (!task) return { success: false, error: 'Task tidak ditemukan.' };

  const ctx = await getSessionContext(session.userId);
  const isCoordinator = ctx.can('MANAGE') || ctx.userType === 'STAFF';

  const ws = await db
    .prepare('SELECT ojt_coordinator_id FROM workspaces WHERE id = ?')
    .bind(task.workspace_id)
    .first() as { ojt_coordinator_id: string | null } | null;

  const isMentor = ws?.ojt_coordinator_id === session.userId || (await db
    .prepare('SELECT 1 FROM workspace_mentors WHERE workspace_id = ? AND user_id = ?')
    .bind(task.workspace_id, session.userId)
    .first()) !== null;

  if (!isMentor && !isCoordinator) {
    return { success: false, error: 'Hanya Mentor atau Koordinator yang berhak menyetujui/menolak usulan role.' };
  }

  const desc = task.description || '';
  const match = desc.match(/\[ROLE_PROPOSAL:([\s\S]*?)\]/);
  if (!match || !match[1]) {
    return { success: false, error: 'Tidak ada usulan role yang aktif pada task ini.' };
  }

  let proposalData: any;
  try {
    proposalData = JSON.parse(match[1]);
  } catch {
    return { success: false, error: 'Format data usulan tidak valid.' };
  }

  if (approved) {
    const creatorRole = task.task_type === 'VIDEO' ? 'VIDEO_EDITOR' : task.task_type === 'OTHER' ? 'CREATOR' : 'DESIGNER';
    const roleMappings = [
      { role: 'RESEARCHER', userId: proposalData.researcherId },
      { role: 'PLANNER', userId: proposalData.plannerId },
      { role: creatorRole, userId: proposalData.creatorId },
    ];

    for (const mapping of roleMappings) {
      if (mapping.userId) {
        const existing = await db
          .prepare('SELECT id FROM task_assignments WHERE task_id = ? AND assignment_role = ?')
          .bind(taskId, mapping.role)
          .first() as { id: string } | null;

        if (existing) {
          await db
            .prepare('UPDATE task_assignments SET user_id = ? WHERE id = ?')
            .bind(mapping.userId, existing.id)
            .run();
        } else {
          const assignId = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
          await db
            .prepare(`
              INSERT INTO task_assignments (id, task_id, user_id, assignment_role, assigned_by, status, deadline, created_at)
              VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, strftime('%s', 'now'))
            `)
            .bind(assignId, taskId, mapping.userId, mapping.role, session.userId, task.deadline)
            .run();
        }
      }
    }
  }

  const updatedDesc = desc.replace(/\[ROLE_PROPOSAL:[\s\S]*?\]/g, '').trim();
  await db.prepare('UPDATE tasks SET description = ? WHERE id = ?').bind(updatedDesc, taskId).run();

  await logWorkflowEvent({
    entityType: 'task',
    entityId: taskId,
    fromStatus: task.status || null,
    toStatus: task.status || 'IN_PROGRESS',
    triggeredBy: session.userId,
    note: approved ? 'Usulan role rolling Ketua Tim DISETUJUI oleh Mentor' : 'Usulan role rolling Ketua Tim DITOLAK oleh Mentor (mengikuti rolling sistem)',
  });

  if (task.workspace_id) {
    await invalidateWorkspaceTaskCache(task.workspace_id);
    revalidatePath(`/dashboard/workspace/${task.workspace_id}`);
  }

  return {
    success: true,
    message: approved ? 'Usulan role berhasil diterapkan pada task.' : 'Usulan role ditolak.',
  };
}


