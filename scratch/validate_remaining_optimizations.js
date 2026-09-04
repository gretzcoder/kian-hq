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

// Add composite indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_created ON workspace_members (workspace_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_users_status_name ON users (status, name);
  CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_status ON direct_messages (receiver_id, status);
`);

console.log('=== UPDATE TASKS EXPLAIN PLAN (BEFORE vs AFTER) ===');
const q2_orig = `
UPDATE tasks
SET status = 'APPROVED', revision_note = NULL
WHERE task_type = 'ASSESSMENT' AND status = 'WAITING_REVIEW' AND workspace_id = 'ws_1'
  AND id IN (
    SELECT DISTINCT task_id FROM task_assignments
    WHERE result_url IS NOT NULL OR status IN ('WAITING_REVIEW', 'APPROVED', 'REVISION_REQUESTED') OR mentor_approved = 1 OR coordinator_approved = 1
  )
`;

const q2_opt = `
UPDATE tasks
SET status = 'APPROVED', revision_note = NULL
WHERE task_type = 'ASSESSMENT' AND status = 'WAITING_REVIEW' AND workspace_id = 'ws_1'
  AND EXISTS (
    SELECT 1 FROM task_assignments ta
    WHERE ta.task_id = tasks.id
      AND (ta.result_url IS NOT NULL OR ta.status IN ('WAITING_REVIEW', 'APPROVED', 'REVISION_REQUESTED') OR ta.mentor_approved = 1 OR ta.coordinator_approved = 1)
  )
`;

console.log('BEFORE (IN DISTINCT):');
db.prepare(`EXPLAIN QUERY PLAN ${q2_orig}`).all().forEach(s => console.log('  ', s.detail));

console.log('\nAFTER (EXISTS):');
db.prepare(`EXPLAIN QUERY PLAN ${q2_opt}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n=== WORKSPACE MEMBERS EXPLAIN PLAN ===');
const q3_sql = `
SELECT wm.user_id AS userId, u.name AS userName, u.email AS userEmail,
       wm.team_role AS teamRole, u.user_type AS userType, u.avatar_url AS avatarUrl
FROM workspace_members wm
JOIN users u ON wm.user_id = u.id
WHERE wm.workspace_id = 'ws_1'
ORDER BY wm.created_at ASC
`;
db.prepare(`EXPLAIN QUERY PLAN ${q3_sql}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n=== USERS + USER ROLES EXPLAIN PLAN ===');
const q4_sql = `
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
db.prepare(`EXPLAIN QUERY PLAN ${q4_sql}`).all().forEach(s => console.log('  ', s.detail));
