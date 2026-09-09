'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { getCategoryMultipliers } from '@/modules/sparks/settingsCache';

export interface WorkspaceNotifItem {
  wsId: string;
  latestTs: number;
}

export interface SidebarCounts {
  announcementTimestamps: number[];
  workspaceData: WorkspaceNotifItem[];
  pendingReviewCount: number;
}

export interface NotificationFeedItem {
  id: string;
  category: 'WORKSPACE' | 'CHAT_WORKSPACE' | 'CHAT_COMMUNITY' | 'REVIEW' | 'BRIEF' | 'ANNOUNCEMENT' | 'SPARKS';
  typeLabel: string;
  icon: string;
  title: string;
  subtitle: string;
  targetUrl: string;
  createdAt: number;
  sparksBadge?: number;
  statusBadge?: string;
  color: string;
}

const sidebarCountsMemoryCache = new Map<string, { data: SidebarCounts; ts: number }>();
const SIDEBAR_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Server action polled by DashboardSidebar every 60s.
 * Returns fresh notification counts without a full page reload.
 */
export async function getSidebarCounts(): Promise<SidebarCounts | null> {
  const session = await getSession();
  if (!session) return null;

  const now = Date.now();
  const cached = sidebarCountsMemoryCache.get(session.userId);
  if (cached && now - cached.ts < SIDEBAR_CACHE_TTL_MS) {
    return cached.data;
  }

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isGlobalManager =
    ctx.userType === 'STAFF' || ctx.can('WORKSPACE_MANAGE') || ctx.can('MANAGE');
  const canReview = ctx.can('TASK_REVIEW');
  const isCoordinator =
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'))) ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.can('WORKSPACE_MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  const [annRaw, wsRaw, reviewRaw] = await Promise.all([
    // Recent announcement timestamps (LIMIT 50)
    db
      .prepare('SELECT created_at FROM announcements ORDER BY created_at DESC LIMIT 50')
      .all(),

    // Per-workspace latest activity — flat GROUP BY LEFT JOINs for high D1 performance
    (isGlobalManager || ctx.roles.some((r) => r.toUpperCase().includes('MENTOR')))
      ? db
          .prepare(
            `SELECT ws.id AS wsId,
               MAX(
                 ws.created_at,
                 COALESCE((SELECT MAX(created_at) FROM tasks WHERE workspace_id = ws.id AND status != 'DELETED'), 0),
                 COALESCE((SELECT MAX(created_at) FROM workspace_chats WHERE workspace_id = ws.id), 0)
               ) AS latestTs
             FROM workspaces ws
             WHERE ws.deleted_at IS NULL`
          )
          .all()
      : db
          .prepare(
            `SELECT ws.id AS wsId,
               MAX(
                 ws.created_at,
                 COALESCE((SELECT MAX(created_at) FROM tasks WHERE workspace_id = ws.id AND status != 'DELETED'), 0),
                 COALESCE((SELECT MAX(created_at) FROM workspace_chats WHERE workspace_id = ws.id), 0)
               ) AS latestTs
             FROM workspaces ws
             WHERE ws.deleted_at IS NULL
               AND (
                 EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ws.id AND user_id = ?)
                 OR ws.ojt_coordinator_id = ?
                 OR ws.workspace_type = 'ASSESSMENT'
               )`
          )
          .bind(session.userId, session.userId)
          .all(),

    // Pending review assignments query
    canReview
      ? db
          .prepare(
            `SELECT ta.id, ta.user_id AS creator_id, ta.lead_approved, ta.mentor_approved, ta.coordinator_approved,
                    t.task_type, t.created_by AS task_created_by, t.workspace_id, t.project_id, t.assigned_mentors,
                    ws.workspace_type, ws.ojt_coordinator_id, p.name AS project_name
             FROM task_assignments ta
             JOIN tasks t ON ta.task_id = t.id
             JOIN projects p ON t.project_id = p.id
             LEFT JOIN workspaces ws ON t.workspace_id = ws.id
             WHERE ta.status IN ('WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED')
                AND ta.result_url IS NOT NULL
                AND TRIM(ta.result_url) != ''
                AND t.status != 'DELETED'
                AND (ws.deleted_at IS NULL OR ws.id IS NULL)`
          )
          .all()
      : Promise.resolve({ results: [] }),
  ]);

  let pendingReviewCount = 0;
  if (canReview && reviewRaw?.results) {
    const reviewItems = (reviewRaw.results as any[]) || [];
    let leaderWsSet = new Set<string>();
    let coordProjSet = new Set<string>();
    let mentorWsSet = new Set<string>();
    let wsWithMentorsSet = new Set<string>();

    if (reviewItems.length > 0) {
      const [leadRows, coordRows, mentorWsRows, allWsMentors] = await Promise.all([
        db.prepare(`SELECT workspace_id FROM workspace_members WHERE user_id = ? AND team_role = 'LEADER'`).bind(session.userId).all(),
        db.prepare(`SELECT project_id FROM project_coordinators WHERE user_id = ?`).bind(session.userId).all(),
        db.prepare(`SELECT workspace_id FROM workspace_mentors WHERE user_id = ?`).bind(session.userId).all(),
        db.prepare(`SELECT DISTINCT workspace_id FROM workspace_mentors`).all(),
      ]);
      leaderWsSet = new Set(((leadRows.results as any[]) || []).map((r) => r.workspace_id));
      coordProjSet = new Set(((coordRows.results as any[]) || []).map((r) => r.project_id));
      mentorWsSet = new Set(((mentorWsRows.results as any[]) || []).map((r) => r.workspace_id));
      wsWithMentorsSet = new Set(((allWsMentors.results as any[]) || []).map((r) => r.workspace_id));
    }

    const validReviews = reviewItems.filter((r) => {
      if (r.creator_id === session.userId) return false;

      let isAssignedTaskMentor = false;
      if (r.assigned_mentors) {
        try {
          const ids = JSON.parse(r.assigned_mentors);
          if (Array.isArray(ids) && ids.includes(session.userId)) {
            isAssignedTaskMentor = true;
          }
        } catch (_e) {}
      }

      const isLead = r.workspace_id ? leaderWsSet.has(r.workspace_id) : false;
      const isMentor = (
        (r.workspace_id ? mentorWsSet.has(r.workspace_id) : false) ||
        (r.ojt_coordinator_id === session.userId) ||
        (r.project_id ? coordProjSet.has(r.project_id) : false) ||
        (r.task_created_by === session.userId) ||
        isAssignedTaskMentor
      );

      if (r.task_type === 'ASSESSMENT') {
        if (isMentor && r.mentor_approved === 0) return true;
        if (isCoordinator && r.mentor_approved === 1 && r.coordinator_approved === 0) return true;
        return false;
      }

      const isMentorWs = r.workspace_type === 'MENTOR' || r.task_type === 'MENTOR';
      if (isMentorWs) {
        const isTaskCreator = r.task_created_by != null && r.task_created_by === session.userId;
        return (isCoordinator || isTaskCreator) && r.coordinator_approved === 0;
      }

      // Regular / Troopers tasks:
      if (isLead && r.lead_approved === 0) return true;
      if (isMentor && r.mentor_approved === 0) return true;

      const hasAssignedMentors = Boolean(
        (r.workspace_id && wsWithMentorsSet.has(r.workspace_id)) ||
        r.ojt_coordinator_id != null ||
        (r.assigned_mentors && r.assigned_mentors.length > 2)
      );

      if (isCoordinator) {
        if (hasAssignedMentors) {
          return r.mentor_approved === 1 && r.coordinator_approved === 0;
        }
        return r.coordinator_approved === 0;
      }

      return false;
    });
    pendingReviewCount = validReviews.length;
  }

  const res: SidebarCounts = {
    announcementTimestamps: (annRaw.results as any[]).map((r) => r.created_at as number),
    workspaceData: (wsRaw.results as any[]).map((r) => ({
      wsId: r.wsId as string,
      latestTs: r.latestTs as number,
    })),
    pendingReviewCount,
  };

  sidebarCountsMemoryCache.set(session.userId, { data: res, ts: now });
  return res;
}

const userNotificationsMemoryCache = new Map<string, { data: NotificationFeedItem[]; ts: number }>();
const NOTIFS_CACHE_TTL_MS = 25_000; // 25 seconds

/**
 * Fetch detailed floating notification feed items customized strictly for user's accessible features.
 */
export async function fetchUserNotifications(): Promise<NotificationFeedItem[]> {
  const session = await getSession();
  if (!session) return [];

  const now = Date.now();
  const cached = userNotificationsMemoryCache.get(session.userId);
  if (cached && now - cached.ts < NOTIFS_CACHE_TTL_MS) {
    return cached.data;
  }

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));
  const canReview = ctx.can('TASK_REVIEW');
  const canManageSparks = ctx.can('SPARKS_MANAGE') || isCoordinator || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');

  const feedItems: NotificationFeedItem[] = [];

  // 0. Fetch category multipliers from cache
  const { designMultiplier, videoMultiplier } = await getCategoryMultipliers();

  // 1. Fetch user's task assignments & status events
  const { results: myAssignments } = await db
    .prepare(
      `SELECT ta.id, ta.status, ta.assignment_role AS role, ta.sparks, ta.revision_note,
              t.task_type, COALESCE(t.sparks_multiplier, 1.0) AS customTaskMultiplier,
              COALESCE(ta.reviewed_at, ta.submitted_at, ta.created_at) AS ts,
              t.id AS taskId, t.title AS taskTitle, t.workspace_id AS wsId,
              ws.name AS wsName, p.name AS pName
       FROM task_assignments ta
       JOIN tasks t ON ta.task_id = t.id
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN workspaces ws ON t.workspace_id = ws.id
       WHERE ta.user_id = ? AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
       ORDER BY COALESCE(ta.reviewed_at, ta.submitted_at, ta.created_at) DESC
       LIMIT 15`
    )
    .bind(session.userId)
    .all();

  for (const r of myAssignments as any[]) {
    const wsId = r.wsId || '';
    const taskId = r.taskId || '';
    const rawSparks = Number(r.sparks) || 8;
    const customTaskMult = Number(r.customTaskMultiplier) || 1.0;
    const isDesign = r.role === 'DESIGNER' || r.task_type === 'DESIGN' || (r.taskTitle && r.taskTitle.toUpperCase().includes('DESIGN'));
    const isVideo = r.role === 'VIDEO_EDITOR' || r.task_type === 'VIDEO' || (r.taskTitle && r.taskTitle.toUpperCase().includes('VIDEO'));

    const catMult = isDesign ? designMultiplier : isVideo ? videoMultiplier : 1.0;
    const effectiveTaskMult = customTaskMult !== 1.0 ? customTaskMult : catMult;

    const roleMult = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.role) ? 2 : 1;
    const calculatedSparks = Math.round(rawSparks * roleMult * 1.1 * effectiveTaskMult);

    if (r.status === 'ACTIVE') {
      feedItems.push({
        id: `notif_ta_${r.id}`,
        category: 'WORKSPACE',
        typeLabel: 'Tugas Baru',
        icon: '⚡',
        title: `Tugas Baru: ${r.taskTitle}`,
        subtitle: `Role: ${r.role} • Workspace: ${r.wsName || 'Workspace'}`,
        targetUrl: `/dashboard/workspace/${wsId}?taskId=${taskId}`,
        createdAt: Number(r.ts) || 0,
        statusBadge: 'AKTIF',
        color: 'border-blue-500/20 bg-blue-500/5',
      });
    } else if (r.status === 'WAITING_REVIEW' || r.status === 'SUBMITTED' || r.status === 'RESUBMITTED') {
      feedItems.push({
        id: `notif_ta_${r.id}`,
        category: 'REVIEW',
        typeLabel: 'Menunggu Review',
        icon: '📋',
        title: `Menunggu Peninjauan: ${r.taskTitle}`,
        subtitle: `Workspace: ${r.wsName || 'Workspace'}`,
        targetUrl: canReview ? `/dashboard/review` : `/dashboard/workspace/${wsId}?taskId=${taskId}`,
        createdAt: Number(r.ts) || 0,
        statusBadge: 'REVIEW',
        color: 'border-amber-500/20 bg-amber-500/5',
      });
    } else if (r.status === 'APPROVED') {
      feedItems.push({
        id: `notif_ta_${r.id}`,
        category: 'SPARKS',
        typeLabel: 'Tugas Disetujui',
        icon: '✅',
        title: `Tugas Disetujui: ${r.taskTitle}`,
        subtitle: `+${calculatedSparks} ✨ Sparks diperoleh • Workspace: ${r.wsName || 'Workspace'}`,
        targetUrl: `/dashboard/workspace/${wsId}?taskId=${taskId}`,
        createdAt: Number(r.ts) || 0,
        sparksBadge: calculatedSparks,
        statusBadge: 'APPROVED',
        color: 'border-purple-500/20 bg-purple-500/5',
      });
    } else if (r.status === 'REVISION_REQUESTED') {
      feedItems.push({
        id: `notif_ta_${r.id}`,
        category: 'WORKSPACE',
        typeLabel: 'Revisi Diminta',
        icon: '🔄',
        title: `Revisi Diminta: ${r.taskTitle}`,
        subtitle: r.revision_note ? `💬 ${r.revision_note}` : `Periksa instruksi revisi di workspace`,
        targetUrl: `/dashboard/workspace/${wsId}?taskId=${taskId}`,
        createdAt: Number(r.ts) || 0,
        statusBadge: 'REVISION',
        color: 'border-red-500/20 bg-red-500/5',
      });
    }
  }

  // 2. Fetch pending review assignments for authorized reviewers ONLY (exact stage check)
  if (canReview) {
    const { results: pendingReviews } = await db
      .prepare(
        `SELECT ta.id, ta.user_id AS assigneeId, ta.assignment_role, ta.submitted_at, ta.lead_approved, ta.mentor_approved, ta.coordinator_approved,
                t.id AS taskId, t.title AS taskTitle, t.task_type AS taskType, t.created_by AS taskCreatedBy, t.assigned_mentors,
                t.workspace_id AS wsId, ws.name AS wsName, ws.workspace_type AS wsType, ws.ojt_coordinator_id,
                p.name AS projectName, u.name AS assigneeName,
                EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = t.workspace_id AND user_id = ? AND team_role = 'LEADER') AS is_lead,
                (
                  (EXISTS (SELECT 1 FROM workspace_mentors wm WHERE wm.workspace_id = t.workspace_id AND wm.user_id = ?))
                  OR ws.ojt_coordinator_id = ?
                  OR t.created_by = ?
                  OR (EXISTS (SELECT 1 FROM project_coordinators pc WHERE pc.project_id = t.project_id AND pc.user_id = ?))
                ) AS is_mentor,
                (
                  (EXISTS (SELECT 1 FROM workspace_mentors wm WHERE wm.workspace_id = t.workspace_id))
                  OR ws.ojt_coordinator_id IS NOT NULL
                  OR (t.assigned_mentors IS NOT NULL AND length(t.assigned_mentors) > 2)
                ) AS has_mentor
         FROM task_assignments ta
         JOIN tasks t ON ta.task_id = t.id
         JOIN projects p ON t.project_id = p.id
         JOIN users u ON ta.user_id = u.id
         LEFT JOIN workspaces ws ON t.workspace_id = ws.id
          WHERE ta.status IN ('WAITING_REVIEW', 'SUBMITTED', 'RESUBMITTED')
            AND ta.result_url IS NOT NULL
            AND TRIM(ta.result_url) != ''
            AND t.status != 'DELETED'
            AND (ws.id IS NULL OR ws.deleted_at IS NULL)
          ORDER BY ta.submitted_at DESC
         LIMIT 30`
      )
      .bind(session.userId, session.userId, session.userId, session.userId, session.userId)
      .all();

    const validReviews = (pendingReviews as any[]).filter((r) => {
      if (r.assigneeId === session.userId) return false;

      let isAssignedTaskMentor = Boolean(r.is_mentor);
      if (!isAssignedTaskMentor && r.assigned_mentors) {
        try {
          const ids = JSON.parse(r.assigned_mentors);
          if (Array.isArray(ids) && ids.includes(session.userId)) {
            isAssignedTaskMentor = true;
          }
        } catch (_e) {}
      }

      const isMentorWs = r.wsType === 'MENTOR' || r.taskType === 'MENTOR' || (r.projectName ? r.projectName.toUpperCase().includes('MENTOR') : false);
      if (r.taskType === 'ASSESSMENT') {
        if (isAssignedTaskMentor && r.mentor_approved === 0) return true;
        if (isCoordinator && r.mentor_approved === 1 && r.coordinator_approved === 0) return true;
        return false;
      }
      if (isMentorWs) {
        const isTaskCreator = r.taskCreatedBy != null && r.taskCreatedBy === session.userId;
        if ((isCoordinator || isTaskCreator) && r.coordinator_approved === 0) return true;
        return false;
      }
      if (r.is_lead && r.lead_approved === 0) return true;
      if (isAssignedTaskMentor && r.mentor_approved === 0) return true;
      if (isCoordinator) {
        if (r.has_mentor) {
          return r.mentor_approved === 1 && r.coordinator_approved === 0;
        }
        return r.coordinator_approved === 0;
      }
      return false;
    });

    for (const r of validReviews.slice(0, 10)) {
      feedItems.push({
        id: `notif_rev_${r.id}`,
        category: 'REVIEW',
        typeLabel: 'Tinjauan Masuk',
        icon: '🔍',
        title: `Tinjauan Masuk: ${r.taskTitle}`,
        subtitle: `Dikirim oleh: ${r.assigneeName} (${r.assignment_role}) • ${r.wsName || 'Workspace'}`,
        targetUrl: `/dashboard/workspace/${r.wsId}?taskId=${r.taskId}`,
        createdAt: Number(r.submitted_at) || 0,
        statusBadge: 'REVISION',
        color: 'border-amber-500/20 bg-amber-500/5',
      });
    }
  }

  // 3. Fetch announcements
  const { results: annRows } = await db
    .prepare(`SELECT id, title, created_at FROM announcements ORDER BY created_at DESC LIMIT 3`)
    .all();

  for (const r of annRows as any[]) {
    feedItems.push({
      id: `notif_ann_${r.id}`,
      category: 'ANNOUNCEMENT',
      typeLabel: 'Pengumuman',
      icon: '📢',
      title: `Pengumuman: ${r.title}`,
      subtitle: 'Klik untuk membaca pengumuman lengkap',
      targetUrl: '/dashboard/announcements',
      createdAt: Number(r.created_at) || 0,
      color: 'border-indigo-500/20 bg-indigo-500/5',
    });
  }

  // 4. Fetch sparks adjustments for this user
  const { results: saRows } = await db
    .prepare(
      `SELECT sa.id, sa.type, sa.sparks, sa.note, sa.created_at, u.name AS adminName
       FROM sparks_adjustments sa
       LEFT JOIN users u ON sa.created_by = u.id
       WHERE sa.user_id = ?
       ORDER BY sa.created_at DESC
       LIMIT 5`
    )
    .bind(session.userId)
    .all();

  for (const r of saRows as any[]) {
    const typeLabel =
      r.type === 'APPRECIATION'
        ? '✨ Apresiasi Personal'
        : r.type === 'RESET'
        ? '🔄 Reset Sparks'
        : '↩ Pengembalian Sparks';

    feedItems.push({
      id: `notif_sa_${r.id}`,
      category: 'SPARKS',
      typeLabel,
      icon: r.type === 'RESET' ? '🔄' : '✨',
      title: `${typeLabel}: ${r.note || 'Penyesuaian System'}`,
      subtitle: `Oleh: ${r.adminName || 'Admin'} • Saldo: ${r.sparks >= 0 ? '+' : ''}${r.sparks} ✨`,
      targetUrl: canManageSparks ? '/dashboard/sparks' : '/dashboard/profile',
      createdAt: Number(r.created_at) || 0,
      sparksBadge: Number(r.sparks) || 0,
      color: 'border-pink-500/20 bg-pink-500/5',
    });
  }

  // Note: All chat notifications (Workspace, Community, Personal DMs) have been moved exclusively to Messenger Hub (HeaderMessengerButton).

  // 6. Fetch reminder workflow events for this user (optimized to scan workflow_events status index directly)
  try {
    const { results: reminderEvents } = await db
      .prepare(
        `SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at,
                u_sender.name AS senderName,
                COALESCE(t_direct.id, t_via_ta.id) AS taskId,
                COALESCE(t_direct.title, t_via_ta.title) AS taskTitle,
                COALESCE(t_direct.workspace_id, t_via_ta.workspace_id) AS wsId,
                COALESCE(ws_direct.name, ws_via_ta.name) AS wsName
         FROM workflow_events we
         LEFT JOIN task_assignments ta ON (we.entity_type = 'task_assignment' AND we.entity_id = ta.id)
         LEFT JOIN tasks t_via_ta ON (ta.task_id = t_via_ta.id)
         LEFT JOIN tasks t_direct ON (we.entity_type = 'task' AND we.entity_id = t_direct.id)
         LEFT JOIN users u_sender ON (we.triggered_by = u_sender.id)
         LEFT JOIN workspaces ws_direct ON (t_direct.workspace_id = ws_direct.id)
         LEFT JOIN workspaces ws_via_ta ON (t_via_ta.workspace_id = ws_via_ta.id)
         WHERE we.to_status = 'REMINDER_SENT'
           AND (we.triggered_by IS NULL OR we.triggered_by != ?)
           AND (
             (we.entity_type = 'task_assignment' AND ta.user_id = ? AND t_via_ta.status != 'DELETED' AND (ws_via_ta.id IS NULL OR ws_via_ta.deleted_at IS NULL))
             OR
             (we.entity_type = 'task' AND (t_direct.created_by = ? OR EXISTS (SELECT 1 FROM task_assignments ta2 WHERE ta2.task_id = t_direct.id AND ta2.user_id = ?)) AND t_direct.status != 'DELETED' AND (ws_direct.id IS NULL OR ws_direct.deleted_at IS NULL))
           )
         ORDER BY we.created_at DESC
         LIMIT 15`
      )
      .bind(session.userId, session.userId, session.userId, session.userId)
      .all();

    for (const r of reminderEvents as any[]) {
      const isReviewReminder = (r.note || '').toLowerCase().includes('review') || (r.note || '').toLowerCase().includes('mentor');
      feedItems.push({
        id: `notif_rem_${r.id}`,
        category: isReviewReminder ? 'REVIEW' : 'WORKSPACE',
        typeLabel: isReviewReminder ? '🔔 Reminder Review' : '⏰ Reminder Pengerjaan',
        icon: isReviewReminder ? '🔔' : '⏰',
        title: isReviewReminder ? `Reminder Review: ${r.taskTitle || 'Tugas'}` : `Reminder Pengerjaan: ${r.taskTitle || 'Tugas'}`,
        subtitle: r.note ? `💬 ${r.note}` : `Dikirim oleh ${r.senderName || 'Evaluator'} • Workspace: ${r.wsName || 'Workspace'}`,
        targetUrl: r.wsId ? `/dashboard/workspace/${r.wsId}?taskId=${r.taskId}` : '/dashboard',
        createdAt: Number(r.created_at) || 0,
        statusBadge: 'REMINDER',
        color: isReviewReminder ? 'border-amber-500/20 bg-amber-500/5' : 'border-indigo-500/20 bg-indigo-500/5',
      });
    }
  } catch (err) {
    console.error('fetchUserNotifications reminder query error:', err);
  }

  // Sort all notifications by newest timestamp
  feedItems.sort((a, b) => b.createdAt - a.createdAt);

  userNotificationsMemoryCache.set(session.userId, { data: feedItems, ts: now });
  return feedItems;
}

/**
 * Fetches IDs of notifications marked as read in DB by current user
 */
export async function fetchReadNotificationIds(): Promise<string[]> {
  const session = await getSession();
  if (!session?.userId) return [];

  const db = await getDB();
  try {
    const { results } = await db
      .prepare('SELECT notification_id FROM user_read_notifications WHERE user_id = ?')
      .bind(session.userId)
      .all();
    return (results as any[]).map((r) => r.notification_id as string);
  } catch (err) {
    console.error('fetchReadNotificationIds error:', err);
    return [];
  }
}

/**
 * Marks one or multiple notification IDs as read in DB for current user
 */
export async function markNotificationsAsRead(
  notificationIds: string[]
): Promise<{ success: boolean }> {
  const session = await getSession();
  if (!session?.userId || !notificationIds || notificationIds.length === 0) {
    return { success: false };
  }

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  try {
    for (const notifId of notificationIds) {
      if (!notifId) continue;
      await db
        .prepare(
          `INSERT INTO user_read_notifications (user_id, notification_id, read_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id, notification_id) DO UPDATE SET read_at = excluded.read_at`
        )
        .bind(session.userId, notifId, now)
        .run();
    }
    return { success: true };
  } catch (err) {
    console.error('markNotificationsAsRead error:', err);
    return { success: false };
  }
}

