import { getCloudflareContext } from '@opennextjs/cloudflare';

let migrationDone = false;

export async function ensureSchemaMigrations(db: any) {
  if (migrationDone || !db) return;
  try {
    await db.prepare('ALTER TABLE task_assignments ADD COLUMN appreciation_note TEXT').run();
  } catch {
    // Column already exists
  }
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_read_notifications (
        user_id TEXT NOT NULL,
        notification_id TEXT NOT NULL,
        read_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, notification_id)
      )
    `).run();
  } catch {
    // Table creation handled
  }
  migrationDone = true;
}

/**
 * Returns the Cloudflare D1 Database binding instance.
 */
export async function getDB() {
  const { env } = getCloudflareContext();
  const db = env.DB;
  ensureSchemaMigrations(db).catch(() => {});
  return db;
}

/**
 * Returns the Cloudflare KV binding instance.
 */
export async function getKV() {
  const { env } = getCloudflareContext();
  return env.KV;
}
