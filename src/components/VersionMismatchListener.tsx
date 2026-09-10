'use client';

import { useEffect } from 'react';

/**
 * VersionMismatchListener
 * Detects Next.js Server Action mismatch & stale bundle chunk errors after a new deployment.
 * Automatically notifies the user and reloads the page to get the latest bundle seamlessly.
 */
export function VersionMismatchListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isVersionMismatchError = (error: any): boolean => {
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
    };

    const triggerGracefulReload = (reasonMsg?: string) => {
      const lastReload = Number(sessionStorage.getItem('kian_last_version_reload') || '0');
      const now = Date.now();

      // Debounce reload: avoid infinite reloads within 10 seconds
      if (now - lastReload < 10000) {
        return;
      }
      sessionStorage.setItem('kian_last_version_reload', String(now));

      // Show user-friendly notification overlay before reloading
      const overlay = document.createElement('div');
      overlay.id = 'kian-version-reload-overlay';
      overlay.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(16px);
        color: white;
        border: 1px solid rgba(168, 85, 247, 0.4);
        box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.2);
        padding: 16px 20px;
        border-radius: 16px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: kianSlideUp 0.3s ease-out;
      `;
      overlay.innerHTML = `
        <style>
          @keyframes kianSlideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes kianSpin {
            100% { transform: rotate(360deg); }
          }
        </style>
        <div style="width: 20px; height: 20px; border: 2px solid rgba(168,85,247,0.3); border-top-color: #a855f7; border-radius: 50%; animation: kianSpin 0.8s linear infinite;"></div>
        <div>
          <div style="color: #f3e8ff; font-weight: 700; margin-bottom: 2px;">⚡ Pembaruan Sistem Baru</div>
          <div style="color: #d8b4fe; font-size: 11px; font-weight: 400;">Memperbarui halaman ke versi terbaru...</div>
        </div>
      `;
      document.body.appendChild(overlay);

      setTimeout(() => {
        window.location.reload();
      }, 700);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isVersionMismatchError(event.reason)) {
        event.preventDefault(); // Prevent Next.js red crash overlay in dev/prod
        triggerGracefulReload(event.reason?.message);
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (isVersionMismatchError(event.error || event.message)) {
        event.preventDefault();
        triggerGracefulReload(event.message);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
