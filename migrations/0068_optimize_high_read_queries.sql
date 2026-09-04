-- Migration 0068: Targeted Composite Indexes for D1 Rows Read Optimization

-- 1. Index workflow_events by status and created_at for fast reminder lookups
CREATE INDEX IF NOT EXISTS idx_workflow_events_to_status ON workflow_events(to_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_events_from_status ON workflow_events(from_status, created_at DESC);

-- 2. Index workflow_events by entity_type, entity_id, and created_at for timeline queries
CREATE INDEX IF NOT EXISTS idx_workflow_events_entity_created ON workflow_events(entity_type, entity_id, created_at DESC);

-- 3. Index direct_messages by sender/receiver and created_at for DM list pagination
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_created ON direct_messages(receiver_id, created_at DESC);

-- 4. Index workspace_chats and community_messages by container and created_at
CREATE INDEX IF NOT EXISTS idx_workspace_chats_ws_created_id ON workspace_chats(workspace_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_community_messages_chan_created_id ON community_messages(channel_id, created_at DESC, id);
