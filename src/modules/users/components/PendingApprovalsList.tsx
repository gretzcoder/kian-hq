'use client';

import { useState } from 'react';
import { approveUser, rejectUser } from '../actions';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
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
  const [selectedTypes, setSelectedTypes] = useState<Record<string, 'STAFF' | 'OJT' | 'EXTERNAL'>>({});

  const handleRoleChange = (userId: string, roleId: string) => {
    setSelectedRoles((prev) => ({ ...prev, [userId]: roleId }));
    if (roleId === 'role_collaborator' || roleId === 'role_creator') {
      setSelectedTypes((prev) => ({ ...prev, [userId]: 'EXTERNAL' }));
    }
  };

  const handleTypeChange = (userId: string, type: 'STAFF' | 'OJT' | 'EXTERNAL') => {
    setSelectedTypes((prev) => ({ ...prev, [userId]: type }));
  };

  const handleApprove = async (userId: string) => {
    const roleId = selectedRoles[userId] || 'role_creator';
    const userType = selectedTypes[userId] || (roleId === 'role_collaborator' || roleId === 'role_creator' ? 'EXTERNAL' : 'STAFF');
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
    <div className="border border-amber-500/20 dark:border-amber-500/10 bg-amber-500/5 dark:bg-amber-500/[0.02] rounded-3xl p-4 sm:p-6 space-y-4 shadow-[0_4px_20px_rgba(245,158,11,0.02)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-500/10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <h2 className="text-sm sm:text-base font-black text-amber-900 dark:text-amber-300 tracking-tight">
            Persetujuan Akun Baru
          </h2>
          <span className="text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
            {pendingUsers.length} Menunggu
          </span>
        </div>
        <p className="text-[11px] text-amber-700/80 dark:text-amber-500/80 leading-relaxed">
          Tentukan klasifikasi & peran keamanan untuk memberikan akses ke KIAN HQ.
        </p>
      </div>

      <div className="divide-y divide-amber-500/10">
        {pendingUsers.map((user) => {
          const selectedRole = selectedRoles[user.id] || 'role_creator';
          const selectedType = selectedTypes[user.id] || (selectedRole === 'role_collaborator' || selectedRole === 'role_creator' ? 'EXTERNAL' : 'STAFF');
          const isProcessing = loading === user.id;

          return (
            <div
              key={user.id}
              className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              {/* User info */}
              <div className="flex items-center gap-3 min-w-0">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-9 h-9 rounded-xl border border-amber-500/20 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xs font-black shrink-0 uppercase">
                    {user.name.substring(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{user.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">{user.email}</p>
                </div>
              </div>

              {/* Selectors and Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  {/* Type Selection */}
                  <select
                    value={selectedType}
                    disabled={isProcessing}
                    onChange={(e) => handleTypeChange(user.id, e.target.value as any)}
                    className="w-full sm:w-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer text-zinc-700 dark:text-zinc-300 font-bold"
                  >
                    <option value="STAFF">Staff Utama</option>
                    <option value="OJT">On the Job Training</option>
                    <option value="EXTERNAL">External</option>
                  </select>

                  {/* Role select */}
                  <select
                    value={selectedRole}
                    disabled={isProcessing}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="w-full sm:w-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer text-zinc-700 dark:text-zinc-300 font-bold"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Approve Button */}
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-60 text-center active:scale-95"
                  >
                    {isProcessing ? 'Processing...' : 'Acc User'}
                  </button>

                  {/* Reject Button */}
                  <button
                    onClick={() => handleReject(user.id, user.name)}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-initial bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-60 text-center active:scale-95"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
