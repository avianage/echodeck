// Installability-only service worker. This app is real-time (live queue
// state via heartbeats/SSE) so it deliberately caches nothing dynamic —
// only a fixed list of static shell assets. Every other request (all
// /api/* calls, all page navigations) is left untouched: no
// event.respondWith(...) is called for them, so the browser's normal
// network fetch handles them exactly as if this service worker didn't
// exist. This makes it structurally incapable of serving stale live data.

const CACHE_NAME = 'echodeck-static-v1';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('echodeck-static-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !STATIC_ASSETS.includes(url.pathname)) {
    return; // let the browser handle everything else normally
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
