'use client';

import { useState } from 'react';
import { resetUserPassword, deleteUser } from '../actions';

export default function UserActionsMenu({
  userId,
  userName,
  isSelf,
}: {
  userId: string;
  userName: string;
  isSelf: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!confirm(`Reset password for "${userName}" to the default "kianizer"?`)) return;

    setLoading(true);
    setSuccessMsg(null);
    try {
      const res = await resetUserPassword(userId);
      if (res.success) {
        setSuccessMsg('PW reset to "kianizer"!');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(res.error ?? 'Failed to reset password.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirm(`Are you sure you want to completely delete user "${userName}"? This will remove all their roles, assignments, and access. This action cannot be undone.`)) return;

    setLoading(true);
    setSuccessMsg(null);
    try {
      const res = await deleteUser(userId);
      if (!res.success) {
        alert(res.error ?? 'Failed to delete user.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) {
    return <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold">Active Session</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {successMsg ? (
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 px-2..5 py-1 rounded-lg border border-emerald-500/10">
          {successMsg}
        </span>
      ) : (
        <>
          <button
            onClick={handleResetPassword}
            disabled={loading}
            title="Reset password to 'kianizer'"
            className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-500/5 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/15 px-2.5 py-1 rounded-xl transition-all disabled:opacity-50"
          >
            Reset PW
          </button>
          <button
            onClick={handleDeleteUser}
            disabled={loading}
            title="Delete user completely"
            className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 bg-red-500/5 border border-red-500/10 px-2.5 py-1 rounded-xl transition-all disabled:opacity-50"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
