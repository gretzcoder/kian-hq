const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

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

async function main() {
  const pHash = makeDbHash('password123');

  const users = [
    { id: 'usr_executive', email: 'executive@kian.com', username: 'executive', name: 'Executive CEO', type: 'STAFF', role: 'role_executive' },
    { id: 'usr_coordinator', email: 'coordinator@kian.com', username: 'coordinator', name: 'Project Coordinator', type: 'STAFF', role: 'role_coordinator' },
    { id: 'usr_creator', email: 'creator@kian.com', username: 'creator', name: 'Content Creator', type: 'STAFF', role: 'role_creator' },
    { id: 'usr_collaborator', email: 'collaborator@kian.com', username: 'collaborator', name: 'External Collaborator', type: 'STAFF', role: 'role_collaborator' },
    { id: 'usr_ojt_coord', email: 'mentor@kian.com', username: 'mentor', name: 'Mentor OJT (Staff)', type: 'STAFF', role: 'role_coordinator' },
    { id: 'usr_ojt_leader', email: 'leader@ojt.com', username: 'budi_leader', name: 'Budi (Ketua Tim)', type: 'OJT', role: 'role_creator' },
    { id: 'usr_ojt_researc', email: 'researcher@ojt.com', username: 'ani_researcher', name: 'Ani (Researcher)', type: 'OJT', role: 'role_collaborator' },
    { id: 'usr_ojt_planner', email: 'planner@ojt.com', username: 'candra_planner', name: 'Candra (Planner)', type: 'OJT', role: 'role_collaborator' },
    { id: 'usr_ojt_creator', email: 'creator@ojt.com', username: 'dodi_creator', name: 'Dodi (Creator)', type: 'OJT', role: 'role_creator' }
  ];

  let sql = `-- Master Seed Script for KIAN HQ Local Development\n\n`;

  // 1. Clean existing records for seeded entities
  sql += `-- Cleanup existing seed data\n`;
  sql += `DELETE FROM workspace_chats;\n`;
  sql += `DELETE FROM task_assignments;\n`;
  sql += `DELETE FROM tasks;\n`;
  sql += `DELETE FROM workspace_members;\n`;
  sql += `DELETE FROM workspaces;\n`;
  sql += `DELETE FROM projects;\n`;
  sql += `DELETE FROM announcements;\n`;
  sql += `DELETE FROM knowledge_items;\n`;
  sql += `DELETE FROM knowledge_categories;\n`;
  for (const u of users) {
    sql += `DELETE FROM user_roles WHERE user_id = '${u.id}';\n`;
    sql += `DELETE FROM users WHERE id = '${u.id}';\n`;
  }
  sql += `\n`;

  // 2. Insert Users & User Roles
  sql += `-- Insert Users\n`;
  for (const u of users) {
    sql += `INSERT INTO users (id, email, username, name, status, password_hash, user_type) VALUES ('${u.id}', '${u.email}', '${u.username}', '${u.name}', 'ACTIVE', '${pHash}', '${u.type}');\n`;
    if (u.role) {
      sql += `INSERT INTO user_roles (user_id, role_id) VALUES ('${u.id}', '${u.role}');\n`;
    }
  }
  sql += `\n`;

  // 3. Insert Projects
  sql += `-- Insert Projects\n`;
  sql += `INSERT INTO projects (id, name, description, status) VALUES ('proj_kian_branding', 'KIAN HQ Rebranding Campaign', 'Main branding and creative OS system rollout', 'IN_PROGRESS');\n`;
  sql += `INSERT INTO projects (id, name, description, status) VALUES ('proj_ojt_test', 'OJT Internship Project', 'Workspace testing target for OJT Interns and Mentors', 'PLANNING');\n`;
  sql += `\n`;

  // 4. Insert Workspaces
  sql += `-- Insert Workspaces\n`;
  sql += `INSERT INTO workspaces (id, project_id, name, description, status, created_by, workspace_type) VALUES ('ws_kian_creative', 'proj_kian_branding', 'Creative Hub Workspace', 'Main creative workspace for brand assets and design.', 'ACTIVE', 'usr_executive', 'MAIN');\n`;
  sql += `INSERT INTO workspaces (id, project_id, name, description, status, ojt_coordinator_id, created_by, workspace_type) VALUES ('ws_ojt_team_a', 'proj_ojt_test', 'Tim OJT A - Kampanye Instagram', 'Workspace kolaborasi Tim OJT A di bawah asuhan Mentor.', 'ACTIVE', 'usr_ojt_coord', 'usr_ojt_coord', 'OJT');\n`;
  sql += `\n`;

  // 5. Insert Workspace Members
  sql += `-- Insert Workspace Members\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_executive', 'LEADER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_coordinator', 'PLANNER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_kian_creative', 'usr_creator', 'CREATOR');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_leader', 'LEADER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_researc', 'RESEARCHER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_planner', 'PLANNER');\n`;
  sql += `INSERT INTO workspace_members (workspace_id, user_id, team_role) VALUES ('ws_ojt_team_a', 'usr_ojt_creator', 'CREATOR');\n`;
  sql += `\n`;

  // 6. Insert Tasks
  sql += `-- Insert Tasks\n`;
  sql += `INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_001', 'ws_kian_creative', 'proj_kian_branding', 'Desain Visual Identity & Brand Guidelines', 'Membuat panduan warna, font, dan elemen visual KIAN HQ', 'IN_PROGRESS', 'HIGH', 'usr_executive');\n`;
  sql += `INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_002', 'ws_kian_creative', 'proj_kian_branding', 'Riset Content Brief & Audience', 'Melakukan analisis kompetitor dan target audiens', 'TODO', 'MEDIUM', 'usr_coordinator');\n`;
  sql += `INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_003', 'ws_ojt_team_a', 'proj_ojt_test', 'Riset Tren Content Instagram 2026', 'Analisis format konten IG Reels & Carousel yang efektif', 'DONE', 'MEDIUM', 'usr_ojt_leader');\n`;
  sql += `INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, created_by) VALUES ('tsk_004', 'ws_ojt_team_a', 'proj_ojt_test', 'Pembuatan Content Calendar Minggu 1', 'Menyusun jadwal posting dan topik ide konten', 'IN_PROGRESS', 'HIGH', 'usr_ojt_planner');\n`;
  sql += `\n`;

  // 7. Insert Announcements
  sql += `-- Insert Announcements\n`;
  sql += `INSERT INTO announcements (id, title, content, created_by) VALUES ('anc_001', 'Selamat Datang di KIAN HQ OS!', 'Sistem Operasi Tim Kreatif berbasis AI telah aktif. Semua modul proyek, tugas, dan OJT siap digunakan.', 'usr_executive');\n`;
  sql += `\n`;

  // 8. Insert Knowledge Base Categories & Items
  sql += `-- Insert Knowledge Base\n`;
  sql += `INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_guidelines', 'Brand & Design Guidelines', 'Panduan utama standar desain dan komunikasi brand', 'Palette', 'usr_executive');\n`;
  sql += `INSERT INTO knowledge_categories (id, name, description, icon, created_by) VALUES ('cat_ojt', 'OJT Standard Operating Procedure', 'SOP dan alur kerja peserta magang OJT', 'BookOpen', 'usr_coordinator');\n`;
  sql += `INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_001', 'cat_guidelines', 'KIAN HQ Design System', 'https://kian.com/design-system', 'Panduan komponen UI, warna, dan tipografi', 'usr_executive');\n`;
  sql += `INSERT INTO knowledge_items (id, category_id, title, url, description, created_by) VALUES ('item_002', 'cat_ojt', 'OJT Task & Approval Workflow', 'https://kian.com/ojt-sop', 'Panduan penyerahan tugas dan review oleh Mentor', 'usr_coordinator');\n`;
  sql += `\n`;

  const sqlFilePath = path.join(__dirname, 'seed_all.sql');
  fs.writeFileSync(sqlFilePath, sql);
  console.log(`Generated SQL file at: ${sqlFilePath}`);

  console.log('Applying seed data to local D1 database...');
  execSync(`cmd /c "echo y | npx wrangler d1 execute DB --local --file="${sqlFilePath}""`, { stdio: 'inherit' });

  console.log('\n======================================================');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('Default password for all seeded users: password123\n');
  console.log('Available Login Accounts:');
  for (const u of users) {
    console.log(`- ${u.name}: ${u.email} (Username: ${u.username} / Role: ${u.role})`);
  }
  console.log('======================================================\n');
}

main().catch(console.error);
