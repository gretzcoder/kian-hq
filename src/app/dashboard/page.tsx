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
import UnreadAnnouncementBanner from './components/UnreadAnnouncementBanner';

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
  workspace_type?: string | null;
  task_type?: string | null;
  task_created_by?: string | null;
  assigned_mentors?: string | null;
  mentor_name?: string | null;
  creator_name?: string | null;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const db = await getDB();

  // Batch-fetch permissions + roles in ONE call
  const ctx = await getSessionContext(session.userId);

  const [pendingQCCount, inProgressTasksCount, totalOjtCount, announcementsRaw, leaderboardResult] = await Promise.all([
    db.prepare("SELECT COUNT(ta.id) as count FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id LEFT JOIN workspaces ws ON t.workspace_id = ws.id WHERE ta.status IN ('WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED') AND ta.result_url IS NOT NULL AND TRIM(ta.result_url) != '' AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)").first() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) as count FROM tasks t LEFT JOIN workspaces ws ON t.workspace_id = ws.id WHERE t.status IN ('TODO', 'IN_PROGRESS', 'REVISION') AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)").first() as Promise<{ count: number }>,
    db.prepare("SELECT COUNT(*) as count FROM users WHERE user_type = 'OJT'").first() as Promise<{ count: number }>,
    db.prepare(`
      SELECT id, title, content, created_at, created_by
      FROM announcements
      ORDER BY created_at DESC
      LIMIT 3
    `).all(),
    getLeaderboardData('overall', 'month'),
  ]);

  const rawAnnouncements = announcementsRaw.results as unknown as AnnouncementRow[];
  const announcements = rawAnnouncements;
  const miniLeaderboardUsers = (leaderboardResult.data as LeaderboardUser[]) || [];

  // Permission-based widget logic
  const canReview = ctx.can('APPROVE') || ctx.can('REQUEST_REVISION');
  const canManage = ctx.can('MANAGE');
  const canAnnounce = ctx.can('CREATE_ANNOUNCEMENT');
  const canCreate = ctx.can('CREATE_PROJECT');
  const canCreateBrief = ctx.can('CREATE_BRIEF');
  const isOJT = ctx.userType === 'OJT';

  // Widget: COORDINATOR/EXECUTIVE sees pending reviews; others see their own assignments
  // Widget: COORDINATOR/EXECUTIVE sees pending reviews; others see their own assignments
  let personalTasks: PersonalTaskRow[] = [];
  let trooperTasks: PersonalTaskRow[] = [];
  let mentorTasks: PersonalTaskRow[] = [];
  let reviewTasks: PersonalTaskRow[] = [];
  let completedTasks: PersonalTaskRow[] = [];
  let widgetTitle = 'My Workspace';
  let widgetDesc = 'Active tasks assigned to you across all projects.';

  const isCoordinator =
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('ADMIN') ||
    ctx.userType === 'STAFF' ||
    ctx.can('MANAGE');

  const isMentor = ctx.roles.includes('MENTOR');

  if (isCoordinator) {
    widgetTitle = 'QC & Live Task Control Center';
    widgetDesc = 'Pantau tugas aktif, masukan mentor, dan tinjau persetujuan QC secara real-time.';

    const [allActiveRes, cResultsRes] = await Promise.all([
      // 1. All Active Tasks
      db.prepare(`
        SELECT
          ta.task_id AS id,
          ta.id AS assignment_id,
          ta.user_id AS user_id,
          t.project_id,
          t.workspace_id,
          t.title,
          ta.status,
          t.deadline,
          p.name AS project_name,
          u.name AS assigned_name,
          u_creator.name AS creator_name,
          ta.assignment_role,
          ta.sparks,
          t.start_at,
          t.task_type AS task_type,
          t.created_by AS task_created_by,
          t.assigned_mentors,
          ws.workspace_type AS workspace_type,
          u.user_type AS user_type,
          ta.appreciation_note AS appreciation_note,
          ta.result_url,
          ta.submitted_at,
          ta.revision_note AS revision_note,
          ta.mentor_approved,
          ta.coordinator_approved,
          u_creator.name AS revision_requested_by_name,
          'Koordinator/Mentor' AS revision_requested_by_role
        FROM tasks t
        JOIN task_assignments ta ON t.id = ta.task_id
        JOIN projects p      ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        LEFT JOIN users u    ON ta.user_id = u.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        WHERE t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
          AND ta.status NOT IN ('APPROVED', 'DONE', 'LOCKED', 'PUBLISHED', 'ARCHIVED')
          AND (
            ((t.task_type = 'ASSESSMENT' OR ws.workspace_type = 'ASSESSMENT') AND t.status = 'APPROVED')
            OR
            (COALESCE(t.task_type, '') != 'ASSESSMENT' AND COALESCE(ws.workspace_type, '') != 'ASSESSMENT' AND t.status NOT IN ('DELETED', 'ARCHIVED'))
          )
        ORDER BY ta.submitted_at ASC, t.deadline ASC
        LIMIT 100
      `).all(),

      db.prepare(`
        SELECT
          ta.task_id AS id,
          ta.id AS assignment_id,
          t.project_id,
          t.workspace_id,
          t.title,
          ta.status,
          t.deadline,
          p.name AS project_name,
          u.name AS assigned_name,
          u_creator.name AS creator_name,
          ta.assignment_role,
          ta.sparks,
          ta.appreciation_note AS appreciation_note,
          ta.result_url,
          ta.submitted_at,
          ta.reviewed_at
        FROM task_assignments ta
        JOIN tasks t         ON ta.task_id = t.id
        JOIN projects p      ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        LEFT JOIN users u    ON ta.user_id = u.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        WHERE ta.status IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'DONE')
          AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
        ORDER BY ta.reviewed_at DESC, ta.submitted_at DESC
        LIMIT 40
      `).all(),
    ]);

    const activeList = (allActiveRes.results || []) as unknown as PersonalTaskRow[];
    personalTasks = activeList;
    trooperTasks = activeList.filter((r) => r.workspace_type !== 'MENTOR' && r.task_type !== 'MENTOR');
    mentorTasks = activeList.filter(
      (r) => r.workspace_type === 'MENTOR' || (r.project_name && r.project_name.toUpperCase().includes('MENTOR')) || r.task_type === 'MENTOR'
    );
    reviewTasks = activeList.filter((r) => ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(r.status));
    completedTasks = (cResultsRes.results || []) as unknown as PersonalTaskRow[];
  } else if (isMentor || ctx.roles.includes('MENTOR') || ctx.userType === 'EXTERNAL' || (ctx.userType as string) === 'CREATOR') {
    widgetTitle = 'Mentor Workspace & Control';
    widgetDesc = 'Daftar penugasan aktif Anda dan troopers yang berada di bawah bimbingan Anda.';

    const [mActiveRes, tActiveRes, cResultsRes] = await Promise.all([
      db.prepare(`
        SELECT
          ta.task_id AS id,
          ta.id AS assignment_id,
          ta.user_id AS user_id,
          t.project_id,
          t.workspace_id,
          t.title,
          ta.status,
          t.deadline,
          p.name AS project_name,
          u.name AS assigned_name,
          u_creator.name AS creator_name,
          t.assigned_mentors,
          ta.assignment_role,
          ta.sparks,
          ta.appreciation_note AS appreciation_note,
          ta.result_url,
          ta.submitted_at,
          ta.revision_note,
          u_creator.name AS revision_requested_by_name,
          'Koordinator/Mentor' AS revision_requested_by_role
        FROM task_assignments ta
        JOIN tasks t      ON ta.task_id = t.id
        JOIN projects p   ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        WHERE (
          ta.user_id = ?
          OR t.created_by = ?
          OR t.workspace_id IN (SELECT workspace_id FROM workspace_mentors WHERE user_id = ?)
        )
          AND ta.status NOT IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED', 'DONE')
          AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
          AND (
            ((t.task_type = 'ASSESSMENT' OR ws.workspace_type = 'ASSESSMENT') AND t.status = 'APPROVED')
            OR
            (COALESCE(t.task_type, '') != 'ASSESSMENT' AND COALESCE(ws.workspace_type, '') != 'ASSESSMENT' AND t.status NOT IN ('DELETED', 'ARCHIVED'))
          )
        ORDER BY t.deadline ASC
        LIMIT 40
      `).bind(session.userId, session.userId, session.userId).all(),

      db.prepare(`
        SELECT
          ta.task_id AS id,
          ta.id AS assignment_id,
          ta.user_id AS user_id,
          t.project_id,
          t.workspace_id,
          t.title,
          ta.status,
          t.deadline,
          p.name AS project_name,
          u.name AS assigned_name,
          u_creator.name AS creator_name,
          t.assigned_mentors,
          ta.assignment_role,
          ta.sparks,
          ta.appreciation_note AS appreciation_note,
          ta.result_url,
          ta.submitted_at,
          ta.revision_note,
          u_creator.name AS revision_requested_by_name,
          'Koordinator/Mentor' AS revision_requested_by_role
        FROM task_assignments ta
        JOIN tasks t      ON ta.task_id = t.id
        JOIN projects p   ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        WHERE (
          t.created_by = ?
          OR ws.created_by = ?
          OR t.workspace_id IN (SELECT workspace_id FROM workspace_mentors WHERE user_id = ?)
        ) AND ta.user_id != ?
          AND ta.status NOT IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED', 'DONE')
          AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
          AND (
            ((t.task_type = 'ASSESSMENT' OR ws.workspace_type = 'ASSESSMENT') AND t.status = 'APPROVED')
            OR
            (COALESCE(t.task_type, '') != 'ASSESSMENT' AND COALESCE(ws.workspace_type, '') != 'ASSESSMENT' AND t.status NOT IN ('DELETED', 'ARCHIVED'))
          )
        ORDER BY t.deadline ASC
        LIMIT 40
      `).bind(session.userId, session.userId, session.userId, session.userId).all(),

      db.prepare(`
        SELECT
          ta.task_id AS id,
          ta.id AS assignment_id,
          t.project_id,
          t.workspace_id,
          t.title,
          ta.status,
          t.deadline,
          p.name AS project_name,
          u.name AS assigned_name,
          u_creator.name AS creator_name,
          t.assigned_mentors,
          ta.assignment_role,
          ta.sparks,
          ta.appreciation_note AS appreciation_note,
          ta.result_url,
          ta.submitted_at,
          ta.reviewed_at
        FROM task_assignments ta
        JOIN tasks t      ON ta.task_id = t.id
        JOIN projects p   ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        WHERE (
          ta.user_id = ?
          OR t.created_by = ?
          OR t.workspace_id IN (SELECT workspace_id FROM workspace_mentors WHERE user_id = ?)
        )
          AND ta.status IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'DONE')
          AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
        ORDER BY ta.reviewed_at DESC, ta.submitted_at DESC
        LIMIT 30
      `).bind(session.userId, session.userId, session.userId).all(),
    ]);

    personalTasks = (mActiveRes.results || []) as unknown as PersonalTaskRow[];
    trooperTasks = (tActiveRes.results || []) as unknown as PersonalTaskRow[];
    mentorTasks = [];
    reviewTasks = trooperTasks.filter((r) => ['WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED'].includes(r.status));
    completedTasks = (cResultsRes.results || []) as unknown as PersonalTaskRow[];
  } else {
    widgetTitle = 'My Workspace & Tasks';
    widgetDesc = 'Daftar penugasan aktif dan riwayat tugas Anda yang telah disetujui.';

    const [activeRes, completedRes] = await Promise.all([
      db.prepare(`
        SELECT
          ta.task_id AS id,
          ta.id AS assignment_id,
          ta.user_id AS user_id,
          t.project_id,
          t.workspace_id,
          t.title,
          ta.status,
          t.deadline,
          p.name AS project_name,
          u.name AS assigned_name,
          u_creator.name AS creator_name,
          t.assigned_mentors,
          ta.assignment_role,
          ta.sparks,
          ta.appreciation_note AS appreciation_note,
          ta.result_url,
          ta.submitted_at,
          ta.revision_note,
          u_creator.name AS revision_requested_by_name,
          'Koordinator/Mentor' AS revision_requested_by_role
        FROM task_assignments ta
        JOIN tasks t      ON ta.task_id = t.id
        JOIN projects p   ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        WHERE ta.user_id = ? AND ta.status NOT IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED', 'DONE')
          AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
          AND (
            ((t.task_type = 'ASSESSMENT' OR ws.workspace_type = 'ASSESSMENT') AND t.status = 'APPROVED')
            OR
            (COALESCE(t.task_type, '') != 'ASSESSMENT' AND COALESCE(ws.workspace_type, '') != 'ASSESSMENT' AND t.status NOT IN ('DELETED', 'ARCHIVED'))
          )
        ORDER BY t.deadline ASC
        LIMIT 25
      `).bind(session.userId).all(),

      db.prepare(`
        SELECT
          ta.task_id AS id,
          ta.id AS assignment_id,
          t.project_id,
          t.workspace_id,
          t.title,
          ta.status,
          t.deadline,
          p.name AS project_name,
          u.name AS assigned_name,
          u_creator.name AS creator_name,
          t.assigned_mentors,
          ta.assignment_role,
          ta.sparks,
          ta.appreciation_note AS appreciation_note,
          ta.result_url,
          ta.submitted_at,
          ta.reviewed_at
        FROM task_assignments ta
        JOIN tasks t      ON ta.task_id = t.id
        JOIN projects p   ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        WHERE ta.user_id = ? AND ta.status IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'DONE')
          AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
        ORDER BY ta.reviewed_at DESC, ta.submitted_at DESC
        LIMIT 25
      `).bind(session.userId).all(),
    ]);

    const rawPersonal = (activeRes.results || []) as unknown as PersonalTaskRow[];
    const seenActiveTaskIds = new Set<string>();
    personalTasks = rawPersonal.filter((t) => {
      if (seenActiveTaskIds.has(t.id)) return false;
      seenActiveTaskIds.add(t.id);
      return true;
    });

    const rawCompleted = (completedRes.results || []) as unknown as PersonalTaskRow[];
    const seenCompletedTaskIds = new Set<string>();
    completedTasks = rawCompleted.filter((t) => {
      if (seenCompletedTaskIds.has(t.id)) return false;
      seenCompletedTaskIds.add(t.id);
      return true;
    });
  }

  const [allWsMentorsRes, allWsLeadersRes, rawPendingQCReviewsRes] = await Promise.all([
    db.prepare(`
      SELECT wm.workspace_id, wm.user_id, u.name 
      FROM workspace_mentors wm 
      JOIN users u ON wm.user_id = u.id
    `).all(),

    db.prepare(`
      SELECT workspace_id, user_id 
      FROM workspace_members 
      WHERE team_role = 'LEADER'
    `).all(),

    db.prepare(`
      SELECT
        ta.id            AS assignment_id,
        ta.user_id       AS user_id,
        ta.assignment_role,
        ta.result_url,
        ta.submitted_at,
        ta.lead_approved,
        ta.mentor_approved,
        ta.coordinator_approved,
        ta.appreciation_note AS appreciation_note,
        ta.revision_note,
        t.id             AS task_id,
        t.title          AS task_title,
        t.priority       AS task_priority,
        t.task_type      AS task_type,
        t.created_by     AS task_created_by,
        t.assigned_mentors,
        t.workspace_id,
        ws.name          AS workspace_name,
        ws.workspace_type AS workspace_type,
        ws.ojt_coordinator_id,
        t.project_id,
        p.name           AS project_name,
        u.name           AS submitter_name,
        u_creator.name   AS task_creator_name
      FROM task_assignments ta
      JOIN tasks t       ON ta.task_id = t.id
      JOIN projects p    ON t.project_id = p.id
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      LEFT JOIN users u  ON ta.user_id = u.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE ta.status IN ('WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED')
        AND ta.result_url IS NOT NULL
        AND TRIM(ta.result_url) != ''
        AND t.status != 'DELETED'
        AND (ws.deleted_at IS NULL OR ws.id IS NULL)
      ORDER BY ta.submitted_at ASC
      LIMIT 100
    `).all(),
  ]);

  const wsMentorsMap: Record<string, { id: string; name: string }[]> = {};
  let dashMentorMap: Record<string, string> = {};
  const wsLeadersMap: Record<string, Set<string>> = {};

  ((allWsMentorsRes.results as any[]) || []).forEach((row) => {
    if (!wsMentorsMap[row.workspace_id]) wsMentorsMap[row.workspace_id] = [];
    wsMentorsMap[row.workspace_id].push({ id: row.user_id, name: row.name });
    dashMentorMap[row.user_id] = row.name;
  });

  ((allWsLeadersRes.results as any[]) || []).forEach((row) => {
    if (!wsLeadersMap[row.workspace_id]) wsLeadersMap[row.workspace_id] = new Set();
    wsLeadersMap[row.workspace_id].add(row.user_id);
  });

  const allDashboardTasks = [...personalTasks, ...trooperTasks, ...mentorTasks, ...reviewTasks, ...completedTasks];
  const allAssignedMentorIds = new Set<string>();
  for (const tRow of allDashboardTasks) {
    if (tRow.assigned_mentors) {
      try {
        const ids: string[] = JSON.parse(tRow.assigned_mentors);
        ids.forEach((id) => allAssignedMentorIds.add(id));
      } catch (_e) {}
    }
  }

  if (allAssignedMentorIds.size > 0) {
    const idsArr = Array.from(allAssignedMentorIds).filter((id) => !dashMentorMap[id]);
    if (idsArr.length > 0) {
      const placeholders = idsArr.map(() => '?').join(',');
      const { results: mentorUsers } = await db
        .prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`)
        .bind(...idsArr)
        .all();
      ((mentorUsers as any[]) || []).forEach((u) => {
        dashMentorMap[u.id] = u.name;
      });
    }
  }

  const mapMentorName = (tRow: PersonalTaskRow) => {
    if (tRow.assigned_mentors) {
      try {
        const ids: string[] = JSON.parse(tRow.assigned_mentors);
        if (Array.isArray(ids) && ids.length > 0) {
          const names = ids
            .map((id) => (id === session.userId ? 'Anda' : dashMentorMap[id] || null))
            .filter((n): n is string => Boolean(n));
          if (names.length > 0) return { ...tRow, mentor_name: names.join(', ') };
        }
      } catch (_e) {}
    }
    if (tRow.workspace_id && wsMentorsMap[tRow.workspace_id]?.length > 0) {
      const names = wsMentorsMap[tRow.workspace_id]
        .map((m) => (m.id === session.userId ? 'Anda' : m.name))
        .filter((n): n is string => Boolean(n));
      if (names.length > 0) return { ...tRow, mentor_name: names.join(', ') };
    }
    return {
      ...tRow,
      mentor_name: tRow.task_created_by === session.userId ? 'Anda' : (tRow.creator_name || null),
    };
  };

  personalTasks = personalTasks.map(mapMentorName);
  trooperTasks = trooperTasks.map(mapMentorName);
  mentorTasks = mentorTasks.map(mapMentorName);
  reviewTasks = reviewTasks.map(mapMentorName);
  completedTasks = completedTasks.map(mapMentorName);

  const isStaffCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

  const allQCReviews = (rawPendingQCReviewsRes.results as any[]) || [];

  const pendingQCReviews = allQCReviews
    .map((r: any) => {
      const wsMentors = r.workspace_id ? wsMentorsMap[r.workspace_id] || [] : [];
      let isAssignedTaskMentor = wsMentors.some((m) => m.id === session.userId);
      let hasExplicitMentors = wsMentors.length > 0;
      let mentorDisplayNames: string[] = [];

      if (r.assigned_mentors) {
        try {
          const ids = JSON.parse(r.assigned_mentors);
          if (Array.isArray(ids) && ids.length > 0) {
            hasExplicitMentors = true;
            if (ids.includes(session.userId)) {
              isAssignedTaskMentor = true;
            }
            mentorDisplayNames = ids
              .map((id) => (id === session.userId ? 'Anda' : dashMentorMap[id] || null))
              .filter((n): n is string => Boolean(n));
          }
        } catch (_e) {}
      }

      if (mentorDisplayNames.length === 0 && wsMentors.length > 0) {
        mentorDisplayNames = wsMentors
          .map((m) => (m.id === session.userId ? 'Anda' : m.name))
          .filter((n): n is string => Boolean(n));
      }

      if (!hasExplicitMentors && r.task_created_by === session.userId) {
        isAssignedTaskMentor = true;
      }

      const mentorName =
        mentorDisplayNames.length > 0
          ? mentorDisplayNames.join(', ')
          : r.task_created_by === session.userId
          ? 'Anda'
          : r.task_creator_name || null;

      const wsLeaders = r.workspace_id ? wsLeadersMap[r.workspace_id] : undefined;
      const is_lead = wsLeaders ? (wsLeaders.has(session.userId) ? 1 : 0) : 0;
      const has_lead = wsLeaders ? (wsLeaders.size > 0 ? 1 : 0) : 0;
      const submitter_is_lead = wsLeaders ? (wsLeaders.has(r.user_id) ? 1 : 0) : 0;

      return {
        ...r,
        is_lead,
        has_lead,
        submitter_is_lead,
        is_mentor: isAssignedTaskMentor ? 1 : 0,
        is_staff_coordinator: isStaffCoordinator,
        has_mentor_on_task: hasExplicitMentors,
        mentor_name: mentorName,
        assignee_name: r.submitter_name,
        creator_name: r.submitter_name,
      };
    })
    .filter((r: any) => {
      if (r.user_id === session.userId) return false;

      if (
        r.workspace_type === 'MENTOR' ||
        r.task_type === 'MENTOR' ||
        (r.project_name ? r.project_name.toUpperCase().includes('MENTOR') : false)
      ) {
        const isTaskCreator = r.task_created_by != null && r.task_created_by === session.userId;
        if (!isStaffCoordinator && !isTaskCreator) return false;
        return r.coordinator_approved === 0;
      }

      if (r.task_type === 'ASSESSMENT') {
        if (r.is_mentor === 1 && r.mentor_approved === 0) return true;
        if (isStaffCoordinator && r.mentor_approved === 1 && r.coordinator_approved === 0) return true;
        return false;
      }

      if (r.is_lead && r.lead_approved === 0) return true;

      if (r.is_mentor === 1 && r.mentor_approved === 0) {
        if (r.has_lead && !r.submitter_is_lead) {
          return r.lead_approved === 1;
        }
        return true;
      }

      if (isStaffCoordinator) {
        if (r.has_mentor_on_task) {
          return r.mentor_approved === 1 && r.coordinator_approved === 0;
        }
        return r.coordinator_approved === 0;
      }
      return false;
    });

  async function handlePostAnnouncement(formData: FormData) {
    'use server';
    await createAnnouncement(formData);
  }

  return (
    <div className="space-y-6 sm:space-y-10 min-w-0 max-w-full overflow-x-hidden">
      {/* Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Creative Console
          </h1>
          <p className="hidden md:block text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
            Pusat manajemen kampanye, kontrol kualitas tugas, dan kolaborasi tim Kian HQ.
          </p>
          <div className="md:hidden">
            <TimeGreeting />
          </div>
        </div>
      </div>

      {/* Unread Announcement Banner */}
      <UnreadAnnouncementBanner
        latestAnnouncement={announcements[0] || null}
        announcementTimestamps={announcements.map((a) => a.created_at)}
      />

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
          <DashboardQCReviews pendingQCReviews={pendingQCReviews} currentUserId={session.userId} />

          {/* Personal Tasks / Review Workspace Widget */}
          <DashboardPersonalWorkspace
            personalTasks={personalTasks}
            trooperTasks={trooperTasks}
            mentorTasks={mentorTasks}
            reviewTasks={reviewTasks}
            completedTasks={completedTasks}
            userType={ctx.userType}
            roles={ctx.roles}
            canReview={canReview}
            widgetTitle={widgetTitle}
            widgetDesc={widgetDesc}
            currentUserId={session.userId}
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
export const revalidate = 0;
