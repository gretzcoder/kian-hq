'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setViewAsRole, clearViewAsRole, ViewAsRoleItem, ActiveSimulatedRole } from '../viewAsRoleActions';

interface ViewAsRoleBannerProps {
  activeSimulatedRole: ActiveSimulatedRole | null;
  availableRoles: ViewAsRoleItem[];
  isAuthorized: boolean;
}

export default function ViewAsRoleBanner({
  activeSimulatedRole,
  availableRoles,
  isAuthorized,
}: ViewAsRoleBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!isAuthorized || !activeSimulatedRole) return null;

  const handleRoleChange = (roleId: string) => {
    startTransition(async () => {
      if (roleId === 'EXIT') {
        await clearViewAsRole();
      } else {
        await setViewAsRole(roleId);
      }
      router.refresh();
    });
  };

  const handleExit = () => {
    startTransition(async () => {
      await clearViewAsRole();
      router.refresh();
    });
  };

  return (
    <div className="w-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/15 border-b border-amber-500/30 backdrop-blur-md px-4 py-2.5 sm:px-8 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-3 shadow-md transition-all animate-in fade-in duration-300">
      <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500 animate-pulse text-sm">
          👁️
        </div>
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            Viewing Server as:
          </span>{' '}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 ml-1">
            {activeSimulatedRole.roleName}
          </span>
          <span className="hidden sm:inline-block text-zinc-500 dark:text-zinc-400 ml-2 text-xs">
            (Permissions restricted to match role)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        {/* Role Switcher Selector */}
        <div className="relative">
          <select
            disabled={isPending}
            value={activeSimulatedRole.roleId}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="appearance-none bg-zinc-100 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 border border-amber-500/40 rounded-lg px-3 py-1.5 pr-8 text-xs font-semibold hover:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
          >
            {availableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                Switch to: {role.name} {role.userType === 'OJT' ? '(OJT)' : ''}
              </option>
            ))}
            <option value="EXIT">🚫 Exit View as Role</option>
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
            {isPending ? '⏳' : '🔄'}
          </div>
        </div>

        {/* Exit Button */}
        <button
          disabled={isPending}
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-50"
          title="Exit View As Role mode and return to admin view"
        >
          <span>✕</span>
          <span>Exit View as Role</span>
        </button>
      </div>
    </div>
  );
}
