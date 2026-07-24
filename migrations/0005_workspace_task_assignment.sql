-- =============================================================
-- Migration 0005: Workspace + Task Assignment + Brief State Machine
-- Architecture v2: PROJECT > WORKSPACE > TASK > TASK_ASSIGNMENT
-- Golden Rule: "Everything is a Workflow."
-- =============================================================

-- 1. Workspaces (Independent Entity — campaign unit inside a project)
CREATE TABLE IF NOT EXISTS workspaces (
    id          TEXT PRIMARY KEY,                              -- e.g. ws_<uuid>
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,                                 -- e.g. "Instagram", "TikTok", "Podcast"
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'ACTIVE',               -- ACTIVE | COMPLETED | ARCHIVED
    deadline    INTEGER,                                       -- Unix ms
    created_by  TEXT REFERENCES users(id),
    created_at  INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_workspaces_project ON workspaces(project_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status  ON workspaces(status);

-- 2. Re-parent tasks: add workspace_id + priority
ALTER TABLE tasks ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN priority     TEXT NOT NULL DEFAULT 'NORMAL'; -- LOW | NORMAL | HIGH | URGENT

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);

-- 3. Task Assignments (many-to-many: Task <-> Creator + assignment role)
CREATE TABLE IF NOT EXISTS task_assignments (
    id              TEXT PRIMARY KEY,                         -- e.g. ta_<uuid>
    task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_role TEXT NOT NULL DEFAULT 'PIC',             -- PIC | REVIEWER | HELPER | APPROVER
    assigned_by     TEXT REFERENCES users(id),               -- COORDINATOR who assigned
    status          TEXT NOT NULL DEFAULT 'ASSIGNED',
    -- ASSIGNED | IN_PROGRESS | SUBMITTED | IN_REVIEW | REVISION | APPROVED | DONE
    result_url      TEXT,                                    -- Google Drive link hasil kerja
    revision_note   TEXT,                                    -- catatan revisi dari reviewer
    submitted_at    INTEGER,
    reviewed_at     INTEGER,
    created_at      INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(task_id, user_id)                                 -- satu user, satu assignment per task
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);

-- 4. Content Brief State Machine columns
ALTER TABLE content_briefs ADD COLUMN status        TEXT NOT NULL DEFAULT 'DRAFT';
-- DRAFT | SUBMITTED | WAITING_REVIEW | APPROVED | LOCKED | PROJECT_CREATED | ARCHIVED
ALTER TABLE content_briefs ADD COLUMN submitted_at  INTEGER;
ALTER TABLE content_briefs ADD COLUMN approved_by   TEXT REFERENCES users(id);
ALTER TABLE content_briefs ADD COLUMN approved_at   INTEGER;
ALTER TABLE content_briefs ADD COLUMN revision_note TEXT;   -- coordinator's change request note
ALTER TABLE content_briefs ADD COLUMN locked_at     INTEGER;

-- 5. Workflow Events Log (audit trail & timeline source-of-truth)
CREATE TABLE IF NOT EXISTS workflow_events (
    id           TEXT PRIMARY KEY,
    entity_type  TEXT NOT NULL,    -- 'brief' | 'workspace' | 'task' | 'task_assignment' | 'project'
    entity_id    TEXT NOT NULL,
    from_status  TEXT,
    to_status    TEXT NOT NULL,
    triggered_by TEXT REFERENCES users(id),
    note         TEXT,             -- optional human-readable context / revision note
    created_at   INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_entity ON workflow_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_user   ON workflow_events(triggered_by);
