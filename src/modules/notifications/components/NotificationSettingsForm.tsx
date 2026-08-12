'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getPushSubscriptionState,
  subscribeUserToPush,
  unsubscribeUserFromPush,
  PushSubscriptionState,
} from '../pushSubscription';
import {
  savePushSubscription,
  deletePushSubscription,
  getUserNotificationSettings,
  updateUserNotificationSettings,
  UserNotificationSettings,
} from '../pushActions';

interface NotificationSettingsFormProps {
  initialSettings: UserNotificationSettings;
}

export default function NotificationSettingsForm({ initialSettings }: NotificationSettingsFormProps) {
  const [settings, setSettings] = useState<UserNotificationSettings>(initialSettings);
  const [pushState, setPushState] = useState<PushSubscriptionState>({
    isSupported: true,
    permission: 'default',
    isSubscribed: false,
    subscription: null,
    isIOS: false,
    isStandalone: false,
  });

  const [isPending, startTransition] = useTransition();
  const [pushLoading, setPushLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load browser push state on mount
  useEffect(() => {
    async function loadPushState() {
      const state = await getPushSubscriptionState();
      setPushState(state);
    }
    loadPushState();
  }, []);

  // Handle Push Notification Subscription Toggle
  const handleTogglePushDevice = async () => {
    setPushLoading(true);
    setMessage(null);

    try {
      if (pushState.isSubscribed && pushState.subscription) {
        const endpoint = pushState.subscription.endpoint;
        const res = await unsubscribeUserFromPush();
        if (res.success) {
          await deletePushSubscription(endpoint);
          const updatedState = await getPushSubscriptionState();
          setPushState(updatedState);
          setMessage({ type: 'success', text: 'Perangkat ini berhasil dinonaktifkan dari Push Notification.' });
        } else {
          setMessage({ type: 'error', text: res.error || 'Gagal menonaktifkan push.' });
        }
      } else {
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
          const updatedState = await getPushSubscriptionState();
          setPushState(updatedState);
          setMessage({ type: 'success', text: '🔔 Notifikasi Push aktif! Anda akan menerima notifikasi walau website ditutup.' });
        } else {
          setMessage({ type: 'error', text: res.error || 'Gagal mengaktifkan notifikasi push pada perangkat.' });
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setPushLoading(false);
    }
  };

  // Handle Setting Category Toggle
  const handleToggleSetting = (key: keyof UserNotificationSettings) => {
    const newValue = !settings[key];
    const updated = { ...settings, [key]: newValue };
    setSettings(updated);
    setMessage(null);

    startTransition(async () => {
      const res = await updateUserNotificationSettings({ [key]: newValue });
      if (res.success) {
        setMessage({ type: 'success', text: 'Pengaturan notifikasi berhasil diperbarui.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Gagal memperbarui pengaturan.' });
        // Revert UI on error
        setSettings(settings);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert / Feedback message */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold transition-all animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Device Web Push Status Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-900/10 via-indigo-900/5 to-transparent border border-purple-500/20 dark:border-purple-500/30 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-xl">📲</span>
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                Push Notification Perangkat
              </h3>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  pushState.isSubscribed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : pushState.permission === 'denied'
                    ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                }`}
              >
                {pushState.isSubscribed
                  ? 'Aktif Pada HP/Desktop Ini'
                  : pushState.permission === 'denied'
                  ? 'Izin Terblokir'
                  : 'Belum Diaktifkan'}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Aktifkan push notification di browser Anda untuk menerima pemberitahuan penting (chat, mention, deadline, dan tugas baru) bahkan ketika aplikasi KIAN HQ sedang tidak Anda buka.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTogglePushDevice}
            disabled={pushLoading || !pushState.isSupported || pushState.permission === 'denied'}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 ${
              pushState.isSubscribed
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-red-500/10 hover:text-red-600 border border-zinc-300 dark:border-zinc-700'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/25'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {pushLoading ? (
              <span>Memproses...</span>
            ) : pushState.isSubscribed ? (
              <span>Matikan Di Perangkat Ini</span>
            ) : (
              <span>🔔 Aktifkan Notifikasi Perangkat</span>
            )}
          </button>
        </div>

        {pushState.permission === 'denied' && (
          <p className="text-[11px] font-bold text-red-500 dark:text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
            ⚠️ Izin notifikasi terblokir di peramban Anda. Silakan buka Pengaturan Situs (Site Settings) pada browser untuk memberikan izin notifikasi ke platform.
          </p>
        )}
      </div>

      {/* Category Preferences Settings List */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 space-y-6 shadow-sm">
        <div>
          <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 mb-1">
            Kategori Notifikasi
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pilih jenis pemberitahuan yang ingin Anda terima di akun Anda.
          </p>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {/* 1. Chat Workspace */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>💬</span> Pesan Room Chat Workspace
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Terima notifikasi saat ada pesan baru dikirim di room chat workspace tempat Anda bergabung.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('notify_chat')}
              disabled={isPending}
              className={`w-12 h-6 rounded-full transition-colors relative border shrink-0 ${
                settings.notify_chat
                  ? 'bg-purple-600 border-purple-500'
                  : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.notify_chat ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Mention */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🏷️</span> Mention / Sebutan Nama Saya
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Terima notifikasi saat pengguna lain menyebut nama atau username Anda di pesan atau diskusi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('notify_mention')}
              disabled={isPending}
              className={`w-12 h-6 rounded-full transition-colors relative border shrink-0 ${
                settings.notify_mention
                  ? 'bg-purple-600 border-purple-500'
                  : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.notify_mention ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Task & Assessment */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📋</span> Tugas & Assessment Baru
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Terima notifikasi saat tugas atau brief assessment baru dibuat dan di-assign ke Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('notify_task')}
              disabled={isPending}
              className={`w-12 h-6 rounded-full transition-colors relative border shrink-0 ${
                settings.notify_task
                  ? 'bg-purple-600 border-purple-500'
                  : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.notify_task ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 4. Deadline */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>⏰</span> Pengingat Tenggat Waktu (Deadline)
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Terima pemberitahuan pengingat menjelang batas waktu penyerahan tugas Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('notify_deadline')}
              disabled={isPending}
              className={`w-12 h-6 rounded-full transition-colors relative border shrink-0 ${
                settings.notify_deadline
                  ? 'bg-purple-600 border-purple-500'
                  : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.notify_deadline ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 5. Announcements */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📢</span> Pengumuman Resmi Platform
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Terima pemberitahuan langsung saat pengumuman resmi atau informasi siaran baru dipublikasikan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('notify_announcement')}
              disabled={isPending}
              className={`w-12 h-6 rounded-full transition-colors relative border shrink-0 ${
                settings.notify_announcement
                  ? 'bg-purple-600 border-purple-500'
                  : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.notify_announcement ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
