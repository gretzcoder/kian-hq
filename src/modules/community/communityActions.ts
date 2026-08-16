'use server';

import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { sendPushNotificationToUser, sendPushNotificationToUsers } from '@/modules/notifications/pushActions';
import { getActiveSimulatedRole } from '@/modules/roles/viewAsRoleActions';
import { revalidatePath } from 'next/cache';

export interface CommunityCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

export interface CommunityChannel {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  category_id?: string;
  icon: string;
  sort_order: number;
  is_default?: number;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface CommunityReaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface CommunityMessage {
  id: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  user_role_name?: string;
  user_role_color?: string;
  message: string;
  attachment_url?: string;
  parent_id?: string;
  reply_to?: {
    id: string;
    user_name: string;
    message: string;
  };
  created_at: string;
  reactions: CommunityReaction[];
}

export interface CommunityMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role_id?: string;
  role_name?: string;
  role_color?: string;
  is_online: boolean;
  last_active_at?: string;
}

export interface CommunityMemberGroup {
  groupName: string;
  roleColor?: string;
  members: CommunityMember[];
}

/**
 * Ensures DB tables for community categories and default channel column exist
 */
async function initCommunityTables(db: any) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS community_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT DEFAULT '📁',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const catCount = (await db.prepare(`SELECT COUNT(*) as count FROM community_categories`).first()) as { count: number } | null;
    if (!catCount || catCount.count === 0) {
      await db.prepare(`
        INSERT OR IGNORE INTO community_categories (id, name, icon, sort_order) VALUES
        ('cat_work', 'KATEGORI KERJAAN', '💼', 1),
        ('cat_general', 'GENERAL & SANTAI', '💬', 2)
      `).run();
    }

    try {
      await db.prepare(`ALTER TABLE community_channels ADD COLUMN is_default INTEGER DEFAULT 0`).run();
    } catch (e) {
      // Column exists
    }

    try {
      await db.prepare(`ALTER TABLE community_channels ADD COLUMN category_id TEXT`).run();
    } catch (e) {
      // Column exists
    }

    const defaultCheck = (await db.prepare(`SELECT id FROM community_channels WHERE is_default = 1 LIMIT 1`).first()) as { id: string } | null;
    if (!defaultCheck) {
      await db.prepare(`UPDATE community_channels SET is_default = 1 WHERE slug = 'general-chit-chat' OR id = 'chan_general'`).run();
      const checkAgain = (await db.prepare(`SELECT id FROM community_channels WHERE is_default = 1 LIMIT 1`).first()) as { id: string } | null;
      if (!checkAgain) {
        await db.prepare(`UPDATE community_channels SET is_default = 1 WHERE rowid = (SELECT MIN(rowid) FROM community_channels)`).run();
      }
    }
  } catch (err) {
    console.error('initCommunityTables error:', err);
  }
}

/**
 * Gets all community chat channels grouped by category with unread counts and default channel info
 */
export async function getCommunityChannels(): Promise<{
  workChannels: CommunityChannel[];
  generalChannels: CommunityChannel[];
  categories: CommunityCategory[];
  defaultChannelId: string | null;
  canManage: boolean;
}> {
  const session = await getSession();
  const db = await getDB();

  await initCommunityTables(db);

  let canManage = false;
  if (session) {
    const ctx = await getSessionContext(session.userId);
    canManage =
      ctx.userType === 'STAFF' ||
      ctx.userType === 'EXTERNAL' ||
      ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER', 'MENTOR'].includes(String(r).toUpperCase())) ||
      ctx.can('MANAGE');
  }

  const categoriesRaw = (await db
    .prepare(`SELECT id, name, icon, sort_order FROM community_categories ORDER BY sort_order ASC, name ASC`)
    .all()) as { results: CommunityCategory[] };

  const categories = categoriesRaw.results || [
    { id: 'cat_work', name: 'KATEGORI KERJAAN', icon: '💼', sort_order: 1 },
    { id: 'cat_general', name: 'GENERAL & SANTAI', icon: '💬', sort_order: 2 },
  ];

  const channelsRaw = (await db
    .prepare(
      `SELECT id, slug, name, description, category, category_id, icon, sort_order, COALESCE(is_default, 0) as is_default
       FROM community_channels
       ORDER BY sort_order ASC, name ASC`
    )
    .all()) as {
    results: Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      category: string;
      category_id?: string;
      icon: string;
      sort_order: number;
      is_default: number;
    }>;
  };

  const channels = channelsRaw.results || [];
  const workChannels: CommunityChannel[] = [];
  const generalChannels: CommunityChannel[] = [];
  let defaultChannelId: string | null = null;

  for (const ch of channels) {
    if (ch.is_default === 1 && !defaultChannelId) {
      defaultChannelId = ch.id;
    }

    let unreadCount = 0;
    let lastMessage = '';
    let lastMessageAt = '';

    if (session) {
      const readState = (await db
        .prepare(
          `SELECT last_read_at FROM community_channel_reads
           WHERE channel_id = ? AND user_id = ?`
        )
        .bind(ch.id, session.userId)
        .first()) as { last_read_at: string } | null;

      const lastRead = readState?.last_read_at || '1970-01-01 00:00:00';

      const countRes = (await db
        .prepare(
          `SELECT COUNT(*) as count FROM community_messages
           WHERE channel_id = ? AND created_at > ?`
        )
        .bind(ch.id, lastRead)
        .first()) as { count: number } | null;

      unreadCount = countRes?.count || 0;
    }

    const lastMsgRes = (await db
      .prepare(
        `SELECT message, created_at FROM community_messages
         WHERE channel_id = ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(ch.id)
      .first()) as { message: string; created_at: string } | null;

    if (lastMsgRes) {
      lastMessage = lastMsgRes.message;
      lastMessageAt = lastMsgRes.created_at;
    }

    const item: CommunityChannel = {
      ...ch,
      unreadCount,
      lastMessage,
      lastMessageAt,
    };

    if (ch.category === 'WORK' || ch.category_id === 'cat_work' || ch.category.toLowerCase().includes('kerja')) {
      workChannels.push(item);
    } else {
      generalChannels.push(item);
    }
  }

  if (!defaultChannelId && channels.length > 0) {
    defaultChannelId = channels[0].id;
  }

  return { workChannels, generalChannels, categories, defaultChannelId, canManage };
}

/**
 * Gets messages for a community channel including user details, parent reply info & reactions
 */
export async function getCommunityMessages(
  channelId: string,
  limit = 100
): Promise<CommunityMessage[]> {
  const session = await getSession();
  const db = await getDB();

  const msgsRaw = (await db
    .prepare(
      `SELECT m.id, m.channel_id, m.user_id, m.message, m.attachment_url, m.parent_id, m.created_at,
              u.name as user_name, u.email as user_email, u.avatar_url as user_avatar,
              r.name as user_role_name, r.description as user_role_color
       FROM community_messages m
       LEFT JOIN users u ON m.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE m.channel_id = ?
       ORDER BY m.created_at ASC
       LIMIT ?`
    )
    .bind(channelId, limit)
    .all()) as {
    results: Array<{
      id: string;
      channel_id: string;
      user_id: string;
      message: string;
      attachment_url?: string;
      parent_id?: string;
      created_at: string;
      user_name?: string;
      user_email?: string;
      user_avatar?: string;
      user_role_name?: string;
      user_role_color?: string;
    }>;
  };

  if (session) {
    await db
      .prepare(
        `INSERT INTO community_channel_reads (channel_id, user_id, last_read_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(channel_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`
      )
      .bind(channelId, session.userId)
      .run();
  }

  const rawList = msgsRaw.results || [];
  const result: CommunityMessage[] = [];

  for (const m of rawList) {
    let roleColor = '#7c3aed';
    if (m.user_role_color && m.user_role_color.startsWith('#')) {
      roleColor = m.user_role_color;
    } else {
      const rName = (m.user_role_name || '').toUpperCase();
      if (rName.includes('ADMIN')) roleColor = '#ef4444';
      else if (rName.includes('EXECUTIVE')) roleColor = '#f59e0b';
      else if (rName.includes('COORDINATOR')) roleColor = '#3b82f6';
      else if (rName.includes('MENTOR')) roleColor = '#10b981';
      else if (rName.includes('LEADER')) roleColor = '#8b5cf6';
      else if (rName.includes('OJT')) roleColor = '#06b6d4';
    }

    const reactionsRaw = (await db
      .prepare(
        `SELECT emoji, user_id FROM community_message_reactions
         WHERE message_id = ?`
      )
      .bind(m.id)
      .all()) as {
      results: Array<{ emoji: string; user_id: string }>;
    };

    const reactionMap = new Map<string, { count: number; userReacted: boolean }>();
    for (const r of reactionsRaw.results || []) {
      const existing = reactionMap.get(r.emoji) || { count: 0, userReacted: false };
      existing.count += 1;
      if (session && r.user_id === session.userId) {
        existing.userReacted = true;
      }
      reactionMap.set(r.emoji, existing);
    }

    const reactions: CommunityReaction[] = Array.from(reactionMap.entries()).map(
      ([emoji, data]) => ({
        emoji,
        count: data.count,
        userReacted: data.userReacted,
      })
    );

    let replyTo: CommunityMessage['reply_to'] = undefined;
    if (m.parent_id) {
      const parentRaw = (await db
        .prepare(
          `SELECT m.id, m.message, u.name as user_name
           FROM community_messages m
           LEFT JOIN users u ON m.user_id = u.id
           WHERE m.id = ?`
        )
        .bind(m.parent_id)
        .first()) as { id: string; message: string; user_name?: string } | null;

      if (parentRaw) {
        replyTo = {
          id: parentRaw.id,
          user_name: parentRaw.user_name || 'User',
          message: parentRaw.message,
        };
      }
    }

    result.push({
      id: m.id,
      channel_id: m.channel_id,
      user_id: m.user_id,
      user_name: m.user_name || 'Pengguna',
      user_email: m.user_email || '',
      user_avatar: m.user_avatar || undefined,
      user_role_name: m.user_role_name || 'Member',
      user_role_color: roleColor,
      message: m.message,
      attachment_url: m.attachment_url || undefined,
      parent_id: m.parent_id || undefined,
      reply_to: replyTo,
      created_at: m.created_at,
      reactions,
    });
  }

  return result;
}

/**
 * Gets members grouped by role (Online groups) + Single Offline group at bottom
 */
export async function getCommunityMembers(): Promise<{
  onlineRoleGroups: CommunityMemberGroup[];
  offlineMembers: CommunityMember[];
  totalOnline: number;
  totalOffline: number;
}> {
  const db = await getDB();
  const simulatedRole = await getActiveSimulatedRole();

  try {
    const membersRaw = (await db
      .prepare(
        `SELECT u.id, u.name, u.email, u.avatar_url, u.user_type,
                r.id as role_id, r.name as role_name, r.description as role_color
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         ORDER BY r.name ASC, u.name ASC`
      )
      .all()) as {
      results: Array<{
        id: string;
        name: string;
        email: string;
        avatar_url?: string;
        user_type?: string;
        role_id?: string;
        role_name?: string;
        role_color?: string;
      }>;
    };

    const readsRaw = (await db
      .prepare('SELECT user_id, max(last_read_at) as last_active FROM community_channel_reads GROUP BY user_id')
      .all()) as { results: Array<{ user_id: string; last_active: string }> };

    const msgsRaw = (await db
      .prepare('SELECT user_id, max(created_at) as last_active FROM community_messages GROUP BY user_id')
      .all()) as { results: Array<{ user_id: string; last_active: string }> };

    const lastActiveMap = new Map<string, number>();
    for (const r of readsRaw.results || []) {
      const t = new Date(r.last_active).getTime();
      if (!isNaN(t)) lastActiveMap.set(r.user_id, Math.max(lastActiveMap.get(r.user_id) || 0, t));
    }
    for (const m of msgsRaw.results || []) {
      const t = new Date(m.last_active).getTime();
      if (!isNaN(t)) lastActiveMap.set(m.user_id, Math.max(lastActiveMap.get(m.user_id) || 0, t));
    }

    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    const onlineGroupMap = new Map<string, { roleColor?: string; members: CommunityMember[] }>();
    const offlineMembersList: CommunityMember[] = [];

    const processedUsers = new Set<string>();

    for (const u of membersRaw.results || []) {
      if (processedUsers.has(u.id)) continue;
      processedUsers.add(u.id);

      const lastActive = lastActiveMap.get(u.id) || 0;
      const isOnline = lastActive >= fiveMinsAgo;

      let rName = u.role_name || (u.user_type === 'STAFF' ? 'STAFF' : 'MEMBER');
      let rColor = u.role_color;

      if (simulatedRole) {
        rName = String(simulatedRole);
      }

      if (!rColor || !rColor.startsWith('#')) {
        const uUpper = rName.toUpperCase();
        if (uUpper.includes('ADMIN')) rColor = '#ef4444';
        else if (uUpper.includes('EXECUTIVE')) rColor = '#f59e0b';
        else if (uUpper.includes('COORDINATOR')) rColor = '#3b82f6';
        else if (uUpper.includes('MENTOR')) rColor = '#10b981';
        else if (uUpper.includes('LEADER')) rColor = '#8b5cf6';
        else if (uUpper.includes('OJT')) rColor = '#06b6d4';
        else rColor = '#8b5cf6';
      }

      const memberObj: CommunityMember = {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url || undefined,
        role_id: u.role_id || undefined,
        role_name: rName,
        role_color: rColor,
        is_online: isOnline,
        last_active_at: lastActive ? new Date(lastActive).toISOString() : undefined,
      };

      if (isOnline) {
        const existingGroup = onlineGroupMap.get(rName) || { roleColor: rColor, members: [] };
        existingGroup.members.push(memberObj);
        onlineGroupMap.set(rName, existingGroup);
      } else {
        offlineMembersList.push(memberObj);
      }
    }

    const onlineRoleGroups: CommunityMemberGroup[] = Array.from(onlineGroupMap.entries())
      .map(([groupName, data]) => ({
        groupName,
        roleColor: data.roleColor,
        members: data.members,
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));

    const totalOnline = onlineRoleGroups.reduce((acc, g) => acc + g.members.length, 0);
    const totalOffline = offlineMembersList.length;

    return {
      onlineRoleGroups,
      offlineMembers: offlineMembersList,
      totalOnline,
      totalOffline,
    };
  } catch (err) {
    console.error('Failed in getCommunityMembers:', err);
    return { onlineRoleGroups: [], offlineMembers: [], totalOnline: 0, totalOffline: 0 };
  }
}

/**
 * Sends a message to a community channel with @mentions push notifications support
 */
export async function sendCommunityMessage(
  channelId: string,
  message: string,
  attachmentUrl?: string,
  parentId?: string
): Promise<{ success: boolean; messageId?: string }> {
  const session = await getSession();
  if (!session) return { success: false };

  const db = await getDB();
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await db
    .prepare(
      `INSERT INTO community_messages (id, channel_id, user_id, message, attachment_url, parent_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(id, channelId, session.userId, message.trim(), attachmentUrl || null, parentId || null)
    .run();

  await db
    .prepare(
      `INSERT INTO community_channel_reads (channel_id, user_id, last_read_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(channel_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`
    )
    .bind(channelId, session.userId)
    .run();

  try {
    const channelRow = (await db
      .prepare('SELECT name FROM community_channels WHERE id = ?')
      .bind(channelId)
      .first()) as { name: string } | null;
    const channelName = channelRow?.name || 'community';

    const mentionedUserIds: string[] = [];
    const mentionMatches = message.match(/@[\w.-]+/g);

    if (mentionMatches && mentionMatches.length > 0) {
      const allUsers = (await db.prepare('SELECT id, name, email FROM users').all()) as {
        results: Array<{ id: string; name: string; email: string }>;
      };
      const usersList = allUsers.results || [];

      for (const mText of mentionMatches) {
        const handle = mText.substring(1).toLowerCase();
        const targetUser = usersList.find((u) => {
          const first = u.name.split(' ')[0].toLowerCase();
          const full = u.name.toLowerCase();
          const emailUser = u.email.split('@')[0].toLowerCase();
          return (
            first === handle ||
            full === handle ||
            emailUser === handle ||
            full.startsWith(handle)
          );
        });

        if (targetUser && targetUser.id !== session.userId) {
          mentionedUserIds.push(targetUser.id);
          await sendPushNotificationToUser(
            targetUser.id,
            'MENTION',
            {
              title: `💬 Mentioned oleh ${session.name}`,
              body: `"${message.slice(0, 100)}..."`,
              url: `/dashboard/community?channelId=${channelId}`,
            }
          );
        }
      }
    }

    // Broadcast COMMUNITY_CHAT push notification to all active platform users (excluding sender and mentioned users)
    const otherUsers = (await db
      .prepare('SELECT id FROM users WHERE id != ? AND is_active = 1')
      .bind(session.userId)
      .all()) as { results: Array<{ id: string }> };

    const targetUserIds = (otherUsers.results || [])
      .map((u) => u.id)
      .filter((uid) => !mentionedUserIds.includes(uid));

    if (targetUserIds.length > 0) {
      const cleanMessageText = message.slice(0, 90) + (message.length > 90 ? '...' : '');
      await sendPushNotificationToUsers(targetUserIds, 'COMMUNITY_CHAT', {
        title: `🌐 Community Chat (#${channelName})`,
        body: `${session.name}: "${cleanMessageText}"`,
        url: `/dashboard/community?channelId=${channelId}`,
        category: 'COMMUNITY_CHAT',
        tag: `comm_${channelId}`,
      }).catch((err) => console.error('Community chat push notification error:', err));
    }
  } catch (err) {
    console.error('Community chat push notification error:', err);
  }

  return { success: true, messageId: id };
}

/**
 * Toggles an emoji reaction for a community message
 */
export async function toggleCommunityReaction(
  messageId: string,
  emoji: string
): Promise<{ success: boolean; action: 'added' | 'removed' }> {
  const session = await getSession();
  if (!session) return { success: false, action: 'removed' };

  const db = await getDB();

  const existing = await db
    .prepare(
      `SELECT id FROM community_message_reactions
       WHERE message_id = ? AND user_id = ? AND emoji = ?`
    )
    .bind(messageId, session.userId, emoji)
    .first();

  if (existing) {
    await db
      .prepare(
        `DELETE FROM community_message_reactions
         WHERE message_id = ? AND user_id = ? AND emoji = ?`
      )
      .bind(messageId, session.userId, emoji)
      .run();
    return { success: true, action: 'removed' };
  } else {
    const id = `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db
      .prepare(
        `INSERT INTO community_message_reactions (id, message_id, user_id, emoji, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(id, messageId, session.userId, emoji)
      .run();
    return { success: true, action: 'added' };
  }
}

/**
 * Clears all messages in a specific community channel
 */
export async function clearCommunityChannelMessages(
  channelId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER', 'MENTOR'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin, Koordinator, atau Mentor yang dapat membersihkan riwayat chat.' };
  }

  try {
    await db
      .prepare(
        `DELETE FROM community_message_reactions WHERE message_id IN (SELECT id FROM community_messages WHERE channel_id = ?)`
      )
      .bind(channelId)
      .run();

    await db
      .prepare(`DELETE FROM community_messages WHERE channel_id = ?`)
      .bind(channelId)
      .run();

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    console.error('clearCommunityChannelMessages failed:', err);
    return { success: false, error: err.message || 'Gagal membersihkan chat saluran.' };
  }
}

/**
 * Clears all messages in all community channels of a specific category ('WORK' | 'GENERAL')
 */
export async function clearCommunityCategoryMessages(
  category: 'WORK' | 'GENERAL'
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER', 'MENTOR'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin, Koordinator, atau Mentor yang dapat membersihkan riwayat chat kategori.' };
  }

  try {
    await db
      .prepare(
        `DELETE FROM community_message_reactions
         WHERE message_id IN (
           SELECT m.id FROM community_messages m
           JOIN community_channels c ON m.channel_id = c.id
           WHERE c.category = ?
         )`
      )
      .bind(category)
      .run();

    await db
      .prepare(
        `DELETE FROM community_messages
         WHERE channel_id IN (SELECT id FROM community_channels WHERE category = ?)`
      )
      .bind(category)
      .run();

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    console.error('clearCommunityCategoryMessages failed:', err);
    return { success: false, error: err.message || 'Gagal membersihkan chat kategori.' };
  }
}

/**
 * Creates a new community category
 */
export async function createCommunityCategory(data: {
  name: string;
  icon?: string;
}): Promise<{ success: boolean; categoryId?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  await initCommunityTables(db);

  const ctx = await getSessionContext(session.userId);
  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin/Koordinator yang dapat membuat kategori baru.' };
  }

  if (!data.name || data.name.trim() === '') {
    return { success: false, error: 'Nama kategori wajib diisi.' };
  }

  const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const icon = data.icon?.trim() || '📁';

  const maxOrderRes = (await db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) as max_order FROM community_categories`)
    .first()) as { max_order: number } | null;

  const nextOrder = (maxOrderRes?.max_order || 0) + 1;

  try {
    await db
      .prepare(`INSERT INTO community_categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)`)
      .bind(id, data.name.trim(), icon, nextOrder)
      .run();

    revalidatePath('/dashboard/community');
    return { success: true, categoryId: id };
  } catch (err: any) {
    console.error('createCommunityCategory error:', err);
    return { success: false, error: err.message || 'Gagal membuat kategori.' };
  }
}

/**
 * Updates a community category
 */
export async function updateCommunityCategory(data: {
  id: string;
  name: string;
  icon?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin/Koordinator yang dapat mengubah kategori.' };
  }

  try {
    await db
      .prepare(`UPDATE community_categories SET name = ?, icon = ? WHERE id = ?`)
      .bind(data.name.trim(), data.icon?.trim() || '📁', data.id)
      .run();

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengedit kategori.' };
  }
}

/**
 * Deletes a community category
 */
export async function deleteCommunityCategory(categoryId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin/Koordinator yang dapat menghapus kategori.' };
  }

  try {
    await db.prepare(`DELETE FROM community_categories WHERE id = ?`).bind(categoryId).run();
    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus kategori.' };
  }
}

/**
 * Reorders a community category up or down
 */
export async function reorderCommunityCategory(
  categoryId: string,
  direction: 'UP' | 'DOWN'
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const categoriesRaw = (await db
    .prepare(`SELECT id, sort_order FROM community_categories ORDER BY sort_order ASC, name ASC`)
    .all()) as { results: Array<{ id: string; sort_order: number }> };

  const cats = categoriesRaw.results || [];
  const idx = cats.findIndex((c) => c.id === categoryId);
  if (idx === -1) return { success: false, error: 'Kategori tidak ditemukan.' };

  const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= cats.length) return { success: true }; // Boundary limit

  const currentCat = cats[idx];
  const targetCat = cats[targetIdx];

  try {
    await db.prepare(`UPDATE community_categories SET sort_order = ? WHERE id = ?`).bind(targetCat.sort_order, currentCat.id).run();
    await db.prepare(`UPDATE community_categories SET sort_order = ? WHERE id = ?`).bind(currentCat.sort_order, targetCat.id).run();

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengubah urutan kategori.' };
  }
}

/**
 * Creates a new channel
 */
export async function createCommunityChannel(data: {
  name: string;
  description?: string;
  category: 'WORK' | 'GENERAL' | string;
  icon?: string;
}): Promise<{ success: boolean; channelId?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  await initCommunityTables(db);

  const ctx = await getSessionContext(session.userId);
  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin/Koordinator yang dapat membuat saluran baru.' };
  }

  if (!data.name || data.name.trim() === '') {
    return { success: false, error: 'Nama saluran wajib diisi.' };
  }

  const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const id = `chan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const icon = data.icon?.trim() || '💬';

  const maxOrderRes = (await db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) as max_order FROM community_channels WHERE category = ?`)
    .bind(data.category)
    .first()) as { max_order: number } | null;

  const nextOrder = (maxOrderRes?.max_order || 0) + 1;

  try {
    await db
      .prepare(`INSERT INTO community_channels (id, slug, name, description, category, icon, sort_order, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`)
      .bind(id, slug, data.name.trim(), data.description?.trim() || '', data.category, icon, nextOrder)
      .run();

    revalidatePath('/dashboard/community');
    return { success: true, channelId: id };
  } catch (err: any) {
    console.error('createCommunityChannel error:', err);
    return { success: false, error: err.message || 'Gagal membuat saluran chat.' };
  }
}

/**
 * Updates a community channel
 */
export async function updateCommunityChannel(data: {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin/Koordinator yang dapat mengedit saluran.' };
  }

  try {
    const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await db
      .prepare(`UPDATE community_channels SET name = ?, slug = ?, description = ?, icon = ? WHERE id = ?`)
      .bind(data.name.trim(), slug, data.description?.trim() || '', data.icon?.trim() || '💬', data.id)
      .run();

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengedit saluran chat.' };
  }
}

/**
 * Deletes a community channel
 */
export async function deleteCommunityChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin/Koordinator yang dapat menghapus saluran.' };
  }

  try {
    await db.prepare(`DELETE FROM community_message_reactions WHERE message_id IN (SELECT id FROM community_messages WHERE channel_id = ?)`).bind(channelId).run();
    await db.prepare(`DELETE FROM community_messages WHERE channel_id = ?`).bind(channelId).run();
    await db.prepare(`DELETE FROM community_channel_reads WHERE channel_id = ?`).bind(channelId).run();
    await db.prepare(`DELETE FROM community_channels WHERE id = ?`).bind(channelId).run();

    // Ensure there is still at least one default channel if deleted channel was default
    const defaultCheck = (await db.prepare(`SELECT id FROM community_channels WHERE is_default = 1 LIMIT 1`).first()) as { id: string } | null;
    if (!defaultCheck) {
      await db.prepare(`UPDATE community_channels SET is_default = 1 WHERE rowid = (SELECT MIN(rowid) FROM community_channels)`).run();
    }

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus saluran.' };
  }
}

/**
 * Reorders a channel up or down inside its category
 */
export async function reorderCommunityChannel(
  channelId: string,
  direction: 'UP' | 'DOWN'
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const targetChannel = (await db.prepare(`SELECT category, sort_order FROM community_channels WHERE id = ?`).bind(channelId).first()) as { category: string; sort_order: number } | null;
  if (!targetChannel) return { success: false, error: 'Saluran tidak ditemukan.' };

  const channelsRaw = (await db
    .prepare(`SELECT id, sort_order FROM community_channels WHERE category = ? ORDER BY sort_order ASC, name ASC`)
    .bind(targetChannel.category)
    .all()) as { results: Array<{ id: string; sort_order: number }> };

  const chans = channelsRaw.results || [];
  const idx = chans.findIndex((c) => c.id === channelId);
  if (idx === -1) return { success: false, error: 'Saluran tidak ditemukan.' };

  const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= chans.length) return { success: true }; // Boundary limit

  const currentCh = chans[idx];
  const neighborCh = chans[targetIdx];

  try {
    await db.prepare(`UPDATE community_channels SET sort_order = ? WHERE id = ?`).bind(neighborCh.sort_order, currentCh.id).run();
    await db.prepare(`UPDATE community_channels SET sort_order = ? WHERE id = ?`).bind(currentCh.sort_order, neighborCh.id).run();

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengurutkan saluran.' };
  }
}

/**
 * Sets a specific channel as the Default Chat Room for all users opening Community Chat
 */
export async function setDefaultCommunityChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  await initCommunityTables(db);

  const ctx = await getSessionContext(session.userId);
  const isStaffOrAdmin =
    ctx.userType === 'STAFF' ||
    ctx.roles.some((r: any) => ['ADMIN', 'COORDINATOR', 'EXECUTIVE', 'LEADER'].includes(String(r).toUpperCase())) ||
    ctx.can('MANAGE');

  if (!isStaffOrAdmin) {
    return { success: false, error: 'Hanya Admin/Koordinator yang dapat menentukan Default Chat Room.' };
  }

  try {
    await db.prepare(`UPDATE community_channels SET is_default = 0`).run();
    await db.prepare(`UPDATE community_channels SET is_default = 1 WHERE id = ?`).bind(channelId).run();

    revalidatePath('/dashboard/community');
    return { success: true };
  } catch (err: any) {
    console.error('setDefaultCommunityChannel error:', err);
    return { success: false, error: err.message || 'Gagal mengubah Default Chat Room.' };
  }
}
