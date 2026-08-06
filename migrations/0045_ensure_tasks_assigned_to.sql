-- Migration 0045: Ensure assigned_to and all expected columns exist on tasks table

CREATE TABLE IF NOT EXISTS tasks_v2 (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workspace_id   TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    description    TEXT,
    status         TEXT NOT NULL DEFAULT 'TODO',
    priority       TEXT NOT NULL DEFAULT 'NORMAL',
    task_type      TEXT DEFAULT 'REGULAR',
    parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    assigned_to    TEXT REFERENCES users(id),
    deadline       INTEGER,
    start_at       INTEGER DEFAULT NULL,
    revision_note  TEXT DEFAULT NULL,
    sparks         INTEGER DEFAULT NULL,
    created_by     TEXT REFERENCES users(id),
    created_at     INTEGER DEFAULT (strftime('%s', 'now'))
);

INSERT OR IGNORE INTO tasks_v2 (
    id, project_id, workspace_id, title, description, status,
    priority, task_type, parent_task_id, deadline, start_at,
    revision_note, sparks, created_by, created_at
)
SELECT
    id, project_id, workspace_id, title, description, status,
    priority, task_type, parent_task_id, deadline, start_at,
    revision_note, sparks, created_by, created_at
FROM tasks;

DROP TABLE IF EXISTS tasks;
ALTER TABLE tasks_v2 RENAME TO tasks;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks(parent_task_id);
