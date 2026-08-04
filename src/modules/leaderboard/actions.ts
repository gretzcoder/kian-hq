'use server';

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
  speedBonusCount: number;
  coordinatorScore: number;
}

/**
 * Shared discipline multiplier CASE expression.
 * Combo Sempurna (Tanpa Revisi & Tepat Waktu) = 1.21 (1.10 × 1.10, multiplicative).
 */
const disciplineMultiplier = (alias: string) => `
  CASE
    WHEN (${alias}.revision_note IS NULL OR ${alias}.revision_note = '')
      AND (${alias}.deadline IS NULL OR ${alias}.reviewed_at <= ${alias}.deadline) THEN 1.21
    WHEN (${alias}.revision_note IS NULL OR ${alias}.revision_note = '')
      OR  (${alias}.deadline IS NULL OR ${alias}.reviewed_at <= ${alias}.deadline) THEN 1.10
    ELSE 1.00
  END
`;

/** Role weight multiplier CASE expression (2× for Creator roles). */
const roleWeight = (alias: string) =>
  `CASE WHEN ${alias}.assignment_role IN ('DESIGNER', 'VIDEO_EDITOR') THEN 2 ELSE 1 END`;

/** Full weighted sparks expression for a given alias. */
const sparksExpr = (alias: string) =>
  `(COALESCE(${alias}.sparks, 8) * ${roleWeight(alias)}) * ${disciplineMultiplier(alias)}`;

/**
 * Fetch Leaderboard Data according to Category & Time Filter
 */
export async function getLeaderboardData(
  category:
    | 'overall'
    | 'productive'
    | 'quality'
    | 'workspace'
    | 'coordinator'
    | 'role_designer'
    | 'role_editor'
    | 'role_planner'
    | 'role_researcher'
    | 'role_leader',
  period: 'month' | 'week' | 'all' = 'month'
) {
  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  /** Build a WHERE time-range fragment for a given table alias. */
  const buildTimeClause = (alias: string): string => {
    if (period === 'week') {
      const ts = now - 7 * 24 * 60 * 60;
      return `AND COALESCE(${alias}.reviewed_at, ${alias}.submitted_at) >= ${ts}`;
    }
    if (period === 'month') {
      const ts = now - 30 * 24 * 60 * 60;
      return `AND COALESCE(${alias}.reviewed_at, ${alias}.submitted_at) >= ${ts}`;
    }
    return '';
  };

  const timeClause = buildTimeClause('ta');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Individual Leaderboards: Overall, Productive, Quality, Role Stars
  //    (excluding role_leader which has its own section)
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    ['overall', 'productive', 'quality', 'role_designer', 'role_editor', 'role_planner', 'role_researcher'].includes(
      category
    )
  ) {
    let roleFilter = '';
    if (category === 'role_designer') roleFilter = "AND ta.assignment_role = 'DESIGNER'";
    if (category === 'role_editor') roleFilter = "AND ta.assignment_role = 'VIDEO_EDITOR'";
    if (category === 'role_planner') roleFilter = "AND ta.assignment_role = 'PLANNER'";
    if (category === 'role_researcher') roleFilter = "AND ta.assignment_role = 'RESEARCHER'";

    const query = `
      SELECT
        u.id    AS userId,
        u.name  AS userName,
        u.email AS userEmail,
        COUNT(ta.id)                                                         AS tasksCompleted,
        AVG(COALESCE(ta.sparks, 8))                                          AS avgSparksGiven,
        SUM(${sparksExpr('ta')})                                             AS rawSparks,
        SUM(CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END) AS zeroRevisionCount,
        SUM(CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END) AS onTimeCount,
        GROUP_CONCAT(DISTINCT ta.assignment_role)                             AS roles
      FROM task_assignments ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.status = 'APPROVED' ${timeClause} ${roleFilter}
      GROUP BY u.id
    `;

    const { results } = await db.prepare(query).all();
    let items = (results as any[]).map((r) => {
      const completed = Number(r.tasksCompleted) || 0;
      const zeroRev = Number(r.zeroRevisionCount) || 0;
      const avgSparks = Number(r.avgSparksGiven) || 8;
      const qualityScore = completed >= 3 ? avgSparks * (zeroRev / completed) : 0;

      return {
        userId: r.userId,
        userName: r.userName || 'Anonymous',
        userEmail: r.userEmail,
        totalSparks: Math.round(Number(r.rawSparks) || 0),
        tasksCompleted: completed,
        zeroRevisionCount: zeroRev,
        onTimeCount: Number(r.onTimeCount) || 0,
        qualityScore: Number(qualityScore.toFixed(2)),
        primaryRole: (r.roles || '').split(',')[0] || 'CREATOR',
      };
    });

    if (category === 'productive') {
      items.sort((a, b) => b.tasksCompleted - a.tasksCompleted || b.totalSparks - a.totalSparks);
    } else if (category === 'quality') {
      items = items.filter((i) => i.tasksCompleted >= 3);
      items.sort((a, b) => b.qualityScore - a.qualityScore || b.totalSparks - a.totalSparks);
    } else {
      items.sort((a, b) => b.totalSparks - a.totalSparks || b.tasksCompleted - a.tasksCompleted);
    }

    const ranked: LeaderboardUser[] = items.map((item, idx) => ({
      rank: idx + 1,
      ...item,
    }));

    return { type: 'individual' as const, data: ranked };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Top Team Leader
  //    Leader diidentifikasi dari workspace_members.team_role = 'LEADER'
  //    Score = Poin Task Pribadi + Total Sparks Seluruh Workspace yang Dipimpin
  // ─────────────────────────────────────────────────────────────────────────────
  if (category === 'role_leader') {
    const tcPersonal = buildTimeClause('tap');
    const tcWorkspace = buildTimeClause('taw');

    const query = `
      WITH workspace_totals AS (
        -- Total sparks semua anggota di setiap workspace
        SELECT
          tp.workspace_id,
          COALESCE(SUM(${sparksExpr('taw')}), 0) AS totalSparks
        FROM tasks tp
        JOIN task_assignments taw ON taw.task_id = tp.id AND taw.status = 'APPROVED' ${tcWorkspace}
        GROUP BY tp.workspace_id
      ),
      personal_sparks AS (
        -- Sparks pribadi setiap user per workspace
        SELECT
          tap.user_id,
          tp.workspace_id,
          COALESCE(SUM(${sparksExpr('tap')}), 0) AS personalSparks,
          COUNT(DISTINCT tap.id)                  AS personalTasks,
          SUM(CASE WHEN (tap.revision_note IS NULL OR tap.revision_note = '') THEN 1 ELSE 0 END) AS zeroRevisionCount,
          SUM(CASE WHEN (tap.deadline IS NULL OR tap.reviewed_at <= tap.deadline) THEN 1 ELSE 0 END) AS onTimeCount
        FROM task_assignments tap
        JOIN tasks tp ON tap.task_id = tp.id
        WHERE tap.status = 'APPROVED' ${tcPersonal}
        GROUP BY tap.user_id, tp.workspace_id
      )
      SELECT
        u.id    AS userId,
        u.name  AS userName,
        u.email AS userEmail,
        COALESCE(SUM(ps.personalTasks),      0) AS tasksCompleted,
        COALESCE(SUM(ps.zeroRevisionCount),  0) AS zeroRevisionCount,
        COALESCE(SUM(ps.onTimeCount),        0) AS onTimeCount,
        COALESCE(SUM(ps.personalSparks),     0) AS personalSparks,
        COALESCE(SUM(wt.totalSparks),        0) AS workspaceSparks,
        COALESCE(SUM(ps.personalSparks), 0) + COALESCE(SUM(wt.totalSparks), 0) AS totalSparks
      FROM workspace_members wm
      JOIN users      u  ON wm.user_id      = u.id
      JOIN workspaces ws ON wm.workspace_id = ws.id AND ws.deleted_at IS NULL
      LEFT JOIN workspace_totals wt ON wt.workspace_id = ws.id
      LEFT JOIN personal_sparks  ps ON ps.user_id = u.id AND ps.workspace_id = ws.id
      WHERE wm.team_role = 'LEADER'
      GROUP BY u.id
      ORDER BY totalSparks DESC
    `;

    const { results } = await db.prepare(query).all();
    const ranked: LeaderboardUser[] = (results as any[]).map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      userName: r.userName || 'Anonymous',
      userEmail: r.userEmail,
      totalSparks: Math.round(Number(r.totalSparks) || 0),
      tasksCompleted: Number(r.tasksCompleted) || 0,
      zeroRevisionCount: Number(r.zeroRevisionCount) || 0,
      onTimeCount: Number(r.onTimeCount) || 0,
      primaryRole: 'LEADER',
      // Extra fields for history modal breakdown
      personalSparks: Math.round(Number(r.personalSparks) || 0),
      workspaceSparks: Math.round(Number(r.workspaceSparks) || 0),
    }));

    return { type: 'individual' as const, data: ranked };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Top Workspace Team
  //    Score = Total Sparks seluruh anggota di workspace
  // ─────────────────────────────────────────────────────────────────────────────
  if (category === 'workspace') {
    const query = `
      SELECT
        ws.id   AS workspaceId,
        ws.name AS workspaceName,
        p.name  AS projectName,
        COUNT(DISTINCT wm.user_id)  AS membersCount,
        COUNT(DISTINCT ta.id)       AS tasksCompleted,
        COALESCE(SUM(${sparksExpr('ta')}), 0) AS rawSparks
      FROM workspaces ws
      JOIN projects p ON ws.project_id = p.id
      LEFT JOIN workspace_members wm ON ws.id = wm.workspace_id
      LEFT JOIN tasks t  ON ws.id = t.workspace_id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.status = 'APPROVED' ${timeClause}
      WHERE ws.deleted_at IS NULL
      GROUP BY ws.id
    `;

    const { results } = await db.prepare(query).all();
    const ranked: WorkspaceLeaderboardItem[] = (results as any[])
      .map((r) => ({
        workspaceId: r.workspaceId,
        workspaceName: r.workspaceName,
        projectName: r.projectName,
        totalSparks: Math.round(Number(r.rawSparks || 0)),
        tasksCompleted: Number(r.tasksCompleted) || 0,
        membersCount: Number(r.membersCount) || 0,
      }))
      .sort((a, b) => b.totalSparks - a.totalSparks || b.tasksCompleted - a.tasksCompleted)
      .map((ws, idx) => ({ ...ws, rank: idx + 1 }));

    return { type: 'workspace' as const, data: ranked };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Top Mentor / Coordinator
  //    Formula: (Total Review × 5) + (Total Sparks Workspace × 10) + Speed Bonus
  //    Speed Bonus: +3 per review diselesaikan < 2 jam sejak submitted_at
  // ─────────────────────────────────────────────────────────────────────────────
  if (category === 'coordinator') {
    const query = `
      SELECT
        u.id    AS userId,
        u.name  AS userName,
        u.email AS userEmail,
        COUNT(DISTINCT ta.id)           AS reviewsProcessed,
        AVG(COALESCE(ta.sparks, 8))     AS avgSparksGiven,
        COALESCE(SUM(${sparksExpr('ta')}), 0) AS totalWorkspaceSparks,
        SUM(
          CASE
            WHEN ta.reviewed_at IS NOT NULL
              AND ta.submitted_at IS NOT NULL
              AND (ta.reviewed_at - ta.submitted_at) < 7200
            THEN 1 ELSE 0
          END
        ) AS speedBonusCount
      FROM users u
      JOIN workspaces ws ON ws.ojt_coordinator_id = u.id
      JOIN tasks t       ON t.workspace_id = ws.id
      JOIN task_assignments ta ON ta.task_id = t.id AND ta.status = 'APPROVED' ${timeClause}
      WHERE ws.deleted_at IS NULL
      GROUP BY u.id
    `;

    const { results } = await db.prepare(query).all();
    const ranked: CoordinatorLeaderboardItem[] = (results as any[])
      .map((r) => {
        const reviews = Number(r.reviewsProcessed) || 0;
        const avgSparks = Number(r.avgSparksGiven) || 0;
        const totalWorkspaceSparks = Math.round(Number(r.totalWorkspaceSparks || 0));
        const speedBonusCount = Number(r.speedBonusCount) || 0;
        // Coordinator Score = (Reviews × 5) + (Workspace Sparks × 10) + (Speed Reviews × 3)
        const coordinatorScore = reviews * 5 + totalWorkspaceSparks * 10 + speedBonusCount * 3;

        return {
          userId: r.userId,
          userName: r.userName || 'Coordinator',
          userEmail: r.userEmail,
          reviewsProcessed: reviews,
          avgSparksAwarded: Number(avgSparks.toFixed(1)),
          totalSparksGiven: totalWorkspaceSparks,
          speedBonusCount,
          coordinatorScore,
        };
      })
      .sort((a, b) => b.coordinatorScore - a.coordinatorScore || b.reviewsProcessed - a.reviewsProcessed)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return { type: 'coordinator' as const, data: ranked };
  }

  return { type: 'individual' as const, data: [] };
}

export interface SparksHistoryItem {
  assignmentId: string;
  taskTitle: string;
  assignmentRole: string;
  workspaceName: string | null;
  projectName: string;
  sparks: number;
  rawSparks: number;
  roleMultiplier: number;
  qualityMultiplier: number;
  reviewedAt: number;
  revisionNote: string | null;
  isZeroRevision: boolean;
  isOnTime: boolean;
}

/**
 * Fetch detailed Sparks history for a specific user or workspace, filtered by category and period if applicable.
 */
export async function getSparksHistory(
  targetId: string,
  category?: string,
  period: 'month' | 'week' | 'all' = 'month'
): Promise<SparksHistoryItem[]> {
  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  let timeClause = '';
  if (period === 'week') {
    const oneWeekAgo = now - 7 * 24 * 60 * 60;
    timeClause = `AND COALESCE(ta.reviewed_at, ta.submitted_at) >= ${oneWeekAgo}`;
  } else if (period === 'month') {
    const oneMonthAgo = now - 30 * 24 * 60 * 60;
    timeClause = `AND COALESCE(ta.reviewed_at, ta.submitted_at) >= ${oneMonthAgo}`;
  }

  let roleFilter = '';
  let idClause = 'ta.user_id = ?';

  if (category === 'workspace') {
    idClause = 't.workspace_id = ?';
  } else if (category === 'coordinator') {
    idClause = 'ws.ojt_coordinator_id = ?';
  } else {
    if (category === 'role_designer') roleFilter = "AND ta.assignment_role = 'DESIGNER'";
    else if (category === 'role_editor') roleFilter = "AND ta.assignment_role = 'VIDEO_EDITOR'";
    else if (category === 'role_planner') roleFilter = "AND ta.assignment_role = 'PLANNER'";
    else if (category === 'role_researcher') roleFilter = "AND ta.assignment_role = 'RESEARCHER'";
    // role_leader: show personal task history (idClause stays as user_id)
  }

  const { results } = await db
    .prepare(
      `
      SELECT
        ta.id   AS assignmentId,
        t.title AS taskTitle,
        ta.assignment_role                                                              AS assignmentRole,
        ws.name                                                                         AS workspaceName,
        p.name                                                                          AS projectName,
        COALESCE(ta.sparks, 8)                                                          AS rawSparks,
        COALESCE(ta.reviewed_at, ta.submitted_at)                                       AS reviewedAt,
        ta.revision_note                                                                AS revisionNote,
        CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END AS isZeroRevision,
        CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END AS isOnTime
      FROM task_assignments ta
      JOIN tasks    t  ON ta.task_id    = t.id
      JOIN projects p  ON t.project_id  = p.id
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      WHERE ${idClause} AND ta.status = 'APPROVED' ${timeClause} ${roleFilter}
      ORDER BY COALESCE(ta.reviewed_at, ta.submitted_at) DESC
    `
    )
    .bind(targetId)
    .all();

  return (results as any[]).map((r) => {
    const rawSparks = Number(r.rawSparks) || 8;
    const roleMultiplier = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.assignmentRole) ? 2 : 1;
    const isZeroRevision = Boolean(r.isZeroRevision);
    const isOnTime = Boolean(r.isOnTime);

    let qualityMultiplier = 1.0;
    if (isZeroRevision && isOnTime) qualityMultiplier = 1.21;
    else if (isZeroRevision || isOnTime) qualityMultiplier = 1.10;

    const calculatedSparks = Math.round(rawSparks * roleMultiplier * qualityMultiplier);

    return {
      assignmentId: r.assignmentId,
      taskTitle: r.taskTitle,
      assignmentRole: r.assignmentRole,
      workspaceName: r.workspaceName,
      projectName: r.projectName,
      sparks: calculatedSparks,
      rawSparks,
      roleMultiplier,
      qualityMultiplier,
      reviewedAt: Number(r.reviewedAt) || 0,
      revisionNote: r.revisionNote,
      isZeroRevision,
      isOnTime,
    };
  });
}
