-- KIAN HQ Master Seed — Generated 2026-08-06T05:48:06.134Z
-- Local development only.

-- Part C: Seed Users and Application Data

-- Seed Users (password: password123)
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_executive', 'executive@kian.com', 'executive', 'Executive CEO', 'ACTIVE', 'dd2d3f4196312d61e62c74492484676c:89e0594c4e46c987b7598f393f45de2212c7ebe6e33a1aa671c91091380b2e6c', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_executive', 'role_executive');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_coordinator', 'coordinator@kian.com', 'coordinator', 'Project Coordinator', 'ACTIVE', 'dd2d3f4196312d61e62c74492484676c:89e0594c4e46c987b7598f393f45de2212c7ebe6e33a1aa671c91091380b2e6c', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_coordinator', 'role_coordinator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_mentor', 'mentor@kian.com', 'mentor', 'Mentor OJT Troopers', 'ACTIVE', 'dd2d3f4196312d61e62c74492484676c:89e0594c4e46c987b7598f393f45de2212c7ebe6e33a1aa671c91091380b2e6c', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_mentor', 'role_mentor_troopers');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_creator', 'creator@kian.com', 'creator', 'Content Creator', 'ACTIVE', 'dd2d3f4196312d61e62c74492484676c:89e0594c4e46c987b7598f393f45de2212c7ebe6e33a1aa671c91091380b2e6c', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_creator', 'role_creator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_collaborator', 'collaborator@kian.com', 'collaborator', 'External Collaborator', 'ACTIVE', 'dd2d3f4196312d61e62c74492484676c:89e0594c4e46c987b7598f393f45de2212c7ebe6e33a1aa671c91091380b2e6c', 'STAFF');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_collaborator', 'role_collaborator');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_troopers_1', 'trooper1@ojt.com', 'budi_trooper', 'Budi Troopers OJT', 'ACTIVE', 'dd2d3f4196312d61e62c74492484676c:89e0594c4e46c987b7598f393f45de2212c7ebe6e33a1aa671c91091380b2e6c', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_troopers_1', 'role_troopers');
INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('usr_troopers_2', 'trooper2@ojt.com', 'ani_trooper', 'Ani Troopers OJT', 'ACTIVE', 'dd2d3f4196312d61e62c74492484676c:89e0594c4e46c987b7598f393f45de2212c7ebe6e33a1aa671c91091380b2e6c', 'OJT');
INSERT INTO user_roles (user_id, role_id) VALUES ('usr_troopers_2', 'role_troopers');

-- Seed Projects
INSERT INTO projects (id, name, description, status) VALUES ('proj_kian_branding', 'KIAN HQ Rebranding Campaign', 'Main branding and creative OS system rollout', 'IN_PROGRESS');
INSERT INTO projects (id, name, description, status) VALUES ('proj_ojt_main', 'OJT Troopers Program', 'Program magang dan pengujian tim OJT Troopers', 'IN_PROGRESS');

-- Seed Workspaces
INSERT INTO workspaces (id, project_id, name, description, status, ojt_coordinator_id, created_by, workspace_type) VALUES ('ws_kian_creative', 'proj_kian_branding', 'Creative Hub Workspace', 'Main creative workspace for brand assets and design.', 'ACTIVE', NULL, 'usr_executive', 'MAIN');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_executive', 'LEADER');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_coordinator', 'PLANNER');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_creator', 'CREATOR');
INSERT INTO workspaces (id, project_id, name, description, status, ojt_coordinator_id, created_by, workspace_type) VALUES ('ws_ojt_team_a', 'proj_ojt_main', 'Tim OJT A - Kampanye Instagram', 'Workspace kolaborasi Tim OJT A di bawah asuhan Mentor Troopers.', 'ACTIVE', 'usr_mentor', 'usr_mentor', 'OJT');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_mentor', 'LEADER');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_troopers_1', 'CREATOR');
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_troopers_2', 'RESEARCHER');

-- Seed Announcements
INSERT INTO announcements (id, title, content, created_by) VALUES ('anc_001', 'Selamat Datang di KIAN HQ OS!', 'Sistem Operasi Tim Kreatif berbasis AI telah aktif. Semua modul proyek, tugas, dan OJT siap digunakan.', 'usr_executive');

-- Seed Knowledge Base
INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_guidelines', 'Brand and Design Guidelines', 'Panduan utama standar desain dan komunikasi brand', 'Palette', 'usr_executive');
INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_ojt', 'OJT Standard Operating Procedure', 'SOP dan alur kerja peserta OJT Troopers', 'BookOpen', 'usr_coordinator');
INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_001', 'cat_guidelines', 'KIAN HQ Design System', 'https://kian.com/design-system', 'Panduan komponen UI, warna, dan tipografi', 'usr_executive');
INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_002', 'cat_ojt', 'OJT Task and Approval Workflow', 'https://kian.com/ojt-sop', 'Panduan penyerahan tugas dan review oleh Mentor', 'usr_coordinator');
