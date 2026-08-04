-- Migration 0021: Separate MANAGE_USERS and MANAGE_PERMISSIONS
-- Split generic MANAGE permission into specific administrative scopes

INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_manage_users',       'MANAGE_USERS',       'Manage user accounts, approvals, status updates, and user types'),
('perm_manage_permissions', 'MANAGE_PERMISSIONS', 'Manage system roles and permission matrix mappings');

-- Grant new permissions to EXECUTIVE role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_manage_users'),
('role_executive', 'perm_manage_permissions');

-- Grant MANAGE_USERS to COORDINATOR role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_coordinator', 'perm_manage_users');
