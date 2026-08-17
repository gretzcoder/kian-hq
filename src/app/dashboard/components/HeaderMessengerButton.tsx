'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFloatingMessenger } from '@/modules/direct-messages/components/FloatingMessengerContext';
import { getRecentConversationsAction, ConversationItem } from '@/modules/direct-messages/dmActions';
import UserAvatar from '@/components/ui/UserAvatar';

export default function HeaderMessengerButton() {
  const router = useRouter();
  const { openChat, unreadCount } = useFloatingMessenger();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PERSONAL' | 'WORKSPACE' | 'COMMUNITY' | 'REQUESTS' | 'UNREAD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await getRecentConversationsAction(filter);
      if (res.success && res.conversations) {
        setConversations(res.conversations);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen, filter]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredList = conversations.filter((c) =>
    c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partnerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConversationClick = (c: ConversationItem) => {
    setIsOpen(false);
    if (c.targetUrl) {
      router.push(c.targetUrl);
    } else {
      openChat(c.partnerId, c.partnerName, c.partnerAvatar);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Navbar Messenger Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-all relative cursor-pointer active:scale-95 shadow-xs"
        title="Pusat Messenger & Chat (Personal, Workspace, Community)"
      >
        <span className="text-base">💬</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-zinc-900 shadow-md animate-pulse font-mono">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Facebook Messenger Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-[340px] sm:w-[400px] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>💬 Chats & Messenger Hub</span>
              </h3>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                Personal • WS • Comm
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Cari pesan / kontak / room..."
                className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none font-bold text-xs">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'PERSONAL', label: '💬 Personal' },
                  { id: 'WORKSPACE', label: '⚡ Workspace' },
                  { id: 'COMMUNITY', label: '🌐 Community' },
                  { id: 'REQUESTS', label: '📩 Requests' },
                  { id: 'UNREAD', label: 'Belum Dibaca' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1 rounded-xl text-[11px] transition-all shrink-0 cursor-pointer ${
                    filter === tab.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Stream List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 scrollbar-thin">
            {loading ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-bold animate-pulse">
                Memuat percakapan...
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-10 text-center space-y-2 text-zinc-400 p-4">
                <span className="text-3xl opacity-50">💬</span>
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Belum Ada Chat Ditemukan</p>
                <p className="text-[10px] text-zinc-400">
                  Semua notifikasi chat (Personal, Workspace, Community) kini berada di Messenger Hub ini.
                </p>
              </div>
            ) : (
              filteredList.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleConversationClick(c)}
                  className={`p-3 flex items-center justify-between gap-3 hover:bg-purple-500/5 dark:hover:bg-purple-950/20 cursor-pointer transition-colors group ${
                    c.unreadCount > 0 ? 'bg-purple-500/10 dark:bg-purple-900/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      src={c.partnerAvatar}
                      name={c.partnerName}
                      size="md"
                      square
                      className="rounded-2xl shrink-0 ring-2 ring-purple-500/20 group-hover:scale-105 transition-transform"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {c.partnerName}
                        </h4>
                        {c.isRequest && (
                          <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-1.5 py-0.2 rounded uppercase">
                            Request
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${c.unreadCount > 0 ? 'font-bold text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
                        {c.lastMessage}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[9px] font-mono text-zinc-400">
                      {new Date(c.lastMessageTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse inline-block" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
