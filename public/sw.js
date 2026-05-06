// Service Worker v4 - push notifications + daily check
// IMPORTANTE: No borramos caches en activate para no interrumpir sesiones activas.
// El cache se limpia solo cuando cambia CACHE_NAME (nuevo deploy intencional).
const CACHE_NAME = 'gymfit-pro-v4';

self.addEventListener('install', event => {
  // skipWaiting() hace que el nuevo SW tome control inmediatamente,
  // lo que puede interrumpir la sesión activa. Lo removemos para que
  // el SW anterior siga activo hasta que el usuario cierre la pestaña.
  // El nuevo SW tomará control en la próxima apertura normal.
  // self.skipWaiting();  ← REMOVIDO: causaba reload forzado en cada deploy
});

self.addEventListener('activate', event => {
  // Solo borramos caches VIEJOS (de versiones anteriores), no el actual.
  // Así no interrumpimos sesiones en curso.
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)  // solo borra los que NO son el actual
          .map(k => caches.delete(k))
      )
    )
    // REMOVIDO: self.clients.claim() — forzaba reload en pestañas abiertas
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
