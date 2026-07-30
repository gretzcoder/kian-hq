-- Migration 0021: Add Sparks column to task_assignments

ALTER TABLE task_assignments ADD COLUMN sparks INTEGER DEFAULT 0;
