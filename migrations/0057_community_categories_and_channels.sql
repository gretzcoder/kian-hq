-- Migration 0057: Community categories and channel metadata
CREATE TABLE IF NOT EXISTS community_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO community_categories (id, name, icon, sort_order) VALUES
  ('cat_work', 'KATEGORI KERJAAN', '💼', 1),
  ('cat_general', 'GENERAL & SANTAI', '💬', 2);

UPDATE community_channels SET is_default = 1 WHERE slug = 'general-chit-chat' OR id = 'chan_general';
