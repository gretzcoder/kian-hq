'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { logWorkflowEvent } from '@/modules/workflow/events';
import {
  BadgeCategory,
  BadgeItem,
  BadgeOwner,
  CATEGORY_META,
  RECOMMENDED_CATEGORY_SPARKS,
  RequirementItemProgress,
  RequirementType,
} from './badgeTypes';



let badgeColumnsEnsured = false;

/**
 * Safely parse date string (YYYY-MM-DD, DD/MM/YYYY, or ISO) to WIB start timestamp (seconds)
 */
function parseCutoffTimestamp(dateStr?: string | null): number {
  if (!dateStr || !dateStr.trim()) return 0;
  const str = dateStr.trim();
  let year: number, month: number, day: number;

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else {
    const d = new Date(str);
    return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return 0;
  const utcMs = Date.UTC(year, month, day, 0, 0, 0) - 7 * 3600 * 1000;
  return Math.floor(utcMs / 1000);
}

/**
 * Filter achievements for a badge condition considering cutoff date, rank 1 requirement, and closed periods
 */
function filterAchievementsForCondition(achievements: any[], cond: any, nowSec: number): any[] {
  const catKey = cond.category;
  const periodType = cond.periodType || 'ANY';

  return achievements.filter((a) => {
    // 1. Must be a completed/earned achievement up to now (earned_at <= nowSec)
    const itemEarnedSec = typeof a.earned_at === 'number' && a.earned_at > 10000000000
      ? Math.floor(a.earned_at / 1000)
      : Number(a.earned_at) || 0;
    if (itemEarnedSec > nowSec) return false;

    // 2. Category check
    if (catKey !== 'ALL' && a.category !== catKey) return false;

    // 3. Rank check: for CHAMPION or specific title requirement, must be rank 1 unless maxRank specified
    const maxRankAllowed = typeof cond.maxRank === 'number' ? cond.maxRank : 1;
    if (typeof a.rank === 'number' && a.rank > maxRankAllowed) return false;

    // 4. Period type check (WEEKLY vs MONTHLY)
    if (periodType === 'WEEKLY' && !a.period.toLowerCase().includes('week')) return false;
    if (periodType === 'MONTHLY' && a.period.toLowerCase().includes('week')) return false;

    // 5. Cutoff date check
    if (cond.startDate) {
      const startTs = parseCutoffTimestamp(cond.startDate);
      if (startTs > 0 && itemEarnedSec < startTs) return false;
    }

    return true;
  });
}

const badgeEvaluationThrottleMap = new Map<string, number>();
const BADGE_EVAL_THROTTLE_MS = 180_000; // 3 minutes

/**
 * Global Evaluator: Auto-awards badges to users who satisfy task/workspace/achievement requirements
 */
export async function evaluateAndAutoAwardBadges(targetUserId?: string): Promise<number> {
  const session = await getSession();
  const userId = targetUserId || session?.userId;
  if (!userId) return 0;

  const now = Date.now();
  const lastEval = badgeEvaluationThrottleMap.get(userId) || 0;
  if (now - lastEval < BADGE_EVAL_THROTTLE_MS) {
    return 0;
  }
  badgeEvaluationThrottleMap.set(userId, now);

  const db = await getDB();

  try {
    // 0. Ensure D1 columns exist (run once)
    if (!badgeColumnsEnsured) {
      try { await db.prepare("ALTER TABLE badges ADD COLUMN is_continuous_earning INTEGER DEFAULT 0").run(); } catch {}
      try { await db.prepare("ALTER TABLE user_badges ADD COLUMN claim_count INTEGER DEFAULT 1").run(); } catch {}
      badgeColumnsEnsured = true;
    }

    // 1. Fetch active badges with requirements
    const { results: rawBadges } = await db
      .prepare("SELECT id, name, category, requirement_type, requirement_data, is_continuous_earning, sparks_reward FROM badges WHERE requirement_type IN ('TASK', 'WORKSPACE', 'ACHIEVEMENT')")
      .all();

    if (!rawBadges || rawBadges.length === 0) return 0;

    let newAwardCount = 0;

    // --- A. TASK & WORKSPACE EVALUATOR ---
    const taskOrWsBadges = (rawBadges as any[]).filter((b) => b.requirement_type === 'TASK' || b.requirement_type === 'WORKSPACE');
    if (taskOrWsBadges.length > 0) {
      const userClause = targetUserId ? 'AND ta.user_id = ?' : '';
      const queryParams = targetUserId ? [targetUserId] : [];

      const { results: approvedAssignments } = await db
        .prepare(`
          SELECT ta.user_id, ta.task_id
          FROM task_assignments ta
          JOIN tasks t ON ta.task_id = t.id
          LEFT JOIN workspaces ws ON t.workspace_id = ws.id
          WHERE ta.status IN ('APPROVED', 'DONE', 'PUBLISHED')
            AND t.status != 'DELETED'
            AND (ws.id IS NULL OR ws.deleted_at IS NULL)
            ${userClause}
        `)
        .bind(...queryParams)
        .all();

      if (approvedAssignments && approvedAssignments.length > 0) {
        const userTaskMap = new Map<string, Set<string>>();
        (approvedAssignments as any[]).forEach((row) => {
          if (!userTaskMap.has(row.user_id)) {
            userTaskMap.set(row.user_id, new Set());
          }
          userTaskMap.get(row.user_id)!.add(row.task_id);
        });

        const hasWorkspaceReq = taskOrWsBadges.some((b) => b.requirement_type === 'WORKSPACE');
        const workspaceTasksMap = new Map<string, string[]>();

        if (hasWorkspaceReq) {
          const { results: allTasksRaw } = await db
            .prepare(`
              SELECT t.id, t.workspace_id
              FROM tasks t
              LEFT JOIN workspaces ws ON t.workspace_id = ws.id
              WHERE t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
            `)
            .all();

          (allTasksRaw as any[] || []).forEach((t) => {
            if (t.workspace_id) {
              if (!workspaceTasksMap.has(t.workspace_id)) {
                workspaceTasksMap.set(t.workspace_id, []);
              }
              workspaceTasksMap.get(t.workspace_id)!.push(t.id);
            }
          });
        }

        const ubClause = targetUserId ? 'WHERE user_id = ?' : '';
        const ubParams = targetUserId ? [targetUserId] : [];

        const { results: existingUserBadges } = await db
          .prepare(`SELECT user_id, badge_id FROM user_badges ${ubClause}`)
          .bind(...ubParams)
          .all();

        const userBadgeSet = new Set<string>();
        (existingUserBadges as any[] || []).forEach((ub) => {
          userBadgeSet.add(`${ub.user_id}::${ub.badge_id}`);
        });

        const batchStatements: any[] = [];

        for (const [userId, completedTasks] of userTaskMap.entries()) {
          for (const b of taskOrWsBadges) {
            const badgeId = b.id;
            const key = `${userId}::${badgeId}`;
            if (userBadgeSet.has(key)) continue;

            let reqIds: string[] = [];
            if (b.requirement_data) {
              try { reqIds = JSON.parse(b.requirement_data); } catch {}
            }
            if (reqIds.length === 0) continue;

            const reqType = b.requirement_type;
            let allSatisfied = false;

            if (reqType === 'TASK') {
              allSatisfied = reqIds.every((tId) => completedTasks.has(tId));
            } else if (reqType === 'WORKSPACE') {
              allSatisfied = reqIds.every((wsId) => {
                const wsTasks = workspaceTasksMap.get(wsId) || [];
                return wsTasks.length > 0 && wsTasks.every((tId) => completedTasks.has(tId));
              });
            }

            if (allSatisfied) {
              const userBadgeId = `ub_${crypto.randomUUID().replace(/-/g, '')}`;
              batchStatements.push(
                db.prepare(`
                  INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_by, awarded_at, claim_count)
                  VALUES (?, ?, ?, 'SYSTEM_AUTO', ?, 1)
                `).bind(userBadgeId, userId, badgeId, now)
              );
              newAwardCount++;
              userBadgeSet.add(key);
            }
          }
        }

        if (batchStatements.length > 0) {
          await db.batch(batchStatements);
        }
      }
    }

    // --- B. ACHIEVEMENT & CONTINUOUS EARNING EVALUATOR ---
    const achievementBadges = (rawBadges as any[]).filter((b) => b.requirement_type === 'ACHIEVEMENT');
    if (achievementBadges.length > 0) {
      const achClause = targetUserId ? 'WHERE ah.user_id = ?' : '';
      const achParams = targetUserId ? [targetUserId] : [];

      const { results: rawAchievements } = await db
        .prepare(`
          SELECT ah.user_id, ah.category, ah.period, ah.earned_at, ah.rank
          FROM achievement_history ah
          JOIN users u ON ah.user_id = u.id
          WHERE u.status = 'ACTIVE'
          ${achClause}
          ORDER BY ah.user_id, ah.earned_at ASC
        `)
        .bind(...achParams)
        .all();

      const userAchievementsMap = new Map<string, any[]>();
      (rawAchievements as any[] || []).forEach((row) => {
        if (!userAchievementsMap.has(row.user_id)) {
          userAchievementsMap.set(row.user_id, []);
        }
        userAchievementsMap.get(row.user_id)!.push(row);
      });

      const ubClause = targetUserId ? 'WHERE user_id = ?' : '';
      const ubParams = targetUserId ? [targetUserId] : [];

      const { results: existingBadges } = await db
        .prepare(`SELECT id, user_id, badge_id, claim_count FROM user_badges ${ubClause}`)
        .bind(...ubParams)
        .all();

      const userBadgeInfoMap = new Map<string, { id: string; claimCount: number }>();
      (existingBadges as any[] || []).forEach((ub) => {
        userBadgeInfoMap.set(`${ub.user_id}::${ub.badge_id}`, {
          id: ub.id,
          claimCount: ub.claim_count || 1,
        });
      });

      for (const [userId, achievements] of userAchievementsMap.entries()) {
        for (const b of achievementBadges) {
          const badgeId = b.id;
          const key = `${userId}::${badgeId}`;
          const existingUB = userBadgeInfoMap.get(key);
          const isContinuous = Boolean(b.is_continuous_earning);

          if (existingUB && !isContinuous) {
            continue;
          }

          let conditions: any[] = [];
          if (b.requirement_data) {
            try { conditions = JSON.parse(b.requirement_data); } catch {}
          }
          if (conditions.length === 0) continue;

          let minSatisfiedSets = Infinity;

          for (const cond of conditions) {
            const conditionType = cond.conditionType || 'COUNT';
            const filtered = filterAchievementsForCondition(achievements, cond, Math.floor(now / 1000));

            if (conditionType === 'COUNT') {
              const totalCount = filtered.length;
              const timesAchieved = Math.floor(totalCount / (cond.minCount || 1));
              if (timesAchieved < minSatisfiedSets) minSatisfiedSets = timesAchieved;
            } else if (conditionType === 'STREAK') {
              let maxStreak = 0;
              let currentStreak = 0;
              filtered.forEach((_a) => {
                currentStreak++;
                if (currentStreak > maxStreak) maxStreak = currentStreak;
              });
              const timesAchieved = Math.floor(maxStreak / (cond.minCount || 1));
              if (timesAchieved < minSatisfiedSets) minSatisfiedSets = timesAchieved;
            }
          }

          if (minSatisfiedSets === Infinity || minSatisfiedSets < 1) {
            // Revoke unearned badge grants if previously auto-awarded in error
            if (existingUB) {
              await db.prepare("DELETE FROM user_badges WHERE id = ? AND (awarded_by = 'SYSTEM_AUTO' OR awarded_by IS NULL)").bind(existingUB.id).run();
              await db.prepare("DELETE FROM sparks_adjustments WHERE user_id = ? AND badge_id = ? AND category = 'BADGE_REWARD'").bind(userId, badgeId).run();
              userBadgeInfoMap.delete(key);
            }
            continue;
          }

          if (!existingUB) {
            // First award
            const userBadgeId = `ub_${crypto.randomUUID().replace(/-/g, '')}`;
            await db.prepare(`
              INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_by, awarded_at, claim_count, claimed_at)
              VALUES (?, ?, ?, 'SYSTEM_AUTO', ?, ?, ?)
            `).bind(userBadgeId, userId, badgeId, now, 1, now).run();

            if (b.sparks_reward > 0) {
              const adjId = `spk_${crypto.randomUUID().replace(/-/g, '')}`;
              const note = `Claim Reward Badge: ${b.name}`;
              await db.prepare(`
                INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at, badge_id)
                VALUES (?, ?, 'APPRECIATION', ?, 'BADGE_REWARD', ?, 'SYSTEM_AUTO', strftime('%s', 'now'), ?)
              `).bind(adjId, userId, b.sparks_reward, note, badgeId).run();
            }

            userBadgeInfoMap.set(key, { id: userBadgeId, claimCount: 1 });
            newAwardCount++;
          } else if (isContinuous && minSatisfiedSets > existingUB.claimCount) {
            // Continuous Earning Trigger!
            const newClaimCount = minSatisfiedSets;
            await db.prepare(`
              UPDATE user_badges
              SET claim_count = ?, claimed_at = ?
              WHERE id = ?
            `).bind(newClaimCount, now, existingUB.id).run();

            if (b.sparks_reward > 0) {
              const adjId = `spk_${crypto.randomUUID().replace(/-/g, '')}`;
              const note = `Continuous Earning Badge: ${b.name} (${newClaimCount}x)`;
              await db.prepare(`
                INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at, badge_id)
                VALUES (?, ?, 'APPRECIATION', ?, 'BADGE_REWARD', ?, 'SYSTEM_AUTO', strftime('%s', 'now'), ?)
              `).bind(adjId, userId, b.sparks_reward, note, badgeId).run();
            }

            userBadgeInfoMap.set(key, { id: existingUB.id, claimCount: newClaimCount });
            newAwardCount++;
          }
        }
      }
    }

    return newAwardCount;
  } catch (e) {
    console.error('Error in evaluateAndAutoAwardBadges:', e);
    return 0;
  }
}

/**
 * Helper to process image file to Base64 Data URI if direct file upload
 */
async function processIconInput(iconFile: File | null, iconUrlInput: string | null): Promise<string | null> {
  if (iconFile && iconFile.size > 0) {
    if (iconFile.size > 3 * 1024 * 1024) {
      throw new Error('Ukuran file logo maksimal 3MB.');
    }
    const buffer = await iconFile.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = iconFile.type || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  }
  if (iconUrlInput && iconUrlInput.trim()) {
    return iconUrlInput.trim();
  }
  return null;
}

/**
 * Fetch all badges with user ownership progress & requirement auto-evaluation
 */
export async function getAllBadgesWithUserProgress(): Promise<{
  success: boolean;
  badges?: BadgeItem[];
  userOwnedCount?: number;
  totalBadgeCount?: number;
  isManager?: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isManager =
    ctx.userType === 'STAFF' ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  try {
    // 0. Auto-evaluate and award badges for all users with completed requirements
    await evaluateAndAutoAwardBadges();

    // Retroactively sync all past BADGE_REWARD sparks_adjustments to match current badge.sparks_reward
    await db.prepare(`
      UPDATE sparks_adjustments
      SET sparks = (
        SELECT b.sparks_reward FROM badges b WHERE b.id = sparks_adjustments.badge_id
      )
      WHERE category = 'BADGE_REWARD'
        AND badge_id IS NOT NULL
        AND badge_id IN (SELECT id FROM badges)
        AND sparks != (SELECT b.sparks_reward FROM badges b WHERE b.id = sparks_adjustments.badge_id)
    `).run();

    // Link unlinked BADGE_REWARD adjustments by matching badge title
    await db.prepare(`
      UPDATE sparks_adjustments
      SET badge_id = (
        SELECT b.id FROM badges b WHERE sparks_adjustments.note LIKE '%' || b.name || '%' LIMIT 1
      ),
      sparks = (
        SELECT b.sparks_reward FROM badges b WHERE sparks_adjustments.note LIKE '%' || b.name || '%' LIMIT 1
      )
      WHERE category = 'BADGE_REWARD'
        AND (badge_id IS NULL OR badge_id = '')
        AND EXISTS (
          SELECT 1 FROM badges b WHERE sparks_adjustments.note LIKE '%' || b.name || '%'
        )
    `).run();

    // Backfill user_badges.claimed_at and sync awarded_at date with actual claim log timestamp
    await db.prepare(`
      UPDATE user_badges
      SET claimed_at = (
        SELECT COALESCE(sa.created_at * 1000, strftime('%s', 'now') * 1000)
        FROM sparks_adjustments sa
        WHERE sa.user_id = user_badges.user_id
          AND sa.category = 'BADGE_REWARD'
          AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || (SELECT name FROM badges WHERE id = user_badges.badge_id) || '%')
        LIMIT 1
      )
      WHERE claimed_at IS NULL
        AND EXISTS (
          SELECT 1 FROM sparks_adjustments sa
          WHERE sa.user_id = user_badges.user_id
            AND sa.category = 'BADGE_REWARD'
            AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || (SELECT name FROM badges WHERE id = user_badges.badge_id) || '%')
        )
    `).run();

    // Sync awarded_at timestamp to match earliest claim date when awarded_at is newer than claim timestamp
    await db.prepare(`
      UPDATE user_badges
      SET awarded_at = (
        SELECT sa.created_at * 1000
        FROM sparks_adjustments sa
        WHERE sa.user_id = user_badges.user_id
          AND sa.category = 'BADGE_REWARD'
          AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || (SELECT name FROM badges WHERE id = user_badges.badge_id) || '%')
        ORDER BY sa.created_at ASC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM sparks_adjustments sa
        WHERE sa.user_id = user_badges.user_id
          AND sa.category = 'BADGE_REWARD'
          AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || (SELECT name FROM badges WHERE id = user_badges.badge_id) || '%')
          AND (sa.created_at * 1000) < user_badges.awarded_at
      )
    `).run();

    // 1. Fetch raw badges
    const { results: rawBadges } = await db
      .prepare('SELECT * FROM badges ORDER BY created_at DESC')
      .all();

    // 2. Fetch user's earned badges & claimed sparks history
    const [userEarnedRes, claimedSparksRes] = await Promise.all([
      db.prepare('SELECT badge_id, awarded_at, claimed_at, claim_count FROM user_badges WHERE user_id = ?')
        .bind(session.userId).all(),
      db.prepare("SELECT badge_id, note FROM sparks_adjustments WHERE user_id = ? AND category = 'BADGE_REWARD'")
        .bind(session.userId).all(),
    ]);

    const userEarnedMap = new Map<string, { awardedAt: number; claimedAt: number | null; claimCount: number }>();
    (userEarnedRes.results as any[] || []).forEach((ub) => {
      userEarnedMap.set(ub.badge_id, { awardedAt: ub.awarded_at, claimedAt: ub.claimed_at || null, claimCount: ub.claim_count || 1 });
    });

    const claimedBadgeIds = new Set<string>();
    const claimedBadgeNotesSet = new Set<string>();
    (claimedSparksRes.results as any[] || []).forEach((row) => {
      if (row.badge_id) claimedBadgeIds.add(row.badge_id);
      if (row.note) claimedBadgeNotesSet.add(row.note.toLowerCase());
    });

    // 3. Fetch all owners for all badges to show badge earners
    const { results: allOwnersRaw } = await db
      .prepare(`
        SELECT ub.badge_id, ub.user_id, ub.awarded_at, ub.awarded_by,
               u.name AS user_name, u.email AS user_email, u.user_type, u.avatar_url
        FROM user_badges ub
        JOIN users u ON ub.user_id = u.id
        WHERE u.status = 'ACTIVE'
        ORDER BY ub.awarded_at DESC
      `)
      .all();

    const badgeOwnersMap = new Map<string, BadgeOwner[]>();
    (allOwnersRaw as any[]).forEach((row) => {
      const bId = row.badge_id;
      if (!badgeOwnersMap.has(bId)) {
        badgeOwnersMap.set(bId, []);
      }
      badgeOwnersMap.get(bId)!.push({
        userId: row.user_id,
        userName: row.user_name || row.user_email || 'User',
        userEmail: row.user_email || '',
        userType: row.user_type || null,
        avatarUrl: row.avatar_url || null,
        awardedAt: row.awarded_at,
        awardedBy: row.awarded_by,
      });
    });

    // 4. Fetch user's task assignments & task statuses for requirement checking
    const { results: userAssignments } = await db
      .prepare(`
        SELECT ta.task_id, ta.status AS assignment_status, t.status AS task_status, t.workspace_id
        FROM task_assignments ta
        JOIN tasks t ON ta.task_id = t.id
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        WHERE ta.user_id = ?
          AND t.status != 'DELETED'
          AND (ws.id IS NULL OR ws.deleted_at IS NULL)
      `)
      .bind(session.userId)
      .all();

    const userCompletedTaskIds = new Set<string>();
    (userAssignments as any[]).forEach((row) => {
      if (['APPROVED', 'DONE', 'PUBLISHED'].includes(row.assignment_status)) {
        userCompletedTaskIds.add(row.task_id);
      }
    });

    // 5. Fetch all tasks and workspaces for requirement title lookups & workspace completion
    const { results: allTasksRaw } = await db
      .prepare(`
        SELECT t.id, t.title, t.workspace_id, t.status
        FROM tasks t
        LEFT JOIN workspaces ws ON t.workspace_id = ws.id
        WHERE t.status != 'DELETED'
          AND (ws.id IS NULL OR ws.deleted_at IS NULL)
      `)
      .all();

    const taskMap = new Map<string, { title: string; workspace_id: string | null; status: string }>();
    (allTasksRaw as any[]).forEach((t) => {
      taskMap.set(t.id, { title: t.title, workspace_id: t.workspace_id, status: t.status });
    });

    const { results: allWorkspacesRaw } = await db
      .prepare('SELECT id, name FROM workspaces WHERE deleted_at IS NULL')
      .all();

    const workspaceMap = new Map<string, string>();
    (allWorkspacesRaw as any[]).forEach((w) => {
      workspaceMap.set(w.id, w.name);
    });

    // 6. Fetch achievement history records for requirement checking
    const { results: allAchievementsRaw } = await db
      .prepare('SELECT user_id, category, period, earned_at, rank FROM achievement_history WHERE user_id = ?')
      .bind(session.userId)
      .all();
    const userAchievementsList = (allAchievementsRaw as any[]) || [];

    // Process badges and check auto-award eligibility
    const badges: BadgeItem[] = [];
    let userOwnedCount = 0;

    for (const b of rawBadges as any[]) {
      const badgeId = b.id;
      const userBadgeInfo = userEarnedMap.get(badgeId);
      let isOwned = Boolean(userBadgeInfo);
      let awardedAt = userBadgeInfo?.awardedAt || null;
      let claimedAt = userBadgeInfo?.claimedAt || null;
      let isSparksClaimed =
        Boolean(claimedAt) ||
        claimedBadgeIds.has(badgeId) ||
        Array.from(claimedBadgeNotesSet).some((note) => note.includes(b.name.toLowerCase()));

      let reqIds: string[] = [];
      if (b.requirement_data) {
        try {
          reqIds = JSON.parse(b.requirement_data);
        } catch {}
      }

      const reqType: RequirementType = b.requirement_type || 'NONE';
      const requirements: RequirementItemProgress[] = [];
      let completedCount = 0;

      if (reqType === 'TASK') {
        reqIds.forEach((tId) => {
          const tInfo = taskMap.get(tId);
          const isDone = userCompletedTaskIds.has(tId);
          if (isDone) completedCount++;

          requirements.push({
            id: tId,
            title: tInfo ? tInfo.title : `Task #${tId.slice(0, 6)}`,
            type: 'TASK',
            completed: isDone,
            statusText: isDone ? '✅ ACC / Disetujui' : '⏳ Belum Disetujui',
          });
        });
      } else if (reqType === 'WORKSPACE') {
        reqIds.forEach((wsId) => {
          const wsName = workspaceMap.get(wsId) || `Workspace #${wsId.slice(0, 6)}`;
          const wsTasks = (allTasksRaw as any[]).filter((t) => t.workspace_id === wsId);
          const totalWsTasks = wsTasks.length;
          const completedWsTasks = wsTasks.filter((t) => userCompletedTaskIds.has(t.id)).length;
          const isWsDone = totalWsTasks > 0 && completedWsTasks === totalWsTasks;

          if (isWsDone) completedCount++;

          requirements.push({
            id: wsId,
            title: wsName,
            type: 'WORKSPACE',
            completed: isWsDone,
            statusText: isWsDone
              ? '✅ Workspace Selesai'
              : `⏳ ${completedWsTasks}/${totalWsTasks} Task ACC`,
          });
        });
      } else if (reqType === 'ACHIEVEMENT') {
        let condItems: any[] = [];
        if (b.requirement_data) {
          try { condItems = JSON.parse(b.requirement_data); } catch {}
        }

        const catLabelMap: Record<string, string> = {
          CHAMPION: '🏆 Champion (Juara Umum)',
          PRODUCTIVE: '⚡ Most Productive',
          QUALITY: '🎯 High Quality',
          WORKSPACE: '🏢 Top Workspaces',
          MENTOR: '🥇 Top Mentors',
          TEAM_LEADER: '👑 Team Leaders',
          DESIGNER: '🎨 Designers',
          VIDEO_EDITOR: '🎬 Video Editors',
          PLANNER: '🧠 Planners',
          RESEARCHER: '🔍 Researchers',
          ALL: '🌟 Semua Kategori Gelar',
        };

        const myAchievements = userAchievementsList.filter((a) => a.user_id === session.userId);

        condItems.forEach((cond) => {
          const catName = catLabelMap[cond.category] || cond.category;
          const typeName = cond.conditionType === 'STREAK' ? 'Streak Beruntun' : 'Total Menang';
          const periodName = cond.periodType === 'WEEKLY' ? 'Weekly' : cond.periodType === 'MONTHLY' ? 'Monthly' : 'Semua Periode';
          const dateNotice = cond.startDate ? ` [Cutoff: ≥ ${cond.startDate}]` : '';

          const nowSec = Math.floor(Date.now() / 1000);
          const filteredMyAch = filterAchievementsForCondition(myAchievements, cond, nowSec);

          let currentVal = 0;
          if (cond.conditionType === 'COUNT') {
            currentVal = filteredMyAch.length;
          } else {
            let maxS = 0, currS = 0;
            filteredMyAch.forEach(() => { currS++; if (currS > maxS) maxS = currS; });
            currentVal = maxS;
          }

          const targetCount = cond.minCount || 1;
          const isCondSatisfied = currentVal >= targetCount;
          if (isCondSatisfied) completedCount++;

          requirements.push({
            id: cond.id || `cond_${Math.random()}`,
            title: `Pencapaian: ${catName}${dateNotice}`,
            type: 'ACHIEVEMENT',
            completed: isCondSatisfied,
            statusText: isCondSatisfied
              ? `✅ Terpenuhi (${currentVal}/${targetCount} ${typeName})`
              : `⏳ Progress: ${currentVal}/${targetCount} ${typeName} (${periodName})`,
          });
        });
      }

      const totalReqs = requirements.length;
      let progressPercent = 0;
      if (isOwned) {
        progressPercent = 100;
      } else if (totalReqs > 0) {
        progressPercent = Math.round((completedCount / totalReqs) * 100);
      }

      // Auto-award badge if user fulfilled all requirements and doesn't own it yet
      if (!isOwned && reqType !== 'NONE' && totalReqs > 0 && completedCount === totalReqs) {
        const now = Date.now();
        const userBadgeId = `ub_${crypto.randomUUID().replace(/-/g, '')}`;
        try {
          await db
            .prepare(`
              INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_by, awarded_at)
              VALUES (?, ?, ?, 'SYSTEM_AUTO', ?)
            `)
            .bind(userBadgeId, session.userId, badgeId, now)
            .run();

          isOwned = true;
          awardedAt = now;
          claimedAt = null;
          isSparksClaimed = false;
          progressPercent = 100;

          // Add to owners list
          const existingOwners = badgeOwnersMap.get(badgeId) || [];
          existingOwners.unshift({
            userId: session.userId,
            userName: session.name || 'Anda',
            userEmail: session.email,
            userType: ctx.userType || null,
            avatarUrl: session.avatar || null,
            awardedAt: now,
            awardedBy: 'SYSTEM_AUTO',
          });
          badgeOwnersMap.set(badgeId, existingOwners);
        } catch (_e) {}
      }

      if (isOwned) userOwnedCount++;

      const owners = badgeOwnersMap.get(badgeId) || [];

      badges.push({
        id: b.id,
        name: b.name,
        category: b.category as BadgeCategory,
        iconUrl: b.icon_url,
        description: b.description,
        requirementType: reqType,
        requirementData: reqIds,
        isContinuousEarning: Boolean(b.is_continuous_earning),
        claimCount: userBadgeInfo?.claimCount || 1,
        sparksReward: b.sparks_reward || 0,
        createdBy: b.created_by,
        createdAt: b.created_at,
        isOwned,
        awardedAt,
        claimedAt,
        isSparksClaimed,
        progressPercent,
        requirements,
        owners,
        totalOwners: owners.length,
      });
    }

    return {
      success: true,
      badges,
      userOwnedCount,
      totalBadgeCount: badges.length,
      isManager,
    };
  } catch (err: any) {
    console.error('Error fetching badges:', err);
    return { success: false, error: err?.message || 'Gagal memuat data badge.' };
  }
}

/**
 * Server action: Create a new Badge (Admin / Coordinator / Manager)
 */
export async function createBadgeAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isManager =
    ctx.userType === 'STAFF' ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  if (!isManager) {
    return { success: false, error: 'Hanya Admin atau Koordinator yang dapat membuat badge baru.' };
  }

  const name = (formData.get('name') as string)?.trim();
  const category = (formData.get('category') as string)?.trim() as BadgeCategory;
  const description = (formData.get('description') as string)?.trim() || null;
  const requirementType = (formData.get('requirement_type') as string)?.trim() as RequirementType || 'NONE';
  const requirementDataRaw = (formData.get('requirement_data') as string)?.trim();
  const iconUrlInput = (formData.get('icon_url') as string)?.trim() || null;
  const iconFile = formData.get('icon_file') as File | null;

  if (!name) return { success: false, error: 'Nama badge wajib diisi.' };
  if (!category || !CATEGORY_META[category]) return { success: false, error: 'Kategori badge tidak valid.' };

  let iconUrl: string | null = null;
  try {
    iconUrl = await processIconInput(iconFile, iconUrlInput);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memproses icon badge.' };
  }

  let requirementData: string | null = null;
  if (requirementDataRaw) {
    try {
      const parsed = JSON.parse(requirementDataRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        requirementData = JSON.stringify(parsed);
      }
    } catch {}
  }

  const sparksRewardRaw = formData.get('sparks_reward');
  let sparksReward = RECOMMENDED_CATEGORY_SPARKS[category] || 10;
  if (sparksRewardRaw !== null && sparksRewardRaw !== undefined && sparksRewardRaw !== '') {
    const parsed = parseInt(sparksRewardRaw as string, 10);
    if (!isNaN(parsed) && parsed >= 0) sparksReward = parsed;
  }

  const isContinuousEarningRaw = formData.get('is_continuous_earning');
  const isContinuousEarning = isContinuousEarningRaw === '1' || isContinuousEarningRaw === 'true' ? 1 : 0;

  const badgeId = `badge_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Date.now();

  try {
    await db
      .prepare(`
        INSERT INTO badges (id, name, category, icon_url, description, requirement_type, requirement_data, is_continuous_earning, sparks_reward, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(badgeId, name, category, iconUrl, description, requirementType, requirementData, isContinuousEarning, sparksReward, session.userId, now)
      .run();

    await logWorkflowEvent({
      entityType: 'task',
      entityId: badgeId,
      fromStatus: 'NONE',
      toStatus: 'CREATED',
      triggeredBy: session.userId,
      note: `Badge '${name}' (${category}) telah dibuat`,
    });

    revalidatePath('/dashboard/badges');
    return { success: true };
  } catch (err: any) {
    console.error('Error creating badge:', err);
    return { success: false, error: err?.message || 'Gagal membuat badge baru.' };
  }
}

/**
 * Server action: Edit an existing Badge
 */
export async function updateBadgeAction(badgeId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isManager =
    ctx.userType === 'STAFF' ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  if (!isManager) {
    return { success: false, error: 'Hanya Admin atau Koordinator yang dapat mengedit badge.' };
  }

  const name = (formData.get('name') as string)?.trim();
  const category = (formData.get('category') as string)?.trim() as BadgeCategory;
  const description = (formData.get('description') as string)?.trim() || null;
  const requirementType = (formData.get('requirement_type') as string)?.trim() as RequirementType || 'NONE';
  const requirementDataRaw = (formData.get('requirement_data') as string)?.trim();
  const iconUrlInput = (formData.get('icon_url') as string)?.trim() || null;
  const iconFile = formData.get('icon_file') as File | null;

  if (!name) return { success: false, error: 'Nama badge wajib diisi.' };
  if (!category || !CATEGORY_META[category]) return { success: false, error: 'Kategori badge tidak valid.' };

  const existing = await db
    .prepare('SELECT name, icon_url FROM badges WHERE id = ?')
    .bind(badgeId)
    .first() as { name: string; icon_url: string | null } | null;

  if (!existing) return { success: false, error: 'Badge tidak ditemukan.' };

  let iconUrl: string | null = existing.icon_url;
  try {
    const newProcessed = await processIconInput(iconFile, iconUrlInput);
    if (newProcessed !== null) {
      iconUrl = newProcessed;
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memproses icon badge.' };
  }

  let requirementData: string | null = null;
  if (requirementDataRaw) {
    try {
      const parsed = JSON.parse(requirementDataRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        requirementData = JSON.stringify(parsed);
      }
    } catch {}
  }

  const sparksRewardRaw = formData.get('sparks_reward');
  let sparksReward = RECOMMENDED_CATEGORY_SPARKS[category] || 10;
  if (sparksRewardRaw !== null && sparksRewardRaw !== undefined && sparksRewardRaw !== '') {
    const parsed = parseInt(sparksRewardRaw as string, 10);
    if (!isNaN(parsed) && parsed >= 0) sparksReward = parsed;
  }

  const isContinuousEarningRaw = formData.get('is_continuous_earning');
  const isContinuousEarning = isContinuousEarningRaw === '1' || isContinuousEarningRaw === 'true' ? 1 : 0;

  try {
    await db
      .prepare(`
        UPDATE badges
        SET name = ?, category = ?, icon_url = ?, description = ?, requirement_type = ?, requirement_data = ?, is_continuous_earning = ?, sparks_reward = ?
        WHERE id = ?
      `)
      .bind(name, category, iconUrl, description, requirementType, requirementData, isContinuousEarning, sparksReward, badgeId)
      .run();

    // 1. Link badge_id and update sparks amount on existing sparks_adjustments to match the new sparks_reward
    await db.prepare(`
      UPDATE sparks_adjustments
      SET badge_id = ?, sparks = ?
      WHERE category = 'BADGE_REWARD'
        AND (badge_id = ? OR note LIKE '%' || ? || '%' OR note LIKE '%' || ? || '%')
    `).bind(badgeId, sparksReward, badgeId, existing.name, name).run();

    // 2. If badge name changed, update the note text in sparks_adjustments so Sparks History logs stay accurate
    if (existing.name !== name) {
      await db.prepare(`
        UPDATE sparks_adjustments
        SET note = 'Claim Reward Badge: ' || ?
        WHERE category = 'BADGE_REWARD'
          AND (badge_id = ? OR note LIKE '%' || ? || '%' OR note LIKE '%' || ? || '%')
      `).bind(name, badgeId, existing.name, name).run();
    }

    // 3. Ensure user_badges.claimed_at is populated for all users who already claimed this badge reward
    await db.prepare(`
      UPDATE user_badges
      SET claimed_at = (
        SELECT COALESCE(sa.created_at * 1000, strftime('%s', 'now') * 1000)
        FROM sparks_adjustments sa
        WHERE sa.user_id = user_badges.user_id
          AND sa.category = 'BADGE_REWARD'
          AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || ? || '%' OR sa.note LIKE '%' || ? || '%')
        LIMIT 1
      )
      WHERE badge_id = ?
        AND claimed_at IS NULL
        AND EXISTS (
          SELECT 1 FROM sparks_adjustments sa
          WHERE sa.user_id = user_badges.user_id
            AND sa.category = 'BADGE_REWARD'
            AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || ? || '%' OR sa.note LIKE '%' || ? || '%')
        )
    `).bind(existing.name, name, badgeId, existing.name, name).run();

    revalidatePath('/dashboard/badges');
    revalidatePath('/dashboard/sparks');
    revalidatePath('/dashboard/profile');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating badge:', err);
    return { success: false, error: err?.message || 'Gagal memperbarui badge.' };
  }
}

/**
 * Server action: Delete a Badge
 */
export async function deleteBadgeAction(badgeId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isManager =
    ctx.userType === 'STAFF' ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  if (!isManager) {
    return { success: false, error: 'Hanya Admin atau Koordinator yang dapat menghapus badge.' };
  }

  try {
    await db.prepare('DELETE FROM user_badges WHERE badge_id = ?').bind(badgeId).run();
    await db.prepare('DELETE FROM badges WHERE id = ?').bind(badgeId).run();

    revalidatePath('/dashboard/badges');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting badge:', err);
    return { success: false, error: err?.message || 'Gagal menghapus badge.' };
  }
}

/**
 * Server action: Award a Badge manually to selected user IDs or Roles
 */
export async function awardBadgeToUsersAction(
  badgeId: string,
  targetUserIds: string[]
): Promise<{ success: boolean; grantedCount?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isManager =
    ctx.userType === 'STAFF' ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  if (!isManager) {
    return { success: false, error: 'Hanya Admin atau Koordinator yang dapat memberikan badge manual.' };
  }

  if (!targetUserIds || targetUserIds.length === 0) {
    return { success: false, error: 'Pilih setidaknya satu user penerima badge.' };
  }

  const badge = await db.prepare('SELECT name, sparks_reward FROM badges WHERE id = ?').bind(badgeId).first() as { name: string; sparks_reward: number } | null;
  if (!badge) return { success: false, error: 'Badge tidak ditemukan.' };

  let grantedCount = 0;
  const now = Date.now();

  for (const uId of targetUserIds) {
    const userBadgeId = `ub_${crypto.randomUUID().replace(/-/g, '')}`;
    try {
      const res = await db
        .prepare(`
          INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_by, awarded_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(userBadgeId, uId, badgeId, session.userId, now)
        .run();

      if (res.meta.changes > 0) {
        grantedCount++;
      }
    } catch (_e) {}
  }

  revalidatePath('/dashboard/badges');
  return { success: true, grantedCount };
}

/**
 * Fetch selectable tasks & workspaces for Badge Creation / Edit form
 */
export async function getBadgeRequirementOptions(): Promise<{
  tasks: { id: string; title: string; workspaceName: string }[];
  workspaces: { id: string; name: string }[];
  users: { id: string; name: string; email: string; userType: string | null; roleNames: string }[];
}> {
  const db = await getDB();

  const [{ results: tasksRaw }, { results: workspacesRaw }, { results: usersRaw }] = await Promise.all([
    db.prepare(`
      SELECT t.id, t.title, ws.name AS workspace_name
      FROM tasks t
      JOIN workspaces ws ON t.workspace_id = ws.id
      WHERE t.status != 'DELETED'
        AND ws.deleted_at IS NULL
      ORDER BY t.created_at DESC
      LIMIT 200
    `).all(),

    db.prepare(`
      SELECT id, name
      FROM workspaces
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `).all(),

    db.prepare(`
      SELECT u.id, u.name, u.email, u.user_type AS userType,
             GROUP_CONCAT(DISTINCT r.name) AS roleNames
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 'ACTIVE'
      GROUP BY u.id
      ORDER BY u.name ASC
    `).all(),
  ]);

  return {
    tasks: (tasksRaw as any[]).map((t) => ({
      id: t.id,
      title: t.title,
      workspaceName: t.workspace_name,
    })),
    workspaces: (workspacesRaw as any[]).map((w) => ({
      id: w.id,
      name: w.name,
    })),
    users: (usersRaw as any[]).map((u) => ({
      id: u.id,
      name: u.name || u.email || 'User',
      email: u.email || '',
      userType: u.userType || null,
      roleNames: u.roleNames || '',
    })),
  };
}

/**
 * Server Action: Manually claim Sparks reward for an earned badge
 */
export async function claimBadgeSparksAction(
  badgeId: string
): Promise<{ success: boolean; claimedSparks?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const now = Date.now();

  const userBadge = (await db
    .prepare('SELECT id, claimed_at FROM user_badges WHERE user_id = ? AND badge_id = ?')
    .bind(session.userId, badgeId)
    .first()) as { id: string; claimed_at: number | null } | null;

  if (!userBadge) {
    return { success: false, error: 'Anda belum memiliki badge ini.' };
  }

  if (userBadge.claimed_at) {
    return { success: false, error: 'Sparks dari badge ini sudah pernah Anda claim.' };
  }

  const badge = (await db
    .prepare('SELECT name, sparks_reward FROM badges WHERE id = ?')
    .bind(badgeId)
    .first()) as { name: string; sparks_reward: number } | null;

  if (!badge) {
    return { success: false, error: 'Badge tidak ditemukan.' };
  }

  const sparksReward = badge.sparks_reward || 0;
  if (sparksReward <= 0) {
    return { success: false, error: 'Badge ini tidak memiliki reward Sparks.' };
  }

  // Check if a claim adjustment already exists in sparks_adjustments
  const existingClaim = await db
    .prepare(`
      SELECT id FROM sparks_adjustments
      WHERE user_id = ?
        AND category = 'BADGE_REWARD'
        AND (badge_id = ? OR note LIKE '%' || ? || '%')
    `)
    .bind(session.userId, badgeId, badge.name)
    .first();

  if (existingClaim) {
    // Backfill claimed_at in user_badges and badge_id in sparks_adjustments
    await db
      .prepare('UPDATE user_badges SET claimed_at = ? WHERE user_id = ? AND badge_id = ?')
      .bind(now, session.userId, badgeId)
      .run();

    await db
      .prepare("UPDATE sparks_adjustments SET badge_id = ? WHERE id = ? AND (badge_id IS NULL OR badge_id = '')")
      .bind(badgeId, (existingClaim as any).id)
      .run();

    return { success: false, error: 'Sparks dari badge ini sudah pernah Anda claim.' };
  }

  // Mark all user_badges rows for this user & badge as claimed
  await db
    .prepare('UPDATE user_badges SET claimed_at = ? WHERE user_id = ? AND badge_id = ?')
    .bind(now, session.userId, badgeId)
    .run();

  // Credit Sparks in sparks_adjustments
  const saId = `sa_${crypto.randomUUID().replace(/-/g, '')}`;
  await db
    .prepare(`
      INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at, badge_id)
      VALUES (?, ?, 'APPRECIATION', ?, 'BADGE_REWARD', ?, ?, strftime('%s', 'now'), ?)
    `)
    .bind(saId, session.userId, sparksReward, `Claim Reward Badge: ${badge.name}`, session.userId, badgeId)
    .run();

  revalidatePath('/dashboard/badges');
  revalidatePath('/dashboard/sparks');
  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard/leaderboard');

  return { success: true, claimedSparks: sparksReward };
}

/**
 * Fetch all earned badges for a specific user (for Profile & User Popovers)
 */
export async function getUserBadgesAction(targetUserId: string): Promise<BadgeItem[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`
      SELECT b.*, ub.awarded_at, ub.claimed_at
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY ub.awarded_at DESC
    `)
    .bind(targetUserId)
    .all();

  return (results as any[]).map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category as BadgeCategory,
    iconUrl: b.icon_url,
    description: b.description,
    requirementType: b.requirement_type || 'NONE',
    requirementData: b.requirement_data ? JSON.parse(b.requirement_data) : [],
    sparksReward: b.sparks_reward || 0,
    createdBy: b.created_by,
    createdAt: b.created_at,
    isOwned: true,
    awardedAt: b.awarded_at,
    claimedAt: b.claimed_at || null,
    isSparksClaimed: Boolean(b.claimed_at),
    progressPercent: 100,
    requirements: [],
    owners: [],
    totalOwners: 1,
  }));
}
