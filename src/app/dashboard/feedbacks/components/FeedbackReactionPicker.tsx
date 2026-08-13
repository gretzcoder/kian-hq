'use client';

import { useState, useRef, useEffect } from 'react';
import { FeedbackReaction } from '@/modules/feedback/actions';

interface FeedbackReactionPickerProps {
  reactions: FeedbackReaction[];
  onToggleReaction: (emoji: string) => void;
  isPending?: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '💡', '😂', '🚀', '💯', '🙏', '🎉', '👏', '👀', '✨'];

export default function FeedbackReactionPicker({
  reactions,
  onToggleReaction,
  isPending = false,
}: FeedbackReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  return (
    <div className="relative inline-flex items-center gap-1.5 flex-wrap">
      {/* Existing Reaction Badges (Discord style) */}
      {reactions.map((r) => {
        const tooltipText = r.userNames.length > 0 ? r.userNames.join(', ') : 'Reaksi';
        return (
          <button
            key={r.emoji}
            type="button"
            disabled={isPending}
            onClick={() => onToggleReaction(r.emoji)}
            title={tooltipText}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
              r.hasReacted
                ? 'bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-500/40 hover:bg-purple-500/5'
            }`}
          >
            <span>{r.emoji}</span>
            <span className="text-[11px]">{r.count}</span>
          </button>
        );
      })}

      {/* Add Reaction Button (+ 😀) */}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowPicker(!showPicker)}
          title="Tambah Reaksi Emoji"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/40 bg-zinc-50/50 dark:bg-zinc-900/50 transition-all active:scale-95 cursor-pointer"
        >
          <span>😀</span>
          <span className="text-[10px]">+</span>
        </button>

        {/* Quick Emoji Picker Popover */}
        {showPicker && (
          <div className="absolute left-0 bottom-full mb-1.5 z-40 p-2 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggleReaction(emoji);
                  setShowPicker(false);
                }}
                className="w-7 h-7 rounded-xl hover:bg-purple-500/15 flex items-center justify-center text-sm transition-transform hover:scale-125 cursor-pointer active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
