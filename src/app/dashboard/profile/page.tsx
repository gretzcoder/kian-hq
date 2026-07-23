import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  status: string;
  created_at: number;
  role_name: string | null;
}

interface TaskStat {
  status: string;
  count: number;
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/');

  const db = await getDB();

  // 1. Full user profile with role
  const profile = await db
    .prepare(`
      SELECT u.id, u.email, u.name, u.status, u.created_at, r.name as role_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ?
    `)
    .bind(session.userId)
    .first() as UserProfile | null;

  // 2. Task stats by status
  const { results: taskStatsRaw } = await db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      WHERE assigned_to = ?
      GROUP BY status
    `)
    .bind(session.userId)
    .all();
  const taskStats = taskStatsRaw as unknown as TaskStat[];

  // Helper to get count by status
  const getCount = (status: string) =>
    taskStats.find((s) => s.status === status)?.count ?? 0;

  const totalAssigned = taskStats.reduce((a, s) => a + s.count, 0);

  // 3. Distinct projects count
  const projectsCount = await db
    .prepare('SELECT COUNT(DISTINCT project_id) as count FROM tasks WHERE assigned_to = ?')
    .bind(session.userId)
    .first() as { count: number } | null;

  const initials = (session.name || 'KH')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at * 1000).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';

  const stats = [
    { label: 'Tasks Assigned', value: totalAssigned, color: 'text-zinc-700 dark:text-zinc-200' },
    { label: 'Completed', value: getCount('COMPLETED'), color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'In Review', value: getCount('IN_REVIEW'), color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Projects Involved', value: projectsCount?.count ?? 0, color: 'text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
          My Profile
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Your account identity, clearance level, and performance overview.
        </p>
      </div>

      {/* Identity Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          {session.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.avatar}
              alt={session.name}
              className="w-20 h-20 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 shadow-sm object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-sm uppercase shrink-0">
              {initials}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 truncate">{session.name}</h2>
              {profile?.role_name && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/15 px-3 py-1 rounded-full">
                  {profile.role_name}
                </span>
              )}
              {profile?.status && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 px-3 py-1 rounded-full">
                  {profile.status}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{session.email}</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-2">
              Member since: {memberSince}
            </p>
          </div>
        </div>
      </div>

      {/* Task Performance Stats */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
        <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">Performance Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider mt-1.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Task Breakdown */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
        <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">Task Status Breakdown</h3>
        <div className="space-y-3">
          {[
            { status: 'TODO', label: 'Todo', color: 'bg-zinc-200 dark:bg-zinc-700' },
            { status: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
            { status: 'IN_REVIEW', label: 'In Review', color: 'bg-yellow-500' },
            { status: 'APPROVED', label: 'Approved', color: 'bg-emerald-500' },
            { status: 'COMPLETED', label: 'Completed', color: 'bg-purple-500' },
          ].map(({ status, label, color }) => {
            const count = getCount(status);
            const pct = totalAssigned > 0 ? Math.round((count / totalAssigned) * 100) : 0;
            return (
              <div key={status} className="flex items-center gap-4">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 w-24 shrink-0">{label}</span>
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${color} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account Security */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
        <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">Account Security</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-900">
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Authentication</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
              ✓ Google OAuth 2.0
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-900">
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Session Store</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/5 border border-blue-500/10 px-3 py-1 rounded-full">
              Cloudflare KV
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Access Control</span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/5 border border-purple-500/10 px-3 py-1 rounded-full">
              RBAC — {profile?.role_name || 'CREATOR'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
