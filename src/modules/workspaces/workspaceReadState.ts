'use client';

const READ_MAP_KEY = 'kian_workspace_read_map';

function getReadMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(READ_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveReadMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(READ_MAP_KEY, JSON.stringify(map));
  } catch {
    // non-fatal
  }
}

/**
 * Mark a specific workspace as read (clears its badge).
 * Fires 'workspace_read' so other components update their state.
 */
export function markWorkspaceAsRead(wsId: string): void {
  if (typeof window === 'undefined') return;
  const map = getReadMap();
  map[wsId] = Date.now();
  saveReadMap(map);
  window.dispatchEvent(new CustomEvent('workspace_read', { detail: { wsId } }));
}

/**
 * Check if a specific workspace has unread activity.
 * @param wsId - The workspace ID.
 * @param activityTimestamp - Latest activity timestamp in seconds (from DB).
 */
export function isWorkspaceActivityUnread(wsId: string, activityTimestamp?: number | null): boolean {
  if (!activityTimestamp) return false;
  const map = getReadMap();
  const lastRead = map[wsId] ?? 0;
  return activityTimestamp * 1000 > lastRead;
}

/**
 * Count how many workspaces have unread activity.
 */
export function getUnreadWorkspaceCount(workspaces: { wsId: string; latestTs: number }[]): number {
  if (!workspaces || workspaces.length === 0) return 0;
  const map = getReadMap();
  return workspaces.filter(({ wsId, latestTs }) => latestTs * 1000 > (map[wsId] ?? 0)).length;
}
