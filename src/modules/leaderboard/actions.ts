'use server';

import { getDB } from '@/db/client';
import { getSession } from '@/modules/auth/session';
import { evaluateAndAutoAwardBadges } from '@/modules/badges/badgeActions';
import { getUserStreakBadgeMapAction } from '@/modules/achievements/actions';
import { getCategoryMultipliers } from '@/modules/sparks/settingsCache';

const leaderboardCache = new Map<string, { data: any; ts: number }>();
const LEADERBOARD_CACHE_TTL_MS = 60_000; // 60s memory SWR cache

export interface LeaderboardUser {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  totalSparks: number;
  tasksCompleted: number;
  zeroRevisionCount: number;
  onTimeCount: number;
  primaryRole: string;
  streakBadge?: string | null;
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
  userAvatar?: string | null;
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
 * Calculate exact boundary timestamps for Weekly (Monday 00:00:00 WIB) and Monthly (1st 00:00:00 WIB).
 * Timezone: WIB (UTC+7).
 */
export async function getLeaderboardPeriodStartTimestamp(period: 'week' | 'month' | 'all'): Promise<number> {
  if (period === 'all') return 0;

  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);

  if (period === 'week') {
    // 0 is Sun, 1 is Mon, 2 is Tue, ..., 6 is Sat
    const day = wibDate.getUTCDay();
    const diffToMon = day === 0 ? 6 : day - 1;
    const mondayWib = new Date(Date.UTC(
      wibDate.getUTCFullYear(),
      wibDate.getUTCMonth(),
      wibDate.getUTCDate() - diffToMon,
      0, 0, 0, 0
    ));
    return Math.floor((mondayWib.getTime() - wibOffset) / 1000);
  }

  if (period === 'month') {
    const firstOfMonthWib = new Date(Date.UTC(
      wibDate.getUTCFullYear(),
      wibDate.getUTCMonth(),
      1, 0, 0, 0, 0
    ));
    return Math.floor((firstOfMonthWib.getTime() - wibOffset) / 1000);
  }

  return 0;
}

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
  period: 'month' | 'week' | 'all' = 'week',
  group: 'troopers' | 'mentor' = 'troopers',
  customDateRange?: { startTs: number; endTs?: number }
) {
  const session = await getSession();
  const currentUserId = session?.userId || '';
  const cacheKey = `${category}:${period}:${group}:${customDateRange ? `${customDateRange.startTs}-${customDateRange.endTs}` : ''}:${currentUserId}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < LEADERBOARD_CACHE_TTL_MS) {
    return cached.data;
  }

  const db = await getDB();

  let periodStartTs = 0;
  let periodEndTs = 0;

  if (customDateRange) {
    periodStartTs = customDateRange.startTs;
    periodEndTs = customDateRange.endTs || 0;
  } else {
    periodStartTs = await getLeaderboardPeriodStartTimestamp(period);
  }

  /** Build a WHERE time-range fragment for a given table alias. */
  const buildTimeClause = (alias: string): string => {
    let clause = '';
    if (periodStartTs > 0) {
      clause += ` AND COALESCE(${alias}.reviewed_at, ${alias}.submitted_at) >= ${periodStartTs}`;
    }
    if (periodEndTs > 0) {
      clause += ` AND COALESCE(${alias}.reviewed_at, ${alias}.submitted_at) <= ${periodEndTs}`;
    }
    return clause;
  };

  /** Build a WHERE time-range fragment for tasks table. */
  const buildTaskTimeClause = (alias: string): string => {
    let clause = '';
    if (periodStartTs > 0) {
      clause += ` AND COALESCE(${alias}.start_at, ${alias}.created_at) >= ${periodStartTs}`;
    }
    if (periodEndTs > 0) {
      clause += ` AND COALESCE(${alias}.start_at, ${alias}.created_at) <= ${periodEndTs}`;
    }
    return clause;
  };

  /** Build a WHERE time-range fragment for sparks_adjustments table. */
  const buildAdjustmentTimeClause = (alias: string): string => {
    let clause = '';
    if (periodStartTs > 0) {
      clause += ` AND ${alias}.created_at >= ${periodStartTs}`;
    }
    if (periodEndTs > 0) {
      clause += ` AND ${alias}.created_at <= ${periodEndTs}`;
    }
    return clause;
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
    if (group === 'mentor' || category === 'role_mentor_troopers') {
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

    const includeMentorBriefs = (group === 'mentor' || category === 'role_mentor_troopers') && !['role_designer', 'role_editor', 'role_planner', 'role_researcher'].includes(category);
    const isRoleCategory = ['role_designer', 'role_editor', 'role_planner', 'role_researcher'].includes(category);

    const { designMultiplier, videoMultiplier } = await getCategoryMultipliers();

    const query = `
      WITH user_task_sparks AS (
        SELECT
          ta.user_id AS userId,
          ta.id AS assignmentId,
          ROUND(
            (COALESCE(ta.sparks, 8) * ${roleWeight('ta')} * ${disciplineMultiplier('ta')}) *
            CASE
              WHEN t.sparks_multiplier IS NOT NULL AND t.sparks_multiplier != 1.0 THEN t.sparks_multiplier
              WHEN ta.assignment_role = 'DESIGNER' OR t.task_type = 'DESIGN' OR UPPER(t.title) LIKE '%DESIGN%' THEN ${designMultiplier}
              WHEN ta.assignment_role = 'VIDEO_EDITOR' OR t.task_type = 'VIDEO' OR UPPER(t.title) LIKE '%VIDEO%' THEN ${videoMultiplier}
              ELSE 1.0
            END
          ) AS weightedSparks,
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
        u.avatar_url AS userAvatar,
        u.user_type AS userType,
        (
          SELECT GROUP_CONCAT(r.name)
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) AS accountRoles,
        COUNT(uts.assignmentId) AS tasksCompleted,
        AVG(uts.rawSparks) AS avgSparksGiven,
        ${isRoleCategory ? 'COALESCE(SUM(uts.weightedSparks), 0)' : 'COALESCE(SUM(uts.weightedSparks), 0) + COALESCE(ua.adjustmentSparks, 0)'} AS totalSparksVal,
        COALESCE(SUM(uts.isZeroRev), 0) AS zeroRevisionCount,
        COALESCE(SUM(uts.isOnTime), 0) AS onTimeCount,
        GROUP_CONCAT(DISTINCT uts.role) AS roles
      FROM users u
      LEFT JOIN user_task_sparks uts ON uts.userId = u.id
      LEFT JOIN user_adjustments ua ON ua.userId = u.id
      ${userWhereClause}
      GROUP BY u.id
      HAVING ${
        isRoleCategory || category === 'productive' || category === 'quality'
          ? 'COUNT(uts.assignmentId) > 0 AND COALESCE(SUM(uts.weightedSparks), 0) > 0'
          : '(COALESCE(SUM(uts.weightedSparks), 0) + COALESCE(ua.adjustmentSparks, 0)) > 0'
      }
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

      if (group === 'mentor' || category === 'role_mentor_troopers') {
        primaryRole = 'MENTOR';
      } else if (category === 'role_designer') {
        primaryRole = 'DESIGNER';
      } else if (category === 'role_editor') {
        primaryRole = 'VIDEO_EDITOR';
      } else if (category === 'role_planner') {
        primaryRole = 'PLANNER';
      } else if (category === 'role_researcher') {
        primaryRole = 'RESEARCHER';
      } else if (uType === 'MENTOR' || aRoles.includes('MENTOR')) {
        primaryRole = 'MENTOR';
      } else if (uType === 'STAFF' || aRoles.includes('COORDINATOR') || aRoles.includes('EXECUTIVE')) {
        primaryRole = aRoles.includes('COORDINATOR') ? 'COORDINATOR' : 'STAFF';
      } else if (r.accountRoles && r.accountRoles.trim()) {
        primaryRole = r.accountRoles.split(',')[0].trim().toUpperCase();
      } else if (taskRoles && taskRoles.trim()) {
        primaryRole = taskRoles.split(',')[0].trim();
      }

      return {
        userId: r.userId,
        userName: r.userName || 'Anonymous',
        userEmail: r.userEmail,
        userAvatar: r.userAvatar || null,
        totalSparks: Math.round(Number(r.totalSparksVal) || 0),
        tasksCompleted: completed,
        zeroRevisionCount: zeroRev,
        onTimeCount: Number(r.onTimeCount) || 0,
        qualityScore: Number(qualityScore.toFixed(2)),
        primaryRole,
      };
    }).filter((i) => i.totalSparks > 0 && (!isRoleCategory || i.tasksCompleted > 0));

    if (category === 'productive') {
      items.sort((a, b) => b.tasksCompleted - a.tasksCompleted || b.totalSparks - a.totalSparks);
    } else if (category === 'quality') {
      items = items.filter((i) => i.tasksCompleted >= 3);
      items.sort((a, b) => b.qualityScore - a.qualityScore || b.totalSparks - a.totalSparks);
    } else {
      items.sort((a, b) => b.totalSparks - a.totalSparks || b.tasksCompleted - a.tasksCompleted);
    }

    const targetUserIds = items.map((item) => item.userId);
    const streakMap = await getUserStreakBadgeMapAction(targetUserIds);
    const ranked: LeaderboardUser[] = items.map((item, idx) => ({
      rank: idx + 1,
      ...item,
      streakBadge: streakMap[item.userId] || null,
    }));

    const resObj = { type: 'individual' as const, data: ranked };
    leaderboardCache.set(cacheKey, { data: resObj, ts: Date.now() });
    return resObj;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Top Team Leader
  //    Leader diidentifikasi dari workspace_members.team_role = 'LEADER'
  //    Score = Poin Task Pribadi + Total Sparks Seluruh Workspace yang Dipimpin
  // ─────────────────────────────────────────────────────────────────────────────
  if (category === 'role_leader') {
    const tcPersonal = buildTimeClause('tap');
    const tcWorkspace = buildTimeClause('taw');

    let leaderUserFilter = '';
    if (group === 'mentor') {
      leaderUserFilter = `
        AND (
          u.id IN (
            SELECT ur.user_id
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE r.id = 'role_mentor_troopers' OR r.id = 'role_mentor' OR r.name LIKE '%MENTOR%'
          ) OR u.user_type = 'MENTOR'
        )
      `;
    } else {
      leaderUserFilter = `
        AND u.id NOT IN (
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
        u.avatar_url AS userAvatar,
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
      WHERE wm.team_role = 'LEADER' ${leaderUserFilter}
      GROUP BY u.id
      ORDER BY totalSparks DESC
    `;

    const { results } = await db.prepare(query).all();
    const ranked: LeaderboardUser[] = (results as any[])
      .map((r) => ({
        userId: r.userId,
        userName: r.userName || 'Anonymous',
        userEmail: r.userEmail,
        userAvatar: r.userAvatar || null,
        totalSparks: Math.round(Number(r.totalSparks) || 0),
        tasksCompleted: Number(r.tasksCompleted) || 0,
        zeroRevisionCount: Number(r.zeroRevisionCount) || 0,
        onTimeCount: Number(r.onTimeCount) || 0,
        primaryRole: group === 'mentor' ? 'MENTOR' : 'LEADER',
        // Extra fields for history modal breakdown
        personalSparks: Math.round(Number(r.personalSparks) || 0),
        workspaceSparks: Math.round(Number(r.workspaceSparks) || 0),
      }))
      .filter((u) => u.totalSparks > 0)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const resObj = { type: 'individual' as const, data: ranked };
    leaderboardCache.set(cacheKey, { data: resObj, ts: Date.now() });
    return resObj;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Top Workspace Team
  //    Score = Total Sparks seluruh anggota di workspace
  // ─────────────────────────────────────────────────────────────────────────────
  if (category === 'workspace') {
    let wsTypeFilter = "AND (ws.workspace_type IS NULL OR ws.workspace_type = 'TROOPERS')";
    if (group === 'mentor') {
      wsTypeFilter = "AND ws.workspace_type = 'MENTOR'";
    }

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
      WHERE ws.deleted_at IS NULL ${wsTypeFilter}
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

    const resObj = { type: 'workspace' as const, data: ranked };
    leaderboardCache.set(cacheKey, { data: resObj, ts: Date.now() });
    return resObj;
  }

  const defaultObj = { type: 'individual' as const, data: [] };
  leaderboardCache.set(cacheKey, { data: defaultObj, ts: Date.now() });
  return defaultObj;
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
  coordinatorMultiplier?: number;
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
  try {
    await evaluateAndAutoAwardBadges(targetId);
  } catch (_e) {}

  const now = Math.floor(Date.now() / 1000);

  // Fetch category multipliers
  const { results: settingsRows } = await db
    .prepare("SELECT key, value FROM system_settings WHERE key IN ('category_multiplier_design', 'category_multiplier_video')")
    .all();

  let designMultiplier = 1.0;
  let videoMultiplier = 1.0;
  for (const row of (settingsRows || []) as any[]) {
    if (row.key === 'category_multiplier_design') designMultiplier = Number(row.value) || 1.0;
    if (row.key === 'category_multiplier_video') videoMultiplier = Number(row.value) || 1.0;
  }

  const pStartTs = await getLeaderboardPeriodStartTimestamp(period);
  let timeClause = '';
  if (pStartTs > 0) {
    timeClause = `AND COALESCE(ta.reviewed_at, ta.submitted_at) >= ${pStartTs}`;
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
        t.task_type AS taskType,
        COALESCE(t.sparks_multiplier, 1.0) AS customTaskMultiplier,
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
        coordinatorMultiplier: 1.0,
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

    const customTaskMult = Number(r.customTaskMultiplier) || 1.0;
    const isDesign = r.assignmentRole === 'DESIGNER' || r.taskType === 'DESIGN' || (r.taskTitle && r.taskTitle.toUpperCase().includes('DESIGN'));
    const isVideo = r.assignmentRole === 'VIDEO_EDITOR' || r.taskType === 'VIDEO' || (r.taskTitle && r.taskTitle.toUpperCase().includes('VIDEO'));

    const catMult = isDesign ? designMultiplier : isVideo ? videoMultiplier : 1.0;
    const coordinatorMultiplier = customTaskMult !== 1.0 ? customTaskMult : catMult;

    const calculatedSparks = Math.round(rawSparks * roleMultiplier * qualityMultiplier * coordinatorMultiplier);

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
      coordinatorMultiplier,
      reviewedAt: Number(r.reviewedAt) || 0,
      revisionNote: r.revisionNote,
      isZeroRevision,
      isOnTime,
    };
  });

  let adjustmentItems: SparksHistoryItem[] = [];
  if (category !== 'workspace' && category !== 'coordinator') {
    let saTimeClause = '';
    if (pStartTs > 0) {
      saTimeClause = `AND sa.created_at >= ${pStartTs}`;
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
      const isBadgeReward = r.category === 'BADGE_REWARD';
      const typeLabel =
        isBadgeReward
          ? '🏅 Reward Badge'
          : r.type === 'APPRECIATION'
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
