-- =============================================================
-- Migration 0031: Assessment Workspace
-- Adds workspace_type for TROOPERS (existing) vs ASSESSMENT (new).
-- Fixes task_assignments UNIQUE constraint so multiple OJT users
-- can share the same assignment_role on the same assessment task.
-- =============================================================

-- 1. Add workspace_type to workspaces
--    TROOPERS = standard OJT workspace (existing behaviour)
--    ASSESSMENT = mass-assign assessment (Skill Assessment)
ALTER TABLE workspaces ADD COLUMN workspace_type TEXT NOT NULL DEFAULT 'TROOPERS';

-- 2. Rebuild task_assignments with new UNIQUE key
--    Old: UNIQUE(task_id, assignment_role)  — 1 user per role per task
--    New: UNIQUE(task_id, user_id, assignment_role) — many OJT, same role, same task
CREATE TABLE IF NOT EXISTS task_assignments_new (
    id                   TEXT PRIMARY KEY,
    task_id              TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_role      TEXT NOT NULL DEFAULT 'PIC',
    assigned_by          TEXT REFERENCES users(id),
    status               TEXT NOT NULL DEFAULT 'ASSIGNED',
    result_url           TEXT,
    revision_note        TEXT,
    submitted_at         INTEGER,
    reviewed_at          INTEGER,
    created_at           INTEGER DEFAULT (strftime('%s', 'now')),
    submission_data      TEXT,
    lead_approved        INTEGER DEFAULT 0,
    mentor_approved      INTEGER DEFAULT 0,
    coordinator_approved INTEGER DEFAULT 0,
    sparks               INTEGER,
    deadline             INTEGER,
    UNIQUE(task_id, user_id, assignment_role)
);

INSERT OR IGNORE INTO task_assignments_new (
    id, task_id, user_id, assignment_role, assigned_by, status,
    result_url, revision_note, submitted_at, reviewed_at, created_at,
    submission_data, lead_approved, mentor_approved, coordinator_approved,
    sparks, deadline
)
SELECT
    id, task_id, user_id, assignment_role, assigned_by, status,
    result_url, revision_note, submitted_at, reviewed_at, created_at,
    submission_data, lead_approved, mentor_approved, coordinator_approved,
    sparks, deadline
FROM task_assignments;

DROP TABLE IF EXISTS task_assignments;
ALTER TABLE task_assignments_new RENAME TO task_assignments;

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
