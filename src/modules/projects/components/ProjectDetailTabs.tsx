'use client';

import React, { useState } from 'react';

interface ProjectDetailTabsProps {
  workspacesTab: React.ReactNode;
  briefTab: React.ReactNode;
  timelineTab: React.ReactNode;
  createWorkspaceForm?: React.ReactNode;
  workspacesCount: number;
  hasBrief: boolean;
  eventsCount: number;
}

export default function ProjectDetailTabs({
  workspacesTab,
  briefTab,
  timelineTab,
  createWorkspaceForm,
  workspacesCount,
  hasBrief,
  eventsCount,
}: ProjectDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<'workspaces' | 'brief' | 'timeline' | 'create'>('workspaces');

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'workspaces'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <span>🏠 Workspaces</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'workspaces'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {workspacesCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('brief')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'brief'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <span>📄 Content Brief</span>
            {hasBrief && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <span>📜 Activity Timeline</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'timeline'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {eventsCount}
            </span>
          </button>
        </div>

        {createWorkspaceForm && (
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
              activeTab === 'create'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent shadow-md'
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span>+ Buat Workspace</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="transition-all duration-200">
        {activeTab === 'workspaces' && <div className="animate-in fade-in duration-200">{workspacesTab}</div>}

        {activeTab === 'brief' && <div className="animate-in fade-in duration-200">{briefTab}</div>}

        {activeTab === 'timeline' && <div className="animate-in fade-in duration-200">{timelineTab}</div>}

        {activeTab === 'create' && createWorkspaceForm && (
          <div className="max-w-xl animate-in fade-in duration-200 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-1 text-zinc-900 dark:text-zinc-100">
              Buat Workspace Baru
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-4">
              Tambahkan unit kampanye baru (misal: Instagram, Podcast, TikTok).
            </p>
            {createWorkspaceForm}
          </div>
        )}
      </div>
    </div>
  );
}
