'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { sendWebPushNotification, PushPayload, StoredSubscription } from './webPush';

export interface UserNotificationSettings {
  notify_chat: boolean;
  notify_community_chat: boolean;
  notify_dm: boolean;
  notify_mention: boolean;
  notify_task: boolean;
  notify_deadline: boolean;
  notify_announcement: boolean;
}

/**
 * Gets user notification preference settings from DB (or defaults to all enabled)
 */
export async function getUserNotificationSettings(
  targetUserId?: string
): Promise<UserNotificationSettings> {
  const session = await getSession();
  const userId = targetUserId || session?.userId;
  if (!userId) {
    return {
      notify_chat: true,
      notify_community_chat: true,
      notify_dm: true,
      notify_mention: true,
      notify_task: true,
      notify_deadline: true,
      notify_announcement: true,
    };
  }

  const db = await getDB();
  const row = (await db
    .prepare(
      'SELECT notify_chat, notify_community_chat, notify_mention, notify_task, notify_deadline, notify_announcement FROM user_notification_settings WHERE user_id = ?'
    )
    .bind(userId)
    .first()) as {
    notify_chat: number;
    notify_community_chat?: number;
    notify_dm?: number;
    notify_mention: number;
    notify_task: number;
    notify_deadline: number;
    notify_announcement: number;
  } | null;

  if (!row) {
    return {
      notify_chat: true,
      notify_community_chat: true,
      notify_dm: true,
      notify_mention: true,
      notify_task: true,
      notify_deadline: true,
      notify_announcement: true,
    };
  }

  return {
    notify_chat: row.notify_chat !== 0 && (row as any).notify_chat !== false,
    notify_community_chat: row.notify_community_chat !== 0 && (row as any).notify_community_chat !== false,
    notify_dm: (row as any).notify_dm !== 0 && (row as any).notify_dm !== false,
    notify_mention: row.notify_mention !== 0 && (row as any).notify_mention !== false,
    notify_task: row.notify_task !== 0 && (row as any).notify_task !== false,
    notify_deadline: row.notify_deadline !== 0 && (row as any).notify_deadline !== false,
    notify_announcement: row.notify_announcement !== 0 && (row as any).notify_announcement !== false,
  };
}

/**
 * Updates current user's notification preference settings
 */
export async function updateUserNotificationSettings(
  settings: Partial<UserNotificationSettings>
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: 'Unauthorized' };
  }

  const db = await getDB();
  const current = await getUserNotificationSettings(session.userId);

  const updated: UserNotificationSettings = {
    notify_chat: settings.notify_chat ?? current.notify_chat,
    notify_community_chat: settings.notify_community_chat ?? current.notify_community_chat,
    notify_dm: settings.notify_dm ?? current.notify_dm,
    notify_mention: settings.notify_mention ?? current.notify_mention,
    notify_task: settings.notify_task ?? current.notify_task,
    notify_deadline: settings.notify_deadline ?? current.notify_deadline,
    notify_announcement: settings.notify_announcement ?? current.notify_announcement,
  };

  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO user_notification_settings
       (user_id, notify_chat, notify_community_chat, notify_mention, notify_task, notify_deadline, notify_announcement, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         notify_chat = excluded.notify_chat,
         notify_community_chat = excluded.notify_community_chat,
         notify_mention = excluded.notify_mention,
         notify_task = excluded.notify_task,
         notify_deadline = excluded.notify_deadline,
         notify_announcement = excluded.notify_announcement,
         updated_at = excluded.updated_at`
    )
    .bind(
      session.userId,
      updated.notify_chat ? 1 : 0,
      updated.notify_community_chat ? 1 : 0,
      updated.notify_mention ? 1 : 0,
      updated.notify_task ? 1 : 0,
      updated.notify_deadline ? 1 : 0,
      updated.notify_announcement ? 1 : 0,
      now
    )
    .run();

  return { success: true };
}

/**
 * Saves or updates client push subscription for current logged in user
 */
export async function savePushSubscription(subscriptionData: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!subscriptionData?.endpoint || !subscriptionData?.keys?.p256dh || !subscriptionData?.keys?.auth) {
    return { success: false, error: 'Payload langganan notifikasi tidak valid.' };
  }

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);
  const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         updated_at = excluded.updated_at`
    )
    .bind(
      id,
      session.userId,
      subscriptionData.endpoint,
      subscriptionData.keys.p256dh,
      subscriptionData.keys.auth,
      now,
      now
    )
    .run();

  return { success: true };
}

/**
 * Deletes push subscription endpoint from DB
 */
export async function deletePushSubscription(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  if (!endpoint) return { success: true };
  const db = await getDB();
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
  return { success: true };
}

/**
 * Sends a Web Push Notification to a target user if category is enabled in user settings
 */
export async function sendPushNotificationToUser(
  userId: string,
  category: 'CHAT' | 'COMMUNITY_CHAT' | 'DM' | 'MENTION' | 'TASK' | 'DEADLINE' | 'ANNOUNCEMENT',
  payload: PushPayload
): Promise<void> {
  if (!userId) return;

  try {
    const settings = await getUserNotificationSettings(userId);

    // Check user preference toggle for this notification category
    if (category === 'CHAT' && settings.notify_chat === false) return;
    if (category === 'COMMUNITY_CHAT' && settings.notify_community_chat === false) return;
    if (category === 'DM' && settings.notify_dm === false) return;
    if (category === 'MENTION' && settings.notify_mention === false) return;
    if (category === 'TASK' && settings.notify_task === false) return;
    if (category === 'DEADLINE' && settings.notify_deadline === false) return;
    if (category === 'ANNOUNCEMENT' && settings.notify_announcement === false) return;

    const db = await getDB();
    const { results } = await db
      .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?')
      .bind(userId)
      .all();

    const subscriptions = (results as unknown as StoredSubscription[]) || [];
    if (subscriptions.length === 0) return;

    const sendPromises = subscriptions.map(async (sub) => {
      const res = await sendWebPushNotification(sub, { ...payload, category });
      if (res.shouldDelete) {
        await deletePushSubscription(sub.endpoint);
      }
    });

    await Promise.all(sendPromises);
  } catch (err) {
    console.error(`sendPushNotificationToUser failed for user ${userId}:`, err);
  }
}

/**
 * Sends Web Push Notification to multiple target users concurrently
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  category: 'CHAT' | 'COMMUNITY_CHAT' | 'MENTION' | 'TASK' | 'DEADLINE' | 'ANNOUNCEMENT',
  payload: PushPayload
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return;

  await Promise.all(
    uniqueUserIds.map((userId) => sendPushNotificationToUser(userId, category, payload))
  );
}
