const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// 1. Helpers matching KIAN HQ browser-side crypto
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function makeDbHash(password) {
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  return `${salt}:${hash}`;
}

async function run() {
  const pHash = makeDbHash('password123');

  const users = [
    { id: 'usr_ojt_coord',   email: 'mentor@kian.com',     name: 'Mentor OJT (Staff)',   type: 'STAFF' },
    { id: 'usr_ojt_leader',  email: 'leader@ojt.com',      name: 'Budi (Ketua Tim)',     type: 'OJT' },
    { id: 'usr_ojt_researc', email: 'researcher@ojt.com',  name: 'Ani (Researcher)',     type: 'OJT' },
    { id: 'usr_ojt_planner', email: 'planner@ojt.com',     name: 'Candra (Planner)',     type: 'OJT' },
    { id: 'usr_ojt_creator', email: 'creator@ojt.com',     name: 'Dodi (Creator)',       type: 'OJT' }
  ];

  const projectId = 'proj_ojt_test';
  const workspaceId = 'ws_ojt_team_a';

  let sql = `-- OJT Test Scenario Seeding\n`;
  sql += `DELETE FROM workspace_members WHERE workspace_id = '${workspaceId}';\n`;
  sql += `DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id = '${workspaceId}');\n`;
  sql += `DELETE FROM tasks WHERE workspace_id = '${workspaceId}';\n`;
  sql += `DELETE FROM workspaces WHERE id = '${workspaceId}';\n`;
  sql += `DELETE FROM projects WHERE id = '${projectId}';\n`;
  for (const u of users) {
    sql += `DELETE FROM user_roles WHERE user_id = '${u.id}';\n`;
    sql += `DELETE FROM users WHERE id = '${u.id}';\n`;
  }

  // Insert Users
  for (const u of users) {
    sql += `INSERT INTO users (id, email, name, status, password_hash, user_type) VALUES ('${u.id}', '${u.email}', '${u.name}', 'ACTIVE', '${pHash}', '${u.type}');\n`;
    // If coordinator/staff, give them standard roles so they can auth
    if (u.type === 'STAFF') {
      sql += `INSERT INTO user_roles (user_id, role_id) VALUES ('${u.id}', 'role_creator');\n`;
    }
  }

  // Insert Project (No created_by column)
  sql += `INSERT INTO projects (id, name, description, status) VALUES ('${projectId}', 'OJT Internship Project', 'Workspace testing target for OJT Interns and Mentors', 'PLANNING');\n`;

  // Insert OJT Workspace linked to OJT Coordinator (mentor@kian.com)
  sql += `INSERT INTO workspaces (id, project_id, name, description, status, ojt_coordinator_id, created_by) VALUES ('${workspaceId}', '${projectId}', 'Tim OJT A - Kampanye Instagram', 'Workspace kolaborasi Tim OJT A di bawah asuhan Mentor.', 'ACTIVE', 'usr_ojt_coord', 'usr_ojt_coord');\n`;

  // Add members to workspace_members
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('${workspaceId}', 'usr_ojt_leader', 'LEADER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('${workspaceId}', 'usr_ojt_researc', 'RESEARCHER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('${workspaceId}', 'usr_ojt_planner', 'PLANNER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('${workspaceId}', 'usr_ojt_creator', 'CREATOR');\n`;

  const sqlFilePath = path.join(__dirname, 'seed_ojt.sql');
  fs.writeFileSync(sqlFilePath, sql);
  console.log(`Generated SQL file at: ${sqlFilePath}`);

  console.log('Applying migrations locally...');
  execSync(`npx wrangler d1 execute kian-hq-db --local --file="${sqlFilePath}"`, { stdio: 'inherit' });

  console.log('Applying migrations remotely...');
  execSync(`npx wrangler d1 execute kian-hq-db --remote --file="${sqlFilePath}"`, { stdio: 'inherit' });

  console.log('\n======================================================');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('Login credentials for OJT Testing (password: password123):');
  for (const u of users) {
    console.log(`- ${u.name}: ${u.email} (${u.type} / Role: ${u.type === 'STAFF' ? 'Mentor' : u.type})`);
  }
  console.log('======================================================\n');
}

run().catch(console.error);
