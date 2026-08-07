'use client';

import { useState } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';

export interface TeamSticker {
  id: string;
  name: string;
  emoji: string;
  badge: string;
  category: string;
}

export const TEAM_STICKERS: TeamSticker[] = [
  { id: 'stk_success', name: 'Success!', emoji: '🎯', badge: 'MISSION ACCOMPLISHED', category: 'Achievement' },
  { id: 'stk_rocket', name: 'To The Moon', emoji: '🚀', badge: 'SPEED FAST TRACK', category: 'Growth' },
  { id: 'stk_fire', name: 'Fire Project', emoji: '🔥', badge: 'HOT & ON FIRE', category: 'Motivation' },
  { id: 'stk_goodjob', name: 'Good Job!', emoji: '👏', badge: 'GREAT COLLABORATION', category: 'Appreciation' },
  { id: 'stk_genius', name: 'Genius Idea', emoji: '💡', badge: 'BRAINSTORM MASTER', category: 'Creative' },
  { id: 'stk_toptier', name: 'Top Tier', emoji: '⭐', badge: 'EXCELLENT QUALITY', category: 'Quality' },
  { id: 'stk_fighting', name: 'Keep Fighting', emoji: '💪', badge: 'DONT GIVE UP', category: 'Support' },
  { id: 'stk_celebrate', name: 'Party Time', emoji: '🎉', badge: 'MILESTONE UNLOCKED', category: 'Celebration' },
  { id: 'stk_teamwork', name: 'Solid Teamwork', emoji: '🤝', badge: 'TROOPERS ASSEMBLE', category: 'Team' },
  { id: 'stk_approved', name: 'Approved!', emoji: '✅', badge: 'READY TO DEPLOY', category: 'Workflow' },
  { id: 'stk_champion', name: 'Champion Choice', emoji: '🏆', badge: 'HALL OF FAME', category: 'Achievement' },
  { id: 'stk_hundred', name: '100% Perfect', emoji: '💯', badge: 'ZERO REVISION', category: 'Quality' },
];

interface EmojiStickerPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (sticker: TeamSticker) => void;
  onClose: () => void;
}

export default function EmojiStickerPicker({
  onSelectEmoji,
  onSelectSticker,
  onClose,
}: EmojiStickerPickerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'sticker'>('emoji');

  return (
    <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-3 w-80 sm:w-96 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-2.5 px-1">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'emoji'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            ✨ Emoji
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sticker')}
            className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'sticker'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            🎨 Stiker Tim
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center text-xs font-bold transition-all"
        >
          ✕
        </button>
      </div>

      {/* Tab Content */}
      <div className="h-72 overflow-y-auto">
        {activeTab === 'emoji' ? (
          <div className="w-full h-full overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-900">
            <EmojiPicker
              onEmojiClick={(data) => {
                onSelectEmoji(data.emoji);
              }}
              width="100%"
              height="280px"
              theme={Theme.AUTO}
              searchPlaceHolder="Cari emoji..."
              previewConfig={{ showPreview: false }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 p-1">
            {TEAM_STICKERS.map((stk) => (
              <button
                key={stk.id}
                type="button"
                onClick={() => {
                  onSelectSticker(stk);
                  onClose();
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all hover:scale-105 active:scale-95 group cursor-pointer"
              >
                <span className="text-3xl mb-1 group-hover:rotate-12 transition-transform">{stk.emoji}</span>
                <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight text-center">
                  {stk.name}
                </span>
                <span className="text-[8px] font-black uppercase text-purple-600 dark:text-purple-400 mt-1 tracking-wider">
                  {stk.badge}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
