'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  addAnnouncementComment,
  deleteAnnouncementComment,
  toggleAnnouncementReaction,
} from '@/modules/announcements/actions';
import { MarkdownViewer } from '@/components/MarkdownViewer';

export interface CommentItem {
  id: string;
  user_id: string;
  parent_id?: string | null;
  user_name: string | null;
  user_avatar?: string | null;
  content: string;
  created_at: number;
}

export interface ReactionItem {
  emoji: string;
  count: number;
  user_reacted: boolean;
}

interface AnnouncementInteractiveProps {
  announcementId: string;
  currentUserId: string;
  comments: CommentItem[];
  reactions: ReactionItem[];
  canDelete: boolean;
}

const DEFAULT_EMOJIS = ['👍', '❤️', '🔥', '🎉', '💡', '🚀'];

export function AnnouncementInteractive({
  announcementId,
  currentUserId,
  comments,
  reactions,
  canDelete,
}: AnnouncementInteractiveProps) {
  const [isPending, startTransition] = useTransition();
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [showComments, setShowComments] = useState(comments.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleReply(commentId: string, userName: string) {
    setShowComments(true);
    setReplyingTo({ id: commentId, userName });
    setCommentInput(`@${userName} `);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  function handleReaction(emoji: string) {
    startTransition(async () => {
      await toggleAnnouncementReaction(announcementId, emoji);
    });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const content = commentInput;
    const parentId = replyingTo ? replyingTo.id : null;

    setCommentInput('');
    setReplyingTo(null);

    startTransition(async () => {
      await addAnnouncementComment(announcementId, content, parentId);
    });
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      await deleteAnnouncementComment(commentId);
    });
  }

  // Group top-level comments and sub-comments
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900 space-y-3">
      {/* Reactions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => handleReaction(r.emoji)}
              disabled={isPending}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                r.user_reacted
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold'
                  : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{r.emoji}</span>
              <span>{r.count}</span>
            </button>
          ))}

          {DEFAULT_EMOJIS.filter((e) => !reactions.some((r) => r.emoji === e)).map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReaction(emoji)}
              disabled={isPending}
              className="px-2 py-1 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all opacity-60 hover:opacity-100"
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="text-xs font-bold text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
        >
          <span>💬 {comments.length} Comments</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="space-y-3 pt-2">
          {comments.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {rootComments.map((c) => {
                const childReplies = getReplies(c.id);
                return (
                  <div key={c.id} className="space-y-2">
                    {/* Top Level Comment */}
                    <div className="group flex items-start justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3 text-xs">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <Link href={`/dashboard/profile?userId=${c.user_id}`} className="shrink-0">
                          <UserAvatar src={c.user_avatar} name={c.user_name} size="sm" square />
                        </Link>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/dashboard/profile?userId=${c.user_id}`}
                              className="font-bold text-zinc-900 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                            >
                              {c.user_name || 'Anonymous User'}
                            </Link>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {new Date(c.created_at * 1000).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleReply(c.id, c.user_name || 'User')}
                              className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline ml-auto sm:ml-0"
                            >
                              Balas
                            </button>
                          </div>
                          <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            <MarkdownViewer content={c.content} />
                          </div>
                        </div>
                      </div>

                      {(c.user_id === currentUserId || canDelete) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          disabled={isPending}
                          className="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 transition-opacity p-1 shrink-0"
                          title="Delete Comment"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Sub-Comments / Nested Replies */}
                    {childReplies.length > 0 && (
                      <div className="pl-4 sm:pl-6 space-y-2 border-l-2 border-purple-500/20 ml-3">
                        {childReplies.map((reply) => (
                          <div
                            key={reply.id}
                            className="group flex items-start justify-between gap-3 bg-purple-500/[0.04] dark:bg-purple-500/[0.06] border border-purple-500/20 rounded-2xl p-3 text-xs"
                          >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <Link href={`/dashboard/profile?userId=${reply.user_id}`} className="shrink-0">
                                <UserAvatar src={reply.user_avatar} name={reply.user_name} size="sm" square />
                              </Link>
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link
                                    href={`/dashboard/profile?userId=${reply.user_id}`}
                                    className="font-bold text-zinc-900 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                                  >
                                    {reply.user_name || 'Anonymous User'}
                                  </Link>
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded">
                                    Balasan
                                  </span>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    {new Date(reply.created_at * 1000).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleReply(c.id, reply.user_name || 'User')}
                                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline ml-auto sm:ml-0"
                                  >
                                    Balas
                                  </button>
                                </div>
                                <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                  <MarkdownViewer content={reply.content} />
                                </div>
                              </div>
                            </div>

                            {(reply.user_id === currentUserId || canDelete) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(reply.id)}
                                disabled={isPending}
                                className="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 transition-opacity p-1 shrink-0"
                                title="Delete Comment"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Comment Input */}
          <form onSubmit={handleAddComment} className="space-y-1.5">
            {replyingTo && (
              <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl text-xs">
                <span className="text-purple-700 dark:text-purple-300 font-bold">
                  Membalas komentar <strong className="underline">@{replyingTo.userName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setCommentInput('');
                  }}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-800 font-bold text-xs"
                >
                  Batal ✕
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={replyingTo ? `Tulis balasan untuk @${replyingTo.userName}...` : 'Tulis komentar...'}
                disabled={isPending}
                className="flex-1 bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isPending || !commentInput.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95 shrink-0"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
