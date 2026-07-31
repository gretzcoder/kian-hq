-- Migration 0025: Add department and bio to users table for Staff and OJT profiles
ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
