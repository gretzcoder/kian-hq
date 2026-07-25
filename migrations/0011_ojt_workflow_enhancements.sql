-- Migration 0011: OJT Workflow Enhancements

-- 1. Recreate workspace_members to support multiple roles per user in a workspace
CREATE TABLE IF NOT EXISTS workspace_members_new (
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
    team_role    TEXT CHECK(team_role IN ('LEADER', 'RESEARCHER', 'PLANNER', 'CREATOR')),
    created_at   INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (workspace_id, user_id, team_role)
);

-- Copy existing data
INSERT OR IGNORE INTO workspace_members_new (workspace_id, user_id, team_role, created_at)
SELECT workspace_id, user_id, team_role, created_at FROM workspace_members;

DROP TABLE IF EXISTS workspace_members;
ALTER TABLE workspace_members_new RENAME TO workspace_members;

-- 2. Recreate task_assignments to support one assignment per task_id + assignment_role,
-- allow same user to have multiple roles on a task, and add QC approval tracking
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
    UNIQUE(task_id, assignment_role)
);

-- Copy existing data
INSERT OR IGNORE INTO task_assignments_new (
    id, task_id, user_id, assignment_role, assigned_by, status,
    result_url, revision_note, submitted_at, reviewed_at, created_at, submission_data
)
SELECT 
    id, task_id, user_id, assignment_role, assigned_by, status,
    result_url, revision_note, submitted_at, reviewed_at, created_at, submission_data
FROM task_assignments;

DROP TABLE IF EXISTS task_assignments;
ALTER TABLE task_assignments_new RENAME TO task_assignments;

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
