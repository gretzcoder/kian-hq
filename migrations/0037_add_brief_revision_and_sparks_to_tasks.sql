-- Add revision_note and sparks columns to tasks table for assessment brief review & ratings
ALTER TABLE tasks ADD COLUMN revision_note TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN sparks INTEGER DEFAULT NULL;
