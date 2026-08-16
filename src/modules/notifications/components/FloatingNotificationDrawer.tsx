'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { fetchUserNotifications, fetchReadNotificationIds, markNotificationsAsRead, NotificationFeedItem } from '../notificationActions';

const READ_NOTIFS_STORAGE_KEY = 'kian_read_notification_ids';
const DISMISSED_NOTIFS_STORAGE_KEY = 'kian_dismissed_notification_ids';

function formatRelativeTime(timestampSec: number): string {
  if (!timestampSec || timestampSec <= 0) return 'Baru saja';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestampSec);

  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)}m yang lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j yang lalu`;
  return `${Math.floor(diff / 86400)}h yang lalu`;
}

interface FloatingNotificationDrawerProps {
  canReview?: boolean;
  canManageSparks?: boolean;
  canCreateBrief?: boolean;
}

export default function FloatingNotificationDrawer({
  canReview = false,
  canManageSparks = false,
  canCreateBrief = false,
}: FloatingNotificationDrawerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'ALL' | 'WORKSPACE' | 'CHAT' | 'CHAT_WS' | 'CHAT_COMM' | 'REVIEW' | 'SPARKS'>('ALL');
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load saved read & dismissed notification IDs from localStorage & DB
  useEffect(() => {
    try {
      const savedRead = localStorage.getItem(READ_NOTIFS_STORAGE_KEY);
      if (savedRead) {
        setReadIds(new Set(JSON.parse(savedRead)));
      }
      const savedDismissed = localStorage.getItem(DISMISSED_NOTIFS_STORAGE_KEY);
      if (savedDismissed) {
        setDismissedIds(new Set(JSON.parse(savedDismissed)));
      }
    } catch {
      // ignore
    }

    // Sync read IDs from DB
    fetchReadNotificationIds().then((dbIds) => {
      if (dbIds && dbIds.length > 0) {
        setReadIds((prev) => {
          const merged = new Set([...Array.from(prev), ...dbIds]);
          try {
            localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(merged)));
          } catch {
            // ignore
          }
          return merged;
        });
      }
    });
  }, []);

  // Save read notification IDs to localStorage & DB
  const markAsReadLocally = useCallback((notifId: string) => {
    setReadIds((prev) => {
      const updated = new Set(prev);
      updated.add(notifId);
      try {
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch {
        // ignore
      }
      return updated;
    });
    markNotificationsAsRead([notifId]).catch(() => {});
  }, []);

  const markAllAsReadLocally = useCallback(() => {
    const allIds = items.map((item) => item.id);
    setReadIds((prev) => {
      const updated = new Set(prev);
      allIds.forEach((id) => updated.add(id));
      try {
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch {
        // ignore
      }
      return updated;
    });
    markNotificationsAsRead(allIds).catch(() => {});
  }, [items]);

  const handleClearRead = useCallback(() => {
    setDismissedIds((prev) => {
      const updated = new Set(prev);
      readIds.forEach((id) => updated.add(id));
      try {
        localStorage.setItem(DISMISSED_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch {
        // ignore
      }
      return updated;
    });
  }, [readIds]);

  const handleDismissItem = (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const updated = new Set(prev);
      updated.add(notifId);
      try {
        localStorage.setItem(DISMISSED_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch {
        // ignore
      }
      return updated;
    });
    markNotificationsAsRead([notifId]).catch(() => {});
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchUserNotifications();
      setItems(res || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime synchronization with Web Push ServiceWorker & Client Events
  useEffect(() => {
    loadNotifications();

    // 1. Service Worker Realtime Web Push listener (0ms latency upon push arrival)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'KIAN_PUSH_RECEIVED') {
        loadNotifications();
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // 2. Client Event listener
    const handleCustomRefresh = () => {
      loadNotifications();
    };
    window.addEventListener('kian_notif_refresh', handleCustomRefresh);

    // 3. Fallback polling interval (every 20 seconds)
    const interval = setInterval(loadNotifications, 20_000);

    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      window.removeEventListener('kian_notif_refresh', handleCustomRefresh);
      clearInterval(interval);
    };
  }, [loadNotifications]);

  // Unread Items Calculation (ignoring dismissed)
  const activeItems = items.filter((item) => !dismissedIds.has(item.id));
  const unreadItems = activeItems.filter((item) => !readIds.has(item.id));
  const unreadCount = unreadItems.length;

  // Filtered Display List
  const displayItems = activeItems.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'WORKSPACE') return item.category === 'WORKSPACE';
    if (filter === 'CHAT') return item.category === 'CHAT_WORKSPACE' || item.category === 'CHAT_COMMUNITY';
    if (filter === 'CHAT_WS') return item.category === 'CHAT_WORKSPACE';
    if (filter === 'CHAT_COMM') return item.category === 'CHAT_COMMUNITY';
    if (filter === 'REVIEW') return item.category === 'REVIEW';
    if (filter === 'SPARKS') return item.category === 'SPARKS' || item.category === 'ANNOUNCEMENT';
    return true;
  });

  // Handle Item Click: Mark Read & Instant Jump to Target URL
  const handleItemClick = (item: NotificationFeedItem) => {
    markAsReadLocally(item.id);
    setIsOpen(false);
    startTransition(() => {
      router.push(item.targetUrl);
    });
  };

  return (
    <>
      {/* ── Top Bar Trigger Button (Inline) ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-purple-500/40 transition-all text-xs font-bold shadow-xs active:scale-95"
        title="Buka Pusat Notifikasi & Workflow Tracker"
      >
        <span className="text-base">🔔</span>
        <span className="hidden sm:inline">Notifikasi</span>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white font-mono text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Floating Drawer / Popover (Portalled to document.body) ── */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full sm:max-w-md shadow-2xl space-y-4 overflow-hidden relative max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200">
            {/* Ambient Accent Glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                    ⚡ Pusat Notifikasi
                  </span>
                </div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 mt-1">
                  Workflow Tracker & Instant Jump
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/dashboard/settings/notifications');
                  }}
                  className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/30 flex items-center justify-center text-xs font-bold transition-all"
                  title="Pengaturan Notifikasi Push"
                >
                  ⚙️
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center text-xs font-bold transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Controls & Category Filter Bar */}
            <div className="px-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  Unread: <span className="text-purple-600 font-mono font-bold">{unreadCount}</span>
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsReadLocally}
                      className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      ✓ Tandai Semua Dibaca
                    </button>
                  )}
                  {items.some((item) => readIds.has(item.id) && !dismissedIds.has(item.id)) && (
                    <button
                      onClick={handleClearRead}
                      className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:underline cursor-pointer"
                    >
                      🗑️ Bersihkan Dibaca
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'ALL', label: '👥 Semua' },
                  { id: 'WORKSPACE', label: '⚡ Task & Workflow' },
                  { id: 'CHAT', label: '💬 Chat (Semua)' },
                  { id: 'CHAT_WS', label: '💬 Workspace Chat' },
                  { id: 'CHAT_COMM', label: '🌐 Community Chat' },
                  ...(canReview ? [{ id: 'REVIEW', label: '📋 Reviews' }] : []),
                  { id: 'SPARKS', label: '✨ Sparks & Info' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id as any)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all shrink-0 cursor-pointer ${
                      filter === f.id
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Items List */}
            <div className="flex-1 overflow-y-auto px-4 space-y-2.5 min-h-[260px] max-h-[420px] pr-2">
              {loading && items.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400 animate-pulse">
                  Memuat notifikasi & workflow...
                </div>
              ) : displayItems.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400 italic">
                  Tidak ada notifikasi aktif pada kategori ini.
                </div>
              ) : (
                displayItems.map((item) => {
                  const isUnread = !readIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all duration-200 flex items-start gap-3 relative group hover:scale-[1.01] cursor-pointer ${item.color} ${
                        isUnread ? 'ring-1 ring-purple-500/40 shadow-sm' : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      {/* Left Icon */}
                      <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-sm shrink-0 shadow-xs">
                        {item.icon}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                            {item.typeLabel}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-zinc-400 font-mono">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDismissItem(e, item.id)}
                              className="text-zinc-400 hover:text-red-500 text-[11px] font-bold p-0.5 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all opacity-0 group-hover:opacity-100"
                              title="Hapus / Sembunyikan Notifikasi Ini"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {item.title}
                        </p>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {item.subtitle}
                        </p>

                        {/* Sparks Badge if any */}
                        {item.sparksBadge !== undefined && item.sparksBadge !== 0 && (
                          <div className="pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">
                              ✨ {item.sparksBadge > 0 ? `+${item.sparksBadge}` : item.sparksBadge} Sparks
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Unread Dot Indicator */}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse shrink-0 mt-1" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Refresh */}
            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between text-xs">
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 transition-all"
              >
                <span>🔄</span> Segarkan Notifikasi
              </button>

              <span className="text-[10px] text-zinc-400 font-mono">1-Click Instant Jump</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
