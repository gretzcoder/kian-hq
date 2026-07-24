-- Migration 0007: Add title to content_briefs
ALTER TABLE content_briefs ADD COLUMN title TEXT;
