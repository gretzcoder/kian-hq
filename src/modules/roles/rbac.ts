import { getDB, getKV } from '@/db/client';

const PERMISSIONS_CACHE_TTL = 3600; // 1 hour cache TTL

/**
 * Retrieves the list of permissions for a given user.
 * Utilizes Cloudflare KV as a fast cache layer before querying Cloudflare D1 SQL.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const kv = await getKV();
  const cacheKey = `user:permissions:${userId}`;

  try {
    // 1. Try to fetch from KV Cache
    const cached = await kv.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as string[];
    }
  } catch (err) {
    console.error('KV Permissions Cache read error:', err);
  }

  // 2. Cache miss or error, query D1 Database
  const db = await getDB();
  try {
    const query = `
      SELECT DISTINCT p.name as permission_name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
    `;
    const { results } = await db.prepare(query).bind(userId).all();
    const permissions = results.map((row: any) => row.permission_name as string);

    // 3. Cache the results in KV
    try {
      await kv.put(cacheKey, JSON.stringify(permissions), {
        expirationTtl: PERMISSIONS_CACHE_TTL,
      });
    } catch (err) {
      console.error('KV Permissions Cache write error:', err);
    }

    return permissions;
  } catch (dbErr) {
    console.error('D1 Database query for user permissions failed:', dbErr);
    return [];
  }
}

/**
 * Checks if a user has a specific permission.
 */
export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permissionName) || permissions.includes('MANAGE');
}

/**
 * Clears the permissions cache for a user (call when roles/permissions change).
 */
export async function clearPermissionsCache(userId: string): Promise<void> {
  const kv = await getKV();
  const cacheKey = `user:permissions:${userId}`;
  try {
    await kv.delete(cacheKey);
  } catch (err) {
    console.error('Failed to clear permissions cache:', err);
  }
}

/**
 * Asserts that a user has a specific permission. Throws an error if unauthorized.
 * Useful for Server Actions and API endpoints.
 */
export async function checkPermission(userId: string, permissionName: string): Promise<void> {
  const allowed = await hasPermission(userId, permissionName);
  if (!allowed) {
    throw new Error(`Forbidden: Insufficient permissions. Requires ${permissionName}.`);
  }
}

