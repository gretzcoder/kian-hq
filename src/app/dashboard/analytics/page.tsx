import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { redirect } from 'next/navigation';

interface StatusCount { status: string; count: number; }
interface UserStat { name: string; completed: number; total: number; sparks: number; }
interface OverdueTask { title: string; project_name: string; deadline: number; assigned_name: string | null; }
interface TokenLog { intent_detected: string; tokens_used: number; model_used: string; timestamp: number; }
interface WeeklyTask { week: number; count: number; }

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);
  if (!ctx.can('EXPORT_DATA') && !ctx.can('ADMIN_SYSTEM')) {
    redirect('/dashboard');
  }

  const canManage = ctx.can('ADMIN_SYSTEM');
  const db = await getDB();
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const thirtyDaysAgoSec = nowSec - 30 * 24 * 60 * 60;
  const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  // --- Parallel Real-Time Database Queries ---
  const [
    projectStatusRaw,
    taskStatusRaw,
    totalWorkspacesRaw,
    totalUsersRaw,
    overdueRaw,
    userStatsRaw,
    tokenLogsRaw,
    weeklyRaw,
    completedThisMonthRaw,
    sparksSumRaw,
    contentBriefStatusRaw,
  ] = await Promise.all([
    // 1. Projects by status (active projects)
    db.prepare('SELECT status, COUNT(*) as count FROM projects GROUP BY status').all(),

    // 2. Tasks by status (EXCLUDING DELETED TASKS)
    db.prepare("SELECT status, COUNT(*) as count FROM tasks WHERE status != 'DELETED' GROUP BY status").all(),

    // 3. Total active workspaces
    db.prepare('SELECT COUNT(*) as count FROM workspaces WHERE deleted_at IS NULL').first() as Promise<{ count: number }>,

    // 4. Total registered active users
    db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'ACTIVE'").first() as Promise<{ count: number }>,

    // 5. Overdue tasks (EXCLUDING DELETED TASKS)
    db.prepare(`
      SELECT t.title, p.name as project_name, t.deadline, u.name as assigned_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.assignment_role = 'PIC'
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE t.deadline IS NOT NULL
        AND t.deadline < ?
        AND t.status NOT IN ('COMPLETED', 'APPROVED', 'DELETED')
      ORDER BY t.deadline ASC
      LIMIT 10
    `).bind(nowMs).all(),

    // 6. User performance stats (EXCLUDING DELETED TASKS)
    db.prepare(`
      SELECT u.name,
        SUM(CASE WHEN ta.status = 'APPROVED' OR t.status IN ('COMPLETED', 'APPROVED') THEN 1 ELSE 0 END) as completed,
        COUNT(ta.id) as total,
        COALESCE(SUM(CASE WHEN ta.status = 'APPROVED' THEN ta.sparks ELSE 0 END), 0) as sparks
      FROM users u
      JOIN task_assignments ta ON ta.user_id = u.id
      JOIN tasks t ON ta.task_id = t.id AND t.status != 'DELETED'
      WHERE u.status = 'ACTIVE'
      GROUP BY u.id, u.name
      HAVING COUNT(ta.id) > 0
      ORDER BY completed DESC, sparks DESC
      LIMIT 8
    `).all(),

    // 7. AI token logs (last 30 days)
    db.prepare(`
      SELECT intent_detected, tokens_used, model_used, timestamp
      FROM ai_token_logs
      WHERE timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).bind(thirtyDaysAgoSec).all(),

    // 8. Non-deleted tasks created weekly (last 4 weeks)
    db.prepare(`
      SELECT CAST((? - created_at) / 604800000 AS INTEGER) as week, COUNT(*) as count
      FROM tasks
      WHERE created_at > ? AND status != 'DELETED'
      GROUP BY week
      ORDER BY week ASC
    `).bind(nowMs, nowMs - 4 * 604800000).all(),

    // 9. Tasks completed this month (non-deleted)
    db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE status IN ('COMPLETED', 'APPROVED') AND status != 'DELETED' AND created_at > ?
    `).bind(thirtyDaysAgoMs).first() as Promise<{ count: number }>,

    // 10. Total Creative Sparks awarded across approved assessment submissions
    db.prepare(`
      SELECT COALESCE(SUM(ta.sparks), 0) as total_sparks
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE t.status != 'DELETED' AND ta.status = 'APPROVED'
    `).first() as Promise<{ total_sparks: number }>,

    // 11. Content briefs by status
    db.prepare('SELECT status, COUNT(*) as count FROM content_briefs GROUP BY status').all(),
  ]);

  const projectStatuses = projectStatusRaw.results as unknown as StatusCount[];
  const rawTaskStatuses = taskStatusRaw.results as unknown as StatusCount[];
  const overdueTasks = overdueRaw.results as unknown as OverdueTask[];
  const userStats = userStatsRaw.results as unknown as UserStat[];
  const tokenLogs = tokenLogsRaw.results as unknown as TokenLog[];
  const weeklyTasks = weeklyRaw.results as unknown as WeeklyTask[];
  const briefStatuses = contentBriefStatusRaw.results as unknown as StatusCount[];

  // Helper to count status from DB array matching specific keys (case-insensitive)
  const countMatching = (arr: StatusCount[], keys: string[]) => {
    return arr
      .filter((s) => keys.includes(s.status.toUpperCase()))
      .reduce((a, s) => a + s.count, 0);
  };

  // Normalized task status counts (EXCLUDING DELETED)
  const todoTasks        = countMatching(rawTaskStatuses, ['ASSIGNED', 'TODO', 'DRAFT']);
  const inProgressTasks  = countMatching(rawTaskStatuses, ['IN_PROGRESS']);
  const inReviewTasks    = countMatching(rawTaskStatuses, ['WAITING_REVIEW', 'IN_REVIEW', 'REVIEW']);
  const revisionTasks    = countMatching(rawTaskStatuses, ['REVISION_REQUESTED']);
  const completedTasks   = countMatching(rawTaskStatuses, ['APPROVED', 'COMPLETED']);

  const totalProjects   = projectStatuses.reduce((a, s) => a + s.count, 0);
  const totalWorkspaces = totalWorkspacesRaw?.count ?? 0;
  const totalTasks      = todoTasks + inProgressTasks + inReviewTasks + revisionTasks + completedTasks;
  const completionRate  = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalSparks     = sparksSumRaw?.total_sparks ?? 0;
  const totalTokens     = tokenLogs.reduce((a, l) => a + l.tokens_used, 0);
  const totalBriefs     = briefStatuses.reduce((a, s) => a + s.count, 0);

  const pct = (val: number, total: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

  const projectStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    PLANNING:    { label: 'Planning',    color: 'bg-yellow-500', bg: 'text-yellow-600 dark:text-yellow-400' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-500',   bg: 'text-blue-600 dark:text-blue-400' },
    REVIEW:      { label: 'Review',      color: 'bg-purple-500', bg: 'text-purple-600 dark:text-purple-400' },
    PUBLISHED:   { label: 'Published',   color: 'bg-emerald-500',bg: 'text-emerald-600 dark:text-emerald-400' },
    ARCHIVED:    { label: 'Archived',    color: 'bg-zinc-400',   bg: 'text-zinc-500 dark:text-zinc-400' },
  };

  const taskStatusBars = [
    { label: '📋 Belum Mulai', count: todoTasks, color: 'bg-zinc-300 dark:bg-zinc-700', text: 'text-zinc-500' },
    { label: '⚙️ Sedang Dikerjakan', count: inProgressTasks, color: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
    { label: '📤 Menunggu Review', count: inReviewTasks, color: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' },
    { label: '↩ Perlu Revisi', count: revisionTasks, color: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
    { label: '✅ Disetujui / Selesai', count: completedTasks, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  ];

  const maxWeekly = Math.max(...weeklyTasks.map((w) => w.count), 1);

  return (
    <div className="space-y-8">
      {/* Real-time Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Analytics & Organization Health
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Real-time operational intelligence & progress telemetry from Cloudflare D1.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-3 py-1.5 rounded-full shadow-sm">
            REALTIME — {new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Real-time KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {[
          { label: 'Projects & Workspaces', value: totalProjects, sub: `${totalWorkspaces} active workspaces`, icon: '📁', color: 'text-blue-600 dark:text-blue-400', accent: 'bg-blue-500/5' },
          { label: 'Total Tasks (Aktif)', value: totalTasks, sub: `${inProgressTasks} sedang dikerjakan`, icon: '📝', color: 'text-purple-600 dark:text-purple-400', accent: 'bg-purple-500/5' },
          { label: 'Completion Rate', value: `${completionRate}%`, sub: `${completedTasks} disetujui / selesai`, icon: '📊', color: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500/5' },
          { label: 'Creative Sparks', value: `${totalSparks} ✨`, sub: 'Total poin disetujui', icon: '⚡', color: 'text-amber-600 dark:text-amber-400', accent: 'bg-amber-500/5' },
          { label: 'Team Members', value: totalUsersRaw?.count ?? 0, sub: `${inReviewTasks} tugas dalam review`, icon: '👥', color: 'text-zinc-700 dark:text-zinc-300', accent: 'bg-zinc-500/5' },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-md">
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${kpi.accent} text-lg mb-2.5`}>
              {kpi.icon}
            </div>
            <p className={`text-2xl sm:text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-1 truncate">{kpi.label}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-medium truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Realtime Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Realtime Task Status Distribution */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Task Status Distribution (Active Tasks)
            </h3>
            <span className="text-xs font-black text-purple-600 dark:text-purple-400">
              {totalTasks} Total
            </span>
          </div>
          <div className="space-y-4">
            {taskStatusBars.map((item) => {
              const percentage = pct(item.count, totalTasks);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 w-36 shrink-0 truncate">
                    {item.label}
                  </span>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${item.color} transition-all duration-700`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className={`text-xs font-black w-10 text-right ${item.text}`}>
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
          {totalTasks === 0 && (
            <p className="text-zinc-400 text-xs text-center mt-6 py-4">Belum ada tugas aktif saat ini.</p>
          )}
        </div>

        {/* Project Status Distribution */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Project Status Distribution
            </h3>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400">
              {totalProjects} Projects
            </span>
          </div>
          <div className="space-y-3.5">
            {Object.entries(projectStatusConfig).map(([status, cfg]) => {
              const count = projectStatuses.find((s) => s.status === status)?.count ?? 0;
              const p = pct(count, totalProjects);
              return (
                <div key={status} className="flex items-center gap-4">
                  <span className={`text-xs font-bold w-28 shrink-0 ${cfg.bg}`}>{cfg.label}</span>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full ${cfg.color} transition-all duration-700`}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-zinc-600 dark:text-zinc-400 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
          {totalProjects === 0 && (
            <p className="text-zinc-400 text-xs text-center mt-6 py-4">Belum ada project tersimpan.</p>
          )}
        </div>

        {/* Weekly Task Activity Trend */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">
            Task Activity Trend — Last 4 Weeks
            <span className="ml-2 normal-case font-medium text-zinc-400">
              (Selesai bulan ini: {completedThisMonthRaw?.count ?? 0})
            </span>
          </h3>
          {weeklyTasks.length === 0 ? (
            <div className="flex items-end justify-center gap-3 h-28">
              {[0, 0, 0, 0].map((_, i) => (
                <div key={i} className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-t-lg" style={{ height: '8px' }} />
              ))}
            </div>
          ) : (
            <div className="flex items-end justify-around gap-3 h-28">
              {[3, 2, 1, 0].map((weekAgo) => {
                const w = weeklyTasks.find((wt) => wt.week === weekAgo);
                const count = w?.count ?? 0;
                const heightPct = maxWeekly > 0 ? (count / maxWeekly) * 100 : 0;
                const labels = ['4w ago', '3w ago', '2w ago', 'Minggu Ini'];
                return (
                  <div key={weekAgo} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">{count}</span>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-t-lg relative overflow-hidden" style={{ height: '80px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-purple-500 rounded-t-lg transition-all duration-700"
                        style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold whitespace-nowrap">{labels[3 - weekAgo]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Briefs Summary */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Content Briefs Summary
            </h3>
            <span className="text-xs font-black text-purple-600 dark:text-purple-400">
              {totalBriefs} Briefs
            </span>
          </div>
          {briefStatuses.length === 0 ? (
            <p className="text-zinc-400 text-xs text-center py-6">Belum ada content brief.</p>
          ) : (
            <div className="space-y-3.5">
              {briefStatuses.map((b) => {
                const percentage = pct(b.count, totalBriefs);
                return (
                  <div key={b.status} className="flex items-center gap-4">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 w-28 shrink-0 uppercase tracking-wider text-[11px]">
                      {b.status}
                    </span>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-zinc-600 dark:text-zinc-400 w-8 text-right">
                      {b.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Performance & Top Performers */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm lg:col-span-2">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">
            Team Performance & Leaderboard Progress
          </h3>
          {userStats.length === 0 ? (
            <p className="text-zinc-400 text-xs text-center py-6">Belum ada aktivitas penugasan peserta.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userStats.map((user, idx) => {
                const completionPct = user.total > 0 ? Math.round((user.completed / user.total) * 100) : 0;
                return (
                  <div key={user.name} className="flex items-center gap-3.5 p-3 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/30 border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{user.name}</span>
                        <div className="flex items-center gap-2 text-[10px] font-bold shrink-0 ml-2">
                          <span className="text-purple-600 dark:text-purple-400">{user.completed}/{user.total} selesai</span>
                          {user.sparks > 0 && (
                            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded-full border border-amber-500/20 font-black">
                              ✨ {user.sparks}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-black text-purple-600 dark:text-purple-400 w-9 text-right shrink-0">{completionPct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Organization Health — Overdue Tasks */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Organization Health — Overdue Tasks
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Tugas aktif yang telah melewati tenggat waktu dan memerlukan perhatian tim.
            </p>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
            overdueTasks.length === 0
              ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10'
              : overdueTasks.length < 3
              ? 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10'
              : 'bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/10'
          }`}>
            {overdueTasks.length === 0 ? '✓ Semua Aman' : `⚠ ${overdueTasks.length} Terlambat`}
          </span>
        </div>

        {overdueTasks.length === 0 ? (
          <div className="border border-dashed border-emerald-500/15 bg-emerald-500/5 rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Tidak ada tugas terlambat!</p>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Semua tugas aktif berjalan sesuai tenggat waktu yang ditentukan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Tugas</th>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Penanggung Jawab</th>
                  <th className="pb-3">Keterlambatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {overdueTasks.map((task, idx) => {
                  const daysOverdue = Math.max(1, Math.floor((nowMs - task.deadline) / (86400 * 1000)));
                  return (
                    <tr key={idx} className="text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                      <td className="py-3 pr-4 font-bold text-zinc-800 dark:text-zinc-200 max-w-[200px] truncate">{task.title}</td>
                      <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400 text-xs">{task.project_name}</td>
                      <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400 text-xs">{task.assigned_name || 'Peserta OJT'}</td>
                      <td className="py-3">
                        <span className="text-[10px] font-black text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 px-2.5 py-1 rounded-full">
                          {daysOverdue} hari terlambat
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Token Usage — Only for ADMIN users */}
      {canManage && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                AI Token Usage — Last 30 Days
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Penggunaan inferensi Cloudflare Workers AI dan konsumsi token sistem.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{totalTokens.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold">estimasi total token</p>
            </div>
          </div>

          {tokenLogs.length === 0 ? (
            <p className="text-zinc-400 text-xs text-center py-4">Belum ada riwayat aktivitas AI dalam 30 hari terakhir.</p>
          ) : (
            <div className="space-y-2">
              {tokenLogs.slice(0, 8).map((log, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-2.5 border-b border-zinc-100 dark:border-zinc-900 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/10 px-2 py-0.5 rounded-full">
                      {log.intent_detected}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">
                      {new Date(log.timestamp * 1000).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}
                    </span>
                  </div>
                  <span className="font-black text-zinc-700 dark:text-zinc-300">{log.tokens_used.toLocaleString()} tokens</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
