'use client';

import { useState, useTransition } from 'react';
import { deleteKBCategory } from '@/modules/knowledge-base/actions';

export default function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-500 font-medium">Hapus &quot;{name}&quot;?</span>
        <button
          onClick={() => startTransition(async () => { await deleteKBCategory(id); setConfirm(false); })}
          disabled={isPending}
          className="text-[10px] font-bold text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
        >
          {isPending ? '...' : 'Ya'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-[10px] font-bold text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          Batal
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Hapus kategori"
      className="text-zinc-400 hover:text-red-400 transition-colors p-0.5 rounded"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
      </svg>
    </button>
  );
}
