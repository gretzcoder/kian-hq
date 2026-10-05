import { getKV } from '@/db/client';

export interface CacheOptions {
  ttlSeconds?: number;
  /**
   * If true, this cache entry will only be stored in the isolate memoryCache.
   * Highly recommended for high-frequency polling data (TTL < 60s) to conserve
   * Cloudflare KV's 1,000 writes/day Free Tier limit.
   */
  memoryOnly?: boolean;
}

const MAX_MEMORY_CACHE_ENTRIES = 300;
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Global Kill-Switch for Shared Caching.
 * Set ENABLE_SHARED_CACHE="false" in environment variables to bypass KV/memory cache globally.
 */
const ENABLE_SHARED_CACHE = process.env.ENABLE_SHARED_CACHE !== 'false';

let kvWriteDisabledUntil = 0;

/**
 * Prunes expired or excess entries from isolate memory to prevent
 * exceeding Cloudflare Worker's 128MB memory limit.
 */
function pruneMemoryCacheIfNeeded(now: number): void {
  if (memoryCache.size <= MAX_MEMORY_CACHE_ENTRIES) return;

  // 1. Evict expired entries
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }

  // 2. If still over capacity, evict oldest entries (FIFO)
  if (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    let excess = memoryCache.size - MAX_MEMORY_CACHE_ENTRIES;
    for (const key of memoryCache.keys()) {
      memoryCache.delete(key);
      excess--;
      if (excess <= 0) break;
    }
  }
}

/**
 * Retrieves data from memory/KV cache or fetches fresh data from source (D1/API),
 * populating the cache with the given TTL in seconds.
 * 
 * Auto-Optimization:
 * - If ttlSeconds < 60 or memoryOnly is true, data is cached ONLY in isolate memory.
 *   This avoids burning through Cloudflare KV's 1,000 writes/day Free Tier quota.
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlOrOptions: number | CacheOptions = 60
): Promise<T> {
  if (!ENABLE_SHARED_CACHE) {
    return fetcher();
  }

  const options: CacheOptions =
    typeof ttlOrOptions === 'number'
      ? { ttlSeconds: ttlOrOptions }
      : ttlOrOptions;

  const ttlSeconds = options.ttlSeconds ?? 60;
  // Cloudflare KV enforces a minimum TTL of 60s. Anything shorter is strictly memory-only.
  const isMemoryOnly = options.memoryOnly === true || ttlSeconds < 60;

  const now = Date.now();
  const ttlMs = ttlSeconds * 1000;

  // 1. Check In-Memory Isolate Cache (0ms latency, 0 subrequests, 0 CPU overhead)
  const memItem = memoryCache.get(key);
  if (memItem && memItem.expiresAt > now) {
    return memItem.data as T;
  }

  // 2. Check Cloudflare KV Cache (only for non-memory-only entries)
  if (!isMemoryOnly) {
    try {
      const kv = await getKV();
      if (kv) {
        const cached = await kv.get(key);
        if (cached) {
          const parsed = JSON.parse(cached) as T;
          // Populate memory cache for fast isolate reuse (up to 30s)
          memoryCache.set(key, { data: parsed, expiresAt: now + Math.min(ttlMs, 30_000) });
          pruneMemoryCacheIfNeeded(now);
          return parsed;
        }
      }
    } catch {
      // Non-fatal read error
    }
  }

  // 3. Cache Miss — Execute Fetcher (e.g. D1 Query)
  const freshData = await fetcher();

  if (freshData !== null && freshData !== undefined) {
    // Populate In-Memory Cache
    memoryCache.set(key, { data: freshData, expiresAt: now + ttlMs });
    pruneMemoryCacheIfNeeded(now);

    // Populate Cloudflare KV only if entry qualifies and circuit breaker is not tripped
    if (!isMemoryOnly && now > kvWriteDisabledUntil) {
      try {
        const kv = await getKV();
        if (kv) {
          await kv.put(key, JSON.stringify(freshData), {
            expirationTtl: Math.max(ttlSeconds, 60),
          });
        }
      } catch {
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
 * Invalidates all cache keys matching a prefix in Memory Cache, and conditionally in KV.
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  // Clear from isolate memory
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  // Avoid running expensive kv.list() + kv.delete() loops for memory-only / short-lived prefixes
  if (prefix.startsWith('ws:') || prefix.startsWith('global:leaderboard:')) {
    return;
  }

  try {
    const kv = await getKV();
    if (kv && 'list' in kv && typeof kv.list === 'function') {
      const list = await kv.list({ prefix });
      if (list && Array.isArray(list.keys)) {
        for (const k of list.keys) {
          await kv.delete(k.name);
        }
      }
    }
  } catch (err) {
    console.error(`KV Cache prefix delete error for prefix "${prefix}":`, err);
  }
}
