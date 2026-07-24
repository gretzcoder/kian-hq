-- =============================================================
-- Migration 0006: Permission System v2
-- Granular permissions aligned with Workflow-Based Architecture
-- "If a feature can become a Permission, it SHOULD become a Permission."
-- =============================================================

-- 1. Remove old generic CREATE permission (replaced by specific ones)
--    We soft-replace: rename in description to signal deprecation.
--    Safe: existing role_permissions rows will be updated below.
UPDATE permissions SET
    name        = 'CREATE_ANNOUNCEMENT',
    description = 'Post announcements to the team'
WHERE id = 'perm_create';

UPDATE role_permissions SET permission_id = 'perm_create' WHERE permission_id = 'perm_create';
-- (no-op row update to preserve FK integrity; actual id key stays same, name changed above)

-- 2. Insert all new granular permissions
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
-- Brief Workflow
('perm_submit_brief',        'SUBMIT_BRIEF',        'Submit a draft brief for coordinator review'),
('perm_approve_brief',       'APPROVE_BRIEF',       'Approve a submitted content brief'),
('perm_request_changes',     'REQUEST_CHANGES',     'Send a brief back for revision (like PR review)'),
('perm_unlock_brief',        'UNLOCK_BRIEF',        'Unlock an approved/locked brief for editing'),

-- Project
('perm_create_project',      'CREATE_PROJECT',      'Create a new project (usually from an approved brief)'),
('perm_publish_project',     'PUBLISH_PROJECT',     'Change project status to PUBLISHED'),
('perm_archive_project',     'ARCHIVE_PROJECT',     'Archive a finished project'),

-- Workspace
('perm_create_workspace',    'CREATE_WORKSPACE',    'Create a workspace inside a project'),
('perm_update_workspace',    'UPDATE_WORKSPACE',    'Edit workspace name, description, deadline'),

-- Task
('perm_create_task',         'CREATE_TASK',         'Create tasks inside a workspace'),
('perm_assign_task',         'ASSIGN_TASK',         'Assign creators to a task with a role (PIC/REVIEWER/etc)'),
('perm_request_revision',    'REQUEST_REVISION',    'Send a task back for revision'),

-- AI
('perm_use_ai',              'USE_AI',              'Access AI recommendation and insight engine');

-- 3. Remove old workflow permissions that are now superseded
--    perm_publish  -> perm_publish_project  (more specific)
--    perm_archive  -> perm_archive_project  (more specific)
--    perm_use_ai already existed in 0004 — keep it (already inserted above with OR IGNORE)

DELETE FROM role_permissions WHERE permission_id IN ('perm_publish', 'perm_archive');
DELETE FROM permissions       WHERE id            IN ('perm_publish', 'perm_archive');

-- 4. Remove old generic CREATE from all role_permissions (now CREATE_ANNOUNCEMENT)
--    The id 'perm_create' is being reused as CREATE_ANNOUNCEMENT.
--    COLLABORATOR never had CREATE so nothing to do for them.
--    CREATOR had CREATE — they should NOT have CREATE_ANNOUNCEMENT.
DELETE FROM role_permissions WHERE role_id = 'role_creator' AND permission_id = 'perm_create';

-- 5. Grant new permissions to EXECUTIVE (full access)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_submit_brief'),
('role_executive', 'perm_approve_brief'),
('role_executive', 'perm_request_changes'),
('role_executive', 'perm_unlock_brief'),
('role_executive', 'perm_create_project'),
('role_executive', 'perm_publish_project'),
('role_executive', 'perm_archive_project'),
('role_executive', 'perm_create_workspace'),
('role_executive', 'perm_update_workspace'),
('role_executive', 'perm_create_task'),
('role_executive', 'perm_assign_task'),
('role_executive', 'perm_request_revision'),
('role_executive', 'perm_use_ai');

-- 6. Grant new permissions to COORDINATOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_coordinator', 'perm_submit_brief'),
('role_coordinator', 'perm_approve_brief'),
('role_coordinator', 'perm_request_changes'),
('role_coordinator', 'perm_unlock_brief'),
('role_coordinator', 'perm_create_project'),
('role_coordinator', 'perm_publish_project'),
('role_coordinator', 'perm_archive_project'),
('role_coordinator', 'perm_create_workspace'),
('role_coordinator', 'perm_update_workspace'),
('role_coordinator', 'perm_create_task'),
('role_coordinator', 'perm_assign_task'),
('role_coordinator', 'perm_request_revision'),
('role_coordinator', 'perm_use_ai');

-- 7. Grant COLLABORATOR: brief workflow only (they initiate the flow)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_collaborator', 'perm_submit_brief');
-- (CREATE_BRIEF and UPDATE_BRIEF already exist from migration 0004)

-- 8. CREATOR: upload only (task execution, no management)
-- CREATOR keeps: READ, UPDATE (for their assigned tasks), COMMENT, UPLOAD, DOWNLOAD
-- CREATOR does NOT get: CREATE_TASK, ASSIGN_TASK, APPROVE, etc.
-- No new grants needed for CREATOR in this migration.
