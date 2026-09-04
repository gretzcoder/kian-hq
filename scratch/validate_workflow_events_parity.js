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

console.log('=== AUDITING INDEXES FOR WORKFLOW EVENTS ===');
const wfIndexes = db.prepare(`PRAGMA index_list('workflow_events')`).all();
for (const idx of wfIndexes) {
  const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all().map(c => c.name).join(', ');
  console.log(`  - ${idx.name} (${cols})`);
}

const taIndexes = db.prepare(`PRAGMA index_list('task_assignments')`).all();
for (const idx of taIndexes) {
  const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all().map(c => c.name).join(', ');
  console.log(`  - ${idx.name} (${cols})`);
}

const tIndexes = db.prepare(`PRAGMA index_list('tasks')`).all();
for (const idx of tIndexes) {
  const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all().map(c => c.name).join(', ');
  console.log(`  - ${idx.name} (${cols})`);
}

// Populate test data
db.exec(`
  INSERT INTO projects (id, name) VALUES ('proj_1', 'Project 1');
  INSERT INTO users (id, name, email, status) VALUES ('usr_1', 'Alice', 'alice@test.com', 'ACTIVE'), ('usr_2', 'Bob', 'bob@test.com', 'ACTIVE');
  INSERT INTO workspaces (id, project_id, name) VALUES ('ws_1', 'proj_1', 'Workspace 1');
  INSERT INTO tasks (id, project_id, title, workspace_id, status, created_by) VALUES ('task_1', 'proj_1', 'Task 1', 'ws_1', 'ACTIVE', 'usr_1');
  INSERT INTO task_assignments (id, task_id, user_id, status) VALUES ('ta_1', 'task_1', 'usr_2', 'ASSIGNED');
`);

for (let i = 0; i < 20; i++) {
  db.exec(`
    INSERT INTO workflow_events (id, entity_type, entity_id, from_status, to_status, note, triggered_by, created_at)
    VALUES (
      'we_ta_${i}',
      'task_assignment',
      'ta_1',
      'ACTIVE',
      'REMINDER_SENT',
      'Assignment Reminder ${i}',
      'usr_1',
      ${1700000000 + i * 2}
    );
  `);

  db.exec(`
    INSERT INTO workflow_events (id, entity_type, entity_id, from_status, to_status, note, triggered_by, created_at)
    VALUES (
      'we_t_${i}',
      'task',
      'task_1',
      'ACTIVE',
      'REMINDER_SENT',
      'Task Reminder ${i}',
      'usr_1',
      ${1700000000 + i * 2 + 1}
    );
  `);
}

const q_orig = `
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

const q_union = `
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

console.log('\n--- EXPLAIN QUERY PLAN BEFORE (Original Single Query) ---');
db.prepare(`EXPLAIN QUERY PLAN ${q_orig}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n--- EXPLAIN QUERY PLAN AFTER (Optimized UNION ALL) ---');
db.prepare(`EXPLAIN QUERY PLAN ${q_union}`).all().forEach(s => console.log('  ', s.detail));

const res_orig = db.prepare(q_orig).all();
const res_union = db.prepare(q_union).all();

console.log(`\n=== DATASET PARITY VALIDATION ===`);
console.log(`Original Rows Returned : ${res_orig.length}`);
console.log(`UNION ALL Rows Returned: ${res_union.length}`);

let isIdentical = res_orig.length === res_union.length;
for (let i = 0; i < res_orig.length; i++) {
  const o = res_orig[i];
  const u = res_union[i];
  if (JSON.stringify(o) !== JSON.stringify(u)) {
    console.error(`Mismatch at row ${i}:`, { orig: o, union: u });
    isIdentical = false;
  }
}

console.log(`\n✅ Exact Parity Check: ${isIdentical ? 'PASSED (100% IDENTICAL OUTPUT)' : 'FAILED'}`);
