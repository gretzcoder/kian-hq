import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/modules/roles/rbac';
import { createAnnouncement } from '@/modules/announcements/actions';
import { getLeaderboardData, LeaderboardUser } from '@/modules/leaderboard/actions';
import DashboardStats from './components/DashboardStats';
import DashboardQCReviews, { QCReviewItem } from './components/DashboardQCReviews';
import DashboardPersonalWorkspace from './components/DashboardPersonalWorkspace';
import DashboardAnnouncements from './components/DashboardAnnouncements';
import DashboardQuickActions from './components/DashboardQuickActions';
import BroadcastAnnouncement from './components/BroadcastAnnouncement';
import DashboardMiniLeaderboard from './components/DashboardMiniLeaderboard';
import DashboardFeedbackCard from './components/DashboardFeedbackCard';
import TimeGreeting from './components/TimeGreeting';

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  created_at: number;
}

interface PersonalTaskRow {
  id: string;
  project_id: string;
  workspace_id: string | null;
  title: string;
  status: string;
  deadline: number | null;
  project_name: string;
  assigned_name?: string | null;
  assignment_role?: string | null;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const db = await getDB();

  // Batch-fetch permissions + roles in ONE call
  const ctx = await getSessionContext(session.userId);

  const [pendingQCCount, inProgressTasksCount, totalOjtCount, announcementsRaw, leaderboardResult] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM task_assignments WHERE status = 'WAITING_REVIEW'").first() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status IN ('TODO', 'IN_PROGRESS', 'REVISION')").first() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) as count FROM users WHERE user_type = 'OJT'").first() as Promise<{ count: number }>,
    db.prepare(`
      SELECT a.*, u.name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 4
    `).all(),
    getLeaderboardData('overall', 'month'),
  ]);

  const announcements = announcementsRaw.results as unknown as AnnouncementRow[];
  const miniLeaderboardUsers = (leaderboardResult.data as LeaderboardUser[]) || [];

  // Permission-based widget logic
  const canReview = ctx.can('APPROVE') || ctx.can('REQUEST_REVISION');
  const canManage = ctx.can('MANAGE');
  const canAnnounce = ctx.can('CREATE_ANNOUNCEMENT');
  const canCreate = ctx.can('CREATE_PROJECT');
  const canCreateBrief = ctx.can('CREATE_BRIEF');
  const isOJT = ctx.userType === 'OJT';

  // Widget: COORDINATOR/EXECUTIVE sees pending reviews; others see their own assignments
  let personalTasks: PersonalTaskRow[] = [];
  let widgetTitle = 'My Workspace';
  let widgetDesc = 'Active tasks assigned to you across all projects.';

  if (canReview) {
    widgetTitle = 'Pending Reviews';
    widgetDesc = 'Submitted assignments awaiting your review and approval.';
    const { results } = await db
      .prepare(
        `
      SELECT
        ta.task_id AS id,
        t.project_id,
        t.workspace_id,
        t.title,
        ta.status,
        t.deadline,
        p.name AS project_name,
        u.name AS assigned_name,
        ta.assignment_role
      FROM task_assignments ta
      JOIN tasks t         ON ta.task_id = t.id
      JOIN projects p      ON t.project_id = p.id
      LEFT JOIN users u    ON ta.user_id = u.id
      WHERE ta.status = 'WAITING_REVIEW'
      ORDER BY ta.submitted_at ASC
      LIMIT 10
    `
      )
      .all();
    personalTasks = results as unknown as PersonalTaskRow[];
  } else {
    // CREATOR / OJT: show their own active assignments
    const { results } = await db
      .prepare(
        `
      SELECT
        ta.task_id AS id,
        t.project_id,
        t.workspace_id,
        t.title,
        ta.status,
        t.deadline,
        p.name AS project_name,
        ta.assignment_role
      FROM task_assignments ta
      JOIN tasks t      ON ta.task_id = t.id
      JOIN projects p   ON t.project_id = p.id
      WHERE ta.user_id = ? AND ta.status NOT IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED')
      ORDER BY t.deadline ASC
      LIMIT 10
    `
      )
      .bind(session.userId)
      .all();
    personalTasks = results as unknown as PersonalTaskRow[];
  }

  // Fetch pending QC reviews waiting for current user's approval
  const isStaffCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

  const { results: rawPendingQCReviews } = await db
    .prepare(
      `
    SELECT DISTINCT
      ta.id            AS assignment_id,
      ta.assignment_role,
      ta.result_url,
      ta.submitted_at,
      ta.lead_approved,
      ta.mentor_approved,
      ta.coordinator_approved,
      t.id             AS task_id,
      t.title          AS task_title,
      t.priority       AS task_priority,
      t.workspace_id,
      ws.name          AS workspace_name,
      t.project_id,
      p.name           AS project_name,
      u.name           AS creator_name
    FROM task_assignments ta
    JOIN tasks t       ON ta.task_id = t.id
    JOIN projects p    ON t.project_id = p.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    LEFT JOIN users u  ON ta.user_id = u.id
    WHERE ta.status = 'WAITING_REVIEW'
      AND (ws.deleted_at IS NULL OR ws.id IS NULL)
      AND (
        (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ws.id AND user_id = ? AND team_role = 'LEADER') AND ta.lead_approved = 0)
        OR (EXISTS (SELECT 1 FROM project_coordinators WHERE project_id = p.id AND user_id = ?) AND ta.mentor_approved = 0)
        OR (? = 1 AND ta.coordinator_approved = 0)
      )
    ORDER BY ta.submitted_at ASC
  `
    )
    .bind(session.userId, session.userId, isStaffCoordinator ? 1 : 0)
    .all();

  const pendingQCReviews = rawPendingQCReviews as unknown as QCReviewItem[];

  async function handlePostAnnouncement(formData: FormData) {
    'use server';
    await createAnnouncement(formData);
  }

  return (
    <div className="space-y-10">
      {/* Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Creative Console
          </h1>
          <TimeGreeting userName={session.name} />
        </div>
      </div>

      {/* Metrics Grid Component */}
      <DashboardStats
        pendingQCCount={pendingQCCount.count}
        inProgressTasksCount={inProgressTasksCount.count}
        totalOjtCount={totalOjtCount.count}
        isOJT={isOJT}
      />

      {/* Main Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-10">
          {/* Pending QC Reviews Section */}
          <DashboardQCReviews pendingQCReviews={pendingQCReviews} />

          {/* Personal Tasks / Review Workspace Widget */}
          <DashboardPersonalWorkspace
            personalTasks={personalTasks}
            canReview={canReview}
            widgetTitle={widgetTitle}
            widgetDesc={widgetDesc}
          />

          {/* Announcements Widget */}
          <DashboardAnnouncements
            announcements={announcements}
            canAnnounce={canAnnounce}
            onPostAnnouncement={handlePostAnnouncement}
          />
        </div>

        {/* Right: Controls Panel */}
        <div className="space-y-6">
          <DashboardQuickActions
            canCreate={canCreate}
            canCreateBrief={canCreateBrief}
            canReview={canReview}
          />

          <DashboardFeedbackCard />

          <DashboardMiniLeaderboard
            topUsers={miniLeaderboardUsers}
            currentUserId={session.userId}
          />

          {canAnnounce && (
            <BroadcastAnnouncement onPostAnnouncement={handlePostAnnouncement} />
          )}
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
