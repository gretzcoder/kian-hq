-- Migration 0053: Add notify_community_chat column to user_notification_settings
ALTER TABLE user_notification_settings ADD COLUMN notify_community_chat INTEGER DEFAULT 1;
