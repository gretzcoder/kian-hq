-- Migration: 0067_add_required_outputs_to_tasks.sql
-- Description: Add required_outputs column to tasks table for requested output items (e.g. Bumper In, Bumper Out, Looping)

ALTER TABLE tasks ADD COLUMN required_outputs TEXT;
