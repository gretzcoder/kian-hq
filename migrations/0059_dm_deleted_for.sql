-- Migration 0059: Add deleted_for column for POV message deletion in direct_messages
ALTER TABLE direct_messages ADD COLUMN deleted_for TEXT DEFAULT '[]';
