'use client';

import { useEffect, useState } from 'react';
import {
  getPushSubscriptionState,
  subscribeUserToPush,
  isIOS,
  isStandalone,
} from '../pushSubscription';
import { savePushSubscription } from '../pushActions';

export default function AutoRegisterPushListener() {
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);

  useEffect(() => {
    async function initPush() {
      if (typeof window === 'undefined') return;

      const ios = isIOS();
      const standalone = isStandalone();
      setIsIOSBrowser(ios && !standalone);

      const state = await getPushSubscriptionState();

      if (state.permission === 'granted') {
        // Auto subscribe/sync subscription endpoint to DB if permission is granted
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
      } else if (
        state.permission === 'default' &&
        !sessionStorage.getItem('push_banner_dismissed')
      ) {
        setShowBanner(true);
      }
    }

    initPush();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setErrorMessage(null);

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
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (e: any) {
      console.error('Enable push failed:', e);
      setErrorMessage(e?.message || 'Gagal mengaktifkan notifikasi.');
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
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md z-50 relative">
      <div className="flex items-center gap-2 font-medium max-w-3xl">
        <span className="text-base shrink-0">🔔</span>
        <div>
          <span>
            Aktifkan <strong>Notifikasi HP / Push Notification</strong> agar tidak ketinggalan mention & update tugas penting!
          </span>
          {isIOSBrowser && (
            <p className="text-[11px] opacity-90 font-normal mt-0.5">
              📲 <em>Pengguna iOS:</em> Buka menu Share (⎋) di Safari & pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong> (Add to Home Screen) untuk pengiriman notifikasi instan.
            </p>
          )}
          {errorMessage && (
            <p className="text-[11px] text-amber-200 font-bold mt-1 bg-black/20 px-2 py-0.5 rounded">
              ⚠️ {errorMessage}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="bg-white text-purple-700 font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-all shadow-xs active:scale-95 text-[11px] cursor-pointer"
        >
          {loading ? 'Mengizinkan...' : 'Izinkan Notifikasi'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-white/80 hover:text-white text-sm font-bold px-1.5 cursor-pointer"
          title="Tutup"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

