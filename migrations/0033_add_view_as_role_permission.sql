-- Migration 0033: Add VIEW_AS_ROLE permission to RBAC matrix
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_view_as_role', 'VIEW_AS_ROLE', 'Simulate server view as any chosen role (View Server as Role)');

-- Grant VIEW_AS_ROLE to EXECUTIVE and COORDINATOR roles by default
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_view_as_role'),
('role_coordinator', 'perm_view_as_role');
