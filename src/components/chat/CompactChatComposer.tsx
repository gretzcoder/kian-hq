'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { EmojiClickData } from 'emoji-picker-react';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

export interface StickerOption {
  id: string;
  emoji: string;
  name: string;
  icon?: string;
  label?: string;
  tag?: string;
  bg?: string;
}

export interface CompactChatComposerProps {
  onSend: (text: string, attachmentUrl?: string) => Promise<void> | void;
  onSendSticker?: (sticker: StickerOption) => void;
  replyingTo?: { id?: string; senderName: string; message: string } | null;
  onCancelReply?: () => void;
  placeholder?: string;
  stickers?: StickerOption[];
  memberList?: any[];
  disabled?: boolean;
}

export function CompactChatComposer({
  onSend,
  onSendSticker,
  replyingTo,
  onCancelReply,
  placeholder = 'Tulis pesan...',
  stickers = [],
  memberList = [],
  disabled = false,
}: CompactChatComposerProps) {
  const [text, setText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [sending, setSending] = useState(false);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 40), 160);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Mention Detector (@)
    const cursor = e.target.selectionStart || val.length;
    const beforeCursor = val.slice(0, cursor);
    const atMatch = beforeCursor.match(/@([\w\s]*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionIndex(beforeCursor.lastIndexOf('@'));
    } else {
      setMentionQuery(null);
      setMentionIndex(-1);
    }
  };

  const insertMention = (member: any) => {
    const memberName = member.name || member.email || 'user';
    if (mentionIndex >= 0) {
      const before = text.slice(0, mentionIndex);
      const after = text.slice(textareaRef.current?.selectionStart || text.length);
      setText(`${before}@${memberName} ${after}`);
    } else {
      setText((prev) => `${prev} @${memberName} `);
    }
    setMentionQuery(null);
    setMentionIndex(-1);
    textareaRef.current?.focus();
  };

  const handleFormSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !attachmentUrl) || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed, attachmentUrl.trim() || undefined);
      setText('');
      setAttachmentUrl('');
      setShowUrlModal(false);
      setShowEmojiPicker(false);
      setShowStickerPicker(false);
      setMentionQuery(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const filteredMembers =
    mentionQuery !== null && Array.isArray(memberList)
      ? memberList.filter((m) => m && m.name && String(m.name).toLowerCase().includes(mentionQuery))
      : [];

  return (
    <div className="relative w-full bg-white dark:bg-[#09090b] border-t border-zinc-200/90 dark:border-zinc-800/90 p-2 sm:p-3 shrink-0 select-none">
      {/* Mention Autocomplete Popover */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2 z-[130] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 max-h-48 overflow-y-auto space-y-1 animate-in fade-in duration-150">
          <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Mention Member (@)
          </div>
          {filteredMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => insertMention(m)}
              className="w-full px-3 py-1.5 rounded-xl hover:bg-purple-500/10 dark:hover:bg-purple-900/30 text-left flex items-center justify-between gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              <span className="truncate">@{m.name}</span>
              <span className="text-[10px] font-normal text-zinc-400 truncate">{m.role || m.email}</span>
            </button>
          ))}
        </div>
      )}

      {/* Replying-to Banner */}
      {replyingTo && (
        <div className="mb-2 p-2 bg-purple-500/10 border-l-4 border-purple-500 rounded-xl flex items-center justify-between gap-2 text-xs animate-in slide-in-from-bottom-2 duration-150">
          <div className="min-w-0 flex-1">
            <span className="font-bold text-purple-600 dark:text-purple-400 text-[11px] block">
              ↩ Membalas {replyingTo.senderName}
            </span>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate">{replyingTo.message}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="w-6 h-6 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center font-bold text-xs cursor-pointer"
            title="Batal membalas"
          >
            ✕
          </button>
        </div>
      )}

      {/* URL Attachment Preview Chip */}
      {attachmentUrl && (
        <div className="mb-2 p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 truncate font-mono">
            🔗 {attachmentUrl}
          </span>
          <button
            type="button"
            onClick={() => setAttachmentUrl('')}
            className="text-indigo-400 hover:text-red-500 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-2 sm:left-4 z-[140] mb-2 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-900 max-w-sm w-[320px]">
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Emoji Picker</span>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              className="text-zinc-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          </div>
          <EmojiPicker onEmojiClick={onEmojiClick} width="100%" height={260} previewConfig={{ showPreview: false }} />
        </div>
      )}

      {/* Sticker Picker Popover */}
      {showStickerPicker && stickers.length > 0 && (
        <div className="absolute bottom-full left-2 sm:left-4 z-[140] mb-2 p-3 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl bg-white dark:bg-zinc-900 w-[300px] space-y-2 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <span className="text-xs font-black text-purple-600 dark:text-purple-400">✨ Stiker Ekspresi</span>
            <button
              type="button"
              onClick={() => setShowStickerPicker(false)}
              className="text-zinc-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
            {stickers.map((stk) => (
              <button
                key={stk.id}
                type="button"
                onClick={() => {
                  onSendSticker?.(stk);
                  setShowStickerPicker(false);
                }}
                className="p-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-500/20 hover:scale-110 transition-all text-xl flex items-center justify-center cursor-pointer"
                title={stk.name || stk.label}
              >
                {stk.emoji || stk.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* URL Link Input Dialog Popover */}
      {showUrlModal && (
        <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-4 z-[140] mb-2 p-3 bg-white dark:bg-zinc-900 border border-purple-500/30 rounded-2xl shadow-2xl space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">🔗 Bagikan Link External / Gambar</span>
            <button
              type="button"
              onClick={() => setShowUrlModal(false)}
              className="text-zinc-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          </div>
          <input
            type="url"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500 text-zinc-900 dark:text-zinc-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUrlModal(false)}
              className="px-3 py-1 bg-purple-600 text-white font-bold text-xs rounded-lg hover:bg-purple-700 cursor-pointer"
            >
              Simpan Link
            </button>
          </div>
        </div>
      )}

      {/* Composer Input Bar Form */}
      <form onSubmit={handleFormSubmit} className="flex items-end gap-2">
        {/* Quick Action Buttons Left */}
        <div className="flex items-center gap-1 mb-1">
          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker((prev) => !prev);
              setShowStickerPicker(false);
              setShowUrlModal(false);
            }}
            className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-sm transition-all cursor-pointer"
            title="Pilih Emoji"
          >
            😊
          </button>

          {/* Sticker Toggle */}
          {stickers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowStickerPicker((prev) => !prev);
                setShowEmojiPicker(false);
                setShowUrlModal(false);
              }}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-sm transition-all cursor-pointer"
              title="Pilih Stiker Ekspresi"
            >
              ✨
            </button>
          )}

          {/* Link URL Attachment Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowUrlModal((prev) => !prev);
              setShowEmojiPicker(false);
              setShowStickerPicker(false);
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
              attachmentUrl
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
            }`}
            title="Bagikan URL Link / Gambar External"
          >
            🔗
          </button>
        </div>

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleFormSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-2.5 sm:p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 shadow-2xs resize-none min-h-[40px] max-h-[160px] leading-relaxed overflow-y-auto transition-colors"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!text.trim() && !attachmentUrl) || sending || disabled}
          className="w-10 h-10 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shrink-0 mb-0.5"
          title="Kirim Pesan"
        >
          {sending ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
