// Service Worker v3 - fuerza recarga limpia
const CACHE_NAME = 'gymfit-pro-v3';

// Al instalar: limpia caches viejos inmediatamente
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

// Network-first: siempre intenta red primero, caché solo si falla
self.addEventListener('fetch', event => {
  // No cachear el HTML principal — siempre fresco
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
