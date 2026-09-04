-- Migration 0070: Add indexes for Task Assignments review filtering, pre-sorted task assignments, and achievement history

-- 1. Optimize pending review task assignments lookups (status IN ('WAITING_REVIEW','SUBMITTED','RESUBMITTED'), ORDER BY submitted_at ASC)
CREATE INDEX IF NOT EXISTS idx_task_assignments_status_submitted ON task_assignments (status, submitted_at);

-- 2. Eliminate temp B-tree sorting on workspace task assignments (WHERE task_id IN (...) ORDER BY created_at ASC)
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_created ON task_assignments (task_id, created_at);

-- 3. Optimize achievement history sorting & filtering
CREATE INDEX IF NOT EXISTS idx_achievement_history_earned ON achievement_history (earned_at, created_at);
