'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

export interface DMReaction {
  emoji: string;
  userIds: string[];
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  attachmentUrl?: string | null;
  replyToId?: string | null;
  replyMessage?: {
    id: string;
    senderName: string;
    message: string;
  } | null;
  reactions: DMReaction[];
  status: 'SENT' | 'DELIVERED' | 'READ';
  isRequest: boolean;
  createdAt: number;
}

export interface ConversationItem {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerAvatar?: string | null;
  partnerUserType?: string | null;
  lastMessage: string;
  lastMessageTime: number;
  lastMessageSenderId: string;
  unreadCount: number;
  isRequest: boolean;
  isFriend: boolean;
}

/**
 * Send a direct message to a user. If users are not friends yet, sets is_request = 1.
 */
export async function sendDirectMessageAction(input: {
  receiverId: string;
  message: string;
  attachmentUrl?: string;
  replyToId?: string;
}): Promise<{ success: boolean; message?: DirectMessage; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const { receiverId, message, attachmentUrl, replyToId } = input;
  if (!receiverId || !message.trim()) {
    return { success: false, error: 'Pesan tidak boleh kosong.' };
  }

  const db = await getDB();
  const now = Date.now();

  // Check if sender and receiver are accepted friends
  const friendshipRow = await db
    .prepare(
      `SELECT status FROM friendships
       WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
         AND status = 'ACCEPTED'`
    )
    .bind(session.userId, receiverId, receiverId, session.userId)
    .first();

  const isFriend = !!friendshipRow;
  const isRequest = isFriend ? 0 : 1;

  const messageId = `dm_${crypto.randomUUID().replace(/-/g, '')}`;
  await db
    .prepare(
      `INSERT INTO direct_messages
       (id, sender_id, receiver_id, message, attachment_url, reply_to_id, reactions, status, is_request, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', 'SENT', ?, ?)`
    )
    .bind(
      messageId,
      session.userId,
      receiverId,
      message.trim(),
      attachmentUrl || null,
      replyToId || null,
      isRequest,
      now
    )
    .run();

  revalidatePath('/dashboard');

  return {
    success: true,
    message: {
      id: messageId,
      senderId: session.userId,
      receiverId,
      message: message.trim(),
      attachmentUrl: attachmentUrl || null,
      replyToId: replyToId || null,
      reactions: [],
      status: 'SENT',
      isRequest: !isFriend,
      createdAt: now,
    },
  };
}

/**
 * Fetch all direct messages between current user and partnerUserId
 */
export async function getDirectMessagesAction(partnerUserId: string): Promise<{
  success: boolean;
  messages?: DirectMessage[];
  partnerInfo?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    userType: string | null;
    isFriend: boolean;
    isRequest: boolean;
  };
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();

  // 1. Fetch partner info
  const partner = (await db
    .prepare('SELECT id, name, email, avatar_url, user_type FROM users WHERE id = ?')
    .bind(partnerUserId)
    .first()) as { id: string; name: string; email: string; avatar_url: string | null; user_type: string | null } | null;

  if (!partner) return { success: false, error: 'User tidak ditemukan.' };

  // Check friendship status
  const friendshipRow = await db
    .prepare(
      `SELECT status FROM friendships
       WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
         AND status = 'ACCEPTED'`
    )
    .bind(session.userId, partnerUserId, partnerUserId, session.userId)
    .first();

  const isFriend = !!friendshipRow;

  // 2. Mark incoming messages from partner as READ
  await db
    .prepare(
      `UPDATE direct_messages SET status = 'READ'
       WHERE sender_id = ? AND receiver_id = ? AND status != 'READ'`
    )
    .bind(partnerUserId, session.userId)
    .run();

  // 3. Fetch messages between session.userId and partnerUserId
  const { results: rawMessages } = await db
    .prepare(
      `SELECT dm.*, u.name AS sender_name
       FROM direct_messages dm
       JOIN users u ON dm.sender_id = u.id
       WHERE (dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?)
       ORDER BY dm.created_at ASC`
    )
    .bind(session.userId, partnerUserId, partnerUserId, session.userId)
    .all();

  const messageMap = new Map<string, { senderName: string; message: string }>();
  (rawMessages as any[]).forEach((row) => {
    messageMap.set(row.id, { senderName: row.sender_name || 'User', message: row.message });
  });

  const messages: DirectMessage[] = (rawMessages as any[]).map((row) => {
    let reactions: DMReaction[] = [];
    if (row.reactions) {
      try { reactions = JSON.parse(row.reactions); } catch {}
    }

    let replyMessage = null;
    if (row.reply_to_id && messageMap.has(row.reply_to_id)) {
      const parent = messageMap.get(row.reply_to_id)!;
      replyMessage = {
        id: row.reply_to_id,
        senderName: parent.senderName,
        message: parent.message,
      };
    }

    return {
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      message: row.message,
      attachmentUrl: row.attachment_url,
      replyToId: row.reply_to_id,
      replyMessage,
      reactions,
      status: row.status as 'SENT' | 'DELIVERED' | 'READ',
      isRequest: Boolean(row.is_request),
      createdAt: row.created_at,
    };
  });

  const hasPendingRequest = messages.some((m) => m.receiverId === session.userId && m.isRequest);

  return {
    success: true,
    messages,
    partnerInfo: {
      id: partner.id,
      name: partner.name || partner.email,
      email: partner.email,
      avatarUrl: partner.avatar_url,
      userType: partner.user_type,
      isFriend,
      isRequest: hasPendingRequest,
    },
  };
}

/**
 * Fetch all recent DM conversations for top navbar dropdown & messenger widget
 */
export async function getRecentConversationsAction(filter: 'ALL' | 'UNREAD' | 'REQUESTS' | 'FRIENDS' = 'ALL'): Promise<{
  success: boolean;
  conversations?: ConversationItem[];
  totalUnread?: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();

  // Fetch all DM rows where user is sender or receiver
  const { results: rawRows } = await db
    .prepare(
      `SELECT dm.*,
              u.id AS partner_id, u.name AS partner_name, u.email AS partner_email,
              u.avatar_url AS partner_avatar, u.user_type AS partner_user_type
       FROM direct_messages dm
       JOIN users u ON (CASE WHEN dm.sender_id = ? THEN dm.receiver_id ELSE dm.sender_id END) = u.id
       WHERE dm.sender_id = ? OR dm.receiver_id = ?
       ORDER BY dm.created_at DESC`
    )
    .bind(session.userId, session.userId, session.userId)
    .all();

  // Fetch all accepted friend IDs
  const { results: friendshipRows } = await db
    .prepare(
      `SELECT user_id, friend_id FROM friendships
       WHERE (user_id = ? OR friend_id = ?) AND status = 'ACCEPTED'`
    )
    .bind(session.userId, session.userId)
    .all();

  const friendIdSet = new Set<string>();
  (friendshipRows as any[]).forEach((f) => {
    friendIdSet.add(f.user_id === session.userId ? f.friend_id : f.user_id);
  });

  const map = new Map<string, ConversationItem>();
  let totalUnread = 0;

  (rawRows as any[]).forEach((row) => {
    const partnerId = row.partner_id;
    const isIncomingUnread = row.receiver_id === session.userId && row.status !== 'READ';
    if (isIncomingUnread) totalUnread++;

    if (!map.has(partnerId)) {
      const isFriend = friendIdSet.has(partnerId);
      const isRequest = Boolean(row.is_request) && row.receiver_id === session.userId && !isFriend;

      map.set(partnerId, {
        partnerId,
        partnerName: row.partner_name || row.partner_email,
        partnerEmail: row.partner_email,
        partnerAvatar: row.partner_avatar,
        partnerUserType: row.partner_user_type,
        lastMessage: row.message,
        lastMessageTime: row.created_at,
        lastMessageSenderId: row.sender_id,
        unreadCount: isIncomingUnread ? 1 : 0,
        isRequest,
        isFriend,
      });
    } else {
      const existing = map.get(partnerId)!;
      if (isIncomingUnread) {
        existing.unreadCount++;
      }
    }
  });

  let conversations = Array.from(map.values());

  if (filter === 'UNREAD') {
    conversations = conversations.filter((c) => c.unreadCount > 0);
  } else if (filter === 'REQUESTS') {
    conversations = conversations.filter((c) => c.isRequest);
  } else if (filter === 'FRIENDS') {
    conversations = conversations.filter((c) => c.isFriend);
  }

  return {
    success: true,
    conversations,
    totalUnread,
  };
}

/**
 * Toggle emoji reaction on a direct message
 */
export async function toggleDMReactionAction(messageId: string, emoji: string): Promise<{
  success: boolean;
  reactions?: DMReaction[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const row = (await db
    .prepare('SELECT reactions FROM direct_messages WHERE id = ?')
    .bind(messageId)
    .first()) as { reactions: string } | null;

  if (!row) return { success: false, error: 'Pesan tidak ditemukan.' };

  let reactions: DMReaction[] = [];
  try { reactions = JSON.parse(row.reactions || '[]'); } catch {}

  let targetEmoji = reactions.find((r) => r.emoji === emoji);
  if (!targetEmoji) {
    targetEmoji = { emoji, userIds: [session.userId] };
    reactions.push(targetEmoji);
  } else {
    if (targetEmoji.userIds.includes(session.userId)) {
      targetEmoji.userIds = targetEmoji.userIds.filter((id) => id !== session.userId);
    } else {
      targetEmoji.userIds.push(session.userId);
    }
  }

  reactions = reactions.filter((r) => r.userIds.length > 0);

  await db
    .prepare('UPDATE direct_messages SET reactions = ? WHERE id = ?')
    .bind(JSON.stringify(reactions), messageId)
    .run();

  return { success: true, reactions };
}

/**
 * Accept message request from partnerUserId (converts all pending requests to regular DMs)
 */
export async function acceptMessageRequestAction(partnerUserId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();

  await db
    .prepare(
      `UPDATE direct_messages SET is_request = 0
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`
    )
    .bind(session.userId, partnerUserId, partnerUserId, session.userId)
    .run();

  return { success: true };
}
