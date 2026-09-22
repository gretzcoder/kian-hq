'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { sendPushNotificationToUsers } from '@/modules/notifications/pushActions';

export interface BankContentItem {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  workspaceId: string | null;
  workspaceName: string | null;
  submitterId: string;
  submitterName: string;
  submitterEmail: string;
  submitterAvatar: string | null;
  resultUrl: string;
  assignmentRole: string;
  submittedAt: number | null;
  createdAt: number;
  publishStatus: 'PUBLISHED' | 'NON_PUBLISHED';
  publishBonusAwarded: boolean;
  category: 'DESIGN' | 'VIDEO' | 'OTHER';
  likesCount: number;
  userLiked: boolean;
  commentsCount: number;
  comments: BankContentCommentItem[];
}

export interface BankContentCommentItem {
  id: string;
  assignmentId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  parentId: string | null;
  content: string;
  createdAt: number;
}

export interface BankContentFilters {
  generalCategory?: 'ALL' | 'DESIGN' | 'VIDEO';
  innerFilter?: 'ALL' | 'PUBLISHED' | 'NON_PUBLISHED';
  workspaceId?: string;
  taskId?: string;
  userId?: string;
  sortByDate?: 'desc' | 'asc';
  search?: string;
}

/**
 * Ensures schema tables and columns exist in D1 (Self-healing migration for Cloudflare D1)
 */
async function ensureBankContentSchema(db: any) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS bank_content_likes (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        UNIQUE(assignment_id, user_id)
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS bank_content_comments (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES bank_content_comments(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `).run();

    try {
      await db.prepare("ALTER TABLE task_assignments ADD COLUMN publish_status TEXT NOT NULL DEFAULT 'NON_PUBLISHED'").run();
    } catch (_e) {
      // Column already exists
    }

    try {
      await db.prepare("ALTER TABLE task_assignments ADD COLUMN publish_bonus_awarded INTEGER NOT NULL DEFAULT 0").run();
    } catch (_e) {
      // Column already exists
    }
  } catch (err) {
    console.error('ensureBankContentSchema non-fatal notice:', err);
  }
}

/** Check if current user has Coordinator, Admin, or Mentor authority to publish/unpublish content */
export async function canManageBankContent(sessionUserId: string): Promise<boolean> {
  const ctx = await getSessionContext(sessionUserId);
  const isStaffManager =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') ||
      ctx.roles.includes('EXECUTIVE') ||
      ctx.can('MANAGE') ||
      ctx.can('WORKSPACE_MANAGE') ||
      ctx.permissions.has('ADMIN_SYSTEM'));
  const isMentor = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  return isStaffManager || isMentor || ctx.can('SPARKS_MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');
}

/**
 * Helper to determine category (DESIGN, VIDEO, OTHER) from task_type or assignment_role or title
 */
function determineCategory(taskType: string, assignmentRole: string, taskTitle: string): 'DESIGN' | 'VIDEO' | 'OTHER' {
  const role = (assignmentRole || '').toUpperCase();
  const type = (taskType || '').toUpperCase();
  const title = (taskTitle || '').toUpperCase();

  if (role === 'VIDEO_EDITOR' || type === 'VIDEO' || title.includes('VIDEO') || title.includes('REELS') || title.includes('TIKTOK')) {
    return 'VIDEO';
  }
  if (role === 'DESIGNER' || type === 'DESIGN' || title.includes('DESIGN') || title.includes('POSTER') || title.includes('FEEDS') || title.includes('CANVA')) {
    return 'DESIGN';
  }
  if (type === 'VIDEO') return 'VIDEO';
  if (type === 'DESIGN') return 'DESIGN';
  return 'OTHER';
}

/**
 * Fetch list of all submitted contents for Bank Content feed with filters
 */
export async function getBankContentFeed(filters: BankContentFilters = {}) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  const currentUserId = session.userId;

  // Auto-heal D1 schema if migration has not run yet in remote env
  await ensureBankContentSchema(db);

  const {
    generalCategory = 'ALL',
    innerFilter = 'ALL',
    workspaceId,
    taskId,
    userId,
    sortByDate = 'desc',
    search,
  } = filters;

  // Base query to fetch all submitted task assignments with result_url
  let query = `
    SELECT
      ta.id AS assignmentId,
      ta.task_id AS taskId,
      t.title AS taskTitle,
      t.task_type AS taskType,
      t.workspace_id AS workspaceId,
      ws.name AS workspaceName,
      ta.user_id AS submitterId,
      u.name AS submitterName,
      u.email AS submitterEmail,
      u.avatar_url AS submitterAvatar,
      ta.result_url AS resultUrl,
      ta.assignment_role AS assignmentRole,
      COALESCE(ta.submitted_at, ta.created_at) AS submittedAt,
      ta.created_at AS createdAt,
      COALESCE(ta.publish_status, 'NON_PUBLISHED') AS publishStatus,
      COALESCE(ta.publish_bonus_awarded, 0) AS publishBonusAwarded
    FROM task_assignments ta
    JOIN tasks t ON ta.task_id = t.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    JOIN users u ON ta.user_id = u.id
    WHERE ta.result_url IS NOT NULL
      AND TRIM(ta.result_url) != ''
      AND t.status != 'DELETED'
      AND (ws.id IS NULL OR ws.deleted_at IS NULL)
      AND UPPER(TRIM(COALESCE(ta.assignment_role, ''))) NOT IN ('RESEARCHER', 'PLANNER')
      AND UPPER(COALESCE(ta.assignment_role, '')) NOT LIKE '%RESEARCH%'
      AND UPPER(COALESCE(ta.assignment_role, '')) NOT LIKE '%PLANNER%'
      AND UPPER(COALESCE(ta.assignment_role, '')) NOT LIKE '%BRIEF%'
  `;

  const params: any[] = [];

  // Filter by inner status (PUBLISHED vs NON_PUBLISHED)
  if (innerFilter === 'PUBLISHED') {
    query += ` AND ta.publish_status = 'PUBLISHED'`;
  } else if (innerFilter === 'NON_PUBLISHED') {
    query += ` AND (ta.publish_status IS NULL OR ta.publish_status = 'NON_PUBLISHED')`;
  }

  // Filter by Workspace
  if (workspaceId && workspaceId !== 'ALL') {
    query += ` AND t.workspace_id = ?`;
    params.push(workspaceId);
  }

  // Filter by Task
  if (taskId && taskId !== 'ALL') {
    query += ` AND t.id = ?`;
    params.push(taskId);
  }

  // Filter by Submitter / User
  if (userId && userId !== 'ALL') {
    query += ` AND ta.user_id = ?`;
    params.push(userId);
  }

  // Search keyword (Title, User, Workspace)
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query += ` AND (t.title LIKE ? OR u.name LIKE ? OR ws.name LIKE ?)`;
    params.push(term, term, term);
  }

  // Order by submission date
  query += ` ORDER BY COALESCE(ta.submitted_at, ta.created_at) ${sortByDate === 'asc' ? 'ASC' : 'DESC'}`;

  let rawRows: any[] = [];
  try {
    const res = await db.prepare(query).bind(...params).all();
    rawRows = (res.results as any[]) || [];
  } catch (err: any) {
    console.error('getBankContentFeed query error, attempting schema fallback:', err);
    await ensureBankContentSchema(db);
    try {
      const res = await db.prepare(query).bind(...params).all();
      rawRows = (res.results as any[]) || [];
    } catch (retryErr) {
      console.error('getBankContentFeed fallback failed:', retryErr);
      return { items: [], workspaces: [], tasks: [], submitters: [] };
    }
  }

  const allItems = rawRows;

  if (allItems.length === 0) {
    return {
      items: [],
      workspaces: [],
      tasks: [],
      submitters: [],
    };
  }

  const assignmentIds = allItems.map((item) => item.assignmentId);
  const placeholders = assignmentIds.map(() => '?').join(',');

  // Fetch Likes for these assignments
  let likesRaw: any[] = [];
  try {
    const likesRes = await db
      .prepare(`
        SELECT assignment_id, user_id
        FROM bank_content_likes
        WHERE assignment_id IN (${placeholders})
      `)
      .bind(...assignmentIds)
      .all();
    likesRaw = (likesRes.results as any[]) || [];
  } catch (_e) {}

  const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
  for (const l of likesRaw) {
    if (!likesMap[l.assignment_id]) {
      likesMap[l.assignment_id] = { count: 0, userLiked: false };
    }
    likesMap[l.assignment_id].count += 1;
    if (l.user_id === currentUserId) {
      likesMap[l.assignment_id].userLiked = true;
    }
  }

  // Fetch Comments for these assignments
  let commentsRaw: any[] = [];
  try {
    const commentsRes = await db
      .prepare(`
        SELECT
          bc.id,
          bc.assignment_id AS assignmentId,
          bc.user_id AS userId,
          u.name AS userName,
          u.avatar_url AS userAvatar,
          bc.parent_id AS parentId,
          bc.content,
          bc.created_at AS createdAt
        FROM bank_content_comments bc
        JOIN users u ON bc.user_id = u.id
        WHERE bc.assignment_id IN (${placeholders})
        ORDER BY bc.created_at ASC
      `)
      .bind(...assignmentIds)
      .all();
    commentsRaw = (commentsRes.results as any[]) || [];
  } catch (_e) {}

  const commentsMap: Record<string, BankContentCommentItem[]> = {};
  for (const c of commentsRaw) {
    if (!commentsMap[c.assignmentId]) {
      commentsMap[c.assignmentId] = [];
    }
    commentsMap[c.assignmentId].push(c);
  }

  // Process & Map final items with General Category filter
  const items: BankContentItem[] = [];
  const workspacesSet = new Map<string, string>();
  const tasksSet = new Map<string, string>();
  const submittersSet = new Map<string, string>();

  for (const r of allItems) {
    const roleUpper = (r.assignmentRole || '').toUpperCase();
    if (
      roleUpper === 'RESEARCHER' ||
      roleUpper === 'PLANNER' ||
      roleUpper.includes('RESEARCH') ||
      roleUpper.includes('PLANNER') ||
      roleUpper.includes('BRIEF')
    ) {
      continue;
    }

    if (r.workspaceId && r.workspaceName) workspacesSet.set(r.workspaceId, r.workspaceName);
    if (r.taskId && r.taskTitle) tasksSet.set(r.taskId, r.taskTitle);
    if (r.submitterId && r.submitterName) submittersSet.set(r.submitterId, r.submitterName);

    const cat = determineCategory(r.taskType, r.assignmentRole, r.taskTitle);

    // Apply General Category Filter
    if (generalCategory === 'DESIGN' && cat !== 'DESIGN') continue;
    if (generalCategory === 'VIDEO' && cat !== 'VIDEO') continue;

    const likeData = likesMap[r.assignmentId] || { count: 0, userLiked: false };
    const commentList = commentsMap[r.assignmentId] || [];

    items.push({
      assignmentId: r.assignmentId,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      taskType: r.taskType,
      workspaceId: r.workspaceId,
      workspaceName: r.workspaceName,
      submitterId: r.submitterId,
      submitterName: r.submitterName,
      submitterEmail: r.submitterEmail,
      submitterAvatar: r.submitterAvatar,
      resultUrl: r.resultUrl,
      assignmentRole: r.assignmentRole,
      submittedAt: r.submittedAt,
      createdAt: r.createdAt,
      publishStatus: (r.publishStatus || 'NON_PUBLISHED') as 'PUBLISHED' | 'NON_PUBLISHED',
      publishBonusAwarded: Number(r.publishBonusAwarded) === 1,
      category: cat,
      likesCount: likeData.count,
      userLiked: likeData.userLiked,
      commentsCount: commentList.length,
      comments: commentList,
    });
  }

  return {
    items,
    workspaces: Array.from(workspacesSet.entries()).map(([id, name]) => ({ id, name })),
    tasks: Array.from(tasksSet.entries()).map(([id, title]) => ({ id, title })),
    submitters: Array.from(submittersSet.entries()).map(([id, name]) => ({ id, name })),
  };
}

/**
 * Toggle Publish / Non-Publish status of a submitted content in Bank Content.
 * Automatically grants +10 Sparks bonus to the content submitter if published for the first time.
 */
export async function toggleBankContentPublishStatus(
  assignmentId: string,
  targetStatus: 'PUBLISHED' | 'NON_PUBLISHED'
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const canManage = await canManageBankContent(session.userId);
  if (!canManage) {
    return {
      success: false,
      error: 'Forbidden: Anda tidak memiliki wewenang merubah status publish konten.',
    };
  }

  const db = await getDB();
  await ensureBankContentSchema(db);

  // Fetch assignment & task details
  const assignment = await db
    .prepare(`
      SELECT
        ta.id,
        ta.user_id,
        ta.publish_status,
        ta.publish_bonus_awarded,
        t.title AS task_title
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.id = ?
    `)
    .bind(assignmentId)
    .first() as {
      id: string;
      user_id: string;
      publish_status: string;
      publish_bonus_awarded: number;
      task_title: string;
    } | null;

  if (!assignment) {
    return { success: false, error: 'Tugas/konten tidak ditemukan.' };
  }

  try {
    let bonusAwarded = false;
    let newBonusFlag = Number(assignment.publish_bonus_awarded) || 0;

    if (targetStatus === 'PUBLISHED' && newBonusFlag === 0) {
      // Award +10 Sparks bonus to submitter
      const sparkId = `sa_${crypto.randomUUID().replace(/-/g, '')}`;
      await db
        .prepare(`
          INSERT INTO sparks_adjustments (id, user_id, type, sparks, category, note, created_by, created_at)
          VALUES (?, ?, 'APPRECIATION', 10, 'PUBLISH_BONUS', ?, ?, strftime('%s', 'now'))
        `)
        .bind(
          sparkId,
          assignment.user_id,
          `Bonus Sparks Konten Dipublikasikan di Bank Content: "${assignment.task_title}"`,
          session.userId
        )
        .run();

      newBonusFlag = 1;
      bonusAwarded = true;

      // Web Push notification to submitter
      sendPushNotificationToUsers([assignment.user_id], 'TASK', {
        title: '🎉 Karya Dipublikasikan (+10 Sparks!)',
        body: `Selamat! Hasil karya Anda "${assignment.task_title}" telah dipublikasikan di Bank Content dan Anda mendapatkan bonus +10 Sparks! ✨`,
        url: '/dashboard/bank-content',
        category: 'TASK',
        tag: `pub_bonus_${assignment.id}`,
      }).catch(() => {});
    }

    await db
      .prepare(`
        UPDATE task_assignments
        SET publish_status = ?, publish_bonus_awarded = ?
        WHERE id = ?
      `)
      .bind(targetStatus, newBonusFlag, assignmentId)
      .run();

    revalidatePath('/dashboard/bank-content');
    revalidatePath('/dashboard/sparks');
    revalidatePath('/dashboard/leaderboard');
    revalidatePath('/dashboard/profile');

    const statusMsg = targetStatus === 'PUBLISHED' ? 'dipublikasikan' : 'di-non-publish-kan';
    const bonusMsg = bonusAwarded ? ' dan bonus +10 Sparks ✨ telah dikirimkan ke pemilik karya!' : '.';

    return {
      success: true,
      message: `✓ Status konten berhasil ${statusMsg}${bonusMsg}`,
      bonusAwarded,
    };
  } catch (err: any) {
    console.error('toggleBankContentPublishStatus failed:', err);
    return { success: false, error: err.message || 'Gagal mengubah status publish konten.' };
  }
}

/**
 * Toggle Like / Unlike on a submitted content item
 */
export async function toggleBankContentLike(assignmentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  await ensureBankContentSchema(db);

  try {
    const existing = await db
      .prepare('SELECT 1 FROM bank_content_likes WHERE assignment_id = ? AND user_id = ?')
      .bind(assignmentId, session.userId)
      .first();

    if (existing) {
      await db
        .prepare('DELETE FROM bank_content_likes WHERE assignment_id = ? AND user_id = ?')
        .bind(assignmentId, session.userId)
        .run();
    } else {
      const id = `bcl_${crypto.randomUUID().replace(/-/g, '')}`;
      await db
        .prepare('INSERT INTO bank_content_likes (id, assignment_id, user_id) VALUES (?, ?, ?)')
        .bind(id, assignmentId, session.userId)
        .run();
    }

    revalidatePath('/dashboard/bank-content');
    return { success: true };
  } catch (err: any) {
    console.error('toggleBankContentLike failed:', err);
    return { success: false, error: err.message || 'Gagal memproses like.' };
  }
}

/**
 * Add a comment / reply on a submitted content item
 */
export async function addBankContentComment(assignmentId: string, content: string, parentId?: string | null) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const trimmed = content?.trim();
  if (!trimmed) return { success: false, error: 'Komentar tidak boleh kosong.' };

  const db = await getDB();
  await ensureBankContentSchema(db);
  const commentId = `bcc_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(`
        INSERT INTO bank_content_comments (id, assignment_id, user_id, parent_id, content)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(commentId, assignmentId, session.userId, parentId || null, trimmed)
      .run();

    revalidatePath('/dashboard/bank-content');
    return { success: true };
  } catch (err: any) {
    console.error('addBankContentComment failed:', err);
    return { success: false, error: err.message || 'Gagal mengirim komentar.' };
  }
}

/**
 * Delete a comment on a submitted content item
 */
export async function deleteBankContentComment(commentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const db = await getDB();
  await ensureBankContentSchema(db);

  try {
    const existing = await db
      .prepare('SELECT user_id FROM bank_content_comments WHERE id = ?')
      .bind(commentId)
      .first() as { user_id: string } | null;

    if (!existing) return { success: false, error: 'Komentar tidak ditemukan.' };

    if (existing.user_id !== session.userId) {
      const canManage = await canManageBankContent(session.userId);
      if (!canManage) {
        return { success: false, error: 'Forbidden: Anda tidak memiliki akses menghapus komentar ini.' };
      }
    }

    await db.prepare('DELETE FROM bank_content_comments WHERE id = ?').bind(commentId).run();

    revalidatePath('/dashboard/bank-content');
    return { success: true };
  } catch (err: any) {
    console.error('deleteBankContentComment failed:', err);
    return { success: false, error: err.message || 'Gagal menghapus komentar.' };
  }
}
