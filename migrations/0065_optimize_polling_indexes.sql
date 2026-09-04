-- =============================================================
-- Migration 0065: High-Efficiency Composite Indexes for D1 Rows Read Optimization
-- Goal: Drastically cut D1 Rows Read on active multi-user polling
-- =============================================================

PRAGMA foreign_keys = OFF;

-- 1. Community Messages & Read Receipts Composite Indexes
CREATE INDEX IF NOT EXISTS idx_community_messages_created_user ON community_messages(created_at, user_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_chan_created ON community_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_channel_reads_user_last ON community_channel_reads(user_id, last_read_at);

-- 2. Workspace Chats & Reads Composite Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_chats_created_ws ON workspace_chats(created_at, workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_chats_ws_user_created ON workspace_chats(workspace_id, user_id, created_at);

-- 3. Task & Task Assignments Time-Window Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_created_status_ws ON tasks(created_at, status, workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_created_user ON task_assignments(created_at, user_id);

PRAGMA foreign_keys = ON;
