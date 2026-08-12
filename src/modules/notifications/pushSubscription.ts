'use client';

// Default VAPID Public Key for Web Push (Valid base64url encoded VAPID public key)
export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BM3jcRVZP67OhZEmQj6RkbxTw4zKdH8trmmoeLBqKBBt0mkJftSEOpdtEMiTkBlwunaidCIvPLNhlC9HIDhKAoc';

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

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export function isIOSChrome(): boolean {
  if (typeof window === 'undefined') return false;
  return isIOS() && /CriOS/i.test(navigator.userAgent);
}

/**
 * Cross-browser wrapper for Notification.requestPermission
 * Handles both Promise-based and Callback-based implementations on iOS Safari
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  return new Promise((resolve) => {
    try {
      const promise = Notification.requestPermission((permission) => {
        resolve(permission);
      });
      if (promise && typeof promise.then === 'function') {
        promise.then(resolve).catch(() => resolve(Notification.permission));
      }
    } catch (e) {
      resolve(Notification.permission);
    }
  });
}

export interface PushSubscriptionState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  isIOS?: boolean;
  isStandalone?: boolean;
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
  const ios = isIOS();
  const standalone = isStandalone();

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      isSupported: false,
      permission: 'default',
      isSubscribed: false,
      subscription: null,
      isIOS: ios,
      isStandalone: standalone,
    };
  }

  const permission: NotificationPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'default';

  const registration = await registerServiceWorker();

  if (!registration || !registration.pushManager) {
    return {
      isSupported: 'Notification' in window,
      permission,
      isSubscribed: false,
      subscription: null,
      isIOS: ios,
      isStandalone: standalone,
    };
  }

  try {
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: Boolean(subscription),
      subscription,
      isIOS: ios,
      isStandalone: standalone,
    };
  } catch (e) {
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
      subscription: null,
      isIOS: ios,
      isStandalone: standalone,
    };
  }
}

/**
 * Subscribes current browser to Web Push
 */
export async function subscribeUserToPush(
  vapidPublicKey: string = DEFAULT_VAPID_PUBLIC_KEY
): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Web Push tidak didukung oleh peramban ini.' };
  }

  if (isIOSChrome()) {
    return {
      success: false,
      error: 'IOS_CHROME_RESTRICTION',
    };
  }

  if (isIOS() && !isStandalone()) {
    return {
      success: false,
      error: 'IOS_SAFARI_PWA_REQUIRED',
    };
  }

  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Izin notifikasi tidak diberikan oleh peramban.' };
    }

    if (!('serviceWorker' in navigator)) {
      return { success: false, error: 'Service worker tidak didukung.' };
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'Gagal mengaktifkan Service Worker.' };
    }

    if (!registration.pushManager) {
      if (isIOS() && !isStandalone()) {
        return {
          success: false,
          error:
            'Di iOS, buka menu Share (⎋) di Safari lalu pilih "Tambah ke Layar Utama" (Add to Home Screen) untuk mengaktifkan notifikasi push.',
        };
      }
      return { success: false, error: 'Push Manager belum didukung oleh peramban ini.' };
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
    if (!registration || !registration.pushManager) return { success: true };

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghentikan langganan notifikasi.' };
  }
}

