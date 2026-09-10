-- Migration 0076: Generic Document & Letter Generator Engine Tables & Seed Permissions

-- 1. Document Types (Generic Master)
CREATE TABLE IF NOT EXISTS document_types (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- SURAT_TUGAS, SURAT_UNDANGAN, SURAT_KETERANGAN, SURAT_PERNYATAAN, SURAT_PENGANTAR
  name TEXT NOT NULL,
  description TEXT,
  numbering_format TEXT NOT NULL DEFAULT '{sequence}/KIAN/TROOPERS/{roman_month}/{year}',
  icon TEXT DEFAULT '📄',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Document Templates (Template Container)
CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  type_id TEXT NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- DRAFT | ACTIVE | ARCHIVED
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 3. Document Template Versions (Immutable Layout & Schema Snapshot)
CREATE TABLE IF NOT EXISTS document_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  layout_config TEXT NOT NULL,     -- JSON: Canvas A4, frame background, margins, header, footer, fixed/flow sections
  form_schema TEXT NOT NULL,       -- JSON: Dynamic form field definitions & validations
  default_values TEXT NOT NULL,    -- JSON: Default values for fields (title, closing, etc.)
  sample_data TEXT,                -- JSON: Realistic sample data for builder live preview
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL,
  UNIQUE(template_id, version)
);

-- 4. Reusable Document Assets (Frames, Logos, Stamps, Signatures)
CREATE TABLE IF NOT EXISTS document_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- FRAME | LOGO | SIGNATURE | STAMP | DECORATION
  asset_url TEXT NOT NULL,         -- Data URI Base64 atau static URL
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  width INTEGER,
  height INTEGER,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL
);

-- 5. Reusable Signatories (Penandatangan Surat Resmi)
CREATE TABLE IF NOT EXISTS document_signatories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,          -- e.g. "Program Director Kian Troopers"
  signature_asset_id TEXT,
  stamp_asset_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 6. Concurrency-Safe Document Sequences (Penomoran Surat)
CREATE TABLE IF NOT EXISTS document_sequences (
  sequence_key TEXT PRIMARY KEY,   -- e.g. "SURAT_TUGAS:2026"
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 7. Generated Documents (Historical Immutable Snapshot)
CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES document_templates(id),
  template_version_id TEXT NOT NULL REFERENCES document_template_versions(id),
  type_code TEXT NOT NULL,
  document_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  form_data TEXT NOT NULL,           -- JSON input pengguna saat pembuatan
  rendered_snapshot TEXT NOT NULL,   -- JSON state lengkap (org profile, layout, signatory, assets)
  status TEXT NOT NULL DEFAULT 'GENERATED', -- DRAFT | GENERATED | SIGNED | ARCHIVED
  signatory_id TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON document_templates(type_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_status ON document_templates(status);
CREATE INDEX IF NOT EXISTS idx_doc_versions_tpl ON document_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_user ON generated_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_generated_docs_num ON generated_documents(document_number);
CREATE INDEX IF NOT EXISTS idx_doc_assets_cat ON document_assets(category);

-- 8. Seed New Permissions
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_document_view', 'DOCUMENT_VIEW', 'Melihat daftar dan arsip dokumen resmi'),
('perm_document_create', 'DOCUMENT_CREATE', 'Membuat dan generate surat/dokumen resmi baru'),
('perm_document_manage', 'DOCUMENT_MANAGE', 'Mengelola template dokumen, versi, dan konfigurasi engine');

-- Grant Permissions to EXECUTIVE and COORDINATOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_document_view'),
('role_executive', 'perm_document_create'),
('role_executive', 'perm_document_manage'),
('role_coordinator', 'perm_document_view'),
('role_coordinator', 'perm_document_create'),
('role_coordinator', 'perm_document_manage');

-- 9. Seed Master Document Types
INSERT OR IGNORE INTO document_types (id, code, name, description, numbering_format, icon, is_active, created_at, updated_at) VALUES
('doctype_surat_tugas', 'SURAT_TUGAS', 'Surat Tugas', 'Surat penugasan resmi untuk personil/troopers dalam event dan proyek KIAN', '{sequence}/KIAN/TROOPERS/{roman_month}/{year}', '📋', 1, strftime('%s', 'now'), strftime('%s', 'now')),
('doctype_surat_undangan', 'SURAT_UNDANGAN', 'Surat Undangan', 'Surat undangan resmi partisipasi event, rapat koordinasi, atau audiensi', '{sequence}/KIAN/UND/{roman_month}/{year}', '✉️', 1, strftime('%s', 'now'), strftime('%s', 'now')),
('doctype_surat_keterangan', 'SURAT_KETERANGAN', 'Surat Keterangan', 'Surat keterangan aktif magang, pengalaman kerja, atau penyelesaian project', '{sequence}/KIAN/SK/{roman_month}/{year}', '📜', 1, strftime('%s', 'now'), strftime('%s', 'now')),
('doctype_surat_pernyataan', 'SURAT_PERNYATAAN', 'Surat Pernyataan', 'Surat pernyataan resmi kesanggupan, komitmen, atau pertanggungjawaban', '{sequence}/KIAN/SP/{roman_month}/{year}', '📝', 1, strftime('%s', 'now'), strftime('%s', 'now'));

-- 10. Seed Default Signatory
INSERT OR IGNORE INTO document_signatories (id, name, position, is_active, created_by, created_at, updated_at) VALUES
('sig_mohamad_abi', 'Mohamad Abi', 'Program Director Kian Troopers', 1, 'system', strftime('%s', 'now'), strftime('%s', 'now'));
