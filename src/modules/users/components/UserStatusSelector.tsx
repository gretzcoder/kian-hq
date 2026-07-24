'use client';

import { useState } from 'react';
import { updateUserStatus } from '../actions';

type UserStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE';

export default function UserStatusSelector({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<UserStatus>(currentStatus as UserStatus);

  const handleChange = async (newStatus: UserStatus) => {
    setLoading(true);
    try {
      const res = await updateUserStatus(userId, newStatus);
      if (res.success) {
        setStatus(newStatus);
      } else {
        alert(res.error ?? 'Failed to update user status.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getStyle = (s: UserStatus) => {
    switch (s) {
      case 'ACTIVE':
        return 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 bg-emerald-500/5';
      case 'SUSPENDED':
        return 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/60 bg-red-500/5';
      case 'PENDING':
        return 'text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 bg-amber-500/5';
      default:
        return 'text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/60 bg-zinc-500/5';
    }
  };

  return (
    <select
      value={status}
      disabled={loading}
      onChange={(e) => handleChange(e.target.value as UserStatus)}
      className={`bg-zinc-50 dark:bg-zinc-900 border text-xs rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer font-bold disabled:opacity-50 transition-all ${getStyle(status)}`}
    >
      <option value="ACTIVE">Active</option>
      <option value="SUSPENDED">Suspended</option>
      <option value="PENDING">Pending Approval</option>
      <option value="INACTIVE">Inactive</option>
    </select>
  );
}
