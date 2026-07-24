'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, clearPermissionsCache } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';
import { generateSalt, hashPassword } from '@/modules/auth/crypto';

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

/**
 * Server Action to approve a pending user, activate their account, and assign their role.
 * Secured by RBAC ('MANAGE' permission).
 */
export async function approveUser(targetUserId: string, roleId: string, userType: 'STAFF' | 'OJT' = 'STAFF') {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  if (!targetUserId || !roleId) {
    return { success: false, error: 'User ID and Role ID are required.' };
  }

  const db = await getDB();

  try {
    // 1. Set user status to ACTIVE and assign userType classification
    await db
      .prepare("UPDATE users SET status = 'ACTIVE', user_type = ? WHERE id = ?")
      .bind(userType, targetUserId)
      .run();

    // 2. Assign their role (clear any existing just in case)
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetUserId).run();
    await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(targetUserId, roleId).run();

    // 3. Clear permissions cache for the target user
    await clearPermissionsCache(targetUserId);

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (err: any) {
    console.error('approveUser failed:', err);
    return { success: false, error: err.message || 'Approval failed' };
  }
}

/**
 * Server Action to reject a pending user.
 * Deletes their record so they can register again if needed.
 * Secured by RBAC ('MANAGE' permission).
 */
export async function rejectUser(targetUserId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  if (!targetUserId) {
    return { success: false, error: 'User ID is required.' };
  }

  const db = await getDB();

  try {
    // 1. Delete user roles
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetUserId).run();

    // 2. Delete user
    await db.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId).run();

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (err: any) {
    console.error('rejectUser failed:', err);
    return { success: false, error: err.message || 'Rejection failed' };
  }
}

/**
 * Server Action to update a user's type (STAFF vs OJT).
 * Secured by RBAC ('MANAGE' permission).
 */
export async function updateUserType(targetUserId: string, newUserType: 'STAFF' | 'OJT') {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  if (targetUserId === session.userId) {
    return { success: false, error: 'You cannot change your own user type.' };
  }

  const db = await getDB();

  try {
    await db
      .prepare('UPDATE users SET user_type = ? WHERE id = ?')
      .bind(newUserType, targetUserId)
      .run();

    await clearPermissionsCache(targetUserId);

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (err: any) {
    console.error('updateUserType failed:', err);
    return { success: false, error: err.message || 'Database update failed' };
  }
}

/**
 * Server Action to update a user's status (ACTIVE, PENDING, SUSPENDED, etc.).
 * Secured by RBAC ('MANAGE' permission).
 */
export async function updateUserStatus(
  targetUserId: string,
  newStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE',
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  if (targetUserId === session.userId) {
    return { success: false, error: 'You cannot change your own status.' };
  }

  const db = await getDB();

  try {
    await db
      .prepare("UPDATE users SET status = ? WHERE id = ?")
      .bind(newStatus, targetUserId)
      .run();

    await clearPermissionsCache(targetUserId);

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (err: any) {
    console.error('updateUserStatus failed:', err);
    return { success: false, error: err.message || 'Database update failed' };
  }
}

/**
 * Resets a user's password to the default password: "kianizer".
 * Secured by RBAC ('MANAGE' permission).
 */
export async function resetUserPassword(targetUserId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  const db = await getDB();
  const salt = generateSalt();
  const passwordHash = await hashPassword('kianizer', salt);

  const dbPasswordHash = `${salt}:${passwordHash}`;

  try {
    await db
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(dbPasswordHash, targetUserId)
      .run();

    return { success: true };
  } catch (err: any) {
    console.error('resetUserPassword failed:', err);
    return { success: false, error: err.message || 'Password reset failed' };
  }
}

/**
 * Deletes a user completely from the platform.
 * Secured by RBAC ('MANAGE' permission).
 * Prevents self-deletion.
 */
export async function deleteUser(targetUserId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'MANAGE');

  if (targetUserId === session.userId) {
    return { success: false, error: 'You cannot delete yourself.' };
  }

  const db = await getDB();

  try {
    // 1. Delete dependent table entries
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetUserId).run();
    await db.prepare('DELETE FROM workspace_members WHERE user_id = ?').bind(targetUserId).run();
    await db.prepare('DELETE FROM task_assignments WHERE user_id = ?').bind(targetUserId).run();

    // 2. Set null on creator/approver fields to prevent FK errors
    await db.prepare('UPDATE content_briefs SET approved_by = NULL WHERE approved_by = ?').bind(targetUserId).run();
    await db.prepare('UPDATE content_briefs SET created_by = NULL WHERE created_by = ?').bind(targetUserId).run();
    await db.prepare('UPDATE projects SET created_by = NULL WHERE created_by = ?').bind(targetUserId).run();
    await db.prepare('UPDATE tasks SET created_by = NULL WHERE created_by = ?').bind(targetUserId).run();
    await db.prepare('UPDATE workspaces SET created_by = NULL WHERE created_by = ?').bind(targetUserId).run();
    await db.prepare('UPDATE announcements SET author_id = NULL WHERE author_id = ?').bind(targetUserId).run();
    await db.prepare('UPDATE workflow_events SET triggered_by = NULL WHERE triggered_by = ?').bind(targetUserId).run();

    // 3. Delete user record
    await db.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId).run();

    await clearPermissionsCache(targetUserId);

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (err: any) {
    console.error('deleteUser failed:', err);
    return { success: false, error: err.message || 'User deletion failed' };
  }
}
