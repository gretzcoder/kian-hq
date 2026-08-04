'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DeleteWorkspaceButton from '../../projects/[id]/components/DeleteWorkspaceButton';
import { isWorkspaceActivityUnread } from '@/modules/workspaces/workspaceReadState';

interface WorkspaceCardItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: number | null;
  project_id: string;
  ojt_coordinator_id: string | null;
  project_name: string;
  my_team_role: string | null;
  latest_activity_ts?: number | null;
}

interface WorkspaceListCardsProps {
  userWorkspaces: WorkspaceCardItem[];
  canGlobalDelete: boolean;
  mentoredProjectIds: string[];
  currentUserId: string;
}

export default function WorkspaceListCards({
  userWorkspaces,
  canGlobalDelete,
  mentoredProjectIds,
  currentUserId,
}: WorkspaceListCardsProps) {
  const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});
  const mentoredSet = new Set(mentoredProjectIds);

  useEffect(() => {
    const checkUnread = () => {
      const newMap: Record<string, boolean> = {};
      for (const ws of userWorkspaces) {
        newMap[ws.id] = isWorkspaceActivityUnread(ws.id, ws.latest_activity_ts);
      }
      setUnreadMap(newMap);
    };

    checkUnread();

    window.addEventListener('workspace_read', checkUnread);
    window.addEventListener('storage', checkUnread);
    return () => {
      window.removeEventListener('workspace_read', checkUnread);
      window.removeEventListener('storage', checkUnread);
    };
  }, [userWorkspaces]);

  if (userWorkspaces.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-12 text-center text-zinc-400 text-xs font-bold leading-normal">
        📋 Belum ada workspace yang dibuat.<br />
        Koordinator atau Admin dapat membuat workspace di halaman Projects.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {userWorkspaces.map((ws) => {
        const canDeleteWs = canGlobalDelete || ws.ojt_coordinator_id === currentUserId || mentoredSet.has(ws.project_id);
        const isUnread = unreadMap[ws.id] ?? false;

        return (
          <div
            key={ws.id}
            className={`relative border rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-md shadow-sm hover:-translate-y-0.5 group overflow-hidden ${
              isUnread
                ? 'bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-white dark:to-[#09090b]/40 border-purple-500/50 dark:border-purple-500/50 shadow-purple-500/10 ring-2 ring-purple-500/20'
                : 'border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block">
                    {ws.project_name}
                  </span>
                  {isUnread && (
                    <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse flex items-center gap-1">
                      <span>🔴</span> Ada Aktivitas Baru
                    </span>
                  )}
                </div>
                {canDeleteWs && (
                  <DeleteWorkspaceButton workspaceId={ws.id} workspaceName={ws.name} />
                )}
              </div>

              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {ws.name}
              </h3>
              {ws.description && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                  {ws.description}
                </p>
              )}
            </div>

            <div className="mt-8 pt-3 border-t border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/5 px-2.5 py-1 rounded-full border border-blue-500/10">
                {ws.status}
              </span>
              <Link
                href={`/dashboard/workspace/${ws.id}`}
                className={`text-xs border px-3.5 py-2 rounded-xl transition-all font-bold active:scale-[0.98] shadow-sm flex items-center gap-1.5 ${
                  isUnread
                    ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900/50'
                }`}
              >
                <span>Open Console</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
