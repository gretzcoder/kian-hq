'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/modules/roles/rbac';

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
  created_at: number;
  reactions: ChatEmojiReaction[];
}

/**
 * Send a message to a workspace chat room (with optional reply quoting & attachments).
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

  try {
    await db
      .prepare(
        'INSERT INTO workspace_chats (id, workspace_id, user_id, message, parent_id, attachment_url) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(msgId, workspaceId, session.userId, trimmed || '', parentId || null, attachmentUrl || null)
      .run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true, messageId: msgId };
  } catch (err: any) {
    console.error('sendWorkspaceMessage failed:', err);
    return { success: false, error: err.message || 'Gagal mengirim pesan.' };
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

    // Only owner or user with DELETE permission can delete
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
 * Fetch latest messages for a workspace chat room with user profiles, reply context, & emoji reactions.
 */
export async function getWorkspaceChats(workspaceId: string): Promise<WorkspaceChatMessage[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  try {
    const [msgsRaw, rxRaw] = await Promise.all([
      db
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
        .all(),

      db
        .prepare(
          `SELECT wcr.chat_id, wcr.emoji, wcr.user_id, u.name AS user_name
           FROM workspace_chat_reactions wcr
           JOIN workspace_chats wc ON wcr.chat_id = wc.id
           LEFT JOIN users u ON wcr.user_id = u.id
           WHERE wc.workspace_id = ?`
        )
        .bind(workspaceId)
        .all(),
    ]);

    const reactionsMap = new Map<string, Map<string, { count: number; hasReacted: boolean; userNames: string[] }>>();

    for (const r of (rxRaw.results || []) as any[]) {
      if (!reactionsMap.has(r.chat_id)) {
        reactionsMap.set(r.chat_id, new Map());
      }
      const chatRx = reactionsMap.get(r.chat_id)!;
      if (!chatRx.has(r.emoji)) {
        chatRx.set(r.emoji, { count: 0, hasReacted: false, userNames: [] });
      }
      const entry = chatRx.get(r.emoji)!;
      entry.count += 1;
      if (r.user_id === session.userId) {
        entry.hasReacted = true;
      }
      if (r.user_name) {
        entry.userNames.push(r.user_name);
      }
    }

    const messages: WorkspaceChatMessage[] = ((msgsRaw.results || []) as any[]).map((r) => {
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
        created_at: Number(r.created_at) || 0,
        reactions,
      };
    });

    return messages;
  } catch (err) {
    console.error('getWorkspaceChats failed:', err);
    return [];
  }
}
