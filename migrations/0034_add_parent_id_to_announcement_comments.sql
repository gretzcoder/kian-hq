-- Migration 0034: Add parent_id to announcement_comments for threaded replies
ALTER TABLE announcement_comments ADD COLUMN parent_id TEXT REFERENCES announcement_comments(id) ON DELETE CASCADE;
