import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getLeaderboardData } from '@/modules/leaderboard/actions';
import Link from 'next/link';
import { getSessionContext } from '@/modules/roles/rbac';
import LeaderboardCategorySelect from '@/modules/leaderboard/components/LeaderboardCategorySelect';
import { IndividualLeaderboardView } from '@/modules/leaderboard/components/IndividualLeaderboardView';
import { WorkspaceLeaderboardView } from '@/modules/leaderboard/components/WorkspaceLeaderboardView';
import { CoordinatorLeaderboardView } from '@/modules/leaderboard/components/CoordinatorLeaderboardView';

interface LeaderboardPageProps {
  searchParams: Promise<{ category?: string; period?: string }>;
}

const CATEGORIES = [
  { id: 'overall', label: '🏆 Champion', icon: '🏆' },
  { id: 'productive', label: '⚡ Most Productive', icon: '⚡' },
  { id: 'quality', label: '🎯 High Quality', icon: '🎯' },
  { id: 'workspace', label: '🏢 Top Workspaces', icon: '🏢' },
  { id: 'role_mentor_troopers', label: '🎖️ Top Mentors', icon: '🎖️' },
  { id: 'role_leader', label: '👑 Top Team Leaders', icon: '👑' },
  { id: 'role_designer', label: '🎨 Top Designers', icon: '🎨' },
  { id: 'role_editor', label: '🎬 Top Video Editors', icon: '🎬' },
  { id: 'role_planner', label: '📋 Top Planners', icon: '📋' },
  { id: 'role_researcher', label: '🔍 Top Researchers', icon: '🔍' },
];

const PERIODS = [
  { id: 'month', label: '🗓️ Bulan Ini' },
  { id: 'week', label: '📅 Minggu Ini' },
  { id: 'all', label: '♾️ All-Time' },
];

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const [params, ctx] = await Promise.all([
    searchParams,
    getSessionContext(session.userId),
  ]);

  const activeCategory = (params.category || 'overall') as any;
  const activePeriod = (params.period || 'month') as any;

  const isCoordinator = ctx.userType === 'STAFF' && (ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE') || ctx.can('MANAGE') || ctx.can('WORKSPACE_MANAGE'));
  const canManageSparks = ctx.can('SPARKS_MANAGE') || isCoordinator || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');

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
              className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activePeriod === p.id
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
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${activeCategory === cat.id
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
        <IndividualLeaderboardView
          data={leaderboardResult.data as any}
          currentUserId={session.userId}
          category={activeCategory}
          canManageSparks={canManageSparks}
        />
      )}

      {leaderboardResult.type === 'workspace' && (
        <WorkspaceLeaderboardView
          data={leaderboardResult.data as any}
          period={activePeriod}
          canManageSparks={canManageSparks}
        />
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
