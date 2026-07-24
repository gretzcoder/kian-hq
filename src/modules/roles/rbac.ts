import { getDB, getKV } from '@/db/client';

const PERMISSIONS_CACHE_TTL = 3600; // 1 hour

/**
 * Retrieves the list of permission names for a given user.
 * Uses Cloudflare KV as a fast cache layer before querying D1.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const kv = await getKV();
  const cacheKey = `user:permissions:${userId}`;

  try {
    const cached = await kv.get(cacheKey);
    if (cached) return JSON.parse(cached) as string[];
  } catch (err) {
    console.error('KV Permissions Cache read error:', err);
  }

  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT DISTINCT p.name AS permission_name
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur       ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?
      `)
      .bind(userId)
      .all();

    const permissions = results.map((r: any) => r.permission_name as string);

    try {
      await kv.put(cacheKey, JSON.stringify(permissions), {
        expirationTtl: PERMISSIONS_CACHE_TTL,
      });
    } catch (err) {
      console.error('KV Permissions Cache write error:', err);
    }

    return permissions;
  } catch (dbErr) {
    console.error('D1 permissions query failed:', dbErr);
    return [];
  }
}

/**
 * Retrieves the role names for a given user.
 * (Useful for dashboard context labels, NOT for RBAC logic.)
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT r.name FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `)
      .bind(userId)
      .all();
    return results.map((r: any) => r.name as string);
  } catch (err) {
    console.error('getUserRoles failed:', err);
    return [];
  }
}

/**
 * Checks if a user has a specific permission.
 * MANAGE permission bypasses all other checks (Executive superuser pattern).
 */
export async function hasPermission(
  userId: string,
  permissionName: string,
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permissionName);
}

/**
 * Asserts that a user has a specific permission.
 * Throws a Forbidden error if not — use in Server Actions & API routes.
 */
export async function checkPermission(
  userId: string,
  permissionName: string,
): Promise<void> {
  const allowed = await hasPermission(userId, permissionName);
  if (!allowed) {
    throw new Error(
      `Forbidden: Requires ${permissionName} permission.`,
    );
  }
}

/**
 * Batch-fetch permissions + roles in a single call.
 * Use at page level to avoid multiple round-trips to KV/D1.
 *
 * @example
 * const ctx = await getSessionContext(session.userId);
 * const canCreate = ctx.can('CREATE_PROJECT');
 */
export async function getSessionContext(userId: string): Promise<{
  can: (permission: string) => boolean;
  permissions: Set<string>;
  roles: string[];
}> {
  const [permissions, roles] = await Promise.all([
    getUserPermissions(userId),
    getUserRoles(userId),
  ]);

  const permSet = new Set(permissions);

  return {
    can: (perm: string) => permSet.has(perm),
    permissions: permSet,
    roles,
  };
}

/**
 * Clears the KV permissions cache for a user.
 * Must be called after any role or permission change.
 */
export async function clearPermissionsCache(userId: string): Promise<void> {
  const kv = await getKV();
  try {
    await kv.delete(`user:permissions:${userId}`);
  } catch (err) {
    console.error('Failed to clear permissions cache:', err);
  }
}

/**
 * Bulk-invalidates KV permission cache for all users in a given role.
 * Call after role_permissions matrix changes.
 */
export async function invalidateCacheForRole(roleId: string): Promise<void> {
  try {
    const db = await getDB();
    const kv = await getKV();
    const { results } = await db
      .prepare('SELECT user_id FROM user_roles WHERE role_id = ?')
      .bind(roleId)
      .all();

    await Promise.allSettled(
      results.map((row: any) => kv.delete(`user:permissions:${row.user_id}`)),
    );
  } catch (err) {
    console.error('invalidateCacheForRole failed:', err);
  }
}
