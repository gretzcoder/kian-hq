-- Migration 0046: Cleanup mentor task assignments from assessment tasks

DELETE FROM task_assignments
WHERE task_id IN (
    SELECT t.id 
    FROM tasks t
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    WHERE t.task_type = 'ASSESSMENT' OR ws.workspace_type = 'ASSESSMENT'
)
AND user_id IN (
    -- Users who are Leaders/Mentors in workspace_members
    SELECT wm.user_id 
    FROM workspace_members wm 
    WHERE wm.team_role = 'LEADER'
    
    UNION
    
    -- Users with mentor roles
    SELECT ur.user_id 
    FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE r.id IN ('role_mentor_troopers', 'role_mentor') OR UPPER(r.name) LIKE '%MENTOR%'
    
    UNION
    
    -- OJT Coordinators
    SELECT ojt_coordinator_id 
    FROM workspaces 
    WHERE ojt_coordinator_id IS NOT NULL
    
    UNION
    
    -- STAFF users
    SELECT id 
    FROM users 
    WHERE user_type = 'STAFF'
);
