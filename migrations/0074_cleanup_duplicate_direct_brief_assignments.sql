-- Migration 0074: Cleanup duplicate task assignments in direct brief tasks
-- When a user has both a custom slot role (e.g. '[ALUMNI] ...') and a generic role ('DESIGNER', 'VIDEO_EDITOR', 'CREATOR'),
-- remove the unsubmitted generic assignment.

DELETE FROM task_assignments
WHERE id IN (
  SELECT ta_generic.id
  FROM task_assignments ta_generic
  JOIN task_assignments ta_custom 
    ON ta_generic.task_id = ta_custom.task_id 
   AND ta_generic.user_id = ta_custom.user_id
   AND ta_generic.id != ta_custom.id
  WHERE ta_generic.assignment_role IN ('DESIGNER', 'VIDEO_EDITOR', 'CREATOR')
    AND ta_custom.assignment_role NOT IN ('DESIGNER', 'VIDEO_EDITOR', 'CREATOR')
    AND ta_generic.status = 'ASSIGNED'
    AND (ta_generic.result_url IS NULL OR TRIM(ta_generic.result_url) = '')
);
