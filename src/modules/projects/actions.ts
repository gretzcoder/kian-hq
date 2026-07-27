'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { validateTransition } from '@/modules/workflow/engine';
import { logWorkflowEvent } from '@/modules/workflow/events';

// ---------------------------------------------------------------------------
// CREATE PROJECT (from a locked brief)
// ---------------------------------------------------------------------------

/**
 * Creates a new project. Brief must be in LOCKED status.
 * Auto-transitions brief to PROJECT_CREATED after project is made.
 * Requires: CREATE_PROJECT permission.
 */
export async function createProject(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'CREATE_PROJECT');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const gdriveFolderUrl = formData.get('gdriveFolderUrl') as string;
  const ojtCoordinatorIds = formData.getAll('ojtCoordinatorIds') as string[];
  const briefId = formData.get('briefId') as string | null; // optional: link from brief

  if (!name?.trim()) {
    return { success: false, error: 'Project name is required.' };
  }

  if (ojtCoordinatorIds.length === 0) {
    return { success: false, error: 'At least one Coordinator is required.' };
  }

  const db = await getDB();
  const projectId = `proj_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    const firstMentorId = ojtCoordinatorIds[0] || null;

    await db
      .prepare(`
        INSERT INTO projects (id, name, description, gdrive_folder_id, status, deadline, ojt_coordinator_id)
        VALUES (?, ?, ?, ?, 'PLANNING', NULL, ?)
      `)
      .bind(projectId, name.trim(), description || null, gdriveFolderUrl || null, firstMentorId)
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
      toStatus: 'PLANNING',
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
 * Requires: UPDATE permission.
 */
export async function updateProject(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'UPDATE');

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const gdriveFolderUrl = formData.get('gdriveFolderUrl') as string;
  const status = formData.get('status') as string;
  const ojtCoordinatorIds = formData.getAll('ojtCoordinatorIds') as string[];

  if (!name?.trim()) {
    return { success: false, error: 'Project name is required.' };
  }

  const db = await getDB();

  try {
    const firstMentorId = ojtCoordinatorIds[0] || null;

    await db
      .prepare(`
        UPDATE projects
        SET name = ?, description = ?, gdrive_folder_id = ?, status = ?, ojt_coordinator_id = ?
        WHERE id = ?
      `)
      .bind(name.trim(), description || null, gdriveFolderUrl || null, status || 'PLANNING', firstMentorId, projectId)
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

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('updateProject failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// PUBLISH PROJECT
// ---------------------------------------------------------------------------

/**
 * Changes project status to PUBLISHED.
 * Validates via state machine.
 * Requires: PUBLISH_PROJECT permission.
 */
export async function publishProject(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'PUBLISH_PROJECT');

  const db = await getDB();

  const project = await db
    .prepare('SELECT id, status FROM projects WHERE id = ?')
    .bind(projectId)
    .first() as { id: string; status: string } | null;

  if (!project) return { success: false, error: 'Project not found.' };

  try {
    validateTransition('project', project.status, 'PUBLISHED');

    await db
      .prepare("UPDATE projects SET status = 'PUBLISHED' WHERE id = ?")
      .bind(projectId)
      .run();

    await logWorkflowEvent({
      entityType: 'project',
      entityId: projectId,
      fromStatus: project.status,
      toStatus: 'PUBLISHED',
      triggeredBy: session.userId,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('publishProject failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// ARCHIVE PROJECT
// ---------------------------------------------------------------------------

/**
 * Archives a project.
 * Requires: ARCHIVE_PROJECT permission.
 */
export async function archiveProject(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ARCHIVE_PROJECT');

  const db = await getDB();

  const project = await db
    .prepare('SELECT id, status FROM projects WHERE id = ?')
    .bind(projectId)
    .first() as { id: string; status: string } | null;

  if (!project) return { success: false, error: 'Project not found.' };

  try {
    validateTransition('project', project.status, 'ARCHIVED');

    await db
      .prepare("UPDATE projects SET status = 'ARCHIVED' WHERE id = ?")
      .bind(projectId)
      .run();

    await logWorkflowEvent({
      entityType: 'project',
      entityId: projectId,
      fromStatus: project.status,
      toStatus: 'ARCHIVED',
      triggeredBy: session.userId,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('archiveProject failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// DELETE PROJECT
// ---------------------------------------------------------------------------

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
    await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
    return { success: true };
  } catch (err: any) {
    console.error('deleteProject failed:', err);
    return { success: false, error: err.message };
  }
}
