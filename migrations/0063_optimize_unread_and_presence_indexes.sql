-- =============================================================
-- Migration 0063: Optimized Composite Indexes for Unread & Presence Counts
-- Goal: Further reduce D1 Rows Read on background polling
-- =============================================================

PRAGMA foreign_keys = OFF;

CREATE INDEX IF NOT EXISTS idx_direct_messages_unread_summary ON direct_messages(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_chats_unread_summary ON workspace_chats(workspace_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_messages_unread_summary ON community_messages(channel_id, user_id, created_at);

PRAGMA foreign_keys = ON;
