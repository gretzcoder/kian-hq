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
      ]);
    } catch (e) {
      // Ignore batch error if already initialized
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
