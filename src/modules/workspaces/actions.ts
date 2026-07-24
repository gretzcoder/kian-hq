'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
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
    await db
      .prepare(`
        INSERT INTO workspaces (id, project_id, name, description, status, deadline, created_by)
        VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
      `)
      .bind(workspaceId, projectId, name.trim(), description || null, deadline, session.userId)
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

    await db
      .prepare(`
        UPDATE workspaces SET name = ?, description = ?, deadline = ? WHERE id = ?
      `)
      .bind(name.trim(), description || null, deadline, workspaceId)
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
