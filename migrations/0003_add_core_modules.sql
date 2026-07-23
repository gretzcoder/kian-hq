-- 1. Tabel Announcements (Pengumuman Tim)
CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 2. Tabel Content Briefs (Brief Kreatif Kampanye)
CREATE TABLE IF NOT EXISTS content_briefs (
    id TEXT PRIMARY KEY,
    project_id TEXT UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    audience TEXT,
    objectives TEXT,
    key_messages TEXT,
    visual_style TEXT,
    created_by TEXT REFERENCES users(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 3. Tabel Knowledge Base (KB / Dokumentasi Tim)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'GENERAL', -- GENERAL, GUIDELINE, ASSETS, DESIGN
    created_by TEXT REFERENCES users(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
