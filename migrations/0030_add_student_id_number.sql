-- Migration 0030: Add student_id_number (NIM) column to users table
ALTER TABLE users ADD COLUMN student_id_number TEXT;
