import { getDB } from '@/db/client';
import { getOrSetCache, invalidateCache } from '@/lib/sharedCache';

const CACHE_KEY = 'global:system_settings:multipliers';

/**
 * Returns cached category multipliers for Design and Video tasks/roles,
 * reducing repeated D1 reads on system_settings across Cloudflare Worker isolates.
 */
export async function getCategoryMultipliers(): Promise<{ designMultiplier: number; videoMultiplier: number }> {
  return getOrSetCache(
    CACHE_KEY,
    async () => {
      try {
        const db = await getDB();
        const { results: settingsRows } = await db
          .prepare("SELECT key, value FROM system_settings WHERE key IN ('category_multiplier_design', 'category_multiplier_video')")
          .all();

        let designMultiplier = 1.0;
        let videoMultiplier = 1.0;

        for (const row of (settingsRows || []) as any[]) {
          if (row.key === 'category_multiplier_design') designMultiplier = Number(row.value) || 1.0;
          if (row.key === 'category_multiplier_video') videoMultiplier = Number(row.value) || 1.0;
        }

        return { designMultiplier, videoMultiplier };
      } catch (err) {
        console.error('Failed to fetch system_settings multipliers:', err);
        return { designMultiplier: 1.0, videoMultiplier: 1.0 };
      }
    },
    300 // 5 minutes TTL
  );
}

/**
 * Invalidate cache when system_settings are updated by an admin.
 */
export function invalidateCategoryMultipliersCache(): void {
  invalidateCache(CACHE_KEY).catch(() => {});
}
