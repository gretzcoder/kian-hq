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



/**
 * Global Evaluator: Auto-awards badges to ALL users who satisfy task/workspace requirements
 */
export async function evaluateAndAutoAwardBadges(targetUserId?: string): Promise<number> {
  const db = await getDB();
  const now = Date.now();

  // 0. Clean up any legacy automatic badge sparks adjustments (ensure ONLY manual claims exist)
  try {
    await db.prepare(`
      DELETE FROM sparks_adjustments
      WHERE category = 'BADGE_REWARD'
        AND note LIKE 'Reward Badge: %'
        AND note NOT LIKE 'Claim Reward Badge: %'
    `).run();
  } catch (e) {
    console.error('Failed to cleanup automatic badge sparks adjustments:', e);
  }

  // 1. Fetch all active badges with requirements
  const { results: rawBadges } = await db
    .prepare("SELECT * FROM badges WHERE requirement_type IN ('TASK', 'WORKSPACE')")
    .all();

  if (!rawBadges || rawBadges.length === 0) return 0;

  // 2. Fetch approved task assignments for active users
  const userClause = targetUserId ? 'AND ta.user_id = ?' : '';
  const queryParams = targetUserId ? [targetUserId] : [];

  const { results: approvedAssignments } = await db
    .prepare(`
      SELECT ta.user_id, ta.task_id, ta.status AS assignment_status, t.workspace_id
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

  // Build map: userId -> Set of completed task IDs
  const userTaskMap = new Map<string, Set<string>>();
  (approvedAssignments as any[]).forEach((row) => {
    if (!userTaskMap.has(row.user_id)) {
      userTaskMap.set(row.user_id, new Set());
    }
    userTaskMap.get(row.user_id)!.add(row.task_id);
  });

  // Fetch all tasks per workspace for WORKSPACE type requirement checking
  const { results: allTasksRaw } = await db
    .prepare(`
      SELECT t.id, t.workspace_id
      FROM tasks t
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      WHERE t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
    `)
    .all();

  const workspaceTasksMap = new Map<string, string[]>();
  (allTasksRaw as any[]).forEach((t) => {
    if (t.workspace_id) {
      if (!workspaceTasksMap.has(t.workspace_id)) {
        workspaceTasksMap.set(t.workspace_id, []);
      }
      workspaceTasksMap.get(t.workspace_id)!.push(t.id);
    }
  });

  // 3. Cleanup invalid SYSTEM_AUTO user_badges where requirements are NOT satisfied
  for (const b of rawBadges as any[]) {
    const badgeId = b.id;
    let reqIds: string[] = [];
    if (b.requirement_data) {
      try { reqIds = JSON.parse(b.requirement_data); } catch {}
    }
    if (reqIds.length === 0) continue;

    const reqType = b.requirement_type;

    const { results: autoAwards } = await db
      .prepare("SELECT id, user_id FROM user_badges WHERE badge_id = ? AND awarded_by = 'SYSTEM_AUTO'")
      .bind(badgeId)
      .all();

    for (const ub of (autoAwards as any[] || [])) {
      const uId = ub.user_id;
      const uCompleted = userTaskMap.get(uId) || new Set<string>();
      let stillValid = false;

      if (reqType === 'TASK') {
        stillValid = reqIds.every((tId) => uCompleted.has(tId));
      } else if (reqType === 'WORKSPACE') {
        stillValid = reqIds.every((wsId) => {
          const wsTasks = workspaceTasksMap.get(wsId) || [];
          return wsTasks.length > 0 && wsTasks.every((tId) => uCompleted.has(tId));
        });
      }

      if (!stillValid) {
        // Delete invalid auto-award and invalid sparks reward
        await db.prepare("DELETE FROM user_badges WHERE id = ?").bind(ub.id).run();
        await db.prepare("DELETE FROM sparks_adjustments WHERE user_id = ? AND category = 'BADGE_REWARD' AND created_by = 'SYSTEM_AUTO' AND note LIKE ?")
          .bind(uId, `%${b.name}%`)
          .run();
      }
    }
  }

  // 4. Fetch existing user_badges to avoid duplicate awards
  const { results: existingUserBadges } = await db
    .prepare("SELECT user_id, badge_id FROM user_badges")
    .all();

  const userBadgeSet = new Set<string>();
  (existingUserBadges as any[]).forEach((ub) => {
    userBadgeSet.add(`${ub.user_id}::${ub.badge_id}`);
  });

  let newAwardCount = 0;

  // 5. Evaluate each user against each badge
  for (const [userId, completedTasks] of userTaskMap.entries()) {
    for (const b of rawBadges as any[]) {
      const badgeId = b.id;
      const key = `${userId}::${badgeId}`;
      if (userBadgeSet.has(key)) continue; // Already owns badge

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
        try {
          const res = await db
            .prepare(`
              INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_by, awarded_at)
              VALUES (?, ?, ?, 'SYSTEM_AUTO', ?)
            `)
            .bind(userBadgeId, userId, badgeId, now)
            .run();

          if (res.meta.changes > 0) {
            newAwardCount++;
            userBadgeSet.add(key);
          }
        } catch (_e) {}
      }
    }
  }

  return newAwardCount;
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

    // 1. Fetch raw badges
    const { results: rawBadges } = await db
      .prepare('SELECT * FROM badges ORDER BY created_at DESC')
      .all();

    // 2. Fetch user's earned badges
    const { results: userEarned } = await db
      .prepare('SELECT badge_id, awarded_at, claimed_at FROM user_badges WHERE user_id = ?')
      .bind(session.userId)
      .all();

    const userEarnedMap = new Map<string, { awardedAt: number; claimedAt: number | null }>();
    (userEarned as any[]).forEach((ub) => {
      userEarnedMap.set(ub.badge_id, { awardedAt: ub.awarded_at, claimedAt: ub.claimed_at || null });
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

    // Process badges and check auto-award eligibility
    const badges: BadgeItem[] = [];
    let userOwnedCount = 0;

    for (const b of rawBadges as any[]) {
      const badgeId = b.id;
      const userBadgeInfo = userEarnedMap.get(badgeId);
      let isOwned = Boolean(userBadgeInfo);
      let awardedAt = userBadgeInfo?.awardedAt || null;
      let claimedAt = userBadgeInfo?.claimedAt || null;
      let isSparksClaimed = Boolean(claimedAt);

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

  const badgeId = `badge_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Date.now();

  try {
    await db
      .prepare(`
        INSERT INTO badges (id, name, category, icon_url, description, requirement_type, requirement_data, sparks_reward, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(badgeId, name, category, iconUrl, description, requirementType, requirementData, sparksReward, session.userId, now)
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
    .prepare('SELECT icon_url FROM badges WHERE id = ?')
    .bind(badgeId)
    .first() as { icon_url: string | null } | null;

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

  try {
    await db
      .prepare(`
        UPDATE badges
        SET name = ?, category = ?, icon_url = ?, description = ?, requirement_type = ?, requirement_data = ?, sparks_reward = ?
        WHERE id = ?
      `)
      .bind(name, category, iconUrl, description, requirementType, requirementData, sparksReward, badgeId)
      .run();

    revalidatePath('/dashboard/badges');
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

  // Mark user_badges as claimed
  await db
    .prepare('UPDATE user_badges SET claimed_at = ? WHERE id = ?')
    .bind(now, userBadge.id)
    .run();

  // Credit Sparks in sparks_adjustments
  const saId = `sa_${crypto.randomUUID().replace(/-/g, '')}`;
  await db
    .prepare(`
      INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at)
      VALUES (?, ?, 'APPRECIATION', ?, 'BADGE_REWARD', ?, ?, strftime('%s', 'now'))
    `)
    .bind(saId, session.userId, sparksReward, `Claim Reward Badge: ${badge.name}`, session.userId)
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
