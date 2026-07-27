-- Migration 0013: Add MEMBER role to workspace_members check constraint
CREATE TABLE IF NOT EXISTS workspace_members_new (
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
    team_role    TEXT CHECK(team_role IN ('MEMBER', 'LEADER', 'RESEARCHER', 'PLANNER', 'CREATOR')),
    created_at   INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (workspace_id, user_id, team_role)
);

-- Copy existing data
INSERT OR IGNORE INTO workspace_members_new (workspace_id, user_id, team_role, created_at)
SELECT workspace_id, user_id, team_role, created_at FROM workspace_members;

DROP TABLE IF EXISTS workspace_members;
ALTER TABLE workspace_members_new RENAME TO workspace_members;
