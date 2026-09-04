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

// Seed mock data
db.exec(`
  INSERT INTO projects (id, name) VALUES ('proj_1', 'Project 1');
  INSERT INTO users (id, name, email, status) VALUES ('usr_1', 'Alice', 'alice@test.com', 'ACTIVE'), ('usr_2', 'Bob', 'bob@test.com', 'ACTIVE');
  INSERT INTO workspaces (id, project_id, name) VALUES ('ws_1', 'proj_1', 'Workspace 1');
  INSERT INTO tasks (id, project_id, title, workspace_id, status, created_by) VALUES ('task_1', 'proj_1', 'Task 1', 'ws_1', 'ACTIVE', 'usr_1');
  INSERT INTO task_assignments (id, task_id, user_id, status) VALUES ('ta_1', 'task_1', 'usr_2', 'ASSIGNED');
`);

for (let i = 0; i < 500; i++) {
  db.exec(`
    INSERT INTO workflow_events (id, entity_type, entity_id, from_status, to_status, note, triggered_by, created_at)
    VALUES (
      'we_${i}',
      '${i % 2 === 0 ? 'task_assignment' : 'task'}',
      '${i % 2 === 0 ? 'ta_1' : 'task_1'}',
      'ACTIVE',
      'REMINDER_SENT',
      'Reminder note ${i}',
      'usr_1',
      ${1700000000 + i}
    );
  `);
}

const originalQuery = `
SELECT
    we.id, we.entity_type, we.entity_id, we.note, we.created_at,
    u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
    t.workspace_id AS wsId, ws.name AS wsName
FROM workflow_events we
LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
LEFT JOIN task_assignments ta ON (we.entity_type = 'task_assignment' AND we.entity_id = ta.id)
LEFT JOIN tasks t ON ((we.entity_type = 'task_assignment' AND ta.task_id = t.id) OR (we.entity_type = 'task' AND we.entity_id = t.id))
LEFT JOIN workspaces ws ON t.workspace_id = ws.id
WHERE (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
  AND (we.triggered_by IS NULL OR we.triggered_by != 'usr_2')
  AND (
    (we.entity_type = 'task_assignment' AND ta.user_id = 'usr_2')
    OR (we.entity_type = 'task' AND t.created_by = 'usr_2')
    OR (we.entity_type = 'task' AND EXISTS (SELECT 1 FROM task_assignments WHERE task_id = t.id AND user_id = 'usr_2'))
  )
  AND t.status != 'DELETED'
  AND (ws.id IS NULL OR ws.deleted_at IS NULL)
ORDER BY we.created_at DESC
LIMIT 15
`;

// Optimized Query: Drive from ta (for task_assignment events) and t (for task events)
const optimizedQuery = `
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
  WHERE ta.user_id = 'usr_2'
    AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
    AND (we.triggered_by IS NULL OR we.triggered_by != 'usr_2')
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
  WHERE (t.created_by = 'usr_2' OR EXISTS (SELECT 1 FROM task_assignments WHERE task_id = t.id AND user_id = 'usr_2'))
    AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
    AND (we.triggered_by IS NULL OR we.triggered_by != 'usr_2')
    AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
)
ORDER BY created_at DESC
LIMIT 15
`;

console.log('--- ORIGINAL QUERY PLAN ---');
db.prepare(`EXPLAIN QUERY PLAN ${originalQuery}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n--- OPTIMIZED QUERY PLAN ---');
db.prepare(`EXPLAIN QUERY PLAN ${optimizedQuery}`).all().forEach(s => console.log('  ', s.detail));
