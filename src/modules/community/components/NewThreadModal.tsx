'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/components/ui/UIProvider';
import { createDirectThread, createThreadFromMessage, CommunityMessage } from '../communityActions';

interface NewThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  sourceMessage?: CommunityMessage | null;
  onThreadCreated: (threadRootId: string) => void;
}

export function NewThreadModal({
  isOpen,
  onClose,
  channelId,
  sourceMessage,
  onThreadCreated,
}: NewThreadModalProps) {
  const { toast } = useUI();
  const [threadName, setThreadName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (sourceMessage) {
        setThreadName(sourceMessage.thread_name || (sourceMessage.message.length > 35 ? sourceMessage.message.substring(0, 35) + '...' : sourceMessage.message));
        setInitialMessage(sourceMessage.message);
      } else {
        setThreadName('');
        setInitialMessage('');
      }
    }
  }, [isOpen, sourceMessage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadName.trim() || submitting) return;

    setSubmitting(true);
    try {
      if (sourceMessage) {
        // Convert existing message to thread root
        const res = await createThreadFromMessage(sourceMessage.id, threadName.trim());
        if (res.success && res.threadRootId) {
          toast('Thread berhasil dibuat!', 'success');
          onThreadCreated(res.threadRootId);
          onClose();
        } else {
          toast(res.error || 'Gagal membuat thread', 'error');
        }
      } else {
        // Create direct new thread
        if (!initialMessage.trim()) {
          toast('Pesan awal thread wajib diisi', 'error');
          setSubmitting(false);
          return;
        }

        const res = await createDirectThread(channelId, threadName.trim(), initialMessage.trim());
        if (res.success && res.threadRootId) {
          toast('Thread baru berhasil dipublikasikan!', 'success');
          onThreadCreated(res.threadRootId);
          onClose();
        } else {
          toast(res.error || 'Gagal membuat thread baru', 'error');
        }
      }
    } catch (err) {
      toast('Terjadi kesalahan saat membuat thread', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5">
              <span className="text-xl p-2 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                🧵
              </span>
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  {sourceMessage ? 'Jadikan Pesan Sebagai Thread' : 'Buat Thread Diskusi Baru'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Thread membantu mengelompokkan pertanyaan & solusi agar tidak ditanyakan ulang oleh Troopers.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Judul Thread (Topik / Q&A)
              </label>
              <input
                type="text"
                value={threadName}
                onChange={(e) => setThreadName(e.target.value)}
                placeholder="Contoh: Cara Login Canva KIAN / Panduan Format Video..."
                required
                className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {!sourceMessage && (
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Pesan / Pertanyaan Awal Thread
                </label>
                <textarea
                  rows={3}
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Tuliskan detail pertanyaan atau penjelasan topik di sini..."
                  required
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              </div>
            )}

            {sourceMessage && (
              <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
                <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">
                  Pesan Sumber:
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 italic line-clamp-2">
                  "{sourceMessage.message}"
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !threadName.trim()}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? 'Memproses...' : sourceMessage ? 'Buat Thread' : 'Publikasikan Thread'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
