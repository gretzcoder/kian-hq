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
  const hasGlobalPerm = ctx.can('CREATE_WORKSPACE');

  if (!isMentor && !hasGlobalPerm) {
    return { success: false, error: 'Forbidden: You do not have permission to create a workspace for this project.' };
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const deadlineStr = formData.get('deadline') as string;

  if (!name?.trim()) {
    return { success: false, error: 'Workspace name is required.' };
  }

  const workspaceId = `ws_${crypto.randomUUID().replace(/-/g, '')}`;
  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;

  try {
    const ojtCoordinatorId = session.userId;

    await db
      .prepare(`
        INSERT INTO workspaces (id, project_id, name, description, status, deadline, created_by, ojt_coordinator_id)
        VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
      `)
      .bind(workspaceId, projectId, name.trim(), description || null, deadline, session.userId, ojtCoordinatorId)
      .run();

    await logWorkflowEvent({
      entityType: 'workspace',
      entityId: workspaceId,
      fromStatus: null,
      toStatus: 'ACTIVE',
      triggeredBy: session.userId,
      note: `Workspace "${name}" created`,
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
 * Updates workspace name, description, or deadline.
 * Requires: UPDATE_WORKSPACE permission.
 */
export async function updateWorkspace(workspaceId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'UPDATE_WORKSPACE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const deadlineStr = formData.get('deadline') as string;

  if (!name?.trim()) {
    return { success: false, error: 'Workspace name is required.' };
  }

  const db = await getDB();
  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;

  try {
    const ws = await db
      .prepare('SELECT project_id FROM workspaces WHERE id = ?')
      .bind(workspaceId)
      .first() as { project_id: string } | null;

    if (!ws) return { success: false, error: 'Workspace not found.' };

    const ojtCoordinatorId = formData.get('ojt_coordinator_id') as string;

    await db
      .prepare(`
        UPDATE workspaces SET name = ?, description = ?, deadline = ?, ojt_coordinator_id = ? WHERE id = ?
      `)
      .bind(name.trim(), description || null, deadline, ojtCoordinatorId || null, workspaceId)
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
  try {
    const ctx = await getSessionContext(userId);
    if (ctx.can('MANAGE')) return true;
  } catch {}

  const ws = await db
    .prepare('SELECT ojt_coordinator_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { ojt_coordinator_id: string | null } | null;

  if (ws?.ojt_coordinator_id === userId) return true;

  const member = await db
    .prepare('SELECT team_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first() as { team_role: string } | null;

  if (member?.team_role === 'LEADER') return true;

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
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const hasAuthority = await checkOJTManagementAuthority(db, workspaceId, session.userId);
  if (!hasAuthority) throw new Error('Forbidden: You are not authorized to manage team members.');

  const targetUser = await db
    .prepare('SELECT id, user_type FROM users WHERE email = ?')
    .bind(email.trim().toLowerCase())
    .first() as { id: string; user_type: string } | null;

  if (!targetUser) {
    return { success: false, error: `User with email "${email}" not found.` };
  }

  try {
    await db
      .prepare('INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES (?, ?, ?)')
      .bind(workspaceId, targetUser.id, teamRole)
      .run();

    const ws = await db.prepare('SELECT project_id FROM workspaces WHERE id = ?').bind(workspaceId).first() as { project_id: string } | null;
    if (ws) {
      revalidatePath(`/dashboard/workspace/${workspaceId}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add member.' };
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
  const isGlobalAdmin = ctx.can('MANAGE');

  if (!isMentor && !isLeader && !isGlobalAdmin) {
    throw new Error('Forbidden: You do not have permission to manage workspace roles.');
  }

  // Get target user's current roles
  const currentRoles = await getLocalWorkspaceRoles(workspaceId, userId);

  // Determine what roles are being added or removed
  const rolesToAdd = teamRoles.filter(r => !currentRoles.includes(r));
  const rolesToRemove = currentRoles.filter(r => !teamRoles.includes(r));

  // Enforce OJT Split-Role Constraints:
  // 1. LEADER role can ONLY be changed by the Mentor or Global Admin
  if (rolesToAdd.includes('LEADER') || rolesToRemove.includes('LEADER')) {
    if (!isMentor && !isGlobalAdmin) {
      return { success: false, error: 'Only the Mentor can delegate or remove the Team Lead.' };
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
    await db
      .prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .run();

    const ws = await db.prepare('SELECT project_id FROM workspaces WHERE id = ?').bind(workspaceId).first() as { project_id: string } | null;
    if (ws) {
      revalidatePath(`/dashboard/workspace/${workspaceId}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
