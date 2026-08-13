-- Migration 0049: Add executive_feedback_replies table and sparks tracking to executive_feedbacks

CREATE TABLE IF NOT EXISTS executive_feedback_replies (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL REFERENCES executive_feedbacks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_replies_fb ON executive_feedback_replies(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_created ON executive_feedback_replies(created_at);

-- Add sparks columns to executive_feedbacks
ALTER TABLE executive_feedbacks ADD COLUMN sparks_given INTEGER DEFAULT 0;
ALTER TABLE executive_feedbacks ADD COLUMN sparks_given_by TEXT REFERENCES users(id);
ALTER TABLE executive_feedbacks ADD COLUMN sparks_adjustment_id TEXT REFERENCES sparks_adjustments(id);
