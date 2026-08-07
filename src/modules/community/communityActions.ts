'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { sendPushNotificationToUser } from '@/modules/notifications/pushActions';
import { getActiveSimulatedRole } from '@/modules/roles/viewAsRoleActions';

export interface CommunityChannel {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'WORK' | 'GENERAL';
  icon: string;
  sort_order: number;
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
 * Gets all community chat channels grouped by category with unread counts
 */
export async function getCommunityChannels(): Promise<{
  workChannels: CommunityChannel[];
  generalChannels: CommunityChannel[];
}> {
  const session = await getSession();
  const db = await getDB();

  const channelsRaw = (await db
    .prepare(
      `SELECT id, slug, name, description, category, icon, sort_order
       FROM community_channels
       ORDER BY sort_order ASC, name ASC`
    )
    .all()) as {
    results: Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      category: 'WORK' | 'GENERAL';
      icon: string;
      sort_order: number;
    }>;
  };

  const channels = channelsRaw.results || [];
  const workChannels: CommunityChannel[] = [];
  const generalChannels: CommunityChannel[] = [];

  for (const ch of channels) {
    let unreadCount = 0;
    let lastMessage = '';
    let lastMessageAt = '';

    if (session?.userId) {
      const readRow = (await db
        .prepare(
          `SELECT last_read_at FROM community_channel_reads
           WHERE channel_id = ? AND user_id = ?`
        )
        .bind(ch.id, session.userId)
        .first()) as { last_read_at: string } | null;

      const lastReadAt = readRow?.last_read_at || '1970-01-01 00:00:00';

      const unreadRow = (await db
        .prepare(
          `SELECT COUNT(*) as count FROM community_messages
           WHERE channel_id = ? AND created_at > ?`
        )
        .bind(ch.id, lastReadAt)
        .first()) as { count: number } | null;

      unreadCount = unreadRow?.count || 0;
    }

    const lastMsgRow = (await db
      .prepare(
        `SELECT message, created_at FROM community_messages
         WHERE channel_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(ch.id)
      .first()) as { message: string; created_at: string } | null;

    if (lastMsgRow) {
      lastMessage = lastMsgRow.message;
      lastMessageAt = lastMsgRow.created_at;
    }

    const item: CommunityChannel = {
      ...ch,
      unreadCount,
      lastMessage,
      lastMessageAt,
    };

    if (ch.category === 'WORK') {
      workChannels.push(item);
    } else {
      generalChannels.push(item);
    }
  }

  return { workChannels, generalChannels };
}

/**
 * Gets messages for a community channel including user details, parent reply info & reactions
 */
export async function getCommunityMessages(
  channelId: string,
  limit = 60
): Promise<CommunityMessage[]> {
  const session = await getSession();
  const simRole = await getActiveSimulatedRole();
  const db = await getDB();

  const messagesRaw = (await db
    .prepare(
      `SELECT m.id, m.channel_id, m.user_id, m.message, m.attachment_url, m.parent_id, m.created_at,
              u.name as user_name, u.email as user_email, u.avatar_url as user_avatar,
              r.name as user_role_name, r.color as user_role_color
       FROM community_messages m
       JOIN users u ON m.user_id = u.id
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
      user_name: string;
      user_email: string;
      user_avatar?: string;
      user_role_name?: string;
      user_role_color?: string;
    }>;
  };

  const messages = messagesRaw.results || [];
  const currentUserId = session?.userId;

  // Mark channel as read for current user
  if (currentUserId) {
    await db
      .prepare(
        `INSERT INTO community_channel_reads (channel_id, user_id, last_read_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(channel_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`
      )
      .bind(channelId, currentUserId)
      .run();
  }

  const result: CommunityMessage[] = [];

  for (const m of messages) {
    // Check if current user is simulating a role
    let displayRoleName = m.user_role_name;
    let displayRoleColor = m.user_role_color;

    if (simRole && currentUserId && m.user_id === currentUserId) {
      displayRoleName = simRole.roleName;
      if (simRole.roleName.toUpperCase().includes('TROOPERS')) {
        displayRoleColor = '#3b82f6';
      } else if (simRole.roleName.toUpperCase().includes('EXECUTIVE')) {
        displayRoleColor = '#ec4899';
      } else if (simRole.roleName.toUpperCase().includes('COORDINATOR')) {
        displayRoleColor = '#2563eb';
      }
    }

    // Reactions for this message
    const reactionsRaw = (await db
      .prepare(
        `SELECT emoji, user_id FROM community_message_reactions
         WHERE message_id = ?`
      )
      .bind(m.id)
      .all()) as { results: Array<{ emoji: string; user_id: string }> };

    const rawList = reactionsRaw.results || [];
    const reactionMap = new Map<string, { count: number; userReacted: boolean }>();

    for (const r of rawList) {
      const existing = reactionMap.get(r.emoji) || { count: 0, userReacted: false };
      existing.count += 1;
      if (currentUserId && r.user_id === currentUserId) {
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

    // Parent message details for Quote Reply
    let replyTo: CommunityMessage['reply_to'] = undefined;
    if (m.parent_id) {
      const parentRow = (await db
        .prepare(
          `SELECT m.id, m.message, u.name as user_name
           FROM community_messages m
           JOIN users u ON m.user_id = u.id
           WHERE m.id = ?`
        )
        .bind(m.parent_id)
        .first()) as { id: string; message: string; user_name: string } | null;

      if (parentRow) {
        replyTo = {
          id: parentRow.id,
          user_name: parentRow.user_name,
          message: parentRow.message,
        };
      }
    }

    result.push({
      id: m.id,
      channel_id: m.channel_id,
      user_id: m.user_id,
      user_name: m.user_name,
      user_email: m.user_email,
      user_avatar: m.user_avatar,
      user_role_name: displayRoleName,
      user_role_color: displayRoleColor,
      message: m.message,
      attachment_url: m.attachment_url,
      parent_id: m.parent_id,
      reply_to: replyTo,
      created_at: m.created_at,
      reactions,
    });
  }

  return result;
}

/**
 * Gets members categorized strictly by role hierarchy for Online members, and a single Offline group at the bottom
 */
export async function getCommunityMembers(): Promise<{
  onlineRoleGroups: CommunityMemberGroup[];
  offlineMembers: CommunityMember[];
  totalOnline: number;
  totalOffline: number;
}> {
  try {
    const session = await getSession();
    const simRole = await getActiveSimulatedRole();
    const db = await getDB();

    const usersRaw = await db
      .prepare(
        `SELECT u.id, u.name, u.email, u.avatar_url, u.created_at,
                r.id as role_id, r.name as role_name, r.color as role_color
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         ORDER BY r.name ASC, u.name ASC`
      )
      .all();

    const users = ((usersRaw as any)?.results || usersRaw || []) as Array<{
      id: string;
      name: string;
      email: string;
      avatar_url?: string;
      created_at?: string | number;
      role_id?: string;
      role_name?: string;
      role_color?: string;
    }>;

    const nowMs = Date.now();
    const fifteenMinsMs = 15 * 60 * 1000;
    const lastActiveMap = new Map<string, number>();

    try {
      const activeReadsRaw = await db
        .prepare('SELECT user_id, max(last_read_at) as last_active FROM community_channel_reads GROUP BY user_id')
        .all();
      const activeReads = ((activeReadsRaw as any)?.results || activeReadsRaw || []) as Array<{
        user_id: string;
        last_active: string;
      }>;
      for (const row of activeReads) {
        if (row.last_active) {
          lastActiveMap.set(row.user_id, new Date(row.last_active).getTime());
        }
      }
    } catch (e) {
      console.warn('Channel reads query warning:', e);
    }

    try {
      const activeMsgsRaw = await db
        .prepare('SELECT user_id, max(created_at) as last_active FROM community_messages GROUP BY user_id')
        .all();
      const activeMsgs = ((activeMsgsRaw as any)?.results || activeMsgsRaw || []) as Array<{
        user_id: string;
        last_active: string;
      }>;
      for (const row of activeMsgs) {
        if (row.last_active) {
          const t = new Date(row.last_active).getTime();
          const prev = lastActiveMap.get(row.user_id) || 0;
          if (t > prev) lastActiveMap.set(row.user_id, t);
        }
      }
    } catch (e) {
      console.warn('Community msgs query warning:', e);
    }

    if (session?.userId) {
      lastActiveMap.set(session.userId, nowMs);
    }

    const onlineGroupMap = new Map<string, { roleColor?: string; members: CommunityMember[] }>();
    const offlineMembersList: CommunityMember[] = [];
    const processedUserIds = new Set<string>();

    let totalOnline = 0;
    let totalOffline = 0;

    for (const u of users) {
      if (processedUserIds.has(u.id)) continue;
      processedUserIds.add(u.id);

      const lastActiveTime = lastActiveMap.get(u.id) || (u.created_at ? new Date(u.created_at).getTime() : 0);
      const isOnline = nowMs - lastActiveTime < fifteenMinsMs;

      let displayRoleName = u.role_name || 'Anggota Tim';
      let displayRoleColor = u.role_color || '#7c3aed';

      if (simRole && session?.userId && u.id === session.userId) {
        displayRoleName = simRole.roleName;
        if (simRole.roleName.toUpperCase().includes('TROOPERS')) {
          displayRoleColor = '#3b82f6';
        } else if (simRole.roleName.toUpperCase().includes('EXECUTIVE')) {
          displayRoleColor = '#ec4899';
        } else if (simRole.roleName.toUpperCase().includes('COORDINATOR')) {
          displayRoleColor = '#2563eb';
        }
      }

      const memberObj: CommunityMember = {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url,
        role_id: u.role_id,
        role_name: displayRoleName,
        role_color: displayRoleColor,
        is_online: isOnline,
        last_active_at: u.created_at ? String(u.created_at) : undefined,
      };

      if (isOnline) {
        totalOnline += 1;
        const groupKey = displayRoleName;
        const existing = onlineGroupMap.get(groupKey) || { roleColor: displayRoleColor, members: [] };
        existing.members.push(memberObj);
        onlineGroupMap.set(groupKey, existing);
      } else {
        totalOffline += 1;
        offlineMembersList.push(memberObj);
      }
    }

    // Role Hierarchy Priority Sorting (Executive -> Coordinator -> Mentor -> Creator -> Collaborator -> Troopers)
    const HIERARCHY: { [key: string]: number } = {
      EXECUTIVE: 1,
      ADMIN: 1,
      STAFF: 1,
      COORDINATOR: 2,
      MENTOR: 3,
      CREATOR: 4,
      COLLABORATOR: 5,
      TROOPERS: 6,
    };

    const getRank = (name: string) => {
      const upper = name.toUpperCase();
      for (const key of Object.keys(HIERARCHY)) {
        if (upper.includes(key)) return HIERARCHY[key];
      }
      return 99;
    };

    const onlineRoleGroups: CommunityMemberGroup[] = Array.from(onlineGroupMap.entries())
      .map(([groupName, data]) => ({
        groupName,
        roleColor: data.roleColor,
        members: data.members.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => getRank(a.groupName) - getRank(b.groupName) || a.groupName.localeCompare(b.groupName));

    const offlineMembers = offlineMembersList.sort((a, b) => a.name.localeCompare(b.name));

    return { onlineRoleGroups, offlineMembers, totalOnline, totalOffline };
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
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await db
    .prepare(
      `INSERT INTO community_messages (id, channel_id, user_id, message, attachment_url, parent_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(id, channelId, session.userId, message, attachmentUrl || null, parentId || null)
    .run();

  // Handle @mentions push notifications
  try {
    const mentionMatches = message.match(/@([\w.-]+)/g);
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
          await sendPushNotificationToUser(
            targetUser.id,
            `💬 Mentioned oleh ${session.name}`,
            `"${message.slice(0, 100)}..."`,
            `/dashboard/community?channelId=${channelId}`
          );
        }
      }
    }
  } catch (err) {
    console.error('Mention push notification error:', err);
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
