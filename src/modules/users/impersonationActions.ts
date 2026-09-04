'use server';

import { cookies } from 'next/headers';
import { getDB } from '@/db/client';
import { getSession } from '@/modules/auth/session';

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

const impersonationAuthMemoryCache = new Map<string, { data: boolean; ts: number }>();
const availableUsersMemoryCache = new Map<string, { data: ImpersonateUserItem[]; ts: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Checks if a real user is authorized to perform user impersonation.
 */
export async function isAuthorizedForImpersonation(realUserId: string): Promise<boolean> {
  if (!realUserId) return false;

  const now = Date.now();
  const cached = impersonationAuthMemoryCache.get(realUserId);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

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

    const isAuth = (
      perms.includes('ADMIN_USERS') ||
      perms.includes('ADMIN_SYSTEM') ||
      roles.includes('EXECUTIVE') ||
      roles.includes('COORDINATOR')
    );

    impersonationAuthMemoryCache.set(realUserId, { data: isAuth, ts: now });
    return isAuth;
  } catch (err) {
    console.error('isAuthorizedForImpersonation check failed:', err);
    return false;
  }
}

/**
 * Retrieves list of active users for quick impersonation shortcut (excluding the current user).
 */
export async function getAvailableUsersForImpersonation(): Promise<ImpersonateUserItem[]> {
  const session = await getSession();
  if (!session) return [];

  const currentUserId = session.realUserId || session.userId;
  const now = Date.now();
  const cached = availableUsersMemoryCache.get(currentUserId);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT u.id, u.name, u.email, r.name as role_name
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.status = 'ACTIVE' AND u.id != ?
        ORDER BY u.name ASC
      `)
      .bind(currentUserId)
      .all();

    const userItems = (results || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleName: u.role_name || 'Member',
    }));

    availableUsersMemoryCache.set(currentUserId, { data: userItems, ts: now });
    return userItems;
  } catch (err) {
    console.error('getAvailableUsersForImpersonation failed:', err);
    return [];
  }
}

/**
 * Starts impersonating a target user by setting the cookie.
 */
export async function startImpersonatingUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized: Session missing.' };
  }

  const realUserId = session.realUserId || session.userId;
  if (targetUserId === realUserId) {
    return { success: false, error: 'Anda tidak dapat memfasilitasi impersonate akun Anda sendiri.' };
  }

  const isAuth = await isAuthorizedForImpersonation(realUserId);
  if (!isAuth) {
    return { success: false, error: 'Forbidden: You do not have permission to impersonate users.' };
  }

  const db = await getDB();
  const targetUser = await db
    .prepare('SELECT id, name, email FROM users WHERE id = ? AND status = "ACTIVE"')
    .bind(targetUserId)
    .first() as { id: string; name: string; email: string } | null;

  if (!targetUser) {
    return { success: false, error: 'User target not found or inactive.' };
  }

  const cookieStore = await cookies();
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
