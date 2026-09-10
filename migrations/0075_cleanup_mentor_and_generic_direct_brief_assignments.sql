-- Migration 0075: Cleanup mentor assignments & unsubmitted generic assignments on direct brief tasks

-- 1. Remove any unsubmitted assignments belonging to workspace mentors on troopers / direct brief tasks
DELETE FROM task_assignments
WHERE id IN (
  SELECT ta.id
  FROM task_assignments ta
  JOIN tasks t ON ta.task_id = t.id
  JOIN workspace_mentors wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ta.user_id
  WHERE (ta.result_url IS NULL OR TRIM(ta.result_url) = '')
    AND ta.status = 'ASSIGNED'
);

-- 2. Remove generic role assignments (DESIGN, DESIGNER, etc.) on direct brief tasks where custom slots exist
DELETE FROM task_assignments
WHERE id IN (
  SELECT ta.id
  FROM task_assignments ta
  JOIN tasks t ON ta.task_id = t.id
  WHERE (t.task_type = 'DIRECT_BRIEF' OR t.description LIKE '%[DIRECT_BRIEF]%')
    AND t.description LIKE '%[DIRECT_BRIEF_CATEGORIES:%'
    AND ta.assignment_role IN ('DESIGN', 'DESIGNER', 'VIDEO_EDITOR', 'CREATOR', 'PLANNER', 'RESEARCHER')
    AND (ta.result_url IS NULL OR TRIM(ta.result_url) = '')
    AND ta.status = 'ASSIGNED'
);
