-- Migration 0074: Bank Content System (Publish Status, Likes, Comments, Sparks Bonus)

-- 1. Add publish_status & publish_bonus_awarded to task_assignments
ALTER TABLE task_assignments ADD COLUMN publish_status TEXT NOT NULL DEFAULT 'NON_PUBLISHED';
ALTER TABLE task_assignments ADD COLUMN publish_bonus_awarded INTEGER NOT NULL DEFAULT 0;

-- 2. Create bank_content_likes table
CREATE TABLE IF NOT EXISTS bank_content_likes (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(assignment_id, user_id)
);

-- 3. Create bank_content_comments table
CREATE TABLE IF NOT EXISTS bank_content_comments (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES bank_content_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_task_assignments_publish ON task_assignments(publish_status);
CREATE INDEX IF NOT EXISTS idx_bank_content_likes_assignment ON bank_content_likes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_bank_content_likes_user ON bank_content_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_content_comments_assignment ON bank_content_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_bank_content_comments_parent ON bank_content_comments(parent_id);
