import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionContext } from '@/modules/roles/rbac';
import { createAnnouncement } from '@/modules/announcements/actions';

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
  workspace_id: string | null;
  title: string;
  status: string;
  deadline: number | null;
  project_name: string;
  assigned_name?: string | null;
  assignment_role?: string | null;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const db = await getDB();

  // Batch-fetch permissions + roles in ONE call (Phase 1C helper)
  const ctx = await getSessionContext(session.userId);

  const [totalUsers, totalProjects, totalTasks, announcementsRaw] = await Promise.all([
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

  const announcements = announcementsRaw.results as unknown as AnnouncementRow[];

  // Phase 0 fix: permission-based widget logic, NOT hardcoded role names
  const canReview   = ctx.can('APPROVE') || ctx.can('REQUEST_REVISION');
  const canManage   = ctx.can('MANAGE');
  const canAnnounce = ctx.can('CREATE_ANNOUNCEMENT');
  const canCreate   = ctx.can('CREATE_PROJECT');

  // Primary role name for display label only (not for logic)
  const displayRole = ctx.roles[0] ?? 'CREATOR';

  // Widget: COORDINATOR/EXECUTIVE sees pending reviews; others see their own assignments
  let personalTasks: PersonalTaskRow[] = [];
  let widgetTitle = 'My Workspace';
  let widgetDesc = 'Active tasks assigned to you across all projects.';

  if (canReview) {
    widgetTitle = 'Pending Reviews';
    widgetDesc = 'Submitted assignments awaiting your review and approval.';
    const { results } = await db.prepare(`
      SELECT
        ta.task_id AS id,
        t.project_id,
        t.workspace_id,
        t.title,
        ta.status,
        t.deadline,
        p.name AS project_name,
        u.name AS assigned_name,
        ta.assignment_role
      FROM task_assignments ta
      JOIN tasks t         ON ta.task_id = t.id
      JOIN projects p      ON t.project_id = p.id
      LEFT JOIN users u    ON ta.user_id = u.id
      WHERE ta.status = 'IN_REVIEW'
      ORDER BY ta.submitted_at ASC
      LIMIT 10
    `).all();
    personalTasks = results as unknown as PersonalTaskRow[];
  } else {
    // CREATOR: show their own active assignments
    const { results } = await db.prepare(`
      SELECT
        ta.task_id AS id,
        t.project_id,
        t.workspace_id,
        t.title,
        ta.status,
        t.deadline,
        p.name AS project_name,
        ta.assignment_role
      FROM task_assignments ta
      JOIN tasks t      ON ta.task_id = t.id
      JOIN projects p   ON t.project_id = p.id
      WHERE ta.user_id = ? AND ta.status NOT IN ('APPROVED', 'DONE')
      ORDER BY t.deadline ASC
      LIMIT 10
    `).bind(session.userId).all();
    personalTasks = results as unknown as PersonalTaskRow[];
  }

  async function handlePostAnnouncement(formData: FormData) {
    'use server';
    await createAnnouncement(formData);
  }

  const statusColors: Record<string, string> = {
    ASSIGNED:    'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80',
    IN_PROGRESS: 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/10 dark:border-blue-500/20',
    SUBMITTED:   'bg-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-500/10 dark:border-orange-500/20',
    IN_REVIEW:   'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10 dark:border-yellow-500/20',
    REVISION:    'bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/10 dark:border-red-500/20',
    APPROVED:    'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10 dark:border-emerald-500/20',
    DONE:        'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/10 dark:border-purple-500/20',
  };

  const roleColors: Record<string, string> = {
    PIC:      'text-purple-600 dark:text-purple-400',
    REVIEWER: 'text-blue-600 dark:text-blue-400',
    HELPER:   'text-emerald-600 dark:text-emerald-400',
    APPROVER: 'text-amber-600 dark:text-amber-400',
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
            Welcome back, <span className="text-zinc-900 dark:text-zinc-200 font-bold">{session.name}</span>.
            {' '}Clearance:{' '}
            <span className="text-purple-600 dark:text-purple-400 font-extrabold">{displayRole}</span>.
          </p>
        </div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black tracking-wider uppercase border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-3 py-1.5 rounded-full shadow-sm dark:shadow-none">
          {displayRole}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Members card — clickable only with MANAGE */}
        {canManage ? (
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
              <div className="p-2.5 rounded-xl bg-zinc-500/5 text-zinc-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">Synced D1 Relational Engine</div>
          </div>
        )}

        <Link href="/dashboard/projects" className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Active Projects</p>
              <p className="text-4xl font-black mt-2 text-zinc-900 dark:text-zinc-100">{totalProjects.count}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/5 text-blue-600 dark:text-blue-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-4 font-bold tracking-wide">Browse creative registry &rarr;</div>
        </Link>

        <Link href="/dashboard/analytics" className="block border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 group">
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

      {/* Main Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-10">

          {/* Tasks / Reviews Widget */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{widgetTitle}</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{widgetDesc}</p>
            </div>

            {personalTasks.length === 0 ? (
              <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-10 text-center text-zinc-500 text-sm">
                {canReview ? '✅ No pending reviews right now.' : '🎉 No active assignments. Check back later!'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {personalTasks.map((task) => (
                  <div
                    key={`${task.id}-${task.assignment_role}`}
                    className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest truncate max-w-[140px]">
                          {task.project_name}
                        </span>
                        {task.assignment_role && (
                          <span className={`text-[9px] font-black uppercase tracking-widest ${roleColors[task.assignment_role] ?? ''}`}>
                            {task.assignment_role}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColors[task.status] ?? statusColors.ASSIGNED}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{task.title}</h4>
                      {task.assigned_name && (
                        <p className="text-[10px] text-zinc-500 mt-1">By: {task.assigned_name}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {task.deadline && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono hidden sm:block">
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                      <Link
                        href={task.workspace_id
                          ? `/dashboard/projects/${task.project_id}/workspace/${task.workspace_id}`
                          : `/dashboard/projects/${task.project_id}`}
                        className="text-[11px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900/60 px-3.5 py-2 rounded-xl transition-all font-bold tracking-wide active:scale-[0.98] shadow-sm"
                      >
                        Open &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Announcements</h2>
            {announcements.length === 0 ? (
              <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-12 text-center text-zinc-500 text-sm">
                No announcements yet. Coordinators will broadcast updates here.
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
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                    <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-900 text-[10px] text-zinc-500 dark:text-zinc-500 font-bold">
                      Broadcasted by: <span className="text-zinc-700 dark:text-zinc-400">{ann.author_name || 'System Operator'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls Panel */}
        <div className="space-y-6">
          {/* Quick Actions based on permissions */}
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-5 shadow-sm space-y-2">
            <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Quick Actions</h3>
            {canCreate && (
              <Link href="/dashboard/projects" className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group">
                <div className="p-1.5 rounded-lg bg-blue-500/5 text-blue-600 dark:text-blue-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">New Project</span>
              </Link>
            )}
            {ctx.can('CREATE_BRIEF') && (
              <Link href="/dashboard/briefs" className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group">
                <div className="p-1.5 rounded-lg bg-yellow-500/5 text-yellow-600 dark:text-yellow-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">Content Briefs</span>
              </Link>
            )}
            {canReview && (
              <Link href="/dashboard/review" className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group">
                <div className="p-1.5 rounded-lg bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" /></svg>
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">Review Queue</span>
              </Link>
            )}
            {!canReview && (
              <Link href="/dashboard/workspace" className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all group">
                <div className="p-1.5 rounded-lg bg-purple-500/5 text-purple-600 dark:text-purple-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">My Workspace</span>
              </Link>
            )}
          </div>

          {/* Broadcast Announcement */}
          {canAnnounce ? (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Broadcast Update</h3>
              <p className="text-zinc-500 dark:text-zinc-500 text-xs mb-6">Send an announcement to all team members.</p>
              <form action={handlePostAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Title</label>
                  <input
                    type="text" name="title" required placeholder="e.g. Design Guidelines Update"
                    className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Message</label>
                  <textarea
                    name="content" rows={4} required placeholder="Type details or links..."
                    className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
                  />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-2">
                  Broadcast Announcement
                </button>
              </form>
            </div>
          ) : null}

          {/* System Info */}
          <div className="border border-purple-500/10 dark:border-purple-500/10 bg-purple-500/5 rounded-3xl p-6">
            <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">System Specs</h4>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              KIAN HQ Core Engine v2.0. Everything is a Workflow. State machine-driven, permission-aware, and built for creative teams.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
