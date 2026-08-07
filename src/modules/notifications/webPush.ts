import webpush from 'web-push';

// Default VAPID key pair for development fallback
const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv6b2A-nK2v12V0q_0v14YwR_J5aJ6V3s_J7b5v6c7d8e9f0g1h2i3';

const DEFAULT_VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@kianhq.com';

let isVapidInitialized = false;

function initVapid() {
  if (isVapidInitialized) return;
  try {
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      DEFAULT_VAPID_PUBLIC_KEY,
      DEFAULT_VAPID_PRIVATE_KEY
    );
    isVapidInitialized = true;
  } catch (err) {
    console.error('Failed to initialize VAPID details for Web Push:', err);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  category?: 'CHAT' | 'MENTION' | 'TASK' | 'DEADLINE' | 'ANNOUNCEMENT' | 'GENERAL';
  tag?: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends a web push notification payload to a stored browser subscription
 */
export async function sendWebPushNotification(
  subscription: StoredSubscription,
  payload: PushPayload
): Promise<{ success: boolean; shouldDelete?: boolean; error?: string }> {
  initVapid();

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    url: payload.url || '/dashboard',
    category: payload.category || 'GENERAL',
    tag: payload.tag || undefined,
  });

  try {
    await webpush.sendNotification(pushSubscription, payloadString, {
      TTL: 86400, // 24 hours retention on push service
    });
    return { success: true };
  } catch (err: any) {
    // If endpoint is expired or unregistered (404/410), mark subscription for deletion
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      return { success: false, shouldDelete: true, error: 'Subscription expired or unregistered' };
    }
    console.error('sendWebPushNotification error:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to deliver web push' };
  }
}
