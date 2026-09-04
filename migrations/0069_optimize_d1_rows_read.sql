-- Migration 0069: Add composite indexes to optimize high D1 Rows Read queries

-- 1. Eliminate temp B-tree sorting on workspace_members queries (ORDER BY created_at ASC)
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_created ON workspace_members (workspace_id, created_at);

-- 2. Optimize active user queries in pre-sorted name order
CREATE INDEX IF NOT EXISTS idx_users_status_name ON users (status, name);

-- 3. Optimize unread direct message count queries
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_status ON direct_messages (receiver_id, status);
