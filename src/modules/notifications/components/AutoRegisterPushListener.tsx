'use client';

import { useEffect, useState } from 'react';
import {
  getPushSubscriptionState,
  subscribeUserToPush,
} from '../pushSubscription';
import { savePushSubscription } from '../pushActions';

export default function AutoRegisterPushListener() {
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function initPush() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      const state = await getPushSubscriptionState();

      if (state.permission === 'granted') {
        // Auto subscribe/sync subscription endpoint to DB
        try {
          const res = await subscribeUserToPush();
          if (res.success && res.subscription) {
            const subJSON = res.subscription.toJSON();
            if (subJSON.endpoint && subJSON.keys?.p256dh && subJSON.keys?.auth) {
              await savePushSubscription({
                endpoint: subJSON.endpoint,
                keys: {
                  p256dh: subJSON.keys.p256dh,
                  auth: subJSON.keys.auth,
                },
              });
            }
          }
        } catch (e) {
          console.error('Auto-sync push subscription failed:', e);
        }
      } else if (state.permission === 'default' && !sessionStorage.getItem('push_banner_dismissed')) {
        setShowBanner(true);
      }
    }

    initPush();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await subscribeUserToPush();
      if (res.success && res.subscription) {
        const subJSON = res.subscription.toJSON();
        if (subJSON.endpoint && subJSON.keys?.p256dh && subJSON.keys?.auth) {
          await savePushSubscription({
            endpoint: subJSON.endpoint,
            keys: {
              p256dh: subJSON.keys.p256dh,
              auth: subJSON.keys.auth,
            },
          });
        }
        setShowBanner(false);
      }
    } catch (e) {
      console.error('Enable push failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    sessionStorage.setItem('push_banner_dismissed', '1');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md z-50">
      <div className="flex items-center gap-2 font-medium">
        <span className="text-base">🔔</span>
        <span>Aktifkan <strong>Notifikasi HP / Push Notification</strong> agar tidak ketinggalan mention & update tugas penting!</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="bg-white text-purple-700 font-bold px-3 py-1 rounded-lg hover:bg-zinc-100 transition-all shadow-xs active:scale-95 text-[11px]"
        >
          {loading ? 'Mengizinkan...' : 'Izinkan Notifikasi'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-white/80 hover:text-white text-sm font-bold px-1.5"
          title="Tutup"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
