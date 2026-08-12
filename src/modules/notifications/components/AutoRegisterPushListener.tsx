'use client';

import { useEffect, useState } from 'react';
import {
  getPushSubscriptionState,
  subscribeUserToPush,
  isIOS,
  isStandalone,
  isIOSChrome,
} from '../pushSubscription';
import { savePushSubscription } from '../pushActions';
import IOSGuideModal from './IOSGuideModal';

export default function AutoRegisterPushListener() {
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);
  const [isChromeIOS, setIsChromeIOS] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  useEffect(() => {
    async function initPush() {
      if (typeof window === 'undefined') return;

      const ios = isIOS();
      const standalone = isStandalone();
      const chromeIOS = isIOSChrome();

      setIsIOSBrowser(ios && !standalone);
      setIsChromeIOS(chromeIOS);

      const state = await getPushSubscriptionState();

      if (state.permission === 'granted' && !chromeIOS && (standalone || !ios)) {
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
        state.permission !== 'granted' &&
        !sessionStorage.getItem('push_banner_dismissed')
      ) {
        setShowBanner(true);
      }
    }

    initPush();
  }, []);

  const handleEnable = async () => {
    if (isChromeIOS || (isIOSBrowser && !isStandalone())) {
      setGuideModalOpen(true);
      return;
    }

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
        if (res.error === 'IOS_CHROME_RESTRICTION') {
          setIsChromeIOS(true);
          setGuideModalOpen(true);
        } else if (res.error === 'IOS_SAFARI_PWA_REQUIRED') {
          setGuideModalOpen(true);
        } else {
          setErrorMessage(res.error);
        }
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

  return (
    <>
      <IOSGuideModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        isChrome={isChromeIOS}
      />

      {showBanner && !dismissed && (
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md z-40 relative">
          <div className="flex items-center gap-2.5 font-medium max-w-3xl">
            <span className="text-base shrink-0 animate-bounce">🔔</span>
            <div>
              <span>
                Aktifkan <strong>Notifikasi HP / Push Notification</strong> agar tidak ketinggalan mention &amp; update tugas penting!
              </span>
              {isChromeIOS ? (
                <p className="text-[11px] text-amber-200 font-bold mt-0.5">
                  🍎 <em>Pengguna Chrome di iPhone:</em> Apple mewajibkan penggunaan peramban <strong>Safari</strong> untuk notifikasi HP &amp; Layar Utama.
                </p>
              ) : isIOSBrowser ? (
                <p className="text-[11px] opacity-90 font-normal mt-0.5">
                  📲 <em>Pengguna iOS Safari:</em> Buka menu Share (⎋) di Safari &amp; pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong> (Add to Home Screen).
                </p>
              ) : null}
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
              className="bg-white text-purple-700 hover:bg-zinc-100 font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 text-[11px] cursor-pointer flex items-center gap-1.5"
            >
              <span>{loading ? 'Mengizinkan...' : isChromeIOS ? '🧭 Caranya / Safari' : 'Izinkan Notifikasi'}</span>
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
      )}
    </>
  );
}
