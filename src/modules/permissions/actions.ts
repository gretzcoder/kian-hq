'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB, getKV } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Grant a permission to a role.
 * Requires MANAGE permission.
 * Also invalidates KV permission cache for all users with that role.
 */
export async function grantRolePermission(roleId: string, permissionId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  if (!roleId || !permissionId) {
    return { success: false, error: 'Role ID and Permission ID are required.' };
  }

  const db = await getDB();

  try {
    await db
      .prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)')
      .bind(roleId, permissionId)
      .run();

    // Invalidate KV cache for all users in this role
    await invalidateCacheForRole(roleId);

    revalidatePath('/dashboard/permissions');
    return { success: true };
  } catch (error: any) {
    console.error('grantRolePermission failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Revoke a permission from a role.
 * Requires MANAGE permission.
 * Also invalidates KV permission cache for all users with that role.
 */
export async function revokeRolePermission(roleId: string, permissionId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  if (!roleId || !permissionId) {
    return { success: false, error: 'Role ID and Permission ID are required.' };
  }

  const db = await getDB();

  try {
    await db
      .prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?')
      .bind(roleId, permissionId)
      .run();

    await invalidateCacheForRole(roleId);

    revalidatePath('/dashboard/permissions');
    return { success: true };
  } catch (error: any) {
    console.error('revokeRolePermission failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invalidate KV permission cache for all users who have the given role.
 */
async function invalidateCacheForRole(roleId: string) {
  try {
    const db = await getDB();
    const kv = await getKV();

    const { results } = await db
      .prepare('SELECT user_id FROM user_roles WHERE role_id = ?')
      .bind(roleId)
      .all();

    await Promise.allSettled(
      results.map((row: any) =>
        kv.delete(`user:permissions:${row.user_id}`)
      )
    );
  } catch (err) {
    console.error('Failed to invalidate KV cache for role:', err);
  }
}
