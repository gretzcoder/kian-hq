-- Migration 0054: Add extended_deadline column to tasks table
ALTER TABLE tasks ADD COLUMN extended_deadline INTEGER;
