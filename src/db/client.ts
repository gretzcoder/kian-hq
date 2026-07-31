import { getCloudflareContext } from '@opennextjs/cloudflare';

let isAnnouncementTablesChecked = false;

/**
 * Returns the Cloudflare D1 Database binding instance.
 */
export async function getDB() {
  let db: any;
  try {
    const { env } = await getCloudflareContext({ async: true });
    db = env.DB;
  } catch (error) {
    const { env } = await getCloudflareContext();
    db = env.DB;
  }

  if (!isAnnouncementTablesChecked && db) {
    isAnnouncementTablesChecked = true;
    try {
      await db.batch([
        db.prepare(`
          CREATE TABLE IF NOT EXISTS announcement_comments (
            id TEXT PRIMARY KEY,
            announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            parent_id TEXT REFERENCES announcement_comments(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
          );
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS announcement_reactions (
            announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            emoji TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (announcement_id, user_id, emoji)
          );
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS executive_feedbacks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category TEXT NOT NULL DEFAULT 'KRITIK_SARAN',
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
          );
        `),
      ]);
    } catch (e) {
      // Ignore batch error
    }

    try {
      await db.prepare('ALTER TABLE announcement_comments ADD COLUMN parent_id TEXT REFERENCES announcement_comments(id) ON DELETE CASCADE').run();
    } catch (e) {
      // Column parent_id already exists, safe to ignore
    }

    try {
      await db.prepare("INSERT OR IGNORE INTO roles (id, name, description) VALUES ('role_mentor_troopers', 'MENTOR TROOPERS', 'Pengguna OJT dengan tugas membimbing dan mengelola workspace tertentu')").run();
    } catch (e) {
      // Role already seeded
    }
  }

  return db;
}

/**
 * Returns the Cloudflare KV binding instance.
 */
export async function getKV() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.KV;
  } catch (error) {
    const { env } = await getCloudflareContext();
    return env.KV;
  }
}
