import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { hasPermission } from '@/modules/roles/rbac';
import { createAnnouncement } from '@/modules/announcements/actions';
import Link from 'next/link';

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  created_at: number;
}

interface PersonalTaskRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  deadline: number | null;
  project_name: string;
  assigned_name?: string | null; // For pending reviews
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const db = await getDB();

  // 1. Fetch Summary Metrics and Recent Announcements
  const [roleResult, totalUsers, totalProjects, totalTasks, announcementsRaw] = await Promise.all([
    db
      .prepare('SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?')
      .bind(session.userId)
      .first() as Promise<{ name: string } | null>,
    db.prepare('SELECT COUNT(*) as count FROM users').first() as Promise<{ count: number }>,
    db.prepare('SELECT COUNT(*) as count FROM projects').first() as Promise<{ count: number }>,
    db.prepare('SELECT COUNT(*) as count FROM tasks').first() as Promise<{ count: number }>,
    db.prepare(`
      SELECT a.*, u.name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 4
    `).all(),
  ]);

  const userRole = roleResult?.name || 'CREATOR';
  const announcements = announcementsRaw.results as unknown as AnnouncementRow[];

  const canPostAnnouncement = await hasPermission(session.userId, 'CREATE');
  const canManageUsers = await hasPermission(session.userId, 'MANAGE');

  // 2. Conditional Tasks Fetch based on role
  let personalTasks: PersonalTaskRow[] = [];
  let widgetTitle = 'Tugas Saya';
  let widgetDesc = 'Daftar tugas Anda yang belum selesai di semua kampanye proyek.';

  if (userRole === 'EXECUTIVE' || userRole === 'COORDINATOR') {
    widgetTitle = 'Ulasan Tertunda';
    widgetDesc = 'Aset tugas kreatif dari Kreator yang siap untuk Anda tinjau & setujui.';
    const query = `
      SELECT t.id, t.project_id, t.title, t.status, t.deadline, p.name as project_name, u.name as assigned_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.status = 'IN_REVIEW'
      ORDER BY t.created_at ASC
      LIMIT 10
    `;
    const { results } = await db.prepare(query).all();
    personalTasks = results as unknown as PersonalTaskRow[];
  } else {
    // For CREATORS
    const query = `
      SELECT t.id, t.project_id, t.title, t.status, t.deadline, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assigned_to = ? AND t.status != 'COMPLETED'
      ORDER BY t.deadline ASC, t.created_at ASC
      LIMIT 10
    `;
    const { results } = await db.prepare(query).bind(session.userId).all();
    personalTasks = results as unknown as PersonalTaskRow[];
  }

  // Server Action wrapper to satisfy Next.js form action void return constraint
  async function handlePostAnnouncement(formData: FormData) {
    'use server';
    await createAnnouncement(formData);
  }

  const taskColors: Record<string, string> = {
    TODO: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80',
    IN_PROGRESS: 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/10 dark:border-blue-500/20',
    IN_REVIEW: 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10 dark:border-yellow-500/20',
    APPROVED: 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10 dark:border-emerald-500/20',
  };

  return (
    <div className="space-y-10">
      {/* Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Creative Console
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
            Welcome back, <span className="text-zinc-900 dark:text-zinc-200 font-bold">{session.name}</span>. Current Clearance: <span className="text-purple-600 dark:text-purple-400 font-extrabold">{userRole}</span>.
          </p>
        </div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black tracking-wider uppercase border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-3 py-1.5 rounded-full shadow-sm dark:shadow-none">
          Clearance Level: {userRole}
        </div>
      </div>

      {/* Premium Clickable Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {canManageUsers ? (
          <Link
            href="/dashboard/users"
            className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group"
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Active Members</p>
                <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">{totalUsers.count}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/5 text-purple-600 dark:text-purple-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">Manage team clearance mapping &rarr;</div>
          </Link>
        ) : (
          <div className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">Active Members</p>
                <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">{totalUsers.count}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-500/5 text-zinc-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">Synced D1 Relational Engine</div>
          </div>
        )}

        <Link
          href="/dashboard/projects"
          className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group"
        >
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-405 font-bold uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Active Projects</p>
              <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">{totalProjects.count}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/5 text-blue-600 dark:text-blue-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">Browse dynamic creative registry &rarr;</div>
        </Link>

        <Link
          href="/dashboard/analytics"
          className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group"
        >
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Total Tasks</p>
              <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">{totalTasks.count}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-pink-500/5 text-pink-600 dark:text-pink-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">View analytics dashboard &rarr;</div>
        </Link>
      </div>

      {/* Main Console Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left/Middle Column: Personal Tasks + Announcements */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Personal Tasks / Pending Reviews Widget */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{widgetTitle}</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{widgetDesc}</p>
            </div>

            {personalTasks.length === 0 ? (
              <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-10 text-center text-zinc-500 text-sm">
                🎉 Hore! Tidak ada tugas tertunda untuk saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {personalTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest truncate max-w-[165px]">
                          {task.project_name}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            taskColors[task.status] || taskColors.TODO
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {task.title}
                      </h4>
                      {task.assigned_name && (
                        <p className="text-[10px] text-zinc-500 mt-1">Oleh: {task.assigned_name}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {task.deadline && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono hidden sm:block">
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                      <Link
                        href={`/dashboard/projects/${task.project_id}`}
                        className="text-[11px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900/60 px-3.5 py-2 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-sm"
                      >
                        Buka &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Announcements Registry */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Announcements</h2>
            
            {announcements.length === 0 ? (
              <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-12 text-center text-zinc-500 text-sm">
                No announcements posted yet. Creative coordinators will broadcast updates here.
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="border border-zinc-200/80 dark:border-zinc-800/60 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm border-l-4 border-l-purple-500 dark:border-l-purple-500"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{ann.title}</h3>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                        {new Date(ann.created_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                      {ann.content}
                    </p>
                    <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-900 text-[10px] text-zinc-500 dark:text-zinc-500 font-bold">
                      Broadcasted by: <span className="text-zinc-700 dark:text-zinc-400">{ann.author_name || 'System Operator'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Controls Panel */}
        <div className="space-y-6">
          {/* Post Announcement Form */}
          {canPostAnnouncement ? (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Broadcast Update</h3>
              <p className="text-zinc-500 dark:text-zinc-500 text-xs mb-6">Send an announcement banner to all team members.</p>

              <form action={handlePostAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="e.g. Design Guidelines Update"
                    className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                    Message Content
                  </label>
                  <textarea
                    name="content"
                    rows={4}
                    required
                    placeholder="Type details or links..."
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
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 text-center text-zinc-500 text-xs shadow-sm">
              🔒 Standard account tier. Broadcast controls locked.
            </div>
          )}

          {/* Quick Info Card */}
          <div className="border border-purple-500/10 dark:border-purple-500/10 bg-purple-500/5 rounded-3xl p-6">
            <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">System Specs</h4>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              Operating under KIAN HQ Core Engine v1.2. SQLite relational mapping, isolated KV session tokens, and strict permission-aware endpoints ensure light memory footprint and high security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
