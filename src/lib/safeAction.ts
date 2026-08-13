/**
 * Safely executes a Next.js Server Action with fallback to API or soft page reload
 * when a stale Server Action ID error occurs due to a server deployment/rebuild.
 */
export async function safeExecuteAction<T>(
  actionFn: () => Promise<T>,
  fallbackApiFn?: () => Promise<T>
): Promise<T> {
  try {
    return await actionFn();
  } catch (err: any) {
    const msg = err?.message || String(err || '');
    const isStaleServerAction =
      msg.includes('Server Action') ||
      msg.includes('failed-to-find-server-action') ||
      msg.includes('was not found on the server') ||
      msg.includes('Failed to find Server Action');

    if (isStaleServerAction) {
      if (fallbackApiFn) {
        try {
          const fallbackRes = await fallbackApiFn();
          return fallbackRes;
        } catch {
          // If fallback API fails too, proceed to reload
        }
      }

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      throw new Error('Sesi server telah diperbarui. Memuat ulang halaman...');
    }

    throw err;
  }
}
