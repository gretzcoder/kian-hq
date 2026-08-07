import { getSession } from '@/modules/auth/session';
import { hasPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
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
  user_type: 'STAFF' | 'OJT' | 'EXTERNAL';
}

interface RoleRow {
  id: string;
  name: string;
}

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/');

  // 1. Enforce RBAC security gate
  const canManage = await hasPermission(session.userId, 'ADMIN_USERS');
  if (!canManage) {
    redirect('/dashboard');
  }

  const db = await getDB();

  // 2. Fetch all active and inactive users (not pending) mapped to their role and type
  const usersQuery = `
    SELECT u.id, u.email, u.name, u.status, u.user_type, u.avatar_url, r.name as role_name, r.id as role_id
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.status != 'PENDING'
    ORDER BY u.created_at DESC
  `;
  const { results: usersRaw } = await db.prepare(usersQuery).all();
  const users = usersRaw as unknown as (UserRow & { avatar_url?: string | null })[];

  // 3. Fetch all system roles for the dropdown select options
  const { results: rolesRaw } = await db.prepare('SELECT id, name FROM roles ORDER BY name ASC').all();
  const roles = rolesRaw as unknown as RoleRow[];

  // 4. Fetch users awaiting approval (status = 'PENDING')
  const { results: pendingUsersRaw } = await db
    .prepare("SELECT id, name, email, avatar_url, created_at FROM users WHERE status = 'PENDING' ORDER BY created_at ASC")
    .all();
  const pendingUsers = pendingUsersRaw as unknown as Array<{
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
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

      {/* Users Table (Desktop) / Cards (Mobile) */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 rounded-2xl overflow-hidden shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
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
                  <td className="px-6 py-4 font-bold text-zinc-800 dark:text-zinc-100">
                    <Link href={`/dashboard/profile?userId=${user.id}`} className="flex items-center gap-3 group w-fit">
                      <UserAvatar src={user.avatar_url} name={user.name} size="md" square />
                      <span className="group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:underline">
                        {user.name}
                      </span>
                    </Link>
                  </td>
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

        {/* Mobile Responsive Cards View */}
        <div className="block md:hidden space-y-3 p-3">
          {users.map((user) => (
            <div key={user.id} className="p-4 space-y-3 bg-white dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
              {/* Header: User Profile Info */}
              <div className="flex items-center gap-3">
                <Link href={`/dashboard/profile?userId=${user.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                  <UserAvatar src={user.avatar_url} name={user.name} size="md" square />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:underline">
                      {user.name}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono truncate">{user.email}</p>
                  </div>
                </Link>
              </div>

              {/* Status, Classification & Role Selectors Grid */}
              <div className="space-y-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase text-zinc-400 mb-1">Status</p>
                    <UserStatusSelector
                      userId={user.id}
                      currentStatus={user.status}
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-zinc-400 mb-1">Klasifikasi</p>
                    <UserTypeSelector
                      userId={user.id}
                      currentUserType={user.user_type || 'STAFF'}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase text-zinc-400 mb-1">Role Utama</p>
                  <RoleSelector
                    userId={user.id}
                    currentRoleId={user.role_id || 'role_creator'}
                    roles={roles}
                  />
                </div>
              </div>

              {/* Management Action Buttons Row */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Aksi Kelola</span>
                <UserActionsMenu
                  userId={user.id}
                  userName={user.name}
                  isSelf={user.id === session.userId}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
