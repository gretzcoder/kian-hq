import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Returns the Cloudflare D1 Database binding instance.
 */
export async function getDB() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB;
  } catch (error) {
    const { env } = await getCloudflareContext();
    return env.DB;
  }
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
