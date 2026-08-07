import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getUserNotificationSettings } from '@/modules/notifications/pushActions';
import NotificationSettingsForm from '@/modules/notifications/components/NotificationSettingsForm';

export default async function NotificationSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const initialSettings = await getUserNotificationSettings(session.userId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
          Pengaturan Notifikasi
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Kelola pemberitahuan Web Push pada perangkat Anda serta pilih kategori notifikasi yang ingin Anda terima.
        </p>
      </div>

      {/* Settings Form */}
      <NotificationSettingsForm initialSettings={initialSettings} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
