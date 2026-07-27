-- Migration 0014: Project Coordinators
CREATE TABLE IF NOT EXISTS project_coordinators (
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, user_id)
);

-- Copy existing mentors from projects table
INSERT OR IGNORE INTO project_coordinators (project_id, user_id)
SELECT id, ojt_coordinator_id FROM projects WHERE ojt_coordinator_id IS NOT NULL;
