-- Migration 0012: Add project mentor reference
ALTER TABLE projects ADD COLUMN ojt_coordinator_id TEXT REFERENCES users(id);
