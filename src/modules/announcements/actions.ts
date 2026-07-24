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
