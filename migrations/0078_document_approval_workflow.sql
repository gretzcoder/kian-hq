-- Migration 0078: Document Approval Workflow & Rejection metadata
ALTER TABLE generated_documents ADD COLUMN approved_by TEXT;
ALTER TABLE generated_documents ADD COLUMN approved_at INTEGER;
ALTER TABLE generated_documents ADD COLUMN rejection_reason TEXT;
