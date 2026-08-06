-- =============================================================
-- Migration 0041: Sync All System Permissions, Roles, Colors & Seed Matrix
-- Ensures latest RBAC matrix, SPARKS_MANAGE, VIEW_AS_ROLE, colors, and indexes
-- =============================================================

-- 1. Ensure system roles exist with default colors
INSERT OR IGNORE INTO roles (id, name, description, color) VALUES
('role_executive', 'EXECUTIVE', 'Superadmin / Direksi dengan akses penuh platform', '#8B5CF6'),
('role_coordinator', 'COORDINATOR', 'Koordinator proyek dan pengelolaan workspace & peserta', '#3B82F6'),
('role_mentor_troopers', 'MENTOR TROOPERS', 'Mentor yang membimbing dan menguji penugasan peserta OJT', '#F59E0B'),
('role_creator', 'CREATOR', 'Kreator konten utama dan pelaksana alur kerja', '#10B981'),
('role_troopers', 'TROOPERS', 'Peserta OJT / Troopers yang melaksanakan penugasan dan assessment', '#06B6D4'),
('role_on_the_job_training', 'ON THE JOB TRAINING', 'Peserta OJT / Magang reguler', '#06B6D4'),
('role_collaborator', 'COLLABORATOR', 'Mitra kolaborator luar / inisiator brief', '#EAB308');

-- Update role colors
UPDATE roles SET color = '#8B5CF6' WHERE id = 'role_executive';
UPDATE roles SET color = '#3B82F6' WHERE id = 'role_coordinator';
UPDATE roles SET color = '#F59E0B' WHERE id = 'role_mentor_troopers';
UPDATE roles SET color = '#10B981' WHERE id = 'role_creator';
UPDATE roles SET color = '#06B6D4' WHERE id = 'role_troopers';
UPDATE roles SET color = '#06B6D4' WHERE id = 'role_on_the_job_training';
UPDATE roles SET color = '#EAB308' WHERE id = 'role_collaborator';

-- 2. Ensure permissions exist
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_admin_system',      'ADMIN_SYSTEM',      'Superadmin platform access'),
('perm_admin_users',       'ADMIN_USERS',       'Manage user registrations, status, roles, and types'),
('perm_admin_roles',       'ADMIN_ROLES',       'Manage system roles and permission matrix mappings'),
('perm_view_ojt',          'VIEW_OJT_DATA',     'Akses melihat direktori data OJT & Troopers'),
('perm_project_create',    'PROJECT_CREATE',    'Create new projects and campaign briefs'),
('perm_project_manage',    'PROJECT_MANAGE',    'Edit metadata, status, publish, or archive projects'),
('perm_workspace_manage',  'WORKSPACE_MANAGE',  'Create and update campaign workspaces'),
('perm_workspace_member',  'WORKSPACE_MEMBER',  'Manage team members inside workspaces'),
('perm_task_create',       'TASK_CREATE',       'Create tasks inside campaign workspaces'),
('perm_task_assign',       'TASK_ASSIGN',       'Assign team members/PICs to tasks'),
('perm_task_review',       'TASK_REVIEW',       'Review, approve, or request revisions on task submissions'),
('perm_task_execute',      'TASK_EXECUTE',      'Submit work results and update progress on assigned tasks'),
('perm_brief_create',      'BRIEF_CREATE',      'Buat pengajuan brief konten kampanye baru'),
('perm_brief_review',      'BRIEF_REVIEW',      'Submit, approve, or request changes on campaign briefs'),
('perm_kb_manage',         'KB_MANAGE',         'Create, update, and manage Knowledge Base items'),
('perm_announcement_post', 'ANNOUNCEMENT_POST', 'Create and publish team announcements'),
('perm_use_ai',            'USE_AI',            'Access AI recommendation engine and insights'),
('perm_export_data',       'EXPORT_DATA',       'Access and export analytics reports or Excel recaps'),
('perm_view_as_role',      'VIEW_AS_ROLE',      'Simulate server view as any chosen role'),
('perm_sparks_manage',     'SPARKS_MANAGE',     'Kelola Sparks, reset Sparks pengguna, dan berikan/kembalikan Sparks apresiasi');

-- 3. Seed role_permissions mappings safely
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.id = 'role_executive' AND p.id IN (
  'perm_sparks_manage', 'perm_view_as_role', 'perm_view_ojt', 'perm_brief_create'
);

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.id = 'role_coordinator' AND p.id IN (
  'perm_sparks_manage', 'perm_view_as_role', 'perm_view_ojt', 'perm_brief_create'
);

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.id = 'role_mentor_troopers' AND p.id IN (
  'perm_task_review', 'perm_task_execute', 'perm_task_assign'
);

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.id = 'role_troopers' AND p.id IN (
  'perm_task_execute'
);

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.id = 'role_on_the_job_training' AND p.id IN (
  'perm_task_execute'
);
