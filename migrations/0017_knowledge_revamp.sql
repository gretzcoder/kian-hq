-- Knowledge Base Revamp: Two-level hierarchy (Categories → Items with links)
-- Tabel knowledge_base lama dipertahankan agar data historis tidak hilang.

-- 1. Category table
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT DEFAULT 'folder',
  sort_order  INTEGER DEFAULT 0,
  created_by  TEXT REFERENCES users(id),
  created_at  INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 2. Items table (link-based)
CREATE TABLE IF NOT EXISTS knowledge_items (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES knowledge_categories(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_by  TEXT REFERENCES users(id),
  created_at  INTEGER DEFAULT (strftime('%s', 'now'))
);
