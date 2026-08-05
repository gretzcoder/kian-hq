'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setViewAsRole, clearViewAsRole } from '../viewAsRoleActions';

interface ViewAsRoleCardButtonProps {
  roleId: string;
  roleName: string;
  isActive?: boolean;
}

export default function ViewAsRoleCardButton({
  roleId,
  roleName,
  isActive = false,
}: ViewAsRoleCardButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggleViewAs = () => {
    startTransition(async () => {
      if (isActive) {
        await clearViewAsRole();
      } else {
        await setViewAsRole(roleId);
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleToggleViewAs}
      title={isActive ? `Exit preview for ${roleName}` : `View server as ${roleName}`}
      className={`w-full mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm active:scale-95 border disabled:opacity-50 ${
        isActive
          ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 animate-pulse'
          : 'bg-zinc-100 hover:bg-amber-500/10 dark:bg-zinc-900 dark:hover:bg-amber-500/20 text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-500/30'
      }`}
    >
      <span>👁️</span>
      <span>{isActive ? 'Active Preview (Exit)' : `View as ${roleName}`}</span>
    </button>
  );
}
