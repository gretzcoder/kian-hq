import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { hasPermission } from '@/modules/roles/rbac';
import { redirect } from 'next/navigation';

interface StatusCount { status: string; count: number; }
interface UserStat { name: string; completed: number; total: number; }
interface OverdueTask { title: string; project_name: string; deadline: number; assigned_name: string | null; }
interface TokenLog { intent_detected: string; tokens_used: number; model_used: string; timestamp: number; }
interface WeeklyTask { week: number; count: number; }

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const canManage = await hasPermission(session.userId, 'MANAGE');
  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = nowSec - 30 * 24 * 60 * 60;

  // --- Parallel queries ---
  const [
    projectStatusRaw,
    taskStatusRaw,
    totalUsersRaw,
    overdueRaw,
    userStatsRaw,
    tokenLogsRaw,
    weeklyRaw,
    completedThisMonthRaw,
  ] = await Promise.all([
    // 1. Projects by status
    db.prepare('SELECT status, COUNT(*) as count FROM projects GROUP BY status').all(),
    // 2. Tasks by status
    db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all(),
    // 3. Total users
    db.prepare('SELECT COUNT(*) as count FROM users').first() as Promise<{ count: number }>,
    // 4. Overdue tasks
    db.prepare(`
      SELECT t.title, p.name as project_name, t.deadline, u.name as assigned_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.deadline IS NOT NULL AND t.deadline < ? AND t.status NOT IN ('COMPLETED', 'APPROVED')
      ORDER BY t.deadline ASC
      LIMIT 10
    `).bind(nowSec).all(),
    // 5. Top performers: tasks per user
    db.prepare(`
      SELECT u.name,
        SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        COUNT(t.id) as total
      FROM users u
      LEFT JOIN tasks t ON t.assigned_to = u.id
      GROUP BY u.id, u.name
      HAVING COUNT(t.id) > 0
      ORDER BY completed DESC
      LIMIT 6
    `).all(),
    // 6. AI token logs (last 30 days)
    db.prepare(`
      SELECT intent_detected, tokens_used, model_used, timestamp
      FROM ai_token_logs
      WHERE timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).bind(thirtyDaysAgo).all(),
    // 7. Tasks created weekly (last 4 weeks)
    db.prepare(`
      SELECT CAST((? - created_at) / 604800 AS INTEGER) as week, COUNT(*) as count
      FROM tasks
      WHERE created_at > ?
      GROUP BY week
      ORDER BY week ASC
    `).bind(nowSec, nowSec - 4 * 604800).all(),
    // 8. Tasks completed this month
    db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE status = 'COMPLETED' AND created_at > ?
    `).bind(thirtyDaysAgo).first() as Promise<{ count: number }>,
  ]);

  const projectStatuses = projectStatusRaw.results as unknown as StatusCount[];
  const taskStatuses = taskStatusRaw.results as unknown as StatusCount[];
  const overdueTasks = overdueRaw.results as unknown as OverdueTask[];
  const userStats = userStatsRaw.results as unknown as UserStat[];
  const tokenLogs = tokenLogsRaw.results as unknown as TokenLog[];
  const weeklyTasks = weeklyRaw.results as unknown as WeeklyTask[];

  const totalProjects = projectStatuses.reduce((a, s) => a + s.count, 0);
  const totalTasks = taskStatuses.reduce((a, s) => a + s.count, 0);
  const completedTasks = taskStatuses.find(s => s.status === 'COMPLETED')?.count ?? 0;
  const inProgressTasks = taskStatuses.find(s => s.status === 'IN_PROGRESS')?.count ?? 0;
  const inReviewTasks = taskStatuses.find(s => s.status === 'IN_REVIEW')?.count ?? 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalTokens = tokenLogs.reduce((a, l) => a + l.tokens_used, 0);

  const getCount = (arr: StatusCount[], status: string) => arr.find(s => s.status === status)?.count ?? 0;
  const pct = (val: number, total: number) => total > 0 ? Math.round((val / total) * 100) : 0;

  const projectStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    PLANNING:    { label: 'Planning',    color: 'bg-yellow-500', bg: 'text-yellow-600 dark:text-yellow-400' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-500',   bg: 'text-blue-600 dark:text-blue-400' },
    REVIEW:      { label: 'Review',      color: 'bg-purple-500', bg: 'text-purple-600 dark:text-purple-400' },
    PUBLISHED:   { label: 'Published',   color: 'bg-emerald-500',bg: 'text-emerald-600 dark:text-emerald-400' },
    ARCHIVED:    { label: 'Archived',    color: 'bg-zinc-400',   bg: 'text-zinc-500 dark:text-zinc-400' },
  };

  const taskStatusConfig: Record<string, { label: string; color: string }> = {
    TODO:        { label: 'Todo',        color: 'bg-zinc-300 dark:bg-zinc-700' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-500' },
    IN_REVIEW:   { label: 'In Review',   color: 'bg-yellow-500' },
    APPROVED:    { label: 'Approved',    color: 'bg-emerald-400' },
    COMPLETED:   { label: 'Completed',   color: 'bg-purple-500' },
  };

  // Weekly chart max
  const maxWeekly = Math.max(...weeklyTasks.map(w => w.count), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            Analytics & Organization Health
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Real-time operational intelligence from Cloudflare D1 metadata engine.
          </p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-3 py-1.5 rounded-full shadow-sm self-start sm:self-auto">
          Live — {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects', value: totalProjects, sub: `${getCount(projectStatuses, 'IN_PROGRESS')} in progress`, icon: '📁', color: 'text-blue-600 dark:text-blue-400', accent: 'bg-blue-500/5' },
          { label: 'Total Tasks', value: totalTasks, sub: `${inProgressTasks} active`, icon: '✅', color: 'text-purple-600 dark:text-purple-400', accent: 'bg-purple-500/5' },
          { label: 'Completion Rate', value: `${completionRate}%`, sub: `${completedTasks} completed`, icon: '📊', color: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500/5' },
          { label: 'Team Members', value: totalUsersRaw?.count ?? 0, sub: `${inReviewTasks} tasks in review`, icon: '👥', color: 'text-zinc-700 dark:text-zinc-300', accent: 'bg-zinc-500/5' },
        ].map((kpi) => (
          <div key={kpi.label} className={`border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-5 shadow-sm`}>
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${kpi.accent} text-xl mb-3`}>
              {kpi.icon}
            </div>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-1">{kpi.label}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 font-medium">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Project Status Distribution */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">Project Status Distribution</h3>
          <div className="space-y-3.5">
            {Object.entries(projectStatusConfig).map(([status, cfg]) => {
              const count = getCount(projectStatuses, status);
              const p = pct(count, totalProjects);
              return (
                <div key={status} className="flex items-center gap-4">
                  <span className={`text-xs font-bold w-24 shrink-0 ${cfg.bg}`}>{cfg.label}</span>
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
            <p className="text-zinc-400 text-xs text-center mt-4">No projects yet.</p>
          )}
        </div>

        {/* Task Status Distribution */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">Task Status Distribution</h3>
          <div className="space-y-3.5">
            {Object.entries(taskStatusConfig).map(([status, cfg]) => {
              const count = getCount(taskStatuses, status);
              const p = pct(count, totalTasks);
              return (
                <div key={status} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 w-24 shrink-0">{cfg.label}</span>
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
          {totalTasks === 0 && (
            <p className="text-zinc-400 text-xs text-center mt-4">No tasks yet.</p>
          )}
        </div>

        {/* Weekly Task Activity */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">
            Task Activity — Last 4 Weeks
            <span className="ml-2 normal-case font-medium text-zinc-400">(completed this month: {completedThisMonthRaw?.count ?? 0})</span>
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
                const w = weeklyTasks.find(wt => wt.week === weekAgo);
                const count = w?.count ?? 0;
                const heightPct = maxWeekly > 0 ? (count / maxWeekly) * 100 : 0;
                const labels = ['4w ago', '3w ago', '2w ago', 'This week'];
                return (
                  <div key={weekAgo} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">{count}</span>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-t-lg relative overflow-hidden" style={{ height: '80px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-purple-500 rounded-t-lg transition-all duration-700"
                        style={{ height: `${Math.max(heightPct, count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold whitespace-nowrap">{labels[3 - weekAgo]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Performance */}
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-5">Team Performance</h3>
          {userStats.length === 0 ? (
            <p className="text-zinc-400 text-xs text-center mt-4">No task assignments yet.</p>
          ) : (
            <div className="space-y-4">
              {userStats.map((user, idx) => {
                const completionPct = user.total > 0 ? Math.round((user.completed / user.total) * 100) : 0;
                return (
                  <div key={user.name} className="flex items-center gap-4">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{user.name}</span>
                        <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 shrink-0 ml-2">{user.completed}/{user.total}</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
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

      {/* Organization Health */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Organization Health — Overdue Tasks</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Tasks that have passed their deadline and are not yet completed.</p>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
            overdueTasks.length === 0
              ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10'
              : overdueTasks.length < 3
              ? 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10'
              : 'bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/10'
          }`}>
            {overdueTasks.length === 0 ? '✓ All Clear' : `⚠ ${overdueTasks.length} Overdue`}
          </span>
        </div>

        {overdueTasks.length === 0 ? (
          <div className="border border-dashed border-emerald-500/15 bg-emerald-500/5 rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">No overdue tasks!</p>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">All active tasks are within their deadlines. Excellent work.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Task</th>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Assigned To</th>
                  <th className="pb-3">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {overdueTasks.map((task, idx) => {
                  const daysOverdue = Math.floor((nowSec - task.deadline) / 86400);
                  return (
                    <tr key={idx} className="text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                      <td className="py-3 pr-4 font-bold text-zinc-800 dark:text-zinc-200 max-w-[180px] truncate">{task.title}</td>
                      <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400 text-xs">{task.project_name}</td>
                      <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400 text-xs">{task.assigned_name || 'Unassigned'}</td>
                      <td className="py-3">
                        <span className="text-[10px] font-black text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 px-2.5 py-1 rounded-full">
                          {daysOverdue}d overdue
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

      {/* AI Token Usage — Only for MANAGE users */}
      {canManage && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">AI Token Usage — Last 30 Days</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Workers AI inference calls and token budget consumption.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{totalTokens.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold">estimated tokens used</p>
            </div>
          </div>

          {tokenLogs.length === 0 ? (
            <p className="text-zinc-400 text-xs text-center py-4">No AI queries recorded in the last 30 days.</p>
          ) : (
            <div className="space-y-2">
              {tokenLogs.slice(0, 8).map((log, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-2.5 border-b border-zinc-100 dark:border-zinc-900 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/10 px-2 py-0.5 rounded-full">
                      {log.intent_detected}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">
                      {new Date(log.timestamp * 1000).toLocaleDateString('id-ID')}
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
