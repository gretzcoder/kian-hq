'use server';

import { cookies } from 'next/headers';
import { getDB } from '@/db/client';

const IMPERSONATE_COOKIE = 'impersonate_user_id';

export interface ImpersonatedUserInfo {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  realUserId: string;
}

export interface ImpersonateUserItem {
  id: string;
  name: string;
  email: string;
  roleName: string;
}

/**
 * Checks if a real user is authorized to perform user impersonation.
 */
export async function isAuthorizedForImpersonation(realUserId: string): Promise<boolean> {
  if (!realUserId) return false;

  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT p.name AS perm_name, r.name AS role_name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = ?
      `)
      .bind(realUserId)
      .all();

    const perms = (results || []).map((r: any) => String(r.perm_name));
    const roles = (results || []).map((r: any) => String(r.role_name).toUpperCase());

    return (
      perms.includes('ADMIN_USERS') ||
      perms.includes('ADMIN_SYSTEM') ||
      roles.includes('EXECUTIVE') ||
      roles.includes('COORDINATOR')
    );
  } catch (err) {
    console.error('isAuthorizedForImpersonation check failed:', err);
    return false;
  }
}

/**
 * Retrieves list of active users for quick impersonation shortcut.
 */
export async function getAvailableUsersForImpersonation(): Promise<ImpersonateUserItem[]> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT u.id, u.name, u.email, r.name as role_name
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.status = 'ACTIVE'
        ORDER BY u.name ASC
      `)
      .all();

    return (results || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleName: u.role_name || 'Member',
    }));
  } catch (err) {
    console.error('getAvailableUsersForImpersonation failed:', err);
    return [];
  }
}

/**
 * Starts impersonating a target user by setting the cookie.
 */
export async function startImpersonatingUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  if (!sessionId) {
    return { success: false, error: 'Unauthorized: Session missing.' };
  }

  const db = await getDB();
  const targetUser = await db
    .prepare('SELECT id, name, email FROM users WHERE id = ? AND status = "ACTIVE"')
    .bind(targetUserId)
    .first() as { id: string; name: string; email: string } | null;

  if (!targetUser) {
    return { success: false, error: 'User target not found or inactive.' };
  }

  cookieStore.set(IMPERSONATE_COOKIE, targetUserId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400, // 24 hours
  });

  return { success: true };
}

/**
 * Stops impersonating and deletes the cookie.
 */
export async function stopImpersonatingUser(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
  return { success: true };
}

/**
 * Gets the current active impersonated user ID from cookie.
 */
export async function getActiveImpersonateUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(IMPERSONATE_COOKIE)?.value || null;
  } catch {
    return null;
  }
}
