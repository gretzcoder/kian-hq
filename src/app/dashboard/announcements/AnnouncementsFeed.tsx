'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { AnnouncementInteractive, CommentItem, ReactionItem } from './AnnouncementInteractive';
import { getAnnouncementsUpdates } from '@/modules/announcements/actions';
import { markAnnouncementsAsRead, isAnnouncementUnread, getLastReadTimestamp } from '@/modules/announcements/announcementReadState';

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  created_by?: string | null;
  author_id?: string | null;
  author_name: string | null;
  author_avatar?: string | null;
  created_at: number;
}

interface DBCommentRow {
  id: string;
  announcement_id: string;
  user_id: string;
  parent_id?: string | null;
  content: string;
  created_at: number;
  user_name: string | null;
  user_avatar?: string | null;
}

interface DBReactionRow {
  announcement_id: string;
  emoji: string;
  count: number;
  user_reacted: number;
}

interface AnnouncementsFeedProps {
  initialAnnouncements: AnnouncementRow[];
  initialComments: DBCommentRow[];
  initialReactions: DBReactionRow[];
  currentUserId: string;
  canDelete: boolean;
  onDelete: (formData: FormData) => Promise<void>;
}

export default function AnnouncementsFeed({
  initialAnnouncements,
  initialComments,
  initialReactions,
  currentUserId,
  canDelete,
  onDelete,
}: AnnouncementsFeedProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>(initialAnnouncements);
  const [allComments, setAllComments] = useState<DBCommentRow[]>(initialComments);
  const [allReactions, setAllReactions] = useState<DBReactionRow[]>(initialReactions);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(0);

  useEffect(() => {
    // Capture the timestamp before marking as read to highlight unread items on this session
    setLastReadTimestamp(getLastReadTimestamp());
    // Mark as read after a short delay so user sees the highlights
    const timer = setTimeout(() => {
      markAnnouncementsAsRead();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setAnnouncements(initialAnnouncements);
    setAllComments(initialComments);
    setAllReactions(initialReactions);
  }, [initialAnnouncements, initialComments, initialReactions]);

  // Real-time Polling every 4 seconds
  useEffect(() => {
    let isMounted = true;

    const pollUpdates = async () => {
      if (document.hidden) return;
      const res = await getAnnouncementsUpdates();
      if (isMounted && res) {
        setAnnouncements(res.announcements);
        setAllComments(res.comments);
        setAllReactions(res.reactions);
      }
    };

    const interval = setInterval(pollUpdates, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (announcements.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-12 text-center text-zinc-400 text-xs font-bold leading-normal">
        📢 Belum ada pengumuman yang dipublikasikan.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {announcements.map((ann) => {
        const comments: CommentItem[] = allComments
          .filter((c) => c.announcement_id === ann.id)
          .map((c) => ({
            id: c.id,
            user_id: c.user_id,
            parent_id: c.parent_id,
            user_name: c.user_name,
            user_avatar: c.user_avatar,
            content: c.content,
            created_at: c.created_at,
          }));

        const reactions: ReactionItem[] = allReactions
          .filter((r) => r.announcement_id === ann.id)
          .map((r) => ({
            emoji: r.emoji,
            count: Number(r.count),
            user_reacted: Boolean(r.user_reacted),
          }));

        const authorId = ann.author_id || ann.created_by;
        const isUnread = lastReadTimestamp === 0 ? true : ann.created_at * 1000 > lastReadTimestamp;

        return (
          <div
            key={ann.id}
            className={`border rounded-3xl p-6 shadow-sm transition-all duration-300 relative overflow-hidden ${
              isUnread
                ? 'bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-white dark:to-[#09090b]/40 border-purple-500/50 dark:border-purple-500/50 shadow-purple-500/10 ring-2 ring-purple-500/20'
                : 'border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            {/* Header info */}
            <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-900">
              <Link
                href={authorId ? `/dashboard/profile?userId=${authorId}` : '/dashboard/profile'}
                className="flex items-center gap-2.5 min-w-0 group"
              >
                <UserAvatar src={ann.author_avatar} name={ann.author_name || 'Author'} size="md" square />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:underline truncate">
                  {ann.author_name || 'System Operator'}
                </span>
              </Link>

              <div className="flex items-center gap-3 shrink-0">
                {isUnread && (
                  <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                    🔴 Belum Dibaca
                  </span>
                )}
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(ann.created_at * 1000).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                {canDelete && (
                  <form action={onDelete}>
                    <input type="hidden" name="id" value={ann.id} />
                    <button
                      type="submit"
                      className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-bold border border-red-500/10 hover:border-red-500/20 hover:bg-red-500/5 px-2.5 py-1 rounded-lg transition-all active:scale-[0.97]"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>

            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">{ann.title}</h3>

            <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed my-2">
              <MarkdownViewer content={ann.content} />
            </div>

            {/* Comments and Emoji Reactions */}
            <AnnouncementInteractive
              announcementId={ann.id}
              currentUserId={currentUserId}
              comments={comments}
              reactions={reactions}
              canDelete={canDelete}
            />
          </div>
        );
      })}
    </div>
  );
}
