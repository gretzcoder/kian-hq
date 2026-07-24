-- Migration 0010: OJT Task Workflows
-- Adds task types, parent prerequisites, and dynamic JSON submission payloads

-- 1. Dynamic Task Types
ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'REGULAR';

-- 2. Task Prerequisites (Sequential gate chains)
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;

-- 3. JSON Payload for multiple links/attachments
ALTER TABLE task_assignments ADD COLUMN submission_data TEXT;
