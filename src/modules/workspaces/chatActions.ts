'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/modules/roles/rbac';

export interface WorkspaceChatMessage {
  id: string;
  workspace_id: string;
  user_id: string;
  user_name: string | null;
  message: string;
  created_at: number;
}

/**
 * Send a message to a workspace chat room.
 */
export async function sendWorkspaceMessage(workspaceId: string, message: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const trimmed = message?.trim();
  if (!trimmed) return { success: false, error: 'Pesan tidak boleh kosong.' };

  const db = await getDB();
  const msgId = `wc_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare('INSERT INTO workspace_chats (id, workspace_id, user_id, message) VALUES (?, ?, ?, ?)')
      .bind(msgId, workspaceId, session.userId, trimmed)
      .run();

    revalidatePath(`/dashboard/workspace/${workspaceId}`);
    return { success: true };
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
    const msg = await db
      .prepare('SELECT user_id FROM workspace_chats WHERE id = ?')
      .bind(messageId)
      .first<{ user_id: string }>();

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
