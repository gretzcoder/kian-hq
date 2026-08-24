'use server';

import { getDB } from '@/db/client';
import { getSession } from '@/modules/auth/session';
import { 
  getAchievementMeta, 
  getWeekPeriodLabel, 
  getMonthPeriodLabel,
  getWeeklySaturdayTimestamp,
  getMonthlyLastDayTimestamp,
} from './utils';
import { getLeaderboardData } from '@/modules/leaderboard/actions';

export interface AchievementItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  userRole?: string | null;
  achievementType: string;
  title: string;
  period: string;
  rank: number;
  score: number;
  category: string;
  earnedAt: number;
}

export interface UserAchievementSummary {
  achievementType: string;
  title: string;
  category: string;
  emoji: string;
  totalCount: number;
  lastEarnedAt: number;
  lastPeriod: string;
  streakCount: number;
  color: string;
}

/** Ensure achievement_history table exists */
export async function ensureAchievementHistoryTable() {
  try {
    const db = await getDB();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS achievement_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        achievement_type TEXT NOT NULL,
        title TEXT NOT NULL,
        period TEXT NOT NULL,
        rank INTEGER NOT NULL DEFAULT 1,
        score INTEGER NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT 'GENERAL',
        earned_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_achievement_history_user ON achievement_history(user_id)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_achievement_history_category ON achievement_history(category)`).run();
  } catch (err) {
    console.error('ensureAchievementHistoryTable error:', err);
  }
}

/** Get Full Achievement History across system or for specific user/category */
export async function getAchievementHistoryAction(categoryFilter = 'ALL', userIdFilter = '') {
  try {
    await ensureAchievementHistoryTable();
    await syncLeaderboardAchievements();

    const db = await getDB();
    let query = `
      SELECT 
        ah.id,
        ah.user_id as userId,
        u.name as userName,
        u.email as userEmail,
        u.avatar_url as userAvatar,
        r.name as userRole,
        ah.achievement_type as achievementType,
        ah.title,
        ah.period,
        ah.rank,
        ah.score,
        ah.category,
        ah.earned_at as earnedAt
      FROM achievement_history ah
      JOIN users u ON ah.user_id = u.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id NOT IN (
        SELECT ur2.user_id
        FROM user_roles ur2
        JOIN roles r2 ON ur2.role_id = r2.id
        WHERE r2.id IN ('role_coordinator', 'role_executive') OR r2.name IN ('COORDINATOR', 'EXECUTIVE', 'KOORDINATOR')
      )
      AND u.email NOT LIKE '%admin@kian.com%'
    `;

    const params: any[] = [];

    if (userIdFilter) {
      query += ` AND ah.user_id = ?`;
      params.push(userIdFilter);
    }

    query += ` ORDER BY ah.earned_at DESC, ah.created_at DESC`;

    const { results } = await db.prepare(query).bind(...params).all();
    return (results as any[]) || [];
  } catch (err) {
    console.error('getAchievementHistoryAction error:', err);
    return [];
  }
}

/** Get User Achievement Counter, Last Date & Streak Summary for Profile/Leaderboard */
export async function getUserAchievementStatsAction(userId: string) {
  try {
    await ensureAchievementHistoryTable();
    await syncLeaderboardAchievements();

    const db = await getDB();
    const { results } = await db.prepare(`
      SELECT achievement_type, title, category, rank, score, period, earned_at
      FROM achievement_history
      WHERE user_id = ?
      ORDER BY earned_at DESC
    `).bind(userId).all();

    const rows = (results as any[]) || [];
    const map: Record<string, {
      achievementType: string;
      title: string;
      category: string;
      items: Array<{ period: string; earnedAt: number; rank: number; score: number }>;
    }> = {};

    for (const r of rows) {
      const key = r.achievement_type;
      if (!map[key]) {
        map[key] = {
          achievementType: r.achievement_type,
          title: r.title,
          category: r.category,
          items: [],
        };
      }
      map[key].items.push({
        period: r.period,
        earnedAt: r.earned_at,
        rank: r.rank,
        score: r.score,
      });
    }

    const summaries: UserAchievementSummary[] = Object.values(map).map((group) => {
      const totalCount = group.items.length;
      const lastItem = group.items[0]; // Most recent
      const meta = getAchievementMeta(group.achievementType, group.category);

      // Calculate Streak (Consecutive period wins)
      let streakCount = 1;
      for (let i = 0; i < group.items.length - 1; i++) {
        // If earnedAt timestamp difference is within ~10 days (for weekly) or ~35 days (for monthly)
        const diffDays = Math.abs(group.items[i].earnedAt - group.items[i + 1].earnedAt) / (24 * 3600);
        if (diffDays <= 36) {
          streakCount++;
        } else {
          break;
        }
      }

      return {
        achievementType: group.achievementType,
        title: group.title,
        category: group.category,
        emoji: meta.emoji,
        totalCount,
        lastEarnedAt: lastItem.earnedAt,
        lastPeriod: lastItem.period,
        streakCount: totalCount > 1 ? streakCount : 1,
        color: meta.color,
      };
    });

    return summaries;
  } catch (err) {
    console.error('getUserAchievementStatsAction error:', err);
    return [];
  }
}

/** Get User Active Champion Streak String for Leaderboard (e.g. "🔥 3 Weeks Streak" or "🏆 4x Champion") */
export async function getUserStreakBadgeMapAction(): Promise<Record<string, string>> {
  try {
    await ensureAchievementHistoryTable();

    const db = await getDB();
    const { results } = await db.prepare(`
      SELECT user_id, achievement_type, title, period, earned_at
      FROM achievement_history
      ORDER BY user_id, earned_at DESC
    `).all();

    const userMap: Record<string, string> = {};
    const rows = (results as any[]) || [];

    const groupedByUser: Record<string, any[]> = {};
    for (const r of rows) {
      if (!groupedByUser[r.user_id]) groupedByUser[r.user_id] = [];
      groupedByUser[r.user_id].push(r);
    }

    for (const [uId, items] of Object.entries(groupedByUser)) {
      const weeklyWins = items.filter((x) => x.achievement_type === 'WEEKLY_CHAMPION');
      if (weeklyWins.length > 0) {
        if (weeklyWins.length >= 2) {
          userMap[uId] = `🔥 ${weeklyWins.length}x Champion`;
        } else {
          userMap[uId] = `🏆 1x Champion`;
        }
      } else if (items.length > 0) {
        userMap[uId] = `🌟 ${items.length}x Title Winner`;
      }
    }

    return userMap;
  } catch (err) {
    console.error('getUserStreakBadgeMapAction error:', err);
    return {};
  }
}

/** Seed & Dynamically Sync Top 3 Leaderboard Winners into achievement_history */
export async function syncLeaderboardAchievements() {
  try {
    const db = await getDB();
    const nowSec = Math.floor(Date.now() / 1000);
    const weekLabel = getWeekPeriodLabel();
    const saturdayTs = getWeeklySaturdayTimestamp();

    const leaderboardCategories: Array<{
      id:
        | 'overall'
        | 'productive'
        | 'quality'
        | 'role_mentor_troopers'
        | 'role_designer'
        | 'role_editor'
        | 'role_planner'
        | 'role_researcher'
        | 'role_leader';
      categoryKey: string;
      labelName: string;
    }> = [
      { id: 'overall', categoryKey: 'CHAMPION', labelName: 'Champion' },
      { id: 'productive', categoryKey: 'PRODUCTIVE', labelName: 'Productive' },
      { id: 'quality', categoryKey: 'QUALITY', labelName: 'Quality' },
      { id: 'role_mentor_troopers', categoryKey: 'MENTOR', labelName: 'Mentor' },
      { id: 'role_leader', categoryKey: 'TEAM_LEADER', labelName: 'Team Leader' },
      { id: 'role_designer', categoryKey: 'DESIGNER', labelName: 'Designer' },
      { id: 'role_editor', categoryKey: 'VIDEO_EDITOR', labelName: 'Video Editor' },
      { id: 'role_planner', categoryKey: 'PLANNER', labelName: 'Planner' },
      { id: 'role_researcher', categoryKey: 'RESEARCHER', labelName: 'Researcher' },
    ];

    for (const cat of leaderboardCategories) {
      try {
        const lbResult = await getLeaderboardData(cat.id, 'month');
        const topItems = (lbResult.data || []).slice(0, 3);

        for (let i = 0; i < topItems.length; i++) {
          const item = topItems[i];
          const rankNum = i + 1;
          const winnerUserId = (item as any).userId || (item as any).leaderId || (item as any).id;
          const score = item.totalSparks || (item as any).score || 0;

          if (!winnerUserId || (score <= 0 && !(item as any).tasksCompleted)) continue;

          // Compute Rank Title
          let title = '';
          if (cat.categoryKey === 'CHAMPION') {
            if (rankNum === 1) title = `Weekly Champion`;
            else if (rankNum === 2) title = `Runner-Up Champion (Weekly)`;
            else title = `3rd Place Champion (Weekly)`;
          } else {
            if (rankNum === 1) title = `Top 1 ${cat.labelName} (Weekly)`;
            else if (rankNum === 2) title = `Top 2 ${cat.labelName} (Weekly)`;
            else title = `Top 3 ${cat.labelName} (Weekly)`;
          }

          const typeKey = `${cat.categoryKey}_RANK${rankNum}_WEEKLY`;

          const existing = (await db.prepare(`
            SELECT id FROM achievement_history
            WHERE category = ? AND period = ? AND rank = ?
          `).bind(cat.categoryKey, weekLabel, rankNum).first()) as any;

          if (existing) {
            await db.prepare(`
              UPDATE achievement_history
              SET user_id = ?, achievement_type = ?, title = ?, score = ?, earned_at = ?
              WHERE id = ?
            `).bind(
              winnerUserId,
              typeKey,
              title,
              score,
              saturdayTs,
              existing.id
            ).run();
          } else {
            const newId = `ach_${Math.random().toString(36).substring(2, 10)}`;
            await db.prepare(`
              INSERT INTO achievement_history
              (id, user_id, achievement_type, title, period, rank, score, category, earned_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newId,
              winnerUserId,
              typeKey,
              title,
              weekLabel,
              rankNum,
              score,
              cat.categoryKey,
              saturdayTs,
              nowSec
            ).run();
          }
        }
      } catch (catErr) {
        // Ignore individual category sync error
      }
    }
  } catch (err) {
    console.error('syncLeaderboardAchievements error:', err);
  }
}
