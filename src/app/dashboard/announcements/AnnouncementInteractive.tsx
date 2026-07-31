'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  addAnnouncementComment,
  deleteAnnouncementComment,
  toggleAnnouncementReaction,
} from '@/modules/announcements/actions';
import { MarkdownViewer } from '@/components/MarkdownViewer';

export interface CommentItem {
  id: string;
  user_id: string;
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
  const [showComments, setShowComments] = useState(comments.length > 0);

  function handleReaction(emoji: string) {
    startTransition(async () => {
      await toggleAnnouncementReaction(announcementId, emoji);
    });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const content = commentInput;
    setCommentInput('');

    startTransition(async () => {
      await addAnnouncementComment(announcementId, content);
    });
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      await deleteAnnouncementComment(commentId);
    });
  }

  return (
    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-900/80 space-y-4">
      {/* Reactions Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {DEFAULT_EMOJIS.map((emoji) => {
          const r = reactions.find((rx) => rx.emoji === emoji);
          const count = r ? r.count : 0;
          const reacted = r ? r.user_reacted : false;

          return (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                reacted
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                  : 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-800 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="font-bold text-[11px]">{count}</span>}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="ml-auto text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5"
        >
          <span>💬</span>
          <span>
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="space-y-3 pt-2">
          {comments.length > 0 && (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {comments.map((c) => {
                const isReply = c.content.trim().startsWith('@');
                return (
                  <div
                    key={c.id}
                    className={`group flex items-start justify-between gap-3 rounded-2xl p-3 text-xs transition-all ${
                      isReply
                        ? 'ml-5 sm:ml-7 bg-purple-500/[0.04] dark:bg-purple-500/[0.06] border border-purple-500/20 border-l-4 border-l-purple-500'
                        : 'bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <Link href={`/dashboard/profile?userId=${c.user_id}`} className="shrink-0">
                        {c.user_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.user_avatar}
                            alt={c.user_name || 'User'}
                            className="w-6 h-6 rounded-lg border border-zinc-200 dark:border-zinc-800 object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-[10px] font-black uppercase">
                            {(c.user_name || 'U').substring(0, 2)}
                          </div>
                        )}
                      </Link>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/dashboard/profile?userId=${c.user_id}`}
                            className="font-bold text-zinc-900 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                          >
                            {c.user_name || 'Anonymous User'}
                          </Link>
                          {isReply && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded">
                              Balasan
                            </span>
                          )}
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
                            onClick={() => setCommentInput(`@${c.user_name || 'User'} `)}
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
                );
              })}
            </div>
          )}

          {/* Add Comment Input */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
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
          </form>
        </div>
      )}
    </div>
  );
}
