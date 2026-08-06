'use server';

import { cookies } from 'next/headers';
import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';

export interface ViewAsRoleItem {
  id: string;
  name: string;
  description: string;
  userType: 'STAFF' | 'OJT' | 'EXTERNAL';
}

export interface ActiveSimulatedRole {
  roleId: string;
  roleName: string;
  description: string;
  userType: 'STAFF' | 'OJT' | 'EXTERNAL';
}

const VIEW_AS_ROLE_COOKIE = 'view_as_role';

/**
 * Checks if the currently logged-in real user is authorized to use "View As Role".
 * Queries D1 directly to prevent circular dependency with RBAC functions.
 */
export async function isAuthorizedForViewAs(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const realUserId = session.realUserId || session.userId;

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
      perms.includes('VIEW_AS_ROLE') ||
      perms.includes('ADMIN_ROLES') ||
      perms.includes('ADMIN_USERS') ||
      perms.includes('ADMIN_SYSTEM') ||
      roles.includes('EXECUTIVE') ||
      roles.includes('COORDINATOR')
    );
  } catch (err) {
    console.error('isAuthorizedForViewAs check failed:', err);
    return false;
  }
}

/**
 * Retrieves list of available roles for View As selection.
 */
export async function getAvailableRolesForViewAs(): Promise<ViewAsRoleItem[]> {
  const isAuth = await isAuthorizedForViewAs();
  if (!isAuth) return [];

  const db = await getDB();
  try {
    const { results } = await db
      .prepare('SELECT id, name, description FROM roles ORDER BY id ASC')
      .all();

    const roles: ViewAsRoleItem[] = (results || []).map((r: any) => {
      const isOjt = r.id === 'role_troopers' || String(r.name).toUpperCase().includes('TROOPERS');
      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        userType: isOjt ? 'OJT' : 'STAFF',
      };
    });

    return roles;
  } catch (err) {
    console.error('getAvailableRolesForViewAs failed:', err);
    return [];
  }
}

/**
 * Sets the active simulated role in a cookie.
 */
export async function setViewAsRole(roleId: string): Promise<{ success: boolean; error?: string }> {
  const isAuth = await isAuthorizedForViewAs();
  if (!isAuth) {
    return { success: false, error: 'Unauthorized to use View As Role feature.' };
  }

  const availableRoles = await getAvailableRolesForViewAs();
  const selectedRole = availableRoles.find((r) => r.id === roleId);

  if (!selectedRole) {
    return { success: false, error: 'Selected role does not exist.' };
  }

  const simData: ActiveSimulatedRole = {
    roleId: selectedRole.id,
    roleName: selectedRole.name,
    description: selectedRole.description,
    userType: selectedRole.userType,
  };

  const cookieStore = await cookies();
  cookieStore.set(VIEW_AS_ROLE_COOKIE, JSON.stringify(simData), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400, // 24 hours
  });

  return { success: true };
}

/**
 * Clears the active simulated role cookie.
 */
export async function clearViewAsRole(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_ROLE_COOKIE);
  return { success: true };
}

/**
 * Retrieves current active simulated role directly from cookie.
 * No circular calls to RBAC functions.
 */
export async function getActiveSimulatedRole(): Promise<ActiveSimulatedRole | null> {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(VIEW_AS_ROLE_COOKIE)?.value;
    if (!cookieVal) return null;

    return JSON.parse(cookieVal) as ActiveSimulatedRole;
  } catch {
    return null;
  }
}
