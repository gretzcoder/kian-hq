'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  ExecutiveFeedbackItem,
  ExecutiveFeedbackReply,
  replyToExecutiveFeedback,
  giveFeedbackSparks,
  editFeedbackSparks,
  toggleFeedbackReaction,
} from '@/modules/feedback/actions';
import FeedbackReactionPicker from './FeedbackReactionPicker';

interface FeedbackCardItemProps {
  feedback: ExecutiveFeedbackItem;
  currentUserId: string;
  canManageSparks: boolean;
}

export default function FeedbackCardItem({
  feedback,
  currentUserId,
  canManageSparks,
}: FeedbackCardItemProps) {
  // CRITICAL REQUIREMENT: "bila total chat dari user banyak, dibuat collapse dan jangan auto expand."
  // Initial state is ALWAYS false so threads are collapsed on load.
  const [isExpanded, setIsExpanded] = useState(false);

  // Reply state
  const [isReplying, setIsReplying] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sparks Modal / Form States
  const [showSparksModal, setShowSparksModal] = useState(false);
  const [sparksAmount, setSparksAmount] = useState(10);
  const [isEditingSparks, setIsEditingSparks] = useState(false);
  const [sparksError, setSparksError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const isSparkGiver = currentUserId === feedback.sparks_given_by;

  // Handle replying to post vs replying to specific comment
  function handleStartReply(parentId?: string, targetName?: string) {
    if (parentId && targetName) {
      setReplyParentId(parentId);
      setReplyingToName(targetName);
    } else {
      setReplyParentId(null);
      setReplyingToName(null);
    }
    setIsReplying(true);
    if (!isExpanded) setIsExpanded(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }

  function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    setReplyError(null);
    if (!replyMessage.trim()) return;

    startTransition(async () => {
      const res = await replyToExecutiveFeedback(
        feedback.id,
        replyMessage,
        replyParentId || undefined
      );
      if (res.success) {
        setReplyMessage('');
        setReplyParentId(null);
        setReplyingToName(null);
        setIsReplying(false);
        setIsExpanded(true); // expand to show posted reply
      } else {
        setReplyError(res.error || 'Gagal mengirim balasan.');
      }
    });
  }

  function handleGiveOrEditSparks(e: React.FormEvent) {
    e.preventDefault();
    setSparksError(null);

    startTransition(async () => {
      const res = isEditingSparks
        ? await editFeedbackSparks(feedback.id, sparksAmount)
        : await giveFeedbackSparks(feedback.id, sparksAmount);

      if (res.success) {
        setShowSparksModal(false);
      } else {
        setSparksError(res.error || 'Gagal menyimpan Sparks.');
      }
    });
  }

  function handleToggleRx(targetType: 'FEEDBACK' | 'REPLY', targetId: string, emoji: string) {
    startTransition(async () => {
      await toggleFeedbackReaction(targetType, targetId, emoji);
    });
  }

  const cardStyle =
    'bg-white dark:bg-[#09090b]/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-5 space-y-4 hover:border-purple-500/30 transition-all';

  return (
    <div className={cardStyle}>
      {/* Header Info */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/profile?userId=${feedback.user_id}`} className="shrink-0">
            <UserAvatar
              src={feedback.user_avatar}
              name={feedback.user_name}
              size="w-9 h-9 text-xs font-black"
              square
            />
          </Link>
          <div>
            <Link
              href={`/dashboard/profile?userId=${feedback.user_id}`}
              className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              {feedback.user_name}
            </Link>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{feedback.user_email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-lg">
            {feedback.category}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">
            {new Date(feedback.created_at * 1000).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Main Post Body */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {feedback.message}
      </div>

      {/* Main Post Reactions & Actions Bar */}
      <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Discord-Style Emoji Reactions for Post */}
          <FeedbackReactionPicker
            reactions={feedback.reactions}
            isPending={isPending}
            onToggleReaction={(emoji) => handleToggleRx('FEEDBACK', feedback.id, emoji)}
          />

          {/* Right: Sparks & Reply Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sparks status */}
            {feedback.sparks_given > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black rounded-xl">
                  <span>✨</span>
                  <span>+{feedback.sparks_given} Sparks</span>
                </span>
                {feedback.sparks_given_by_name && (
                  <span className="text-[11px] text-zinc-400">
                    (Oleh: <strong className="text-zinc-600 dark:text-zinc-300">{feedback.sparks_given_by_name}</strong>)
                  </span>
                )}
                {isSparkGiver && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingSparks(true);
                      setSparksAmount(feedback.sparks_given);
                      setSparksError(null);
                      setShowSparksModal(true);
                    }}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline ml-1"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
            ) : (
              canManageSparks && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingSparks(false);
                    setSparksAmount(10);
                    setSparksError(null);
                    setShowSparksModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/10 to-purple-500/10 hover:from-amber-500/20 hover:to-purple-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  <span>✨</span>
                  <span>Beri Sparks</span>
                </button>
              )
            )}

            {/* Reply Count Toggle */}
            {feedback.replies.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-purple-500/10 transition-colors"
              >
                <span>💬 {feedback.replies.length} Balasan</span>
                <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
              </button>
            )}

            {/* Balas Post Button */}
            <button
              type="button"
              onClick={() => handleStartReply()}
              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20 transition-all active:scale-95 flex items-center gap-1"
            >
              <span>↩</span>
              <span>Balas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Threads Reply Form (Shown when active or triggered) */}
      {isReplying && (
        <form onSubmit={handleSendReply} className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          {/* Target Replying-To Badge */}
          {replyingToName && (
            <div className="flex items-center justify-between text-xs bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-xl text-purple-700 dark:text-purple-300">
              <span>Membalas <strong className="font-black">@{replyingToName}</strong></span>
              <button
                type="button"
                onClick={() => {
                  setReplyParentId(null);
                  setReplyingToName(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold ml-2"
              >
                ✕ Batal
              </button>
            </div>
          )}

          {replyError && (
            <p className="text-xs text-red-500 font-bold px-1">{replyError}</p>
          )}

          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              rows={2}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder={replyingToName ? `Balas @${replyingToName}...` : "Tuliskan balasan kamu..."}
              className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 resize-none"
              required
            />
            <div className="flex flex-col justify-end gap-1">
              <button
                type="submit"
                disabled={isPending || !replyMessage.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-all shadow-sm active:scale-95 h-full"
              >
                {isPending ? 'Sending...' : 'Kirim'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Threads-Style Nested Replies Tree */}
      {isExpanded && feedback.replies.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">
            <span>Daftar Balasan ({feedback.replies.length})</span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="hover:text-zinc-200 transition-colors"
            >
              Tutup ▲
            </button>
          </div>

          {/* Thread Connector Line Container */}
          <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-purple-500/30">
            {feedback.replies.map((reply) => (
              <div
                key={reply.id}
                className="p-3.5 bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl space-y-2 relative group hover:border-purple-500/30 transition-all"
              >
                {/* Reply Header & Replying To Indicator */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      src={reply.user_avatar}
                      name={reply.user_name}
                      size="w-6 h-6 text-[10px] font-bold"
                      square
                    />
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      {reply.user_name}
                    </span>

                    {/* Social Media Style "@ParentUserName" Tag */}
                    {reply.parent_user_name && (
                      <span className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-md font-bold">
                        Membalas @{reply.parent_user_name}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(reply.created_at * 1000).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Reply Content */}
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap pl-8">
                  {reply.message}
                </p>

                {/* Reply Action Bar (Discord Reactions + Reply Button) */}
                <div className="flex items-center justify-between gap-2 pl-8 pt-1 flex-wrap">
                  {/* Discord Reactions on Reply */}
                  <FeedbackReactionPicker
                    reactions={reply.reactions}
                    isPending={isPending}
                    onToggleReaction={(emoji) => handleToggleRx('REPLY', reply.id, emoji)}
                  />

                  {/* Direct Reply to Comment Button */}
                  <button
                    type="button"
                    onClick={() => handleStartReply(reply.id, reply.user_name)}
                    className="text-[11px] font-bold text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
                  >
                    <span>↩ Balas</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Give / Edit Sparks Modal */}
      {showSparksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>✨</span>
                <span>{isEditingSparks ? 'Edit Sparks Diberikan' : 'Beri Sparks Apresiasi'}</span>
              </h3>
              <button
                onClick={() => setShowSparksModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Apresiasi untuk <strong className="text-zinc-900 dark:text-zinc-100">{feedback.user_name}</strong> atas masukan ini.
            </p>

            <form onSubmit={handleGiveOrEditSparks} className="space-y-4">
              {sparksError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold">
                  {sparksError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Jumlah Sparks
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSparksAmount(amt)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        sparksAmount === amt
                          ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-500/50'
                      }`}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="text-[10px] font-bold text-zinc-500">Atau jumlah custom:</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={sparksAmount}
                    onChange={(e) => setSparksAmount(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSparksModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !sparksAmount || sparksAmount < 1}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-sm active:scale-95"
                >
                  {isPending ? 'Simpan...' : isEditingSparks ? 'Update Sparks' : 'Beri Sparks'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
