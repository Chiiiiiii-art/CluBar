/* CluBar Web Push Service Worker (NFR / FR-MY-04) */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {
    title: 'CluBar 社團通知',
    body: '你有一則新的活動動態',
    url: '/me',
    tag: 'clubar-notification',
  };

  try {
    const parsed = event.data.json();
    payload = { ...payload, ...parsed };
  } catch {
    payload.body = event.data.text() || payload.body;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/images/demo/moment-1x1.svg',
      badge: '/images/demo/moment-1x1.svg',
      tag: payload.tag,
      data: { url: payload.url || '/me' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
