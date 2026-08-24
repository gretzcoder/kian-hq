'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UserAvatar from '@/components/ui/UserAvatar';
import { useUI } from '@/components/ui/UIProvider';
import { parseRichMessageContent } from '@/lib/menuTagging';
import { MenuHashtagAutocompletePopover } from '@/components/MenuHashtagAutocompletePopover';
import {
  CommunityMessage,
  ThreadDetails,
  getThreadDetails,
  sendThreadReply,
  togglePinThreadAnswer,
} from '../communityActions';

interface ThreadSidePanelProps {
  threadRootId: string | null;
  onClose: () => void;
  currentUserId: string;
  canManageCommunity?: boolean;
  onSelectMember?: (member: any) => void;
}

export function ThreadSidePanel({
  threadRootId,
  onClose,
  currentUserId,
  canManageCommunity = false,
  onSelectMember,
}: ThreadSidePanelProps) {
  const { toast } = useUI();
  const [details, setDetails] = useState<ThreadDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const repliesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 38), 160);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [inputMessage]);

  const fetchDetails = async () => {
    if (!threadRootId) return;
    try {
      const res = await getThreadDetails(threadRootId);
      setDetails(res);
    } catch (err) {
      console.error('Failed to fetch thread details:', err);
    }
  };

  useEffect(() => {
    if (threadRootId) {
      setLoading(true);
      fetchDetails().finally(() => setLoading(false));

      // Polling for realtime thread replies (3 sec)
      const interval = setInterval(fetchDetails, 3000);
      return () => clearInterval(interval);
    } else {
      setDetails(null);
    }
  }, [threadRootId]);

  useEffect(() => {
    if (repliesContainerRef.current) {
      repliesContainerRef.current.scrollTop = repliesContainerRef.current.scrollHeight;
    }
  }, [details?.replies.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadRootId || !inputMessage.trim() || sending) return;

    const textToSend = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      const res = await sendThreadReply(threadRootId, textToSend);
      if (res.success) {
        await fetchDetails();
      } else {
        toast(res.error || 'Gagal mengirim balasan thread', 'error');
        setInputMessage(textToSend);
      }
    } catch (err) {
      toast('Terjadi kesalahan saat membalas thread', 'error');
      setInputMessage(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleTogglePinAnswer = async (answerId: string) => {
    if (!threadRootId) return;
    try {
      const res = await togglePinThreadAnswer(threadRootId, answerId);
      if (res.success) {
        toast(res.isPinned ? 'Jawaban resmi berhasil disematkan (Pin)! 📌' : 'Sematan jawaban dilepas', 'success');
        await fetchDetails();
      } else {
        toast(res.error || 'Gagal menyematkan jawaban', 'error');
      }
    } catch (err) {
      toast('Gagal memproses pin jawaban', 'error');
    }
  };

  if (!threadRootId) return null;

  const root = details?.rootMessage;
  const pinnedAnswer = details?.pinnedAnswer;
  const threadName = root?.thread_name || (root?.message ? (root.message.length > 35 ? root.message.substring(0, 35) + '...' : root.message) : 'Thread');

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed lg:relative inset-y-0 right-0 z-40 w-full sm:w-[420px] lg:w-[380px] xl:w-[420px] bg-white dark:bg-[#09090b] border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl lg:shadow-none h-full"
    >
      {/* ── Thread Top Header ── */}
      <div className="p-3.5 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            🧵
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate uppercase tracking-wider">
              {threadName}
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold truncate">
              Diskusi Thread & Jawaban Resmi
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Tutup Panel Thread"
        >
          ✕
        </button>
      </div>

      {/* ── Thread Main Scroll Area ── */}
      <div ref={repliesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && !details ? (
          <div className="p-8 text-center space-y-2 text-zinc-400">
            <span className="text-2xl animate-spin inline-block">⏳</span>
            <p className="text-xs font-bold">Memuat percakapan thread...</p>
          </div>
        ) : (
          <>
            {/* ── Root Message Overview Block ── */}
            {root && (
              <div className="bg-zinc-50 dark:bg-zinc-900/70 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2.5">
                  <UserAvatar src={root.user_avatar} name={root.user_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                        {root.user_name}
                      </span>
                      {root.user_role_name && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          {root.user_role_name}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-400 font-mono">Pertanyaan / Topik Awal</span>
                  </div>
                </div>

                <div className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium pt-1">
                  {parseRichMessageContent(root.message, { onSelectMember })}
                </div>

                {root.attachment_url && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <img src={root.attachment_url} alt="Lampiran" className="w-full max-h-48 object-cover" />
                  </div>
                )}
              </div>
            )}

            {/* ── Pinned Official Answer Banner (PINNED ANSWER) ── */}
            {pinnedAnswer && (
              <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/40 dark:border-amber-500/50 p-3.5 rounded-2xl space-y-2 shadow-lg shadow-amber-500/5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📌</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Jawaban Resmi Tersemat (Pinned Answer)
                    </span>
                  </div>
                  {canManageCommunity && (
                    <button
                      type="button"
                      onClick={() => handleTogglePinAnswer(pinnedAnswer.id)}
                      className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:text-red-500 underline"
                    >
                      Lepas Pin
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <UserAvatar src={pinnedAnswer.user_avatar} name={pinnedAnswer.user_name} size="xs" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {pinnedAnswer.user_name}
                  </span>
                  {pinnedAnswer.user_role_name && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      {pinnedAnswer.user_role_name}
                    </span>
                  )}
                </div>

                <div className="text-xs text-zinc-900 dark:text-zinc-100 font-semibold leading-relaxed bg-white/60 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-amber-500/20">
                  {parseRichMessageContent(pinnedAnswer.message, { onSelectMember })}
                </div>
              </div>
            )}

            {/* ── Thread Replies Divider & Count ── */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800" />
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                {details?.replies.length || 0} Balasan
              </span>
              <div className="h-px flex-1 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800" />
            </div>

            {/* ── Replies Feed List ── */}
            {details?.replies.map((reply) => {
              const isMe = reply.user_id === currentUserId;
              const isPinned = reply.id === pinnedAnswer?.id;

              return (
                <div
                  key={reply.id}
                  className={`group relative p-3 rounded-2xl border transition-all ${
                    isPinned
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : isMe
                      ? 'bg-purple-500/10 border-purple-500/20'
                      : 'bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200/70 dark:border-zinc-800/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar src={reply.user_avatar} name={reply.user_name} size="xs" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {isMe ? 'Anda' : reply.user_name}
                      </span>
                      {reply.user_role_name && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {reply.user_role_name}
                        </span>
                      )}
                    </div>

                    {/* Action buttons (Pin Answer) */}
                    {canManageCommunity && (
                      <button
                        type="button"
                        onClick={() => handleTogglePinAnswer(reply.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          isPinned
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-amber-500/20 hover:text-amber-600'
                        }`}
                        title={isPinned ? 'Lepas Pin Jawaban' : 'Pin Jawaban Resmi ini'}
                      >
                        📌 {isPinned ? 'Jawaban Tersemat' : 'Pin Jawaban'}
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                    {parseRichMessageContent(reply.message, { onSelectMember })}
                  </div>

                  {reply.attachment_url && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 max-w-xs">
                      <img src={reply.attachment_url} alt="Lampiran" className="w-full max-h-44 object-cover" />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Thread Reply Input Box ── */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] flex items-end gap-2 shrink-0 relative"
      >
        <MenuHashtagAutocompletePopover
          inputText={inputMessage}
          onSelectTag={(formattedTag) => {
            setInputMessage((prev) => prev.replace(/#([a-zA-Z0-9_\-\s>]*)$/, formattedTag + ' '));
            if (textareaRef.current) textareaRef.current.focus();
          }}
        />
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder={`Balas di "${threadName}" (ketik # untuk tag menu)...`}
          className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500/50 resize-none min-h-[38px] max-h-[160px] leading-relaxed overflow-y-auto scrollbar-thin"
        />
        <div className="shrink-0 pb-0.5">
          <button
            type="submit"
            disabled={sending || !inputMessage.trim()}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold shadow-md disabled:opacity-50 transition-all cursor-pointer"
          >
            {sending ? '...' : 'Balas ➔'}
          </button>
        </div>
      </form>
    </motion.aside>
  );
}
