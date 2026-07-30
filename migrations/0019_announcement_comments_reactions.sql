-- Migration 0019: Announcement Comments and Reactions

CREATE TABLE IF NOT EXISTS announcement_comments (
    id TEXT PRIMARY KEY,
    announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS announcement_reactions (
    announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (announcement_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_announcement_comments_ann ON announcement_comments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_ann ON announcement_reactions(announcement_id);
