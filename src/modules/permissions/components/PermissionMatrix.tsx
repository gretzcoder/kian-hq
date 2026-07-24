'use client';

import { useTransition } from 'react';
import { grantRolePermission, revokeRolePermission } from '@/modules/permissions/actions';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

interface PermissionMatrixProps {
  roles: Role[];
  permissions: Permission[];
  grantedMap: Record<string, string[]>; // roleId → [permissionId, ...]
}

const ROLE_COLORS: Record<string, string> = {
  EXECUTIVE:    'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  COORDINATOR:  'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  CREATOR:      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  COLLABORATOR: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
};

// Risk levels for all permissions (updated for v2)
const PERMISSION_RISK: Record<string, 'low' | 'medium' | 'high'> = {
  // Content
  READ: 'low', COMMENT: 'low', DOWNLOAD: 'low',
  // Brief
  CREATE_BRIEF: 'low', UPDATE_BRIEF: 'low',
  SUBMIT_BRIEF: 'low', APPROVE_BRIEF: 'high',
  REQUEST_CHANGES: 'medium', UNLOCK_BRIEF: 'high',
  // Project
  CREATE_PROJECT: 'medium', UPDATE: 'medium', DELETE: 'high',
  PUBLISH_PROJECT: 'high', ARCHIVE_PROJECT: 'high',
  // Workspace
  CREATE_WORKSPACE: 'medium', UPDATE_WORKSPACE: 'medium',
  // Task
  CREATE_TASK: 'medium', ASSIGN_TASK: 'medium',
  UPLOAD: 'medium', APPROVE: 'high', REQUEST_REVISION: 'medium',
  // System
  MANAGE: 'high', EXPORT: 'high', SHARE: 'medium',
  CREATE_ANNOUNCEMENT: 'medium', USE_AI: 'medium',
};

// Permission categories for grouping
const PERMISSION_CATEGORIES: { label: string; icon: string; permissions: string[] }[] = [
  {
    label: 'Content & Reading',
    icon: '📄',
    permissions: ['READ', 'COMMENT', 'DOWNLOAD'],
  },
  {
    label: 'Content Brief',
    icon: '📝',
    permissions: ['CREATE_BRIEF', 'UPDATE_BRIEF', 'SUBMIT_BRIEF', 'APPROVE_BRIEF', 'REQUEST_CHANGES', 'UNLOCK_BRIEF'],
  },
  {
    label: 'Project',
    icon: '📁',
    permissions: ['CREATE_PROJECT', 'UPDATE', 'DELETE', 'PUBLISH_PROJECT', 'ARCHIVE_PROJECT'],
  },
  {
    label: 'Workspace',
    icon: '🏠',
    permissions: ['CREATE_WORKSPACE', 'UPDATE_WORKSPACE'],
  },
  {
    label: 'Task',
    icon: '✅',
    permissions: ['CREATE_TASK', 'ASSIGN_TASK', 'UPLOAD', 'APPROVE', 'REQUEST_REVISION'],
  },
  {
    label: 'System',
    icon: '⚙️',
    permissions: ['MANAGE', 'EXPORT', 'SHARE', 'CREATE_ANNOUNCEMENT', 'USE_AI'],
  },
];

export default function PermissionMatrix({ roles, permissions, grantedMap }: PermissionMatrixProps) {
  const [pending, startTransition] = useTransition();

  // Build a map: permName → Permission object
  const permByName: Record<string, Permission> = {};
  for (const p of permissions) {
    permByName[p.name] = p;
  }

  function toggle(roleId: string, permId: string, isGranted: boolean) {
    startTransition(async () => {
      if (isGranted) {
        await revokeRolePermission(roleId, permId);
      } else {
        await grantRolePermission(roleId, permId);
      }
    });
  }

  const riskStyle: Record<'low' | 'medium' | 'high', string> = {
    low:    'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
    medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    high:   'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  return (
    <div className={`transition-opacity duration-200 ${pending ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
      {pending && (
        <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 font-bold mb-4">
          <span className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          Applying changes & invalidating permission cache...
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Header: Role columns */}
          <thead>
            <tr>
              <th className="text-left pb-4 pr-6 w-56">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                  Permission
                </span>
              </th>
              {roles.map((role) => (
                <th key={role.id} className="pb-4 px-4 text-center min-w-[110px]">
                  <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${ROLE_COLORS[role.name] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>
                    {role.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PERMISSION_CATEGORIES.map((category) => {
              // Find permissions in this category that exist in DB
              const catPerms = category.permissions
                .map((name) => permByName[name])
                .filter(Boolean);

              if (catPerms.length === 0) return null;

              return (
                <>
                  {/* Category separator row */}
                  <tr key={`cat-${category.label}`}>
                    <td colSpan={roles.length + 1} className="pt-6 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{category.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          {category.label}
                        </span>
                        <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-900" />
                      </div>
                    </td>
                  </tr>

                  {catPerms.map((perm) => {
                    const risk = PERMISSION_RISK[perm.name] ?? 'low';
                    return (
                      <tr
                        key={perm.id}
                        className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors"
                      >
                        {/* Permission label */}
                        <td className="py-3 pr-6">
                          <div className="flex items-center gap-2.5">
                            <div>
                              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{perm.name}</p>
                              {perm.description && (
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug max-w-[180px]">
                                  {perm.description}
                                </p>
                              )}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${riskStyle[risk]}`}>
                              {risk}
                            </span>
                          </div>
                        </td>

                        {/* Toggle cells */}
                        {roles.map((role) => {
                          const isGranted = (grantedMap[role.id] ?? []).includes(perm.id);
                          return (
                            <td key={role.id} className="py-3 px-4 text-center">
                              <button
                                onClick={() => toggle(role.id, perm.id, isGranted)}
                                disabled={pending}
                                title={isGranted ? `Revoke ${perm.name} from ${role.name}` : `Grant ${perm.name} to ${role.name}`}
                                className={`w-9 h-9 rounded-xl transition-all duration-200 flex items-center justify-center mx-auto text-base font-black border active:scale-90 ${
                                  isGranted
                                    ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 dark:hover:text-red-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600 hover:bg-purple-500/5 hover:border-purple-500/20 hover:text-purple-500 dark:hover:text-purple-400'
                                }`}
                              >
                                {isGranted ? '✓' : '·'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              );
            })}

            {/* Uncategorized permissions (fallback) */}
            {(() => {
              const categorizedNames = new Set(
                PERMISSION_CATEGORIES.flatMap((c) => c.permissions),
              );
              const uncategorized = permissions.filter((p) => !categorizedNames.has(p.name));
              if (uncategorized.length === 0) return null;

              return (
                <>
                  <tr>
                    <td colSpan={roles.length + 1} className="pt-6 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔹</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Other</span>
                        <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-900" />
                      </div>
                    </td>
                  </tr>
                  {uncategorized.map((perm) => {
                    const risk = PERMISSION_RISK[perm.name] ?? 'low';
                    return (
                      <tr key={perm.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                        <td className="py-3 pr-6">
                          <div className="flex items-center gap-2.5">
                            <div>
                              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{perm.name}</p>
                              {perm.description && (
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-[180px]">{perm.description}</p>
                              )}
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${riskStyle[risk]}`}>{risk}</span>
                          </div>
                        </td>
                        {roles.map((role) => {
                          const isGranted = (grantedMap[role.id] ?? []).includes(perm.id);
                          return (
                            <td key={role.id} className="py-3 px-4 text-center">
                              <button
                                onClick={() => toggle(role.id, perm.id, isGranted)}
                                disabled={pending}
                                className={`w-9 h-9 rounded-xl transition-all duration-200 flex items-center justify-center mx-auto font-black border active:scale-90 ${
                                  isGranted
                                    ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 dark:hover:text-red-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600 hover:bg-purple-500/5 hover:border-purple-500/20 hover:text-purple-500 dark:hover:text-purple-400'
                                }`}
                              >
                                {isGranted ? '✓' : '·'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-900 flex flex-wrap items-center gap-6 text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-500 font-black text-xs">✓</div>
          Granted
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-300 dark:text-zinc-600 font-black">·</div>
          Not granted
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black uppercase">HIGH</span>
          High-impact — assign with caution
        </div>
        <div className="ml-auto text-zinc-400 dark:text-zinc-500 normal-case font-medium">
          Changes apply immediately. KV cache auto-invalidated per role.
        </div>
      </div>
    </div>
  );
}
