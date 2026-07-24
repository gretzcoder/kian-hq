'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, getSessionContext } from '@/modules/roles/rbac';
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

  await checkPermission(session.userId, 'CREATE_WORKSPACE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const deadlineStr = formData.get('deadline') as string;

  if (!name?.trim()) {
    return { success: false, error: 'Workspace name is required.' };
  }

  const db = await getDB();
  const workspaceId = `ws_${crypto.randomUUID().replace(/-/g, '')}`;
  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;

  try {
    const ojtCoordinatorId = formData.get('ojt_coordinator_id') as string;

    await db
      .prepare(`
        INSERT INTO workspaces (id, project_id, name, description, status, deadline, created_by, ojt_coordinator_id)
        VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
      `)
      .bind(workspaceId, projectId, name.trim(), description || null, deadline, session.userId, ojtCoordinatorId || null)
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
    revalidatePath(`/dashboard/projects/${ws.project_id}/workspace/${workspaceId}`);
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
    revalidatePath(`/dashboard/projects/${ws.project_id}/workspace/${workspaceId}`);
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
  teamRole: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR',
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
      revalidatePath(`/dashboard/projects/${ws.project_id}/workspace/${workspaceId}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add member.' };
  }
}

/**
 * Updates an OJT member's team role inside a workspace.
 */
export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  teamRole: 'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR',
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const hasAuthority = await checkOJTManagementAuthority(db, workspaceId, session.userId);
  if (!hasAuthority) throw new Error('Forbidden: You are not authorized to manage team members.');

  try {
    await db
      .prepare('UPDATE workspace_members SET team_role = ? WHERE workspace_id = ? AND user_id = ?')
      .bind(teamRole, workspaceId, userId)
      .run();

    const ws = await db.prepare('SELECT project_id FROM workspaces WHERE id = ?').bind(workspaceId).first() as { project_id: string } | null;
    if (ws) {
      revalidatePath(`/dashboard/projects/${ws.project_id}/workspace/${workspaceId}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
      revalidatePath(`/dashboard/projects/${ws.project_id}/workspace/${workspaceId}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
