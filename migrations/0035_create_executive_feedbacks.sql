-- Migration 0035: Create executive_feedbacks table for team feedback/suggestions

CREATE TABLE IF NOT EXISTS executive_feedbacks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'KRITIK_SARAN',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_executive_feedbacks_user ON executive_feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_executive_feedbacks_created ON executive_feedbacks(created_at);
