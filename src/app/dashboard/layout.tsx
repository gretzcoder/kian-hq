import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';
import DashboardSidebar from './components/DashboardSidebar';
import TimeGreeting from './components/TimeGreeting';
import OnboardingModal from '@/modules/profile/components/OnboardingModal';
import { FeatureTourModal } from '@/modules/profile/components/FeatureTourModal';
import ViewAsRoleBanner from '@/modules/roles/components/ViewAsRoleBanner';
import ImpersonationBanner from '@/modules/users/components/ImpersonationBanner';
import FloatingNotificationDrawer from '@/modules/notifications/components/FloatingNotificationDrawer';
import AutoRegisterPushListener from '@/modules/notifications/components/AutoRegisterPushListener';
import HeaderProfileButton from './components/HeaderProfileButton';
import HeaderMessengerButton from './components/HeaderMessengerButton';
import { FloatingMessengerProvider } from '@/modules/direct-messages/components/FloatingMessengerContext';
import { FloatingMessengerWidget } from '@/modules/direct-messages/components/FloatingMessengerWidget';
import {
  isAuthorizedForViewAs,
  getAvailableRolesForViewAs,
  getActiveSimulatedRole,
} from '@/modules/roles/viewAsRoleActions';
import { getAvailableUsersForImpersonation } from '@/modules/users/impersonationActions';

import { SparksMultiplierFloatingBadge } from '@/components/SparksMultiplierFloatingBadge';

import { getSidebarCounts } from '@/modules/notifications/notificationActions';

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

  // Resolve permission flags first — needed to scope queries below
  const ctx = await getSessionContext(session.userId);
  const canReview    = ctx.can('TASK_REVIEW');
  const isCoordinator =
    (ctx.userType === 'STAFF' &&
      (ctx.can('MANAGE') || ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('WORKSPACE_MANAGE'))) ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.can('WORKSPACE_MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');
  const canManageSparks = ctx.can('SPARKS_MANAGE') || isCoordinator || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');

  // Resolve View As Role & Impersonation simulation options
  const isAuthorizedForViewAsRole = await isAuthorizedForViewAs();
  const activeSimulatedRole = await getActiveSimulatedRole();
  const availableRoles = isAuthorizedForViewAsRole ? await getAvailableRolesForViewAs() : [];
  const availableUsers = isAuthorizedForViewAsRole ? await getAvailableUsersForImpersonation() : [];

  // Fetch onboarding status, avatar, and all sidebar count data in one parallel batch
  const [userRow, sidebarCounts] = await Promise.all([
    db
      .prepare('SELECT onboarding_completed, feature_tour_completed, avatar_url FROM users WHERE id = ?')
      .bind(session.userId)
      .first() as Promise<{ onboarding_completed: number; feature_tour_completed?: number; avatar_url: string | null } | null>,

    getSidebarCounts(),
  ]);

  const showProfileOnboarding = userRow ? userRow.onboarding_completed === 0 : false;
  const showFeatureTour       = userRow ? userRow.onboarding_completed === 1 && (userRow.feature_tour_completed === 0 || !userRow.feature_tour_completed) : false;
  const isDashboardLocked     = showProfileOnboarding || showFeatureTour;

  const userAvatar        = userRow?.avatar_url || session.avatar || null;
  const announcementTimestamps = sidebarCounts?.announcementTimestamps || [];
  const workspaceData     = sidebarCounts?.workspaceData || [];
  const pendingReviewCount = sidebarCounts?.pendingReviewCount || 0;

  // Remaining permission flags
  const canManageUsers  = ctx.can('ADMIN_USERS');
  const canManageRoles  = ctx.can('ADMIN_ROLES');
  const canViewOJT      = ctx.can('VIEW_OJT_DATA');
  const canCreateBrief  = ctx.can('BRIEF_CREATE') || ctx.can('BRIEF_REVIEW');
  const canUseAI        = ctx.can('USE_AI');
  const canViewProjects = ctx.can('PROJECT_CREATE') || ctx.can('PROJECT_MANAGE');
  const isOJT           = ctx.userType === 'OJT';

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
    <FloatingMessengerProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-zinc-100 font-sans flex flex-col transition-colors duration-350 overflow-x-hidden w-full relative">
        <AutoRegisterPushListener />
        {/* Floating Sparks Multiplier Live Badge for all users */}
        <SparksMultiplierFloatingBadge />

        {/* User Impersonation Banner */}
        {session.isImpersonating && (
          <ImpersonationBanner
            impersonatedName={session.name}
            impersonatedEmail={session.email}
            realAdminName={session.realUserName}
            currentUserId={session.userId}
            availableUsers={availableUsers}
          />
        )}

        {/* View As Role Top Simulation Banner */}
        <ViewAsRoleBanner
          activeSimulatedRole={activeSimulatedRole}
          availableRoles={availableRoles}
          isAuthorized={isAuthorizedForViewAsRole}
        />

        <div className="flex-1 w-full flex flex-col lg:flex-row min-w-0 pt-14 lg:pt-0">
          {/* Step 1: Initial Profile Onboarding Modal Overlay */}
          {showProfileOnboarding && (
            <OnboardingModal
              initialName={session.name}
              isStaff={ctx.userType === 'STAFF'}
              isImpersonating={session.isImpersonating}
            />
          )}

          {/* Step 2: Feature Tour Onboarding Modal Overlay (Mandatory 1x, Non-skippable) */}
          {!showProfileOnboarding && showFeatureTour && (
            <FeatureTourModal
              userName={session.name}
              userType={ctx.userType}
              roles={ctx.roles}
              permissions={Array.from(ctx.permissions)}
              isMentor={isMentor}
            />
          )}

          {/* Left Sidebar Navigation */}
          <DashboardSidebar
            canManageUsers={canManageUsers}
            canManageRoles={canManageRoles}
            canViewOJT={canViewOJT}
            canViewProjects={canViewProjects}
            canReview={canReview}
            canCreateBrief={canCreateBrief}
            canUseAI={canUseAI}
            canManageSparks={canManageSparks}
            isOJT={isOJT}
            isMentor={isMentor}
            isLocked={isDashboardLocked}
            announcementTimestamps={announcementTimestamps}
            workspaceData={workspaceData}
            pendingReviewCount={pendingReviewCount}
            availableRoles={availableRoles}
            availableUsers={availableUsers}
            activeSimulatedRole={activeSimulatedRole}
            isImpersonating={session.isImpersonating}
            session={{
              name: session.name,
              email: session.email,
              avatar: userAvatar,
            }}
          />

          {/* Main Content Area */}
          <main className="flex-1 w-full min-w-0 flex flex-col overflow-x-hidden">
            {/* FIXED TOP NAVBAR (Always visible on scroll for Desktop) */}
            <header className="hidden lg:flex sticky top-0 z-40 bg-zinc-50/90 dark:bg-[#030303]/90 backdrop-blur-md px-4 sm:px-6 md:px-10 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs items-center justify-between">
              <TimeGreeting />
              <div className="flex items-center gap-2.5 sm:gap-3">
                <HeaderMessengerButton />
                <FloatingNotificationDrawer
                  canReview={canReview}
                  canManageSparks={canManageSparks}
                  canCreateBrief={canCreateBrief}
                />
                <ThemeToggle />
                <HeaderProfileButton name={session.name} email={session.email} avatar={userAvatar} />
              </div>
            </header>

            <div className="px-1 sm:px-6 md:px-10 py-4 flex-1">
              {children}
            </div>
          </main>
        </div>

        {/* Realtime Floating Messenger Chat Widget */}
        <FloatingMessengerWidget />
      </div>
    </FloatingMessengerProvider>
  );
}
