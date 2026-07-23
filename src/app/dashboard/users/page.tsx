import { getSession } from '@/modules/auth/session';
import { hasPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import RoleSelector from '@/modules/users/components/RoleSelector';

interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  role_name: string | null;
  role_id: string | null;
}

interface RoleRow {
  id: string;
  name: string;
}

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/');

  // 1. Enforce RBAC security gate
  const canManage = await hasPermission(session.userId, 'MANAGE');
  if (!canManage) {
    redirect('/dashboard');
  }

  const db = await getDB();

  // 2. Fetch all users mapped to their role
  const usersQuery = `
    SELECT u.id, u.email, u.name, u.status, r.name as role_name, r.id as role_id
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    ORDER BY u.created_at DESC
  `;
  const { results: usersRaw } = await db.prepare(usersQuery).all();
  const users = usersRaw as unknown as UserRow[];

  // 3. Fetch all system roles for the dropdown select options
  const { results: rolesRaw } = await db.prepare('SELECT id, name FROM roles ORDER BY name ASC').all();
  const roles = rolesRaw as unknown as RoleRow[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
          User Management
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Manage system access, adjust role clearance levels, and verify members.
        </p>
      </div>

      {/* Users Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/40 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Security Clearance (Role)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50 text-sm">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-800 dark:text-zinc-100">{user.name}</td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 dark:border-emerald-500/15">
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <RoleSelector
                      userId={user.id}
                      currentRoleId={user.role_id || 'role_creator'}
                      roles={roles}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
