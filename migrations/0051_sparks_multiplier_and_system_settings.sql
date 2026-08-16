-- Migration 0051: Add sparks_multiplier column to tasks and create system_settings table

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at INTEGER
);

-- Seed default category multipliers if not exists
INSERT OR IGNORE INTO system_settings (key, value, updated_by, updated_at)
VALUES ('category_multiplier_design', '1.0', 'system', strftime('%s', 'now'));

INSERT OR IGNORE INTO system_settings (key, value, updated_by, updated_at)
VALUES ('category_multiplier_video', '1.0', 'system', strftime('%s', 'now'));
