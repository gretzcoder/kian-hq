'use client';

import { useState } from 'react';
import { updateWorkspaceStatus } from '@/modules/workspaces/actions';

export default function WorkspaceStatusForm({
  workspaceId,
  currentStatus,
}: {
  workspaceId: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (newStatus: 'COMPLETED' | 'ARCHIVED') => {
    if (!confirm(`Mark workspace as ${newStatus}?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateWorkspaceStatus(workspaceId, newStatus);
      if (!res.success) setError(res.error ?? 'Failed');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => handleUpdate('COMPLETED')}
          disabled={loading}
          className="text-xs font-bold border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
        >
          {loading ? '...' : '✓ Mark Complete'}
        </button>
        <button
          onClick={() => handleUpdate('ARCHIVED')}
          disabled={loading}
          className="text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-4 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
