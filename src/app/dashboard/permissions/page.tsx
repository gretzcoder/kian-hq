import { getSession } from '@/modules/auth/session';
import { hasPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import PermissionMatrix from '@/modules/permissions/components/PermissionMatrix';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

interface RolePermissionRow {
  role_id: string;
  permission_id: string;
}

// Role member counts
interface RoleMemberCount {
  role_id: string;
  count: number;
}

export default async function PermissionsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  // Gate: MANAGE only
  const canManage = await hasPermission(session.userId, 'MANAGE');
  if (!canManage) redirect('/dashboard');

  const db = await getDB();

  const [rolesRaw, permissionsRaw, grantedRaw, memberCountsRaw] = await Promise.all([
    // All roles ordered by clearance level
    db.prepare(`
      SELECT id, name, description FROM roles
      ORDER BY CASE name
        WHEN 'EXECUTIVE' THEN 1
        WHEN 'COORDINATOR' THEN 2
        WHEN 'CREATOR' THEN 3
        WHEN 'COLLABORATOR' THEN 4
        ELSE 5
      END
    `).all(),
    // All permissions
    db.prepare(`
      SELECT id, name, description FROM permissions
      ORDER BY CASE name
        WHEN 'READ' THEN 1 WHEN 'COMMENT' THEN 2 WHEN 'DOWNLOAD' THEN 3
        WHEN 'UPLOAD' THEN 4 WHEN 'CREATE' THEN 5 WHEN 'UPDATE' THEN 6
        WHEN 'ASSIGN' THEN 7 WHEN 'SHARE' THEN 8 WHEN 'APPROVE' THEN 9
        WHEN 'DELETE' THEN 10 WHEN 'EXPORT' THEN 11 WHEN 'MANAGE' THEN 12
        ELSE 13
      END
    `).all(),
    // All current role_permission assignments
    db.prepare('SELECT role_id, permission_id FROM role_permissions').all(),
    // Member count per role
    db.prepare(`
      SELECT role_id, COUNT(*) as count FROM user_roles GROUP BY role_id
    `).all(),
  ]);

  const roles = rolesRaw.results as unknown as Role[];
  const permissions = permissionsRaw.results as unknown as Permission[];
  const granted = grantedRaw.results as unknown as RolePermissionRow[];
  const memberCounts = memberCountsRaw.results as unknown as RoleMemberCount[];

  // Build grantedMap: { roleId: [permId, permId, ...] }
  const grantedMap: Record<string, string[]> = {};
  for (const g of granted) {
    if (!grantedMap[g.role_id]) grantedMap[g.role_id] = [];
    grantedMap[g.role_id].push(g.permission_id);
  }

  // Member count map
  const memberMap: Record<string, number> = {};
  for (const mc of memberCounts) {
    memberMap[mc.role_id] = mc.count;
  }

  // Compute total granted permissions per role for the summary
  const totalPerms = permissions.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
          Permission Management
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Define what each role can do. Changes take effect immediately and invalidate all affected session caches.
        </p>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-4">
        <span className="text-yellow-500 text-lg shrink-0">⚠️</span>
        <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium leading-relaxed">
          <strong>Caution:</strong> Modifying permissions affects all users currently assigned to that role.
          High-risk permissions (DELETE, MANAGE, APPROVE, EXPORT) should only be granted to trusted roles.
          All changes are instant — no confirmation required.
        </p>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => {
          const grantedCount = (grantedMap[role.id] || []).length;
          const members = memberMap[role.id] ?? 0;
          const pct = Math.round((grantedCount / totalPerms) * 100);

          const colors: Record<string, { card: string; bar: string; badge: string }> = {
            EXECUTIVE:    { card: 'border-purple-500/15', bar: 'bg-purple-500', badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
            COORDINATOR:  { card: 'border-blue-500/15',   bar: 'bg-blue-500',   badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
            CREATOR:      { card: 'border-emerald-500/15',bar: 'bg-emerald-500',badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
            COLLABORATOR: { card: 'border-yellow-500/15', bar: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
          };
          const c = colors[role.name] || { card: 'border-zinc-200 dark:border-zinc-800', bar: 'bg-zinc-400', badge: 'bg-zinc-100 text-zinc-600' };

          return (
            <div key={role.id} className={`border ${c.card} bg-white dark:bg-[#09090b]/40 rounded-2xl p-4 shadow-sm`}>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${c.badge}`}>
                {role.name}
              </span>
              <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-3">{grantedCount}<span className="text-sm font-bold text-zinc-400">/{totalPerms}</span></p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-2">Permissions</p>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden mb-2">
                <div className={`h-1.5 rounded-full ${c.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">{members} member{members !== 1 ? 's' : ''} assigned</p>
            </div>
          );
        })}
      </div>

      {/* Interactive Matrix */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Role × Permission Matrix</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Click a cell to grant or revoke. Hover shows intent.
            </p>
          </div>
          <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-3 py-1.5 rounded-full">
            {permissions.length} permissions × {roles.length} roles
          </span>
        </div>

        <PermissionMatrix
          roles={roles}
          permissions={permissions}
          grantedMap={grantedMap}
        />
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
