'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setViewAsRole, clearViewAsRole, ViewAsRoleItem, ActiveSimulatedRole } from '../viewAsRoleActions';
import { startImpersonatingUser, stopImpersonatingUser, ImpersonateUserItem } from '@/modules/users/impersonationActions';

interface ViewAsRoleTriggerProps {
  availableRoles: ViewAsRoleItem[];
  availableUsers?: ImpersonateUserItem[];
  activeSimulatedRole?: ActiveSimulatedRole | null;
  isImpersonating?: boolean;
  impersonatedName?: string;
  collapsed?: boolean;
}

export default function ViewAsRoleTrigger({
  availableRoles,
  availableUsers = [],
  activeSimulatedRole = null,
  isImpersonating = false,
  impersonatedName,
  collapsed = false,
}: ViewAsRoleTriggerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ROLE' | 'USER'>('ROLE');
  const [isPending, startTransition] = useTransition();

  if (!availableRoles || availableRoles.length === 0) return null;

  const handleSelectRole = (roleId: string) => {
    setIsOpen(false);
    startTransition(async () => {
      if (roleId === 'EXIT') {
        await clearViewAsRole();
      } else {
        await setViewAsRole(roleId);
      }
      router.refresh();
    });
  };

  const handleSelectUser = (userId: string) => {
    setIsOpen(false);
    startTransition(async () => {
      await startImpersonatingUser(userId);
      router.refresh();
    });
  };

  const handleExitAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    startTransition(async () => {
      if (isImpersonating) {
        await stopImpersonatingUser();
      }
      if (activeSimulatedRole) {
        await clearViewAsRole();
      }
      router.refresh();
    });
  };

  const isSimulating = !!activeSimulatedRole || isImpersonating;

  return (
    <div className="relative w-full px-2 py-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsOpen(!isOpen)}
        title={
          isImpersonating
            ? `Impersonating: ${impersonatedName}`
            : activeSimulatedRole
            ? `Viewing as Role: ${activeSimulatedRole.roleName}`
            : 'View Server as Role / User'
        }
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 shadow-sm active:scale-[0.98] ${
          isImpersonating
            ? 'border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300'
            : isSimulating
            ? 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400'
            : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300'
        } ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-sm shrink-0">
            {isImpersonating ? '🎭' : activeSimulatedRole ? '🚫' : '👁️'}
          </span>
          {!collapsed && (
            <span className="truncate">
              {isImpersonating
                ? `Account: ${impersonatedName}`
                : activeSimulatedRole
                ? `Role: ${activeSimulatedRole.roleName}`
                : 'View / Impersonate...'}
            </span>
          )}
        </div>
        {!collapsed && (
          <span className={`text-[10px] shrink-0 transition-transform ${isImpersonating ? 'text-purple-500' : 'text-amber-500'} ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-2 bottom-12 z-50 min-w-[240px] w-64 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150 space-y-2">
            {/* Header Tabs: Role vs User */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('ROLE')}
                className={`flex-1 py-1 px-2 rounded-lg transition-all ${
                  activeTab === 'ROLE'
                    ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                👁️ Role View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('USER')}
                className={`flex-1 py-1 px-2 rounded-lg transition-all ${
                  activeTab === 'USER'
                    ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                🎭 Impersonate
              </button>
            </div>

            {/* Exit Active Simulation Option */}
            {isSimulating && (
              <div className="pb-1 border-b border-zinc-100 dark:border-zinc-900">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleExitAll}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors flex items-center gap-2"
                >
                  <span>✕</span>
                  <span>Exit {isImpersonating ? 'Impersonation' : 'View as Role'}</span>
                </button>
              </div>
            )}

            {/* Tab Content 1: Roles */}
            {activeTab === 'ROLE' && (
              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {availableRoles.map((role) => {
                  const isSelected = activeSimulatedRole?.roleId === role.id;
                  return (
                    <button
                      key={role.id}
                      disabled={isPending}
                      onClick={() => handleSelectRole(role.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between group ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold'
                          : 'text-zinc-800 dark:text-zinc-200 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      <div>
                        <p className="font-bold">
                          {role.name} {isSelected && '✓'}
                        </p>
                        {role.description && (
                          <p className="text-[10px] text-zinc-400 font-medium truncate max-w-[190px]">
                            {role.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab Content 2: Users */}
            {activeTab === 'USER' && (
              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {availableUsers.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic p-2">Tidak ada user tersedia.</p>
                ) : (
                  availableUsers.map((u) => (
                    <button
                      key={u.id}
                      disabled={isPending}
                      onClick={() => handleSelectUser(u.id)}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex flex-col"
                    >
                      <span className="font-bold truncate">{u.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono truncate">{u.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
