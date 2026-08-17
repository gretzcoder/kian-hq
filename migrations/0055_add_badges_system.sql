-- Migration 0055: Badges System
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'TROOPER', -- TROOPER | EVENT | CLIENT | EPIC | LEGENDARY
  icon_url TEXT,
  description TEXT,
  requirement_type TEXT NOT NULL DEFAULT 'NONE', -- TASK | WORKSPACE | NONE
  requirement_data TEXT, -- JSON array of task IDs or workspace IDs
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  awarded_by TEXT,
  awarded_at INTEGER NOT NULL,
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
