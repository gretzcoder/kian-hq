-- Migration 0008: Add CREATE_KB permission
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_create_kb', 'CREATE_KB', 'Create documentation articles in Knowledge Base');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_create_kb'),
('role_coordinator', 'perm_create_kb');
