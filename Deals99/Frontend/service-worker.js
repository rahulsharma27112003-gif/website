const CACHE_VERSION = 'v4::deals99';
const PRECACHE_URLS = [
  './',
  './index.html',
  './global.css',
  './script.js',
  './manifest.webmanifest',
  './favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Placeholder images — use local fallback when external service is unavailable
  if (url.hostname === 'via.placeholder.com') {
    event.respondWith(
      caches.match('/favicon.svg').then((cached) => cached || fetch('/favicon.svg')).catch(() => fetch('/favicon.svg'))
    );
    return;
  }

  // API requests — network first
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {
      event.respondWith(
        fetch(request).catch(() =>
          new Response(JSON.stringify({ error: 'Service unavailable' }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
      return;
    }

    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response('', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      // Populate cache for future
      const resClone = res.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put(request, resClone));
      return res;
    })).catch(() => {
      // Do not silently replace a failed page navigation with the homepage.
      if (request.mode === 'navigate') {
        return new Response('This page is unavailable offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      return new Response('', { status: 404 });
    })
  );
});

// Optional: message handling (skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});