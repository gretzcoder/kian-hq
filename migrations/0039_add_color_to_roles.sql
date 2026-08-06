-- Add color column to roles table for custom hex color management
ALTER TABLE roles ADD COLUMN color TEXT DEFAULT NULL;

-- Seed default Hex colors for existing system roles
UPDATE roles SET color = '#8B5CF6' WHERE id = 'role_executive' AND (color IS NULL OR color = '');
UPDATE roles SET color = '#3B82F6' WHERE id = 'role_coordinator' AND (color IS NULL OR color = '');
UPDATE roles SET color = '#F59E0B' WHERE id = 'role_mentor_troopers' AND (color IS NULL OR color = '');
UPDATE roles SET color = '#10B981' WHERE id = 'role_creator' AND (color IS NULL OR color = '');
UPDATE roles SET color = '#06B6D4' WHERE id = 'role_troopers' AND (color IS NULL OR color = '');
UPDATE roles SET color = '#06B6D4' WHERE id = 'role_on_the_job_training' AND (color IS NULL OR color = '');
UPDATE roles SET color = '#EAB308' WHERE id = 'role_collaborator' AND (color IS NULL OR color = '');
