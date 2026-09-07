'use client';

import React, { useState, useRef } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import { parseRichMessageContent } from '@/lib/menuTagging';
import { PollCard, parsePollPayload } from './PollCard';
import { MobileMessageActionSheet } from './MobileMessageActionSheet';

export interface ReactionItem {
  emoji: string;
  userIds?: string[];
  count?: number;
  hasReacted?: boolean;
}

export interface CompactMessageBubbleProps {
  id: string;
  isMe: boolean;
  showSenderHeader: boolean;
  senderName: string;
  senderAvatar?: string | null;
  senderRole?: string | null;
  senderColor?: string | null;
  message: string;
  attachmentUrl?: string | null;
  replyMessage?: {
    id?: string;
    senderName: string;
    message: string;
  } | null;
  reactions?: ReactionItem[];
  status?: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: number | string;
  isEdited?: boolean;
  editCount?: number;
  isPinned?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  currentUserId?: string;
  onVotePoll?: (msgId: string, optionId: string) => void;
  onToggleSelect?: (id: string) => void;
  onToggleReaction?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onCopy?: (text: string) => void;
  onEdit?: (id: string) => void;
  onPin?: (id: string) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canPin?: boolean;
  canDelete?: boolean;
  memberList?: any[];
  onSelectMember?: (member: any) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '👏', '🙌'];

function formatTime(val: number | string): string {
  try {
    let d: Date;
    if (typeof val === 'number') {
      d = new Date(val > 1e11 ? val : val * 1000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

export function CompactMessageBubble({
  id,
  isMe,
  showSenderHeader,
  senderName,
  senderAvatar,
  senderRole,
  senderColor,
  message,
  attachmentUrl,
  replyMessage,
  reactions = [],
  status = 'SENT',
  createdAt,
  isEdited = false,
  isPinned = false,
  isSelectMode = false,
  isSelected = false,
  currentUserId,
  onVotePoll,
  onToggleSelect,
  onToggleReaction,
  onReply,
  onCopy,
  onEdit,
  onPin,
  onDelete,
  canEdit = false,
  canPin = false,
  canDelete = false,
  memberList,
  onSelectMember,
}: CompactMessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  // Touch Gesture States
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeActivated, setSwipeActivated] = useState(false);
  const [isScalePressed, setIsScalePressed] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalScrollRef = useRef<boolean | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const timeStr = formatTime(createdAt);
  const pollData = parsePollPayload(message);

  // Clear long press timer safely
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsScalePressed(false);
  };

  // Touch Start Handler
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSelectMode) return;
    const touch = e.touches[0];
    if (!touch) return;

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isHorizontalScrollRef.current = null;
    setSwipeActivated(false);

    // Double tap detection
    const now = Date.now();
    if (now - lastTapTimeRef.current < 300) {
      // Double tap triggered -> quick reaction ❤️
      clearLongPressTimer();
      onToggleReaction?.(id, '❤️');
      setShowHeartAnim(true);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(30);
      }
      setTimeout(() => setShowHeartAnim(false), 800);
      lastTapTimeRef.current = 0;
      return;
    }
    lastTapTimeRef.current = now;

    // Start Long Press Timer (400ms)
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setIsScalePressed(true);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(45);
      }
      setShowMobileSheet(true);
    }, 400);
  };

  // Touch Move Handler
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    const diffX = touch.clientX - touchStartXRef.current;
    const diffY = touch.clientY - touchStartYRef.current;

    // Determine direction intent early
    if (isHorizontalScrollRef.current === null) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 6) {
        isHorizontalScrollRef.current = true;
      } else if (Math.abs(diffY) > 8) {
        isHorizontalScrollRef.current = false;
      }
    }

    // Cancel long press if finger moved significantly
    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      clearLongPressTimer();
    }

    // Process horizontal swipe to reply
    if (isHorizontalScrollRef.current && diffX > 0) {
      setIsSwiping(true);
      // Cap max drag to 80px with resistance curve
      const clampedOffset = Math.min(80, diffX * 0.7);
      setSwipeOffset(clampedOffset);

      if (clampedOffset >= 50 && !swipeActivated) {
        setSwipeActivated(true);
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(30);
        }
      } else if (clampedOffset < 50 && swipeActivated) {
        setSwipeActivated(false);
      }
    }
  };

  // Touch End / Cancel Handler
  const handleTouchEnd = () => {
    clearLongPressTimer();

    if (swipeActivated) {
      onReply?.(id);
    }

    // Reset touch physics state smoothly
    setIsSwiping(false);
    setSwipeOffset(0);
    setSwipeActivated(false);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalScrollRef.current = null;
  };

  return (
    <div
      id={`msg_${id}`}
      className={`group relative flex flex-col w-full select-none ${
        isMe ? 'items-end' : 'items-start'
      } ${showSenderHeader ? 'mt-3' : 'mt-0.5'}`}
    >
      {/* Optional Pinned Tag Banner */}
      {isPinned && (
        <div className={`text-[9px] font-black uppercase text-amber-400 flex items-center gap-1 mb-0.5 ${isMe ? 'pr-2' : 'pl-10'}`}>
          <span>📌 Tersemat</span>
        </div>
      )}

      {/* Swipe-to-Reply Trigger Icon Indicator (Left side of bubble during drag) */}
      {swipeOffset > 10 && (
        <div
          style={{ transform: `scale(${Math.min(1.2, swipeOffset / 40)})` }}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-75 ${
            swipeActivated
              ? 'bg-purple-600 text-white shadow-lg scale-110'
              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
          }`}
        >
          <span className="text-sm font-bold">↩</span>
        </div>
      )}

      {/* Main Container Row */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className={`flex items-end gap-2 max-w-[90%] sm:max-w-[78%] group/row relative touch-pan-y ${
          isScalePressed ? 'scale-[1.02] transition-transform duration-200' : ''
        }`}
      >
        {/* Multi-select Circular Checkbox */}
        {isSelectMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(id);
            }}
            className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all mb-1 shrink-0 ${
              isSelected
                ? 'bg-purple-600 border-purple-600 text-white scale-110'
                : 'border-zinc-700 hover:border-purple-400 bg-zinc-900'
            }`}
          >
            {isSelected && '✓'}
          </button>
        )}

        {/* Sender Avatar Column */}
        {!isMe && (
          <div className="w-7 h-7 shrink-0 mb-0.5">
            {showSenderHeader ? (
              <UserAvatar
                name={senderName}
                src={senderAvatar}
                size="sm"
                className="ring-1 ring-white/10"
              />
            ) : (
              <div className="w-7" />
            )}
          </div>
        )}

        {/* Message Bubble Body */}
        <div className={`flex flex-col min-w-0 w-fit max-w-full relative group/bubble ${isMe ? 'items-end' : 'items-start'}`}>
          {/* Sender Header Name & Role */}
          {showSenderHeader && !isMe && (
            <div className="flex items-center gap-1.5 mb-1 pl-1 text-[11px] font-semibold tracking-wide">
              <span className={senderColor || 'text-purple-400'}>{senderName}</span>
              {senderRole && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/50 font-normal">
                  {senderRole}
                </span>
              )}
            </div>
          )}

          {/* Floating Heart Pop Animation (Double Tap) */}
          {showHeartAnim && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-out duration-700">
              <span className="text-4xl drop-shadow-2xl animate-bounce">❤️</span>
            </div>
          )}

          {/* Actual Bubble Box */}
          <div
            onContextMenu={(e) => {
              e.preventDefault();
              setShowMenu(true);
            }}
            className={`relative px-3 py-2 w-fit max-w-full transition-all shadow-sm break-words ${
              isMe
                ? 'bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 text-white rounded-[18px] rounded-tr-xs shadow-purple-950/20'
                : 'bg-zinc-900/90 border border-zinc-800/90 text-zinc-100 rounded-[18px] rounded-tl-xs shadow-black/40'
            } ${isSelected ? 'ring-2 ring-purple-400' : ''}`}
          >
            {/* Embedded Reply Preview Header */}
            {replyMessage && (
              <div
                className={`mb-1.5 px-2.5 py-1 rounded-xl text-xs border-l-3 ${
                  isMe
                    ? 'bg-black/20 border-purple-300 text-purple-100'
                    : 'bg-zinc-950/80 border-purple-500 text-zinc-300'
                }`}
              >
                <div className="text-[10px] font-bold opacity-90 text-purple-300">{replyMessage.senderName}</div>
                <div className="truncate text-[11px] opacity-80">{replyMessage.message}</div>
              </div>
            )}

            {/* Poll Card or Text Content */}
            {pollData ? (
              <PollCard
                poll={pollData}
                messageId={id}
                currentUserId={currentUserId}
                onVote={(optId) => onVotePoll?.(id, optId)}
              />
            ) : (
              <>
                {/* Image Attachment Preview */}
                {attachmentUrl && (
                  <div className="mb-1.5 rounded-xl overflow-hidden border border-white/10 max-w-xs">
                    <img src={attachmentUrl} alt="Attachment" className="max-h-56 w-full object-cover rounded-xl" />
                  </div>
                )}

                {/* Parsed Message Content */}
                <div className="whitespace-pre-wrap text-[13px] sm:text-xs leading-relaxed break-words">
                  {parseRichMessageContent(message, { memberList, onSelectMember })}
                </div>

                {/* Inline Compact Timestamp & Read Ticks */}
                <div
                  className={`mt-0.5 flex items-center gap-1 text-[9px] ${
                    isMe ? 'justify-end text-purple-200/70' : 'justify-start text-zinc-400'
                  }`}
                >
                  {isEdited && <span className="text-[8px] opacity-70 italic font-mono">(edited)</span>}
                  <span>{timeStr}</span>
                  {isMe && (
                    <span title={status === 'READ' ? 'Terbaca' : 'Terkirim'} className="font-bold">
                      {status === 'READ' ? (
                        <span className="text-cyan-300">✓✓</span>
                      ) : (
                        <span>✓</span>
                      )}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Desktop Hover Quick Action Bar */}
            <div
              className={`absolute -top-3.5 ${
                isMe ? 'left-1' : 'right-1'
              } z-20 hidden sm:flex items-center gap-0.5 bg-zinc-900/90 dark:bg-zinc-800/95 border border-zinc-700/70 dark:border-zinc-700 rounded-full px-1.5 py-0.5 shadow-lg backdrop-blur-md opacity-0 group-hover/bubble:opacity-100 transition-all duration-150`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReaction?.(id, '❤️');
                }}
                className="p-1 hover:scale-125 transition-transform text-xs text-zinc-300 hover:text-red-400 cursor-pointer"
                title="Suka (❤️)"
              >
                ❤️
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReaction?.(id, '👍');
                }}
                className="p-1 hover:scale-125 transition-transform text-xs text-zinc-300 hover:text-amber-400 cursor-pointer"
                title="Setuju (👍)"
              >
                👍
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReply?.(id);
                }}
                className="p-1 hover:bg-white/10 rounded-full text-zinc-300 hover:text-purple-400 transition-colors cursor-pointer text-xs"
                title="Balas Pesan"
              >
                ↩
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className="p-1 hover:bg-white/10 rounded-full text-zinc-300 hover:text-white transition-colors cursor-pointer text-xs"
                title="Opsi Lainnya"
              >
                •••
              </button>
            </div>

            {/* Glass Dropdown Popover Action Menu (Desktop / Context Menu) */}
            {showMenu && (
              <>
                {/* Full-screen invisible backdrop to dismiss on click outside */}
                <div
                  className="fixed inset-0 z-[110]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setShowMenu(false);
                  }}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-full mt-1.5 ${
                    isMe ? 'right-0' : 'left-0'
                  } z-[120] w-48 bg-zinc-900/98 border border-zinc-700/80 rounded-2xl shadow-2xl backdrop-blur-2xl py-1 text-xs animate-in zoom-in-95 duration-150 ring-1 ring-white/10`}
                >
                  {/* Quick Reactions Bar */}
                  <div className="px-2 py-1.5 border-b border-zinc-800 flex items-center justify-around">
                    {COMMON_EMOJIS.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onToggleReaction?.(id, emoji);
                          setShowMenu(false);
                        }}
                        className="hover:scale-125 transition-transform p-1 text-base cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onReply?.(id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-zinc-800/80 flex items-center gap-2.5 font-medium text-zinc-200 cursor-pointer"
                  >
                    <span>↩</span>
                    <span>Balas Pesan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onCopy?.(message);
                      setShowMenu(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-zinc-800/80 flex items-center gap-2.5 font-medium text-zinc-200 cursor-pointer"
                  >
                    <span>📋</span>
                    <span>Salin Teks</span>
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        onEdit?.(id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-amber-500/10 flex items-center gap-2.5 font-medium text-amber-400 cursor-pointer"
                    >
                      <span>✏️</span>
                      <span>Edit Pesan</span>
                    </button>
                  )}

                  {canPin && (
                    <button
                      type="button"
                      onClick={() => {
                        onPin?.(id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-amber-500/10 flex items-center gap-2.5 font-medium text-amber-400 cursor-pointer"
                    >
                      <span>📌</span>
                      <span>{isPinned ? 'Lepas Sematan' : 'Sematkan Pesan'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onToggleSelect?.(id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-indigo-500/10 flex items-center gap-2.5 font-medium text-indigo-400 cursor-pointer"
                  >
                    <span>☑️</span>
                    <span>Pilih Pesan</span>
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete?.(id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-red-950/40 flex items-center gap-2.5 font-medium text-red-400 border-t border-zinc-800 cursor-pointer"
                    >
                      <span>🗑️</span>
                      <span>Hapus Pesan</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Reaction Pills below bubble */}
          {reactions && reactions.length > 0 && (
            <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {reactions.map((r) => {
                const cnt = r.count !== undefined ? r.count : (r.userIds?.length || 0);
                if (cnt <= 0) return null;
                return (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={() => onToggleReaction?.(id, r.emoji)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 transition-transform hover:scale-105 cursor-pointer backdrop-blur-md ${
                      r.hasReacted
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="font-bold text-[9px]">{cnt}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Action Sheet Drawer (Triggered by Long Press / Hold) */}
      <MobileMessageActionSheet
        isOpen={showMobileSheet}
        onClose={() => setShowMobileSheet(false)}
        messageId={id}
        isMe={isMe}
        messageText={message}
        senderName={senderName}
        senderAvatar={senderAvatar}
        timeStr={timeStr}
        reactions={reactions}
        isPinned={isPinned}
        isSelectMode={isSelectMode}
        canEdit={canEdit}
        canPin={canPin}
        canDelete={canDelete}
        onToggleReaction={onToggleReaction}
        onReply={onReply}
        onCopy={onCopy}
        onEdit={onEdit}
        onPin={onPin}
        onToggleSelect={onToggleSelect}
        onDelete={onDelete}
      />
    </div>
  );
}
