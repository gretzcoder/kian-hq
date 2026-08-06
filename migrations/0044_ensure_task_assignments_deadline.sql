-- Migration 0044: Ensure deadline, start_at, assigned_by, and all expected columns exist on task_assignments table

CREATE TABLE IF NOT EXISTS task_assignments_v4 (
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
    sparks               INTEGER DEFAULT 0,
    deadline             INTEGER DEFAULT NULL,
    start_at             INTEGER DEFAULT NULL,
    UNIQUE(task_id, user_id, assignment_role)
);

INSERT OR IGNORE INTO task_assignments_v4 (
    id, task_id, user_id, assignment_role, status,
    result_url, revision_note, submitted_at, reviewed_at, created_at
)
SELECT
    id, task_id, user_id, assignment_role, status,
    result_url, revision_note, submitted_at, reviewed_at, created_at
FROM task_assignments;

DROP TABLE IF EXISTS task_assignments;
ALTER TABLE task_assignments_v4 RENAME TO task_assignments;

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
