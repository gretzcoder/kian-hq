const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const db = new DatabaseSync(':memory:');

const migrationsDir = path.join(__dirname, '..', 'migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const cleanSql = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  for (const stmt of cleanSql.split(';').map((s) => s.trim()).filter(Boolean)) {
    try { db.exec(stmt); } catch (_e) {}
  }
}

// Add proposed new composite indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_created ON workspace_members (workspace_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_users_status_name ON users (status, name);
`);

console.log('=== OPTIMIZED QUERY PLANS WITH REWRITES & INDEXES ===\n');

// 1. Workflow Events (UNION ALL rewrite)
const q1_opt = `
SELECT * FROM (
  SELECT
      we.id, we.entity_type, we.entity_id, we.note, we.created_at,
      u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
      t.workspace_id AS wsId, ws.name AS wsName
  FROM task_assignments ta
  JOIN workflow_events we ON (we.entity_type = 'task_assignment' AND we.entity_id = ta.id)
  JOIN tasks t ON ta.task_id = t.id
  LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
  LEFT JOIN workspaces ws ON t.workspace_id = ws.id
  WHERE ta.user_id = 'usr_test'
    AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
    AND (we.triggered_by IS NULL OR we.triggered_by != 'usr_test')
    AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)

  UNION ALL

  SELECT
      we.id, we.entity_type, we.entity_id, we.note, we.created_at,
      u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
      t.workspace_id AS wsId, ws.name AS wsName
  FROM tasks t
  JOIN workflow_events we ON (we.entity_type = 'task' AND we.entity_id = t.id)
  LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
  LEFT JOIN workspaces ws ON t.workspace_id = ws.id
  WHERE (t.created_by = 'usr_test' OR EXISTS (SELECT 1 FROM task_assignments WHERE task_id = t.id AND user_id = 'usr_test'))
    AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
    AND (we.triggered_by IS NULL OR we.triggered_by != 'usr_test')
    AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
)
ORDER BY created_at DESC
LIMIT 15
`;

// 2. Update Tasks (EXISTS rewrite)
const q2_opt = `
UPDATE tasks
SET status = 'APPROVED', revision_note = NULL
WHERE task_type = 'ASSESSMENT'
  AND status = 'WAITING_REVIEW'
  AND workspace_id = 'ws_test'
  AND EXISTS (
    SELECT 1
    FROM task_assignments ta
    WHERE ta.task_id = tasks.id
      AND (
        ta.result_url IS NOT NULL
        OR ta.status IN ('WAITING_REVIEW', 'APPROVED', 'REVISION_REQUESTED')
        OR ta.mentor_approved = 1
        OR ta.coordinator_approved = 1
      )
  )
`;

// 3. Workspace Members
const q3_opt = `
SELECT wm.user_id AS userId, u.name AS userName, u.email AS userEmail,
       wm.team_role AS teamRole, u.user_type AS userType, u.avatar_url AS avatarUrl
FROM workspace_members wm
JOIN users u ON wm.user_id = u.id
WHERE wm.workspace_id = 'ws_test'
ORDER BY wm.created_at ASC
`;

// 4. Users + User Roles
const q4_opt = `
SELECT u.id, u.name, u.email, u.user_type AS userType,
       GROUP_CONCAT(DISTINCT r.name) AS roleNames,
       GROUP_CONCAT(DISTINCT r.id) AS roleIds
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.status = 'ACTIVE'
GROUP BY u.id, u.name
ORDER BY u.name ASC
`;

console.log('📌 Query #1 (Workflow Events UNION ALL):');
db.prepare(`EXPLAIN QUERY PLAN ${q1_opt}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n📌 Query #2 (Update Tasks EXISTS):');
db.prepare(`EXPLAIN QUERY PLAN ${q2_opt}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n📌 Query #3 (Workspace Members with idx_workspace_members_ws_created):');
db.prepare(`EXPLAIN QUERY PLAN ${q3_opt}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n📌 Query #4 (Users + User Roles with idx_users_status_name):');
db.prepare(`EXPLAIN QUERY PLAN ${q4_opt}`).all().forEach(s => console.log('  ', s.detail));
