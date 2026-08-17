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
  DirectMessage,
} from '../dmActions';
import { respondFriendRequestAction, getFriendshipStatusAction, FriendshipStatus } from '@/modules/friends/friendActions';
import UserAvatar from '@/components/ui/UserAvatar';
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [sending, setSending] = useState(false);

  // Active message action popup state (triggered on Press & Hold / Long Press / Click)
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const touchTimer = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!partnerId) return;
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

      const interval = setInterval(fetchMessages, 3000);
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

                <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[85%]">
                  {!isMe && (
                    <UserAvatar src={avatar} name={name} size="xs" square className="rounded-lg mb-1 shrink-0" />
                  )}

                  <div className="relative">
                    {/* Message Bubble (Supports Press & Hold / Long-press on mobile and Desktop click) */}
                    <div
                      onTouchStart={() => handleTouchStart(m.id)}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={() => handleTouchStart(m.id)}
                      onMouseUp={handleTouchEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveActionMsgId((prev) => (prev === m.id ? null : m.id));
                      }}
                      className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-2xs cursor-pointer transition-all ${
                        isMe
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                          : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/80 rounded-bl-xs'
                      }`}
                    >
                      {m.attachmentUrl && (
                        <div className="mb-1.5 rounded-xl overflow-hidden border border-white/20">
                          <img src={m.attachmentUrl} alt="Attachment" className="max-h-48 w-full object-cover" />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{m.message}</p>

                      {/* Timestamp & Delivery Indicator */}
                      <div className={`mt-1 flex items-center gap-1 text-[9px] ${isMe ? 'justify-end text-purple-200/80' : 'justify-start text-zinc-400'}`}>
                        <span>{new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span title={m.status === 'READ' ? 'Terbaca' : 'Terkirim'} className="font-bold">
                            {m.status === 'READ' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Bar (Triggered by Press & Hold / Click) */}
                    {isActionActive && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute -top-9 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-2.5 py-1 shadow-xl z-20 animate-in zoom-in-95 duration-150`}
                      >
                        {COMMON_EMOJIS.slice(0, 5).map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => handleToggleReaction(m.id, e)}
                            className="hover:scale-125 transition-transform text-sm cursor-pointer p-0.5"
                          >
                            {e}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(m);
                            setActiveActionMsgId(null);
                          }}
                          className="text-[10px] bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full hover:bg-purple-700 ml-1 cursor-pointer"
                        >
                          ↩ Reply
                        </button>
                      </div>
                    )}
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
      <div className="p-2.5 sm:p-2 bg-white dark:bg-[#09090b] border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
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

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          placeholder="Ketik pesan (tekan & tahan bubble untuk reply)..."
          className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 sm:py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={sending || (!inputText.trim() && !attachmentUrl.trim())}
          className="p-2.5 sm:p-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          🚀
        </button>
      </div>
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
