// KIAN HQ Web Push Service Worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'KIAN HQ Notifikasi';
    const options = {
      body: data.body || '',
      icon: data.icon || '/kian.ico',
      badge: data.badge || '/kian.ico',
      data: {
        url: data.url || '/dashboard',
        category: data.category || 'GENERAL',
        timestamp: Date.now(),
      },
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      vibrate: [100, 50, 100],
    };

    // Broadcast push notification event to active tabs for 0ms realtime UI update
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'KIAN_PUSH_RECEIVED',
          payload: data,
        });
      });
    });

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Push parse error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate to target URL
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new browser window/tab at target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
