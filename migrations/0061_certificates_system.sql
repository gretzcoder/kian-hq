-- Migration 0061: Certificate System Tables & Default Templates

CREATE TABLE IF NOT EXISTS certificate_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  layout_type TEXT NOT NULL DEFAULT 'CLASSIC', -- CLASSIC | MODERN | ELEGANT | VIBRANT
  background_color TEXT DEFAULT '#0f172a',
  border_style TEXT DEFAULT 'GOLD',
  accent_color TEXT DEFAULT '#f59e0b',
  signatory_name TEXT DEFAULT 'Kian HQ Management',
  signatory_title TEXT DEFAULT 'Program Coordinator',
  signatory_signature_url TEXT,
  custom_subtext TEXT DEFAULT 'Sertifikat ini diberikan sebagai penghargaan resmi atas pencapaian, dedikasi, dan kontribusi luar biasa dalam ekosistem Kian HQ.',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  certificate_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Certificate of Achievement',
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT | PUBLISHED
  issue_date INTEGER NOT NULL,
  performance_metrics TEXT NOT NULL, -- JSON snapshot of user achievements
  issued_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);

-- Seed initial 4 certificate templates
INSERT OR IGNORE INTO certificate_templates (
  id, name, description, layout_type, background_color, border_style, accent_color, signatory_name, signatory_title, custom_subtext, is_active, created_at, updated_at
) VALUES 
(
  'tpl_classic_gold',
  'Classic Gold Honor',
  'Desain elegan bernuansa emas klasik cocok untuk penghargaan kelulusan dan prestasi utama.',
  'CLASSIC',
  '#0b0f19',
  'GOLD',
  '#eab308',
  'Kian HQ Leadership',
  'Executive Program Director',
  'Sertifikat ini diberikan sebagai bentuk penghargaan resmi atas performa tinggi, dedikasi, dan penyelesaian tugas di Kian HQ.',
  1,
  1772175000,
  1772175000
),
(
  'tpl_modern_cyber',
  'Modern Cyber Dark',
  'Desain futuristik dengan aksen neon cyan-purple untuk tim kreatif dan digital specialist.',
  'MODERN',
  '#090d16',
  'CYBER',
  '#06b6d4',
  'Kian HQ AI Team',
  'Operations Lead',
  'Diberikan atas kontribusi luar biasa, kemampuan teknis presisi, dan integritas tinggi dalam ekosistem proyek Kian HQ.',
  1,
  1772175000,
  1772175000
),
(
  'tpl_corporate_blue',
  'Corporate Elegance',
  'Desain bersahaja dan profesional dengan nuansa navy dan aksen silver indigo.',
  'ELEGANT',
  '#0f172a',
  'SILVER',
  '#3b82f6',
  'Kian HQ Advisory',
  'General Coordinator',
  'Telah membuktikan keahlian profesional, penyelesaian milestone tepat waktu, dan standar kualitas tinggi.',
  1,
  1772175000,
  1772175000
),
(
  'tpl_vibrant_creative',
  'Vibrant Creative',
  'Desain dinamis dengan warna hangat dan ekspresif untuk apresiasi karya kreatif.',
  'VIBRANT',
  '#180828',
  'GRADIENT',
  '#ec4899',
  'Kian HQ Creative Studio',
  'Head of Creative',
  'Sebagai pengakuan atas daya cipta, eksekusi visual memukau, serta pencapaian milestone di Kian HQ.',
  1,
  1772175000,
  1772175000
);
