'use client';

import React, { useState } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import { ConversationItem } from '@/modules/direct-messages/dmActions';

export interface ConversationListProps {
  conversations: ConversationItem[];
  activeId?: string | null;
  onSelect: (conv: ConversationItem) => void;
  onDeletePOV?: (conv: ConversationItem) => void;
  loading?: boolean;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDeletePOV,
  loading = false,
}: ConversationListProps) {
  const [filter, setFilter] = useState<'ALL' | 'PERSONAL' | 'WORKSPACE' | 'COMMUNITY' | 'REQUESTS' | 'UNREAD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = conversations.filter((c) => {
    // Filter Category
    if (filter === 'PERSONAL' && c.category !== 'PERSONAL') return false;
    if (filter === 'WORKSPACE' && c.category !== 'WORKSPACE') return false;
    if (filter === 'COMMUNITY' && c.category !== 'COMMUNITY') return false;
    if (filter === 'REQUESTS' && c.category !== 'REQUESTS' && !c.isRequest) return false;
    if (filter === 'UNREAD' && c.unreadCount <= 0) return false;

    // Filter Search Text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.partnerName.toLowerCase().includes(q) ||
        c.partnerEmail.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#09090b] border-r border-zinc-200/90 dark:border-zinc-800/90 overflow-hidden select-none">
      {/* Header & Search Bar */}
      <div className="p-3 sm:p-4 border-b border-zinc-200/90 dark:border-zinc-800/90 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
            <span>💬 Inbox & Chat</span>
          </h2>
          <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
            {conversations.length} Chat
          </span>
        </div>

        {/* Search Box */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Cari percakapan, nama..."
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none font-bold text-xs pb-0.5">
          {(
            [
              { id: 'ALL', label: 'Semua' },
              { id: 'PERSONAL', label: '💬 Personal' },
              { id: 'WORKSPACE', label: '⚡ Workspace' },
              { id: 'COMMUNITY', label: '🌐 Community' },
              { id: 'REQUESTS', label: '📩 Requests' },
              { id: 'UNREAD', label: 'Belum Dibaca' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1 rounded-xl text-[11px] transition-all shrink-0 cursor-pointer ${
                filter === t.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50 scrollbar-thin">
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-400 font-bold animate-pulse">
            Memuat daftar percakapan...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2 text-zinc-400">
            <span className="text-3xl opacity-50">💬</span>
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Tidak Ada Chat Ditemukan</p>
            <p className="text-[10px] max-w-[200px] mx-auto text-zinc-400">
              Pesan personal, workspace chat, dan community channel akan muncul di sini.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = activeId === item.partnerId || activeId === item.id;

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all group ${
                  isSelected
                    ? 'bg-purple-500/15 dark:bg-purple-950/40 border-l-4 border-purple-600'
                    : item.unreadCount > 0
                    ? 'bg-purple-500/5 dark:bg-purple-900/10 hover:bg-purple-500/10'
                    : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    src={item.partnerAvatar}
                    name={item.partnerName}
                    size="md"
                    square
                    className="rounded-2xl shrink-0 ring-2 ring-purple-500/20 group-hover:scale-105 transition-transform"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {item.partnerName}
                      </h4>
                      <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                        {new Date(item.lastMessageTime).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p
                      className={`text-[11px] truncate mt-0.5 ${
                        item.unreadCount > 0
                          ? 'font-black text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400'
                      }`}
                    >
                      {item.lastMessage}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {item.unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white font-mono text-[9px] font-black animate-pulse">
                      {item.unreadCount > 9 ? '9+' : item.unreadCount}
                    </span>
                  )}

                  {onDeletePOV && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePOV(item);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 text-xs p-1 rounded-lg transition-opacity"
                      title="Hapus untuk saya"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
