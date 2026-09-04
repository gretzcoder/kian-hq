-- =============================================================
-- Migration 0066: Comprehensive D1 Index Coverage for Full Table Scan Elimination
-- Goal: Ensure 100% SEARCH ... USING INDEX on all D1 queries
-- =============================================================

PRAGMA foreign_keys = OFF;

-- 1. Tasks & Task Assignments Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_ws_status_created ON tasks(workspace_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_proj_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_status ON tasks(created_by, status);

CREATE INDEX IF NOT EXISTS idx_task_assignments_user_status_task ON task_assignments(user_id, status, task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_status ON task_assignments(task_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_group_task ON task_assignments(group_name, task_id);

-- 2. Presence & Chat Read Receipts Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_presence_ws_user ON workspace_user_presence(workspace_id, user_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_workspace_chat_reads_chat_user ON workspace_chat_reads(chat_id, user_id);

-- 3. Community & Direct Messaging Indexes
CREATE INDEX IF NOT EXISTS idx_community_messages_chan_root_created ON community_messages(channel_id, thread_root_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_messages_root_created ON community_messages(thread_root_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recv_status_created ON direct_messages(receiver_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_send_recv_created ON direct_messages(sender_id, receiver_id, created_at);

-- 4. Feedbacks, Announcements, Certificates & Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_executive_feedbacks_created ON executive_feedbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_certificates_user_status ON user_certificates(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_read_notifications_user_notif ON user_read_notifications(user_id, notification_id);

PRAGMA foreign_keys = ON;
