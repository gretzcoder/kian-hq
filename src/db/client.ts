import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Returns the Cloudflare D1 Database binding instance.
 */
export async function getDB() {
  const { env } = await getCloudflareContext();
  return env.DB;
}

/**
 * Returns the Cloudflare KV binding instance.
 */
export async function getKV() {
  const { env } = await getCloudflareContext();
  return env.KV;
}
