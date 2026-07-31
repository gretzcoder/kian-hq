'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to post a new announcement.
 * Protected by 'CREATE_ANNOUNCEMENT' permission (renamed from 'CREATE').
 */
export async function createAnnouncement(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized: No active session');

  await checkPermission(session.userId, 'CREATE_ANNOUNCEMENT');

  const title   = formData.get('title') as string;
  const content = formData.get('content') as string;

  if (!title || !content) {
    return { success: false, error: 'Title and content are required.' };
  }

  const db = await getDB();
  const annId = `ann_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO announcements (id, title, content, created_by) VALUES (?, ?, ?, ?)')
      .bind(annId, title, content, session.userId)
      .run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/announcements');

    return { success: true };
  } catch (err: any) {
    console.error('createAnnouncement failed:', err);
    return { success: false, error: err.message || 'Failed to post announcement.' };
  }
}

/**
 * Server Action to delete an announcement.
 * Protected by 'DELETE' permission.
 */
export async function deleteAnnouncement(id: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized: No active session');

  await checkPermission(session.userId, 'DELETE');

  if (!id) return { success: false, error: 'Announcement ID is required.' };

  const db = await getDB();

  try {
    await db.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/announcements');

    return { success: true };
  } catch (err: any) {
    console.error('deleteAnnouncement failed:', err);
    return { success: false, error: err.message || 'Failed to delete announcement.' };
  }
}

/**
 * Server Action to add a comment on an announcement.
 */
export async function addAnnouncementComment(announcementId: string, content: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const trimmed = content?.trim();
  if (!trimmed) return { success: false, error: 'Comment content cannot be empty.' };

  const db = await getDB();
  const commentId = `ac_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO announcement_comments (id, announcement_id, user_id, content) VALUES (?, ?, ?, ?)')
      .bind(commentId, announcementId, session.userId, trimmed)
      .run();

    revalidatePath('/dashboard/announcements');
    return { success: true };
  } catch (err: any) {
    console.error('addAnnouncementComment failed:', err);
    return { success: false, error: err.message || 'Failed to add comment.' };
  }
}

/**
 * Server Action to delete a comment from an announcement.
 */
export async function deleteAnnouncementComment(commentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  try {
    // Only allow owner or admin/delete permission
    const existingRaw = await db
      .prepare('SELECT user_id FROM announcement_comments WHERE id = ?')
      .bind(commentId)
      .first();
    const existing = existingRaw as unknown as { user_id: string } | null;

    if (!existing) return { success: false, error: 'Comment not found.' };

    if (existing.user_id !== session.userId) {
      await checkPermission(session.userId, 'DELETE');
    }

    await db.prepare('DELETE FROM announcement_comments WHERE id = ?').bind(commentId).run();

    revalidatePath('/dashboard/announcements');
    return { success: true };
  } catch (err: any) {
    console.error('deleteAnnouncementComment failed:', err);
    return { success: false, error: err.message || 'Failed to delete comment.' };
  }
}

/**
 * Server Action to toggle an emoji reaction on an announcement.
 */
export async function toggleAnnouncementReaction(announcementId: string, emoji: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!emoji) return { success: false, error: 'Emoji is required.' };

  const db = await getDB();

  try {
    const existing = await db
      .prepare('SELECT 1 FROM announcement_reactions WHERE announcement_id = ? AND user_id = ? AND emoji = ?')
      .bind(announcementId, session.userId, emoji)
      .first();

    if (existing) {
      await db
        .prepare('DELETE FROM announcement_reactions WHERE announcement_id = ? AND user_id = ? AND emoji = ?')
        .bind(announcementId, session.userId, emoji)
        .run();
    } else {
      await db
        .prepare('INSERT INTO announcement_reactions (announcement_id, user_id, emoji) VALUES (?, ?, ?)')
        .bind(announcementId, session.userId, emoji)
        .run();
    }

    revalidatePath('/dashboard/announcements');
    return { success: true };
  } catch (err: any) {
    console.error('toggleAnnouncementReaction failed:', err);
    return { success: false, error: err.message || 'Failed to update reaction.' };
  }
}

