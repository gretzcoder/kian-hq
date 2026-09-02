-- =============================================================
-- Migration 0062: High-Performance Composite Indexes for D1 Optimization
-- Goal: Reduce D1 Rows Read from >5.35M/day to <500K/day
-- =============================================================

PRAGMA foreign_keys = OFF;

-- 1. Task Assignments & Tasks Composite Indexes
CREATE INDEX IF NOT EXISTS idx_task_assignments_user_status ON task_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status_result ON task_assignments(status, result_url);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_status ON task_assignments(task_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_reviewed ON task_assignments(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_task_assignments_submitted ON task_assignments(submitted_at);

CREATE INDEX IF NOT EXISTS idx_tasks_ws_status_created ON tasks(workspace_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_proj_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_type ON tasks(created_by, task_type, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline ON tasks(status, deadline);

-- 2. Leaderboard & Sparks Adjustments Composite Indexes
CREATE INDEX IF NOT EXISTS idx_sparks_adj_user_created ON sparks_adjustments(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sparks_adj_created ON sparks_adjustments(created_at);

CREATE INDEX IF NOT EXISTS idx_achievement_hist_user_earned ON achievement_history(user_id, earned_at);
CREATE INDEX IF NOT EXISTS idx_achievement_hist_cat_period ON achievement_history(category, period, rank);
CREATE INDEX IF NOT EXISTS idx_achievement_hist_type_period ON achievement_history(achievement_type, period);

-- 3. Workspace Chat & Reads Composite Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_chats_ws_created ON workspace_chats(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_chats_created ON workspace_chats(created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_chat_reads_composite ON workspace_chat_reads(chat_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_user_presence_ws_time ON workspace_user_presence(workspace_id, last_seen_at);

-- 4. Direct Messages & Friendships Composite Indexes
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_receiver ON direct_messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_sender ON direct_messages(receiver_id, sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_status ON direct_messages(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_user_status ON friendships(user_id, friend_id, status);

-- 5. Community Chat Composite Indexes
CREATE INDEX IF NOT EXISTS idx_community_messages_chan_thread_created ON community_messages(channel_id, thread_root_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_messages_thread_root ON community_messages(thread_root_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_msg_reactions_msg ON community_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_community_channel_reads_composite ON community_channel_reads(channel_id, user_id);

-- 6. Announcement Comments & Reactions Composite Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_created_desc ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_comments_ann_created ON announcement_comments(announcement_id, created_at);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_ann_emoji ON announcement_reactions(announcement_id, emoji);

-- 7. Workflow Events & User Notifications Composite Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_events_user_created ON workflow_events(triggered_by, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_events_from_to ON workflow_events(from_status, to_status);
CREATE INDEX IF NOT EXISTS idx_user_read_notifications_user ON user_read_notifications(user_id, notification_id);

PRAGMA foreign_keys = ON;
