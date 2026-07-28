-- =============================================================
-- Migration 0016: Workspace Soft Delete
-- Adds deleted_at column to workspaces for non-destructive deletion.
-- Deleted workspaces are hidden from all UI but data is preserved.
-- =============================================================

ALTER TABLE workspaces ADD COLUMN deleted_at INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_deleted ON workspaces(deleted_at);
