import { getDB, getKV } from '@/db/client';
import { getActiveSimulatedRole } from './viewAsRoleActions';

const PERMISSIONS_CACHE_TTL = 3600; // 1 hour

/**
 * Retrieves the list of permission names for a given user.
 * Uses Cloudflare KV as a fast cache layer before querying D1.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const simRole = await getActiveSimulatedRole();
  if (simRole) {
    const db = await getDB();
    try {
      const { results } = await db
        .prepare(`
          SELECT DISTINCT p.name AS permission_name
          FROM permissions p
          JOIN role_permissions rp ON p.id = rp.permission_id
          WHERE rp.role_id = ?
        `)
        .bind(simRole.roleId)
        .all();
      return (results || []).map((r: any) => r.permission_name as string);
    } catch (err) {
      console.error('Simulated permissions query failed:', err);
      return [];
    }
  }

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
  const simRole = await getActiveSimulatedRole();
  if (simRole) {
    return [simRole.roleName];
  }

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
 * ADMIN_SYSTEM permission bypasses all other checks (Executive superuser pattern).
 */
export async function hasPermission(
  userId: string,
  permissionName: string,
): Promise<boolean> {
  const simRole = await getActiveSimulatedRole();
  const userType = await getUserType(userId);

  // OJT Interns cannot execute administrative/export functions
  if (userType === 'OJT' && ['ADMIN_SYSTEM', 'ADMIN_USERS', 'ADMIN_ROLES', 'EXPORT_DATA', 'MANAGE'].includes(permissionName)) {
    return false;
  }
  const permissions = await getUserPermissions(userId);

  // Superadmin wildcard check (disabled during simulation so admin experiences true role restrictions)
  if (!simRole && (permissions.includes('ADMIN_SYSTEM') || permissions.includes('MANAGE'))) return true;
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
 * Retrieves the user type (STAFF vs OJT) from D1.
 */
export async function getUserType(userId: string): Promise<'STAFF' | 'OJT' | 'EXTERNAL'> {
  const simRole = await getActiveSimulatedRole();
  if (simRole && simRole.userType) {
    return simRole.userType;
  }

  const db = await getDB();
  try {
    const user = await db
      .prepare('SELECT user_type FROM users WHERE id = ?')
      .bind(userId)
      .first() as { user_type: string } | null;
    return (user?.user_type as 'STAFF' | 'OJT' | 'EXTERNAL') || 'STAFF';
  } catch (err) {
    console.error('getUserType failed:', err);
    return 'STAFF';
  }
}

/**
 * Checks if a user is the designated OJT Coordinator for a workspace.
 */
export async function isWorkspaceCoordinator(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDB();
  try {
    const workspace = await db
      .prepare('SELECT ojt_coordinator_id FROM workspaces WHERE id = ?')
      .bind(workspaceId)
      .first() as { ojt_coordinator_id: string | null } | null;
    return workspace?.ojt_coordinator_id === userId;
  } catch {
    return false;
  }
}

/**
 * Retrieves the local OJT role of a user inside a workspace.
 * Returns null if they are not a member of the workspace.
 * Returns 'LEADER' if they have it, otherwise returns their first role.
 */
export async function getLocalWorkspaceRole(
  workspaceId: string,
  userId: string,
): Promise<'LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER' | null> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare('SELECT team_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .all();
    if (!results || results.length === 0) return null;
    const roles = results.map((r: any) => r.team_role);
    if (roles.includes('LEADER')) return 'LEADER';
    return (roles[0] as any) || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves all local OJT roles of a user inside a workspace.
 */
export async function getLocalWorkspaceRoles(
  workspaceId: string,
  userId: string,
): Promise<('LEADER' | 'RESEARCHER' | 'PLANNER' | 'CREATOR' | 'MEMBER')[]> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare('SELECT team_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .all();
    return results.map((r: any) => r.team_role) as any[];
  } catch {
    return [];
  }
}

/**
 * Batch-fetch permissions + roles in a single call.
 * Use at page level to avoid multiple round-trips to KV/D1.
 */
export async function getSessionContext(userId: string): Promise<{
  can: (permission: string) => boolean;
  permissions: Set<string>;
  roles: string[];
  userType: 'STAFF' | 'OJT' | 'EXTERNAL';
  simulatedRole?: { roleId: string; roleName: string; userType: 'STAFF' | 'OJT' | 'EXTERNAL' } | null;
}> {
  const simRole = await getActiveSimulatedRole();

  const [permissions, roles, userType] = await Promise.all([
    getUserPermissions(userId),
    getUserRoles(userId),
    getUserType(userId),
  ]);

  const permSet = new Set(permissions);
  const isSuperadmin = !simRole && (permSet.has('ADMIN_SYSTEM') || permSet.has('MANAGE'));

  return {
    can: (perm: string) => {
      const activeUserType = simRole ? simRole.userType : userType;
      if (activeUserType === 'OJT' && ['ADMIN_SYSTEM', 'ADMIN_USERS', 'ADMIN_ROLES', 'EXPORT_DATA', 'MANAGE'].includes(perm)) {
        return false;
      }
      if (isSuperadmin) return true;
      return permSet.has(perm);
    },
    permissions: permSet,
    roles,
    userType: simRole ? simRole.userType : userType,
    simulatedRole: simRole ? { roleId: simRole.roleId, roleName: simRole.roleName, userType: simRole.userType } : null,
  };
}

/**
 * Clears the KV permissions cache for a user.
 * Must be called after any role or permission change.
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

/**
 * Centered permission engine checking both Global RBAC permissions
 * and Local Workspace Roles (OJT Leader, OJT Coordinator).
 */
export async function hasWorkspacePermission(
  userId: string,
  workspaceId: string,
  permissionName: string
): Promise<boolean> {
  const db = await getDB();
  const ctx = await getSessionContext(userId);

  const ws = await db
    .prepare('SELECT ojt_coordinator_id, workspace_type FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { ojt_coordinator_id: string | null; workspace_type: string } | null;

  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') ||
      ctx.roles.includes('EXECUTIVE') ||
      ctx.can('MANAGE') ||
      ctx.can('WORKSPACE_MANAGE') ||
      ctx.permissions.has('ADMIN_SYSTEM'));

  const isDesignatedMentor = Boolean(ws?.ojt_coordinator_id && ws.ojt_coordinator_id === userId);

  // 1. Workspace editing: ONLY Coordinator / Admin
  if (['UPDATE_WORKSPACE', 'WORKSPACE_MANAGE'].includes(permissionName)) {
    return isCoordinator;
  }

  // 2. MENTOR workspace permissions:
  // - Creation and deletion: ONLY Coordinator / Admin
  // - Editing task details: Mentors (members / designated / mentor role) and Coordinators
  if (ws?.workspace_type === 'MENTOR') {
    if (['TASK_CREATE', 'CREATE_TASK', 'DELETE'].includes(permissionName)) {
      return isCoordinator;
    }
    if (['UPDATE', 'TASK_ASSIGN', 'ASSIGN_TASK', 'REQUEST_REVISION', 'TASK_REVIEW'].includes(permissionName)) {
      const { results: localRoles } = await db
        .prepare('SELECT team_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(workspaceId, userId)
        .all();
      const isMember = localRoles && localRoles.length > 0;
      const isMentorRole = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
      return isMember || isDesignatedMentor || isMentorRole || isCoordinator;
    }
    return isCoordinator;
  }

  // 3. Tasks in other workspaces: ONLY designated mentor or Coordinator / Admin
  if (['TASK_CREATE', 'TASK_ASSIGN', 'CREATE_TASK', 'ASSIGN_TASK', 'DELETE', 'UPDATE', 'REQUEST_REVISION', 'TASK_REVIEW'].includes(permissionName)) {
    return isDesignatedMentor || isCoordinator;
  }

  // 4. General interaction / viewing: Member, Designated Mentor, or Coordinator
  const { results: localRoles } = await db
    .prepare('SELECT team_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .all();

  const isMember = localRoles && localRoles.length > 0;
  return isMember || isDesignatedMentor || isCoordinator;
}

/**
 * Batch-resolves all workspace permission flags in a single pass.
 */
export function resolveWorkspacePermissions(
  ctx: Awaited<ReturnType<typeof getSessionContext>>,
  ojtCoordinatorId: string | null,
  memberRoles: string[],
  userId: string,
  workspaceType?: string,
): {
  canCreateTask: boolean;
  canAssignTask: boolean;
  canDeleteTask: boolean;
  canUpdateWs: boolean;
  canManageMembers: boolean;
} {
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.roles.includes('COORDINATOR') ||
      ctx.roles.includes('EXECUTIVE') ||
      ctx.can('MANAGE') ||
      ctx.can('WORKSPACE_MANAGE') ||
      ctx.permissions.has('ADMIN_SYSTEM'));

  const isDesignatedMentor = Boolean(ojtCoordinatorId && ojtCoordinatorId === userId);

  // RULE 1: Workspace details can ONLY be edited by Coordinator / Admin
  const canUpdateWs = isCoordinator;

  // RULE 2: Tasks in MENTOR workspace
  if (workspaceType === 'MENTOR') {
    const hasMentorRole = ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
    const isMentorMember = isDesignatedMentor || hasMentorRole || memberRoles.length > 0;
    return {
      canCreateTask: isCoordinator,
      canAssignTask: isCoordinator || isMentorMember,
      canDeleteTask: isCoordinator,
      canUpdateWs: isCoordinator,
      canManageMembers: isCoordinator,
    };
  }

  // RULE 3: Tasks in other workspaces can ONLY be created/edited by designated mentor of that workspace, or Coordinator / Admin (bypass)
  const canManageTasks = isDesignatedMentor || isCoordinator;
  const isLeader = memberRoles.includes('LEADER');
  const canManageMembers = isCoordinator || isDesignatedMentor || isLeader;

  return {
    canCreateTask: canManageTasks,
    canAssignTask: canManageTasks,
    canDeleteTask: canManageTasks,
    canUpdateWs,
    canManageMembers,
  };
}
