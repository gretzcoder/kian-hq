'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useFloatingMessenger, ActiveChatSession } from './FloatingMessengerContext';
import {
  getDirectMessagesAction,
  sendDirectMessageAction,
  toggleDMReactionAction,
  acceptMessageRequestAction,
  deleteDirectMessagePOVAction,
  editDirectMessageAction,
  deleteDirectMessageEveryoneAction,
  DirectMessage,
} from '../dmActions';
import { respondFriendRequestAction, getFriendshipStatusAction, FriendshipStatus } from '@/modules/friends/friendActions';
import UserAvatar from '@/components/ui/UserAvatar';
import { DeleteMessageModal } from '@/components/DeleteMessageModal';
import { parseRichMessageContent } from '@/lib/menuTagging';
import { MenuHashtagAutocompletePopover } from '@/components/MenuHashtagAutocompletePopover';
import { MenuTagModal } from '@/components/MenuTagModal';
import { MenuTagOption } from '@/modules/menu/menuTagActions';
import type { EmojiClickData } from 'emoji-picker-react';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '👏', '🙌'];
const STICKERS = ['🚀', '💯', '✨', '⚡', '🏆', '🎉', '💪', '🎯', '⭐', '🎈'];

interface DraggableChatHeadProps {
  partnerId: string;
  name: string;
  avatar: string | null;
  index: number;
  onOpen: () => void;
  onClose: () => void;
}

function DraggableChatHead({ partnerId, name, avatar, index, onOpen, onClose }: DraggableChatHeadProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    moved: false,
  });

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Default initial position (80px + index * 64px from bottom, right-4 = window.innerWidth - 72px)
  const defaultBottomPx = 80 + index * 64;

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos ? pos.x : window.innerWidth - 72,
      initialY: pos ? pos.y : window.innerHeight - defaultBottomPx - 56,
      moved: false,
    };

    // Press & Hold (Long-press) timer for mobile quick action menu
    longPressTimer.current = setTimeout(() => {
      if (!dragRef.current.moved) {
        setShowMenu(true);
      }
    }, 380);

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - dragRef.current.startX;
      const dy = moveEv.clientY - dragRef.current.startY;

      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        dragRef.current.moved = true;
        if (longPressTimer.current) clearTimeout(longPressTimer.current);

        const newX = Math.max(10, Math.min(window.innerWidth - 65, dragRef.current.initialX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 65, dragRef.current.initialY + dy));
        setPos({ x: newX, y: newY });
        setIsDragging(true);
      }
    };

    const handlePointerUp = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      setTimeout(() => setIsDragging(false), 50);

      // If user tapped without dragging, toggle chat
      if (!dragRef.current.moved && !showMenu) {
        onOpen();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const currentStyle: React.CSSProperties = pos
    ? { left: `${pos.x}px`, top: `${pos.y}px` }
    : { bottom: `${defaultBottomPx}px`, right: '1rem' };

  return (
    <div
      style={currentStyle}
      className={`fixed z-[95] flex items-center gap-2 group touch-none select-none ${
        isDragging ? 'cursor-grabbing scale-105 transition-none' : 'cursor-grab transition-all duration-200'
      }`}
    >
      {/* Circle Chat Head Avatar */}
      <div
        onPointerDown={handlePointerDown}
        className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 p-0.5 shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-grab"
        title={`Geser/Tekan & tahan untuk menu: ${name}`}
      >
        <UserAvatar
          src={avatar}
          name={name}
          size="lg"
          square
          className="w-full h-full rounded-full border-2 border-white dark:border-zinc-900 object-cover pointer-events-none"
        />
        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 ring-2 ring-emerald-400 pointer-events-none" />
      </div>

      {/* Desktop Close Button on Hover */}
      <button
        type="button"
        onClick={onClose}
        className="w-6 h-6 rounded-full bg-black/80 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        title="Tutup Chat"
      >
        ✕
      </button>

      {/* Mobile Long-Press Quick Action Popup Menu */}
      {showMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-24 right-0 w-44 bg-zinc-900 border border-zinc-700 text-white rounded-2xl p-2 shadow-2xl z-50 text-xs animate-in zoom-in-95 duration-150 space-y-1"
        >
          <div className="px-2.5 py-1 border-b border-zinc-800 flex items-center justify-between">
            <span className="font-bold truncate text-[10px] text-zinc-400">{name}</span>
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="text-zinc-400 hover:text-white font-bold text-[10px]"
            >
              ✕
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              onOpen();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-purple-600 font-bold flex items-center gap-2 cursor-pointer transition-colors text-[11px]"
          >
            <span>💬</span> Buka Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-rose-600 font-bold text-rose-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors text-[11px]"
          >
            <span>✕</span> Tutup Chat
          </button>
        </div>
      )}
    </div>
  );
}

interface SingleChatBoxProps {
  chat: ActiveChatSession;
  index: number;
  totalChats: number;
}

function SingleChatBox({ chat, index, totalChats }: SingleChatBoxProps) {
  const router = useRouter();
  const { closeChat, toggleMinimize } = useFloatingMessenger();
  const { partnerId, partnerName: activePartnerName, partnerAvatar: activePartnerAvatar, isMinimized } = chat;

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [partnerInfo, setPartnerInfo] = useState<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    userType: string | null;
    isFriend: boolean;
    isRequest: boolean;
  } | null>(null);

  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('NONE');
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const [deleteTargetMsgId, setDeleteTargetMsgId] = useState<string | null>(null);
  const [submittingDeleteMsg, setSubmittingDeleteMsg] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [sending, setSending] = useState(false);

  const touchTimer = useRef<NodeJS.Timeout | null>(null);

  const [editingMsg, setEditingMsg] = useState<DirectMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deleteType, setDeleteType] = useState<'POV' | 'EVERYONE'>('POV');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string | null>(null);

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

  const triggerToast = (msgText: string) => {
    setToastMessage(msgText);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const isTouchDevice = () => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 38), 160);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [inputText]);

  const fetchMessages = async () => {
    if (!partnerId) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await getDirectMessagesAction(partnerId);
      if (res.success && res.messages) {
        setMessages(res.messages);
        if (res.partnerInfo) setPartnerInfo(res.partnerInfo);
      }
    } catch {}
  };

  const fetchFriendship = async () => {
    if (!partnerId) return;
    try {
      const res = await getFriendshipStatusAction(partnerId);
      if (res.success) setFriendshipStatus(res.status);
    } catch {}
  };

  useEffect(() => {
    if (partnerId) {
      setLoading(true);
      Promise.all([fetchMessages(), fetchFriendship()]).finally(() => setLoading(false));

      const interval = setInterval(fetchMessages, 8000);
      return () => clearInterval(interval);
    }
  }, [partnerId]);

  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isMinimized]);

  const name = partnerInfo?.name || activePartnerName || 'User';
  const avatar = partnerInfo?.avatarUrl || activePartnerAvatar || null;

  // ── PRESS & HOLD (LONG PRESS) HANDLERS FOR MESSAGES ──
  const handleTouchStart = (msgId: string) => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => {
      setActiveActionMsgId((prev) => (prev === msgId ? null : msgId));
    }, 350);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  // ── MINIMIZED CHAT HEAD CIRCLE ICON STATE (DRAGGABLE & LONG-PRESS ACTION) ──
  if (isMinimized) {
    return (
      <DraggableChatHead
        partnerId={partnerId}
        name={name}
        avatar={avatar}
        index={index}
        onOpen={() => toggleMinimize(partnerId, false)}
        onClose={() => closeChat(partnerId)}
      />
    );
  }

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() && !attachmentUrl.trim()) return;

    setSending(true);
    try {
      const res = await sendDirectMessageAction({
        receiverId: partnerId,
        message: textToSend,
        attachmentUrl: attachmentUrl.trim() || undefined,
        replyToId: replyingTo?.id || undefined,
      });

      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message!]);
        setInputText('');
        setAttachmentUrl('');
        setShowAttachmentInput(false);
        setReplyingTo(null);
        setShowStickers(false);
        setShowEmojiPicker(false);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveActionMsgId(null);
    try {
      const res = await toggleDMReactionAction(messageId, emoji);
      if (res.success && res.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions! } : m))
        );
      }
    } catch {}
  };

  const handleAcceptRequest = async () => {
    await acceptMessageRequestAction(partnerId);
    if (partnerInfo) setPartnerInfo({ ...partnerInfo, isRequest: false });
    fetchMessages();
  };

  const handleFriendRequest = async () => {
    if (friendshipStatus === 'NONE') {
      await respondFriendRequestAction(partnerId, 'ACCEPT');
      fetchFriendship();
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText((prev) => prev + emojiData.emoji);
  };

  return (
    <div
      className={`fixed z-[95] bg-white dark:bg-[#09090b] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 border border-zinc-200 dark:border-zinc-800 shadow-2xl ${
        /* Full Screen on Mobile View (< sm), Fixed Floating Box on Desktop View (>= sm) */
        'inset-0 w-full h-full rounded-none sm:inset-auto sm:bottom-0 sm:right-6 sm:w-[380px] sm:h-[500px] sm:rounded-t-3xl'
      }`}
    >
      {/* Messenger Header Bar */}
      <div className="p-3.5 sm:p-3 bg-gradient-to-r from-purple-900/95 via-indigo-900/95 to-zinc-900 text-white flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar src={avatar} name={name} size="sm" square className="rounded-xl ring-2 ring-white/20 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-black truncate leading-tight flex items-center gap-1.5">
              <span>{name}</span>
              {partnerInfo?.isFriend && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-normal shrink-0">Teman</span>
              )}
            </h4>
            <p className="text-[10px] text-zinc-300 truncate">
              {partnerInfo?.email || 'Personal Chat'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Add Friend Button */}
          {friendshipStatus === 'NONE' && (
            <button
              type="button"
              onClick={handleFriendRequest}
              title="Tambah Teman"
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>👥</span> +Teman
            </button>
          )}

          {/* Full Messenger Page Jump Button */}
          <button
            type="button"
            onClick={() => {
              closeChat(partnerId);
              router.push('/dashboard/friends');
            }}
            className="w-7 h-7 rounded-lg hover:bg-white/15 text-white text-xs font-black transition-colors flex items-center justify-center cursor-pointer"
            title="Buka Halaman Messenger Lengkap"
          >
            ↗
          </button>

          {/* Minimize toggle */}
          <button
            type="button"
            onClick={() => toggleMinimize(partnerId, true)}
            className="w-7 h-7 rounded-lg hover:bg-white/15 text-white text-xs font-black transition-colors flex items-center justify-center cursor-pointer"
            title="Minimize Chat"
          >
            —
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={() => closeChat(partnerId)}
            className="w-7 h-7 rounded-lg hover:bg-white/15 text-white text-xs font-black transition-colors flex items-center justify-center cursor-pointer"
            title="Tutup Chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Message Request Notification Banner */}
      {partnerInfo?.isRequest && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-2.5 text-center text-xs space-y-1.5 shrink-0">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
            📩 Permintaan Pesan (Message Request)
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            User ini belum berada di daftar teman Anda. Pilihlah untuk menerima pesan ini.
          </p>
          <button
            type="button"
            onClick={handleAcceptRequest}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-all shadow-xs cursor-pointer"
          >
            ✓ Terima Pesan
          </button>
        </div>
      )}

      {/* Message History Stream */}
      <div
        onClick={() => setActiveActionMsgId(null)}
        className="p-3 sm:p-4 overflow-y-auto space-y-3 text-xs bg-zinc-50/50 dark:bg-black/40 flex-1 scrollbar-thin relative"
      >
        {loading && messages.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 text-xs animate-pulse font-bold">
            Memuat percakapan...
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center space-y-2 text-zinc-400">
            <span className="text-3xl opacity-60">💬</span>
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Belum Ada Pesan</p>
            <p className="text-[10px] max-w-[200px] mx-auto">
              Mulai percakapan personal dengan <strong>{name}</strong>!
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId !== partnerId;
            const isActionActive = activeActionMsgId === m.id;

            return (
              <div
                key={m.id}
                className={`flex flex-col group relative select-none ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Reply quote snippet */}
                {m.replyMessage && (
                  <div
                    className={`text-[10px] p-1.5 rounded-t-xl mb-0.5 border max-w-[85%] opacity-80 ${
                      isMe
                        ? 'bg-purple-900/20 border-purple-500/30 text-purple-300 text-right'
                        : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-400 text-left'
                    }`}
                  >
                    <p className="font-bold truncate">↩ {m.replyMessage.senderName}</p>
                    <p className="truncate">{m.replyMessage.message}</p>
                  </div>
                )}

                <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%] group">
                  {/* Multi-select Circular Checkbox (WhatsApp Web Style) */}
                  {isSelectMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectMsg(m.id);
                      }}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all mb-2 shrink-0 ${
                        selectedMsgIds.has(m.id)
                          ? 'bg-purple-600 border-purple-600 text-white scale-110'
                          : 'border-zinc-300 dark:border-zinc-700 hover:border-purple-400 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      {selectedMsgIds.has(m.id) && '✓'}
                    </button>
                  )}

                  {!isMe && (
                    <UserAvatar src={avatar} name={name} size="xs" square className="rounded-lg mb-1 shrink-0" />
                  )}

                  <div className="relative flex-1 min-w-0">
                    {/* Message Bubble */}
                    <div
                      onClick={(e) => {
                        if (isSelectMode) {
                          e.stopPropagation();
                          toggleSelectMsg(m.id);
                        }
                      }}
                      className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-2xs relative transition-all ${
                        isMe
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                          : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/80 rounded-bl-xs'
                      } ${selectedMsgIds.has(m.id) ? 'ring-2 ring-purple-500/80 ring-offset-1' : ''}`}
                    >
                      {/* WhatsApp Web Chevron Down Action Menu Trigger (v) */}
                      {!isSelectMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuMsgId((prev) => (prev === m.id ? null : m.id));
                          }}
                          className={`absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 ${
                            isMe ? 'text-white/80 hover:text-white' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                          } cursor-pointer z-10`}
                          title="Opsi Pesan"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}

                      {m.attachmentUrl && (
                        <div className="mb-1.5 rounded-xl overflow-hidden border border-white/20">
                          <img src={m.attachmentUrl} alt="Attachment" className="max-h-48 w-full object-cover" />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap pr-4">{parseRichMessageContent(m.message)}</div>

                      {/* Timestamp & Delivery Indicator */}
                      <div className={`mt-1 flex items-center gap-1 text-[9px] ${isMe ? 'justify-end text-purple-200/80' : 'justify-start text-zinc-400'}`}>
                        {m.isEdited && <span className="text-[8px] opacity-70 italic font-mono">(edited)</span>}
                        <span>{new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span title={m.status === 'READ' ? 'Terbaca' : 'Terkirim'} className="font-bold">
                            {m.status === 'READ' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp Web Popover Dropdown Menu */}
                    {openMenuMsgId === m.id && (() => {
                      const nowSec = Math.floor(Date.now() / 1000);
                      const createdAtSec = m.createdAt < 10000000000 ? m.createdAt : Math.floor(m.createdAt / 1000);
                      const isWithin15Min = nowSec - createdAtSec <= 15 * 60;
                      const canEditMsg = isMe && isWithin15Min && (m.editCount || 0) < 5;
                      const msgIdx = messages.findIndex((msg) => msg.id === m.id);
                      const isNearBottom = msgIdx >= messages.length - 3;
                      const verticalPos = isNearBottom ? 'bottom-full mb-1' : 'top-8';

                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute ${verticalPos} ${isMe ? 'right-0' : 'left-0'} z-[100] w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl py-1 text-xs animate-in zoom-in-95 duration-150`}
                        >
                          {/* Quick Reactions Strip */}
                          <div className="px-2 py-1 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-around">
                            {COMMON_EMOJIS.slice(0, 5).map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => {
                                  handleToggleReaction(m.id, e);
                                  setOpenMenuMsgId(null);
                                }}
                                className="hover:scale-125 transition-transform text-sm cursor-pointer p-0.5"
                              >
                                {e}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(m);
                              setOpenMenuMsgId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-200 cursor-pointer"
                          >
                            <span>↩</span>
                            <span>Balas Pesan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(m.message);
                              setOpenMenuMsgId(null);
                              triggerToast('Pesan berhasil disalin!');
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-200 cursor-pointer"
                          >
                            <span>📋</span>
                            <span>Salin Teks</span>
                          </button>

                          {canEditMsg && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMsg(m);
                                setEditText(m.message);
                                setOpenMenuMsgId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-amber-500/10 flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400 cursor-pointer"
                            >
                              <span>✏️</span>
                              <span>Edit ({5 - (m.editCount || 0)}x tersisa)</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setIsSelectMode(true);
                              setSelectedMsgIds(new Set([m.id]));
                              setOpenMenuMsgId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-indigo-500/10 flex items-center gap-2 font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer"
                          >
                            <span>☑️</span>
                            <span>Pilih Pesan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMsgIds(new Set([m.id]));
                              setDeleteTargetMsgId(m.id);
                              setOpenMenuMsgId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium text-red-600 dark:text-red-400 border-t border-zinc-100 dark:border-zinc-800 cursor-pointer"
                          >
                            <span>🗑️</span>
                            <span>Hapus Pesan</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Reactions Display */}
                {m.reactions && m.reactions.length > 0 && (
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {m.reactions.map((r) => (
                      <span
                        key={r.emoji}
                        className="px-1.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-[10px] border border-zinc-300 dark:border-zinc-700 flex items-center gap-0.5"
                      >
                        <span>{r.emoji}</span>
                        <span className="font-bold text-[9px] text-zinc-500">{r.userIds.length}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/90 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in duration-150 border border-zinc-700">
          {toastMessage}
        </div>
      )}

      {/* Editing Message Banner */}
      {editingMsg && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingMsg || !editText.trim() || submittingEdit) return;
            setSubmittingEdit(true);
            const res = await editDirectMessageAction(editingMsg.id, editText.trim());
            if (res.success) {
              triggerToast('Pesan berhasil diperbarui!');
              setEditingMsg(null);
              setEditText('');
              await fetchMessages();
            } else {
              alert(res.error || 'Gagal mengedit pesan.');
            }
            setSubmittingEdit(false);
          }}
          className="p-2.5 bg-amber-500/10 border-t border-amber-500/20 flex flex-col gap-1.5 text-xs animate-in slide-in-from-bottom-2 duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1">
              <span>✏️ Edit Pesan</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-md font-mono">
                (Sisa {5 - (editingMsg.editCount || 0)}x edit)
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
                const newH = Math.min(Math.max(e.target.scrollHeight, 44), 140);
                e.target.style.height = `${newH}px`;
              }}
              placeholder="Edit pesan Anda..."
              className="flex-1 bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-2xl p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 shadow-xs resize-none min-h-[44px] max-h-[140px] leading-relaxed overflow-y-auto"
            />
            <button
              type="submit"
              disabled={submittingEdit || !editText.trim()}
              className="px-3.5 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-amber-700 disabled:opacity-50 cursor-pointer shrink-0 transition-all"
            >
              Simpan
            </button>
          </div>
        </form>
      )}

      {/* Full Modern Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="relative border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 max-h-[260px] overflow-hidden">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            width="100%"
            height={240}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* Stickers Quick Strip */}
      {showStickers && (
        <div className="p-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {STICKERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSendMessage(s)}
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-lg transition-transform hover:scale-125 shrink-0 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Replying Banner Quote */}
      {replyingTo && (
        <div className="px-3 py-1.5 bg-purple-500/10 border-t border-purple-500/20 text-[10px] flex items-center justify-between text-purple-600 dark:text-purple-400">
          <span className="truncate">
            Replying: &quot;{replyingTo.message}&quot;
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="font-bold text-xs hover:text-purple-400 ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Attachment URL Input Bar */}
      {showAttachmentInput && (
        <div className="p-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1 text-xs">
          <input
            type="text"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            placeholder="Paste gambar/file URL..."
            className="flex-1 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-none focus:border-purple-500"
          />
          <button
            type="button"
            onClick={() => setShowAttachmentInput(false)}
            className="text-zinc-400 text-xs hover:text-zinc-600 px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Message Input Box */}
      <div className="p-2.5 sm:p-2 bg-white dark:bg-[#09090b] border-t border-zinc-200 dark:border-zinc-800 flex items-end gap-1 sm:gap-1.5">
        <div className="flex items-center gap-0.5 shrink-0 pb-1">
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowStickers(false);
            }}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-sm transition-colors cursor-pointer"
            title="Modern Emoji Picker"
          >
            😊
          </button>
          <button
            type="button"
            onClick={() => {
              setShowStickers(!showStickers);
              setShowEmojiPicker(false);
            }}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-sm transition-colors cursor-pointer"
            title="Stickers / Reaction Quick"
          >
            🎨
          </button>
          <button
            type="button"
            onClick={() => setShowAttachmentInput(!showAttachmentInput)}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-sm transition-colors cursor-pointer"
            title="Lampiran Gambar"
          >
            🖼️
          </button>
          <button
            type="button"
            onClick={() => setIsMenuModalOpen(true)}
            className="p-1.5 rounded-xl hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold transition-colors cursor-pointer"
            title="Tag Menu & Sub-Menu Sistem"
          >
            📌
          </button>
        </div>

        <div className="flex-1 relative">
          <MenuHashtagAutocompletePopover
            inputText={inputText}
            onSelectTag={(formattedTag) => {
              setInputText((prev) => {
                const updated = prev.replace(/#([a-zA-Z0-9_\-\s>]*)$/, formattedTag + ' ');
                return updated;
              });
              if (textareaRef.current) textareaRef.current.focus();
            }}
          />
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (isTouchDevice()) return;
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }
            }}
            placeholder="Ketik pesan / ketik # untuk tag menu..."
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 resize-none min-h-[38px] max-h-[160px] leading-relaxed overflow-y-auto scrollbar-thin transition-all"
          />
        </div>

        <div className="shrink-0 pb-0.5">
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={sending || (!inputText.trim() && !attachmentUrl.trim())}
            className="p-2.5 sm:p-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            🚀
          </button>
        </div>
      </div>

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
              setDeleteTargetMsgId('BATCH');
            }}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>🗑️ Hapus</span>
          </button>
        </div>
      )}

      {/* Delete Message Modal */}
      <DeleteMessageModal
        isOpen={Boolean(deleteTargetMsgId)}
        onClose={() => setDeleteTargetMsgId(null)}
        selectedCount={selectedMsgIds.size || 1}
        canDeleteEveryone={(() => {
          if (selectedMsgIds.size === 0) return true;
          const userRole = ((partnerInfo as any)?.userType || '').toUpperCase();
          const isAdmin = ['ADMIN', 'SUPERADMIN', 'EXECUTIVE'].includes(userRole);
          if (isAdmin) return true;

          const nowSec = Math.floor(Date.now() / 1000);
          return Array.from(selectedMsgIds).every((id) => {
            const target = messages.find((m) => m.id === id);
            if (!target) return false;
            const createdAtSec = target.createdAt < 10000000000 ? target.createdAt : Math.floor(target.createdAt / 1000);
            return target.senderId !== partnerInfo?.id && (nowSec - createdAtSec <= 15 * 60);
          });
        })()}
        onConfirmEveryone={async () => {
          if (!deleteTargetMsgId) return;
          setSubmittingDeleteMsg(true);
          try {
            const ids = Array.from(selectedMsgIds);
            for (const id of ids) {
              await deleteDirectMessageEveryoneAction(id);
            }
            triggerToast(`${ids.length} pesan dihapus untuk semua orang`);
            setDeleteTargetMsgId(null);
            setIsSelectMode(false);
            setSelectedMsgIds(new Set());
            await fetchMessages();
          } catch (err: any) {
            alert(err.message || 'Gagal menghapus pesan');
          } finally {
            setSubmittingDeleteMsg(false);
          }
        }}
        onConfirmPOV={async () => {
          if (!deleteTargetMsgId) return;
          setSubmittingDeleteMsg(true);
          try {
            const ids = Array.from(selectedMsgIds);
            for (const id of ids) {
              await deleteDirectMessagePOVAction(id);
            }
            triggerToast(`${ids.length} pesan dihapus untuk Anda`);
            setDeleteTargetMsgId(null);
            setIsSelectMode(false);
            setSelectedMsgIds(new Set());
            await fetchMessages();
          } catch (err: any) {
            alert(err.message || 'Gagal menghapus pesan');
          } finally {
            setSubmittingDeleteMsg(false);
          }
        }}
        submitting={submittingDeleteMsg}
      />

      {/* Menu Tag Picker Modal */}
      <MenuTagModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        onSelectMenu={(menu: MenuTagOption) => {
          setInputText((prev) => `${prev} #[${menu.label}](${menu.path}) `.trimStart());
        }}
      />
    </div>
  );
}

export function FloatingMessengerWidget() {
  const { activeChats } = useFloatingMessenger();

  if (!activeChats || activeChats.length === 0) return null;

  return (
    <>
      {activeChats.map((chat, idx) => (
        <SingleChatBox key={chat.partnerId} chat={chat} index={idx} totalChats={activeChats.length} />
      ))}
    </>
  );
}
