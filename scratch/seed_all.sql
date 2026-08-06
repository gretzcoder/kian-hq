-- Master Seed Script for KIAN HQ Local Development

PRAGMA foreign_keys = OFF;

-- Cleanup existing seed data
DELETE FROM ai_token_logs;
DELETE FROM workflow_events;
DELETE FROM sparks_adjustments;
DELETE FROM announcement_comments;
DELETE FROM announcement_reactions;
DELETE FROM assessment_submission_reactions;
DELETE FROM executive_feedbacks;
DELETE FROM project_coordinators;
DELETE FROM content_briefs;
DELETE FROM workspace_chats;
DELETE FROM task_assignments;
DELETE FROM tasks;
DELETE FROM workspace_members;
DELETE FROM workspaces;
DELETE FROM projects;
DELETE FROM announcements;
DELETE FROM knowledge_items;
DELETE FROM knowledge_categories;
DELETE FROM user_roles;
DELETE FROM users;

-- Insert Users
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_executive', 'executive@kian.com', 'executive', 'Executive CEO', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_executive', 'role_executive');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_coordinator', 'coordinator@kian.com', 'coordinator', 'Project Coordinator', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_coordinator', 'role_coordinator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_creator', 'creator@kian.com', 'creator', 'Content Creator', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_creator', 'role_creator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_collaborator', 'collaborator@kian.com', 'collaborator', 'External Collaborator', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_collaborator', 'role_collaborator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_ojt_coord', 'mentor@kian.com', 'mentor', 'Mentor OJT (Staff)', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_ojt_coord', 'role_coordinator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_ojt_leader', 'leader@ojt.com', 'budi_leader', 'Budi (Ketua Tim)', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_ojt_leader', 'role_creator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_ojt_researc', 'researcher@ojt.com', 'ani_researcher', 'Ani (Researcher)', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_ojt_researc', 'role_collaborator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_ojt_planner', 'planner@ojt.com', 'candra_planner', 'Candra (Planner)', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_ojt_planner', 'role_collaborator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_ojt_creator', 'creator@ojt.com', 'dodi_creator', 'Dodi (Creator)', 'ACTIVE', 'd755716f615aa19684649c4faaf8c718:7cd9183a566795af1d3fa7079b6f2ad95fe613bdda36e6c69e11b5c9fe11387a', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_ojt_creator', 'role_creator');

-- Insert Projects
INSERT INTO projects (id, name, description, status) VALUES ('proj_kian_branding', 'KIAN HQ Rebranding Campaign', 'Main branding and creative OS system rollout', 'IN_PROGRESS');
INSERT INTO projects (id, name, description, status) VALUES ('proj_ojt_test', 'OJT Internship Project', 'Workspace testing target for OJT Interns and Mentors', 'PLANNING');

-- Insert Workspaces
INSERT INTO workspaces (id, project_id, name, description, status, created_by, workspace_type) VALUES ('ws_kian_creative', 'proj_kian_branding', 'Creative Hub Workspace', 'Main creative workspace for brand assets and design.', 'ACTIVE', 'usr_executive', 'MAIN');
INSERT INTO workspaces (id, project_id, name, description, status, ojt_coordinator_id, created_by, workspace_type) VALUES ('ws_ojt_team_a', 'proj_ojt_test', 'Tim OJT A - Kampanye Instagram', 'Workspace kolaborasi Tim OJT A di bawah asuhan Mentor.', 'ACTIVE', 'usr_ojt_coord', 'usr_ojt_coord', 'OJT');

-- Insert Workspace Members
INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_executive', 'LEADER');
INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_coordinator', 'PLANNER');
INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_creator', 'CREATOR');
INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_leader', 'LEADER');
INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_researc', 'RESEARCHER');
INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_planner', 'PLANNER');
INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_creator', 'CREATOR');

-- Insert Tasks
INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_001', 'ws_kian_creative', 'proj_kian_branding', 'Desain Visual Identity & Brand Guidelines', 'Membuat panduan warna, font, dan elemen visual KIAN HQ', 'IN_PROGRESS', 'HIGH', 'usr_executive');
INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_002', 'ws_kian_creative', 'proj_kian_branding', 'Riset Content Brief & Audience', 'Melakukan analisis kompetitor dan target audiens', 'TODO', 'MEDIUM', 'usr_coordinator');
INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_003', 'ws_ojt_team_a', 'proj_ojt_test', 'Riset Tren Content Instagram 2026', 'Analisis format konten IG Reels & Carousel yang efektif', 'DONE', 'MEDIUM', 'usr_ojt_leader');
INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_004', 'ws_ojt_team_a', 'proj_ojt_test', 'Pembuatan Content Calendar Minggu 1', 'Menyusun jadwal posting dan topik ide konten', 'IN_PROGRESS', 'HIGH', 'usr_ojt_planner');

-- Insert Announcements
INSERT INTO announcements (id, title, content, created_by) VALUES ('anc_001', 'Selamat Datang di KIAN HQ OS!', 'Sistem Operasi Tim Kreatif berbasis AI telah aktif. Semua modul proyek, tugas, dan OJT siap digunakan.', 'usr_executive');

-- Insert Knowledge Base
INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_guidelines', 'Brand & Design Guidelines', 'Panduan utama standar desain dan komunikasi brand', 'Palette', 'usr_executive');
INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_ojt', 'OJT Standard Operating Procedure', 'SOP dan alur kerja peserta magang OJT', 'BookOpen', 'usr_coordinator');
INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_001', 'cat_guidelines', 'KIAN HQ Design System', 'https://kian.com/design-system', 'Panduan komponen UI, warna, dan tipografi', 'usr_executive');
INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_002', 'cat_ojt', 'OJT Task & Approval Workflow', 'https://kian.com/ojt-sop', 'Panduan penyerahan tugas dan review oleh Mentor', 'usr_coordinator');

