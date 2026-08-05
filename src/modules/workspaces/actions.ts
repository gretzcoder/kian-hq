'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, getSessionContext, getLocalWorkspaceRoles } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { validateTransition } from '@/modules/workflow/engine';
import { logWorkflowEvent } from '@/modules/workflow/events';

// ---------------------------------------------------------------------------
// CREATE WORKSPACE
// ---------------------------------------------------------------------------

/**
 * Creates a new workspace inside a project.
 * Workspaces are Independent Entities — the campaign units inside a project.
 * Requires: CREATE_WORKSPACE permission.
 */
export async function createWorkspace(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const isMentorQuery = await db
    .prepare('SELECT 1 FROM project_coordinators WHERE project_id = ? AND user_id = ?')
    .bind(projectId, session.userId)
    .first();

  const ctx = await getSessionContext(session.userId);
  const isMentor = !!isMentorQuery;
  const hasGlobalPerm = ctx.can('CREATE_WORKSPACE') || ctx.can('WORKSPACE_MANAGE') || ctx.can('PROJECT_MANAGE');

  if (!isMentor && !hasGlobalPerm) {
    return { success: false, error: 'Forbidden: You do not have permission to create a workspace for this project.' };
  }

  const name          = formData.get('name') as string;
  const description   = formData.get('description') as string;
  const mentorId      = formData.get('mentorId') as string | null;
  const workspaceType = (formData.get('workspace_type') as string) || 'TROOPERS';

  if (!name?.trim()) {
    return { success: false, error: 'Workspace name is required.' };
  }

  const workspaceId = `ws_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    if (workspaceType === 'ASSESSMENT') {
      // ── Assessment Workspace ─────────────────────────────────────────────
      // No single mentor — all "mentor troopers" are auto-enrolled as LEADER
      // All "on the job training" OJT are auto-enrolled as MEMBER
      await db
        .prepare(`
          INSERT INTO workspaces (id, project_id, name, description, status, created_by, workspace_type, created_at)
          VALUES (?, ?, ?, ?, 'ACTIVE', ?, 'ASSESSMENT', strftime('%s', 'now'))
        `)
        .bind(workspaceId, projectId, name.trim(), description || null, session.userId)
        .run();

      // Fetch all OJT users (role = ON THE JOB TRAINING or user_type = OJT)
      const { results: ojtUsers } = await db
        .prepare(`
          SELECT DISTINCT u.id FROM users u
          LEFT JOIN user_roles ur ON u.id = ur.user_id
          LEFT JOIN roles r ON ur.role_id = r.id
          WHERE (
            LOWER(r.name) LIKE '%job%training%' 
            OR LOWER(r.name) LIKE '%ojt%' 
            OR r.id = 'role_on_the_job_training'
            OR u.user_type = 'OJT'
          )
          AND u.status = 'ACTIVE'
        `)
        .all();

      // Fetch all mentor users (role = MENTOR TROOPERS)
      const { results: mentorUsers } = await db
        .prepare(`
          SELECT DISTINCT u.id FROM users u
          LEFT JOIN user_roles ur ON u.id = ur.user_id
          LEFT JOIN roles r ON ur.role_id = r.id
          WHERE (
            LOWER(r.name) LIKE '%mentor%' 
            OR r.id = 'role_mentor_troopers'
          )
          AND u.status = 'ACTIVE'
        `)
        .all();

      // Enroll all OJT as MEMBER
      for (const u of ojtUsers as { id: string }[]) {
        await db
          .prepare(`INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role, created_at)
                    VALUES (?, ?, 'MEMBER', strftime('%s', 'now'))`)
          .bind(workspaceId, u.id)
          .run();
      }

      // Enroll all mentors as LEADER
      for (const u of mentorUsers as { id: string }[]) {
        await db
          .prepare(`INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role, created_at)
                    VALUES (?, ?, 'LEADER', strftime('%s', 'now'))`)
          .bind(workspaceId, u.id)
          .run();
      }

      // Always ensure the workspace creator is enrolled as LEADER
      await db
        .prepare(`INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role, created_at)
                  VALUES (?, ?, 'LEADER', strftime('%s', 'now'))`)
        .bind(workspaceId, session.userId)
        .run();

    } else {
      // ── Standard / Troopers Workspace ────────────────────────────────────
      const ojtCoordinatorId = mentorId || session.userId;
      await db
        .prepare(`
          INSERT INTO workspaces (id, project_id, name, description, status, created_by, ojt_coordinator_id, workspace_type, created_at)
          VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, 'TROOPERS', strftime('%s', 'now'))
        `)
        .bind(workspaceId, projectId, name.trim(), description || null, session.userId, ojtCoordinatorId)
        .run();
    }

    await logWorkflowEvent({
      entityType: 'workspace',
      entityId: workspaceId,
      fromStatus: null,
      toStatus: 'ACTIVE',
      triggeredBy: session.userId,
      note: `Workspace "${name}" [${workspaceType}] created`,
    });

    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true, workspaceId };
  } catch (err: any) {
    console.error('createWorkspace failed:', err);
    return { success: false, error: err.message };
  }
}


// ---------------------------------------------------------------------------
// UPDATE WORKSPACE
// ---------------------------------------------------------------------------

/**
 * Updates workspace name, description, or mentor.
 * Requires: UPDATE_WORKSPACE permission.
 */
export async function updateWorkspace(workspaceId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'UPDATE_WORKSPACE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;

  if (!name?.trim()) {
    return { success: false, error: 'Workspace name is required.' };
  }

  const db = await getDB();

  try {
    const ws = await db
      .prepare('SELECT project_id FROM workspaces WHERE id = ?')
      .bind(workspaceId)
      .first() as { project_id: string } | null;

    if (!ws) return { success: false, error: 'Workspace not found.' };

    const ojtCoordinatorId = formData.get('ojt_coordinator_id') as string;

    await db
      .prepare(`
        UPDATE workspaces SET name = ?, description = ?, ojt_coordinator_id = ? WHERE id = ?
      `)
      .bind(name.trim(), description || null, ojtCoordinatorId || null, workspaceId)
      .run();

    revalidatePath(`/dashboard/projects/${ws.project_id}`);
    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('updateWorkspace failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// COMPLETE / ARCHIVE WORKSPACE
// ---------------------------------------------------------------------------

/**
 * Changes workspace status. Validates against the workspace state machine.
 * Requires: UPDATE_WORKSPACE permission.
 */
export async function updateWorkspaceStatus(
  workspaceId: string,
  newStatus: 'COMPLETED' | 'ARCHIVED',
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'UPDATE_WORKSPACE');

  const db = await getDB();

  const ws = await db
    .prepare('SELECT id, project_id, status FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { id: string; project_id: string; status: string } | null;

  if (!ws) return { success: false, error: 'Workspace not found.' };

  try {
    validateTransition('workspace', ws.status, newStatus);

    await db
      .prepare('UPDATE workspaces SET status = ? WHERE id = ?')
      .bind(newStatus, workspaceId)
      .run();

    await logWorkflowEvent({
      entityType: 'workspace',
      entityId: workspaceId,
      fromStatus: ws.status,
      toStatus: newStatus,
      triggeredBy: session.userId,
    });

    revalidatePath(`/dashboard/projects/${ws.project_id}`);
    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('updateWorkspaceStatus failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// OJT TEAM MEMBERSHIP & ROLES MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * Local helper to verify if the user has authority to manage OJT team members in this workspace.
 */
async function checkOJTManagementAuthority(db: any, workspaceId: string, userId: string): Promise<boolean> {
  const ctx = await getSessionContext(userId);
  if (ctx.can('MANAGE')) return true;

  const ws = await db
    .prepare('SELECT ojt_coordinator_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { ojt_coordinator_id: string | null } | null;

  if (ws?.ojt_coordinator_id === userId) return true;

  const member = await db
    .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND team_role = 'LEADER'")
    .bind(workspaceId, userId)
    .first();

  if (member) return true;

  return false;
}

/**
 * Adds an OJT member to a workspace by their email.
 */
export async function addWorkspaceMember(
  workspaceId: string,
  email: string,
  teamRole: 'MEMBER' | 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' = 'MEMBER',
) {
  return addWorkspaceMembersBulk(workspaceId, [email], teamRole);
}

/**
 * Adds multiple members to a workspace by array of emails or user IDs.
 */
export async function addWorkspaceMembersBulk(
  workspaceId: string,
  emailsOrIds: string[],
  teamRole: 'MEMBER' | 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' = 'MEMBER',
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const hasAuthority = await checkOJTManagementAuthority(db, workspaceId, session.userId);
  if (!hasAuthority) throw new Error('Forbidden: You are not authorized to manage team members.');

  if (!emailsOrIds || emailsOrIds.length === 0) {
    return { success: false, error: 'Pilih atau ketik minimal satu anggota untuk ditambahkan.' };
  }

  const cleanInputs = Array.from(new Set(emailsOrIds.map((e) => e.trim().toLowerCase()).filter(Boolean)));

  try {
    let addedCount = 0;

    for (const input of cleanInputs) {
      // Find user by ID or email
      const targetUser = await db
        .prepare('SELECT id FROM users WHERE email = ? OR id = ?')
        .bind(input, input)
        .first() as { id: string } | null;

      if (targetUser) {
        await db
          .prepare('INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES (?, ?, ?)')
          .bind(workspaceId, targetUser.id, teamRole)
          .run();
        addedCount++;
      }
    }

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return {
      success: true,
      addedCount,
      message: `${addedCount} anggota berhasil ditambahkan ke workspace!`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menambahkan anggota tim.' };
  }
}

/**
 * Updates an OJT member's team roles inside a workspace.
 * Deletes existing roles for this member in this workspace and inserts the new ones.
 */
export async function updateWorkspaceMemberRoles(
  workspaceId: string,
  userId: string,
  teamRoles: ('MEMBER' | 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR')[],
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  
  const ws = await db
    .prepare('SELECT ojt_coordinator_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { ojt_coordinator_id: string | null } | null;

  const isMentor = ws?.ojt_coordinator_id === session.userId;

  // Check if logged-in user is LEADER
  const loggedInUserRoles = await getLocalWorkspaceRoles(workspaceId, session.userId);
  const isLeader = loggedInUserRoles.includes('LEADER');

  const ctx = await getSessionContext(session.userId);
  const isGlobalAdmin = ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE') || ctx.userType === 'STAFF';

  if (!isMentor && !isLeader && !isGlobalAdmin) {
    throw new Error('Forbidden: You do not have permission to manage workspace roles.');
  }

  // Get target user's current roles
  const currentRoles = await getLocalWorkspaceRoles(workspaceId, userId);

  // Determine what roles are being added or removed
  const rolesToAdd = teamRoles.filter(r => !currentRoles.includes(r));
  const rolesToRemove = currentRoles.filter(r => !teamRoles.includes(r));

  // Enforce OJT Split-Role Constraints:
  // 1. LEADER role can ONLY be changed by the Mentor, Staff Coordinator, or Global Admin
  if (rolesToAdd.includes('LEADER') || rolesToRemove.includes('LEADER')) {
    if (!isMentor && !isGlobalAdmin) {
      return { success: false, error: 'Only the Mentor, Coordinator, or Admin can delegate or remove the Team Lead.' };
    }
  }

  // 2. OJT roles (RESEARCHER, PLANNER, CREATOR) can ONLY be changed by the Team Lead, Mentor, or Global Admin
  const isChangingOjtRoles = (['RESEARCHER', 'PLANNER', 'CREATOR'] as const).some(
    (r: string) => rolesToAdd.includes(r as any) || rolesToRemove.includes(r as any)
  );
  if (isChangingOjtRoles) {
    if (!isLeader && !isMentor && !isGlobalAdmin) {
      return { success: false, error: 'Only the Team Lead can assign or change team roles.' };
    }
  }

  // Ensure 'MEMBER' role is always kept
  const finalRoles = Array.from(new Set([...teamRoles, 'MEMBER']));

  try {
    // Delete all current roles for this user in this workspace
    await db
      .prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .run();

    // Insert new roles
    for (const role of finalRoles) {
      await db
        .prepare('INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES (?, ?, ?)')
        .bind(workspaceId, userId, role)
        .run();
    }

    const ws = await db.prepare('SELECT project_id FROM workspaces WHERE id = ?').bind(workspaceId).first() as { project_id: string } | null;
    if (ws) {
      revalidatePath(`/dashboard/workspace/${workspaceId}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update roles.' };
  }
}

/**
 * Updates an OJT member's team role inside a workspace (Backward compatible).
 */
export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  teamRole: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR',
) {
  return updateWorkspaceMemberRoles(workspaceId, userId, [teamRole]);
}

/**
 * Removes an OJT member from a workspace.
 */
export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const hasAuthority = await checkOJTManagementAuthority(db, workspaceId, session.userId);
  if (!hasAuthority) throw new Error('Forbidden: You are not authorized to manage team members.');

  try {
    // 1. Delete all workspace_members records for this user in this workspace
    await db
      .prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .run();

    // 2. Delete all task_assignments for this user under tasks in this workspace
    await db
      .prepare(`
        DELETE FROM task_assignments
        WHERE user_id = ?
          AND task_id IN (SELECT id FROM tasks WHERE workspace_id = ?)
      `)
      .bind(userId, workspaceId)
      .run();

    const ws = await db.prepare('SELECT project_id FROM workspaces WHERE id = ?').bind(workspaceId).first() as { project_id: string } | null;
    if (ws) {
      revalidatePath(`/dashboard/workspace/${workspaceId}`);
      revalidatePath(`/dashboard/projects/${ws.project_id}`);
    }
    revalidatePath('/dashboard/workspace');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// DELETE WORKSPACE (soft delete)
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a workspace by setting deleted_at timestamp.
 * Accessible by:
 *  - The workspace's OJT coordinator (creator/mentor)
 *  - The project's mentor (project_coordinators)
 *  - Any user with global DELETE permission (STAFF admin)
 */
export async function deleteWorkspace(workspaceId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  // Fetch workspace to determine authorization
  const ws = await db
    .prepare('SELECT id, project_id, ojt_coordinator_id, deleted_at FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { id: string; project_id: string; ojt_coordinator_id: string | null; deleted_at: number | null } | null;

  if (!ws) return { success: false, error: 'Workspace not found.' };
  if (ws.deleted_at) return { success: false, error: 'Workspace is already deleted.' };

  const ctx = await getSessionContext(session.userId);
  const hasGlobalDelete = ctx.can('DELETE');

  // Check if user is the workspace creator/coordinator
  const isWsCreator = ws.ojt_coordinator_id === session.userId;

  // Check if user is the project mentor
  const projectMentor = await db
    .prepare('SELECT 1 FROM project_coordinators WHERE project_id = ? AND user_id = ?')
    .bind(ws.project_id, session.userId)
    .first();
  const isProjectMentor = !!projectMentor;

  if (!isWsCreator && !isProjectMentor && !hasGlobalDelete) {
    return { success: false, error: 'Forbidden: You do not have permission to delete this workspace.' };
  }

  try {
    const deletedAt = Date.now();
    await db
      .prepare('UPDATE workspaces SET deleted_at = ? WHERE id = ?')
      .bind(deletedAt, workspaceId)
      .run();

    await logWorkflowEvent({
      entityType: 'workspace',
      entityId: workspaceId,
      fromStatus: 'ACTIVE',
      toStatus: 'DELETED',
      triggeredBy: session.userId,
      note: 'Workspace soft-deleted',
    });

    revalidatePath(`/dashboard/projects/${ws.project_id}`);
    revalidatePath('/dashboard/workspace');
    return { success: true, projectId: ws.project_id };
  } catch (err: any) {
    console.error('deleteWorkspace failed:', err);
    return { success: false, error: err.message };
  }
}

