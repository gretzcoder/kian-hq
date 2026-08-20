'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { sendPushNotificationToUser } from '@/modules/notifications/pushActions';

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
  id: string;
  category: 'PERSONAL' | 'WORKSPACE' | 'COMMUNITY' | 'REQUESTS';
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerAvatar?: string | null;
  partnerUserType?: string | null;
  lastMessage: string;
  lastMessageTime: number;
  lastMessageSenderId: string;
  unreadCount: number;
  isRequest?: boolean;
  isFriend?: boolean;
  targetUrl?: string;
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

  // Trigger Web Push Notification to receiver
  sendPushNotificationToUser(receiverId, 'DM', {
    title: `💬 Pesan Personal dari ${session.name}`,
    body: message.trim(),
    url: `/dashboard/friends?chatUserId=${session.userId}`,
  }).catch((err) => console.error('DM Push notification error:', err));

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
  await ensureDMDeletedForColumn(db);

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
 * Fetch all recent chat conversations & notifications for top navbar messenger (Personal, Workspace, Community, Requests)
 */
export async function getRecentConversationsAction(
  filter: 'ALL' | 'PERSONAL' | 'WORKSPACE' | 'COMMUNITY' | 'REQUESTS' | 'UNREAD' = 'ALL'
): Promise<{
  success: boolean;
  conversations?: ConversationItem[];
  totalUnread?: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  await ensureDMDeletedForColumn(db);
  const list: ConversationItem[] = [];
  let totalUnread = 0;

  // 1. Fetch Personal DMs & Requests (Excluding messages deleted by session.userId)
  try {
    const { results: rawRows } = await db
      .prepare(
        `SELECT dm.*,
                u.id AS partner_id, u.name AS partner_name, u.email AS partner_email,
                u.avatar_url AS partner_avatar, u.user_type AS partner_user_type
         FROM direct_messages dm
         JOIN users u ON (CASE WHEN dm.sender_id = ? THEN dm.receiver_id ELSE dm.sender_id END) = u.id
         WHERE (dm.sender_id = ? OR dm.receiver_id = ?)
           AND (dm.deleted_for IS NULL OR dm.deleted_for NOT LIKE ?)
         ORDER BY dm.created_at DESC`
      )
      .bind(session.userId, session.userId, session.userId, `%"${session.userId}"%`)
      .all();

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

    const dmMap = new Map<string, ConversationItem>();

    (rawRows as any[]).forEach((row) => {
      const partnerId = row.partner_id;
      const isIncomingUnread = row.receiver_id === session.userId && row.status !== 'READ';
      if (isIncomingUnread) totalUnread++;

      if (!dmMap.has(partnerId)) {
        const isFriend = friendIdSet.has(partnerId);
        const isRequest = Boolean(row.is_request) && row.receiver_id === session.userId && !isFriend;

        dmMap.set(partnerId, {
          id: `dm_conv_${partnerId}`,
          category: isRequest ? 'REQUESTS' : 'PERSONAL',
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
        const existing = dmMap.get(partnerId)!;
        if (isIncomingUnread) {
          existing.unreadCount++;
        }
      }
    });

    list.push(...Array.from(dmMap.values()));
  } catch (err) {
    console.error('Error fetching DM conversations:', err);
  }

  // 2. Fetch Workspace Chats (Shows all accessible workspace chats for current user)
  try {
    const { results: wsChats } = await db
      .prepare(
        `SELECT ws.id AS workspace_id,
                ws.name AS ws_name,
                wc.id AS last_msg_id,
                wc.user_id AS last_sender_id,
                wc.message AS last_message,
                wc.created_at AS last_created_at,
                u.name AS last_sender_name,
                (
                  SELECT COUNT(*)
                  FROM workspace_chats wc_unread
                  WHERE wc_unread.workspace_id = ws.id
                    AND wc_unread.user_id != ?
                    AND NOT EXISTS (
                      SELECT 1 FROM workspace_chat_reads wcr
                      WHERE wcr.chat_id = wc_unread.id AND wcr.user_id = ?
                    )
                ) AS unread_count
         FROM workspaces ws
         LEFT JOIN workspace_chats wc ON wc.id = (
           SELECT id FROM workspace_chats WHERE workspace_id = ws.id ORDER BY created_at DESC LIMIT 1
         )
         LEFT JOIN users u ON wc.user_id = u.id
         WHERE ws.deleted_at IS NULL
           AND (
             ws.ojt_coordinator_id = ?
             OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ws.id AND user_id = ?)
             OR EXISTS (SELECT 1 FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE t.workspace_id = ws.id AND ta.user_id = ?)
             OR EXISTS (SELECT 1 FROM project_coordinators WHERE project_id = ws.project_id AND user_id = ?)
             OR EXISTS (
               SELECT 1 FROM user_roles ur
               JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = ? AND r.name IN ('ADMIN', 'EXECUTIVE', 'MANAGER', 'STAFF')
             )
           )
         ORDER BY COALESCE(wc.created_at, ws.created_at) DESC
         LIMIT 30`
      )
      .bind(
        session.userId,
        session.userId,
        session.userId,
        session.userId,
        session.userId,
        session.userId,
        session.userId
      )
      .all();

    (wsChats as any[]).forEach((r) => {
      const wsId = r.workspace_id;
      const unread = Number(r.unread_count) || 0;
      totalUnread += unread;

      const rawTs = Number(r.last_created_at) || 0;
      const timeMs = rawTs > 0 ? (rawTs > 1e11 ? rawTs : rawTs * 1000) : Date.now();

      let lastMsgText = 'Belum ada pesan di room chat';
      if (r.last_message) {
        const sender = r.last_sender_name ? `${r.last_sender_name}: ` : '';
        lastMsgText = `${sender}"${r.last_message}"`;
      }

      list.push({
        id: `ws_conv_${wsId}`,
        category: 'WORKSPACE',
        partnerId: wsId,
        partnerName: `⚡ Workspace: ${r.ws_name || 'Team'}`,
        partnerEmail: 'Workspace Team Chat',
        partnerAvatar: null,
        partnerUserType: 'WORKSPACE',
        lastMessage: lastMsgText,
        lastMessageTime: timeMs,
        lastMessageSenderId: r.last_sender_id || '',
        unreadCount: unread,
        targetUrl: `/dashboard/workspace/${wsId}?tab=chat`,
      });
    });
  } catch (err) {
    console.error('Error fetching Workspace Chats for Messenger:', err);
  }

  // 3. Fetch Community Chats
  try {
    const { results: commChats } = await db
      .prepare(
        `SELECT cc.id AS channel_id,
                cc.name AS channel_name,
                cm.id AS last_msg_id,
                cm.user_id AS last_sender_id,
                cm.message AS last_message,
                cm.created_at AS last_created_at,
                u.name AS last_sender_name,
                (
                  SELECT COUNT(*)
                  FROM community_messages cm_unread
                  LEFT JOIN community_channel_reads ccr ON ccr.channel_id = cc.id AND ccr.user_id = ?
                  WHERE cm_unread.channel_id = cc.id
                    AND cm_unread.user_id != ?
                    AND (ccr.last_read_at IS NULL OR ccr.last_read_at < cm_unread.created_at)
                ) AS unread_count
         FROM community_channels cc
         LEFT JOIN community_messages cm ON cm.id = (
           SELECT id FROM community_messages WHERE channel_id = cc.id ORDER BY created_at DESC LIMIT 1
         )
         LEFT JOIN users u ON cm.user_id = u.id
         ORDER BY COALESCE(cm.created_at, cc.created_at) DESC
         LIMIT 20`
      )
      .bind(session.userId, session.userId)
      .all();

    (commChats as any[]).forEach((r) => {
      const chId = r.channel_id;
      const unread = Number(r.unread_count) || 0;
      totalUnread += unread;

      let rawTs = Number(r.last_created_at);
      if (isNaN(rawTs) || rawTs <= 0) {
        rawTs = Math.floor(new Date(r.last_created_at).getTime() / 1000) || 0;
      }
      const timeMs = rawTs > 0 ? (rawTs > 1e11 ? rawTs : rawTs * 1000) : Date.now();

      let lastMsgText = 'Belum ada pesan di channel';
      if (r.last_message) {
        const sender = r.last_sender_name ? `${r.last_sender_name}: ` : '';
        lastMsgText = `${sender}"${r.last_message}"`;
      }

      list.push({
        id: `comm_conv_${chId}`,
        category: 'COMMUNITY',
        partnerId: chId,
        partnerName: `🌐 #${r.channel_name}`,
        partnerEmail: 'Community Channel Chat',
        partnerAvatar: null,
        partnerUserType: 'COMMUNITY',
        lastMessage: lastMsgText,
        lastMessageTime: timeMs,
        lastMessageSenderId: r.last_sender_id || '',
        unreadCount: unread,
        targetUrl: `/dashboard/community?channelId=${chId}`,
      });
    });
  } catch (err) {
    console.error('Error fetching Community Chats for Messenger:', err);
  }

  // Sort overall list by lastMessageTime DESC
  list.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

  let filtered = list;
  if (filter === 'PERSONAL') {
    filtered = list.filter((c) => c.category === 'PERSONAL');
  } else if (filter === 'WORKSPACE') {
    filtered = list.filter((c) => c.category === 'WORKSPACE');
  } else if (filter === 'COMMUNITY') {
    filtered = list.filter((c) => c.category === 'COMMUNITY');
  } else if (filter === 'REQUESTS') {
    filtered = list.filter((c) => c.category === 'REQUESTS' || c.isRequest);
  } else if (filter === 'UNREAD') {
    filtered = list.filter((c) => c.unreadCount > 0);
  }

  return {
    success: true,
    conversations: filtered,
    totalUnread,
  };
};

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

/**
 * Helper to ensure deleted_for column exists in direct_messages
 */
async function ensureDMDeletedForColumn(db: any) {
  try {
    await db.prepare("ALTER TABLE direct_messages ADD COLUMN deleted_for TEXT DEFAULT '[]'").run();
  } catch {}
}

/**
 * Delete a single direct message ONLY for the current user (POV deletion).
 * The recipient/partner will still retain the message intact.
 */
export async function deleteDirectMessagePOVAction(messageId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  await ensureDMDeletedForColumn(db);

  const row = (await db
    .prepare('SELECT id, deleted_for FROM direct_messages WHERE id = ? AND (sender_id = ? OR receiver_id = ?)')
    .bind(messageId, session.userId, session.userId)
    .first()) as { id: string; deleted_for?: string } | null;

  if (!row) return { success: false, error: 'Pesan tidak ditemukan.' };

  let deletedList: string[] = [];
  try {
    deletedList = JSON.parse(row.deleted_for || '[]');
  } catch {}

  if (!deletedList.includes(session.userId)) {
    deletedList.push(session.userId);
  }

  await db
    .prepare('UPDATE direct_messages SET deleted_for = ? WHERE id = ?')
    .bind(JSON.stringify(deletedList), messageId)
    .run();

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Delete an entire direct message conversation with partnerUserId ONLY for current user (POV deletion).
 */
export async function deleteConversationPOVAction(partnerId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  await ensureDMDeletedForColumn(db);

  const messages = (await db
    .prepare(
      `SELECT id, deleted_for FROM direct_messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`
    )
    .bind(session.userId, partnerId, partnerId, session.userId)
    .all()) as any;

  const rows = messages.results || [];
  for (const r of rows) {
    let deletedList: string[] = [];
    try {
      deletedList = JSON.parse(r.deleted_for || '[]');
    } catch {}

    if (!deletedList.includes(session.userId)) {
      deletedList.push(session.userId);
      await db
        .prepare('UPDATE direct_messages SET deleted_for = ? WHERE id = ?')
        .bind(JSON.stringify(deletedList), r.id)
        .run();
    }
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Mark a community channel as read for the current user so notifications disappear from Messenger Hub
 */
export async function markCommunityChannelReadAction(channelId: string): Promise<{ success: boolean }> {
  const session = await getSession();
  if (!session) return { success: false };

  const db = await getDB();
  try {
    await db
      .prepare(
        `INSERT INTO community_channel_reads (channel_id, user_id, last_read_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`
      )
      .bind(channelId, session.userId)
      .run();
  } catch {}

  return { success: true };
}

/**
 * Mark a workspace chat as read for the current user so notifications disappear from Messenger Hub
 */
export async function markWorkspaceChatReadAction(workspaceId: string): Promise<{ success: boolean }> {
  const session = await getSession();
  if (!session) return { success: false };

  const db = await getDB();
  try {
    const chats = (await db
      .prepare('SELECT id FROM workspace_chats WHERE workspace_id = ?')
      .bind(workspaceId)
      .all()) as any;

    const rows = chats.results || [];
    const now = Math.floor(Date.now() / 1000);
    for (const r of rows) {
      await db
        .prepare('INSERT OR REPLACE INTO workspace_chat_reads (chat_id, user_id, read_at) VALUES (?, ?, ?)')
        .bind(r.id, session.userId, now)
        .run();
    }
  } catch (err) {
    console.error('Error marking workspace chat as read:', err);
  }

  return { success: true };
}
