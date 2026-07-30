-- Migration: Add onboarding_completed flag to users table
ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0;
