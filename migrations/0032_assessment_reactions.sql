-- Migration 0032: Assessment Submission Reactions
CREATE TABLE IF NOT EXISTS assessment_submission_reactions (
    assignment_id TEXT NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (assignment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_assessment_reactions_assignment ON assessment_submission_reactions(assignment_id);
