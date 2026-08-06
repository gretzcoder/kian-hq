-- =============================================================
-- Migration 0043: Remove OJT INTERN / ON THE JOB TRAINING role
-- Clean up legacy role_on_the_job_training role and mappings
-- =============================================================

PRAGMA foreign_keys = OFF;

DELETE FROM role_permissions WHERE role_id = 'role_on_the_job_training';
DELETE FROM user_roles WHERE role_id = 'role_on_the_job_training';
DELETE FROM roles WHERE id = 'role_on_the_job_training' OR LOWER(name) LIKE '%on the job training%';

PRAGMA foreign_keys = ON;
