// Service Worker v4 - push notifications + daily check
const CACHE_NAME = 'gymfit-pro-v4';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first fetch
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Handle notification click — open app at mensajes screen
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'OPEN_MENSAJES' });
          return client.focus();
        }
      }
      return clients.openWindow(url + '?screen=mensajes');
    })
  );
});

// Handle messages from the app (schedule daily check)
self.addEventListener('message', event => {
  if (event.data?.type === 'CHECK_VENCIMIENTOS') {
    const { miembrosVencenManana, gymNombre } = event.data;
    if (miembrosVencenManana && miembrosVencenManana.length > 0) {
      const nombres = miembrosVencenManana.map(m => m.nombre).join(', ');
      const title = `⏰ Membresía por vencer — ${gymNombre || 'Gym'}`;
      const body = miembrosVencenManana.length === 1
        ? `${nombres} vence mañana. Toca para enviar recordatorio por WhatsApp.`
        : `${miembrosVencenManana.length} miembros vencen mañana: ${nombres}. Toca para enviar recordatorios.`;

      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'vencimientos-' + new Date().toISOString().split('T')[0],
        renotify: false,
        data: { url: self.location.origin },
        actions: [
          { action: 'abrir', title: '💬 Ver recordatorios' },
          { action: 'cerrar', title: 'Después' }
        ]
      });
    }
  }
});
