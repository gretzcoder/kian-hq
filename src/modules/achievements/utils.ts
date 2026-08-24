/** Pure utility functions for achievements */

export function getAchievementMeta(type: string, category: string) {
  const tUpper = type.toUpperCase();
  const cUpper = category.toUpperCase();

  if (tUpper.includes('WEEKLY') || cUpper === 'WEEKLY') {
    return {
      emoji: '🏆',
      color: 'from-amber-500/20 to-yellow-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  }
  if (tUpper.includes('MONTHLY') || cUpper === 'MONTHLY') {
    return {
      emoji: '👑',
      color: 'from-purple-600/20 to-indigo-600/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };
  }
  if (tUpper.includes('DESIGN') || cUpper === 'DESIGNER') {
    return {
      emoji: '🎨',
      color: 'from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };
  }
  if (tUpper.includes('EDITOR') || tUpper.includes('VIDEO') || cUpper === 'VIDEO_EDITOR') {
    return {
      emoji: '🎬',
      color: 'from-pink-500/20 to-rose-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
      badgeBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    };
  }
  if (tUpper.includes('PLANNER') || cUpper === 'PLANNER') {
    return {
      emoji: '🧠',
      color: 'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  }
  if (tUpper.includes('RESEARCH') || cUpper === 'RESEARCHER') {
    return {
      emoji: '🔍',
      color: 'from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };
  }
  if (tUpper.includes('MENTOR') || cUpper === 'MENTOR') {
    return {
      emoji: '🎓',
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    };
  }

  return {
    emoji: '🎖️',
    color: 'from-zinc-500/20 to-zinc-700/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
    badgeBg: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  };
}
