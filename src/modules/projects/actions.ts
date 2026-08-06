'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { logWorkflowEvent } from '@/modules/workflow/events';

// ---------------------------------------------------------------------------
// CREATE PROJECT (from a locked brief)
// ---------------------------------------------------------------------------

/**
 * Creates a new project.
 * Requires: CREATE_PROJECT permission.
 */
export async function createProject(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'PROJECT_CREATE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const rawCoordinatorIds = formData.getAll('ojtCoordinatorIds') as string[];
  const ojtCoordinatorIds = rawCoordinatorIds.filter((id) => id && id.trim().length > 0);
  const briefId = formData.get('briefId') as string | null;

  if (!name?.trim()) {
    return { success: false, error: 'Nama proyek wajib diisi.' };
  }

  const db = await getDB();
  const projectId = `proj_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    const firstMentorId = ojtCoordinatorIds[0] || null;

    await db
      .prepare(`
        INSERT INTO projects (id, name, description, ojt_coordinator_id)
        VALUES (?, ?, ?, ?)
      `)
      .bind(projectId, name.trim(), description || null, firstMentorId)
      .run();

    for (const mentorId of ojtCoordinatorIds) {
      await db
        .prepare('INSERT OR IGNORE INTO project_coordinators (project_id, user_id) VALUES (?, ?)')
        .bind(projectId, mentorId)
        .run();
    }

    await logWorkflowEvent({
      entityType: 'project',
      entityId: projectId,
      fromStatus: null,
      toStatus: 'ACTIVE',
      triggeredBy: session.userId,
      note: `Project "${name}" created`,
    });

    // If created from a locked brief, advance brief to PROJECT_CREATED
    if (briefId) {
      const brief = await db
        .prepare('SELECT id, status FROM content_briefs WHERE id = ?')
        .bind(briefId)
        .first() as { id: string; status: string } | null;

      if (brief && brief.status === 'LOCKED') {
        await db
          .prepare("UPDATE content_briefs SET status = 'PROJECT_CREATED' WHERE id = ?")
          .bind(briefId)
          .run();

        await logWorkflowEvent({
          entityType: 'brief',
          entityId: briefId,
          fromStatus: 'LOCKED',
          toStatus: 'PROJECT_CREATED',
          triggeredBy: session.userId,
          note: `Project ${projectId} created from this brief`,
        });
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/briefs');
    return { success: true, projectId };
  } catch (err: any) {
    console.error('createProject failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// UPDATE PROJECT
// ---------------------------------------------------------------------------

/**
 * Updates project metadata.
 * Requires: PROJECT_MANAGE permission.
 */
export async function updateProject(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'PROJECT_MANAGE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;

  if (!name?.trim()) {
    return { success: false, error: 'Nama proyek wajib diisi.' };
  }

  const db = await getDB();

  try {
    const rawCoordinators = formData.getAll('ojtCoordinatorIds') as string[];
    const ojtCoordinatorIds = rawCoordinators.filter((id) => id && id.trim().length > 0);

    if (ojtCoordinatorIds.length > 0) {
      const firstMentorId = ojtCoordinatorIds[0];

      await db
        .prepare(`
          UPDATE projects
          SET name = ?, description = ?, ojt_coordinator_id = ?
          WHERE id = ?
        `)
        .bind(name.trim(), description || null, firstMentorId, projectId)
        .run();

      await db
        .prepare('DELETE FROM project_coordinators WHERE project_id = ?')
        .bind(projectId)
        .run();

      for (const mentorId of ojtCoordinatorIds) {
        await db
          .prepare('INSERT OR IGNORE INTO project_coordinators (project_id, user_id) VALUES (?, ?)')
          .bind(projectId, mentorId)
          .run();
      }
    } else {
      await db
        .prepare(`
          UPDATE projects
          SET name = ?, description = ?
          WHERE id = ?
        `)
        .bind(name.trim(), description || null, projectId)
        .run();
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('updateProject failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Updates project coordinators (mentors).
 * Requires: UPDATE permission.
 */
export async function updateProjectCoordinators(projectId: string, userIds: string[]) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'UPDATE');

  if (!userIds || userIds.length === 0) {
    return { success: false, error: 'Proyek harus memiliki minimal 1 Koordinator.' };
  }

  const db = await getDB();

  try {
    const firstMentorId = userIds[0];

    // 1. Update first mentor on projects table and ALL associated workspaces under this project
    await db
      .prepare('UPDATE projects SET ojt_coordinator_id = ? WHERE id = ?')
      .bind(firstMentorId, projectId)
      .run();

    await db
      .prepare('UPDATE workspaces SET ojt_coordinator_id = ? WHERE project_id = ?')
      .bind(firstMentorId, projectId)
      .run();

    // 2. Clear existing coordinators and insert new set
    await db
      .prepare('DELETE FROM project_coordinators WHERE project_id = ?')
      .bind(projectId)
      .run();

    for (const uId of userIds) {
      await db
        .prepare('INSERT OR IGNORE INTO project_coordinators (project_id, user_id) VALUES (?, ?)')
        .bind(projectId, uId)
        .run();
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/workspace');
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('updateProjectCoordinators failed:', err);
    return { success: false, error: err.message || 'Failed to update project coordinators.' };
  }
}



/**
 * Permanently deletes a project and all cascading data.
 * Requires: DELETE permission.
 */
export async function deleteProject(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'DELETE');

  const db = await getDB();

  try {
    // 1. Delete all task assignments for tasks in this project
    await db
      .prepare(`
        DELETE FROM task_assignments
        WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)
      `)
      .bind(projectId)
      .run();

    // 2. Delete all tasks in this project
    await db
      .prepare('DELETE FROM tasks WHERE project_id = ?')
      .bind(projectId)
      .run();

    // 3. Delete all workspaces in this project
    await db
      .prepare('DELETE FROM workspaces WHERE project_id = ?')
      .bind(projectId)
      .run();

    // 4. Delete project record
    await db
      .prepare('DELETE FROM projects WHERE id = ?')
      .bind(projectId)
      .run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    return { success: true };
  } catch (err: any) {
    console.error('deleteProject failed:', err);
    return { success: false, error: err.message };
  }
}
