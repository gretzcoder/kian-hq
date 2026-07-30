-- Migration: Add username column to users table
ALTER TABLE users ADD COLUMN username TEXT;

-- Create UNIQUE index on lowercased username to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
