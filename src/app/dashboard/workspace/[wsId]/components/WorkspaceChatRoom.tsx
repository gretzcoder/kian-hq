'use client';

import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import UserAvatar from '@/components/ui/UserAvatar';
import { DeleteMessageModal } from '@/components/DeleteMessageModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import {
  sendWorkspaceMessage,
  editWorkspaceMessage,
  deleteWorkspaceMessage,
  togglePinWorkspaceMessage,
  toggleWorkspaceChatReaction,
  getWorkspaceChats,
  markWorkspaceChatsRead,
  updateUserTypingPresence,
  getWorkspacePresence,
  clearWorkspaceChats,
  voteWorkspacePollAction,
  WorkspaceChatMessage,
  MemberPresenceInfo,
} from '@/modules/workspaces/chatActions';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import EmojiStickerPicker, { TEAM_STICKERS, TeamSticker } from './EmojiStickerPicker';
import { SmartLinkMeta } from '@/modules/workspaces/smartLinkParser';
import { SubmittedLinkPreviewer } from '@/components/editor/SubmittedLinkPreviewer';
import { parseRichMessageContent } from '@/lib/menuTagging';
import { CompactMessageBubble } from '@/components/chat/CompactMessageBubble';
import { CompactChatComposer, StickerOption } from '@/components/chat/CompactChatComposer';
import { DateSeparatorDivider } from '@/components/chat/DateSeparatorDivider';
import { CreatePollModal } from '@/components/chat/CreatePollModal';
import { MenuTagModal } from '@/components/MenuTagModal';
import { MenuTagOption } from '@/modules/menu/menuTagActions';
import { MenuHashtagAutocompletePopover } from '@/components/MenuHashtagAutocompletePopover';

function isImageUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.trim().split('?')[0].toLowerCase();
  if (/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)$/i.test(clean)) return true;
  if (
    url.includes('drive.google.com/uc?') ||
    url.includes('images.unsplash.com') ||
    url.includes('i.imgur.com') ||
    url.includes('res.cloudinary.com') ||
    url.includes('r2.dev') ||
    url.startsWith('data:image/')
  ) {
    return true;
  }
  return false;
}

function renderWorkspaceMessageContent(messageText: string, isMe: boolean) {
  const parts = messageText.split(/(@[\w.-]+|(?:https?:\/\/[^\s<"']+))/gi);

  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={index}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-black transition-all ${
            isMe
              ? 'bg-white/25 text-white border border-white/30 shadow-2xs'
              : 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30'
          }`}
        >
          {part}
        </span>
      );
    }
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className={`underline font-bold text-xs hover:opacity-80 transition-opacity ${
            isMe ? 'text-cyan-200' : 'text-blue-500 dark:text-blue-400'
          }`}
        >
          {part} ↗
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface WorkspaceMemberOption {
  id: string;
  name: string;
  avatar_url?: string | null;
  role?: string | null;
}

interface WorkspaceChatRoomProps {
  workspaceId: string;
  currentUserId: string;
  currentUserRole?: string | null;
  currentUserType?: string | null;
  initialMessages: WorkspaceChatMessage[];
  canDeleteAny: boolean;
  members?: WorkspaceMemberOption[];
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🚀', '💡'];

function mergeAndDeduplicateMessages(
  serverMsgs: WorkspaceChatMessage[],
  prevMsgs: WorkspaceChatMessage[],
  currentUserId: string
): WorkspaceChatMessage[] {
  const map = new Map<string, WorkspaceChatMessage>();
  const seenKeys = new Set<string>();

  // Add server messages first (authoritative source) with content-deduplication
  for (const msg of serverMsgs) {
    const contentKey = `${msg.user_id}_${msg.message.trim()}_${Math.floor(msg.created_at / 4)}`;
    if (seenKeys.has(contentKey)) continue;
    seenKeys.add(contentKey);
    map.set(msg.id, msg);
  }

  // Filter remaining optimistic temporary messages
  const tempMsgs = prevMsgs.filter((m) => m.id.startsWith('temp_'));
  for (const temp of tempMsgs) {
    const isAlreadySaved = serverMsgs.some(
      (s) =>
        s.user_id === currentUserId &&
        s.message === temp.message &&
        Math.abs(s.created_at - temp.created_at) < 15
    );

    if (!isAlreadySaved && !map.has(temp.id)) {
      map.set(temp.id, temp);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.created_at - b.created_at);
}

function formatNaturalTimestamp(timestampSec: number): string {
  if (!timestampSec) return '';
  const date = new Date(timestampSec * 1000);

  if (isToday(date)) {
    const relative = formatDistanceToNow(date, { addSuffix: true, locale: localeID });
    const timeStr = format(date, 'HH.mm', { locale: localeID });
    return `${relative} • ${timeStr} WIB`;
  }

  if (isYesterday(date)) {
    const timeStr = format(date, 'HH.mm', { locale: localeID });
    return `Kemarin • ${timeStr} WIB`;
  }

  return format(date, "d MMM yyyy • HH.mm 'WIB'", { locale: localeID });
}

export function WorkspaceChatRoom({
  workspaceId,
  currentUserId,
  currentUserRole,
  currentUserType,
  initialMessages,
  canDeleteAny,
  members = [],
}: WorkspaceChatRoomProps) {
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<WorkspaceChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<WorkspaceChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [showPinnedBanner, setShowPinnedBanner] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);

  // Realtime Presence state
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [membersPresenceMap, setMembersPresenceMap] = useState<Record<string, MemberPresenceInfo>>({});
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const toggleSelectMsg = (msgId: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const handleVotePoll = async (msgId: string, optionId: string) => {
    const res = await voteWorkspacePollAction(msgId, optionId, workspaceId);
    if (res.success) {
      const latest = await getWorkspaceChats(workspaceId);
      if (latest && Array.isArray(latest)) {
        setMessages((prev) => mergeAndDeduplicateMessages(latest, prev, currentUserId));
      }
    }
  };

  const [isPending, startTransition] = useTransition();

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(inputRef.current.scrollHeight, 40), 180);
      inputRef.current.style.height = `${newHeight}px`;
    }
  }, [inputMessage]);

  // Strict Pin Authorization Check (Admin, Coordinator, Mentor, Team Leader only)
  const canPinMessage = useMemo(() => {
    const rUpper = (currentUserRole || '').toUpperCase();
    const tUpper = (currentUserType || '').toUpperCase();
    return (
      canDeleteAny ||
      tUpper === 'STAFF' ||
      rUpper.includes('LEADER') ||
      rUpper.includes('MENTOR') ||
      rUpper.includes('COORDINATOR') ||
      rUpper.includes('EXECUTIVE') ||
      rUpper.includes('ADMIN')
    );
  }, [currentUserRole, currentUserType, canDeleteAny]);

  // Virtualizer for high-performance long chat lists
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => chatContainerRef.current,
    estimateSize: () => 90,
    overscan: 5,
  });

  // Show auto-dismissing toast
  const triggerToast = (msgText: string) => {
    setToastMsg(msgText);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Sync initial messages & mark read
  useEffect(() => {
    if (Array.isArray(initialMessages)) {
      setMessages((prev) => mergeAndDeduplicateMessages(initialMessages, prev, currentUserId));
    }
    markWorkspaceChatsRead(workspaceId);
  }, [initialMessages, workspaceId, currentUserId]);

  // Realtime Polling (2.5 seconds) for messages, reactions, & presence
  useEffect(() => {
    let isMounted = true;

    const pollChatAndPresence = async () => {
      if (document.hidden) return;

      const [latestChats, presenceData] = await Promise.all([
        getWorkspaceChats(workspaceId),
        getWorkspacePresence(workspaceId),
      ]);

      if (isMounted) {
        if (latestChats && Array.isArray(latestChats)) {
          setMessages((prev) => mergeAndDeduplicateMessages(latestChats, prev, currentUserId));
        }

        if (presenceData) {
          setOnlineCount(presenceData.onlineCount || 1);
          setTypingNames(presenceData.typingNames || []);
          const pMap: Record<string, MemberPresenceInfo> = {};
          (presenceData.membersPresence || []).forEach((m) => {
            pMap[m.userId] = m;
          });
          setMembersPresenceMap(pMap);
        }
      }
    };

    const interval = setInterval(pollChatAndPresence, 15_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [workspaceId, currentUserId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Input Typing Indicator Handler
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputMessage(value);

    // Broadcast typing presence
    updateUserTypingPresence(workspaceId, true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      updateUserTypingPresence(workspaceId, false);
    }, 3000);

    // Mention Detector
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
      const updated = `${before}@${member.name} `;
      setInputMessage(updated);
    }
    setMentionQuery(null);
    setMentionIndex(-1);
    inputRef.current?.focus();
  };

  // Handle Send Message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed) return;

    const tempId = `temp_${Date.now()}`;
    const parentMsg = replyingTo;

    // Optimistic Message
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
      is_pinned: false,
      is_edited: false,
      edit_count: 0,
      can_edit: true,
      created_at: Math.floor(Date.now() / 1000),
      reactions: [],
      read_count: 0,
      read_by_names: [],
      is_sticker: false,
      smart_links: [],
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputMessage('');
    setReplyingTo(null);
    setMentionQuery(null);
    setShowEmojiPicker(false);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    startTransition(async () => {
      const res = await sendWorkspaceMessage(
        workspaceId,
        trimmed,
        parentMsg ? parentMsg.id : null
      );

      if (!res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert(res.error || 'Gagal mengirim pesan');
      } else {
        const latest = await getWorkspaceChats(workspaceId);
        if (latest && Array.isArray(latest)) {
          setMessages((prev) => mergeAndDeduplicateMessages(latest, prev, currentUserId));
        }
      }
    });
  };

  // Handle Send Sticker
  const handleSendSticker = (sticker: TeamSticker) => {
    const stickerPayload = `[sticker:${sticker.id}:${sticker.emoji}:${sticker.name}]`;
    const tempId = `temp_${Date.now()}`;

    const optimisticMsg: WorkspaceChatMessage = {
      id: tempId,
      workspace_id: workspaceId,
      user_id: currentUserId,
      user_name: 'Anda',
      user_type: 'STAFF',
      message: stickerPayload,
      is_pinned: false,
      is_edited: false,
      edit_count: 0,
      can_edit: true,
      created_at: Math.floor(Date.now() / 1000),
      reactions: [],
      read_count: 0,
      read_by_names: [],
      is_sticker: true,
      sticker_info: { id: sticker.id, emoji: sticker.emoji, name: sticker.name },
      smart_links: [],
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setShowEmojiPicker(false);

    startTransition(async () => {
      const res = await sendWorkspaceMessage(workspaceId, stickerPayload);
      if (!res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert(res.error || 'Gagal mengirim stiker');
      } else {
        const latest = await getWorkspaceChats(workspaceId);
        if (latest && Array.isArray(latest)) {
          setMessages((prev) => mergeAndDeduplicateMessages(latest, prev, currentUserId));
        }
      }
    });
  };

  // Handle Edit Message Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMsg || !editText.trim()) return;

    const editId = editingMsg.id;
    const newTxt = editText.trim();

    setMessages((prev) =>
      prev.map((m) => (m.id === editId ? { ...m, message: newTxt, is_edited: true } : m))
    );
    setEditingMsg(null);
    setEditText('');

    startTransition(async () => {
      const res = await editWorkspaceMessage(editId, newTxt, workspaceId);
      if (!res.success) {
        alert(res.error || 'Gagal mengedit pesan');
      }
    });
  };

  // Handle Copy Message Text
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerToast('📋 Pesan berhasil disalin ke clipboard');
  };

  // Handle Toggle Pin
  const handleTogglePin = (msgId: string) => {
    if (!canPinMessage) {
      alert('Hanya Admin, Koordinator, Mentor, atau Ketua Tim yang dapat menyematkan pesan.');
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_pinned: !m.is_pinned } : m))
    );

    startTransition(async () => {
      const res = await togglePinWorkspaceMessage(msgId, workspaceId);
      if (res.success) {
        triggerToast(res.isPinned ? '📌 Pesan disematkan ke banner workspace' : '📌 Sematan pesan dilepas');
      } else {
        alert(res.error || 'Gagal mengubah status sematan');
      }
    });
  };

  // Handle Toggle Reaction
  const handleToggleReaction = (chatId: string, emoji: string) => {
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

  // Handle Delete Message
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

  // Handle Clear Chat (Restricted to Admin, Coordinator, Mentor, Team Leader)
  const handleClearChat = () => {
    if (!canPinMessage) {
      alert('Hanya Admin, Koordinator, Mentor, atau Ketua Tim yang dapat menghapus seluruh riwayat chat.');
      return;
    }

    if (!confirm('Apakah Anda yakin ingin menghapus SELURUH riwayat pesan chat di workspace ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }

    setMessages([]);

    startTransition(async () => {
      const res = await clearWorkspaceChats(workspaceId);
      if (res.success) {
        triggerToast('🧹 Riwayat chat workspace berhasil dibersihkan');
      } else {
        alert(res.error || 'Gagal membersihkan riwayat chat');
      }
    });
  };

  // Pinned Messages List
  const pinnedMessages = useMemo(() => messages.filter((m) => m.is_pinned), [messages]);

  // Mention Suggestions Filter
  const filteredMembers =
    mentionQuery !== null && Array.isArray(members)
      ? members.filter((m) => m && m.name && String(m.name).toLowerCase().includes(mentionQuery))
      : [];

  return (
    <div className="flex flex-col h-[650px] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden relative">
      {/* ── Toast Notification ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/90 dark:bg-zinc-100/90 text-white dark:text-zinc-900 text-xs font-bold px-4 py-2 rounded-full shadow-xl backdrop-blur-md flex items-center gap-2"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Room Header ── */}
      <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-sm border border-purple-500/20">
            💬
          </div>
          <div>
            <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <span>Diskusi Live Tim Workspace</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <span>{messages.length} Pesan</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {onlineCount} Online
              </span>
            </p>
          </div>
        </div>

        {/* Header Right Actions: Clear Chat, Pinned Messages Banner & Members */}
        <div className="flex items-center gap-2">
          {canPinMessage && messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="flex items-center gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer shadow-xs"
              title="Bersihkan seluruh riwayat chat workspace ini"
            >
              <span>🧹</span>
              <span className="hidden sm:inline">Bersihkan Chat</span>
            </button>
          )}

          {pinnedMessages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPinnedBanner(!showPinnedBanner)}
              className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer shadow-xs"
              title="Lihat pesan tersemat"
            >
              <span>📌</span>
              <span>{pinnedMessages.length} Sematan</span>
            </button>
          )}

          {members.length > 0 && (
            <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 border border-zinc-300/40 dark:border-zinc-700/40 px-2.5 py-1 rounded-full text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
              <span>👥 {members.length} Anggota</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Expandable Pinned Messages Drawer ── */}
      <AnimatePresence>
        {showPinnedBanner && pinnedMessages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 space-y-2 z-10"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider flex items-center gap-1">
                <span>📌 Pesan Tersemat</span>
                <span>({pinnedMessages.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPinnedBanner(false)}
                className="text-amber-700 dark:text-amber-300 hover:text-amber-900 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
              {pinnedMessages.map((pm) => (
                <div
                  key={pm.id}
                  onClick={() => {
                    const el = document.getElementById(`chat_msg_${pm.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="bg-white/80 dark:bg-zinc-900/80 p-2 rounded-xl border border-amber-500/20 text-xs flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-[11px] truncate">
                      {pm.user_name}: <span className="font-normal text-zinc-600 dark:text-zinc-400">{pm.message}</span>
                    </p>
                  </div>
                  {canPinMessage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(pm.id);
                      }}
                      className="text-[10px] font-bold text-amber-600 hover:text-red-500 shrink-0"
                    >
                      Lepas
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Virtualized Chat Message List Body ── */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative">
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

            // Presence status of user
            const presence = membersPresenceMap[msg.user_id];
            const presenceStatus = presence ? presence.status : 'offline';
            const presenceDot =
              presenceStatus === 'online' ? 'bg-emerald-500' : presenceStatus === 'idle' ? 'bg-amber-500' : 'bg-zinc-400';

            return (
              <CompactMessageBubble
                key={msg.id}
                id={msg.id}
                isMe={isMe}
                showSenderHeader={!isSameSender}
                senderName={isMe ? 'Anda' : msg.user_name || 'Anggota Tim'}
                senderAvatar={msg.user_avatar}
                senderRole={msg.user_role}
                message={msg.message}
                attachmentUrl={msg.attachment_url}
                replyMessage={
                  msg.reply_message
                    ? {
                        id: msg.parent_id || undefined,
                        senderName: msg.reply_user_name || 'Anggota Tim',
                        message: msg.reply_message,
                      }
                    : null
                }
                reactions={(msg.reactions || []).map((rx) => ({
                  emoji: rx.emoji,
                  count: rx.count,
                  hasReacted: rx.hasReacted,
                  userIds: rx.userNames || [],
                }))}
                status={msg.read_count > 0 ? 'READ' : 'SENT'}
                createdAt={msg.created_at < 10000000000 ? msg.created_at * 1000 : msg.created_at}
                isEdited={msg.is_edited}
                isPinned={msg.is_pinned}
                isSelectMode={isSelectMode}
                isSelected={selectedMsgIds.has(msg.id)}
                currentUserId={currentUserId}
                onVotePoll={(msgId, optId) => handleVotePoll(msgId, optId)}
                onToggleSelect={(id) => toggleSelectMsg(id)}
                onToggleReaction={(id, emoji) => handleToggleReaction(id, emoji)}
                onReply={() => setReplyingTo(msg)}
                onCopy={(text) => navigator.clipboard.writeText(text)}
                onEdit={() => {
                  setEditingMsg(msg);
                  setEditText(msg.message);
                }}
                onPin={() => handleTogglePin(msg.id)}
                onDelete={() => {
                  setSelectedMsgIds(new Set([msg.id]));
                  setDeleteModalOpen(true);
                }}
                canEdit={isMe}
                canPin={canPinMessage}
                canDelete={canDeleteAny || isMe}
                memberList={members}
              />
            );
          })
        )}

        {/* Realtime Typing Indicator Dots */}
        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-900/80 rounded-2xl w-fit border border-zinc-200/60 dark:border-zinc-800/60 text-xs font-bold text-purple-600 dark:text-purple-400"
            >
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>{typingNames.join(', ')} sedang mengetik...</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div id="chat_bottom_scroll" />
      </div>

      {/* ── Mention Autocomplete Dropdown ── */}
      <AnimatePresence>
        {filteredMembers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 left-4 z-40 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 max-h-40 overflow-y-auto w-64 space-y-1"
          >
            <p className="text-[9px] font-black uppercase text-zinc-400 px-2 py-1 tracking-wider">
              Sebut Anggota Tim (@)
            </p>
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => insertMention(m)}
                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-purple-500/10 hover:text-purple-600 text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between transition-colors"
              >
                <span>@{m.name}</span>
                {m.role && <span className="text-[9px] text-purple-500 uppercase">{m.role}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Emoji & Sticker Popover ── */}
      <AnimatePresence>
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-4 z-40">
            <EmojiStickerPicker
              onSelectEmoji={(emoji) => {
                setInputMessage((prev) => prev + emoji);
              }}
              onSelectSticker={handleSendSticker}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Quoted Reply Preview Bar ── */}
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

      {/* ── Inline Edit Message Bar ── */}
      {editingMsg && (
        <form onSubmit={handleEditSubmit} className="p-3 bg-amber-500/10 border-t border-amber-500/20 flex flex-col gap-2 text-xs animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1">
              <span>✏️ Edit Pesan</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-md font-mono">
                (Sisa {5 - (editingMsg.edit_count || 0)}x edit)
              </span>
            </span>
            <button
              type="button"
              onClick={() => setEditingMsg(null)}
              className="text-zinc-400 font-bold text-xs hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value);
                e.target.style.height = 'auto';
                const newH = Math.min(Math.max(e.target.scrollHeight, 44), 160);
                e.target.style.height = `${newH}px`;
              }}
              placeholder="Edit pesan tim Anda..."
              className="flex-1 bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-2xl p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 shadow-xs resize-none min-h-[44px] max-h-[160px] leading-relaxed overflow-y-auto"
            />
            <button
              type="submit"
              disabled={isPending || !editText.trim()}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </form>
      )}

      {/* ── Integrated Compact Chat Composer ── */}
      <CompactChatComposer
        onSend={async (text, attachmentUrl) => {
          const res = await sendWorkspaceMessage(workspaceId, text, replyingTo?.id, attachmentUrl);
          if (res.success) {
            setReplyingTo(null);
            const latest = await getWorkspaceChats(workspaceId);
            if (latest && Array.isArray(latest)) {
              setMessages((prev) => mergeAndDeduplicateMessages(latest, prev, currentUserId));
            }
          }
        }}
        onSendSticker={(stk) => handleSendSticker(stk as any)}
        replyingTo={
          replyingTo
            ? {
                id: replyingTo.id,
                senderName: replyingTo.user_name || 'Anggota Tim',
                message: replyingTo.message,
              }
            : null
        }
        onCancelReply={() => setReplyingTo(null)}
        placeholder="Ketik pesan tim (ketik # untuk tag menu)..."
        stickers={TEAM_STICKERS}
        memberList={members}
        onOpenPollModal={() => setShowPollModal(true)}
      />

      {/* Menu Tag Picker Modal */}
      <MenuTagModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        onSelectMenu={(menu: MenuTagOption) => {
          setInputMessage((prev) => `${prev} #[${menu.label}](${menu.path}) `.trimStart());
        }}
      />

      {/* Multi-Select Floating Action Bar (WhatsApp Web Style Image 4) */}
      {isSelectMode && (
        <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-2xl z-30 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
              {selectedMsgIds.size} Selected
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSelectMode(false);
                setSelectedMsgIds(new Set());
              }}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-bold px-2 py-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
            >
              Batal
            </button>
          </div>

          <button
            type="button"
            disabled={selectedMsgIds.size === 0}
            onClick={() => {
              setDeleteModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>🗑️ Hapus</span>
          </button>
        </div>
      )}

      {/* Delete Message Modal (WhatsApp Web Style) */}
      <DeleteMessageModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        selectedCount={selectedMsgIds.size || 1}
        canDeleteEveryone={(() => {
          if (canDeleteAny) return true;
          if (selectedMsgIds.size === 0) return true;
          const nowSec = Math.floor(Date.now() / 1000);
          return Array.from(selectedMsgIds).every((id) => {
            const target = messages.find((m) => m.id === id);
            if (!target) return false;
            const createdAtSec = target.created_at < 10000000000 ? target.created_at : Math.floor(target.created_at / 1000);
            return target.user_id === currentUserId && (nowSec - createdAtSec <= 15 * 60);
          });
        })()}
        onConfirmEveryone={async () => {
          setSubmittingDelete(true);
          try {
            const ids = Array.from(selectedMsgIds);
            for (const id of ids) {
              await deleteWorkspaceMessage(id, workspaceId);
            }
            setToastMsg(`${ids.length} pesan dihapus untuk semua orang`);
            setTimeout(() => setToastMsg(null), 2500);
            setDeleteModalOpen(false);
            setIsSelectMode(false);
            setSelectedMsgIds(new Set());
            const latest = await getWorkspaceChats(workspaceId);
            if (latest && Array.isArray(latest)) {
              setMessages(latest);
            }
          } catch (err: any) {
            alert(err.message || 'Gagal menghapus pesan');
          } finally {
            setSubmittingDelete(false);
          }
        }}
        onConfirmPOV={async () => {
          setSubmittingDelete(true);
          try {
            const ids = Array.from(selectedMsgIds);
            setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
            setToastMsg(`${ids.length} pesan dihapus untuk Anda`);
            setTimeout(() => setToastMsg(null), 2500);
            setDeleteModalOpen(false);
            setIsSelectMode(false);
            setSelectedMsgIds(new Set());
          } catch (err: any) {
            alert(err.message || 'Gagal menghapus pesan');
          } finally {
            setSubmittingDelete(false);
          }
        }}
        submitting={submittingDelete}
      />

      <CreatePollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onCreatePoll={(pollPayload) => {
          sendWorkspaceMessage(workspaceId, pollPayload);
        }}
      />
    </div>
  );
}
