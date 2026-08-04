INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_manage_users', 'MANAGE_USERS', 'Manage user accounts, approvals, status updates, and user types'),
('perm_manage_permissions', 'MANAGE_PERMISSIONS', 'Manage system roles and permission matrix mappings');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_manage_users'),
('role_executive', 'perm_manage_permissions'),
('role_executive', 'perm_manage');
