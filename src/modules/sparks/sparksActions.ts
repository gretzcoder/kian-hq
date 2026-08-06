'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';

export interface UserSparksRankItem {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  userType: string;
  roleNames: string;
  totalSparks: number;
  tasksCompleted: number;
  assessmentsCount: number;
  appreciationCount: number;
}

export interface SparksOverviewData {
  stats: {
    totalDistributed: number;
    troopersSparks: number;
    assessmentSparks: number;
    appreciationSparks: number;
    resetSparks: number;
    restoredSparks: number;
  };
  users: UserSparksRankItem[];
}

/** Check if session user has Sparks Management permission */
async function canManageSparks(sessionUserId: string): Promise<boolean> {
  const ctx = await getSessionContext(sessionUserId);
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE'));
  return ctx.can('SPARKS_MANAGE') || isCoordinator || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');
}

/** Helper: Calculate timestamp cutoff for period filtering */
function getPeriodTimestamp(period: 'all' | 'month' | 'week'): number {
  const now = Math.floor(Date.now() / 1000);
  if (period === 'week') return now - 7 * 24 * 60 * 60;
  if (period === 'month') return now - 30 * 24 * 60 * 60;
  return 0;
}

/**
 * Get Overview Stats and All Users Ranked by Total Sparks for Sparks Management Page
 * Strictly filters to ONLY include MENTOR and TROOPERS roles (or users with Sparks income).
 */
export async function getSparksManagementOverview(
  period: 'all' | 'month' | 'week' = 'month'
): Promise<SparksOverviewData> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const minTs = getPeriodTimestamp(period);
  const timeClauseTA = minTs > 0 ? `AND COALESCE(ta.reviewed_at, ta.submitted_at) >= ${minTs}` : '';
  const timeClauseT  = minTs > 0 ? `AND COALESCE(t.start_at, t.created_at) >= ${minTs}` : '';
  const timeClauseSA = minTs > 0 ? `AND sa.created_at >= ${minTs}` : '';

  // 1. Fetch task assignment sparks
  const { results: taRows } = await db.prepare(`
    SELECT ta.user_id AS userId, ta.sparks, ta.assignment_role AS role,
           CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END AS isZeroRev,
           CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END AS isOnTime
    FROM task_assignments ta
    JOIN tasks t ON ta.task_id = t.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    WHERE ta.status = 'APPROVED' AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL) ${timeClauseTA}
  `).all();

  // 2. Fetch mentor assessment sparks
  const { results: tRows } = await db.prepare(`
    SELECT t.created_by AS userId, COALESCE(t.sparks, 0) AS sparks
    FROM tasks t
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    WHERE t.task_type = 'ASSESSMENT' AND t.status = 'APPROVED' AND t.sparks IS NOT NULL AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL) ${timeClauseT}
  `).all();

  // 3. Fetch sparks adjustments (APPRECIATION, RESET, RESTORE)
  const { results: saRows } = await db.prepare(`
    SELECT sa.user_id AS userId, sa.type, sa.sparks, sa.category
    FROM sparks_adjustments sa
    WHERE 1=1 ${timeClauseSA}
  `).all();

  // 4. Fetch active users with roles
  const { results: userRows } = await db.prepare(`
    SELECT u.id AS userId, u.name AS userName, u.email AS userEmail, u.user_type AS userType,
           GROUP_CONCAT(DISTINCT r.name) AS roleNames
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.status = 'ACTIVE'
    GROUP BY u.id
  `).all();

  // Aggregators
  const userSparksMap: Record<string, { total: number; tasks: number; assessments: number; appreciations: number }> = {};

  let totalTroopersSparks = 0;
  let totalAssessmentSparks = 0;
  let totalAppreciationSparks = 0;
  let totalResetSparks = 0;
  let totalRestoredSparks = 0;

  // Process Task Assignments
  for (const r of taRows as any[]) {
    const userId = r.userId;
    if (!userSparksMap[userId]) {
      userSparksMap[userId] = { total: 0, tasks: 0, assessments: 0, appreciations: 0 };
    }
    const raw = Number(r.sparks) || 8;
    const roleMult = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.role) ? 2 : 1;
    let qualMult = 1.0;
    if (r.isZeroRev && r.isOnTime) qualMult = 1.21;
    else if (r.isZeroRev || r.isOnTime) qualMult = 1.10;

    const weighted = Math.round(raw * roleMult * qualMult);
    userSparksMap[userId].total += weighted;
    userSparksMap[userId].tasks += 1;
    totalTroopersSparks += weighted;
  }

  // Process Mentor Assessment Tasks
  for (const r of tRows as any[]) {
    const userId = r.userId;
    if (!userSparksMap[userId]) {
      userSparksMap[userId] = { total: 0, tasks: 0, assessments: 0, appreciations: 0 };
    }
    const sparksVal = Number(r.sparks) || 0;
    userSparksMap[userId].total += sparksVal;
    userSparksMap[userId].assessments += 1;
    totalAssessmentSparks += sparksVal;
  }

  // Process Adjustments
  for (const r of saRows as any[]) {
    const userId = r.userId;
    if (!userSparksMap[userId]) {
      userSparksMap[userId] = { total: 0, tasks: 0, assessments: 0, appreciations: 0 };
    }
    const sparksVal = Number(r.sparks) || 0;
    userSparksMap[userId].total += sparksVal;

    if (r.type === 'APPRECIATION') {
      userSparksMap[userId].appreciations += 1;
      totalAppreciationSparks += sparksVal;
    } else if (r.type === 'RESET') {
      totalResetSparks += Math.abs(sparksVal);
    } else if (r.type === 'RESTORE') {
      totalRestoredSparks += sparksVal;
    }
  }

  // Filter & Rank Users: Strictly MENTOR and TROOPERS roles (or users with Sparks history)
  const rankedUsers: UserSparksRankItem[] = (userRows as any[])
    .map((u) => {
      const stats = userSparksMap[u.userId] || { total: 0, tasks: 0, assessments: 0, appreciations: 0 };
      const rUpper = ((u.roleNames || '') + ' ' + (u.userType || '')).toUpperCase();
      const isMentorOrTrooper =
        rUpper.includes('MENTOR') ||
        rUpper.includes('TROOPER') ||
        rUpper.includes('OJT') ||
        u.userType === 'OJT';

      const hasSparksIncome = stats.tasks > 0 || stats.assessments > 0 || stats.appreciations > 0 || stats.total > 0;

      // Exclude Coordinator and non-sparks roles
      if (!isMentorOrTrooper && !hasSparksIncome) {
        return null;
      }

      return {
        rank: 0,
        userId: u.userId,
        userName: u.userName || 'Pengguna',
        userEmail: u.userEmail,
        userType: u.userType || 'OJT',
        roleNames: u.roleNames || '',
        totalSparks: Math.max(0, stats.total),
        tasksCompleted: stats.tasks,
        assessmentsCount: stats.assessments,
        appreciationCount: stats.appreciations,
      };
    })
    .filter((u): u is UserSparksRankItem => u !== null)
    .sort((a, b) => b.totalSparks - a.totalSparks || b.tasksCompleted - a.tasksCompleted)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const totalDistributed = totalTroopersSparks + totalAssessmentSparks + totalAppreciationSparks + totalRestoredSparks;

  return {
    stats: {
      totalDistributed,
      troopersSparks: totalTroopersSparks,
      assessmentSparks: totalAssessmentSparks,
      appreciationSparks: totalAppreciationSparks,
      resetSparks: totalResetSparks,
      restoredSparks: totalRestoredSparks,
    },
    users: rankedUsers,
  };
}

/**
 * Add Personal Appreciation Sparks to a User
 */
export async function addPersonalAppreciationSparksAction(
  targetUserId: string,
  sparksAmount: number,
  note: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const isAuth = await canManageSparks(session.userId);
  if (!isAuth) {
    return { success: false, error: 'Forbidden: Anda tidak memiliki wewenang memberikan apresiasi Sparks.' };
  }

  if (!sparksAmount || sparksAmount < 1) {
    return { success: false, error: 'Jumlah Sparks minimal 1.' };
  }

  const db = await getDB();
  const id = `sa_${crypto.randomUUID().replace(/-/g, '')}`;
  const cleanNote = note?.trim() || 'Apresiasi Personal dari Admin/Koordinator';

  try {
    await db
      .prepare(`
        INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at)
        VALUES (?, ?, 'APPRECIATION', ?, 'APPRECIATION', ?, ?, strftime('%s', 'now'))
      `)
      .bind(id, targetUserId, sparksAmount, cleanNote, session.userId)
      .run();

    revalidatePath('/dashboard/sparks');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/leaderboard');

    return { success: true, message: `✓ ${sparksAmount} ✨ Apresiasi Personal berhasil diberikan!` };
  } catch (err: any) {
    console.error('addPersonalAppreciationSparksAction failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reset Sparks Total of a User (without deleting history logs)
 */
export async function resetUserSparksAction(targetUserId: string, note?: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const isAuth = await canManageSparks(session.userId);
  if (!isAuth) {
    return { success: false, error: 'Forbidden: Anda tidak memiliki wewenang mereset Sparks.' };
  }

  const db = await getDB();

  // Calculate current effective total Sparks for the user
  const overview = await getSparksManagementOverview('all');
  const userRank = overview.users.find((u) => u.userId === targetUserId);
  const currentTotal = userRank ? userRank.totalSparks : 0;

  if (currentTotal <= 0) {
    return { success: false, error: 'Sparks pengguna sudah 0.' };
  }

  const id = `sa_${crypto.randomUUID().replace(/-/g, '')}`;
  const resetNote = note?.trim() || 'Reset Sparks oleh Admin/Koordinator';

  try {
    await db
      .prepare(`
        INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at)
        VALUES (?, ?, 'RESET', ?, 'ALL', ?, ?, strftime('%s', 'now'))
      `)
      .bind(id, targetUserId, -currentTotal, resetNote, session.userId)
      .run();

    revalidatePath('/dashboard/sparks');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/leaderboard');

    return { success: true, message: `✓ Total Sparks pengguna berhasil di-reset menjadi 0.` };
  } catch (err: any) {
    console.error('resetUserSparksAction failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Restore Sparks to a User based on Historical Category.
 * Calculations ensure pre-reset sparks are added directly to whatever current sparks the user holds:
 * Total Sparks After Restore = Current Sparks + Pre-Reset Historical Sparks
 */
export async function restoreUserSparksAction(
  targetUserId: string,
  category: 'ALL' | 'TASKS' | 'ASSESSMENT' | 'APPRECIATION' = 'ALL',
  note?: string
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const isAuth = await canManageSparks(session.userId);
  if (!isAuth) {
    return { success: false, error: 'Forbidden: Anda tidak memiliki wewenang mengembalikan Sparks.' };
  }

  const db = await getDB();

  // 1. Find the latest RESET timestamp for this user if any
  const latestResetRow = await db
    .prepare(`
      SELECT sparks, created_at
      FROM sparks_adjustments
      WHERE user_id = ? AND type = 'RESET'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(targetUserId)
    .first() as { sparks: number; created_at: number } | null;

  let preResetHistoricalSparks = 0;

  if (latestResetRow) {
    const resetTime = latestResetRow.created_at;

    if (category === 'ALL') {
      // Amount reset at latest reset time
      preResetHistoricalSparks = Math.abs(Number(latestResetRow.sparks) || 0);
    }

    if (preResetHistoricalSparks === 0) {
      // Calculate category sparks earned BEFORE resetTime
      if (category === 'ALL' || category === 'TASKS') {
        const { results: taRows } = await db
          .prepare(`
            SELECT ta.sparks, ta.assignment_role AS role,
                   CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END AS isZeroRev,
                   CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END AS isOnTime
            FROM task_assignments ta
            JOIN tasks t ON ta.task_id = t.id
            WHERE ta.user_id = ? AND ta.status = 'APPROVED' AND t.status != 'DELETED'
              AND COALESCE(ta.reviewed_at, ta.submitted_at) <= ?
          `)
          .bind(targetUserId, resetTime)
          .all();

        for (const r of taRows as any[]) {
          const raw = Number(r.sparks) || 8;
          const roleMult = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.role) ? 2 : 1;
          let qualMult = 1.0;
          if (r.isZeroRev && r.isOnTime) qualMult = 1.21;
          else if (r.isZeroRev || r.isOnTime) qualMult = 1.10;
          preResetHistoricalSparks += Math.round(raw * roleMult * qualMult);
        }
      }

      if (category === 'ALL' || category === 'ASSESSMENT') {
        const { results: tRows } = await db
          .prepare(`
            SELECT COALESCE(sparks, 0) AS sparks
            FROM tasks
            WHERE created_by = ? AND task_type = 'ASSESSMENT' AND status = 'APPROVED' AND sparks IS NOT NULL
              AND COALESCE(start_at, created_at) <= ?
          `)
          .bind(targetUserId, resetTime)
          .all();

        for (const r of tRows as any[]) {
          preResetHistoricalSparks += Number(r.sparks) || 0;
        }
      }

      if (category === 'ALL' || category === 'APPRECIATION') {
        const { results: saRows } = await db
          .prepare(`
            SELECT COALESCE(sparks, 0) AS sparks
            FROM sparks_adjustments
            WHERE user_id = ? AND type = 'APPRECIATION' AND created_at <= ?
          `)
          .bind(targetUserId, resetTime)
          .all();

        for (const r of saRows as any[]) {
          preResetHistoricalSparks += Number(r.sparks) || 0;
        }
      }
    }
  } else {
    // No reset ever occurred: calculate all historical sparks in category
    if (category === 'ALL' || category === 'TASKS') {
      const { results: taRows } = await db
        .prepare(`
          SELECT ta.sparks, ta.assignment_role AS role,
                 CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END AS isZeroRev,
                 CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END AS isOnTime
          FROM task_assignments ta
          JOIN tasks t ON ta.task_id = t.id
          WHERE ta.user_id = ? AND ta.status = 'APPROVED' AND t.status != 'DELETED'
        `)
        .bind(targetUserId)
        .all();

      for (const r of taRows as any[]) {
        const raw = Number(r.sparks) || 8;
        const roleMult = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.role) ? 2 : 1;
        let qualMult = 1.0;
        if (r.isZeroRev && r.isOnTime) qualMult = 1.21;
        else if (r.isZeroRev || r.isOnTime) qualMult = 1.10;
        preResetHistoricalSparks += Math.round(raw * roleMult * qualMult);
      }
    }

    if (category === 'ALL' || category === 'ASSESSMENT') {
      const { results: tRows } = await db
        .prepare(`
          SELECT COALESCE(sparks, 0) AS sparks
          FROM tasks
          WHERE created_by = ? AND task_type = 'ASSESSMENT' AND status = 'APPROVED' AND sparks IS NOT NULL
        `)
        .bind(targetUserId)
        .all();

      for (const r of tRows as any[]) {
        preResetHistoricalSparks += Number(r.sparks) || 0;
      }
    }

    if (category === 'ALL' || category === 'APPRECIATION') {
      const { results: saRows } = await db
        .prepare(`
          SELECT COALESCE(sparks, 0) AS sparks
          FROM sparks_adjustments
          WHERE user_id = ? AND type = 'APPRECIATION'
        `)
        .bind(targetUserId)
        .all();

      for (const r of saRows as any[]) {
        preResetHistoricalSparks += Number(r.sparks) || 0;
      }
    }
  }

  if (preResetHistoricalSparks <= 0) {
    return { success: false, error: 'Tidak ada riwayat Sparks historis yang dapat dikembalikan.' };
  }

  const id = `sa_${crypto.randomUUID().replace(/-/g, '')}`;
  const categoryLabelMap: Record<string, string> = {
    ALL: 'Semua Kategori',
    TASKS: 'Troopers Tasks',
    ASSESSMENT: 'Brief Assessment',
    APPRECIATION: 'Apresiasi Personal',
  };
  const catLabel = categoryLabelMap[category] || category;
  const restoreNote = note?.trim() || `Pengembalian Sparks (Restore): ${catLabel}`;

  try {
    await db
      .prepare(`
        INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at)
        VALUES (?, ?, 'RESTORE', ?, ?, ?, ?, strftime('%s', 'now'))
      `)
      .bind(id, targetUserId, preResetHistoricalSparks, category, restoreNote, session.userId)
      .run();

    revalidatePath('/dashboard/sparks');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/leaderboard');

    return {
      success: true,
      message: `✓ +${preResetHistoricalSparks} ✨ Sparks (${catLabel}) berhasil dikembalikan (Total terkini = Saldo saat ini + ${preResetHistoricalSparks})!`,
    };
  } catch (err: any) {
    console.error('restoreUserSparksAction failed:', err);
    return { success: false, error: err.message };
  }
}
