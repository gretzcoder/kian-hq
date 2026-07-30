import { getDB } from '@/db/client';

export interface LeaderboardUser {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  totalSparks: number;
  tasksCompleted: number;
  zeroRevisionCount: number;
  onTimeCount: number;
  primaryRole: string;
}

export interface WorkspaceLeaderboardItem {
  rank: number;
  workspaceId: string;
  workspaceName: string;
  projectName: string;
  totalSparks: number;
  tasksCompleted: number;
  membersCount: number;
}

export interface CoordinatorLeaderboardItem {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  reviewsProcessed: number;
  avgSparksAwarded: number;
  totalSparksGiven: number;
}

/**
 * Fetch Leaderboard Data according to Category & Time Filter
 */
export async function getLeaderboardData(
  category: 'overall' | 'productive' | 'quality' | 'workspace' | 'coordinator' | 'role_designer' | 'role_editor' | 'role_planner' | 'role_leader',
  period: 'month' | 'week' | 'all' = 'month'
) {
  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  // Time filter timestamp condition
  let timeClause = '';
  if (period === 'week') {
    const oneWeekAgo = now - 7 * 24 * 60 * 60;
    timeClause = `AND ta.reviewed_at >= ${oneWeekAgo}`;
  } else if (period === 'month') {
    const oneMonthAgo = now - 30 * 24 * 60 * 60;
    timeClause = `AND ta.reviewed_at >= ${oneMonthAgo}`;
  }

  // 1. Overall / Role Stars / Productivity / Quality (Individual Leaderboards)
  if (['overall', 'productive', 'quality', 'role_designer', 'role_editor', 'role_planner', 'role_leader'].includes(category)) {
    let roleFilter = '';
    if (category === 'role_designer') roleFilter = "AND ta.assignment_role = 'DESIGNER'";
    if (category === 'role_editor') roleFilter = "AND ta.assignment_role = 'VIDEO_EDITOR'";
    if (category === 'role_planner') roleFilter = "AND ta.assignment_role IN ('PLANNER', 'RESEARCHER')";
    if (category === 'role_leader') roleFilter = "AND ta.assignment_role = 'LEADER'";

    const query = `
      SELECT 
        u.id AS userId,
        u.name AS userName,
        u.email AS userEmail,
        COUNT(ta.id) AS tasksCompleted,
        SUM(
          CASE 
            WHEN ta.sparks IS NOT NULL AND ta.sparks > 0 THEN
              (ta.sparks * CASE WHEN ta.assignment_role IN ('DESIGNER', 'VIDEO_EDITOR') THEN 2 ELSE 1 END) *
              CASE 
                WHEN (ta.revision_note IS NULL OR ta.revision_note = '') AND (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1.20
                WHEN (ta.revision_note IS NULL OR ta.revision_note = '') OR (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1.10
                ELSE 1.00
              END
            ELSE 0
          END
        ) AS rawSparks,
        SUM(CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END) AS zeroRevisionCount,
        SUM(CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END) AS onTimeCount,
        GROUP_CONCAT(DISTINCT ta.assignment_role) AS roles
      FROM task_assignments ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.status = 'APPROVED' ${timeClause} ${roleFilter}
      GROUP BY u.id
    `;

    const { results } = await db.prepare(query).all();
    const items = (results as any[]).map((r) => ({
      userId: r.userId,
      userName: r.userName || 'Anonymous',
      userEmail: r.userEmail,
      totalSparks: Math.round(Number(r.rawSparks) || 0),
      tasksCompleted: Number(r.tasksCompleted) || 0,
      zeroRevisionCount: Number(r.zeroRevisionCount) || 0,
      onTimeCount: Number(r.onTimeCount) || 0,
      primaryRole: (r.roles || '').split(',')[0] || 'CREATOR',
    }));

    // Sorting logic per category
    if (category === 'productive') {
      items.sort((a, b) => b.tasksCompleted - a.tasksCompleted || b.totalSparks - a.totalSparks);
    } else if (category === 'quality') {
      items.sort((a, b) => (b.zeroRevisionCount / (b.tasksCompleted || 1)) - (a.zeroRevisionCount / (a.tasksCompleted || 1)) || b.totalSparks - a.totalSparks);
    } else {
      items.sort((a, b) => b.totalSparks - a.totalSparks || b.tasksCompleted - a.tasksCompleted);
    }

    const ranked: LeaderboardUser[] = items.map((item, idx) => ({
      rank: idx + 1,
      ...item,
    }));

    return { type: 'individual' as const, data: ranked };
  }

  // 2. Top Workspace Team
  if (category === 'workspace') {
    const query = `
      SELECT 
        ws.id AS workspaceId,
        ws.name AS workspaceName,
        p.name AS projectName,
        COUNT(DISTINCT wm.user_id) AS membersCount,
        COUNT(DISTINCT ta.id) AS tasksCompleted,
        SUM(
          CASE 
            WHEN ta.sparks IS NOT NULL AND ta.sparks > 0 THEN
              (ta.sparks * CASE WHEN ta.assignment_role IN ('DESIGNER', 'VIDEO_EDITOR') THEN 2 ELSE 1 END)
            ELSE 0
          END
        ) AS rawSparks
      FROM workspaces ws
      JOIN projects p ON ws.project_id = p.id
      LEFT JOIN workspace_members wm ON ws.id = wm.workspace_id
      LEFT JOIN tasks t ON ws.id = t.workspace_id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.status = 'APPROVED' ${timeClause}
      WHERE ws.deleted_at IS NULL
      GROUP BY ws.id
      ORDER BY rawSparks DESC, tasksCompleted DESC
    `;

    const { results } = await db.prepare(query).all();
    const ranked: WorkspaceLeaderboardItem[] = (results as any[]).map((r, idx) => ({
      rank: idx + 1,
      workspaceId: r.workspaceId,
      workspaceName: r.workspaceName,
      projectName: r.projectName,
      totalSparks: Math.round(Number(r.rawSparks) || 0),
      tasksCompleted: Number(r.tasksCompleted) || 0,
      membersCount: Number(r.membersCount) || 0,
    }));

    return { type: 'workspace' as const, data: ranked };
  }

  // 3. Top Coordinator / Mentor
  if (category === 'coordinator') {
    const query = `
      SELECT 
        u.id AS userId,
        u.name AS userName,
        u.email AS userEmail,
        COUNT(ta.id) AS reviewsProcessed,
        AVG(ta.sparks) AS avgSparks,
        SUM(ta.sparks) AS totalSparksGiven
      FROM task_assignments ta
      JOIN workflow_events we ON we.entity_id = ta.id AND we.to_status = 'APPROVED'
      JOIN users u ON we.triggered_by = u.id
      WHERE ta.status = 'APPROVED' AND ta.sparks IS NOT NULL AND ta.sparks > 0 ${timeClause}
      GROUP BY u.id
      ORDER BY totalSparksGiven DESC, reviewsProcessed DESC
    `;

    const { results } = await db.prepare(query).all();
    const ranked: CoordinatorLeaderboardItem[] = (results as any[]).map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      userName: r.userName || 'Coordinator',
      userEmail: r.userEmail,
      reviewsProcessed: Number(r.reviewsProcessed) || 0,
      avgSparksAwarded: Number(r.avgSparks ? Number(r.avgSparks).toFixed(1) : 0),
      totalSparksGiven: Number(r.totalSparksGiven) || 0,
    }));

    return { type: 'coordinator' as const, data: ranked };
  }

  return { type: 'individual' as const, data: [] };
}
