'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to create a new project.
 * Protected by 'CREATE' permission.
 */
export async function createProject(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce RBAC CREATE permission
  await checkPermission(session.userId, 'CREATE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const gdriveFolderUrl = formData.get('gdriveFolderUrl') as string;
  const deadlineStr = formData.get('deadline') as string;

  if (!name) {
    return { success: false, error: 'Project name is required.' };
  }

  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;
  const db = await getDB();
  const projectId = `proj_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(
        'INSERT INTO projects (id, name, description, gdrive_folder_id, status, deadline) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(projectId, name, description || null, gdriveFolderUrl || null, 'PLANNING', deadline)
      .run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');

    return { success: true, projectId };
  } catch (error: any) {
    console.error('createProject action failed:', error);
    return { success: false, error: error.message || 'Failed to create project.' };
  }
}

/**
 * Server Action to update an existing project.
 * Protected by 'UPDATE' permission.
 */
export async function updateProject(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce RBAC UPDATE permission
  await checkPermission(session.userId, 'UPDATE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const gdriveFolderUrl = formData.get('gdriveFolderUrl') as string;
  const status = formData.get('status') as string;
  const deadlineStr = formData.get('deadline') as string;

  if (!name) {
    return { success: false, error: 'Project name is required.' };
  }

  const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;
  const db = await getDB();

  try {
    await db
      .prepare(
        'UPDATE projects SET name = ?, description = ?, gdrive_folder_id = ?, status = ?, deadline = ? WHERE id = ?'
      )
      .bind(name, description || null, gdriveFolderUrl || null, status || 'PLANNING', deadline, projectId)
      .run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${projectId}`);

    return { success: true };
  } catch (error: any) {
    console.error('updateProject action failed:', error);
    return { success: false, error: error.message || 'Failed to update project.' };
  }
}

/**
 * Server Action to delete a project.
 * Protected by 'DELETE' permission.
 */
export async function deleteProject(projectId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce RBAC DELETE permission
  await checkPermission(session.userId, 'DELETE');

  const db = await getDB();

  try {
    // Delete cascading tasks and project row
    await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');

    return { success: true };
  } catch (error: any) {
    console.error('deleteProject action failed:', error);
    return { success: false, error: error.message || 'Failed to delete project.' };
  }
}
