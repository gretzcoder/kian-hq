'use client';

// Default VAPID Public Key for Web Push (Valid base64url encoded VAPID public key)
export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv6b2A-nK2v12V0q_0v14YwR_J5aJ6V3s_J7b5v6c7d8e9f0g1h2i3';

/**
 * Utility to convert base64 String to Uint8Array for PushManager subscribe
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushSubscriptionState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
}

/**
 * Registers Service Worker if available
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Checks current push subscription status
 */
export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return {
      isSupported: false,
      permission: 'default',
      isSubscribed: false,
      subscription: null,
    };
  }

  const permission = Notification.permission;
  const registration = await registerServiceWorker();

  if (!registration) {
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
      subscription: null,
    };
  }

  const subscription = await registration.pushManager.getSubscription();

  return {
    isSupported: true,
    permission,
    isSubscribed: Boolean(subscription),
    subscription,
  };
}

/**
 * Subscribes current browser to Web Push
 */
export async function subscribeUserToPush(
  vapidPublicKey: string = DEFAULT_VAPID_PUBLIC_KEY
): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'Web Push tidak didukung oleh peramban ini.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Izin notifikasi tidak diberikan oleh pengguna.' };
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'Gagal merestorasi Service Worker.' };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.error('subscribeUserToPush error:', err);
    return { success: false, error: err?.message || 'Gagal mendaftar notifikasi push.' };
  }
}

/**
 * Unsubscribes current browser from Web Push
 */
export async function unsubscribeUserFromPush(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { success: false, error: 'Service worker tidak didukung.' };
  }

  try {
    const registration = await registerServiceWorker();
    if (!registration) return { success: true };

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghentikan langganan notifikasi.' };
  }
}
