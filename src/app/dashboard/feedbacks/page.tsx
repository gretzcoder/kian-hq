import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import { getExecutiveFeedbacks } from '@/modules/feedback/actions';
import FeedbackCardItem from './components/FeedbackCardItem';

export default async function FeedbacksPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);

  // Check if current user has Sparks management rights
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));
  const canManageSparks =
    ctx.can('SPARKS_MANAGE') ||
    isCoordinator ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.can('ADMIN_USERS');

  const feedbacks = await getExecutiveFeedbacks();

  const card = 'bg-white dark:bg-[#09090b]/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            Kritik & Saran Tim
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Daftar masukan, saran, dan kendala yang dikirimkan oleh anggota tim.
          </p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-2xl text-xs font-bold text-purple-700 dark:text-purple-300">
          Total {feedbacks.length} Pesan
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <div className={`${card} p-12 text-center text-zinc-500 text-sm`}>
          Belum ada kritik & saran yang masuk dari anggota.
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((fb) => (
            <FeedbackCardItem
              key={fb.id}
              feedback={fb}
              currentUserId={session.userId}
              canManageSparks={canManageSparks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
