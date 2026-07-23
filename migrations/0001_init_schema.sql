-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 2. Tabel Roles
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- EXECUTIVE, COORDINATOR, CREATOR, COLLABORATOR
    description TEXT
);

-- 3. Tabel Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- READ, CREATE, UPDATE, DELETE, APPROVE, ASSIGN, COMMENT, UPLOAD, DOWNLOAD, EXPORT, SHARE, MANAGE
    description TEXT
);

-- 4. Junction Table Role-Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 5. Junction Table User-Roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 6. Tabel Projects (Metadata Only)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    gdrive_folder_id TEXT, -- ID folder utama proyek di Google Drive
    status TEXT NOT NULL DEFAULT 'PLANNING', -- PLANNING, IN_PROGRESS, REVIEW, PUBLISHED, ARCHIVED
    deadline INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 7. Tabel Tasks (Metadata Only)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    gdrive_asset_url TEXT, -- Link file spesifik di Google Drive (Raw/Edit)
    status TEXT NOT NULL DEFAULT 'TODO', -- TODO, IN_PROGRESS, IN_REVIEW, APPROVED, COMPLETED
    assigned_to TEXT REFERENCES users(id),
    created_by TEXT REFERENCES users(id),
    deadline INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 8. Tabel AI Cache & Token Log (Optimisasi Budget)
CREATE TABLE IF NOT EXISTS ai_token_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    intent_detected TEXT,
    tokens_used INTEGER NOT NULL,
    model_used TEXT NOT NULL,
    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Seed Roles
INSERT INTO roles (id, name, description) VALUES
('role_executive', 'EXECUTIVE', 'Decision Maker, has full access to the platform'),
('role_coordinator', 'COORDINATOR', 'Project Manager, can create projects and manage tasks'),
('role_creator', 'CREATOR', 'Task Executor, can create/update tasks and upload assets'),
('role_collaborator', 'COLLABORATOR', 'Contributor, can view tasks/projects and leave comments');

-- Seed Permissions
INSERT INTO permissions (id, name, description) VALUES
('perm_read', 'READ', 'Read content, projects, tasks, etc.'),
('perm_create', 'CREATE', 'Create projects, tasks, brief, etc.'),
('perm_update', 'UPDATE', 'Update existing projects, tasks, brief, etc.'),
('perm_delete', 'DELETE', 'Delete projects, tasks, brief, etc.'),
('perm_approve', 'APPROVE', 'Approve deliverables and final projects'),
('perm_assign', 'ASSIGN', 'Assign tasks to team members'),
('perm_comment', 'COMMENT', 'Leave comments on tasks or briefs'),
('perm_upload', 'UPLOAD', 'Upload raw or edited media to Google Drive'),
('perm_download', 'DOWNLOAD', 'Download media assets'),
('perm_export', 'EXPORT', 'Export analytics reports'),
('perm_share', 'SHARE', 'Share files/folders externally'),
('perm_manage', 'MANAGE', 'Manage users, roles, and system configuration');

-- Map EXECUTIVE Permissions (All permissions)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_read'),
('role_executive', 'perm_create'),
('role_executive', 'perm_update'),
('role_executive', 'perm_delete'),
('role_executive', 'perm_approve'),
('role_executive', 'perm_assign'),
('role_executive', 'perm_comment'),
('role_executive', 'perm_upload'),
('role_executive', 'perm_download'),
('role_executive', 'perm_export'),
('role_executive', 'perm_share'),
('role_executive', 'perm_manage');

-- Map COORDINATOR Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_coordinator', 'perm_read'),
('role_coordinator', 'perm_create'),
('role_coordinator', 'perm_update'),
('role_coordinator', 'perm_delete'),
('role_coordinator', 'perm_approve'),
('role_coordinator', 'perm_assign'),
('role_coordinator', 'perm_comment'),
('role_coordinator', 'perm_upload'),
('role_coordinator', 'perm_download'),
('role_coordinator', 'perm_share');

-- Map CREATOR Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_creator', 'perm_read'),
('role_creator', 'perm_create'),
('role_creator', 'perm_update'),
('role_creator', 'perm_comment'),
('role_creator', 'perm_upload'),
('role_creator', 'perm_download');

-- Map COLLABORATOR Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_collaborator', 'perm_read'),
('role_collaborator', 'perm_comment'),
('role_collaborator', 'perm_download');
