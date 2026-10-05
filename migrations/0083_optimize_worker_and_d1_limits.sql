-- Migration 0083: Optimize D1 Index Coverage & Worker Resource Limits
-- Prevents full table scans on users, generated_documents, user_availabilities, sparks_adjustments,
-- and eliminates cascading foreign key verification table scans during DELETE operations.

-- 1. Users table lookup optimizations (Username uniqueness check, NPM / NIM search, Case-insensitive login & search, User Type)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id_number);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

-- 2. Projects & Content Briefs (Analytics count aggregations and list sorting)
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_content_briefs_status ON content_briefs(status);

-- 3. Generated documents optimizations (Notification listing, numbering uniqueness, template lookups)
CREATE INDEX IF NOT EXISTS idx_generated_docs_created ON generated_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_docs_template_id ON generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_status_num ON generated_documents(status, document_number);

-- 4. User Availabilities (Active schedule polling)
CREATE INDEX IF NOT EXISTS idx_user_availabilities_active ON user_availabilities(is_active);

-- 5. Sparks adjustments (Badge rewards, claim reward badge lookups, appreciation tracking)
CREATE INDEX IF NOT EXISTS idx_sparks_adj_user_badge ON sparks_adjustments(user_id, badge_id, category);
CREATE INDEX IF NOT EXISTS idx_sparks_adj_user_type ON sparks_adjustments(user_id, type);
CREATE INDEX IF NOT EXISTS idx_sparks_adj_category ON sparks_adjustments(category);
CREATE INDEX IF NOT EXISTS idx_sparks_adj_created_by ON sparks_adjustments(created_by);

-- 6. Executive Feedback & Replies (Threaded replies deletion and foreign key cascade prevention)
CREATE INDEX IF NOT EXISTS idx_exec_feedback_replies_parent ON executive_feedback_replies(parent_id);
CREATE INDEX IF NOT EXISTS idx_exec_feedback_replies_user ON executive_feedback_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_exec_feedback_replies_feedback ON executive_feedback_replies(feedback_id);
CREATE INDEX IF NOT EXISTS idx_exec_feedbacks_sparks_adj ON executive_feedbacks(sparks_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_exec_feedbacks_sparks_given_by ON executive_feedbacks(sparks_given_by);

-- 7. Tasks and Assignments Foreign Key indexes (Prevents full table scans on user deletion)
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by);

-- 8. Knowledge Base (Category cascade and user foreign keys)
CREATE INDEX IF NOT EXISTS idx_knowledge_items_cat_sort ON knowledge_items(category_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_created_by ON knowledge_items(created_by);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_created_by ON knowledge_categories(created_by);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_sort ON knowledge_categories(sort_order ASC, name ASC);

-- 9. Foreign key user_id indexes to prevent cascading scans on user deletion
CREATE INDEX IF NOT EXISTS idx_bank_content_comments_user ON bank_content_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_comments_user ON announcement_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_comments_parent ON announcement_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user ON announcement_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reactions_user ON assessment_submission_reactions(user_id);

-- 10. Workflow events, Friendships, and community channels/categories
CREATE INDEX IF NOT EXISTS idx_workflow_events_entity ON workflow_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_community_channels_cat_sort ON community_channels(category, sort_order ASC, name ASC);
CREATE INDEX IF NOT EXISTS idx_community_channels_default ON community_channels(is_default);
CREATE INDEX IF NOT EXISTS idx_community_categories_sort ON community_categories(sort_order ASC, name ASC);
CREATE INDEX IF NOT EXISTS idx_org_nodes_order_created ON organization_nodes(order_index ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_org_nodes_order_name ON organization_nodes(order_index ASC, name ASC);

-- 11. Certificate & Document templates
CREATE INDEX IF NOT EXISTS idx_cert_templates_created ON certificate_templates(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_doc_types_active_created ON document_types(is_active, created_at ASC);
