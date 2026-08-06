-- =============================================================
-- Migration 0042: Upgrade Workspace Chats and Emoji Reactions
-- Adds parent_id, attachment_url to workspace_chats & workspace_chat_reactions table
-- =============================================================

PRAGMA foreign_keys = OFF;

-- Add parent_id for quoted replies and attachment_url for media
ALTER TABLE workspace_chats ADD COLUMN parent_id TEXT DEFAULT NULL REFERENCES workspace_chats(id) ON DELETE SET NULL;
ALTER TABLE workspace_chats ADD COLUMN attachment_url TEXT DEFAULT NULL;

-- Create workspace_chat_reactions table for emoji reactions
CREATE TABLE IF NOT EXISTS workspace_chat_reactions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES workspace_chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(chat_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_chat ON workspace_chat_reactions(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user ON workspace_chat_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_chats_parent ON workspace_chats(parent_id);

PRAGMA foreign_keys = ON;
