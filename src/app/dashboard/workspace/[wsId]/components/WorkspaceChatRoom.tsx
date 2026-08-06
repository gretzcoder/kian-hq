'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  sendWorkspaceMessage,
  deleteWorkspaceMessage,
  toggleWorkspaceChatReaction,
  getWorkspaceChats,
  WorkspaceChatMessage,
} from '@/modules/workspaces/chatActions';
import { MarkdownViewer } from '@/components/MarkdownViewer';

interface WorkspaceMemberOption {
  id: string;
  name: string;
  avatar_url?: string | null;
  role?: string | null;
}

interface WorkspaceChatRoomProps {
  workspaceId: string;
  currentUserId: string;
  initialMessages: WorkspaceChatMessage[];
  canDeleteAny: boolean;
  members?: WorkspaceMemberOption[];
}

const QUICK_EMOJIS = ['👍', '🔥', '🚀', '❤️', '👏', '💡'];

function formatChatTime(timestampSec: number): string {
  if (!timestampSec) return '';
  const date = new Date(timestampSec * 1000);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function WorkspaceChatRoom({
  workspaceId,
  currentUserId,
  initialMessages,
  canDeleteAny,
  members = [],
}: WorkspaceChatRoomProps) {
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<WorkspaceChatMessage | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);

  const [isPending, startTransition] = useTransition();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Real-time polling every 2.5 seconds
  useEffect(() => {
    let isMounted = true;

    const fetchChats = async () => {
      if (document.hidden) return;
      const latest = await getWorkspaceChats(workspaceId);
      if (isMounted && latest && latest.length > 0) {
        setMessages((prev) => {
          const optimistics = prev.filter((m) => m.id.startsWith('temp_'));
          const serverIds = new Set(latest.map((m) => m.id));
          const filteredOptimistics = optimistics.filter((m) => !serverIds.has(m.id));
          return [...latest, ...filteredOptimistics];
        });
      }
    };

    const interval = setInterval(fetchChats, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [workspaceId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mentions detector in input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputMessage(value);

    const cursorPosition = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtMatch = textBeforeCursor.match(/@([\w\s]*)$/);

    if (lastAtMatch) {
      setMentionQuery(lastAtMatch[1].toLowerCase());
      setMentionIndex(textBeforeCursor.lastIndexOf('@'));
    } else {
      setMentionQuery(null);
      setMentionIndex(-1);
    }
  };

  const insertMention = (member: WorkspaceMemberOption) => {
    if (mentionIndex >= 0) {
      const before = inputMessage.slice(0, mentionIndex);
      const after = inputMessage.slice(inputRef.current?.selectionStart || inputMessage.length);
      const updated = `${before}@${member.name} ${after}`;
      setInputMessage(updated);
    }
    setMentionQuery(null);
    setMentionIndex(-1);
    inputRef.current?.focus();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed) return;

    const tempId = `temp_${Date.now()}`;
    const parentMsg = replyingTo;

    // Optimistic message append
    const optimisticMsg: WorkspaceChatMessage = {
      id: tempId,
      workspace_id: workspaceId,
      user_id: currentUserId,
      user_name: 'Anda',
      user_type: 'STAFF',
      message: trimmed,
      parent_id: parentMsg ? parentMsg.id : null,
      reply_message: parentMsg ? parentMsg.message : null,
      reply_user_name: parentMsg ? parentMsg.user_name : null,
      created_at: Math.floor(Date.now() / 1000),
      reactions: [],
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputMessage('');
    setReplyingTo(null);
    setMentionQuery(null);

    startTransition(async () => {
      const res = await sendWorkspaceMessage(
        workspaceId,
        trimmed,
        parentMsg ? parentMsg.id : null
      );

      if (!res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert(res.error || 'Gagal mengirim pesan');
      }
    });
  };

  const handleToggleReaction = (chatId: string, emoji: string) => {
    // Optimistic reaction toggle
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== chatId) return msg;

        const existingRxIndex = msg.reactions.findIndex((r) => r.emoji === emoji);
        let updatedReactions = [...msg.reactions];

        if (existingRxIndex >= 0) {
          const current = updatedReactions[existingRxIndex];
          if (current.hasReacted) {
            const nextCount = current.count - 1;
            if (nextCount <= 0) {
              updatedReactions.splice(existingRxIndex, 1);
            } else {
              updatedReactions[existingRxIndex] = { ...current, count: nextCount, hasReacted: false };
            }
          } else {
            updatedReactions[existingRxIndex] = { ...current, count: current.count + 1, hasReacted: true };
          }
        } else {
          updatedReactions.push({ emoji, count: 1, hasReacted: true, userNames: ['Anda'] });
        }

        return { ...msg, reactions: updatedReactions };
      })
    );

    startTransition(async () => {
      await toggleWorkspaceChatReaction(chatId, emoji, workspaceId);
    });
  };

  const handleDelete = (msgId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pesan ini?')) return;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));

    startTransition(async () => {
      const res = await deleteWorkspaceMessage(msgId, workspaceId);
      if (!res.success) {
        alert(res.error || 'Gagal menghapus pesan');
      }
    });
  };

  const filteredMembers =
    mentionQuery !== null && Array.isArray(members)
      ? members.filter(
          (m) => m && m.name && String(m.name).toLowerCase().includes(mentionQuery)
        )
      : [];

  return (
    <div className="flex flex-col h-[620px] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl overflow-hidden relative">
      {/* ── Room Header ── */}
      <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-sm border border-purple-500/20">
            💬
          </div>
          <div>
            <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <span>Diskusi Live Tim Workspace</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {messages.length} Pesan • Polling Real-time Aktif
            </p>
          </div>
        </div>

        {/* Member count pill */}
        {members.length > 0 && (
          <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 border border-zinc-300/40 dark:border-zinc-700/40 px-2.5 py-1 rounded-full text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
            <span>👥 {members.length} Anggota</span>
          </div>
        )}
      </div>

      {/* ── Message List Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-2">
            <span className="text-3xl animate-bounce">💬</span>
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
              Belum ada percakapan di room ini.
            </p>
            <p className="text-[11px] text-zinc-400 max-w-xs">
              Mulai diskusi tim, bagikan ide, atau beri masukan tugas di sini.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.user_id === currentUserId;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isSameSender =
              prevMsg &&
              prevMsg.user_id === msg.user_id &&
              msg.created_at - prevMsg.created_at < 120;

            const userInitials = (msg.user_name || 'U').charAt(0).toUpperCase();

            return (
              <div
                key={msg.id}
                id={`chat_msg_${msg.id}`}
                className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'} ${
                  isSameSender ? 'mt-1' : 'mt-3'
                }`}
              >
                {/* Quick Action Floating Bar (Hover) */}
                <div
                  className={`absolute -top-3 ${
                    isMe ? 'right-2' : 'left-2'
                  } hidden group-hover:flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg rounded-full px-2 py-0.5 z-20 transition-all animate-in fade-in duration-150`}
                >
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleToggleReaction(msg.id, emoji)}
                      className="hover:scale-125 transition-transform text-xs p-1 rounded-md"
                      title={`Beri reaksi ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setReplyingTo(msg)}
                    className="text-[10px] font-bold text-zinc-500 hover:text-purple-600 p-1"
                    title="Balas pesan"
                  >
                    ↩ Balas
                  </button>
                  {(isMe || canDeleteAny) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="text-[10px] font-bold text-zinc-400 hover:text-red-500 p-1"
                      title="Hapus pesan"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {/* Sender Info (Only if not same consecutive sender) */}
                {!isSameSender && (
                  <div
                    className={`flex items-center gap-2 mb-1 text-[10px] font-bold text-zinc-400 ${
                      isMe ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* User Avatar */}
                    {msg.user_avatar ? (
                      <div className="relative w-5 h-5 rounded-full overflow-hidden border border-purple-500/30 shrink-0">
                        <Image src={msg.user_avatar} alt={msg.user_name || ''} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                        {userInitials}
                      </div>
                    )}

                    <span className="font-extrabold text-zinc-700 dark:text-zinc-200">
                      {isMe ? 'Anda' : msg.user_name}
                    </span>

                    {/* Role Pill */}
                    {msg.user_role && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {msg.user_role}
                      </span>
                    )}

                    <span className="font-mono text-[9px] text-zinc-400">
                      {formatChatTime(msg.created_at)}
                    </span>
                  </div>
                )}

                {/* Chat Bubble Container */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-3.5 shadow-xs relative transition-all ${
                    isMe
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-xs'
                      : 'bg-zinc-100 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-800/60 rounded-tl-xs'
                  }`}
                >
                  {/* Quoted Parent Reply Header */}
                  {msg.parent_id && msg.reply_message && (
                    <div
                      onClick={() => {
                        const el = document.getElementById(`chat_msg_${msg.parent_id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`mb-2 p-2 rounded-2xl border text-xs cursor-pointer transition-all ${
                        isMe
                          ? 'bg-black/20 border-white/20 text-white/90 hover:bg-black/30'
                          : 'bg-zinc-200/60 dark:bg-zinc-800/80 border-zinc-300/40 dark:border-zinc-700/40 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      <p className="text-[9px] font-black uppercase tracking-wider text-purple-300 dark:text-purple-400">
                        ↩ Membalas {msg.reply_user_name || 'Anggota Tim'}
                      </p>
                      <p className="text-[11px] truncate italic mt-0.5">{msg.reply_message}</p>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className={`text-xs leading-relaxed break-words ${isMe ? 'text-white' : ''}`}>
                    <MarkdownViewer content={msg.message} />
                  </div>

                  {/* Attachment URL Preview */}
                  {msg.attachment_url && (
                    <div className="mt-2 rounded-2xl overflow-hidden border border-white/20">
                      <Image
                        src={msg.attachment_url}
                        alt="Attachment"
                        width={300}
                        height={200}
                        className="object-cover max-h-48 w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Emoji Reactions List Pill Bar */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
                    className={`flex items-center gap-1.5 flex-wrap mt-1 ${
                      isMe ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.reactions.map((rx) => (
                      <button
                        key={rx.emoji}
                        type="button"
                        onClick={() => handleToggleReaction(msg.id, rx.emoji)}
                        title={rx.userNames ? rx.userNames.join(', ') : ''}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                          rx.hasReacted
                            ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/40 shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                        }`}
                      >
                        <span>{rx.emoji}</span>
                        <span className="font-mono text-[9px]">{rx.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* ── Mention Autocomplete Dropdown Popover ── */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-16 left-4 right-4 z-40 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-2 max-h-40 overflow-y-auto space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <p className="text-[9px] font-black uppercase text-zinc-400 px-2 py-1 tracking-wider">
            Sebut / Mention Anggota Tim:
          </p>
          {filteredMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => insertMention(m)}
              className="w-full text-left p-2 rounded-xl hover:bg-purple-500/10 flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  @{m.name}
                </span>
              </div>
              {m.role && (
                <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">
                  {m.role}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Quoted Reply Banner above Input ── */}
      {replyingTo && (
        <div className="px-4 py-2 bg-purple-500/10 border-t border-purple-500/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-purple-600 dark:text-purple-400 font-bold">↩ Membalas:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {replyingTo.user_name}
            </span>
            <span className="text-zinc-500 truncate text-[11px]">"{replyingTo.message}"</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center text-xs font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Input Form Footer ── */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          placeholder="Ketik pesan tim (gunakan @ nama anggota)..."
          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 shadow-xs transition-all"
        />

        <button
          type="submit"
          disabled={isPending || !inputMessage.trim()}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-40 shrink-0 flex items-center gap-1.5"
        >
          <span>Kirim</span>
          <span className="text-sm">🚀</span>
        </button>
      </form>
    </div>
  );
}
