import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import { getExecutiveFeedbacks } from '@/modules/feedback/actions';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';

export default async function FeedbacksPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);

  // Allow users with ADMIN_USERS permission
  const canViewFeedbacks = ctx.can('ADMIN_USERS') || ctx.can('ADMIN_SYSTEM');
  if (!canViewFeedbacks) redirect('/dashboard');

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
            <div key={fb.id} className={`${card} p-5 space-y-3 hover:border-purple-500/30 transition-all`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Link href={`/dashboard/profile?userId=${fb.user_id}`} className="shrink-0">
                    <UserAvatar src={fb.user_avatar} name={fb.user_name} size="w-9 h-9 text-xs font-black" square />
                  </Link>
                  <div>
                    <Link
                      href={`/dashboard/profile?userId=${fb.user_id}`}
                      className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    >
                      {fb.user_name}
                    </Link>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{fb.user_email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-lg">
                    {fb.category}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(fb.created_at * 1000).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {fb.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
