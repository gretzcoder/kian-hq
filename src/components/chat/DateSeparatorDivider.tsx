'use client';

import React from 'react';

interface DateSeparatorDividerProps {
  label: string;
  isUnreadDivider?: boolean;
}

export function DateSeparatorDivider({ label, isUnreadDivider = false }: DateSeparatorDividerProps) {
  if (isUnreadDivider) {
    return (
      <div className="my-4 flex items-center gap-3 select-none">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-950/60 border border-purple-500/30 px-3 py-0.5 rounded-full shadow-xs">
          {label}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      </div>
    );
  }

  return (
    <div className="my-4 flex items-center justify-center select-none">
      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800/80 border border-zinc-300/40 dark:border-zinc-700/50 px-3 py-0.5 rounded-full shadow-2xs backdrop-blur-md">
        {label}
      </span>
    </div>
  );
}
