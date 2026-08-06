-- KIAN HQ Master Seed Data — Generated 2026-08-06T06:06:12.372Z
-- For local development only. Default password: password123

PRAGMA foreign_keys = OFF;
BEGIN;

-- 1. Cleanup
DELETE FROM workspace_chat_reactions WHERE chat_id IN (SELECT id FROM workspace_chats WHERE workspace_id IN ('ws_kian_creative', 'ws_ojt_team_a'));
DELETE FROM workspace_chats WHERE workspace_id IN ('ws_kian_creative', 'ws_ojt_team_a');
DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id IN ('ws_kian_creative', 'ws_ojt_team_a') OR project_id IN ('proj_kian_branding', 'proj_ojt_main'));
DELETE FROM tasks WHERE workspace_id IN ('ws_kian_creative', 'ws_ojt_team_a') OR project_id IN ('proj_kian_branding', 'proj_ojt_main');
DELETE FROM workspace_members WHERE workspace_id IN ('ws_kian_creative', 'ws_ojt_team_a');
DELETE FROM workspaces WHERE id IN ('ws_kian_creative', 'ws_ojt_team_a');
DELETE FROM content_briefs WHERE project_id IN ('proj_kian_branding', 'proj_ojt_main');
DELETE FROM project_coordinators WHERE project_id IN ('proj_kian_branding', 'proj_ojt_main');
DELETE FROM projects WHERE id IN ('proj_kian_branding', 'proj_ojt_main');
DELETE FROM knowledge_items WHERE id IN ('item_001', 'item_002');
DELETE FROM knowledge_categories WHERE id IN ('cat_guidelines', 'cat_ojt');
DELETE FROM announcements WHERE id IN ('anc_001');
DELETE FROM sparks_adjustments WHERE user_id IN ('usr_executive', 'usr_coordinator', 'usr_mentor', 'usr_creator', 'usr_collaborator', 'usr_troopers_1', 'usr_troopers_2');
DELETE FROM user_roles WHERE user_id IN ('usr_executive', 'usr_coordinator', 'usr_mentor', 'usr_creator', 'usr_collaborator', 'usr_troopers_1', 'usr_troopers_2');
DELETE FROM users WHERE id IN ('usr_executive', 'usr_coordinator', 'usr_mentor', 'usr_creator', 'usr_collaborator', 'usr_troopers_1', 'usr_troopers_2');

-- 2. System Roles
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
DELETE FROM role_permissions WHERE role_id = 'role_on_the_job_training';
DELETE FROM user_roles WHERE role_id = 'role_on_the_job_training';
DELETE FROM roles WHERE id = 'role_on_the_job_training';

-- 3. System Permissions
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

-- 4. RBAC Matrix
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

-- 5. Seed Users
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_executive', 'executive@kian.com', 'executive', 'Executive CEO', 'ACTIVE', 'e4cdb028746850ea14f512626c56c271:da5575ad120ce6c209f9b21a131af879adde6bea014880fde83676843dc1e547', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_executive', 'role_executive');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_coordinator', 'coordinator@kian.com', 'coordinator', 'Project Coordinator', 'ACTIVE', 'e4cdb028746850ea14f512626c56c271:da5575ad120ce6c209f9b21a131af879adde6bea014880fde83676843dc1e547', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_coordinator', 'role_coordinator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_mentor', 'mentor@kian.com', 'mentor', 'Mentor OJT Troopers', 'ACTIVE', 'e4cdb028746850ea14f512626c56c271:da5575ad120ce6c209f9b21a131af879adde6bea014880fde83676843dc1e547', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_mentor', 'role_mentor_troopers');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_creator', 'creator@kian.com', 'creator', 'Content Creator', 'ACTIVE', 'e4cdb028746850ea14f512626c56c271:da5575ad120ce6c209f9b21a131af879adde6bea014880fde83676843dc1e547', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_creator', 'role_creator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_collaborator', 'collaborator@kian.com', 'collaborator', 'External Collaborator', 'ACTIVE', 'e4cdb028746850ea14f512626c56c271:da5575ad120ce6c209f9b21a131af879adde6bea014880fde83676843dc1e547', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_collaborator', 'role_collaborator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_troopers_1', 'trooper1@ojt.com', 'budi_trooper', 'Budi Troopers OJT', 'ACTIVE', 'e4cdb028746850ea14f512626c56c271:da5575ad120ce6c209f9b21a131af879adde6bea014880fde83676843dc1e547', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_troopers_1', 'role_troopers');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_troopers_2', 'trooper2@ojt.com', 'ani_trooper', 'Ani Troopers OJT', 'ACTIVE', 'e4cdb028746850ea14f512626c56c271:da5575ad120ce6c209f9b21a131af879adde6bea014880fde83676843dc1e547', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_troopers_2', 'role_troopers');

-- 6. Seed Projects
INSERT INTO projects (id, name, description, status) VALUES ('proj_kian_branding', 'KIAN HQ Rebranding Campaign', 'Main branding and creative OS system rollout', 'IN_PROGRESS');
INSERT INTO projects (id, name, description, status) VALUES ('proj_ojt_main', 'OJT Troopers Program', 'Program magang dan pengujian tim OJT Troopers', 'IN_PROGRESS');

-- 7. Seed Workspaces
INSERT INTO workspaces (id, project_id, name, description, status, ojt_coordinator_id, created_by, workspace_type) VALUES ('ws_kian_creative', 'proj_kian_branding', 'Creative Hub Workspace', 'Main creative workspace for brand assets and design.', 'ACTIVE', NULL, 'usr_executive', 'MAIN');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_executive', 'LEADER');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_coordinator', 'PLANNER');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_creator', 'CREATOR');
INSERT INTO workspaces (id, project_id, name, description, status, ojt_coordinator_id, created_by, workspace_type) VALUES ('ws_ojt_team_a', 'proj_ojt_main', 'Tim OJT A - Kampanye Instagram', 'Workspace kolaborasi Tim OJT A di bawah asuhan Mentor Troopers.', 'ACTIVE', 'usr_mentor', 'usr_mentor', 'OJT');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_mentor', 'LEADER');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_troopers_1', 'CREATOR');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_troopers_2', 'RESEARCHER');

-- 8. Seed Announcements
INSERT INTO announcements (id, title, content, created_by) VALUES ('anc_001', 'Selamat Datang di KIAN HQ OS!', 'Sistem Operasi Tim Kreatif berbasis AI telah aktif. Semua modul proyek, tugas, dan OJT siap digunakan.', 'usr_executive');

-- 9. Seed Knowledge Base
INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_guidelines', 'Brand and Design Guidelines', 'Panduan utama standar desain dan komunikasi brand', 'Palette', 'usr_executive');
INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_ojt', 'OJT Standard Operating Procedure', 'SOP dan alur kerja peserta OJT Troopers', 'BookOpen', 'usr_coordinator');
INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_001', 'cat_guidelines', 'KIAN HQ Design System', 'https://kian.com/design-system', 'Panduan komponen UI, warna, dan tipografi', 'usr_executive');
INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_002', 'cat_ojt', 'OJT Task and Approval Workflow', 'https://kian.com/ojt-sop', 'Panduan penyerahan tugas dan review oleh Mentor', 'usr_coordinator');

COMMIT;
PRAGMA foreign_keys = ON;
-- Seed complete.
