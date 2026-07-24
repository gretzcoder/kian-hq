'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { validateTransition } from '@/modules/workflow/engine';
import { logWorkflowEvent } from '@/modules/workflow/events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BriefRow {
  id: string;
  project_id: string;
  status: string;
}

// ---------------------------------------------------------------------------
// CREATE — Start a new brief in DRAFT state
// ---------------------------------------------------------------------------

/**
 * Creates a new content brief for a project-less context (COLLABORATOR flow).
 * Brief starts in DRAFT state.
 * Requires: CREATE_BRIEF permission.
 */
export async function createBrief(
  formData: FormData,
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'CREATE_BRIEF');

  const title = formData.get('title') as string;
  if (!title?.trim()) {
    return { success: false, error: 'Brief title is required.' };
  }

  const db = await getDB();
  const briefId = `brief_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(`
        INSERT INTO content_briefs
          (id, title, audience, objectives, key_messages, visual_style, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT')
      `)
      .bind(
        briefId,
        title.trim(),
        (formData.get('audience') as string) || null,
        (formData.get('objectives') as string) || null,
        (formData.get('keyMessages') as string) || null,
        (formData.get('visualStyle') as string) || null,
        session.userId,
      )
      .run();

    await logWorkflowEvent({
      entityType: 'brief',
      entityId: briefId,
      fromStatus: null,
      toStatus: 'DRAFT',
      triggeredBy: session.userId,
    });

    revalidatePath('/dashboard/briefs');
    return { success: true, briefId };
  } catch (err: any) {
    console.error('createBrief failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// UPDATE — Edit brief content (only allowed in DRAFT state)
// ---------------------------------------------------------------------------

/**
 * Updates brief content. Only allowed when brief is in DRAFT status.
 * Requires: UPDATE_BRIEF permission.
 */
export async function updateBrief(briefId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'UPDATE_BRIEF');

  const db = await getDB();

  const brief = await db
    .prepare('SELECT id, project_id, status FROM content_briefs WHERE id = ?')
    .bind(briefId)
    .first() as BriefRow | null;

  if (!brief) return { success: false, error: 'Brief not found.' };

  if (brief.status !== 'DRAFT') {
    return {
      success: false,
      error: `Brief cannot be edited in "${brief.status}" status. Only DRAFT briefs can be updated.`,
    };
  }

  const title = formData.get('title') as string;

  try {
    await db
      .prepare(`
        UPDATE content_briefs
        SET title = COALESCE(?, title), audience = ?, objectives = ?, key_messages = ?, visual_style = ?
        WHERE id = ?
      `)
      .bind(
        title?.trim() || null,
        (formData.get('audience') as string) || null,
        (formData.get('objectives') as string) || null,
        (formData.get('keyMessages') as string) || null,
        (formData.get('visualStyle') as string) || null,
        briefId,
      )
      .run();

    if (brief.project_id) {
      revalidatePath(`/dashboard/projects/${brief.project_id}`);
    }
    revalidatePath('/dashboard/briefs');
    return { success: true };
  } catch (err: any) {
    console.error('updateBrief failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// SUBMIT — DRAFT → SUBMITTED → WAITING_REVIEW
// ---------------------------------------------------------------------------

/**
 * Submits a brief for coordinator review.
 * Transitions: DRAFT → SUBMITTED → WAITING_REVIEW (auto-chained).
 * Requires: SUBMIT_BRIEF permission.
 */
export async function submitBrief(briefId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'SUBMIT_BRIEF');

  const db = await getDB();

  const brief = await db
    .prepare('SELECT id, project_id, status FROM content_briefs WHERE id = ?')
    .bind(briefId)
    .first() as BriefRow | null;

  if (!brief) return { success: false, error: 'Brief not found.' };

  try {
    validateTransition('brief', brief.status, 'SUBMITTED');

    const now = Math.floor(Date.now() / 1000);

    // Chain: SUBMITTED → WAITING_REVIEW immediately (no manual step needed)
    await db
      .prepare(`
        UPDATE content_briefs
        SET status = 'WAITING_REVIEW', submitted_at = ?
        WHERE id = ?
      `)
      .bind(now, briefId)
      .run();

    await logWorkflowEvent({
      entityType: 'brief',
      entityId: briefId,
      fromStatus: brief.status,
      toStatus: 'WAITING_REVIEW',
      triggeredBy: session.userId,
      note: 'Brief submitted for coordinator review',
    });

    revalidatePath('/dashboard/briefs');
    revalidatePath(`/dashboard/projects/${brief.project_id}`);
    return { success: true };
  } catch (err: any) {
    console.error('submitBrief failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// APPROVE — WAITING_REVIEW → APPROVED → LOCKED
// ---------------------------------------------------------------------------

/**
 * Approves a brief. Transitions: WAITING_REVIEW → APPROVED → LOCKED (auto-chained).
 * After locking, the brief is immutable unless unlocked by a coordinator.
 * Requires: APPROVE_BRIEF permission.
 */
export async function approveBrief(briefId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'APPROVE_BRIEF');

  const db = await getDB();

  const brief = await db
    .prepare('SELECT id, project_id, status FROM content_briefs WHERE id = ?')
    .bind(briefId)
    .first() as BriefRow | null;

  if (!brief) return { success: false, error: 'Brief not found.' };

  try {
    validateTransition('brief', brief.status, 'APPROVED');

    const now = Math.floor(Date.now() / 1000);

    // Chain: APPROVED → LOCKED immediately
    await db
      .prepare(`
        UPDATE content_briefs
        SET status = 'LOCKED', approved_by = ?, approved_at = ?, locked_at = ?
        WHERE id = ?
      `)
      .bind(session.userId, now, now, briefId)
      .run();

    await logWorkflowEvent({
      entityType: 'brief',
      entityId: briefId,
      fromStatus: brief.status,
      toStatus: 'LOCKED',
      triggeredBy: session.userId,
      note: 'Brief approved and locked by coordinator',
    });

    revalidatePath('/dashboard/briefs');
    revalidatePath(`/dashboard/projects/${brief.project_id}`);
    return { success: true };
  } catch (err: any) {
    console.error('approveBrief failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// REQUEST_CHANGES — WAITING_REVIEW → DRAFT (unlock for editing)
// ---------------------------------------------------------------------------

/**
 * Sends a brief back to DRAFT for revision (like GitHub "Request Changes").
 * Requires: REQUEST_CHANGES permission.
 */
export async function requestBriefChanges(briefId: string, note: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'REQUEST_CHANGES');

  if (!note?.trim()) {
    return { success: false, error: 'A revision note is required when requesting changes.' };
  }

  const db = await getDB();

  const brief = await db
    .prepare('SELECT id, project_id, status FROM content_briefs WHERE id = ?')
    .bind(briefId)
    .first() as BriefRow | null;

  if (!brief) return { success: false, error: 'Brief not found.' };

  try {
    validateTransition('brief', brief.status, 'DRAFT');

    await db
      .prepare(`
        UPDATE content_briefs
        SET status = 'DRAFT', revision_note = ?, approved_by = NULL, approved_at = NULL, locked_at = NULL
        WHERE id = ?
      `)
      .bind(note.trim(), briefId)
      .run();

    await logWorkflowEvent({
      entityType: 'brief',
      entityId: briefId,
      fromStatus: brief.status,
      toStatus: 'DRAFT',
      triggeredBy: session.userId,
      note,
    });

    revalidatePath('/dashboard/briefs');
    revalidatePath(`/dashboard/projects/${brief.project_id}`);
    return { success: true };
  } catch (err: any) {
    console.error('requestBriefChanges failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// UNLOCK — LOCKED → DRAFT (coordinator manually unlocks approved brief)
// ---------------------------------------------------------------------------

/**
 * Unlocks a LOCKED brief so it can be edited again.
 * Requires: UNLOCK_BRIEF permission.
 */
export async function unlockBrief(briefId: string, note: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'UNLOCK_BRIEF');

  const db = await getDB();

  const brief = await db
    .prepare('SELECT id, project_id, status FROM content_briefs WHERE id = ?')
    .bind(briefId)
    .first() as BriefRow | null;

  if (!brief) return { success: false, error: 'Brief not found.' };

  try {
    validateTransition('brief', brief.status, 'DRAFT');

    await db
      .prepare(`
        UPDATE content_briefs
        SET status = 'DRAFT', revision_note = ?, approved_by = NULL, approved_at = NULL, locked_at = NULL
        WHERE id = ?
      `)
      .bind(note?.trim() || 'Brief unlocked for editing', briefId)
      .run();

    await logWorkflowEvent({
      entityType: 'brief',
      entityId: briefId,
      fromStatus: brief.status,
      toStatus: 'DRAFT',
      triggeredBy: session.userId,
      note: note?.trim() || 'Brief unlocked by coordinator',
    });

    revalidatePath('/dashboard/briefs');
    revalidatePath(`/dashboard/projects/${brief.project_id}`);
    return { success: true };
  } catch (err: any) {
    console.error('unlockBrief failed:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// ARCHIVE — PROJECT_CREATED → ARCHIVED
// ---------------------------------------------------------------------------

/**
 * Archives a brief after its project has been created.
 * Requires: ARCHIVE_PROJECT permission.
 */
export async function archiveBrief(briefId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ARCHIVE_PROJECT');

  const db = await getDB();

  const brief = await db
    .prepare('SELECT id, project_id, status FROM content_briefs WHERE id = ?')
    .bind(briefId)
    .first() as BriefRow | null;

  if (!brief) return { success: false, error: 'Brief not found.' };

  try {
    validateTransition('brief', brief.status, 'ARCHIVED');

    await db
      .prepare("UPDATE content_briefs SET status = 'ARCHIVED' WHERE id = ?")
      .bind(briefId)
      .run();

    await logWorkflowEvent({
      entityType: 'brief',
      entityId: briefId,
      fromStatus: brief.status,
      toStatus: 'ARCHIVED',
      triggeredBy: session.userId,
    });

    revalidatePath('/dashboard/briefs');
    return { success: true };
  } catch (err: any) {
    console.error('archiveBrief failed:', err);
    return { success: false, error: err.message };
  }
}
