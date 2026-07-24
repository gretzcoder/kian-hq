'use client';

import { useState } from 'react';
import { updateUserType } from '../actions';

export default function UserTypeSelector({
  userId,
  currentUserType,
}: {
  userId: string;
  currentUserType: 'STAFF' | 'OJT';
}) {
  const [loading, setLoading] = useState(false);
  const [val, setVal] = useState(currentUserType);

  const handleChange = async (newType: 'STAFF' | 'OJT') => {
    setLoading(true);
    try {
      const res = await updateUserType(userId, newType);
      if (res.success) {
        setVal(newType);
      } else {
        alert(res.error ?? 'Failed to update user type.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <select
      value={val}
      disabled={loading}
      onChange={(e) => handleChange(e.target.value as any)}
      className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 text-xs rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer text-zinc-700 dark:text-zinc-300 font-bold disabled:opacity-50"
    >
      <option value="STAFF">Staff Utama</option>
      <option value="OJT">On the Job Training</option>
    </select>
  );
}
