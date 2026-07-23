'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, hasPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

interface TaskRow {
  id: string;
  project_id: string;
  assigned_to: string | null;
}

/**
 * Server Action to create a new task.
 * Protected by 'CREATE' permission.
 */
export async function createTask(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce RBAC CREATE permission
  await checkPermission(session.userId, 'CREATE');

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const assignedTo = formData.get('assignedTo') as string;
  const deadlineStr = formData.get('deadline') as string;

  if (!title) {
    return { success: false, error: 'Task title is required.' };
  }

  // If assigning task, verify user has ASSIGN permission
  if (assignedTo) {
    await checkPermission(session.userId, 'ASSIGN');
  }

  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;
  const db = await getDB();
  const taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(
        'INSERT INTO tasks (id, project_id, title, description, status, assigned_to, created_by, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        taskId,
        projectId,
        title,
        description || null,
        'TODO',
        assignedTo || null,
        session.userId,
        deadline
      )
      .run();

    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath('/dashboard/tasks');

    return { success: true, taskId };
  } catch (error: any) {
    console.error('createTask action failed:', error);
    return { success: false, error: error.message || 'Failed to create task.' };
  }
}

/**
 * Server Action to update task status.
 * Checks permissions dynamically:
 * - Setting to APPROVED/COMPLETED requires 'APPROVE' permission.
 * - Basic status updates require 'UPDATE' permission.
 */
export async function updateTaskStatus(taskId: string, newStatus: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  const db = await getDB();

  try {
    // Fetch target task to identify its project
    const task = await db
      .prepare('SELECT id, project_id, assigned_to FROM tasks WHERE id = ?')
      .bind(taskId)
      .first() as TaskRow | null;

    if (!task) {
      return { success: false, error: 'Task not found.' };
    }

    // RBAC validation checks:
    if (newStatus === 'APPROVED' || newStatus === 'COMPLETED') {
      // Must have APPROVE permission to set task as approved or completed
      await checkPermission(session.userId, 'APPROVE');
    } else {
      // General status updates (e.g. Todo -> In Progress -> In Review) requires UPDATE permission
      // Exception: Creator can update tasks assigned to themselves
      const isAssignedToMe = task.assigned_to === session.userId;
      const canUpdate = await hasPermission(session.userId, 'UPDATE');

      if (!canUpdate && !isAssignedToMe) {
        throw new Error('Forbidden: You can only update tasks assigned to you.');
      }
    }

    await db.prepare('UPDATE tasks SET status = ? WHERE id = ?').bind(newStatus, taskId).run();

    revalidatePath(`/dashboard/projects/${task.project_id}`);
    revalidatePath('/dashboard/tasks');

    return { success: true };
  } catch (error: any) {
    console.error('updateTaskStatus action failed:', error);
    return { success: false, error: error.message || 'Failed to update task status.' };
  }
}

/**
 * Server Action to submit task asset URL (e.g., Google Drive link).
 * Protected by 'UPLOAD' permission, or must be assigned to the user.
 */
export async function submitTaskAsset(taskId: string, assetUrl: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  if (!assetUrl) {
    return { success: false, error: 'Asset URL is required.' };
  }

  const db = await getDB();

  try {
    const task = await db
      .prepare('SELECT id, project_id, assigned_to FROM tasks WHERE id = ?')
      .bind(taskId)
      .first() as TaskRow | null;

    if (!task) {
      return { success: false, error: 'Task not found.' };
    }

    // Verify creator is either assigned to the task OR has UPDATE permission
    const isAssignedToMe = task.assigned_to === session.userId;
    const canUpload = await hasPermission(session.userId, 'UPLOAD');

    if (!canUpload && !isAssignedToMe) {
      throw new Error('Forbidden: You can only submit assets for tasks assigned to you.');
    }

    // Save asset link in D1 and move status to IN_REVIEW automatically
    await db
      .prepare('UPDATE tasks SET gdrive_asset_url = ?, status = ? WHERE id = ?')
      .bind(assetUrl, 'IN_REVIEW', taskId)
      .run();

    revalidatePath(`/dashboard/projects/${task.project_id}`);
    revalidatePath('/dashboard/tasks');

    return { success: true };
  } catch (error: any) {
    console.error('submitTaskAsset action failed:', error);
    return { success: false, error: error.message || 'Failed to submit asset URL.' };
  }
}

/**
 * Server Action to delete a task.
 * Protected by 'DELETE' permission.
 */
export async function deleteTask(taskId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce RBAC DELETE permission
  await checkPermission(session.userId, 'DELETE');

  const db = await getDB();

  try {
    const task = await db
      .prepare('SELECT project_id FROM tasks WHERE id = ?')
      .bind(taskId)
      .first() as { project_id: string } | null;

    if (!task) {
      return { success: false, error: 'Task not found.' };
    }

    await db.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();

    revalidatePath(`/dashboard/projects/${task.project_id}`);
    revalidatePath('/dashboard/tasks');

    return { success: true };
  } catch (error: any) {
    console.error('deleteTask action failed:', error);
    return { success: false, error: error.message || 'Failed to delete task.' };
  }
}
