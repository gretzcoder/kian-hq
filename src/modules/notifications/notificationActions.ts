'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';

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
  category: 'WORKSPACE' | 'REVIEW' | 'BRIEF' | 'ANNOUNCEMENT' | 'SPARKS';
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

/**
 * Server action polled by DashboardSidebar every 60s.
 * Returns fresh notification counts without a full page reload.
 */
export async function getSidebarCounts(): Promise<SidebarCounts | null> {
  const session = await getSession();
  if (!session) return null;

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isGlobalManager =
    ctx.userType === 'STAFF' || ctx.can('WORKSPACE_MANAGE') || ctx.can('MANAGE');
  const canReview = ctx.can('TASK_REVIEW');
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));

  const [annRaw, wsRaw, reviewRaw] = await Promise.all([
    // All announcement timestamps — no LIMIT
    db.prepare('SELECT created_at FROM announcements ORDER BY created_at DESC').all(),

    // Per-workspace latest activity
    (isGlobalManager || ctx.roles.some((r) => r.toUpperCase().includes('MENTOR')))
      ? db
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
          .all()
      : db
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
          .all(),

    // Pending review count
    canReview
      ? db
          .prepare(
            `SELECT COUNT(DISTINCT ta.id) AS cnt
             FROM task_assignments ta
             JOIN tasks t ON ta.task_id = t.id
             WHERE ta.status = 'WAITING_REVIEW'
               AND ta.result_url IS NOT NULL
               AND t.status = 'APPROVED'
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
          .first()
      : Promise.resolve(null),
  ]);

  return {
    announcementTimestamps: (annRaw.results as any[]).map((r) => r.created_at as number),
    workspaceData: (wsRaw.results as any[]).map((r) => ({
      wsId: r.wsId as string,
      latestTs: r.latestTs as number,
    })),
    pendingReviewCount: canReview ? Number((reviewRaw as any)?.cnt) || 0 : 0,
  };
}

/**
 * Fetch detailed floating notification feed items customized strictly for user's accessible features.
 */
export async function fetchUserNotifications(): Promise<NotificationFeedItem[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));
  const canReview = ctx.can('TASK_REVIEW');
  const canManageSparks = ctx.can('SPARKS_MANAGE') || isCoordinator || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');

  const feedItems: NotificationFeedItem[] = [];

  // 1. Fetch user's task assignments & status events
  const { results: myAssignments } = await db
    .prepare(
      `SELECT ta.id, ta.status, ta.assignment_role AS role, ta.sparks, ta.revision_note,
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
    const roleMult = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.role) ? 2 : 1;
    const calculatedSparks = Math.round(rawSparks * roleMult * 1.1);

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
    } else if (r.status === 'WAITING_REVIEW') {
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

  // 2. Fetch pending review assignments for authorized reviewers ONLY
  if (canReview) {
    const { results: pendingReviews } = await db
      .prepare(
        `SELECT ta.id, ta.assignment_role, ta.submitted_at, t.id AS taskId, t.title AS taskTitle,
                t.workspace_id AS wsId, ws.name AS wsName, u.name AS assigneeName
         FROM task_assignments ta
         JOIN tasks t ON ta.task_id = t.id
         JOIN users u ON ta.user_id = u.id
         LEFT JOIN workspaces ws ON t.workspace_id = ws.id
         WHERE ta.status = 'WAITING_REVIEW' AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
           AND (
             (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = t.workspace_id AND user_id = ? AND team_role = 'LEADER') AND ta.lead_approved = 0)
             OR (EXISTS (SELECT 1 FROM workspaces WHERE id = t.workspace_id AND ojt_coordinator_id = ?) AND ta.mentor_approved = 0)
             OR (? AND ta.coordinator_approved = 0)
           )
         ORDER BY ta.submitted_at DESC
         LIMIT 10`
      )
      .bind(session.userId, session.userId, isCoordinator ? 1 : 0)
      .all();

    for (const r of pendingReviews as any[]) {
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

  // 5. Fetch live chat mentions (@UserName or @FirstName) for this user
  try {
    const userRow = (await db
      .prepare('SELECT name FROM users WHERE id = ?')
      .bind(session.userId)
      .first()) as { name: string } | null;

    if (userRow && userRow.name) {
      const fullName = userRow.name;
      const firstName = fullName.split(' ')[0];

      const { results: chatMentions } = await db
        .prepare(
          `SELECT wc.id, wc.workspace_id, wc.user_id, wc.message, wc.created_at,
                  u.name AS senderName, ws.name AS wsName
           FROM workspace_chats wc
           JOIN users u ON wc.user_id = u.id
           LEFT JOIN workspaces ws ON wc.workspace_id = ws.id
           WHERE wc.user_id != ? AND (ws.id IS NULL OR ws.deleted_at IS NULL)
             AND (
               LOWER(wc.message) LIKE '%' || LOWER('@' || ?) || '%'
               OR LOWER(wc.message) LIKE '%' || LOWER('@' || ?) || '%'
             )
           ORDER BY wc.created_at DESC
           LIMIT 5`
        )
        .bind(session.userId, fullName, firstName)
        .all();

      for (const r of chatMentions as any[]) {
        feedItems.push({
          id: `notif_cm_${r.id}`,
          category: 'WORKSPACE',
          typeLabel: 'Sebutan Chat Tim',
          icon: '💬',
          title: `Sebutan Chat dari ${r.senderName}`,
          subtitle: `"${r.message}" • Workspace: ${r.wsName || 'Workspace'}`,
          targetUrl: `/dashboard/workspace/${r.workspace_id}?tab=chat`,
          createdAt: Number(r.created_at) || 0,
          color: 'border-purple-500/20 bg-purple-500/5',
        });
      }
    }
  } catch (err) {
    console.error('fetchUserNotifications mention query error:', err);
  }

  // Sort all notifications by newest timestamp
  feedItems.sort((a, b) => b.createdAt - a.createdAt);

  return feedItems;
}
