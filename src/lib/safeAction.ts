/**
 * Utility to detect and handle Next.js stale Server Action hashes & chunk mismatch errors
 */
export function isServerActionMismatchError(error: any): boolean {
  if (!error) return false;
  const str = String(error?.message || error?.reason?.message || error?.digest || error || '');
  return (
    str.includes('was not found on the server') ||
    str.includes('failed-to-find-server-action') ||
    str.includes('Failed to find Server Action') ||
    str.includes('Failed to fetch dynamically imported module') ||
    str.includes('ChunkLoadError') ||
    str.includes('Loading chunk') ||
    str.includes('NEXT_NOT_FOUND')
  );
}

/**
 * Safely executes a server action with automatic reload on deployment mismatch
 */
export async function executeSafeAction<T>(
  actionPromise: () => Promise<T>,
  onErrorMessage?: (msg: string) => void
): Promise<T> {
  try {
    return await actionPromise();
  } catch (err: any) {
    if (isServerActionMismatchError(err)) {
      if (typeof window !== 'undefined') {
        const lastReload = Number(sessionStorage.getItem('kian_last_version_reload') || '0');
        if (Date.now() - lastReload > 5000) {
          sessionStorage.setItem('kian_last_version_reload', String(Date.now()));
          window.location.reload();
        }
      }
    }
    if (onErrorMessage) {
      onErrorMessage(err?.message || 'Terjadi kesalahan sistem.');
    }
    throw err;
  }
}

export const safeExecuteAction = executeSafeAction;
