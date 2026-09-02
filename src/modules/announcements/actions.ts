'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { sendPushNotificationToUsers } from '@/modules/notifications/pushActions';

/**
 * Server Action to post a new announcement.
 * Protected by 'CREATE_ANNOUNCEMENT' permission (renamed from 'CREATE').
 */
export async function createAnnouncement(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized: No active session');

  await checkPermission(session.userId, 'ANNOUNCEMENT_POST');

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

    // Async Web Push dispatch for announcement
    try {
      const { results: userRows } = await db
        .prepare("SELECT id FROM users WHERE status = 'ACTIVE' AND id != ?")
        .bind(session.userId)
        .all();

      const userIds = (userRows as any[] || []).map((u) => u.id as string);
      if (userIds.length > 0) {
        sendPushNotificationToUsers(userIds, 'ANNOUNCEMENT', {
          title: `📢 Pengumuman: ${title}`,
          body: content.length > 100 ? `${content.slice(0, 97)}...` : content,
          url: '/dashboard/announcements',
          category: 'ANNOUNCEMENT',
          tag: `ann_${annId}`,
        }).catch(() => {});
      }
    } catch (pushErr) {
      console.error('Failed to trigger announcement Web Push:', pushErr);
    }

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
export async function addAnnouncementComment(
  announcementId: string,
  content: string,
  parentId?: string | null
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const trimmed = content?.trim();
  if (!trimmed) return { success: false, error: 'Comment content cannot be empty.' };

  const db = await getDB();
  const commentId = `ac_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO announcement_comments (id, announcement_id, user_id, parent_id, content) VALUES (?, ?, ?, ?, ?)')
      .bind(commentId, announcementId, session.userId, parentId || null, trimmed)
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

/**
 * Fetch fresh announcements, comments, and reactions for real-time polling.
 */
export async function getAnnouncementsUpdates() {
  const session = await getSession();
  if (!session) return null;

  const db = await getDB();

  try {
    const announcementsRaw = await db.prepare(`
      SELECT a.id, a.title, a.content, a.created_at, a.created_by, u.name as author_name, u.avatar_url as author_avatar
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 20
    `).all();

    const annList = (announcementsRaw.results || []) as any[];
    if (annList.length === 0) {
      return { announcements: [], comments: [], reactions: [] };
    }

    const annIds = annList.map((a) => a.id);
    const placeholders = annIds.map(() => '?').join(',');

    const [commentsRaw, reactionsRaw] = await Promise.all([
      db.prepare(`
        SELECT ac.id, ac.announcement_id, ac.user_id, ac.parent_id, ac.content, ac.created_at, u.name as user_name, u.avatar_url as user_avatar
        FROM announcement_comments ac
        LEFT JOIN users u ON ac.user_id = u.id
        WHERE ac.announcement_id IN (${placeholders})
        ORDER BY ac.created_at ASC
      `).bind(...annIds).all(),

      db.prepare(`
        SELECT announcement_id, emoji, COUNT(*) as count,
               MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
        FROM announcement_reactions
        WHERE announcement_id IN (${placeholders})
        GROUP BY announcement_id, emoji
      `).bind(session.userId, ...annIds).all(),
    ]);

    return {
      announcements: annList,
      comments: (commentsRaw.results || []) as any[],
      reactions: (reactionsRaw.results || []) as any[],
    };
  } catch (err) {
    console.error('getAnnouncementsUpdates failed:', err);
    return null;
  }
}

