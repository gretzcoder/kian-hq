import { getKV } from '@/db/client';

const memoryCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Global Kill-Switch for Shared Caching.
 * Set ENABLE_SHARED_CACHE="false" in environment variables to bypass KV/memory cache globally.
 */
const ENABLE_SHARED_CACHE = process.env.ENABLE_SHARED_CACHE !== 'false';

let kvWriteDisabledUntil = 0;

/**
 * Retrieves data from memory/KV cache or fetches fresh data from source (D1/API),
 * populating the cache with the given TTL in seconds.
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  if (!ENABLE_SHARED_CACHE) {
    return fetcher();
  }

  const now = Date.now();
  const ttlMs = ttlSeconds * 1000;

  // 1. Check In-Memory Isolate Cache
  const memItem = memoryCache.get(key);
  if (memItem && memItem.expiresAt > now) {
    return memItem.data as T;
  }

  // 2. Check Cloudflare KV Cache
  try {
    const kv = await getKV();
    if (kv) {
      const cached = await kv.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as T;
        // Populate memory cache for fast isolate reuse
        memoryCache.set(key, { data: parsed, expiresAt: now + Math.min(ttlMs, 30_000) });
        return parsed;
      }
    }
  } catch (err) {
    // Non-fatal read error
  }

  // 3. Cache Miss — Execute Fetcher (e.g. D1 Query)
  const freshData = await fetcher();

  if (freshData !== null && freshData !== undefined) {
    // Populate Memory Cache
    memoryCache.set(key, { data: freshData, expiresAt: now + Math.min(ttlMs, 30_000) });

    // Populate Cloudflare KV if circuit breaker is not tripped
    if (now > kvWriteDisabledUntil) {
      try {
        const kv = await getKV();
        if (kv) {
          await kv.put(key, JSON.stringify(freshData), { expirationTtl: Math.max(ttlSeconds, 60) });
        }
      } catch (err: any) {
        // If quota exceeded or write failed, trip circuit breaker for 10 minutes
        kvWriteDisabledUntil = Date.now() + 10 * 60 * 1000;
      }
    }
  }

  return freshData;
}

/**
 * Invalidates a specific cache key in both Memory Cache and Cloudflare KV.
 */
export async function invalidateCache(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    const kv = await getKV();
    if (kv) {
      await kv.delete(key);
    }
  } catch (err) {
    console.error(`KV Cache delete error for key "${key}":`, err);
  }
}

/**
 * Invalidates all cache keys matching a prefix in Memory Cache.
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
  try {
    const kv = await getKV();
    if (kv && 'list' in kv && typeof kv.list === 'function') {
      const list = await kv.list({ prefix });
      for (const k of list.keys) {
        await kv.delete(k.name);
      }
    }
  } catch (err) {
    console.error(`KV Cache prefix delete error for prefix "${prefix}":`, err);
  }
}
