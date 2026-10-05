-- Migration 0082: Add financial_details JSON column to users table
ALTER TABLE users ADD COLUMN financial_details TEXT;
