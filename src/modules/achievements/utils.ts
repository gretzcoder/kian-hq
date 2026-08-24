/** Pure utility functions for achievements */

export interface LeaderboardCategoryMeta {
  id: string;
  label: string;
  emoji: string;
  weeklyTitle: string;
  monthlyTitle: string;
  color: string;
  badgeBg: string;
}

export const LEADERBOARD_CATEGORIES_META: Record<string, LeaderboardCategoryMeta> = {
  CHAMPION: {
    id: 'CHAMPION',
    label: 'Champion',
    emoji: '🏆',
    weeklyTitle: 'Weekly Champion',
    monthlyTitle: 'Monthly Champion',
    color: 'from-amber-500/20 to-yellow-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  PRODUCTIVE: {
    id: 'PRODUCTIVE',
    label: 'Most Productive',
    emoji: '⚡',
    weeklyTitle: 'Top Productive (Weekly)',
    monthlyTitle: 'Top Productive (Monthly)',
    color: 'from-yellow-500/20 to-amber-600/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    badgeBg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  QUALITY: {
    id: 'QUALITY',
    label: 'High Quality',
    emoji: '🎯',
    weeklyTitle: 'Top Quality (Weekly)',
    monthlyTitle: 'Top Quality (Monthly)',
    color: 'from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
    badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  WORKSPACE: {
    id: 'WORKSPACE',
    label: 'Top Workspaces',
    emoji: '🏢',
    weeklyTitle: 'Top Workspace Team (Weekly)',
    monthlyTitle: 'Top Workspace Team (Monthly)',
    color: 'from-sky-500/20 to-blue-600/20 text-sky-600 dark:text-sky-400 border-sky-500/30',
    badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  },
  MENTOR: {
    id: 'MENTOR',
    label: 'Top Mentors',
    emoji: '🎓',
    weeklyTitle: 'Top Mentor (Weekly)',
    monthlyTitle: 'Top Mentor (Monthly)',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  TEAM_LEADER: {
    id: 'TEAM_LEADER',
    label: 'Top Team Leaders',
    emoji: '👑',
    weeklyTitle: 'Top Team Leader (Weekly)',
    monthlyTitle: 'Top Team Leader (Monthly)',
    color: 'from-indigo-500/20 to-purple-600/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  DESIGNER: {
    id: 'DESIGNER',
    label: 'Top Designers',
    emoji: '🎨',
    weeklyTitle: 'Top Designer (Weekly)',
    monthlyTitle: 'Top Designer (Monthly)',
    color: 'from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  VIDEO_EDITOR: {
    id: 'VIDEO_EDITOR',
    label: 'Top Video Editors',
    emoji: '🎬',
    weeklyTitle: 'Top Video Editor (Weekly)',
    monthlyTitle: 'Top Video Editor (Monthly)',
    color: 'from-pink-500/20 to-rose-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
    badgeBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  },
  PLANNER: {
    id: 'PLANNER',
    label: 'Top Planners',
    emoji: '🧠',
    weeklyTitle: 'Top Planner (Weekly)',
    monthlyTitle: 'Top Planner (Monthly)',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  RESEARCHER: {
    id: 'RESEARCHER',
    label: 'Top Researchers',
    emoji: '🔍',
    weeklyTitle: 'Top Researcher (Weekly)',
    monthlyTitle: 'Top Researcher (Monthly)',
    color: 'from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
};

export function getAchievementMeta(type: string, category: string) {
  const cUpper = category.toUpperCase();

  if (LEADERBOARD_CATEGORIES_META[cUpper]) {
    return LEADERBOARD_CATEGORIES_META[cUpper];
  }

  const tUpper = type.toUpperCase();
  if (tUpper.includes('WEEKLY') || tUpper.includes('CHAMPION')) {
    return LEADERBOARD_CATEGORIES_META.CHAMPION;
  }
  if (tUpper.includes('DESIGN')) return LEADERBOARD_CATEGORIES_META.DESIGNER;
  if (tUpper.includes('EDITOR') || tUpper.includes('VIDEO')) return LEADERBOARD_CATEGORIES_META.VIDEO_EDITOR;
  if (tUpper.includes('PLANNER')) return LEADERBOARD_CATEGORIES_META.PLANNER;
  if (tUpper.includes('RESEARCH')) return LEADERBOARD_CATEGORIES_META.RESEARCHER;
  if (tUpper.includes('MENTOR')) return LEADERBOARD_CATEGORIES_META.MENTOR;
  if (tUpper.includes('LEADER')) return LEADERBOARD_CATEGORIES_META.TEAM_LEADER;
  if (tUpper.includes('PRODUCTIVE')) return LEADERBOARD_CATEGORIES_META.PRODUCTIVE;
  if (tUpper.includes('QUALITY')) return LEADERBOARD_CATEGORIES_META.QUALITY;
  if (tUpper.includes('WORKSPACE')) return LEADERBOARD_CATEGORIES_META.WORKSPACE;

  return {
    id: 'GENERAL',
    label: 'General',
    emoji: '🎖️',
    weeklyTitle: 'Achievement Winner',
    monthlyTitle: 'Achievement Winner',
    color: 'from-zinc-500/20 to-zinc-700/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
    badgeBg: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  };
}

/** Calculate current Week string e.g. "Week 4 Aug 2026" (Saturday 24:00 cutoff) */
export function getWeekPeriodLabel(d = new Date()): string {
  const dayOfMonth = d.getDate();
  const weekNum = Math.min(4, Math.ceil(dayOfMonth / 7));
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `Week ${weekNum} ${monthName} ${year}`;
}

/** Calculate current Month string e.g. "Aug 2026" (Last day of month cutoff) */
export function getMonthPeriodLabel(d = new Date()): string {
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${monthName} ${year}`;
}
