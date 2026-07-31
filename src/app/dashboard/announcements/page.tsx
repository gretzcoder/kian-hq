import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import Link from 'next/link';
import { getSessionContext } from '@/modules/roles/rbac';
import { createAnnouncement, deleteAnnouncement } from '@/modules/announcements/actions';
import { AnnouncementInteractive, CommentItem, ReactionItem } from './AnnouncementInteractive';
import { MarkdownViewer } from '@/components/MarkdownViewer';

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  author_avatar?: string | null;
  created_at: number;
}

interface DBCommentRow {
  id: string;
  announcement_id: string;
  user_id: string;
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

export default async function AnnouncementsPage() {
  const session = await getSession();
  if (!session) return null;

  const db = await getDB();
  const [resultsRaw, commentsRaw, reactionsRaw, ctx] = await Promise.all([
    db.prepare(`
      SELECT a.id, a.title, a.content, a.created_at, u.name as author_name, u.avatar_url as author_avatar
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `).all(),
    db.prepare(`
      SELECT c.id, c.announcement_id, c.user_id, c.content, c.created_at, u.name as user_name, u.avatar_url as user_avatar
      FROM announcement_comments c
      LEFT JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at ASC
    `).all(),
    db.prepare(`
      SELECT 
        announcement_id, 
        emoji, 
        COUNT(*) as count,
        MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
      FROM announcement_reactions
      GROUP BY announcement_id, emoji
    `).bind(session.userId).all(),
    getSessionContext(session.userId),
  ]);

  const announcements = resultsRaw.results as unknown as AnnouncementRow[];
  const allComments = commentsRaw.results as unknown as DBCommentRow[];
  const allReactions = reactionsRaw.results as unknown as DBReactionRow[];

  const canCreate = ctx.can('CREATE_ANNOUNCEMENT');
  const canDelete = ctx.can('DELETE');

  async function handleCreate(formData: FormData) {
    'use server';
    await createAnnouncement(formData);
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteAnnouncement(id);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Announcements
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Team-wide broadcast updates, notices, and critical communications.
          </p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-3 py-1.5 rounded-full shadow-sm self-start sm:self-auto">
          {announcements.length} Total
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Announcements Feed */}
        <div className={canCreate ? 'lg:col-span-2 space-y-5' : 'lg:col-span-3 space-y-5'}>
          {announcements.length === 0 ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
              <p className="text-3xl mb-3">📢</p>
              <p className="text-zinc-500 text-sm font-medium">No announcements yet.</p>
            </div>
          ) : (
            announcements.map((ann) => {
              const comments: CommentItem[] = allComments
                .filter((c) => c.announcement_id === ann.id)
                .map((c) => ({
                  id: c.id,
                  user_id: c.user_id,
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

              return (
                <div
                  key={ann.id}
                  className="border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm border-l-4 border-l-purple-500 hover:shadow-md transition-all duration-300"
                >
                  {/* Author Header */}
                  <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-900/60">
                    <Link href="/dashboard/profile" className="flex items-center gap-2.5 group min-w-0">
                      {ann.author_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ann.author_avatar}
                          alt={ann.author_name || 'Author'}
                          className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 uppercase">
                          {(ann.author_name || 'A').substring(0, 2)}
                        </div>
                      )}
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:underline truncate">
                        {ann.author_name || 'System Operator'}
                      </span>
                    </Link>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(ann.created_at * 1000).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                      {canDelete && (
                        <form action={handleDelete}>
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
                    currentUserId={session.userId}
                    comments={comments}
                    reactions={reactions}
                    canDelete={canDelete}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Right Panel: Create Form (Only if permitted) */}
        {canCreate && (
          <div className="space-y-6">
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Broadcast Update</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-6">
                Post a new team-wide announcement.
              </p>

              <form action={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="e.g. New design guidelines released"
                    className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                    Message Content
                  </label>
                  <textarea
                    name="content"
                    rows={5}
                    required
                    placeholder="Type the announcement details, links, or reminders..."
                    className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-2"
                >
                  Broadcast Announcement
                </button>
              </form>
            </div>

            {/* Info card */}
            <div className="border border-purple-500/10 bg-purple-500/5 rounded-3xl p-5">
              <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">Broadcast Protocol</h4>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Announcements are visible to all team members. Use this channel for critical updates, policy changes, or project milestones only.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
