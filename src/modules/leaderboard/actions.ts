'use server';

import { getDB } from '@/db/client';
import { getSession } from '@/modules/auth/session';

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
  isMember?: boolean;
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
const sparksExpr = (alias: string) => `
  CASE
    WHEN ${alias}.id IS NULL THEN 0
    ELSE (COALESCE(${alias}.sparks, 8) * ${roleWeight(alias)}) * ${disciplineMultiplier(alias)}
  END
`;

/**
 * Fetch Leaderboard Data according to Category & Time Filter
 */
export async function getLeaderboardData(
  category:
    | 'overall'
    | 'productive'
    | 'quality'
    | 'workspace'
    | 'role_mentor_troopers'
    | 'role_designer'
    | 'role_editor'
    | 'role_planner'
    | 'role_researcher'
    | 'role_leader',
  period: 'month' | 'week' | 'all' = 'month'
) {
  const db = await getDB();
  const session = await getSession();
  const currentUserId = session?.userId || '';
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

  /** Build a WHERE time-range fragment for tasks table. */
  const buildTaskTimeClause = (alias: string): string => {
    if (period === 'week') {
      const ts = now - 7 * 24 * 60 * 60;
      return `AND COALESCE(${alias}.start_at, ${alias}.created_at) >= ${ts}`;
    }
    if (period === 'month') {
      const ts = now - 30 * 24 * 60 * 60;
      return `AND COALESCE(${alias}.start_at, ${alias}.created_at) >= ${ts}`;
    }
    return '';
  };

  /** Build a WHERE time-range fragment for sparks_adjustments table. */
  const buildAdjustmentTimeClause = (alias: string): string => {
    if (period === 'week') {
      const ts = now - 7 * 24 * 60 * 60;
      return `AND ${alias}.created_at >= ${ts}`;
    }
    if (period === 'month') {
      const ts = now - 30 * 24 * 60 * 60;
      return `AND ${alias}.created_at >= ${ts}`;
    }
    return '';
  };

  const timeClause = buildTimeClause('ta');
  const taskTimeClause = buildTaskTimeClause('t');
  const saTimeClause = buildAdjustmentTimeClause('sa');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Individual Leaderboards: Overall, Productive, Quality, Role Stars
  //    (excluding role_leader which has its own section)
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    ['overall', 'productive', 'quality', 'role_designer', 'role_editor', 'role_planner', 'role_researcher', 'role_mentor_troopers'].includes(
      category
    )
  ) {
    let roleFilter = '';
    if (category === 'role_designer') roleFilter = "AND ta.assignment_role = 'DESIGNER'";
    if (category === 'role_editor') roleFilter = "AND ta.assignment_role = 'VIDEO_EDITOR'";
    if (category === 'role_planner') roleFilter = "AND ta.assignment_role = 'PLANNER'";
    if (category === 'role_researcher') roleFilter = "AND ta.assignment_role = 'RESEARCHER'";

    let userWhereClause = '';
    if (category === 'role_mentor_troopers') {
      userWhereClause = `
        WHERE u.id IN (
          SELECT ur.user_id
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE r.id = 'role_mentor_troopers' OR r.id = 'role_mentor' OR r.name LIKE '%MENTOR%'
        ) OR u.user_type = 'MENTOR'
      `;
    } else {
      userWhereClause = `
        WHERE u.id NOT IN (
          SELECT ur.user_id
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE r.id IN ('role_coordinator', 'role_executive') OR r.name IN ('COORDINATOR', 'EXECUTIVE', 'KOORDINATOR')
        )
        AND u.id NOT IN (
          SELECT ur2.user_id
          FROM user_roles ur2
          JOIN roles r2 ON ur2.role_id = r2.id
          WHERE r2.id = 'role_mentor_troopers' OR r2.id = 'role_mentor' OR r2.name LIKE '%MENTOR%'
        )
        AND u.user_type != 'MENTOR'
      `;
    }

    const includeMentorBriefs = !['role_designer', 'role_editor', 'role_planner', 'role_researcher'].includes(category);

    const query = `
      WITH user_task_sparks AS (
        SELECT
          ta.user_id AS userId,
          ta.id AS assignmentId,
          (COALESCE(ta.sparks, 8) * ${roleWeight('ta')}) * ${disciplineMultiplier('ta')} AS weightedSparks,
          COALESCE(ta.sparks, 8) AS rawSparks,
          CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END AS isZeroRev,
          CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END AS isOnTime,
          ta.assignment_role AS role
        FROM task_assignments ta
        JOIN tasks t ON ta.task_id = t.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        WHERE ta.status = 'APPROVED' AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL) ${timeClause} ${roleFilter}

        ${
          includeMentorBriefs
            ? `
        UNION ALL

        SELECT
          t.created_by AS userId,
          t.id AS assignmentId,
          COALESCE(t.sparks, 0) AS weightedSparks,
          COALESCE(t.sparks, 0) AS rawSparks,
          1 AS isZeroRev,
          1 AS isOnTime,
          'MENTOR' AS role
        FROM tasks t
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        WHERE t.task_type = 'ASSESSMENT' AND t.status = 'APPROVED' AND t.sparks IS NOT NULL AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL) ${taskTimeClause}
        `
            : ''
        }
      ),
      user_adjustments AS (
        SELECT
          sa.user_id AS userId,
          COALESCE(SUM(sa.sparks), 0) AS adjustmentSparks
        FROM sparks_adjustments sa
        WHERE 1=1 ${saTimeClause}
        GROUP BY sa.user_id
      )
      SELECT
        u.id    AS userId,
        u.name  AS userName,
        u.email AS userEmail,
        u.user_type AS userType,
        (
          SELECT GROUP_CONCAT(r.name)
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) AS accountRoles,
        COUNT(uts.assignmentId) AS tasksCompleted,
        AVG(uts.rawSparks) AS avgSparksGiven,
        COALESCE(SUM(uts.weightedSparks), 0) + COALESCE(ua.adjustmentSparks, 0) AS totalSparksVal,
        COALESCE(SUM(uts.isZeroRev), 0) AS zeroRevisionCount,
        COALESCE(SUM(uts.isOnTime), 0) AS onTimeCount,
        GROUP_CONCAT(DISTINCT uts.role) AS roles
      FROM users u
      LEFT JOIN user_task_sparks uts ON uts.userId = u.id
      LEFT JOIN user_adjustments ua ON ua.userId = u.id
      ${userWhereClause}
      GROUP BY u.id
      HAVING (COALESCE(SUM(uts.weightedSparks), 0) + COALESCE(ua.adjustmentSparks, 0)) > 0
    `;

    const { results } = await db.prepare(query).all();

    let items = (results as any[]).map((r) => {
      const completed = Number(r.tasksCompleted) || 0;
      const zeroRev = Number(r.zeroRevisionCount) || 0;
      const avgSparks = Number(r.avgSparksGiven) || 8;
      const qualityScore = completed >= 3 ? avgSparks * (zeroRev / completed) : 0;

      let primaryRole = 'CREATOR';
      const uType = (r.userType || '').toUpperCase();
      const aRoles = (r.accountRoles || '').toUpperCase();
      const taskRoles = (r.roles || '').toUpperCase();

      if (uType === 'MENTOR' || aRoles.includes('MENTOR')) {
        primaryRole = 'MENTOR';
      } else if (uType === 'STAFF' || aRoles.includes('COORDINATOR') || aRoles.includes('EXECUTIVE')) {
        primaryRole = aRoles.includes('COORDINATOR') ? 'COORDINATOR' : 'STAFF';
      } else if (r.accountRoles && r.accountRoles.trim()) {
        primaryRole = r.accountRoles.split(',')[0].trim().toUpperCase();
      } else if (taskRoles && taskRoles.trim()) {
        primaryRole = taskRoles.split(',')[0].trim();
      }

      if (category === 'role_mentor_troopers') {
        primaryRole = 'MENTOR';
      }

      return {
        userId: r.userId,
        userName: r.userName || 'Anonymous',
        userEmail: r.userEmail,
        totalSparks: Math.round(Number(r.totalSparksVal) || 0),
        tasksCompleted: completed,
        zeroRevisionCount: zeroRev,
        onTimeCount: Number(r.onTimeCount) || 0,
        qualityScore: Number(qualityScore.toFixed(2)),
        primaryRole,
      };
    }).filter((i) => i.totalSparks > 0);

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
    const ranked: LeaderboardUser[] = (results as any[])
      .map((r) => ({
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
      }))
      .filter((u) => u.totalSparks > 0)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return { type: 'individual' as const, data: ranked };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Top Workspace Team
  //    Score = Total Sparks seluruh anggota di workspace
  // ─────────────────────────────────────────────────────────────────────────────
  if (category === 'workspace') {
    const query = `
      WITH workspace_sparks AS (
        SELECT
          t.workspace_id,
          COUNT(DISTINCT ta.id) AS tasksCompleted,
          COALESCE(SUM(${sparksExpr('ta')}), 0) AS totalSparks
        FROM tasks t
        JOIN task_assignments ta ON ta.task_id = t.id AND ta.status = 'APPROVED' ${timeClause}
        GROUP BY t.workspace_id
      ),
      workspace_members_count AS (
        SELECT
          workspace_id,
          COUNT(DISTINCT user_id) AS membersCount
        FROM workspace_members
        GROUP BY workspace_id
      )
      SELECT
        ws.id   AS workspaceId,
        ws.name AS workspaceName,
        p.name  AS projectName,
        COALESCE(wmc.membersCount, 0) AS membersCount,
        COALESCE(ws_sparks.tasksCompleted, 0) AS tasksCompleted,
        COALESCE(ws_sparks.totalSparks, 0) AS rawSparks,
        CASE WHEN wm_me.user_id IS NOT NULL THEN 1 ELSE 0 END AS isMember
      FROM workspaces ws
      JOIN projects p ON ws.project_id = p.id
      LEFT JOIN workspace_sparks ws_sparks ON ws.id = ws_sparks.workspace_id
      LEFT JOIN workspace_members_count wmc ON ws.id = wmc.workspace_id
      LEFT JOIN workspace_members wm_me ON ws.id = wm_me.workspace_id AND wm_me.user_id = ?
      WHERE ws.deleted_at IS NULL
    `;

    const { results } = await db.prepare(query).bind(currentUserId).all();
    const ranked: WorkspaceLeaderboardItem[] = (results as any[])
      .map((r) => ({
        workspaceId: r.workspaceId,
        workspaceName: r.workspaceName,
        projectName: r.projectName,
        totalSparks: Math.round(Number(r.rawSparks || 0)),
        tasksCompleted: Number(r.tasksCompleted) || 0,
        membersCount: Number(r.membersCount) || 0,
        isMember: Boolean(r.isMember),
      }))
      .sort((a, b) => b.totalSparks - a.totalSparks || b.tasksCompleted - a.tasksCompleted)
      .map((ws, idx) => ({ ...ws, rank: idx + 1 }));

    return { type: 'workspace' as const, data: ranked };
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

  const { results: assignmentResults } = await db
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

  let mentorBriefItems: SparksHistoryItem[] = [];
  if (category !== 'workspace' && category !== 'coordinator') {
    const { results: mentorTaskResults } = await db
      .prepare(
        `
        SELECT
          t.id   AS assignmentId,
          t.title AS taskTitle,
          'MENTOR' AS assignmentRole,
          ws.name AS workspaceName,
          p.name  AS projectName,
          t.sparks AS rawSparks,
          COALESCE(t.start_at, t.created_at) AS reviewedAt,
          t.revision_note AS revisionNote
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        WHERE t.created_by = ? AND t.task_type = 'ASSESSMENT' AND t.status = 'APPROVED' AND t.sparks IS NOT NULL
        ORDER BY COALESCE(t.start_at, t.created_at) DESC
      `
      )
      .bind(targetId)
      .all();

    mentorBriefItems = (mentorTaskResults as any[]).map((r) => {
      const sparksVal = Number(r.rawSparks) || 0;
      return {
        assignmentId: r.assignmentId,
        taskTitle: `Brief Assessment: ${r.taskTitle}`,
        assignmentRole: 'MENTOR',
        workspaceName: r.workspaceName,
        projectName: r.projectName,
        sparks: sparksVal,
        rawSparks: sparksVal,
        roleMultiplier: 1,
        qualityMultiplier: 1.0,
        reviewedAt: Number(r.reviewedAt) || 0,
        revisionNote: r.revisionNote,
        isZeroRevision: true,
        isOnTime: true,
      };
    });
  }

  const assignmentItems: SparksHistoryItem[] = (assignmentResults as any[]).map((r) => {
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

  let adjustmentItems: SparksHistoryItem[] = [];
  if (category !== 'workspace' && category !== 'coordinator') {
    let saTimeClause = '';
    if (period === 'week') {
      const oneWeekAgo = now - 7 * 24 * 60 * 60;
      saTimeClause = `AND sa.created_at >= ${oneWeekAgo}`;
    } else if (period === 'month') {
      const oneMonthAgo = now - 30 * 24 * 60 * 60;
      saTimeClause = `AND sa.created_at >= ${oneMonthAgo}`;
    }

    const { results: saResults } = await db
      .prepare(`
        SELECT sa.id, sa.type, sa.sparks, sa.category, sa.note, sa.created_at, u.name AS adminName
        FROM sparks_adjustments sa
        LEFT JOIN users u ON sa.created_by = u.id
        WHERE sa.user_id = ? ${saTimeClause}
        ORDER BY sa.created_at DESC
      `)
      .bind(targetId)
      .all();

    adjustmentItems = (saResults as any[]).map((r) => {
      const typeLabel =
        r.type === 'APPRECIATION'
          ? '✨ Apresiasi Personal'
          : r.type === 'RESET'
          ? '🔄 Reset Sparks'
          : '↩ Restore Sparks';

      const roleLabel =
        r.type === 'APPRECIATION'
          ? 'APPRECIATION'
          : r.type === 'RESET'
          ? 'RESET'
          : 'RESTORE';

      let cleanNote = r.note || 'Penyesuaian System';
      if (cleanNote.startsWith('Pengembalian Sparks (Restore): ')) {
        cleanNote = cleanNote.replace('Pengembalian Sparks (Restore): ', '');
      }

      return {
        assignmentId: r.id,
        taskTitle: `${typeLabel}: ${cleanNote}`,
        assignmentRole: roleLabel,
        workspaceName: 'System Adjustment',
        projectName: `Oleh: ${r.adminName || 'Admin'}`,
        sparks: Number(r.sparks) || 0,
        rawSparks: Number(r.sparks) || 0,
        roleMultiplier: 1,
        qualityMultiplier: 1.0,
        reviewedAt: Number(r.created_at) || 0,
        revisionNote: r.note,
        isZeroRevision: true,
        isOnTime: true,
      };
    });
  }

  const combined = [...mentorBriefItems, ...assignmentItems, ...adjustmentItems];
  combined.sort((a, b) => b.reviewedAt - a.reviewedAt);
  return combined;
}
