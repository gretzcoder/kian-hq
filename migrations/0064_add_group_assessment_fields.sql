-- =============================================================
-- Migration 0064: Add Group Assessment Support Fields
-- Goal: Support Individual vs Group Assessment categories
-- =============================================================

PRAGMA foreign_keys = OFF;

-- 1. Add assessment_category to tasks table ('INDIVIDUAL' or 'GROUP')
ALTER TABLE tasks ADD COLUMN assessment_category TEXT DEFAULT 'INDIVIDUAL';

-- 2. Add group_name to task_assignments table (e.g. 'Kelompok 1', 'Kelompok 2')
ALTER TABLE task_assignments ADD COLUMN group_name TEXT;

PRAGMA foreign_keys = ON;
