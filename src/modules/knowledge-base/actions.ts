'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to create a new Knowledge Base article.
 * Protected by 'CREATE' permission.
 */
export async function createKBArticle(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce CREATE_KB permission
  await checkPermission(session.userId, 'CREATE_KB');

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const category = formData.get('category') as string;

  if (!title || !content) {
    return { success: false, error: 'Title and content are required.' };
  }

  const db = await getDB();
  const kbId = `kb_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO knowledge_base (id, title, content, category, created_by) VALUES (?, ?, ?, ?, ?)')
      .bind(kbId, title, content, category || 'GENERAL', session.userId)
      .run();

    revalidatePath('/dashboard/kb');

    return { success: true };
  } catch (error: any) {
    console.error('createKBArticle action failed:', error);
    return { success: false, error: error.message || 'Failed to create article.' };
  }
}
