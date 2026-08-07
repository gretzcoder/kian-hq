-- =============================================================
-- Migration 0044: Workspace Chat Features Upgrade
-- Adds pinned_by, read receipts, & presence tracking
-- =============================================================

PRAGMA foreign_keys = OFF;

-- Add pinned_by and updated_at if not present
ALTER TABLE workspace_chats ADD COLUMN pinned_by TEXT DEFAULT NULL;

-- Create table for tracking read receipts
CREATE TABLE IF NOT EXISTS workspace_chat_reads (
  chat_id TEXT NOT NULL REFERENCES workspace_chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

-- Create table for user presence & typing indicators
CREATE TABLE IF NOT EXISTS workspace_user_presence (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  last_seen_at INTEGER NOT NULL,
  is_typing INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_reads_chat ON workspace_chat_reads(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_reads_user ON workspace_chat_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_ws ON workspace_user_presence(workspace_id);

PRAGMA foreign_keys = ON;
