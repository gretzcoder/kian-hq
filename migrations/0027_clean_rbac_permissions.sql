-- =============================================================
-- Migration 0027: Clean & Restructure RBAC Permission System
-- Standardize permissions into domain:action taxonomy
-- Clean up legacy redundant generic permissions (READ, CREATE, UPDATE, etc.)
-- =============================================================

-- 1. Backup old matrix mappings by dropping existing permissions & role_permissions cleanly
DELETE FROM role_permissions;
DELETE FROM permissions;

-- 2. Insert Clean Domain-Based Permission Set
INSERT INTO permissions (id, name, description) VALUES
-- Admin Domain
('perm_admin_system',      'ADMIN_SYSTEM',      'Superadmin platform access (bypasses all security checks)'),
('perm_admin_users',       'ADMIN_USERS',       'Manage user registrations, status, roles, and types'),
('perm_admin_roles',       'ADMIN_ROLES',       'Manage system roles and permission matrix mappings'),

-- Project & Workspace Domain
('perm_project_create',    'PROJECT_CREATE',    'Create new projects and campaign briefs'),
('perm_project_manage',    'PROJECT_MANAGE',    'Edit metadata, status, publish, or archive projects'),
('perm_workspace_manage',  'WORKSPACE_MANAGE',  'Create and update campaign workspaces'),
('perm_workspace_member',  'WORKSPACE_MEMBER',  'Manage team members inside workspaces'),

-- Task Workflow Domain
('perm_task_create',       'TASK_CREATE',       'Create tasks inside campaign workspaces'),
('perm_task_assign',       'TASK_ASSIGN',       'Assign team members/PICs to tasks'),
('perm_task_review',       'TASK_REVIEW',       'Review, approve, or request revisions on task submissions'),
('perm_task_execute',      'TASK_EXECUTE',      'Submit work results and update progress on assigned tasks'),

-- Content & Knowledge Domain
('perm_brief_review',      'BRIEF_REVIEW',      'Submit, approve, or request changes on campaign briefs'),
('perm_kb_manage',         'KB_MANAGE',         'Create, update, and manage Knowledge Base items'),
('perm_announcement_post', 'ANNOUNCEMENT_POST', 'Create and publish team announcements'),

-- Feature Domain
('perm_use_ai',            'USE_AI',            'Access AI recommendation engine and insights'),
('perm_export_data',       'EXPORT_DATA',       'Access and export analytics reports or Excel recaps');

-- 3. Seed EXECUTIVE Role (Full platform admin)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_admin_system'),
('role_executive', 'perm_admin_users'),
('role_executive', 'perm_admin_roles'),
('role_executive', 'perm_project_create'),
('role_executive', 'perm_project_manage'),
('role_executive', 'perm_workspace_manage'),
('role_executive', 'perm_workspace_member'),
('role_executive', 'perm_task_create'),
('role_executive', 'perm_task_assign'),
('role_executive', 'perm_task_review'),
('role_executive', 'perm_task_execute'),
('role_executive', 'perm_brief_review'),
('role_executive', 'perm_kb_manage'),
('role_executive', 'perm_announcement_post'),
('role_executive', 'perm_use_ai'),
('role_executive', 'perm_export_data');

-- 4. Seed COORDINATOR Role (Managerial scope)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_coordinator', 'perm_admin_users'),
('role_coordinator', 'perm_project_create'),
('role_coordinator', 'perm_project_manage'),
('role_coordinator', 'perm_workspace_manage'),
('role_coordinator', 'perm_workspace_member'),
('role_coordinator', 'perm_task_create'),
('role_coordinator', 'perm_task_assign'),
('role_coordinator', 'perm_task_review'),
('role_coordinator', 'perm_task_execute'),
('role_coordinator', 'perm_brief_review'),
('role_coordinator', 'perm_kb_manage'),
('role_coordinator', 'perm_announcement_post'),
('role_coordinator', 'perm_use_ai'),
('role_coordinator', 'perm_export_data');

-- 5. Seed CREATOR Role (Executor scope)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_creator', 'perm_task_execute'),
('role_creator', 'perm_use_ai');

-- 6. Seed COLLABORATOR Role (Initiator scope)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_collaborator', 'perm_project_create'),
('role_collaborator', 'perm_brief_review');
