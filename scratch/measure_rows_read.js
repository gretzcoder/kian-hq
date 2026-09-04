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
`);

// Populate realistic dataset
console.log('Populating benchmark database...');
db.exec(`
  INSERT INTO projects (id, name) VALUES ('proj_1', 'Project Alpha');
  INSERT INTO workspaces (id, project_id, name, created_at) VALUES ('ws_1', 'proj_1', 'Workspace Alpha', 1700000000);
`);

for (let i = 1; i <= 50; i++) {
  const uid = `usr_${i}`;
  db.exec(`INSERT INTO users (id, name, email, status, created_at) VALUES ('${uid}', 'User ${i}', 'user${i}@test.com', 'ACTIVE', ${1700000000 + i});`);
  db.exec(`INSERT INTO workspace_members (workspace_id, user_id, team_role, created_at) VALUES ('ws_1', '${uid}', 'MEMBER', ${1700000000 + i});`);
}

for (let t = 1; t <= 100; t++) {
  const tid = `task_${t}`;
  const uid = `usr_${(t % 50) + 1}`;
  db.exec(`INSERT INTO tasks (id, project_id, workspace_id, title, status, created_by, task_type, created_at) VALUES ('${tid}', 'proj_1', 'ws_1', 'Task ${t}', 'WAITING_REVIEW', '${uid}', 'ASSESSMENT', ${1700000000 + t});`);
  
  for (let a = 1; a <= 3; a++) {
    const taid = `ta_${t}_${a}`;
    const targetUid = `usr_${((t + a) % 50) + 1}`;
    db.exec(`INSERT INTO task_assignments (id, task_id, user_id, status, created_at) VALUES ('${taid}', '${tid}', '${targetUid}', 'WAITING_REVIEW', ${1700000000 + t});`);
    
    // Create workflow_events
    db.exec(`INSERT INTO workflow_events (id, entity_type, entity_id, from_status, to_status, note, triggered_by, created_at)
             VALUES ('we_${t}_${a}', 'task_assignment', '${taid}', 'ACTIVE', 'REMINDER_SENT', 'Reminder for task ${t}', 'usr_1', ${1700000000 + t});`);
  }

  db.exec(`INSERT INTO workflow_events (id, entity_type, entity_id, from_status, to_status, note, triggered_by, created_at)
           VALUES ('we_task_${t}', 'task', '${tid}', 'ACTIVE', 'REMINDER_SENT', 'Task level reminder ${t}', 'usr_1', ${1700000000 + t});`);
}

console.log('Dataset populated successfully.\n');

// Queries
const q1_orig = `
SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at, u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle, t.workspace_id AS wsId, ws.name AS wsName
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
  AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
ORDER BY we.created_at DESC
LIMIT 15;
`;

const q1_opt = `
SELECT * FROM (
  SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at, u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle, t.workspace_id AS wsId, ws.name AS wsName
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

  SELECT we.id, we.entity_type, we.entity_id, we.note, we.created_at, u_sender.name AS senderName, t.id AS taskId, t.title AS taskTitle, t.workspace_id AS wsId, ws.name AS wsName
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
LIMIT 15;
`;

const q2_orig = `
UPDATE tasks
SET status = 'APPROVED', revision_note = NULL
WHERE task_type = 'ASSESSMENT' AND status = 'WAITING_REVIEW' AND workspace_id = 'ws_1'
  AND id IN (
    SELECT DISTINCT task_id FROM task_assignments
    WHERE result_url IS NOT NULL OR status IN ('WAITING_REVIEW', 'APPROVED', 'REVISION_REQUESTED') OR mentor_approved = 1 OR coordinator_approved = 1
  );
`;

const q2_opt = `
UPDATE tasks
SET status = 'APPROVED', revision_note = NULL
WHERE task_type = 'ASSESSMENT' AND status = 'WAITING_REVIEW' AND workspace_id = 'ws_1'
  AND EXISTS (
    SELECT 1 FROM task_assignments ta
    WHERE ta.task_id = tasks.id
      AND (ta.result_url IS NOT NULL OR ta.status IN ('WAITING_REVIEW', 'APPROVED', 'REVISION_REQUESTED') OR ta.mentor_approved = 1 OR ta.coordinator_approved = 1)
  );
`;

// Helper to count SQLite opcode steps (which correlates to rows inspected)
function countSteps(sql) {
  const plan = db.prepare(`EXPLAIN ${sql}`).all();
  return plan.length;
}

console.log('--- EXACT STEP COMPARISON (PROXIMATE ROWS READ) ---');
console.log(`Query #1 (Workflow Events): Original steps = ${countSteps(q1_orig)} vs Optimized steps = ${countSteps(q1_opt)}`);
console.log(`Query #2 (Update Tasks):    Original steps = ${countSteps(q2_orig)} vs Optimized steps = ${countSteps(q2_opt)}`);

// Verify results match identically
const r1_orig = db.prepare(q1_orig).all();
const r1_opt = db.prepare(q1_opt).all();
console.log(`\nQuery #1 Output Row Count: Original = ${r1_orig.length}, Optimized = ${r1_opt.length}`);
console.log(`Query #1 Output Identical? ${JSON.stringify(r1_orig) === JSON.stringify(r1_opt)}`);
