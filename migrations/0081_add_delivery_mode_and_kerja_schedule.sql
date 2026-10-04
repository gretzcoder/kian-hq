-- Migration 0081: Add delivery_mode for Tatap Muka / Online and Support KERJA schedules

ALTER TABLE user_availabilities ADD COLUMN delivery_mode TEXT DEFAULT 'TATAP_MUKA';
