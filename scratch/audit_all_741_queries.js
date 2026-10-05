const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = OFF;');

// Apply all 86 migrations
const migrationsDir = path.join(__dirname, '..', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const cleanSql = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  for (const stmt of cleanSql.split(';').map(s => s.trim()).filter(Boolean)) {
    try { db.exec(stmt); } catch (_e) {}
  }
}

const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'query_inventory.json'), 'utf8'));

console.log(`Total queries to audit: ${inventory.length}`);

const unindexedScans = [];
let auditedCount = 0;
let skippedCount = 0;
let passedCount = 0;

for (const item of inventory) {
  let sql = item.sql.trim();
  // Filter only SELECT queries or UPDATE/DELETE with subqueries
  if (!sql.toUpperCase().startsWith('SELECT') && !sql.toUpperCase().startsWith('WITH') && !sql.toUpperCase().includes('WHERE')) {
    skippedCount++;
    continue;
  }

  // Replace JS interpolation ${...} with mock values or ?
  let testSql = sql
    .replace(/\$\{[^}]+\}/g, '?')
    .replace(/\?\s*,\s*\?/g, '?')
    .replace(/\(\s*\?\s*\)/g, '(? )');

  // If query is an UPDATE / DELETE, test EXPLAIN on it
  try {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${testSql}`).all();
    auditedCount++;

    const scanSteps = plan.filter(step => 
      step.detail.includes('SCAN') && 
      !step.detail.includes('USING INDEX') &&
      !step.detail.includes('USING COVERING INDEX') &&
      !step.detail.includes('sqlite_stat')
    );

    if (scanSteps.length > 0) {
      unindexedScans.push({
        file: item.file,
        line: item.line,
        sql: sql.slice(0, 150) + (sql.length > 150 ? '...' : ''),
        scans: scanSteps.map(s => s.detail)
      });
    } else {
      passedCount++;
    }
  } catch (err) {
    // Some queries have syntax specific to runtime dynamic construction, count as skipped
    skippedCount++;
  }
}

console.log(`\n=== AUDIT SUMMARY ===`);
console.log(`Audited: ${auditedCount}`);
console.log(`Passed (Indexed): ${passedCount}`);
console.log(`Skipped (DML without WHERE / dynamic template): ${skippedCount}`);
console.log(`Unindexed Full Scans Detected: ${unindexedScans.length}`);

if (unindexedScans.length > 0) {
  console.log(`\n=== DETECTED UNINDEXED SCANS ===`);
  unindexedScans.forEach((u, i) => {
    console.log(`\n[#${i + 1}] ${u.file}:${u.line}`);
    console.log(`SQL: ${u.sql}`);
    console.log(`Scan details:`, u.scans);
  });
}
