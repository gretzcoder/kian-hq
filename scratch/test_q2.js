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

const originalUpdate = `
UPDATE tasks
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
  )
`;

const optimizedUpdate = `
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

console.log('--- ORIGINAL UPDATE PLAN ---');
db.prepare(`EXPLAIN QUERY PLAN ${originalUpdate}`).all().forEach(s => console.log('  ', s.detail));

console.log('\n--- OPTIMIZED UPDATE PLAN ---');
db.prepare(`EXPLAIN QUERY PLAN ${optimizedUpdate}`).all().forEach(s => console.log('  ', s.detail));
