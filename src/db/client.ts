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
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS executive_feedback_replies (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL REFERENCES executive_feedbacks(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).run();
  } catch {
    // Table creation handled
  }
  try {
    await db.prepare('ALTER TABLE executive_feedbacks ADD COLUMN sparks_given INTEGER DEFAULT 0').run();
  } catch {}
  try {
    await db.prepare('ALTER TABLE executive_feedbacks ADD COLUMN sparks_given_by TEXT REFERENCES users(id)').run();
  } catch {}
  try {
    await db.prepare('ALTER TABLE executive_feedbacks ADD COLUMN sparks_adjustment_id TEXT REFERENCES sparks_adjustments(id)').run();
  } catch {}
  try {
    await db.prepare('ALTER TABLE executive_feedback_replies ADD COLUMN parent_id TEXT REFERENCES executive_feedback_replies(id) ON DELETE CASCADE').run();
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS executive_feedback_reactions (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(target_type, target_id, user_id, emoji)
      )
    `).run();
  } catch {}
  try {
    await db.prepare('ALTER TABLE tasks ADD COLUMN sparks_multiplier REAL DEFAULT 1.0').run();
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_by TEXT,
        updated_at INTEGER
      )
    `).run();
  } catch {}
  try {
    await db.prepare('ALTER TABLE users ADD COLUMN feature_tour_completed INTEGER DEFAULT 0').run();
  } catch {}
  try {
    await db.prepare('ALTER TABLE user_notification_settings ADD COLUMN notify_community_chat INTEGER DEFAULT 1').run();
  } catch {}
  try {
    await db.prepare('UPDATE user_notification_settings SET notify_community_chat = 1 WHERE notify_community_chat IS NULL').run();
  } catch {}
  try {
    await db.prepare('UPDATE user_notification_settings SET notify_chat = 1 WHERE notify_chat IS NULL').run();
  } catch {}
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
