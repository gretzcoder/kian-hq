'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

export async function submitExecutiveFeedback(category: string, message: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  const cleanMessage = message.trim();
  if (!cleanMessage || cleanMessage.length < 5) {
    return { success: false, error: 'Pesan kritik/saran minimal 5 karakter.' };
  }

  const id = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const db = await getDB();

  await db
    .prepare(`
      INSERT INTO executive_feedbacks (id, user_id, category, message, status, created_at)
      VALUES (?, ?, ?, ?, 'PENDING', strftime('%s', 'now'))
    `)
    .bind(id, session.userId, category || 'KRITIK_SARAN', cleanMessage)
    .run();

  revalidatePath('/dashboard');
  return { success: true };
}

export async function getExecutiveFeedbacks() {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  const { results } = await db
    .prepare(`
      SELECT f.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
      FROM executive_feedbacks f
      JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
      LIMIT 50
    `)
    .all();

  return results as unknown as {
    id: string;
    user_id: string;
    category: string;
    message: string;
    status: string;
    created_at: number;
    user_name: string;
    user_email: string;
    user_avatar?: string | null;
  }[];
}
