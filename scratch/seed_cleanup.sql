-- KIAN HQ Master Seed — Generated 2026-08-06T05:48:06.134Z
-- Local development only.

-- Part A: Cleanup
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
