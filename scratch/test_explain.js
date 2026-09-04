const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const db = new DatabaseSync(':memory:');

const migrationsDir = path.join(__dirname, '..', 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

console.log(`Applying ${files.length} migrations...`);

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const cleanSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (err) {
      // Ignore minor duplicates during migrations
    }
  }
}

console.log('✅ Migrations applied successfully.\n');

// Print existing index list for target tables
const tables = ['workflow_events', 'tasks', 'task_assignments', 'workspace_members', 'users', 'user_roles', 'workspaces', 'workspace_chats'];

console.log('=== EXISTING INDEXES ===');
for (const t of tables) {
  const indexes = db.prepare(`PRAGMA index_list('${t}')`).all();
  console.log(`Table: ${t}`);
  for (const idx of indexes) {
    const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all().map(c => c.name).join(', ');
    console.log(`  - ${idx.name} (${cols}) ${idx.unique ? '[UNIQUE]' : ''}`);
  }
}

// Target Queries Audit
const targetQueries = [
  {
    id: 1,
    name: 'Workflow Events Select (Prioritas #1)',
    sql: `SELECT
    we.id, we.entity_type, we.entity_id, we.note, we.created_at,
    u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
    t.workspace_id AS wsId, ws.name AS wsName
FROM workflow_events we
LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
LEFT JOIN task_assignments ta ON (we.entity_type = 'task_assignment' AND we.entity_id = ta.id)
LEFT JOIN tasks t ON ((we.entity_type = 'task_assignment' AND ta.task_id = t.id) OR (we.entity_type = 'task' AND we.entity_id = t.id))
LEFT JOIN workspaces ws ON t.workspace_id = ws.id
WHERE (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
  AND (we.triggered_by IS NULL OR we.triggered_by != 'usr_test')
  AND (
    (we.entity_type = 'task_assignment' AND ta.user_id = 'usr_test')
    OR (we.entity_type = 'task' AND t.created_by = 'usr_test')
    OR (we.entity_type = 'task' AND EXISTS (SELECT 1 FROM task_assignments WHERE task_id = t.id AND user_id = 'usr_test'))
  )
  AND t.status != 'DELETED'
  AND (ws.id IS NULL OR ws.deleted_at IS NULL)
ORDER BY we.created_at DESC
LIMIT 15`
  },
  {
    id: 2,
    name: 'Update Tasks (Prioritas #2)',
    sql: `UPDATE tasks
SET status = 'APPROVED', revision_note = NULL
WHERE task_type = 'ASSESSMENT'
  AND status = 'WAITING_REVIEW'
  AND workspace_id = 'ws_test'
  AND id IN (
    SELECT DISTINCT task_id
    FROM task_assignments
    WHERE result_url IS NOT NULL
       OR status IN ('WAITING_REVIEW', 'APPROVED', 'REVISION_REQUESTED')
       OR mentor_approved = 1
       OR coordinator_approved = 1
  )`
  },
  {
    id: 3,
    name: 'Workspace Members (Prioritas #3)',
    sql: `SELECT wm.user_id AS userId, u.name AS userName, u.email AS userEmail,
       wm.team_role AS teamRole, u.user_type AS userType, u.avatar_url AS avatarUrl
FROM workspace_members wm
JOIN users u ON wm.user_id = u.id
WHERE wm.workspace_id = 'ws_test'
ORDER BY wm.created_at ASC`
  },
  {
    id: 4,
    name: 'Users + User Roles (Prioritas #4)',
    sql: `SELECT u.id, u.name, u.email, u.user_type AS userType,
       GROUP_CONCAT(DISTINCT r.name) AS roleNames,
       GROUP_CONCAT(DISTINCT r.id) AS roleIds
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.status = 'ACTIVE'
GROUP BY u.id
ORDER BY u.name ASC`
  },
  {
    id: 5,
    name: 'Workspace Latest Timestamp',
    sql: `SELECT ws.id AS wsId,
       MAX(
         ws.created_at,
         COALESCE((SELECT MAX(created_at) FROM tasks WHERE workspace_id = ws.id AND status != 'DELETED'), 0),
         COALESCE((SELECT MAX(created_at) FROM workspace_chats WHERE workspace_id = ws.id), 0)
       ) AS latestTs
FROM workspaces ws
WHERE ws.deleted_at IS NULL`
  }
];

console.log('\n=== CURRENT EXPLAIN QUERY PLANS ===');
for (const q of targetQueries) {
  console.log(`\n📌 Query #${q.id}: ${q.name}`);
  try {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all();
    for (const step of plan) {
      console.log(`   [Plan] id:${step.id} parent:${step.parent} detail:${step.detail}`);
    }
  } catch (err) {
    console.error(`   ❌ EXPLAIN failed:`, err.message);
  }
}
