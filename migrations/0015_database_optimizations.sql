-- Migration 0015: Database Schema Optimizations

-- 1. Create indexes on foreign keys to avoid full table scans on ON DELETE CASCADE and JOINs
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_projects_ojt_coordinator ON projects(ojt_coordinator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_logs_user ON ai_token_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_logs_timestamp ON ai_token_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_content_briefs_created_by ON content_briefs(created_by);
CREATE INDEX IF NOT EXISTS idx_content_briefs_approved_by ON content_briefs(approved_by);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_by ON knowledge_base(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_ojt_coordinator ON workspaces(ojt_coordinator_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by);

-- 2. Optimize Junction Tables by converting them to WITHOUT ROWID

-- A. role_permissions
CREATE TABLE IF NOT EXISTS role_permissions_new (
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
) WITHOUT ROWID;
INSERT OR IGNORE INTO role_permissions_new SELECT * FROM role_permissions;
DROP TABLE IF EXISTS role_permissions;
ALTER TABLE role_permissions_new RENAME TO role_permissions;
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- B. user_roles
CREATE TABLE IF NOT EXISTS user_roles_new (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
) WITHOUT ROWID;
INSERT OR IGNORE INTO user_roles_new SELECT * FROM user_roles;
DROP TABLE IF EXISTS user_roles;
ALTER TABLE user_roles_new RENAME TO user_roles;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- C. workspace_members
CREATE TABLE IF NOT EXISTS workspace_members_new (
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
    team_role    TEXT CHECK(team_role IN ('MEMBER', 'LEADER', 'RESEARCHER', 'PLANNER', 'CREATOR')),
    created_at   INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (workspace_id, user_id, team_role)
) WITHOUT ROWID;
INSERT OR IGNORE INTO workspace_members_new SELECT * FROM workspace_members;
DROP TABLE IF EXISTS workspace_members;
ALTER TABLE workspace_members_new RENAME TO workspace_members;
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- D. project_coordinators
CREATE TABLE IF NOT EXISTS project_coordinators_new (
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, user_id)
) WITHOUT ROWID;
INSERT OR IGNORE INTO project_coordinators_new SELECT * FROM project_coordinators;
DROP TABLE IF EXISTS project_coordinators;
ALTER TABLE project_coordinators_new RENAME TO project_coordinators;
CREATE INDEX IF NOT EXISTS idx_project_coordinators_user ON project_coordinators(user_id);
