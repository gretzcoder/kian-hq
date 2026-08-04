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

    // Per-workspace latest activity (includes task assignment creation for new-task detection)
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

    // Pending review count — 0 if user has no TASK_REVIEW permission
    canReview
      ? db
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
