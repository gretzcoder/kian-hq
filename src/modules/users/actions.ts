'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, clearPermissionsCache } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to update a user's role.
 * Secured by RBAC ('MANAGE' permission).
 * Prevents self-demotion to avoid lockout.
 */
export async function updateUserRole(targetUserId: string, newRoleId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  // Phase 0 fix: Prevent self-demotion (EXECUTIVE locking themselves out)
  if (targetUserId === session.userId) {
    return { success: false, error: 'You cannot change your own role.' };
  }

  const db = await getDB();

  try {
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetUserId).run();
    await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(targetUserId, newRoleId).run();
    await clearPermissionsCache(targetUserId);

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (err: any) {
    console.error('updateUserRole failed:', err);
    return { success: false, error: err.message || 'Database update failed' };
  }
}
