'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UserAvatar from '@/components/ui/UserAvatar';
import { getChannelThreads, ThreadListItem } from '../communityActions';

interface ThreadListModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  onSelectThread: (threadId: string) => void;
  canCreateThread?: boolean;
  onOpenNewThreadModal?: () => void;
}

export function ThreadListModal({
  isOpen,
  onClose,
  channelId,
  channelName,
  onSelectThread,
  canCreateThread = false,
  onOpenNewThreadModal,
}: ThreadListModalProps) {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && channelId) {
      setLoading(true);
      getChannelThreads(channelId)
        .then((res) => setThreads(res))
        .finally(() => setLoading(false));
    }
  }, [isOpen, channelId]);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.thread_name.toLowerCase().includes(q) ||
        t.message_snippet.toLowerCase().includes(q) ||
        t.author_name.toLowerCase().includes(q)
    );
  }, [threads, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5">
              <span className="text-xl p-2 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                🧵
              </span>
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Daftar Thread Diskusi</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-300 font-mono">
                    #{channelName}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Semua topik Q&A dan diskusi terstruktur yang ada di saluran ini.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canCreateThread && onOpenNewThreadModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenNewThreadModal();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  + Thread Baru
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul thread, pertanyaan, atau nama pembuat..."
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {loading ? (
              <div className="p-8 text-center space-y-2 text-zinc-400">
                <span className="text-2xl animate-spin inline-block">⏳</span>
                <p className="text-xs font-bold">Memuat daftar thread...</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-zinc-400">
                <span className="text-4xl">🧵</span>
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {searchQuery ? 'Tidak ada thread yang sesuai pencarian.' : 'Belum ada thread diskusi di saluran ini.'}
                </p>
                <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                  {canCreateThread
                    ? 'Admin/Koordinator dapat membuat thread baru dengan menekan tombol + Thread Baru di atas.'
                    : 'Thread akan muncul di sini jika Admin atau Koordinator mempublikasikan topik diskusi baru.'}
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => {
                    onSelectThread(thread.id);
                    onClose();
                  }}
                  className="group p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 hover:border-purple-500/50 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-purple-500/5 transition-all cursor-pointer space-y-2 active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg p-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                        🧵
                      </span>
                      <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate">
                        {thread.thread_name}
                      </h4>
                    </div>

                    {thread.has_pinned_answer && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                        <span>📌</span>
                        <span>Jawaban Resmi</span>
                      </span>
                    )}
                  </div>

                  {thread.message_snippet && (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 font-medium">
                      "{thread.message_snippet}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200/40 dark:border-zinc-800/40 text-[10px] text-zinc-400 font-medium">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={thread.author_avatar} name={thread.author_name} size="xs" />
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">
                        {thread.author_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                        💬 {thread.reply_count} Balasan
                      </span>
                      <span className="group-hover:translate-x-0.5 font-bold transition-transform text-purple-600 dark:text-purple-400">
                        Buka Thread ➔
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-4 font-medium">
            <span>💡 Pilih thread untuk melihat diskusi & jawaban resmi yang sudah tersemat.</span>
            <span>{filteredThreads.length} Thread</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
