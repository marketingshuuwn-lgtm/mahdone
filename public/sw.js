// Service Worker لتطبيق مهد — يستقبل إشعارات Web Push ويعرضها حتى لو كان
// المتصفح/التبويب مغلق (طالما نظام التشغيل يشغّل خدمة الدفع بالخلفية).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'مهد', body: 'لديك تحديث جديد' };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  const options = {
    body: payload.body,
    icon: '/logo.svg',
    badge: '/logo.svg',
    dir: 'rtl',
    lang: 'ar',
    tag: payload.tag || 'mahd-push',
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'مهد', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
