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

  // 0. Fetch category multipliers
  const { results: settingsRows } = await db
    .prepare("SELECT key, value FROM system_settings WHERE key IN ('category_multiplier_design', 'category_multiplier_video')")
    .all();

  let designMultiplier = 1.0;
  let videoMultiplier = 1.0;
  for (const row of (settingsRows || []) as any[]) {
    if (row.key === 'category_multiplier_design') designMultiplier = Number(row.value) || 1.0;
    if (row.key === 'category_multiplier_video') videoMultiplier = Number(row.value) || 1.0;
  }

  // 1. Fetch task assignment sparks
  const { results: taRows } = await db.prepare(`
    SELECT ta.user_id AS userId, ta.sparks, ta.assignment_role AS role,
           t.task_type, t.title AS taskTitle, COALESCE(t.sparks_multiplier, 1.0) AS customTaskMultiplier,
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
    const customTaskMult = Number(r.customTaskMultiplier) || 1.0;
    const isDesign = r.role === 'DESIGNER' || r.task_type === 'DESIGN' || (r.taskTitle && r.taskTitle.toUpperCase().includes('DESIGN'));
    const isVideo = r.role === 'VIDEO_EDITOR' || r.task_type === 'VIDEO' || (r.taskTitle && r.taskTitle.toUpperCase().includes('VIDEO'));

    const catMult = isDesign ? designMultiplier : isVideo ? videoMultiplier : 1.0;
    const effectiveTaskMult = customTaskMult !== 1.0 ? customTaskMult : catMult;

    const roleMult = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.role) ? 2 : 1;
    let qualMult = 1.0;
    if (r.isZeroRev && r.isOnTime) qualMult = 1.21;
    else if (r.isZeroRev || r.isOnTime) qualMult = 1.10;

    const baseFormulaSparks = Math.round(raw * roleMult * qualMult);
    const weighted = Math.round(baseFormulaSparks * effectiveTaskMult);
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

  const totalDistributed = rankedUsers.reduce((sum, u) => sum + u.totalSparks, 0);

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

  // 1. Calculate cumulative total reset penalties for this user
  const resetStats = await db
    .prepare(`
      SELECT COALESCE(SUM(ABS(sparks)), 0) AS totalResetAmount
      FROM sparks_adjustments
      WHERE user_id = ? AND type = 'RESET'
    `)
    .bind(targetUserId)
    .first() as { totalResetAmount: number } | null;

  const totalResetAmount = Math.max(0, Number(resetStats?.totalResetAmount) || 0);

  if (totalResetAmount <= 0) {
    return {
      success: false,
      error: 'Pengguna belum pernah mengalami Reset Sparks. Seluruh Sparks historis sudah aktif.',
    };
  }

  // 2. Calculate cumulative total Sparks already RESTORED for this user
  const restoreStats = await db
    .prepare(`
      SELECT COALESCE(SUM(sparks), 0) AS totalRestoredAmount
      FROM sparks_adjustments
      WHERE user_id = ? AND type = 'RESTORE'
    `)
    .bind(targetUserId)
    .first() as { totalRestoredAmount: number } | null;

  const totalRestoredAmount = Math.max(0, Number(restoreStats?.totalRestoredAmount) || 0);
  const remainingResetPenalty = totalResetAmount - totalRestoredAmount;

  if (remainingResetPenalty <= 0) {
    return {
      success: false,
      error: `Seluruh Sparks yang di-reset (${totalResetAmount} ✨) sudah dikembalikan.`,
    };
  }

  let preResetHistoricalSparks = 0;

  if (category === 'ALL') {
    preResetHistoricalSparks = remainingResetPenalty;
  } else {
    if (category === 'TASKS') {
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
    } else if (category === 'ASSESSMENT') {
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
    } else if (category === 'APPRECIATION') {
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

    preResetHistoricalSparks = Math.min(preResetHistoricalSparks, remainingResetPenalty);
  }

  if (preResetHistoricalSparks <= 0) {
    return {
      success: false,
      error: `Tidak ada Sparks kategori ${category} yang dapat dikembalikan.`,
    };
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
      message: `✓ +${preResetHistoricalSparks} ✨ Sparks (${catLabel}) berhasil dikembalikan!`,
    };
  } catch (err: any) {
    console.error('restoreUserSparksAction failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a specific sparks adjustment entry (APPRECIATION, RESET, or RESTORE) by ID.
 * Only authorized managers (Coordinators / Admins) can perform this.
 */
export async function deleteSparksAdjustmentAction(adjustmentId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const isAuth = await canManageSparks(session.userId);
  if (!isAuth) {
    return { success: false, error: 'Forbidden: Anda tidak memiliki wewenang menghapus log Sparks.' };
  }

  const db = await getDB();
  try {
    const row = await db
      .prepare('SELECT user_id, type, sparks FROM sparks_adjustments WHERE id = ?')
      .bind(adjustmentId)
      .first() as { user_id: string; type: string; sparks: number } | null;

    if (!row) {
      return { success: false, error: 'Entri log tidak ditemukan.' };
    }

    await db.prepare('DELETE FROM sparks_adjustments WHERE id = ?').bind(adjustmentId).run();

    revalidatePath('/dashboard/sparks');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/leaderboard');

    return { success: true, message: '✓ Entri log berhasil dihapus.' };
  } catch (err: any) {
    console.error('deleteSparksAdjustmentAction failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Clear all sparks adjustments (APPRECIATION, RESET, RESTORE) for a specific user, or filtered by type.
 * Only authorized managers (Coordinators / Admins) can perform this.
 */
export async function clearAllSparksAdjustmentsAction(
  targetUserId: string,
  filterType?: 'ALL' | 'APPRECIATION' | 'ADJUSTMENT'
) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const isAuth = await canManageSparks(session.userId);
  if (!isAuth) {
    return { success: false, error: 'Forbidden: Anda tidak memiliki wewenang membersihkan log Sparks.' };
  }

  const db = await getDB();
  try {
    if (filterType === 'APPRECIATION') {
      await db
        .prepare("DELETE FROM sparks_adjustments WHERE user_id = ? AND type = 'APPRECIATION'")
        .bind(targetUserId)
        .run();
    } else if (filterType === 'ADJUSTMENT') {
      await db
        .prepare("DELETE FROM sparks_adjustments WHERE user_id = ? AND type IN ('RESET', 'RESTORE')")
        .bind(targetUserId)
        .run();
    } else {
      await db
        .prepare('DELETE FROM sparks_adjustments WHERE user_id = ?')
        .bind(targetUserId)
        .run();
    }

    revalidatePath('/dashboard/sparks');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/leaderboard');

    return { success: true, message: '✓ Seluruh log penyesuaian Sparks berhasil dibersihkan.' };
  } catch (err: any) {
    console.error('clearAllSparksAdjustmentsAction failed:', err);
    return { success: false, error: err.message };
  }
}
