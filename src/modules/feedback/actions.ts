'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { sendPushNotificationToUser } from '@/modules/notifications/pushActions';

export interface FeedbackReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
  userNames: string[];
}

export interface ExecutiveFeedbackReply {
  id: string;
  feedback_id: string;
  parent_id?: string | null;
  parent_user_name?: string | null;
  user_id: string;
  message: string;
  created_at: number;
  user_name: string;
  user_email: string;
  user_avatar?: string | null;
  reactions: FeedbackReaction[];
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
  reactions: FeedbackReaction[];
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
  const fbPlaceholders = feedbackIds.map(() => '?').join(',');

  // Fetch replies for these feedbacks (with parent author name if nested)
  let replyRows: any[] = [];
  try {
    const { results } = await db
      .prepare(`
        SELECT 
          r.*, 
          u.name as user_name, 
          u.email as user_email, 
          u.avatar_url as user_avatar,
          pu.name as parent_user_name
        FROM executive_feedback_replies r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN executive_feedback_replies pr ON r.parent_id = pr.id
        LEFT JOIN users pu ON pr.user_id = pu.id
        WHERE r.feedback_id IN (${fbPlaceholders})
        ORDER BY r.created_at ASC
      `)
      .bind(...feedbackIds)
      .all();
    replyRows = results || [];
  } catch (err) {
    replyRows = [];
  }

  // Fetch reactions for feedbacks & replies
  let feedbackReactionsRaw: any[] = [];
  let replyReactionsRaw: any[] = [];

  try {
    const { results: fbRx } = await db
      .prepare(`
        SELECT r.target_id, r.emoji, r.user_id, u.name as user_name
        FROM executive_feedback_reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.target_type = 'FEEDBACK' AND r.target_id IN (${fbPlaceholders})
      `)
      .bind(...feedbackIds)
      .all();
    feedbackReactionsRaw = fbRx || [];
  } catch {}

  const replyIds = replyRows.map((r: any) => r.id);
  if (replyIds.length > 0) {
    const replyPlaceholders = replyIds.map(() => '?').join(',');
    try {
      const { results: repRx } = await db
        .prepare(`
          SELECT r.target_id, r.emoji, r.user_id, u.name as user_name
          FROM executive_feedback_reactions r
          JOIN users u ON r.user_id = u.id
          WHERE r.target_type = 'REPLY' AND r.target_id IN (${replyPlaceholders})
        `)
        .bind(...replyIds)
        .all();
      replyReactionsRaw = repRx || [];
    } catch {}
  }

  // Helper to build reaction objects
  const formatReactions = (rawRows: any[], targetId: string): FeedbackReaction[] => {
    const map = new Map<string, { count: number; hasReacted: boolean; userNames: string[] }>();
    for (const r of rawRows) {
      if (r.target_id !== targetId) continue;
      const entry = map.get(r.emoji) || { count: 0, hasReacted: false, userNames: [] };
      entry.count++;
      if (r.user_id === session.userId) entry.hasReacted = true;
      if (r.user_name && !entry.userNames.includes(r.user_name)) entry.userNames.push(r.user_name);
      map.set(r.emoji, entry);
    }
    return Array.from(map.entries()).map(([emoji, item]) => ({
      emoji,
      count: item.count,
      hasReacted: item.hasReacted,
      userNames: item.userNames,
    }));
  };

  // Group replies by feedback_id
  const repliesByFeedbackId = new Map<string, ExecutiveFeedbackReply[]>();
  for (const r of replyRows) {
    const list = repliesByFeedbackId.get(r.feedback_id) || [];
    list.push({
      id: r.id,
      feedback_id: r.feedback_id,
      parent_id: r.parent_id || null,
      parent_user_name: r.parent_user_name || null,
      user_id: r.user_id,
      message: r.message,
      created_at: Number(r.created_at),
      user_name: r.user_name,
      user_email: r.user_email,
      user_avatar: r.user_avatar,
      reactions: formatReactions(replyReactionsRaw, r.id),
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
    reactions: formatReactions(feedbackReactionsRaw, f.id),
    replies: repliesByFeedbackId.get(f.id) || [],
  }));
}

export async function replyToExecutiveFeedback(feedbackId: string, message: string, parentId?: string) {
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
      INSERT INTO executive_feedback_replies (id, feedback_id, parent_id, user_id, message, created_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `)
    .bind(id, feedbackId, parentId || null, session.userId, cleanMessage)
    .run();

  revalidatePath('/dashboard/feedbacks');
  return { success: true };
}

export async function toggleFeedbackReaction(
  targetType: 'FEEDBACK' | 'REPLY',
  targetId: string,
  emoji: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  const db = await getDB();

  const existing = await db
    .prepare(`
      SELECT id FROM executive_feedback_reactions
      WHERE target_type = ? AND target_id = ? AND user_id = ? AND emoji = ?
    `)
    .bind(targetType, targetId, session.userId, emoji)
    .first() as { id: string } | null;

  if (existing) {
    await db
      .prepare('DELETE FROM executive_feedback_reactions WHERE id = ?')
      .bind(existing.id)
      .run();
  } else {
    const rxId = `fbrx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db
      .prepare(`
        INSERT INTO executive_feedback_reactions (id, target_type, target_id, user_id, emoji, created_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
      `)
      .bind(rxId, targetType, targetId, session.userId, emoji)
      .run();
  }

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

export async function deleteExecutiveFeedbackReply(replyId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  const db = await getDB();

  const reply = await db
    .prepare('SELECT id, feedback_id, user_id, message FROM executive_feedback_replies WHERE id = ?')
    .bind(replyId)
    .first() as { id: string; feedback_id: string; user_id: string; message: string } | null;

  if (!reply) return { success: false, error: 'Komentar tidak ditemukan.' };

  const ctx = await getSessionContext(session.userId);
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') ||
      ctx.roles.includes('EXECUTIVE') ||
      ctx.can('MANAGE') ||
      ctx.permissions.has('ADMIN_SYSTEM'));

  const isOwner = reply.user_id === session.userId;
  const isAuthorized = isOwner || isCoordinator || ctx.userType === 'STAFF';

  if (!isAuthorized) {
    return { success: false, error: 'Anda tidak memiliki izin untuk menghapus komentar ini.' };
  }

  // If deleted by Admin/Coordinator on someone else's comment, send a push notification to comment author
  if (!isOwner && (isCoordinator || ctx.userType === 'STAFF')) {
    try {
      const truncatedMessage = reply.message.length > 40 ? `${reply.message.substring(0, 40)}...` : reply.message;
      await sendPushNotificationToUser(reply.user_id, 'MENTION', {
        title: 'Komentar Dihapus oleh Admin',
        body: `Komentar Anda ("${truncatedMessage}") pada Kritik & Saran telah dihapus oleh Koordinator/Admin.`,
        url: '/dashboard/feedbacks',
      });
    } catch (err) {
      console.error('Failed to send comment deletion notification:', err);
    }
  }

  // Delete reactions for this reply
  await db
    .prepare("DELETE FROM executive_feedback_reactions WHERE target_type = 'REPLY' AND target_id = ?")
    .bind(replyId)
    .run();

  // Delete child sub-replies that reference this reply as parent_id
  await db
    .prepare('DELETE FROM executive_feedback_replies WHERE parent_id = ?')
    .bind(replyId)
    .run();

  // Delete the reply
  await db
    .prepare('DELETE FROM executive_feedback_replies WHERE id = ?')
    .bind(replyId)
    .run();

  revalidatePath('/dashboard/feedbacks');
  return { success: true };
}
