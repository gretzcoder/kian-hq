-- Migration 0050: Add parent_id to executive_feedback_replies and create executive_feedback_reactions table

ALTER TABLE executive_feedback_replies ADD COLUMN parent_id TEXT REFERENCES executive_feedback_replies(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS executive_feedback_reactions (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL, -- 'FEEDBACK' | 'REPLY'
    target_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(target_type, target_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_fb_reactions_target ON executive_feedback_reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_fb_reactions_user ON executive_feedback_reactions(user_id);
