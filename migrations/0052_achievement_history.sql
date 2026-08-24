-- Create achievement_history table for tracking leaderboard titles & milestone counters
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
);

CREATE INDEX IF NOT EXISTS idx_achievement_history_user ON achievement_history(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_history_category ON achievement_history(category);
