-- Migration 0071: Targeted Composite Indexes for D1 Rows Read Optimization

-- 1. Optimize Query #1: workflow_events entity lookups by entity_type and entity_id
CREATE INDEX IF NOT EXISTS idx_workflow_events_entity_status_created 
ON workflow_events (entity_type, entity_id, to_status, created_at DESC);

-- 2. Optimize Query #4 & #10: task_assignments user & status composite index
CREATE INDEX IF NOT EXISTS idx_task_assignments_user_status_task 
ON task_assignments (user_id, status, task_id);

-- 3. Optimize Query #2, #3, & #5: task_assignments status, submitted_at & result_url
CREATE INDEX IF NOT EXISTS idx_task_assignments_status_submitted_url 
ON task_assignments (status, submitted_at, result_url);

-- 4. Optimize Query #10: tasks status & workspace filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status_ws_created 
ON tasks (status, workspace_id, created_at DESC);

-- 5. Optimize Query #4b: assessment task mentor lookups
CREATE INDEX IF NOT EXISTS idx_tasks_type_status_created 
ON tasks (task_type, status, created_by);

-- 6. Optimize Query #7: workspace_members covering index
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_ws_role 
ON workspace_members (user_id, workspace_id, team_role);

-- 7. Optimize Query #6: sparks_adjustments user lookup
CREATE INDEX IF NOT EXISTS idx_sparks_adjustments_user_created 
ON sparks_adjustments (user_id, created_at DESC);
