import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';
import DashboardSidebar from './components/DashboardSidebar';
import TimeGreeting from './components/TimeGreeting';
import OnboardingModal from '@/modules/profile/components/OnboardingModal';
import ViewAsRoleBanner from '@/modules/roles/components/ViewAsRoleBanner';
import ImpersonationBanner from '@/modules/users/components/ImpersonationBanner';
import {
  isAuthorizedForViewAs,
  getAvailableRolesForViewAs,
  getActiveSimulatedRole,
} from '@/modules/roles/viewAsRoleActions';
import { getAvailableUsersForImpersonation } from '@/modules/users/impersonationActions';

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
  const isGlobalWorkspaceManager =
    ctx.userType === 'STAFF' || ctx.can('WORKSPACE_MANAGE') || ctx.can('MANAGE');
  const canReview    = ctx.can('TASK_REVIEW');
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.can('MANAGE') || ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE'));

  // Resolve View As Role & Impersonation simulation options
  const isAuthorizedForViewAsRole = await isAuthorizedForViewAs();
  const activeSimulatedRole = await getActiveSimulatedRole();
  const availableRoles = isAuthorizedForViewAsRole ? await getAvailableRolesForViewAs() : [];
  const availableUsers = isAuthorizedForViewAsRole ? await getAvailableUsersForImpersonation() : [];

  // Fetch onboarding status, avatar, and all badge seed data in one parallel batch
  const [userRow, annRaw, wsDataRaw, reviewCountRaw] = await Promise.all([
    db
      .prepare('SELECT onboarding_completed, avatar_url FROM users WHERE id = ?')
      .bind(session.userId)
      .first() as Promise<{ onboarding_completed: number; avatar_url: string | null } | null>,

    // All announcement timestamps — no LIMIT (accurate badge count)
    db
      .prepare('SELECT created_at FROM announcements ORDER BY created_at DESC')
      .all() as Promise<{ results: { created_at: number }[] }>,

    // Per-workspace latest activity (workspace / tasks / chat / task assignments)
    (isGlobalWorkspaceManager || ctx.roles.some((r) => r.toUpperCase().includes('MENTOR')))
      ? (db
          .prepare(
            `SELECT ws.id AS wsId,
               MAX(
                 ws.created_at,
                 COALESCE((SELECT MAX(created_at) FROM tasks WHERE workspace_id = ws.id), 0),
                 COALESCE((SELECT MAX(created_at) FROM workspace_chats WHERE workspace_id = ws.id), 0),
                 COALESCE((SELECT MAX(ta.created_at) FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE t.workspace_id = ws.id), 0)
               ) AS latestTs
             FROM workspaces ws
             WHERE ws.deleted_at IS NULL`
          )
          .all() as Promise<{ results: { wsId: string; latestTs: number }[] }>)
      : (db
          .prepare(
            `SELECT ws.id AS wsId,
               MAX(
                 ws.created_at,
                 COALESCE((SELECT MAX(created_at) FROM tasks WHERE workspace_id = ws.id), 0),
                 COALESCE((SELECT MAX(created_at) FROM workspace_chats WHERE workspace_id = ws.id), 0),
                 COALESCE((SELECT MAX(ta.created_at) FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE t.workspace_id = ws.id AND ta.user_id = ?), 0)
               ) AS latestTs
             FROM workspaces ws
             WHERE ws.deleted_at IS NULL
               AND (
                 EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ws.id AND user_id = ?)
                 OR ws.ojt_coordinator_id = ?
                 OR ws.workspace_type = 'ASSESSMENT'
               )`
          )
          .bind(session.userId, session.userId, session.userId)
          .all() as Promise<{ results: { wsId: string; latestTs: number }[] }>),

    // Pending review count — skipped if user has no TASK_REVIEW permission
    canReview
      ? (db
          .prepare(
            `SELECT COUNT(DISTINCT ta.id) AS cnt
             FROM task_assignments ta
             JOIN tasks t ON ta.task_id = t.id
             WHERE ta.status = 'WAITING_REVIEW'
               AND (
                 (
                   EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = t.workspace_id AND user_id = ? AND team_role = 'LEADER')
                   AND ta.lead_approved = 0
                 )
                 OR (
                   EXISTS (SELECT 1 FROM workspaces WHERE id = t.workspace_id AND ojt_coordinator_id = ?)
                   AND ta.mentor_approved = 0
                 )
                 OR (? AND ta.coordinator_approved = 0)
               )`
          )
          .bind(session.userId, session.userId, isCoordinator ? 1 : 0)
          .first() as Promise<{ cnt: number } | null>)
      : Promise.resolve(null),
  ]);

  const showOnboarding    = userRow ? userRow.onboarding_completed === 0 : false;
  const userAvatar        = userRow?.avatar_url || session.avatar || null;
  const announcementTimestamps = (annRaw.results || []).map((r) => r.created_at);
  const workspaceData     = (wsDataRaw.results || []).map((r) => ({ wsId: r.wsId, latestTs: r.latestTs }));
  const pendingReviewCount = canReview ? (Number((reviewCountRaw as any)?.cnt) || 0) : 0;

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
    <div className="min-h-screen bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-zinc-100 font-sans flex flex-col transition-colors duration-350">
      {/* User Impersonation Banner */}
      {session.isImpersonating && (
        <ImpersonationBanner
          impersonatedName={session.name}
          impersonatedEmail={session.email}
          realAdminName={session.realUserName}
        />
      )}

      {/* View As Role Top Simulation Banner */}
      <ViewAsRoleBanner
        activeSimulatedRole={activeSimulatedRole}
        availableRoles={availableRoles}
        isAuthorized={isAuthorizedForViewAsRole}
      />

      <div className="flex-1 w-full flex flex-col lg:flex-row min-w-0">
        {/* Onboarding Modal Overlay */}
        {showOnboarding && (
          <OnboardingModal
            initialName={session.name}
            isStaff={ctx.userType === 'STAFF'}
            isImpersonating={session.isImpersonating}
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
          isOJT={isOJT}
          isMentor={isMentor}
          isLocked={showOnboarding}
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
        <main className="flex-1 w-full px-6 sm:px-10 py-6 min-w-0 flex flex-col">
          {/* Top Floating Control Bar */}
          <div className="hidden lg:flex items-center justify-between pb-3 mb-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
            <TimeGreeting />
            <ThemeToggle />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
