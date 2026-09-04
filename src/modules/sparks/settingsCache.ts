import { getDB } from '@/db/client';

let categoryMultipliersCache: { design: number; video: number; ts: number } | null = null;
const CACHE_TTL_MS = 300_000; // 5 minutes memory TTL

/**
 * Returns cached category multipliers for Design and Video tasks/roles,
 * reducing repeated D1 reads on system_settings.
 */
export async function getCategoryMultipliers(): Promise<{ designMultiplier: number; videoMultiplier: number }> {
  const now = Date.now();
  if (categoryMultipliersCache && now - categoryMultipliersCache.ts < CACHE_TTL_MS) {
    return {
      designMultiplier: categoryMultipliersCache.design,
      videoMultiplier: categoryMultipliersCache.video,
    };
  }

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

    categoryMultipliersCache = { design: designMultiplier, video: videoMultiplier, ts: now };
    return { designMultiplier, videoMultiplier };
  } catch (err) {
    console.error('Failed to fetch system_settings multipliers:', err);
    return { designMultiplier: 1.0, videoMultiplier: 1.0 };
  }
}

/**
 * Invalidate in-memory cache when system_settings are updated by an admin.
 */
export function invalidateCategoryMultipliersCache(): void {
  categoryMultipliersCache = null;
}
