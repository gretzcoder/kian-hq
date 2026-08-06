'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, invalidateCacheForRole } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Grant a permission to a role.
 * Requires MANAGE permission.
 * Also invalidates KV permission cache for all users with that role.
 */
export async function grantRolePermission(roleId: string, permissionId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

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

  await checkPermission(session.userId, 'ADMIN_ROLES');

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
 * Create a new custom role.
 * Requires MANAGE permission.
 */
export async function createRoleAction(name: string, description: string, color?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  if (!name?.trim()) {
    return { success: false, error: 'Role name is required.' };
  }

  const roleId = `role_${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const db = await getDB();
  const roleColor = color?.trim() || '#8B5CF6';

  try {
    await db
      .prepare('INSERT INTO roles (id, name, description, color) VALUES (?, ?, ?, ?)')
      .bind(roleId, name.trim().toUpperCase(), description || null, roleColor)
      .run();

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return { success: false, error: 'A role with this name already exists.' };
    }
    console.error('createRoleAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing custom role's name, description, and color.
 * Requires MANAGE permission.
 */
export async function updateRoleAction(roleId: string, name: string, description: string, color?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  if (!name?.trim()) {
    return { success: false, error: 'Role name is required.' };
  }

  const db = await getDB();
  const roleColor = color?.trim() || null;

  try {
    await db
      .prepare('UPDATE roles SET name = ?, description = ?, color = COALESCE(?, color) WHERE id = ?')
      .bind(name.trim().toUpperCase(), description || null, roleColor, roleId)
      .run();

    await invalidateCacheForRole(roleId);

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error: any) {
    console.error('updateRoleAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a custom role.
 * Requires MANAGE permission.
 */
export async function deleteRoleAction(roleId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  const protectedRoles = [
    'role_executive',
    'role_coordinator',
    'role_creator',
    'role_collaborator',
    'role_mentor_troopers',
    'role_troopers',
  ];
  if (protectedRoles.includes(roleId)) {
    return { success: false, error: 'Protected system roles cannot be deleted.' };
  }

  const db = await getDB();

  try {
    // 1. Delete associated role permissions
    await db.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(roleId).run();
    // 2. Delete user role assignments
    await db.prepare('DELETE FROM user_roles WHERE role_id = ?').bind(roleId).run();
    // 3. Delete the role itself
    await db.prepare('DELETE FROM roles WHERE id = ?').bind(roleId).run();

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error: any) {
    console.error('deleteRoleAction failed:', error);
    return { success: false, error: error.message };
  }
}


