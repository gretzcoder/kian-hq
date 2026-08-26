import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { redirect } from 'next/navigation';
import { getStorageSettings } from '@/modules/storage/actions';
import StorageSettingsForm from './StorageSettingsForm';

export default async function StorageSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);
  const isCoordinator =
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') ||
        ctx.roles.includes('EXECUTIVE') ||
        ctx.can('MANAGE') ||
        ctx.can('WORKSPACE_MANAGE'))) ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  if (!isCoordinator) {
    redirect('/dashboard');
  }

  const settings = await getStorageSettings();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-purple-600/10 to-indigo-900/40 border border-purple-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">☁️</span>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
                Pengaturan Storage Kian HQ
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 max-w-2xl leading-relaxed">
              Hubungkan akun **Google Drive (Service Account)** untuk menyimpan hasil karya pengguna (Desain, Video, Dokumen) dan aset gambar foto profil secara otomatis ke folder terpilih.
            </p>
          </div>

          <div className="shrink-0">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black border ${
                settings.gdrive_enabled && settings.is_configured
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${settings.gdrive_enabled && settings.is_configured ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
              {settings.gdrive_enabled && settings.is_configured ? 'Google Drive Aktif' : 'Belum Aktif'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <StorageSettingsForm initialSettings={settings} />
    </div>
  );
}
