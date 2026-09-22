import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import AvailabilityViewWrapper from '@/modules/availability/components/AvailabilityViewWrapper';

export const metadata = {
  title: 'Availability & Schedule Tracker | KIAN HQ',
  description: 'Sistem pemantauan jadwal kuliah, janji temu / kegiatan, dan ketersediaan penugasan tim KIAN.',
};

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);
  
  const isExplicitAdminOrCoordinator =
    ctx.roles.some((r) => {
      const u = r.toUpperCase();
      return u === 'COORDINATOR' || u === 'EXECUTIVE' || u.includes('COORDINATOR') || u.includes('EXECUTIVE');
    }) ||
    ctx.can('ADMIN_SYSTEM') ||
    ctx.can('ADMIN_USERS') ||
    ctx.can('AVAILABILITY_MANAGE');

  const isTrooperOrMentorRole = ctx.roles.some((r) => {
    const u = r.toUpperCase();
    return u.includes('TROOPER') || u.includes('MENTOR') || u.includes('OJT') || u.includes('TRAINING');
  });

  // Only Admin or Coordinator (or with AVAILABILITY_MANAGE permission) can configure availability exclusions & management settings
  const isStaffOrManager =
    isExplicitAdminOrCoordinator ||
    (ctx.userType === 'STAFF' && !isTrooperOrMentorRole && ctx.can('MANAGE'));

  return (
    <div className="space-y-6 pb-14 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Availability Tracker
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent mt-1">
            User Availability & Jadwal Tim
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Pantau jadwal perkuliahan semester, agenda kegiatan pribadi, dan ketersediaan seluruh personil untuk alokasi tugas & event KIAN.
          </p>
        </div>
      </div>

      {/* Main Interactive Views */}
      <AvailabilityViewWrapper
        currentUserId={session.userId}
        currentUserName={session.name}
        isStaffOrManager={isStaffOrManager}
      />
    </div>
  );
}
