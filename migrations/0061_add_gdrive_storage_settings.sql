-- Migration 0061: Add Google Drive storage settings and workspace gdrive_folder_id

ALTER TABLE workspaces ADD COLUMN gdrive_folder_id TEXT;

INSERT OR IGNORE INTO system_settings (key, value, updated_by, updated_at)
VALUES ('gdrive_enabled', 'false', 'system', strftime('%s', 'now'));

INSERT OR IGNORE INTO system_settings (key, value, updated_by, updated_at)
VALUES ('gdrive_client_email', '', 'system', strftime('%s', 'now'));

INSERT OR IGNORE INTO system_settings (key, value, updated_by, updated_at)
VALUES ('gdrive_private_key', '', 'system', strftime('%s', 'now'));

INSERT OR IGNORE INTO system_settings (key, value, updated_by, updated_at)
VALUES ('gdrive_root_folder_id', '', 'system', strftime('%s', 'now'));

INSERT OR IGNORE INTO system_settings (key, value, updated_by, updated_at)
VALUES ('gdrive_avatars_folder_id', '', 'system', strftime('%s', 'now'));
