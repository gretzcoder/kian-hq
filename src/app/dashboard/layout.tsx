import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';
import DashboardSidebar from './components/DashboardSidebar';

import OnboardingModal from '@/modules/profile/components/OnboardingModal';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/');
  }

  const db = await getDB();

  // Check if onboarding is completed
  const userRow = await db
    .prepare('SELECT onboarding_completed FROM users WHERE id = ?')
    .bind(session.userId)
    .first() as { onboarding_completed: number } | null;

  const showOnboarding = userRow ? userRow.onboarding_completed === 0 : false;

  // Batch-fetch all needed permission flags in one call
  const ctx = await getSessionContext(session.userId);
  const canManage      = ctx.can('MANAGE');
  const canReview      = ctx.can('APPROVE') || ctx.can('REQUEST_REVISION');
  const canCreateBrief = ctx.can('CREATE_BRIEF') || ctx.can('APPROVE_BRIEF') || ctx.can('SUBMIT_BRIEF') || ctx.can('REQUEST_CHANGES') || ctx.can('UNLOCK_BRIEF');
  const canUseAI       = ctx.can('USE_AI');
  const isOJT          = ctx.userType === 'OJT';

  // Detect if OJT user is a project mentor (for simplified nav)
  let isMentor = false;
  if (isOJT) {
    const mentorRow = await db
      .prepare('SELECT 1 FROM project_coordinators WHERE user_id = ? LIMIT 1')
      .bind(session.userId)
      .first();
    isMentor = !!mentorRow;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-zinc-100 font-sans flex flex-col lg:flex-row transition-colors duration-350">
      {/* Onboarding Modal Overlay */}
      {showOnboarding && <OnboardingModal initialName={session.name} />}

      {/* Left Sidebar Navigation */}
      <DashboardSidebar
        canManage={canManage}
        canReview={canReview}
        canCreateBrief={canCreateBrief}
        canUseAI={canUseAI}
        isOJT={isOJT}
        isMentor={isMentor}
        isLocked={showOnboarding}
        session={{
          name: session.name,
          email: session.email,
          avatar: session.avatar,
        }}
      />

      {/* Main Content Area — Fluid Full Width */}
      <main className="flex-1 w-full px-6 sm:px-10 py-6 min-w-0 flex flex-col">
        {/* Top Floating Control Bar */}
        <div className="hidden lg:flex items-center justify-end pb-3 mb-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
          <ThemeToggle />
        </div>

        {children}
      </main>
    </div>
  );
}
