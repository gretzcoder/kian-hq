const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = OFF;');

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
  INSERT INTO users (id, name, email, status) VALUES ('usr_1', 'Alice', 'alice@test.com', 'ACTIVE'), ('usr_2', 'Bob', 'bob@test.com', 'ACTIVE'), ('usr_other', 'Other', 'other@test.com', 'ACTIVE');
  INSERT INTO workspaces (id, project_id, name) VALUES ('ws_1', 'proj_1', 'Workspace 1');
`);

for (let i = 0; i < 50; i++) {
  db.exec(`INSERT INTO tasks (id, project_id, title, workspace_id, status, created_by) VALUES ('task_${i}', 'proj_1', 'Task ${i}', 'ws_1', 'ACTIVE', '${i === 0 ? 'usr_1' : 'usr_other'}');`);
  db.exec(`INSERT INTO task_assignments (id, task_id, user_id, status) VALUES ('ta_${i}', 'task_${i}', '${i === 0 ? 'usr_2' : 'usr_other'}', 'ASSIGNED');`);
}

for (let i = 0; i < 5000; i++) {
  db.exec(`INSERT INTO workflow_events (id, entity_type, entity_id, triggered_by, from_status, to_status, created_at) VALUES ('we_task_${i}', 'task', 'task_${i % 50}', 'usr_other', 'REMINDER_SENT', 'REMINDER_SENT', ${1000 + i});`);
  db.exec(`INSERT INTO workflow_events (id, entity_type, entity_id, triggered_by, from_status, to_status, created_at) VALUES ('we_ta_${i}', 'task_assignment', 'ta_${i % 50}', 'usr_other', 'REMINDER_SENT', 'REMINDER_SENT', ${2000 + i});`);
}

const subqueryInAll3 = `
SELECT * FROM (
  SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at,
         u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
         t.workspace_id AS wsId, ws.name AS wsName
  FROM workflow_events we
  JOIN task_assignments ta ON (we.entity_type = 'task_assignment' AND we.entity_id = ta.id)
  JOIN tasks t ON ta.task_id = t.id
  LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
  LEFT JOIN workspaces ws ON t.workspace_id = ws.id
  WHERE ta.id IN (SELECT id FROM task_assignments WHERE user_id = ?)
    AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
    AND (we.triggered_by IS NULL OR we.triggered_by != ?)
    AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)

  UNION

  SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at,
         u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
         t.workspace_id AS wsId, ws.name AS wsName
  FROM workflow_events we
  JOIN tasks t ON (we.entity_type = 'task' AND we.entity_id = t.id)
  LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
  LEFT JOIN workspaces ws ON t.workspace_id = ws.id
  WHERE t.id IN (SELECT id FROM tasks WHERE created_by = ? AND status != 'DELETED')
    AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
    AND (we.triggered_by IS NULL OR we.triggered_by != ?)
    AND (ws.id IS NULL OR ws.deleted_at IS NULL)

  UNION

  SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at,
         u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
         t.workspace_id AS wsId, ws.name AS wsName
  FROM workflow_events we
  JOIN tasks t ON (we.entity_type = 'task' AND we.entity_id = t.id)
  LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
  LEFT JOIN workspaces ws ON t.workspace_id = ws.id
  WHERE t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)
    AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
    AND (we.triggered_by IS NULL OR we.triggered_by != ?)
    AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
)
ORDER BY created_at DESC
LIMIT 15
`;

console.log("=== EXPLAIN SUBQUERY IN ALL 3 BRANCHES ===");
console.log(db.prepare(`EXPLAIN QUERY PLAN ${subqueryInAll3}`).all('usr_2', 'usr_2', 'usr_2', 'usr_2', 'usr_2', 'usr_2'));
