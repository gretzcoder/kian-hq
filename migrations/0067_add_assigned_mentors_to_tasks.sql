-- Migration 0067: Add assigned_mentors column to tasks table for Assessment Workspaces
ALTER TABLE tasks ADD COLUMN assigned_mentors TEXT DEFAULT NULL;
