import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getLeaderboardData } from '@/modules/leaderboard/actions';
import Link from 'next/link';
import LeaderboardCategorySelect from '@/modules/leaderboard/components/LeaderboardCategorySelect';

interface LeaderboardPageProps {
  searchParams: Promise<{ category?: string; period?: string }>;
}

const CATEGORIES = [
  { id: 'overall', label: '🏆 Champion', icon: '🏆' },
  { id: 'productive', label: '⚡ Most Productive', icon: '⚡' },
  { id: 'quality', label: '🎯 High Quality', icon: '🎯' },
  { id: 'workspace', label: '🏢 Top Workspaces', icon: '🏢' },
  { id: 'coordinator', label: '👑 Top Mentors', icon: '👑' },
  { id: 'role_designer', label: '🎨 Top Designers', icon: '🎨' },
  { id: 'role_editor', label: '🎬 Top Video Editors', icon: '🎬' },
  { id: 'role_planner', label: '💡 Top Planners', icon: '💡' },
];

const PERIODS = [
  { id: 'month', label: '🗓️ Bulan Ini' },
  { id: 'week', label: '📅 Minggu Ini' },
  { id: 'all', label: '♾️ All-Time' },
];

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const params = await searchParams;
  const activeCategory = (params.category || 'overall') as any;
  const activePeriod = (params.period || 'month') as any;

  const leaderboardResult = await getLeaderboardData(activeCategory, activePeriod);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 dark:from-amber-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <span>🏆</span> Hall of Fame
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm mt-1">
            Peringkat pencapaian & apresiasi karya tim Kian HQ.
          </p>
        </div>

        {/* Period Selector (Segmented Pill) */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 self-start sm:self-auto w-full sm:w-auto">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/leaderboard?category=${activeCategory}&period=${p.id}`}
              className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePeriod === p.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Category Selection: Mobile Dropdown vs Desktop Pills */}
      <LeaderboardCategorySelect
        categories={CATEGORIES}
        activeCategory={activeCategory}
        activePeriod={activePeriod}
      />

      {/* Desktop Pills */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={`/dashboard/leaderboard?category=${cat.id}&period=${activePeriod}`}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
              activeCategory === cat.id
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md shadow-purple-500/20'
                : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Main Leaderboard Display */}
      {leaderboardResult.type === 'individual' && (
        <IndividualLeaderboardView data={leaderboardResult.data as any} currentUserId={session.userId} />
      )}

      {leaderboardResult.type === 'workspace' && (
        <WorkspaceLeaderboardView data={leaderboardResult.data as any} />
      )}

      {leaderboardResult.type === 'coordinator' && (
        <CoordinatorLeaderboardView data={leaderboardResult.data as any} currentUserId={session.userId} />
      )}
    </div>
  );
}

/* Individual Leaderboard Component */
function IndividualLeaderboardView({ data, currentUserId }: { data: any[]; currentUserId: string }) {
  if (data.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-zinc-500 text-sm font-medium">Belum ada data peringkat untuk periode ini.</p>
      </div>
    );
  }

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className="space-y-8">
      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
          {/* #2 Silver (Left) */}
          {top3[1] ? (
            <PodiumCard user={top3[1]} rank={2} medal="🥈" color="border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40" />
          ) : <div className="hidden md:block" />}

          {/* #1 Gold (Center - Higher) */}
          {top3[0] && (
            <PodiumCard user={top3[0]} rank={1} medal="🥇" color="border-amber-400 dark:border-amber-500/60 bg-amber-500/10 dark:bg-amber-500/10 -translate-y-2 md:-translate-y-4 shadow-lg shadow-amber-500/10" />
          )}

          {/* #3 Bronze (Right) */}
          {top3[2] ? (
            <PodiumCard user={top3[2]} rank={3} medal="🥉" color="border-amber-700/40 dark:border-amber-800/40 bg-amber-900/5 dark:bg-amber-900/10" />
          ) : <div className="hidden md:block" />}
        </div>
      )}

      {/* Rest Rankings Table */}
      {rest.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Peringkat Keseluruhan Tim
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {rest.map((user) => {
              const isMe = user.userId === currentUserId;
              return (
                <div
                  key={user.userId}
                  className={`px-6 py-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                    isMe ? 'bg-purple-500/10 dark:bg-purple-500/10 font-bold' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 text-center text-xs font-black font-mono text-zinc-400">
                      #{user.rank}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300">
                      {user.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span>{user.userName}</span>
                        {isMe && (
                          <span className="text-[9px] bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full">
                            Anda
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                        {user.primaryRole} • {user.tasksCompleted} Tasks Completed
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-black text-purple-600 dark:text-purple-400 flex items-center justify-end gap-1">
                        <span>{user.totalSparks}</span>
                        <span>✨</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {user.zeroRevisionCount} Direct Pass
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ user, rank, medal, color }: { user: any; rank: number; medal: string; color: string }) {
  return (
    <div className={`border rounded-3xl p-6 text-center space-y-3 relative overflow-hidden ${color}`}>
      <div className="text-4xl">{medal}</div>
      <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-purple-500/30 flex items-center justify-center mx-auto text-xl font-bold text-zinc-800 dark:text-zinc-200">
        {user.userName.charAt(0).toUpperCase()}
      </div>
      <div>
        <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{user.userName}</h4>
        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest block mt-0.5">
          {user.primaryRole}
        </span>
      </div>
      <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <div className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-1">
          <span>{user.totalSparks}</span>
          <span>✨</span>
        </div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
          {user.tasksCompleted} Tasks Approved
        </div>
      </div>
    </div>
  );
}

/* Workspace Leaderboard Component */
function WorkspaceLeaderboardView({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
        <p className="text-4xl mb-3">🏢</p>
        <p className="text-zinc-500 text-sm font-medium">Belum ada data peringkat workspace.</p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl overflow-hidden shadow-sm">
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {data.map((ws) => (
          <div key={ws.workspaceId} className="p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center gap-4">
              <span className="w-8 text-center text-sm font-black font-mono text-zinc-400">
                #{ws.rank}
              </span>
              <div>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{ws.workspaceName}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Proyek: <span className="font-semibold">{ws.projectName}</span> • {ws.membersCount} Members
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-lg font-black text-purple-600 dark:text-purple-400 flex items-center justify-end gap-1">
                  <span>{ws.totalSparks}</span>
                  <span>✨</span>
                </div>
                <div className="text-xs text-zinc-400 font-mono">{ws.tasksCompleted} Tasks Completed</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Coordinator Leaderboard Component */
function CoordinatorLeaderboardView({ data, currentUserId }: { data: any[]; currentUserId: string }) {
  if (data.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
        <p className="text-4xl mb-3">👑</p>
        <p className="text-zinc-500 text-sm font-medium">Belum ada data peringkat mentor.</p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl overflow-hidden shadow-sm">
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {data.map((c) => (
          <div key={c.userId} className="p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center gap-4">
              <span className="w-8 text-center text-sm font-black font-mono text-zinc-400">
                #{c.rank}
              </span>
              <div>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{c.userName}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {c.reviewsProcessed} Reviews Processed • Avg {c.avgSparksAwarded} Sparks Awarded
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-black text-amber-500 flex items-center justify-end gap-1">
                <span>{c.totalSparksGiven}</span>
                <span>✨</span>
              </div>
              <div className="text-xs text-zinc-400 font-mono">Total Sparks Awarded</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
