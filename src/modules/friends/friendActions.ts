'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

export interface FriendUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  userType: string | null;
  friendshipId?: string;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt?: number;
}

export interface FriendsSummary {
  friends: FriendUser[];
  incomingRequests: FriendUser[];
  outgoingRequests: FriendUser[];
  suggestions: FriendUser[];
}

export type FriendshipStatus = 'NONE' | 'FRIENDS' | 'PENDING_SENT' | 'PENDING_RECEIVED';

/**
 * Get friendship status between logged-in user and targetUserId
 */
export async function getFriendshipStatusAction(targetUserId: string): Promise<{
  success: boolean;
  status: FriendshipStatus;
  friendshipId?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, status: 'NONE' };

  if (session.userId === targetUserId) {
    return { success: true, status: 'NONE' };
  }

  const db = await getDB();
  const row = (await db
    .prepare(
      `SELECT id, user_id, friend_id, status
       FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
    )
    .bind(session.userId, targetUserId, targetUserId, session.userId)
    .first()) as { id: string; user_id: string; friend_id: string; status: string } | null;

  if (!row) return { success: true, status: 'NONE' };

  if (row.status === 'ACCEPTED') {
    return { success: true, status: 'FRIENDS', friendshipId: row.id };
  }

  if (row.status === 'PENDING') {
    if (row.user_id === session.userId) {
      return { success: true, status: 'PENDING_SENT', friendshipId: row.id };
    } else {
      return { success: true, status: 'PENDING_RECEIVED', friendshipId: row.id };
    }
  }

  return { success: true, status: 'NONE' };
}

/**
 * Send friend request to targetUserId
 */
export async function sendFriendRequestAction(targetUserId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (session.userId === targetUserId) return { success: false, error: 'Tidak bisa menambahkan diri sendiri.' };

  const db = await getDB();
  const now = Date.now();

  const existing = await db
    .prepare(
      `SELECT id, status FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
    )
    .bind(session.userId, targetUserId, targetUserId, session.userId)
    .first();

  if (existing) {
    if ((existing as any).status === 'ACCEPTED') {
      return { success: false, error: 'Anda sudah berteman dengan user ini.' };
    }
    return { success: false, error: 'Permintaan pertemanan sudah ada.' };
  }

  const id = `f_${crypto.randomUUID().replace(/-/g, '')}`;
  await db
    .prepare(
      `INSERT INTO friendships (id, user_id, friend_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'PENDING', ?, ?)`
    )
    .bind(id, session.userId, targetUserId, now, now)
    .run();

  revalidatePath('/dashboard/friends');
  revalidatePath('/dashboard/profile');
  return { success: true };
}

/**
 * Respond to friend request or unfriend/cancel
 */
export async function respondFriendRequestAction(
  targetUserId: string,
  action: 'ACCEPT' | 'REJECT' | 'CANCEL' | 'UNFRIEND'
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const now = Date.now();

  if (action === 'ACCEPT') {
    await db
      .prepare(
        `UPDATE friendships SET status = 'ACCEPTED', updated_at = ?
         WHERE friend_id = ? AND user_id = ? AND status = 'PENDING'`
      )
      .bind(now, session.userId, targetUserId)
      .run();
  } else if (action === 'REJECT') {
    await db
      .prepare(
        `DELETE FROM friendships
         WHERE friend_id = ? AND user_id = ? AND status = 'PENDING'`
      )
      .bind(session.userId, targetUserId)
      .run();
  } else if (action === 'CANCEL') {
    await db
      .prepare(
        `DELETE FROM friendships
         WHERE user_id = ? AND friend_id = ? AND status = 'PENDING'`
      )
      .bind(session.userId, targetUserId)
      .run();
  } else if (action === 'UNFRIEND') {
    await db
      .prepare(
        `DELETE FROM friendships
         WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))`
      )
      .bind(session.userId, targetUserId, targetUserId, session.userId)
      .run();
  }

  revalidatePath('/dashboard/friends');
  revalidatePath('/dashboard/profile');
  return { success: true };
}

/**
 * Get all friends, requests, and suggestions for the current user
 */
export async function getFriendsDataAction(): Promise<{
  success: boolean;
  data?: FriendsSummary;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();

  // 1. Fetch friendships involving the user
  const { results: friendships } = await db
    .prepare(
      `SELECT f.id AS friendship_id, f.user_id, f.friend_id, f.status, f.created_at,
              u.id AS partner_id, u.name, u.email, u.avatar_url, u.user_type
       FROM friendships f
       JOIN users u ON (CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END) = u.id
       WHERE (f.user_id = ? OR f.friend_id = ?) AND u.status = 'ACTIVE'`
    )
    .bind(session.userId, session.userId, session.userId)
    .all();

  const friends: FriendUser[] = [];
  const incomingRequests: FriendUser[] = [];
  const outgoingRequests: FriendUser[] = [];
  const relativeUserIds = new Set<string>([session.userId]);

  (friendships as any[]).forEach((row) => {
    relativeUserIds.add(row.partner_id);
    const item: FriendUser = {
      id: row.partner_id,
      name: row.name || row.email,
      email: row.email,
      avatarUrl: row.avatar_url,
      userType: row.user_type,
      friendshipId: row.friendship_id,
      status: row.status,
      createdAt: row.created_at,
    };

    if (row.status === 'ACCEPTED') {
      friends.push(item);
    } else if (row.status === 'PENDING') {
      if (row.friend_id === session.userId) {
        incomingRequests.push(item);
      } else {
        outgoingRequests.push(item);
      }
    }
  });

  // 2. Fetch user suggestions (active users not yet connected)
  const { results: rawSuggestions } = await db
    .prepare(`SELECT id, name, email, avatar_url, user_type FROM users WHERE status = 'ACTIVE' LIMIT 50`)
    .all();

  const suggestions: FriendUser[] = [];
  (rawSuggestions as any[]).forEach((u) => {
    if (!relativeUserIds.has(u.id)) {
      suggestions.push({
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        avatarUrl: u.avatar_url,
        userType: u.user_type,
      });
    }
  });

  return {
    success: true,
    data: {
      friends,
      incomingRequests,
      outgoingRequests,
      suggestions: suggestions.slice(0, 10),
    },
  };
}
