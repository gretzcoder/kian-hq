-- Migration: Add thread support and pinned answer features to community_messages
ALTER TABLE community_messages ADD COLUMN thread_name TEXT;
ALTER TABLE community_messages ADD COLUMN is_thread_root INTEGER DEFAULT 0;
ALTER TABLE community_messages ADD COLUMN thread_root_id TEXT;
ALTER TABLE community_messages ADD COLUMN pinned_answer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_community_messages_thread ON community_messages(thread_root_id, created_at);
