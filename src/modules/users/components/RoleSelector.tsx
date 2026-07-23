'use client';

import { useState } from 'react';
import { updateUserRole } from '../actions';

interface Role {
  id: string;
  name: string;
}

export default function RoleSelector({
  userId,
  currentRoleId,
  roles,
}: {
  userId: string;
  currentRoleId: string;
  roles: Role[];
}) {
  const [roleId, setRoleId] = useState(currentRoleId);
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRoleId = e.target.value;
    setLoading(true);

    try {
      const res = await updateUserRole(userId, newRoleId);
      if (res.success) {
        setRoleId(newRoleId);
      } else {
        alert(res.error || 'Failed to update user role');
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <select
        value={roleId}
        onChange={handleChange}
        disabled={loading}
        className="appearance-none bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-semibold rounded-full pl-4 pr-10 py-1.5 focus:outline-none cursor-pointer transition-all duration-200 disabled:opacity-50"
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
    </div>
  );
}
