-- Migration 0036: Add start_at to tasks and task_assignments for scheduled start date
ALTER TABLE tasks ADD COLUMN start_at INTEGER DEFAULT NULL;
ALTER TABLE task_assignments ADD COLUMN start_at INTEGER DEFAULT NULL;
