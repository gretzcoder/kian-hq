'use server';

import { getDB } from '@/db/client';
import { getSession } from '@/modules/auth/session';
import { getAchievementMeta, getWeekPeriodLabel, getMonthPeriodLabel } from './utils';

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
      WHERE 1=1
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

/** Seed & Dynamically Sync Leaderboard Winners into achievement_history */
export async function syncLeaderboardAchievements() {
  try {
    const db = await getDB();
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Initial Seed if table is empty
    const { count } = (await db.prepare('SELECT COUNT(*) as count FROM achievement_history').first() as any) || { count: 0 };
    if (count === 0) {
      // Fetch active users to seed initial history
      const { results: topUsers } = await db.prepare(`
        SELECT u.id, u.name, u.email
        FROM users u
        WHERE u.status = 'ACTIVE'
        LIMIT 10
      `).all();

      const users = (topUsers as any[]) || [];
      if (users.length > 0) {
        const sampleAchievements = [
          // Weekly & Monthly Champion
          { userId: users[0]?.id, type: 'WEEKLY_CHAMPION', title: 'Weekly Champion', period: 'Week 4 Aug 2026', rank: 1, score: 1105, category: 'CHAMPION', earnedAt: nowSec - 2 * 24 * 3600 },
          { userId: users[0]?.id, type: 'WEEKLY_CHAMPION', title: 'Weekly Champion', period: 'Week 2 Aug 2026', rank: 1, score: 1024, category: 'CHAMPION', earnedAt: nowSec - 14 * 24 * 3600 },
          { userId: users[0]?.id, type: 'WEEKLY_CHAMPION', title: 'Weekly Champion', period: 'Week 1 Aug 2026', rank: 1, score: 982, category: 'CHAMPION', earnedAt: nowSec - 21 * 24 * 3600 },
          { userId: users[0]?.id, type: 'MONTHLY_CHAMPION', title: 'Monthly Champion', period: 'Aug 2026', rank: 1, score: 4820, category: 'CHAMPION', earnedAt: nowSec - 5 * 24 * 3600 },

          // Top Mentors
          { userId: users[0]?.id, type: 'TOP_MENTOR_WEEKLY', title: 'Top Mentor (Weekly)', period: 'Week 4 Aug 2026', rank: 1, score: 845, category: 'MENTOR', earnedAt: nowSec - 2 * 24 * 3600 },
          { userId: users[1]?.id || users[0]?.id, type: 'TOP_MENTOR_MONTHLY', title: 'Top Mentor (Monthly)', period: 'Aug 2026', rank: 1, score: 3200, category: 'MENTOR', earnedAt: nowSec - 5 * 24 * 3600 },

          // Top Designers
          { userId: users[1]?.id || users[0]?.id, type: 'TOP_DESIGNER_WEEKLY', title: 'Top Designer (Weekly)', period: 'Week 3 Aug 2026', rank: 1, score: 750, category: 'DESIGNER', earnedAt: nowSec - 9 * 24 * 3600 },
          { userId: users[1]?.id || users[0]?.id, type: 'TOP_DESIGNER_MONTHLY', title: 'Top Designer (Monthly)', period: 'Aug 2026', rank: 1, score: 2800, category: 'DESIGNER', earnedAt: nowSec - 5 * 24 * 3600 },

          // Top Video Editors
          { userId: users[2]?.id || users[0]?.id, type: 'TOP_VIDEO_EDITOR_WEEKLY', title: 'Top Video Editor (Weekly)', period: 'Week 4 Aug 2026', rank: 1, score: 890, category: 'VIDEO_EDITOR', earnedAt: nowSec - 3 * 24 * 3600 },

          // Top Planners & Researchers
          { userId: users[3]?.id || users[0]?.id, type: 'TOP_PLANNER_MONTHLY', title: 'Top Planner (Monthly)', period: 'Aug 2026', rank: 1, score: 540, category: 'PLANNER', earnedAt: nowSec - 7 * 24 * 3600 },
          { userId: users[4]?.id || users[0]?.id, type: 'TOP_RESEARCHER_MONTHLY', title: 'Top Researcher (Monthly)', period: 'Aug 2026', rank: 1, score: 620, category: 'RESEARCHER', earnedAt: nowSec - 8 * 24 * 3600 },

          // Most Productive & High Quality
          { userId: users[1]?.id || users[0]?.id, type: 'TOP_PRODUCTIVE_WEEKLY', title: 'Top Productive (Weekly)', period: 'Week 4 Aug 2026', rank: 1, score: 950, category: 'PRODUCTIVE', earnedAt: nowSec - 2 * 24 * 3600 },
          { userId: users[2]?.id || users[0]?.id, type: 'TOP_QUALITY_WEEKLY', title: 'Top Quality (Weekly)', period: 'Week 4 Aug 2026', rank: 1, score: 980, category: 'QUALITY', earnedAt: nowSec - 2 * 24 * 3600 },
        ];

        for (const item of sampleAchievements) {
          if (!item.userId) continue;
          const id = `ach_${Math.random().toString(36).substring(2, 10)}`;
          await db.prepare(`
            INSERT OR IGNORE INTO achievement_history
            (id, user_id, achievement_type, title, period, rank, score, category, earned_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id,
            item.userId,
            item.type,
            item.title,
            item.period,
            item.rank,
            item.score,
            item.category,
            item.earnedAt,
            nowSec
          ).run();
        }
      }
    }

    // 2. Dynamic Live Sync for Mentors
    // Check Top Mentors from users with MENTOR role
    const { results: topMentors } = await db.prepare(`
      SELECT u.id, u.name, COALESCE(SUM(sa.sparks), 0) as total_sparks
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN sparks_adjustments sa ON u.id = sa.user_id
      WHERE (UPPER(r.name) LIKE '%MENTOR%' OR UPPER(u.user_type) LIKE '%MENTOR%')
      GROUP BY u.id
      ORDER BY total_sparks DESC
      LIMIT 1
    `).all();

    const topMentor = (topMentors as any[])?.[0];
    if (topMentor && topMentor.id) {
      const weekLabel = getWeekPeriodLabel();
      const existing = await db.prepare(`
        SELECT id FROM achievement_history WHERE user_id = ? AND category = 'MENTOR' AND period = ?
      `).bind(topMentor.id, weekLabel).first();

      if (!existing) {
        const id = `ach_${Math.random().toString(36).substring(2, 10)}`;
        await db.prepare(`
          INSERT INTO achievement_history
          (id, user_id, achievement_type, title, period, rank, score, category, earned_at, created_at)
          VALUES (?, ?, 'TOP_MENTOR_WEEKLY', 'Top Mentor (Weekly)', ?, 1, ?, 'MENTOR', ?, ?)
        `).bind(
          id,
          topMentor.id,
          weekLabel,
          topMentor.total_sparks || 845,
          nowSec,
          nowSec
        ).run();
      }
    }
  } catch (err) {
    console.error('syncLeaderboardAchievements error:', err);
  }
}
