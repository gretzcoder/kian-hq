-- =============================================================
-- Migration 0080: Add Major Features RBAC Permissions
-- Adds permissions for Availability, Documents, Badges, Org, Feedbacks, Certificates, and Content Bank
-- =============================================================

INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_availability_manage',  'AVAILABILITY_MANAGE',  'Kelola pengaturan ketersediaan, pengecualian personil/role, dan alokasi penugasan tim'),
('perm_availability_view',    'AVAILABILITY_VIEW',    'Akses melihat direktori ketersediaan, kalender, dan jadwal kuliah seluruh tim'),
('perm_documents_manage',     'DOCUMENTS_MANAGE',     'Kelola, buat, tanda tangani, dan terbitkan Surat Tugas resmi & dokumen organisasi'),
('perm_badges_manage',        'BADGES_MANAGE',        'Kelola pembuatan, penyuntingan, dan penganugerahan lencana/badges personil'),
('perm_organization_manage',  'ORGANIZATION_MANAGE',  'Kelola struktur bagan organisasi, divisi, dan pemetaan otoritas node'),
('perm_feedback_manage',      'FEEDBACK_MANAGE',      'Melihat, mengelola, dan menanggapi masukan & feedback pengguna'),
('perm_certificates_manage',  'CERTIFICATES_MANAGE',  'Kelola penerbitan, desain template, dan verifikasi sertifikat'),
('perm_content_bank_manage',  'CONTENT_BANK_MANAGE',  'Kelola aset, template desain, dan repositori berkas bank konten');

-- Grant full feature permissions to Executive (Superadmin)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_executive', id FROM permissions
WHERE name IN (
  'AVAILABILITY_MANAGE', 'AVAILABILITY_VIEW', 'DOCUMENTS_MANAGE', 'BADGES_MANAGE',
  'ORGANIZATION_MANAGE', 'FEEDBACK_MANAGE', 'CERTIFICATES_MANAGE', 'CONTENT_BANK_MANAGE'
);

-- Grant appropriate permissions to Coordinator
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_coordinator', id FROM permissions
WHERE name IN (
  'AVAILABILITY_MANAGE', 'AVAILABILITY_VIEW', 'DOCUMENTS_MANAGE', 'BADGES_MANAGE',
  'ORGANIZATION_MANAGE', 'FEEDBACK_MANAGE', 'CERTIFICATES_MANAGE', 'CONTENT_BANK_MANAGE'
);

-- Grant view availability to Mentor Troopers
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_mentor_troopers', id FROM permissions
WHERE name IN ('AVAILABILITY_VIEW');
