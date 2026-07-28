'use client';

import { useState, useTransition } from 'react';
import { deleteWorkspace } from '@/modules/workspaces/actions';
import { useRouter } from 'next/navigation';

interface DeleteWorkspaceButtonProps {
  workspaceId: string;
  workspaceName: string;
}

export default function DeleteWorkspaceButton({ workspaceId, workspaceName }: DeleteWorkspaceButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteWorkspace(workspaceId);
      if (result.success) {
        setShowConfirm(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  if (showConfirm) {
    return (
      <div
        className="absolute inset-0 z-10 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 p-4"
        onClick={(e) => e.preventDefault()}
      >
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-center leading-relaxed">
          Hapus <span className="text-red-500">"{workspaceName}"</span>?<br />
          <span className="text-zinc-400 font-normal text-[10px]">Workspace akan disembunyikan (soft delete).</span>
        </p>
        {error && (
          <p className="text-[10px] text-red-500 font-bold text-center">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { setShowConfirm(false); setError(null); }}
            disabled={isPending}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-60 active:scale-[0.97]"
          >
            {isPending ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowConfirm(true);
      }}
      title="Hapus workspace"
      className="shrink-0 text-[10px] font-black text-red-400 hover:text-red-500 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 px-2 py-1 rounded-lg transition-all active:scale-[0.97]"
    >
      ✕
    </button>
  );
}
