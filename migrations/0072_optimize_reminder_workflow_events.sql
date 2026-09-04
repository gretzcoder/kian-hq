-- Migration 0072: Partial index for reminder workflow events optimization
CREATE INDEX IF NOT EXISTS idx_workflow_events_reminder
ON workflow_events (entity_type, entity_id, created_at DESC)
WHERE from_status = 'REMINDER_SENT' OR to_status = 'REMINDER_SENT';
