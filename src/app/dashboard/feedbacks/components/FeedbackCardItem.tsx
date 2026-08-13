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
  deleteExecutiveFeedbackReply,
} from '@/modules/feedback/actions';
import FeedbackReactionPicker from './FeedbackReactionPicker';

interface FeedbackCardItemProps {
  feedback: ExecutiveFeedbackItem;
  currentUserId: string;
  canManageSparks: boolean;
  canDeleteComment?: boolean;
}

export default function FeedbackCardItem({
  feedback,
  currentUserId,
  canManageSparks,
  canDeleteComment = false,
}: FeedbackCardItemProps) {
  // CRITICAL REQUIREMENT: "bila total chat dari user banyak, dibuat collapse dan jangan auto expand."
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_REPLY_LIMIT = 3;
  const [visibleReplyCount, setVisibleReplyCount] = useState(INITIAL_REPLY_LIMIT);
  const [expandedSubThreads, setExpandedSubThreads] = useState<Record<string, boolean>>({});

  function handleToggleExpand() {
    if (isExpanded) {
      setIsExpanded(false);
      setVisibleReplyCount(INITIAL_REPLY_LIMIT);
    } else {
      setIsExpanded(true);
    }
  }

  function handleDeleteReply(replyId: string) {
    if (!confirm('Apakah kamu yakin ingin menghapus komentar ini?')) return;
    startTransition(async () => {
      const res = await deleteExecutiveFeedbackReply(replyId);
      if (!res.success) {
        alert(res.error || 'Gagal menghapus komentar.');
      }
    });
  }

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

      {/* Grouping replies into Instagram comment hierarchy tree */}
      {(() => {
        const replyIdSet = new Set(feedback.replies.map((r) => r.id));
        const topLevelComments = feedback.replies.filter(
          (r) => !r.parent_id || !replyIdSet.has(r.parent_id)
        );

        const subRepliesMap = new Map<string, ExecutiveFeedbackReply[]>();
        for (const reply of feedback.replies) {
          if (topLevelComments.some((top) => top.id === reply.id)) continue;

          let rootId = reply.parent_id;
          let currentParent = feedback.replies.find((r) => r.id === rootId);
          while (currentParent && currentParent.parent_id && replyIdSet.has(currentParent.parent_id)) {
            rootId = currentParent.parent_id;
            currentParent = feedback.replies.find((r) => r.id === rootId);
          }

          if (rootId) {
            const list = subRepliesMap.get(rootId) || [];
            list.push(reply);
            subRepliesMap.set(rootId, list);
          }
        }

        const visibleTopLevel = topLevelComments.slice(0, visibleReplyCount);

        return (
          <>
            {/* Instagram-Style "View replies" Toggle Button */}
            {feedback.replies.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleToggleExpand}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer group"
                >
                  <span className="w-6 h-[1px] bg-zinc-400 dark:bg-zinc-700 group-hover:bg-purple-500 transition-colors"></span>
                  <span>{isExpanded ? 'Sembunyikan balasan' : `Lihat ${feedback.replies.length} balasan`}</span>
                </button>
              </div>
            )}

            {/* Instagram-Style Nested Comment Tree */}
            {isExpanded && topLevelComments.length > 0 && (
              <div className="space-y-3.5 pt-2 pl-1 sm:pl-2">
                {visibleTopLevel.map((topComment) => {
                  const subReplies = subRepliesMap.get(topComment.id) || [];
                  const isSubExpanded = expandedSubThreads[topComment.id] ?? false;

                  return (
                    <div key={topComment.id} className="space-y-2">
                      {/* Top-Level Comment (Komentar Umum) */}
                      <div className="flex items-start gap-2.5 group">
                        <Link href={`/dashboard/profile?userId=${topComment.user_id}`} className="shrink-0 pt-0.5">
                          <UserAvatar
                            src={topComment.user_avatar}
                            name={topComment.user_name}
                            size="w-7 h-7 text-[10px] font-bold"
                            square={false}
                          />
                        </Link>

                        <div className="flex-1 min-w-0 text-xs">
                          {/* Instagram Comment Text Layout: Bold Username + Message */}
                          <div className="text-zinc-800 dark:text-zinc-200 leading-snug">
                            <Link
                              href={`/dashboard/profile?userId=${topComment.user_id}`}
                              className="font-extrabold text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 mr-1.5"
                            >
                              {topComment.user_name}
                            </Link>
                            <span className="whitespace-pre-wrap font-normal text-zinc-700 dark:text-zinc-300">
                              {topComment.message}
                            </span>
                          </div>

                          {/* Sub Metadata Bar: Time • Balas • Hapus • Reactions */}
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400 flex-wrap">
                            <span className="font-mono text-[10px] text-zinc-500">
                              {new Date(topComment.created_at * 1000).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleStartReply(topComment.id, topComment.user_name)}
                              className="font-bold text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                            >
                              Balas
                            </button>

                            {(canDeleteComment || topComment.user_id === currentUserId) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReply(topComment.id)}
                                className="font-bold text-red-500/70 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                Hapus
                              </button>
                            )}

                            <FeedbackReactionPicker
                              reactions={topComment.reactions}
                              isPending={isPending}
                              onToggleReaction={(emoji) => handleToggleRx('REPLY', topComment.id, emoji)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Toggle Link for Sub-Replies Under THIS Top-Level Comment */}
                      {subReplies.length > 0 && (
                        <div className="pl-9 sm:pl-10">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSubThreads((prev) => ({
                                ...prev,
                                [topComment.id]: !isSubExpanded,
                              }))
                            }
                            className="inline-flex items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer group"
                          >
                            <span className="w-5 h-[1px] bg-zinc-400 dark:bg-zinc-700 group-hover:bg-purple-500 transition-colors"></span>
                            <span>
                              {isSubExpanded ? 'Hide replies' : `View replies (${subReplies.length})`}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Sub-Replies Tree Indented Under Top-Level Comment (Komentar Dalam Komentar) */}
                      {isSubExpanded && subReplies.length > 0 && (
                        <div className="pl-9 sm:pl-10 border-l border-zinc-200 dark:border-zinc-800/80 space-y-2.5 pt-1 ml-3.5">
                          {subReplies.map((subReply) => (
                            <div key={subReply.id} className="flex items-start gap-2.5 group">
                              <Link href={`/dashboard/profile?userId=${subReply.user_id}`} className="shrink-0 pt-0.5">
                                <UserAvatar
                                  src={subReply.user_avatar}
                                  name={subReply.user_name}
                                  size="w-6.5 h-6.5 text-[9px] font-bold"
                                  square={false}
                                />
                              </Link>

                              <div className="flex-1 min-w-0 text-xs">
                                {/* Instagram Sub-Comment Text: Bold Username + @Parent + Message */}
                                <div className="text-zinc-800 dark:text-zinc-200 leading-snug">
                                  <Link
                                    href={`/dashboard/profile?userId=${subReply.user_id}`}
                                    className="font-extrabold text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 mr-1.5"
                                  >
                                    {subReply.user_name}
                                  </Link>
                                  {subReply.parent_user_name && (
                                    <span className="text-purple-600 dark:text-purple-400 font-bold mr-1.5">
                                      @{subReply.parent_user_name}
                                    </span>
                                  )}
                                  <span className="whitespace-pre-wrap font-normal text-zinc-700 dark:text-zinc-300">
                                    {subReply.message}
                                  </span>
                                </div>

                                {/* Sub-metadata Bar */}
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400 flex-wrap">
                                  <span className="font-mono text-[10px] text-zinc-500">
                                    {new Date(subReply.created_at * 1000).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleStartReply(subReply.id, subReply.user_name)}
                                    className="font-bold text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                                  >
                                    Balas
                                  </button>

                                  {(canDeleteComment || subReply.user_id === currentUserId) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReply(subReply.id)}
                                      className="font-bold text-red-500/70 hover:text-red-500 transition-colors cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                  )}

                                  <FeedbackReactionPicker
                                    reactions={subReply.reactions}
                                    isPending={isPending}
                                    onToggleReaction={(emoji) => handleToggleRx('REPLY', subReply.id, emoji)}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Instagram-Style "View More Comments" Link */}
                {topLevelComments.length > visibleReplyCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleReplyCount((prev) => prev + 5)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline pt-1 cursor-pointer"
                  >
                    <span className="w-4 h-[1px] bg-purple-500/40"></span>
                    <span>Lihat {topLevelComments.length - visibleReplyCount} komentar lainnya</span>
                  </button>
                )}
              </div>
            )}
          </>
        );
      })()}

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
