-- Migration: Add OJT profile fields to users table
ALTER TABLE users ADD COLUMN university TEXT;
ALTER TABLE users ADD COLUMN study_program TEXT;
ALTER TABLE users ADD COLUMN semester TEXT;
ALTER TABLE users ADD COLUMN whatsapp_number TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN main_roles TEXT; -- Stored as JSON array or comma-separated string
ALTER TABLE users ADD COLUMN custom_role TEXT;
ALTER TABLE users ADD COLUMN tools TEXT;
ALTER TABLE users ADD COLUMN portfolio_url TEXT;
