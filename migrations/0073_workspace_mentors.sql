-- Migration 0073: Workspace Mentors (Support multiple mentors per workspace)
CREATE TABLE IF NOT EXISTS workspace_mentors (
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_mentors_ws ON workspace_mentors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_mentors_user ON workspace_mentors(user_id);

-- Backfill existing single ojt_coordinator_id into workspace_mentors table
INSERT OR IGNORE INTO workspace_mentors (workspace_id, user_id)
SELECT id, ojt_coordinator_id 
FROM workspaces 
WHERE ojt_coordinator_id IS NOT NULL AND ojt_coordinator_id != '';
