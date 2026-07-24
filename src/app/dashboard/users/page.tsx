import { getSession } from '@/modules/auth/session';
import { hasPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import RoleSelector from '@/modules/users/components/RoleSelector';
import UserTypeSelector from '@/modules/users/components/UserTypeSelector';
import UserStatusSelector from '@/modules/users/components/UserStatusSelector';
import PendingApprovalsList from '@/modules/users/components/PendingApprovalsList';
import UserActionsMenu from '@/modules/users/components/UserActionsMenu';

interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  role_name: string | null;
  role_id: string | null;
  user_type: 'STAFF' | 'OJT';
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

  // 2. Fetch all active and inactive users (not pending) mapped to their role and type
  const usersQuery = `
    SELECT u.id, u.email, u.name, u.status, u.user_type, r.name as role_name, r.id as role_id
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.status != 'PENDING'
    ORDER BY u.created_at DESC
  `;
  const { results: usersRaw } = await db.prepare(usersQuery).all();
  const users = usersRaw as unknown as UserRow[];

  // 3. Fetch all system roles for the dropdown select options
  const { results: rolesRaw } = await db.prepare('SELECT id, name FROM roles ORDER BY name ASC').all();
  const roles = rolesRaw as unknown as RoleRow[];

  // 4. Fetch users awaiting approval (status = 'PENDING')
  const { results: pendingUsersRaw } = await db
    .prepare("SELECT id, name, email, created_at FROM users WHERE status = 'PENDING' ORDER BY created_at ASC")
    .all();
  const pendingUsers = pendingUsersRaw as unknown as Array<{
    id: string;
    name: string;
    email: string;
    created_at: number;
  }>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
          User Management
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Manage system access, adjust member roles, and toggle user classifications.
        </p>
      </div>

      {/* Approvals Section */}
      <PendingApprovalsList pendingUsers={pendingUsers} roles={roles} />

      {/* Users Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/40 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Classification</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50 text-sm">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-800 dark:text-zinc-100">{user.name}</td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <UserStatusSelector
                      userId={user.id}
                      currentStatus={user.status}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <UserTypeSelector
                      userId={user.id}
                      currentUserType={user.user_type || 'STAFF'}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <RoleSelector
                      userId={user.id}
                      currentRoleId={user.role_id || 'role_creator'}
                      roles={roles}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <UserActionsMenu
                      userId={user.id}
                      userName={user.name}
                      isSelf={user.id === session.userId}
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
