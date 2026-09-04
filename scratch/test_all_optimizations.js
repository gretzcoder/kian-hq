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
  INSERT INTO users (id, name, email, status) VALUES 
    ('usr_creator', 'Creator User', 'creator@test.com', 'ACTIVE'),
    ('usr_assignee', 'Assignee User', 'assignee@test.com', 'ACTIVE'),
    ('usr_both', 'Both User', 'both@test.com', 'ACTIVE'),
    ('usr_sender', 'Sender User', 'sender@test.com', 'ACTIVE');

  INSERT INTO workspaces (id, project_id, name, deleted_at) VALUES 
    ('ws_active', 'proj_1', 'Active WS', NULL),
    ('ws_deleted', 'proj_1', 'Deleted WS', 1700000000);

  -- Task 1: Created by usr_creator, assigned to usr_assignee in ws_active
  INSERT INTO tasks (id, project_id, title, workspace_id, status, created_by) VALUES 
    ('t1', 'proj_1', 'Task 1', 'ws_active', 'ACTIVE', 'usr_creator');
  INSERT INTO task_assignments (id, task_id, user_id, status) VALUES 
    ('ta1', 't1', 'usr_assignee', 'ASSIGNED');

  -- Task 2: Created by usr_both, assigned to usr_both in ws_active (creator + assignee edge case)
  INSERT INTO tasks (id, project_id, title, workspace_id, status, created_by) VALUES 
    ('t2', 'proj_1', 'Task 2', 'ws_active', 'ACTIVE', 'usr_both');
  INSERT INTO task_assignments (id, task_id, user_id, status) VALUES 
    ('ta2', 't2', 'usr_both', 'ASSIGNED');

  -- Task 3: Deleted task
  INSERT INTO tasks (id, project_id, title, workspace_id, status, created_by) VALUES 
    ('t3', 'proj_1', 'Deleted Task', 'ws_active', 'DELETED', 'usr_creator');
  INSERT INTO task_assignments (id, task_id, user_id, status) VALUES 
    ('ta3', 't3', 'usr_creator', 'ASSIGNED');

  -- Task 4: In deleted workspace
  INSERT INTO tasks (id, project_id, title, workspace_id, status, created_by) VALUES 
    ('t4', 'proj_1', 'Task in Deleted WS', 'ws_deleted', 'ACTIVE', 'usr_creator');

  -- Workflow Events
  INSERT INTO workflow_events (id, entity_type, entity_id, triggered_by, from_status, to_status, note, created_at) VALUES 
    ('we1', 'task_assignment', 'ta1', 'usr_sender', 'REMINDER_SENT', 'REMINDER_SENT', 'Reminder 1', 1000),
    ('we2', 'task', 't1', 'usr_sender', 'REMINDER_SENT', 'REMINDER_SENT', 'Reminder 2', 1001),
    ('we3', 'task', 't2', 'usr_sender', 'REMINDER_SENT', 'REMINDER_SENT', 'Reminder 3', 1002),
    ('we4', 'task', 't3', 'usr_sender', 'REMINDER_SENT', 'REMINDER_SENT', 'Reminder Deleted Task', 1003),
    ('we5', 'task', 't4', 'usr_sender', 'REMINDER_SENT', 'REMINDER_SENT', 'Reminder Deleted WS', 1004),
    ('we6', 'task', 't1', 'usr_assignee', 'REMINDER_SENT', 'REMINDER_SENT', 'Self Triggered by Assignee', 1005),
    ('we7', 'task', 't1', NULL, 'REMINDER_SENT', 'REMINDER_SENT', 'NULL Triggered By', 1006);
`);

const origSql = `
  SELECT * FROM (
    SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at,
           u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
           t.workspace_id AS wsId, ws.name AS wsName
    FROM task_assignments ta
    JOIN workflow_events we ON (we.entity_type = 'task_assignment' AND we.entity_id = ta.id)
    JOIN tasks t ON ta.task_id = t.id
    LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    WHERE ta.user_id = ?
      AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
      AND (we.triggered_by IS NULL OR we.triggered_by != ?)
      AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)

    UNION ALL

    SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at,
           u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle,
           t.workspace_id AS wsId, ws.name AS wsName
    FROM tasks t
    JOIN workflow_events we ON (we.entity_type = 'task' AND we.entity_id = t.id)
    LEFT JOIN users u_sender ON we.triggered_by = u_sender.id
    LEFT JOIN workspaces ws ON t.workspace_id = ws.id
    WHERE (t.created_by = ? OR EXISTS (SELECT 1 FROM task_assignments WHERE task_id = t.id AND user_id = ?))
      AND (we.from_status = 'REMINDER_SENT' OR we.to_status = 'REMINDER_SENT')
      AND (we.triggered_by IS NULL OR we.triggered_by != ?)
      AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
  )
  ORDER BY created_at DESC
  LIMIT 15
`;

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

for (const userId of ['usr_creator', 'usr_assignee', 'usr_both']) {
  const orig = db.prepare(origSql).all(userId, userId, userId, userId, userId);
  const subq = db.prepare(subqueryInAll3).all(userId, userId, userId, userId, userId, userId);

  const origIds = orig.map(r => r.id).sort().join(',');
  const subqIds = subq.map(r => r.id).sort().join(',');

  console.log(`User ${userId} parity: ${origIds === subqIds ? 'MATCH ✅' : 'MISMATCH ❌'}`);
  if (origIds !== subqIds) {
    console.log("  Orig:", orig.map(r => r.id));
    console.log("  Subq:", subq.map(r => r.id));
  }
}
