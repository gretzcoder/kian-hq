'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, clearPermissionsCache } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to update a user's role.
 * Secured by RBAC ('MANAGE' permission) and invalidates KV permission caches.
 */
export async function updateUserRole(targetUserId: string, newRoleId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce RBAC assertion
  await checkPermission(session.userId, 'MANAGE');

  const db = await getDB();

  try {
    // 2. Delete existing roles for target user
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetUserId).run();

    // 3. Insert new role mapping
    await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(targetUserId, newRoleId).run();

    // 4. Force invalidate KV Permissions cache for the updated user
    await clearPermissionsCache(targetUserId);

    // 5. Trigger page revalidation
    revalidatePath('/dashboard/users');

    return { success: true };
  } catch (error: any) {
    console.error('updateUserRole Server Action failed:', error);
    return { success: false, error: error.message || 'Database update failed' };
  }
}
