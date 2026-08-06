-- KIAN HQ Master Seed — Generated 2026-08-06T05:48:06.134Z
-- Local development only.

-- Part B: System Roles, Permissions, RBAC Matrix

-- System Roles
INSERT OR IGNORE INTO roles (id, name, description, color) VALUES ('role_executive', 'EXECUTIVE', 'Superadmin / Direksi dengan akses penuh platform', '#8B5CF6');
UPDATE roles SET description = 'Superadmin / Direksi dengan akses penuh platform', color = '#8B5CF6' WHERE id = 'role_executive';
INSERT OR IGNORE INTO roles (id, name, description, color) VALUES ('role_coordinator', 'COORDINATOR', 'Koordinator proyek dan pengelolaan workspace dan peserta', '#3B82F6');
UPDATE roles SET description = 'Koordinator proyek dan pengelolaan workspace dan peserta', color = '#3B82F6' WHERE id = 'role_coordinator';
INSERT OR IGNORE INTO roles (id, name, description, color) VALUES ('role_mentor_troopers', 'MENTOR TROOPERS', 'Mentor yang membimbing dan menguji penugasan peserta OJT', '#F59E0B');
UPDATE roles SET description = 'Mentor yang membimbing dan menguji penugasan peserta OJT', color = '#F59E0B' WHERE id = 'role_mentor_troopers';
INSERT OR IGNORE INTO roles (id, name, description, color) VALUES ('role_creator', 'CREATOR', 'Kreator konten utama dan pelaksana alur kerja', '#10B981');
UPDATE roles SET description = 'Kreator konten utama dan pelaksana alur kerja', color = '#10B981' WHERE id = 'role_creator';
INSERT OR IGNORE INTO roles (id, name, description, color) VALUES ('role_troopers', 'TROOPERS', 'Peserta OJT yang melaksanakan penugasan dan assessment', '#06B6D4');
UPDATE roles SET description = 'Peserta OJT yang melaksanakan penugasan dan assessment', color = '#06B6D4' WHERE id = 'role_troopers';
INSERT OR IGNORE INTO roles (id, name, description, color) VALUES ('role_collaborator', 'COLLABORATOR', 'Mitra kolaborator luar dan inisiator brief', '#EAB308');
UPDATE roles SET description = 'Mitra kolaborator luar dan inisiator brief', color = '#EAB308' WHERE id = 'role_collaborator';
-- Remove legacy OJT INTERN role if present
DELETE FROM role_permissions WHERE role_id = 'role_on_the_job_training';
DELETE FROM user_roles WHERE role_id = 'role_on_the_job_training';
DELETE FROM roles WHERE id = 'role_on_the_job_training';

-- System Permissions
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_admin_system', 'ADMIN_SYSTEM', 'Superadmin platform access, bypasses security checks');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_admin_users', 'ADMIN_USERS', 'Manage user registrations, status, roles, and types');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_admin_roles', 'ADMIN_ROLES', 'Manage system roles and permission matrix mappings');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_view_ojt', 'VIEW_OJT_DATA', 'Akses melihat direktori data OJT dan Troopers');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_project_create', 'PROJECT_CREATE', 'Create new projects and campaign briefs');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_project_manage', 'PROJECT_MANAGE', 'Edit metadata, status, publish, or archive projects');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_workspace_manage', 'WORKSPACE_MANAGE', 'Create and update campaign workspaces');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_workspace_member', 'WORKSPACE_MEMBER', 'Manage team members inside workspaces');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_task_create', 'TASK_CREATE', 'Create tasks inside campaign workspaces');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_task_assign', 'TASK_ASSIGN', 'Assign team members and PICs to tasks');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_task_review', 'TASK_REVIEW', 'Review, approve, or request revisions on task submissions');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_task_execute', 'TASK_EXECUTE', 'Submit work results and update progress on assigned tasks');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_brief_create', 'BRIEF_CREATE', 'Buat pengajuan brief konten kampanye baru');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_brief_review', 'BRIEF_REVIEW', 'Submit, approve, or request changes on campaign briefs');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_kb_manage', 'KB_MANAGE', 'Create, update, and manage Knowledge Base items');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_announcement_post', 'ANNOUNCEMENT_POST', 'Create and publish team announcements');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_use_ai', 'USE_AI', 'Access AI recommendation engine and insights');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_export_data', 'EXPORT_DATA', 'Access and export analytics reports or Excel recaps');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_view_as_role', 'VIEW_AS_ROLE', 'Simulate server view as any chosen role');
INSERT OR IGNORE INTO permissions (id, name, description) VALUES ('perm_sparks_manage', 'SPARKS_MANAGE', 'Kelola Sparks, reset Sparks pengguna, berikan apresiasi Sparks');

-- RBAC Role-Permission Matrix
DELETE FROM role_permissions WHERE role_id = 'role_executive';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_admin_system');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_admin_users');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_admin_roles');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_view_ojt');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_project_create');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_project_manage');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_workspace_manage');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_workspace_member');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_task_create');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_task_assign');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_task_review');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_task_execute');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_brief_create');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_brief_review');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_kb_manage');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_announcement_post');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_use_ai');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_export_data');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_view_as_role');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_executive', 'perm_sparks_manage');
DELETE FROM role_permissions WHERE role_id = 'role_coordinator';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_admin_users');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_view_ojt');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_project_create');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_project_manage');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_workspace_manage');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_workspace_member');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_task_create');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_task_assign');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_task_review');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_task_execute');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_brief_create');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_brief_review');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_kb_manage');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_announcement_post');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_use_ai');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_export_data');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_view_as_role');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_coordinator', 'perm_sparks_manage');
DELETE FROM role_permissions WHERE role_id = 'role_mentor_troopers';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_mentor_troopers', 'perm_task_review');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_mentor_troopers', 'perm_task_execute');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_mentor_troopers', 'perm_task_assign');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_mentor_troopers', 'perm_brief_create');
DELETE FROM role_permissions WHERE role_id = 'role_creator';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_creator', 'perm_task_execute');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_creator', 'perm_use_ai');
DELETE FROM role_permissions WHERE role_id = 'role_troopers';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_troopers', 'perm_task_execute');
DELETE FROM role_permissions WHERE role_id = 'role_collaborator';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_collaborator', 'perm_project_create');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role_collaborator', 'perm_brief_review');
