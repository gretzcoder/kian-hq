'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: Keep old KB article creation for backwards-compatibility
// ─────────────────────────────────────────────────────────────────────────────
export async function createKBArticle(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized: No active session');

  await checkPermission(session.userId, 'KB_MANAGE');

  const title    = formData.get('title')    as string;
  const content  = formData.get('content')  as string;
  const category = formData.get('category') as string;

  if (!title || !content) return { success: false, error: 'Title and content are required.' };

  const db   = await getDB();
  const kbId = `kb_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO knowledge_base (id, title, content, category, created_by) VALUES (?, ?, ?, ?, ?)')
      .bind(kbId, title, content, category || 'GENERAL', session.userId)
      .run();
    revalidatePath('/dashboard/kb');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create article.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
export async function createKBCategory(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'KB_MANAGE');

  const name        = (formData.get('name')        as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const icon        = (formData.get('icon')         as string)?.trim() || '📁';

  if (!name) return { success: false, error: 'Category name is required.' };

  const db = await getDB();
  const id = `kbcat_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, description, icon, session.userId)
      .run();
    revalidatePath('/dashboard/kb');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create category.' };
  }
}

export async function deleteKBCategory(id: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'KB_MANAGE');

  const db = await getDB();
  await db.prepare('DELETE FROM knowledge_categories WHERE id = ?').bind(id).run();
  revalidatePath('/dashboard/kb');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────────────────────────────────────
export async function createKBItem(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'KB_MANAGE');

  const categoryId  = (formData.get('category_id')  as string)?.trim();
  const title       = (formData.get('title')        as string)?.trim();
  const url         = (formData.get('url')          as string)?.trim();
  const description = (formData.get('description')  as string)?.trim() || null;

  if (!categoryId || !title || !url) {
    return { success: false, error: 'Category, title and URL are required.' };
  }

  const db = await getDB();
  const id = `kbitem_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, categoryId, title, url, description, session.userId)
      .run();
    revalidatePath('/dashboard/kb');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create item.' };
  }
}

export async function deleteKBItem(id: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'CREATE_KB');

  const db = await getDB();
  await db.prepare('DELETE FROM knowledge_items WHERE id = ?').bind(id).run();
  revalidatePath('/dashboard/kb');
  return { success: true };
}
