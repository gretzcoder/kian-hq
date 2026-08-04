-- Migration 0028: Add VIEW_OJT_DATA permission
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_view_ojt_data', 'VIEW_OJT_DATA', 'Akses halaman khusus untuk melihat seluruh data peserta OJT');

-- Grant permission to EXECUTIVE and COORDINATOR roles
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_view_ojt_data'),
('role_coordinator', 'perm_view_ojt_data');
