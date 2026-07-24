'use client';

import { useState, useEffect } from 'react';
import { approveUser, rejectUser } from '@/modules/users/actions';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  created_at: number;
}

interface Role {
  id: string;
  name: string;
}

interface PendingApprovalsListProps {
  pendingUsers: PendingUser[];
  roles: Role[];
}

export default function PendingApprovalsList({
  pendingUsers: initialPendingUsers,
  roles,
}: PendingApprovalsListProps) {
  const [users, setUsers] = useState<PendingUser[]>(initialPendingUsers);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, 'approve' | 'reject' | null>>({});
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRoleChange = (userId: string, roleId: string) => {
    setSelectedRoles((prev) => ({ ...prev, [userId]: roleId }));
  };

  const handleApprove = async (userId: string) => {
    // Default to 'role_creator' if no role is explicitly selected
    const roleId = selectedRoles[userId] || roles.find(r => r.name === 'CREATOR')?.id || roles[0]?.id;
    if (!roleId) {
      alert('Please select a role first');
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [userId]: 'approve' }));
    try {
      const res = await approveUser(userId, roleId);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        alert(res.error || 'Failed to approve user');
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred');
    } finally {
      setLoadingStates((prev) => ({ ...prev, [userId]: null }));
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('Are you sure you want to reject and delete this registration?')) {
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [userId]: 'reject' }));
    try {
      const res = await rejectUser(userId);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        alert(res.error || 'Failed to reject user');
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred');
    } finally {
      setLoadingStates((prev) => ({ ...prev, [userId]: null }));
    }
  };

  if (users.length === 0) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-3xl p-8 text-center">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No new registrations awaiting approval.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/10">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          Pending Approvals
          <span className="ml-1 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            {users.length} Awaiting
          </span>
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Review new signups, assign them a security role, and approve their access to Kian HQ.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Registration Date</th>
              <th className="px-6 py-4">Assign Role</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/40 text-sm">
            {users.map((user) => {
              const currentSelectedRole = selectedRoles[user.id] || roles.find(r => r.name === 'CREATOR')?.id || roles[0]?.id;
              const isApproving = loadingStates[user.id] === 'approve';
              const isRejecting = loadingStates[user.id] === 'reject';
              const isLoading = isApproving || isRejecting;

              return (
                <tr
                  key={user.id}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors"
                >
                  <td className="px-6 py-4 font-bold text-zinc-950 dark:text-zinc-50">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 text-xs">
                    {isMounted
                      ? new Date(user.created_at * 1000).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : ''}
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative inline-block w-48">
                      <select
                        value={currentSelectedRole}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isLoading}
                        className="w-full appearance-none bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-semibold rounded-xl pl-4 pr-10 py-2.5 focus:outline-none cursor-pointer transition-all duration-200 disabled:opacity-50"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id} className="bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                        <svg
                          className="fill-current h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                        </svg>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <button
                        onClick={() => handleReject(user.id)}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/5 dark:hover:bg-red-500/10 border border-transparent rounded-xl transition-all duration-200 disabled:opacity-50"
                      >
                        {isRejecting ? 'Rejecting...' : 'Reject'}
                      </button>
                      <button
                        onClick={() => handleApprove(user.id)}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-xs font-black text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-[0_4px_12px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_16px_rgba(147,51,234,0.25)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:scale-100"
                      >
                        {isApproving ? 'Approving...' : 'Approve Access'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
