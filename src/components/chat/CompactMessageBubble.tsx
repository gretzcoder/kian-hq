'use client';

import React, { useState } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import { parseRichMessageContent } from '@/lib/menuTagging';
import { PollCard, parsePollPayload } from './PollCard';

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
  const timeStr = formatTime(createdAt);
  const pollData = parsePollPayload(message);

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

      {/* Main Container Row */}
      <div className="flex items-end gap-2 max-w-[90%] sm:max-w-[78%] group/row relative">
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
                src={senderAvatar}
                name={senderName}
                size="sm"
                square={false}
                className="w-7 h-7 rounded-full ring-2 ring-purple-500/20 shadow-xs"
              />
            ) : (
              <div className="w-7 h-7" />
            )}
          </div>
        )}

        {/* Bubble & Details Column */}
        <div className="relative flex-1 min-w-0">
          {/* Sender Name & Role Header */}
          {!isMe && showSenderHeader && (
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[11px] font-bold text-zinc-300 truncate">
                {senderName}
              </span>
              {senderRole && (
                <span
                  style={{ backgroundColor: senderColor ? `${senderColor}20` : undefined, color: senderColor || undefined }}
                  className="text-[8.5px] font-medium uppercase tracking-wider px-1.5 py-0.2 rounded-full border border-purple-500/20 text-purple-300 bg-purple-950/40"
                >
                  {senderRole}
                </span>
              )}
            </div>
          )}

          {/* Quoted Reply Snippet */}
          {replyMessage && (
            <div
              className={`text-[10px] px-3 py-1.5 rounded-t-2xl mb-0.5 border-l-2 max-w-full opacity-90 backdrop-blur-md ${
                isMe
                  ? 'bg-purple-950/60 border-purple-400 text-purple-200'
                  : 'bg-zinc-800/90 border-purple-500 text-zinc-300'
              }`}
            >
              <p className="font-bold truncate text-[10px] text-purple-300">↩ {replyMessage.senderName}</p>
              <p className="truncate line-clamp-1 opacity-80">{replyMessage.message}</p>
            </div>
          )}

          {/* Main Bubble Box */}
          <div
            onClick={(e) => {
              if (isSelectMode) {
                e.stopPropagation();
                onToggleSelect?.(id);
              }
            }}
            className={`px-3.5 py-2 text-xs leading-relaxed break-words relative transition-all group/bubble ${
              pollData
                ? 'p-0 bg-transparent border-0'
                : isMe
                ? `bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md ${
                    showSenderHeader ? 'rounded-[18px] rounded-tr-xs' : 'rounded-[18px]'
                  }`
                : `bg-[#18181b] border border-zinc-800/90 text-zinc-100 ${
                    showSenderHeader ? 'rounded-[18px] rounded-tl-xs' : 'rounded-[18px]'
                  }`
            } ${isSelected ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950' : ''}`}
          >
            {/* Popover Chevron Action Menu Trigger */}
            {!isSelectMode && !pollData && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className={`absolute top-1.5 right-1.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1 rounded-full hover:bg-black/20 ${
                  isMe ? 'text-white/80 hover:text-white' : 'text-zinc-400 hover:text-zinc-200'
                } cursor-pointer z-10`}
                title="Opsi Pesan"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Poll Card or Standard Message */}
            {pollData ? (
              <PollCard
                poll={pollData}
                currentUserId={currentUserId || ''}
                onVote={(optionId) => onVotePoll?.(id, optionId)}
                isMe={isMe}
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
                <div className="whitespace-pre-wrap pr-3 text-[13px] sm:text-xs">
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

            {/* Glass Dropdown Popover Action Menu */}
            {showMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-8 ${
                  isMe ? 'right-0' : 'left-0'
                } z-[120] w-48 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl py-1 text-xs animate-in zoom-in-95 duration-150`}
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
                      className="hover:scale-125 transition-transform text-sm cursor-pointer p-0.5"
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
                  className="w-full px-3.5 py-2 text-left hover:bg-zinc-800/80 flex items-center gap-2 font-medium text-zinc-200 cursor-pointer"
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
                  className="w-full px-3.5 py-2 text-left hover:bg-zinc-800/80 flex items-center gap-2 font-medium text-zinc-200 cursor-pointer"
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
                    className="w-full px-3.5 py-2 text-left hover:bg-amber-500/10 flex items-center gap-2 font-medium text-amber-400 cursor-pointer"
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
                    className="w-full px-3.5 py-2 text-left hover:bg-amber-500/10 flex items-center gap-2 font-medium text-amber-400 cursor-pointer"
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
                  className="w-full px-3.5 py-2 text-left hover:bg-indigo-500/10 flex items-center gap-2 font-medium text-indigo-400 cursor-pointer"
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
                    className="w-full px-3.5 py-2 text-left hover:bg-red-950/40 flex items-center gap-2 font-medium text-red-400 border-t border-zinc-800 cursor-pointer"
                  >
                    <span>🗑️</span>
                    <span>Hapus Pesan</span>
                  </button>
                )}
              </div>
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
    </div>
  );
}
