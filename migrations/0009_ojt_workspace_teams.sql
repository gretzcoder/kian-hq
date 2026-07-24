-- Migration 0009: OJT Workspace Teams
-- Classify users, add OJT Coordinator reference to workspaces, and create local workspace_members roles

-- 1. Add user_type column to users table
ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'STAFF';

-- 2. Link Workspace to OJT Coordinator (Permanent Staff member)
ALTER TABLE workspaces ADD COLUMN ojt_coordinator_id TEXT REFERENCES users(id);

-- 3. Local Workspace Membership & Roles
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
    team_role    TEXT CHECK(team_role IN ('LEADER', 'RESEARCHER', 'PLANNER', 'CREATOR')),
    created_at   INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (workspace_id, user_id)
);
