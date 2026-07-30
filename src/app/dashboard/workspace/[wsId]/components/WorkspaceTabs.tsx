'use client';

import React, { useState } from 'react';

interface WorkspaceTabsProps {
  tasksCount: number;
  membersCount: number;
  chatMessagesCount: number;
  tasksTab: React.ReactNode;
  membersTab: React.ReactNode;
  chatTab: React.ReactNode;
  createTaskForm?: React.ReactNode;
}

export default function WorkspaceTabs({
  tasksCount,
  membersCount,
  chatMessagesCount,
  tasksTab,
  membersTab,
  chatTab,
  createTaskForm,
}: WorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'members' | 'create'>('tasks');

  return (
    <div className="space-y-6">
      {/* Clean Tab Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'tasks'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <span>📋 Daftar Tugas</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'tasks'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {tasksCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'chat'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <span>💬 Room Chat</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'chat'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {chatMessagesCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'members'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <span>👥 Anggota Tim</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'members'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {membersCount}
            </span>
          </button>
        </div>

        {createTaskForm && (
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
              activeTab === 'create'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent shadow-md'
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span>+ Buat Tugas</span>
          </button>
        )}
      </div>

      {/* Tab Content Panels */}
      <div className="transition-all duration-200">
        {activeTab === 'tasks' && <div className="animate-in fade-in duration-200">{tasksTab}</div>}

        {activeTab === 'chat' && <div className="animate-in fade-in duration-200">{chatTab}</div>}

        {activeTab === 'members' && (
          <div className="animate-in fade-in duration-200">{membersTab}</div>
        )}

        {activeTab === 'create' && createTaskForm && (
          <div className="animate-in fade-in duration-200 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-1 text-zinc-900 dark:text-zinc-100">
              Buat Tugas Baru
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-5">
              Isi rincian tugas untuk dikerjakan tim di workspace ini.
            </p>
            {createTaskForm}
          </div>
        )}
      </div>
    </div>
  );
}
