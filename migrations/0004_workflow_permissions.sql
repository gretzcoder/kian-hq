-- Add new workflow permissions
INSERT INTO permissions (id, name, description) VALUES
('perm_create_brief', 'CREATE_BRIEF', 'Create content briefs for campaigns'),
('perm_update_brief', 'UPDATE_BRIEF', 'Edit content briefs'),
('perm_use_ai', 'USE_AI', 'Access AI recommendation engine'),
('perm_publish', 'PUBLISH', 'Permission to publish projects final results (change status to PUBLISHED)'),
('perm_archive', 'ARCHIVE', 'Permission to archive finished projects (change status to ARCHIVED)');

-- Assign permissions to COLLABORATOR
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_collaborator', 'perm_create_brief'),
('role_collaborator', 'perm_update_brief');

-- Assign permissions to COORDINATOR
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_coordinator', 'perm_create_brief'),
('role_coordinator', 'perm_update_brief'),
('role_coordinator', 'perm_use_ai'),
('role_coordinator', 'perm_publish'),
('role_coordinator', 'perm_archive');

-- Assign permissions to EXECUTIVE
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_create_brief'),
('role_executive', 'perm_update_brief'),
('role_executive', 'perm_use_ai'),
('role_executive', 'perm_publish'),
('role_executive', 'perm_archive');
