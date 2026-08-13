'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';

export interface ExecutiveFeedbackReply {
  id: string;
  feedback_id: string;
  user_id: string;
  message: string;
  created_at: number;
  user_name: string;
  user_email: string;
  user_avatar?: string | null;
}

export interface ExecutiveFeedbackItem {
  id: string;
  user_id: string;
  category: string;
  message: string;
  status: string;
  created_at: number;
  user_name: string;
  user_email: string;
  user_avatar?: string | null;
  sparks_given: number;
  sparks_given_by?: string | null;
  sparks_given_by_name?: string | null;
  sparks_adjustment_id?: string | null;
  replies: ExecutiveFeedbackReply[];
}

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
  revalidatePath('/dashboard/feedbacks');
  return { success: true };
}

export async function getExecutiveFeedbacks(): Promise<ExecutiveFeedbackItem[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();

  // Fetch feedbacks with author & sparks giver info
  const { results: feedbackRows } = await db
    .prepare(`
      SELECT 
        f.*, 
        u.name as user_name, 
        u.email as user_email, 
        u.avatar_url as user_avatar,
        u2.name as sparks_given_by_name
      FROM executive_feedbacks f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN users u2 ON f.sparks_given_by = u2.id
      ORDER BY f.created_at DESC
      LIMIT 100
    `)
    .all();

  if (!feedbackRows || feedbackRows.length === 0) return [];

  const feedbackIds = feedbackRows.map((f: any) => f.id);
  const placeholders = feedbackIds.map(() => '?').join(',');

  // Fetch replies for these feedbacks
  let replyRows: any[] = [];
  try {
    const { results } = await db
      .prepare(`
        SELECT 
          r.*, 
          u.name as user_name, 
          u.email as user_email, 
          u.avatar_url as user_avatar
        FROM executive_feedback_replies r
        JOIN users u ON r.user_id = u.id
        WHERE r.feedback_id IN (${placeholders})
        ORDER BY r.created_at ASC
      `)
      .bind(...feedbackIds)
      .all();
    replyRows = results || [];
  } catch (err) {
    // If replies table doesn't exist yet or query fails, fall back to empty
    replyRows = [];
  }

  // Group replies by feedback_id
  const repliesByFeedbackId = new Map<string, ExecutiveFeedbackReply[]>();
  for (const r of replyRows) {
    const list = repliesByFeedbackId.get(r.feedback_id) || [];
    list.push({
      id: r.id,
      feedback_id: r.feedback_id,
      user_id: r.user_id,
      message: r.message,
      created_at: Number(r.created_at),
      user_name: r.user_name,
      user_email: r.user_email,
      user_avatar: r.user_avatar,
    });
    repliesByFeedbackId.set(r.feedback_id, list);
  }

  return feedbackRows.map((f: any) => ({
    id: f.id,
    user_id: f.user_id,
    category: f.category,
    message: f.message,
    status: f.status,
    created_at: Number(f.created_at),
    user_name: f.user_name,
    user_email: f.user_email,
    user_avatar: f.user_avatar,
    sparks_given: Number(f.sparks_given || 0),
    sparks_given_by: f.sparks_given_by || null,
    sparks_given_by_name: f.sparks_given_by_name || null,
    sparks_adjustment_id: f.sparks_adjustment_id || null,
    replies: repliesByFeedbackId.get(f.id) || [],
  }));
}

export async function replyToExecutiveFeedback(feedbackId: string, message: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  const cleanMessage = message.trim();
  if (!cleanMessage) {
    return { success: false, error: 'Pesan balasan tidak boleh kosong.' };
  }

  const id = `fbr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const db = await getDB();

  await db
    .prepare(`
      INSERT INTO executive_feedback_replies (id, feedback_id, user_id, message, created_at)
      VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    `)
    .bind(id, feedbackId, session.userId, cleanMessage)
    .run();

  revalidatePath('/dashboard/feedbacks');
  return { success: true };
}

export async function giveFeedbackSparks(feedbackId: string, sparksAmount: number) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  const ctx = await getSessionContext(session.userId);
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));
  const canManageSparks =
    ctx.can('SPARKS_MANAGE') || isCoordinator || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM') || ctx.can('ADMIN_USERS');

  if (!canManageSparks) {
    return { success: false, error: 'Forbidden: Hanya Coordinator/Admin yang dapat memberikan Sparks.' };
  }

  if (!sparksAmount || sparksAmount < 1) {
    return { success: false, error: 'Jumlah Sparks minimal 1.' };
  }

  const db = await getDB();

  const feedback = await db
    .prepare('SELECT id, user_id, category, sparks_given FROM executive_feedbacks WHERE id = ?')
    .bind(feedbackId)
    .first() as { id: string; user_id: string; category: string; sparks_given: number } | null;

  if (!feedback) {
    return { success: false, error: 'Pesan kritik/saran tidak ditemukan.' };
  }

  if (feedback.sparks_given && feedback.sparks_given > 0) {
    return { success: false, error: 'Sparks sudah pernah diberikan untuk kritik & saran ini (tidak bisa double).' };
  }

  const adjustmentId = `sa_fb_${feedbackId}_${Math.random().toString(36).substring(2, 7)}`;
  const note = `Apresiasi Feedback: ${feedback.category || 'Kritik & Saran'}`;

  // 1. Record in sparks_adjustments
  await db
    .prepare(`
      INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at)
      VALUES (?, ?, 'APPRECIATION', ?, 'APPRECIATION', ?, ?, strftime('%s', 'now'))
    `)
    .bind(adjustmentId, feedback.user_id, sparksAmount, note, session.userId)
    .run();

  // 2. Update executive_feedbacks record
  await db
    .prepare(`
      UPDATE executive_feedbacks
      SET sparks_given = ?, sparks_given_by = ?, sparks_adjustment_id = ?
      WHERE id = ?
    `)
    .bind(sparksAmount, session.userId, adjustmentId, feedbackId)
    .run();

  revalidatePath('/dashboard/feedbacks');
  revalidatePath('/dashboard/sparks');
  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard/leaderboard');

  return { success: true, message: `✓ ${sparksAmount} ✨ Sparks berhasil diberikan!` };
}

export async function editFeedbackSparks(feedbackId: string, newSparksAmount: number) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  if (!newSparksAmount || newSparksAmount < 1) {
    return { success: false, error: 'Jumlah Sparks minimal 1.' };
  }

  const db = await getDB();

  const feedback = await db
    .prepare('SELECT id, sparks_given_by, sparks_adjustment_id FROM executive_feedbacks WHERE id = ?')
    .bind(feedbackId)
    .first() as { id: string; sparks_given_by: string; sparks_adjustment_id: string } | null;

  if (!feedback) {
    return { success: false, error: 'Pesan kritik/saran tidak ditemukan.' };
  }

  if (feedback.sparks_given_by !== session.userId) {
    return { success: false, error: 'Hanya user pemberi Sparks yang berhak mengubah jumlah Sparks ini.' };
  }

  // 1. Update executive_feedbacks
  await db
    .prepare('UPDATE executive_feedbacks SET sparks_given = ? WHERE id = ?')
    .bind(newSparksAmount, feedbackId)
    .run();

  // 2. Update sparks_adjustments
  if (feedback.sparks_adjustment_id) {
    await db
      .prepare('UPDATE sparks_adjustments SET sparks = ? WHERE id = ?')
      .bind(newSparksAmount, feedback.sparks_adjustment_id)
      .run();
  }

  revalidatePath('/dashboard/feedbacks');
  revalidatePath('/dashboard/sparks');
  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard/leaderboard');

  return { success: true, message: `✓ Jumlah Sparks berhasil diperbarui menjadi ${newSparksAmount} ✨!` };
}
