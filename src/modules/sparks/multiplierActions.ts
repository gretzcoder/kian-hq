'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';

import { getCategoryMultipliers, invalidateCategoryMultipliersCache } from './settingsCache';

export interface SparksMultipliersState {
  designMultiplier: number;
  videoMultiplier: number;
  customTaskMultipliersCount: number;
  activeMultiplierTasks: {
    id: string;
    title: string;
    outputType: string;
    multiplier: number;
  }[];
}

/** Check if current user has permission to manage multipliers (Coordinator, Executive, Admin, Manage) */
async function canManageMultipliers(sessionUserId: string): Promise<boolean> {
  const ctx = await getSessionContext(sessionUserId);
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));
  return isCoordinator || ctx.can('SPARKS_MANAGE') || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');
}

/** Get all current active multipliers for global banner & management view */
export async function getSparksMultipliersData(): Promise<SparksMultipliersState> {
  const db = await getDB();

  // Fetch category multipliers from cache/system_settings
  const { designMultiplier, videoMultiplier } = await getCategoryMultipliers();

  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // Fetch tasks with custom multipliers (> 1.0) that are active and not expired / completed
  const { results: taskRows } = await db
    .prepare(`
      SELECT id, title, task_type, sparks_multiplier, deadline, extended_deadline, status
      FROM tasks
      WHERE sparks_multiplier > 1.0
        AND status NOT IN ('APPROVED', 'LOCKED', 'PUBLISHED', 'DONE', 'COMPLETED', 'ARCHIVED', 'DELETED')
    `)
    .all();

  const activeMultiplierTasks = ((taskRows || []) as any[])
    .filter((t) => {
      const activeDeadline = Math.max(Number(t.extended_deadline) || 0, Number(t.deadline) || 0);
      if (!activeDeadline) return true; // No deadline means ongoing/active
      const isMs = activeDeadline > 10000000000;
      const now = isMs ? nowMs : nowSec;
      return activeDeadline >= now;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      outputType: t.task_type || 'GENERAL',
      multiplier: Number(t.sparks_multiplier) || 1.0,
    }));

  return {
    designMultiplier,
    videoMultiplier,
    customTaskMultipliersCount: activeMultiplierTasks.length,
    activeMultiplierTasks,
  };
}

/** Update multiplier for a specific task (Coordinators/Admins) */
export async function updateTaskSparksMultiplierAction(taskId: string, multiplier: number) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!(await canManageMultipliers(session.userId))) {
    return { success: false, error: 'Forbidden: Hanya Koordinator atau Admin yang dapat mengatur multiplier Sparks.' };
  }

  const validMult = Math.max(0.5, Math.min(10.0, Number(multiplier) || 1.0));
  const db = await getDB();

  await db
    .prepare('UPDATE tasks SET sparks_multiplier = ? WHERE id = ?')
    .bind(validMult, taskId)
    .run();

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/sparks');
  revalidatePath('/dashboard/review');
  return { success: true, multiplier: validMult, message: `Sparks multiplier task berhasil diatur ke ${validMult}x!` };
}

/** Update category-level multiplier (Design / Video) (Coordinators/Admins) */
export async function updateCategoryMultiplierAction(category: 'DESIGN' | 'VIDEO', multiplier: number) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!(await canManageMultipliers(session.userId))) {
    return { success: false, error: 'Forbidden: Hanya Koordinator atau Admin yang dapat mengatur multiplier Sparks.' };
  }

  const validMult = Math.max(0.5, Math.min(10.0, Number(multiplier) || 1.0));
  const settingKey = category === 'DESIGN' ? 'category_multiplier_design' : 'category_multiplier_video';

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(`
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `)
    .bind(settingKey, String(validMult), session.userId, now)
    .run();

  invalidateCategoryMultipliersCache();

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/sparks');
  revalidatePath('/dashboard/review');
  return {
    success: true,
    category,
    multiplier: validMult,
    message: `Sparks multiplier untuk kategori ${category} berhasil diatur ke ${validMult}x!`,
  };
}
