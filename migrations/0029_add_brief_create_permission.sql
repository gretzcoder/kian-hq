-- Migration 0029: Add BRIEF_CREATE permission & refine brief workflow access
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_brief_create', 'BRIEF_CREATE', 'Create and submit new campaign content briefs');

-- Grant BRIEF_CREATE to EXECUTIVE, COORDINATOR, and COLLABORATOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_brief_create'),
('role_coordinator', 'perm_brief_create'),
('role_collaborator', 'perm_brief_create');
