'use client';

import React, { useEffect } from 'react';
import UserAvatar from '@/components/ui/UserAvatar';

export interface MobileMessageActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  isMe: boolean;
  messageText: string;
  senderName: string;
  senderAvatar?: string | null;
  timeStr: string;
  reactions?: Array<{ emoji: string; count?: number; hasReacted?: boolean }>;
  isPinned?: boolean;
  isSelectMode?: boolean;
  canEdit?: boolean;
  canPin?: boolean;
  canDelete?: boolean;
  onToggleReaction?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onCopy?: (text: string) => void;
  onEdit?: (id: string) => void;
  onPin?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const EMOJI_PALETTE = ['👍', '❤️', '🔥', '😂', '🎉', '👏', '🙌', '😮', '😢', '🙏'];

export function MobileMessageActionSheet({
  isOpen,
  onClose,
  messageId,
  isMe,
  messageText,
  senderName,
  senderAvatar,
  timeStr,
  reactions = [],
  isPinned = false,
  canEdit = false,
  canPin = false,
  canDelete = false,
  onToggleReaction,
  onReply,
  onCopy,
  onEdit,
  onPin,
  onToggleSelect,
  onDelete,
}: MobileMessageActionSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Bottom Sheet Container */}
      <div className="relative w-full max-w-lg bg-zinc-950/95 border-t sm:border border-zinc-800/90 rounded-t-3xl sm:rounded-3xl p-4 shadow-2xl backdrop-blur-2xl z-10 animate-in slide-in-from-bottom duration-250 flex flex-col gap-4 text-zinc-100 max-h-[85vh] overflow-y-auto">
        {/* Grab Handle Header */}
        <div className="flex flex-col items-center gap-2 pt-1 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-zinc-700/80" />
        </div>

        {/* Message Preview Box */}
        <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 flex items-start gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden">
            <UserAvatar name={senderName} src={senderAvatar} size="md" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-xs font-bold text-purple-400 truncate">{senderName}</span>
              <span className="text-[10px] text-zinc-500 font-mono">{timeStr}</span>
            </div>
            <p className="text-xs text-zinc-200 line-clamp-3 whitespace-pre-wrap">{messageText}</p>
          </div>
        </div>

        {/* Quick Emoji Reactions Horizontal Scroll Strip */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 no-scrollbar border-y border-zinc-800/80">
          {EMOJI_PALETTE.map((emoji) => {
            const rx = reactions.find((r) => r.emoji === emoji);
            const hasReacted = rx?.hasReacted;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggleReaction?.(messageId, emoji);
                  onClose();
                }}
                className={`w-11 h-11 shrink-0 rounded-full text-xl flex items-center justify-center transition-transform active:scale-125 cursor-pointer ${
                  hasReacted
                    ? 'bg-purple-600/30 border-2 border-purple-500 shadow-lg shadow-purple-500/20 scale-105'
                    : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>

        {/* Vertical Touch Action List */}
        <div className="flex flex-col gap-1 pb-2">
          <button
            type="button"
            onClick={() => {
              onReply?.(messageId);
              onClose();
            }}
            className="w-full h-12 px-4 rounded-xl hover:bg-zinc-900 active:bg-zinc-800 flex items-center gap-3 text-sm font-medium text-zinc-200 cursor-pointer"
          >
            <span className="text-lg">↩</span>
            <span>Balas Pesan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onCopy?.(messageText);
              onClose();
            }}
            className="w-full h-12 px-4 rounded-xl hover:bg-zinc-900 active:bg-zinc-800 flex items-center gap-3 text-sm font-medium text-zinc-200 cursor-pointer"
          >
            <span className="text-lg">📋</span>
            <span>Salin Teks</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                onEdit?.(messageId);
                onClose();
              }}
              className="w-full h-12 px-4 rounded-xl hover:bg-amber-500/10 active:bg-amber-500/20 flex items-center gap-3 text-sm font-medium text-amber-400 cursor-pointer"
            >
              <span className="text-lg">✏️</span>
              <span>Edit Pesan</span>
            </button>
          )}

          {canPin && (
            <button
              type="button"
              onClick={() => {
                onPin?.(messageId);
                onClose();
              }}
              className="w-full h-12 px-4 rounded-xl hover:bg-amber-500/10 active:bg-amber-500/20 flex items-center gap-3 text-sm font-medium text-amber-400 cursor-pointer"
            >
              <span className="text-lg">📌</span>
              <span>{isPinned ? 'Lepas Sematan' : 'Sematkan Pesan'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onToggleSelect?.(messageId);
              onClose();
            }}
            className="w-full h-12 px-4 rounded-xl hover:bg-indigo-500/10 active:bg-indigo-500/20 flex items-center gap-3 text-sm font-medium text-indigo-400 cursor-pointer"
          >
            <span className="text-lg">☑️</span>
            <span>Pilih Pesan</span>
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete?.(messageId);
                onClose();
              }}
              className="w-full h-12 px-4 rounded-xl hover:bg-red-950/40 active:bg-red-950/70 flex items-center gap-3 text-sm font-medium text-red-400 border-t border-zinc-900 cursor-pointer mt-1"
            >
              <span className="text-lg">🗑️</span>
              <span>Hapus Pesan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
