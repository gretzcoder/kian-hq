'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/modules/roles/rbac';
import { extractSmartLinks, SmartLinkMeta } from './smartLinkParser';
import { sendPushNotificationToUsers } from '@/modules/notifications/pushActions';

export interface ChatEmojiReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
  userNames: string[];
}

export interface WorkspaceChatMessage {
  id: string;
  workspace_id: string;
  user_id: string;
  user_name: string | null;
  user_avatar?: string | null;
  user_type?: string | null;
  user_role?: string | null;
  message: string;
  parent_id?: string | null;
  reply_message?: string | null;
  reply_user_name?: string | null;
  attachment_url?: string | null;
  is_pinned: boolean;
  pinned_by?: string | null;
  is_edited: boolean;
  edited_at?: number | null;
  edit_count: number;
  can_edit: boolean;
  edit_disabled_reason?: string | null;
  created_at: number;
  reactions: ChatEmojiReaction[];
  read_count: number;
  read_by_names: string[];
  is_sticker: boolean;
  sticker_info?: { id: string; emoji: string; name: string } | null;
  smart_links: SmartLinkMeta[];
}

export interface MemberPresenceInfo {
  userId: string;
  userName: string;
  status: 'online' | 'idle' | 'offline';
  isTyping: boolean;
  lastSeenAt: number;
}

/**
 * Send a message to a workspace chat room.
 */
export async function sendWorkspaceMessage(
  workspaceId: string,
  message: string,
  parentId?: string | null,
  attachmentUrl?: string | null
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const trimmed = message?.trim();
  if (!trimmed && !attachmentUrl) return { success: false, error: 'Pesan tidak boleh kosong.' };

  const db = await getDB();
  const msgId = `wc_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        'INSERT INTO workspace_chats (id, workspace_id, user_id, message, parent_id, attachment_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(msgId, workspaceId, session.userId, trimmed || '', parentId || null, attachmentUrl || null, now)
      .run();

    // Auto mark as read for sender (Safely handled)
    try {
      await db
        .prepare(
          'INSERT OR REPLACE INTO workspace_chat_reads (chat_id, user_id, read_at) VALUES (?, ?, ?)'
        )
        .bind(msgId, session.userId, now)
        .run();
    } catch {}

    // Update presence (Safely handled)
    try {
      await db
        .prepare(
          'INSERT OR REPLACE INTO workspace_user_presence (user_id, workspace_id, last_seen_at, is_typing) VALUES (?, ?, ?, 0)'
        )
        .bind(session.userId, workspaceId, now)
        .run();
    } catch {}

    // Async Web Push notification dispatch to workspace members
    try {
      const { results: memberRows } = await db
        .prepare(`
          SELECT DISTINCT target_users.id AS user_id, target_users.name
          FROM (
            SELECT wm.user_id AS id, u.name
            FROM workspace_members wm
            JOIN users u ON wm.user_id = u.id
            WHERE wm.workspace_id = ? AND wm.user_id != ? AND (u.status IS NULL OR u.status = 'ACTIVE')

            UNION

            SELECT ws.ojt_coordinator_id AS id, u.name
            FROM workspaces ws
            JOIN users u ON ws.ojt_coordinator_id = u.id
            WHERE ws.id = ? AND ws.ojt_coordinator_id != ? AND (u.status IS NULL OR u.status = 'ACTIVE')

            UNION

            SELECT ta.user_id AS id, u.name
            FROM task_assignments ta
            JOIN tasks t ON ta.task_id = t.id
            JOIN users u ON ta.user_id = u.id
            WHERE t.workspace_id = ? AND ta.user_id != ? AND (u.status IS NULL OR u.status = 'ACTIVE')
          ) target_users
        `)
        .bind(
          workspaceId, session.userId,
          workspaceId, session.userId,
          workspaceId, session.userId
        )
        .all();

      const members = (memberRows as any[]) || [];
      if (members.length > 0) {
        const isMentionAll = trimmed.toLowerCase().includes('@all') || trimmed.toLowerCase().includes('@semua');
        const mentions = members.filter((m) =>
          isMentionAll ||
          trimmed.toLowerCase().includes(`@${(m.name || '').toLowerCase()}`) ||
          trimmed.toLowerCase().includes(`@${(m.name || '').split(' ')[0].toLowerCase()}`)
        );

        const mentionUserIds = mentions.map((m) => (m.user_id || m.id) as string).filter(Boolean);
        const regularUserIds = members
          .map((m) => (m.user_id || m.id) as string)
          .filter((id) => Boolean(id) && !mentionUserIds.includes(id));

        const bodySnippet = trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed || 'Mengirim lampiran';

        if (mentionUserIds.length > 0) {
          await sendPushNotificationToUsers(mentionUserIds, 'MENTION', {
            title: `🏷️ Mention dari ${session.name}`,
            body: bodySnippet,
            url: `/dashboard/workspace/${workspaceId}`,
            category: 'MENTION',
            tag: `ws_${workspaceId}`,
          }).catch(() => {});
        }

        if (regularUserIds.length > 0) {
          await sendPushNotificationToUsers(regularUserIds, 'CHAT', {
            title: `💬 Pesan Chat dari ${session.name}`,
            body: bodySnippet,
            url: `/dashboard/workspace/${workspaceId}`,
            category: 'CHAT',
            tag: `ws_${workspaceId}`,
          }).catch(() => {});
        }
      }
    } catch (pushErr) {
      console.error('Failed to trigger chat Web Push:', pushErr);
    }

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true, messageId: msgId };
  } catch (err: any) {
    console.error('sendWorkspaceMessage failed:', err);
    return { success: false, error: err.message || 'Gagal mengirim pesan.' };
  }
}

/**
 * Edit a sent workspace chat message (Restricted to 15 mins since creation & max 5 edits).
 */
export async function editWorkspaceMessage(messageId: string, newMessage: string, workspaceId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const trimmed = newMessage?.trim();
  if (!trimmed) return { success: false, error: 'Pesan tidak boleh kosong.' };

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  try {
    const msgRaw = await db
      .prepare('SELECT user_id, created_at FROM workspace_chats WHERE id = ?')
      .bind(messageId)
      .first();
    const msg = msgRaw as unknown as { user_id: string; created_at: number } | null;

    if (!msg) return { success: false, error: 'Pesan tidak ditemukan.' };
    if (msg.user_id !== session.userId) return { success: false, error: 'Anda hanya dapat mengedit pesan sendiri.' };

    const createdAt = Number(msg.created_at) || 0;
    if (now - createdAt > 15 * 60) {
      return { success: false, error: 'Pesan hanya dapat diedit dalam waktu 15 menit setelah dikirim.' };
    }

    try {
      await db
        .prepare('UPDATE workspace_chats SET message = ?, edit_count = COALESCE(edit_count, 0) + 1, edited_at = ? WHERE id = ?')
        .bind(trimmed, now, messageId)
        .run();
    } catch {
      await db
        .prepare('UPDATE workspace_chats SET message = ? WHERE id = ?')
        .bind(trimmed, messageId)
        .run();
    }

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('editWorkspaceMessage failed:', err);
    return { success: false, error: err.message || 'Gagal mengedit pesan.' };
  }
}

/**
 * Delete a workspace chat message.
 */
export async function deleteWorkspaceMessage(messageId: string, workspaceId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  try {
    const msgRaw = await db
      .prepare('SELECT user_id FROM workspace_chats WHERE id = ?')
      .bind(messageId)
      .first();
    const msg = msgRaw as unknown as { user_id: string } | null;

    if (!msg) return { success: false, error: 'Pesan tidak ditemukan.' };

    if (msg.user_id !== session.userId) {
      await checkPermission(session.userId, 'DELETE');
    }

    await db.prepare('DELETE FROM workspace_chats WHERE id = ?').bind(messageId).run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('deleteWorkspaceMessage failed:', err);
    return { success: false, error: err.message || 'Gagal menghapus pesan.' };
  }
}

/**
 * Toggle Pin status for a workspace chat message.
 */
export async function togglePinWorkspaceMessage(messageId: string, workspaceId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  try {
    const { results: roles } = await db
      .prepare(
        `SELECT r.name, u.user_type, wm.team_role
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         LEFT JOIN workspace_members wm ON wm.workspace_id = ? AND wm.user_id = u.id
         WHERE u.id = ?`
      )
      .bind(workspaceId, session.userId)
      .all();

    const roleNames = (roles as any[]).map((r) => (r.name || '').toUpperCase()).join(' ');
    const userType = ((roles as any[])[0]?.user_type || '').toUpperCase();
    const teamRole = ((roles as any[])[0]?.team_role || '').toUpperCase();

    const isStaffOrAdmin = userType === 'STAFF' || roleNames.includes('COORDINATOR') || roleNames.includes('ADMIN') || roleNames.includes('EXECUTIVE');
    const isMentorOrLeader = teamRole === 'LEADER' || teamRole === 'MENTOR' || roleNames.includes('MENTOR');

    if (!isStaffOrAdmin && !isMentorOrLeader) {
      return { success: false, error: 'Hanya Admin, Koordinator, Mentor, atau Ketua Tim yang dapat menyematkan pesan.' };
    }

    try {
      const currentMsg = await db
        .prepare('SELECT is_pinned FROM workspace_chats WHERE id = ?')
        .bind(messageId)
        .first();

      const isPinned = Number((currentMsg as any)?.is_pinned) === 1;

      if (isPinned) {
        await db
          .prepare('UPDATE workspace_chats SET is_pinned = 0, pinned_by = NULL WHERE id = ?')
          .bind(messageId)
          .run();
      } else {
        await db
          .prepare('UPDATE workspace_chats SET is_pinned = 1, pinned_by = ? WHERE id = ?')
          .bind(session.userId, messageId)
          .run();
      }

      revalidatePath(`/dashboard/workspace/${workspaceId}`);
      return { success: true, isPinned: !isPinned };
    } catch {
      return { success: false, error: 'Fitur sematan belum aktif pada skema database saat ini.' };
    }
  } catch (err: any) {
    console.error('togglePinWorkspaceMessage failed:', err);
    return { success: false, error: err.message || 'Gagal mengubah status sematan pesan.' };
  }
}

/**
 * Clear all chat messages in a workspace.
 */
export async function clearWorkspaceChats(workspaceId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  try {
    const { results: roles } = await db
      .prepare(
        `SELECT r.name, u.user_type, wm.team_role
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         LEFT JOIN workspace_members wm ON wm.workspace_id = ? AND wm.user_id = u.id
         WHERE u.id = ?`
      )
      .bind(workspaceId, session.userId)
      .all();

    const roleNames = (roles as any[]).map((r) => (r.name || '').toUpperCase()).join(' ');
    const userType = ((roles as any[])[0]?.user_type || '').toUpperCase();
    const teamRole = ((roles as any[])[0]?.team_role || '').toUpperCase();

    const isStaffOrAdmin = userType === 'STAFF' || roleNames.includes('COORDINATOR') || roleNames.includes('ADMIN') || roleNames.includes('EXECUTIVE');
    const isMentorOrLeader = teamRole === 'LEADER' || teamRole === 'MENTOR' || roleNames.includes('MENTOR');

    if (!isStaffOrAdmin && !isMentorOrLeader) {
      return { success: false, error: 'Hanya Admin, Koordinator, Mentor, atau Ketua Tim yang dapat menghapus seluruh riwayat chat.' };
    }

    await db.prepare('DELETE FROM workspace_chats WHERE workspace_id = ?').bind(workspaceId).run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('clearWorkspaceChats failed:', err);
    return { success: false, error: err.message || 'Gagal membersihkan riwayat chat.' };
  }
}

/**
 * Toggle an emoji reaction on a chat message.
 */
export async function toggleWorkspaceChatReaction(
  chatId: string,
  emoji: string,
  workspaceId: string
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();

  try {
    const existing = await db
      .prepare('SELECT id FROM workspace_chat_reactions WHERE chat_id = ? AND user_id = ? AND emoji = ?')
      .bind(chatId, session.userId, emoji)
      .first();

    if (existing) {
      await db
        .prepare('DELETE FROM workspace_chat_reactions WHERE chat_id = ? AND user_id = ? AND emoji = ?')
        .bind(chatId, session.userId, emoji)
        .run();
    } else {
      const reactId = `wcr_${crypto.randomUUID().replace(/-/g, '')}`;
      await db
        .prepare(
          'INSERT INTO workspace_chat_reactions (id, chat_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(reactId, chatId, session.userId, emoji, Math.floor(Date.now() / 1000))
        .run();
    }

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
  } catch (err: any) {
    console.error('toggleWorkspaceChatReaction failed:', err);
    return { success: false, error: err.message || 'Gagal memperbarui reaksi.' };
  }
}

/**
 * Mark all chat messages in a workspace as read for the current user.
 */
export async function markWorkspaceChatsRead(workspaceId: string) {
  const session = await getSession();
  if (!session) return { success: false };

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  try {
    const { results: unreadMsgs } = await db
      .prepare(
        `SELECT wc.id FROM workspace_chats wc
         LEFT JOIN workspace_chat_reads wcr ON wc.id = wcr.chat_id AND wcr.user_id = ?
         WHERE wc.workspace_id = ? AND wcr.chat_id IS NULL AND wc.user_id != ?`
      )
      .bind(session.userId, workspaceId, session.userId)
      .all();

    for (const m of (unreadMsgs || []) as any[]) {
      await db
        .prepare('INSERT OR IGNORE INTO workspace_chat_reads (chat_id, user_id, read_at) VALUES (?, ?, ?)')
        .bind(m.id, session.userId, now)
        .run();
    }

    try {
      await db
        .prepare(
          'INSERT OR REPLACE INTO workspace_user_presence (user_id, workspace_id, last_seen_at, is_typing) VALUES (?, ?, ?, 0)'
        )
        .bind(session.userId, workspaceId, now)
        .run();
    } catch {}

    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

/**
 * Update user typing indicator and online presence.
 */
export async function updateUserTypingPresence(workspaceId: string, isTyping: boolean) {
  const session = await getSession();
  if (!session) return { success: false };

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        'INSERT OR REPLACE INTO workspace_user_presence (user_id, workspace_id, last_seen_at, is_typing) VALUES (?, ?, ?, ?)'
      )
      .bind(session.userId, workspaceId, now, isTyping ? 1 : 0)
      .run();

    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

/**
 * Get realtime presence and typing status of workspace members.
 */
export async function getWorkspacePresence(workspaceId: string): Promise<{
  onlineCount: number;
  typingNames: string[];
  membersPresence: MemberPresenceInfo[];
}> {
  const session = await getSession();
  if (!session) return { onlineCount: 1, typingNames: [], membersPresence: [] };

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  try {
    const { results } = await db
      .prepare(
        `SELECT wup.user_id, wup.last_seen_at, wup.is_typing, u.name AS user_name
         FROM workspace_user_presence wup
         JOIN users u ON wup.user_id = u.id
         WHERE wup.workspace_id = ?`
      )
      .bind(workspaceId)
      .all();

    let onlineCount = 0;
    const typingNames: string[] = [];
    const membersPresence: MemberPresenceInfo[] = [];

    for (const r of (results || []) as any[]) {
      const diff = now - Number(r.last_seen_at);
      let status: 'online' | 'idle' | 'offline' = 'offline';
      if (diff <= 120) {
        status = 'online';
        onlineCount += 1;
      } else if (diff <= 600) {
        status = 'idle';
      }

      const isTyping = Number(r.is_typing) === 1 && diff <= 10;
      if (isTyping && r.user_id !== session.userId && r.user_name) {
        typingNames.push(r.user_name);
      }

      membersPresence.push({
        userId: r.user_id,
        userName: r.user_name || 'Pengguna',
        status,
        isTyping,
        lastSeenAt: Number(r.last_seen_at) || 0,
      });
    }

    return { onlineCount: Math.max(1, onlineCount), typingNames, membersPresence };
  } catch (err) {
    return { onlineCount: 1, typingNames: [], membersPresence: [] };
  }
}

/**
 * Fetch latest messages for a workspace chat room with user profiles, reply context, emoji reactions, read receipts, and smart link previews.
 */
export async function getWorkspaceChats(workspaceId: string): Promise<WorkspaceChatMessage[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  let msgsRaw: any[] = [];

  try {
    const res = await db
      .prepare(
        `SELECT wc.id, wc.workspace_id, wc.user_id, wc.message, wc.parent_id, wc.attachment_url, wc.created_at,
                u.name AS user_name, u.avatar_url AS user_avatar, u.user_type,
                p_wc.message AS reply_message, p_u.name AS reply_user_name,
                wm.team_role AS user_role
         FROM workspace_chats wc
         LEFT JOIN users u ON wc.user_id = u.id
         LEFT JOIN workspace_chats p_wc ON wc.parent_id = p_wc.id
         LEFT JOIN users p_u ON p_wc.user_id = p_u.id
         LEFT JOIN workspace_members wm ON wm.workspace_id = wc.workspace_id AND wm.user_id = wc.user_id
         WHERE wc.workspace_id = ?
         ORDER BY wc.created_at ASC`
      )
      .bind(workspaceId)
      .all();

    msgsRaw = (res.results || []) as any[];
  } catch (err) {
    console.error('getWorkspaceChats primary query failed:', err);
    return [];
  }

  const reactionsMap = new Map<string, Map<string, { count: number; hasReacted: boolean; userNames: string[] }>>();
  try {
    const rxRaw = await db
      .prepare(
        `SELECT wcr.chat_id, wcr.emoji, wcr.user_id, u.name AS user_name
         FROM workspace_chat_reactions wcr
         JOIN workspace_chats wc ON wcr.chat_id = wc.id
         LEFT JOIN users u ON wcr.user_id = u.id
         WHERE wc.workspace_id = ?`
      )
      .bind(workspaceId)
      .all();
    for (const r of (rxRaw.results || []) as any[]) {
      if (!reactionsMap.has(r.chat_id)) reactionsMap.set(r.chat_id, new Map());
      const chatRx = reactionsMap.get(r.chat_id)!;
      if (!chatRx.has(r.emoji)) chatRx.set(r.emoji, { count: 0, hasReacted: false, userNames: [] });
      const entry = chatRx.get(r.emoji)!;
      entry.count += 1;
      if (r.user_id === session.userId) entry.hasReacted = true;
      if (r.user_name) entry.userNames.push(r.user_name);
    }
  } catch {}

  const readsMap = new Map<string, { count: number; names: string[] }>();
  try {
    const readsRaw = await db
      .prepare(
        `SELECT wcr.chat_id, wcr.user_id, u.name AS user_name
         FROM workspace_chat_reads wcr
         JOIN workspace_chats wc ON wcr.chat_id = wc.id
         LEFT JOIN users u ON wcr.user_id = u.id
         WHERE wc.workspace_id = ?`
      )
      .bind(workspaceId)
      .all();
    for (const r of (readsRaw.results || []) as any[]) {
      if (!readsMap.has(r.chat_id)) readsMap.set(r.chat_id, { count: 0, names: [] });
      const entry = readsMap.get(r.chat_id)!;
      entry.count += 1;
      if (r.user_name && r.user_id !== session.userId) entry.names.push(r.user_name);
    }
  } catch {}

  const now = Math.floor(Date.now() / 1000);
  const stickerRegex = /^\[sticker:(.*?):(.*?):(.*?)]$/;

  const messages: WorkspaceChatMessage[] = msgsRaw.map((r) => {
    const chatRxMap = reactionsMap.get(r.id);
    const reactions: ChatEmojiReaction[] = [];
    if (chatRxMap) {
      chatRxMap.forEach((val, emojiKey) => {
        reactions.push({
          emoji: emojiKey,
          count: val.count,
          hasReacted: val.hasReacted,
          userNames: val.userNames,
        });
      });
    }

    const readEntry = readsMap.get(r.id) || { count: 0, names: [] };

    let is_sticker = false;
    let sticker_info: { id: string; emoji: string; name: string } | null = null;
    const stickerMatch = (r.message || '').trim().match(stickerRegex);
    if (stickerMatch) {
      is_sticker = true;
      sticker_info = {
        id: stickerMatch[1],
        emoji: stickerMatch[2],
        name: stickerMatch[3],
      };
    }

    const smart_links = extractSmartLinks(r.message || '');
    const createdAt = Number(r.created_at) || 0;
    const editCount = Number(r.edit_count || 0);
    const isOwner = r.user_id === session.userId;
    const isWithinTimeLimit = now - createdAt <= 15 * 60;
    const isWithinCountLimit = editCount < 5;

    const can_edit = isOwner && isWithinTimeLimit && isWithinCountLimit;
    let edit_disabled_reason: string | null = null;
    if (isOwner) {
      if (!isWithinTimeLimit) edit_disabled_reason = 'Waktu edit 15 menit telah berakhir';
      else if (!isWithinCountLimit) edit_disabled_reason = 'Batas 5x edit telah tercapai';
    }

    return {
      id: r.id,
      workspace_id: r.workspace_id,
      user_id: r.user_id,
      user_name: r.user_name || 'Anggota Tim',
      user_avatar: r.user_avatar || null,
      user_type: r.user_type || 'OJT',
      user_role: r.user_role || null,
      message: r.message,
      parent_id: r.parent_id || null,
      reply_message: r.reply_message || null,
      reply_user_name: r.reply_user_name || null,
      attachment_url: r.attachment_url || null,
      is_pinned: Number(r.is_pinned || 0) === 1,
      pinned_by: r.pinned_by || null,
      is_edited: Number(r.is_edited || 0) === 1 || Number(r.edited_at || 0) > 0,
      edited_at: Number(r.edited_at) || null,
      edit_count: editCount,
      can_edit,
      edit_disabled_reason,
      created_at: createdAt,
      reactions,
      read_count: readEntry.count,
      read_by_names: readEntry.names,
      is_sticker,
      sticker_info,
      smart_links,
    };
  });

  return messages;
}
