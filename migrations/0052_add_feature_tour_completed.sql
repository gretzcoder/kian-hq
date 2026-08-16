-- Migration 0052: Add feature_tour_completed column to users table

ALTER TABLE users ADD COLUMN feature_tour_completed INTEGER DEFAULT 0;
