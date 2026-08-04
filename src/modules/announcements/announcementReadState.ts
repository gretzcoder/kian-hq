'use client';

const LOCAL_STORAGE_KEY = 'kian_last_read_announcement_timestamp';

/**
 * Get the stored timestamp of when the user last read announcements.
 */
export function getLastReadTimestamp(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const val = localStorage.getItem(LOCAL_STORAGE_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Update the timestamp of when announcements were last read to NOW.
 */
export function markAnnouncementsAsRead(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, Date.now().toString());
    window.dispatchEvent(new Event('announcements_read'));
  } catch {
    // non-fatal
  }
}

/**
 * Calculate how many announcements are unread given an array of timestamps (in seconds).
 */
export function getUnreadCount(timestamps: number[]): number {
  if (!timestamps || timestamps.length === 0) return 0;
  const lastRead = getLastReadTimestamp();
  return timestamps.filter((t) => t * 1000 > lastRead).length;
}

/**
 * Check if the latest announcement timestamp is unread.
 */
export function isAnnouncementUnread(latestCreatedAt: number): boolean {
  if (!latestCreatedAt) return false;
  const lastRead = getLastReadTimestamp();
  // latestCreatedAt is in seconds (UNIX timestamp from D1), convert to milliseconds
  const latestMs = latestCreatedAt * 1000;
  return latestMs > lastRead;
}
