'use client';

import { useState } from 'react';
import SparksHistoryModal from '@/modules/leaderboard/components/SparksHistoryModal';

interface WorkspaceItem {
  rank: number;
  workspaceId: string;
  workspaceName: string;
  projectName: string;
  totalSparks: number;
  tasksCompleted: number;
  membersCount: number;
}

export function WorkspaceLeaderboardView({ data, period }: { data: WorkspaceItem[]; period?: 'month' | 'week' | 'all' }) {
  const [selectedWs, setSelectedWs] = useState<{ id: string; name: string } | null>(null);

  if (data.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
        <p className="text-4xl mb-3">🏢</p>
        <p className="text-zinc-500 text-sm font-medium">Belum ada data peringkat workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sparks History Modal */}
      <SparksHistoryModal
        userId={selectedWs?.id ?? null}
        userName={selectedWs ? `Workspace: ${selectedWs.name}` : null}
        category="workspace"
        period={period}
        isOpen={!!selectedWs}
        onClose={() => setSelectedWs(null)}
      />

      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>Peringkat Workspace Tim</span>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">💡 Klik poin Sparks ✨ untuk lihat riwayat tim</span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {data.map((ws) => (
            <div key={ws.workspaceId} className="p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
              <div className="flex items-center gap-4">
                <span className="w-8 text-center text-sm font-black font-mono text-zinc-400">
                  #{ws.rank}
                </span>
                <div>
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{ws.workspaceName}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Proyek: <span className="font-semibold">{ws.projectName}</span> • {ws.membersCount} Members
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setSelectedWs({ id: ws.workspaceId, name: ws.workspaceName })}
                  className="text-right group p-2 rounded-2xl hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all cursor-pointer"
                  title="Klik untuk melihat riwayat Sparks workspace ini"
                >
                  <div className="text-lg font-black text-purple-600 dark:text-purple-400 flex items-center justify-end gap-1 group-hover:scale-105 transition-transform">
                    <span>{ws.totalSparks}</span>
                    <span>✨</span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {ws.tasksCompleted} Tasks Completed 🔍
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
