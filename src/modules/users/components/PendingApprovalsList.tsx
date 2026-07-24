'use client';

import { useState } from 'react';
import { approveUser, rejectUser } from '../actions';

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

export default function PendingApprovalsList({
  pendingUsers,
  roles,
}: {
  pendingUsers: PendingUser[];
  roles: Role[];
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [selectedTypes, setSelectedTypes] = useState<Record<string, 'STAFF' | 'OJT'>>({});

  const handleRoleChange = (userId: string, roleId: string) => {
    setSelectedRoles((prev) => ({ ...prev, [userId]: roleId }));
  };

  const handleTypeChange = (userId: string, type: 'STAFF' | 'OJT') => {
    setSelectedTypes((prev) => ({ ...prev, [userId]: type }));
  };

  const handleApprove = async (userId: string) => {
    const roleId = selectedRoles[userId] || 'role_creator';
    const userType = selectedTypes[userId] || 'STAFF';
    setLoading(userId);
    try {
      const res = await approveUser(userId, roleId, userType);
      if (!res.success) alert(res.error ?? 'Failed to approve user.');
    } catch (err: any) {
      alert(err.message || 'An error occurred during approval.');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (userId: string, name: string) => {
    if (!confirm(`Decline account request from ${name}?`)) return;
    setLoading(userId);
    try {
      const res = await rejectUser(userId);
      if (!res.success) alert(res.error ?? 'Failed to reject user.');
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setLoading(null);
    }
  };

  if (pendingUsers.length === 0) return null;

  return (
    <div className="border border-amber-500/20 dark:border-amber-500/10 bg-amber-500/5 rounded-3xl p-6 space-y-4 shadow-[0_4px_20px_rgba(245,158,11,0.02)]">
      <div>
        <h2 className="text-lg font-black text-amber-800 dark:text-amber-400 flex items-center gap-2">
          <span>⚠️</span> Pending Account Approvals ({pendingUsers.length})
        </h2>
        <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1">
          Review newly registered users, assign their classification, select security roles, and grant access to KIAN HQ.
        </p>
      </div>

      <div className="divide-y divide-amber-500/10">
        {pendingUsers.map((user) => {
          const selectedRole = selectedRoles[user.id] || 'role_creator';
          const selectedType = selectedTypes[user.id] || 'STAFF';
          const isProcessing = loading === user.id;

          return (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{user.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{user.email}</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Type Selection */}
                <select
                  value={selectedType}
                  disabled={isProcessing}
                  onChange={(e) => handleTypeChange(user.id, e.target.value as any)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer text-zinc-700 dark:text-zinc-300 font-bold"
                >
                  <option value="STAFF">Staff Utama</option>
                  <option value="OJT">On the Job Training</option>
                </select>

                {/* Role select */}
                <select
                  value={selectedRole}
                  disabled={isProcessing}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer text-zinc-700 dark:text-zinc-300 font-bold"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {/* Approve Button */}
                <button
                  onClick={() => handleApprove(user.id)}
                  disabled={isProcessing}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all disabled:opacity-60"
                >
                  {isProcessing ? 'Processing...' : 'Acc User'}
                </button>

                {/* Reject Button */}
                <button
                  onClick={() => handleReject(user.id, user.name)}
                  disabled={isProcessing}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs px-4 py-2 rounded-xl transition-all disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
