// Fynlo Admin service worker — isolated from the business/individual apps
// (separate cache name, separate precache list) so installing one Fynlo app
// can never interfere with another installed on the same device.
const CACHE_NAME = 'fynlo-admin-shell-v2';
const PRECACHE_ASSETS = [
  'fynlo-admin.html',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => console.warn('Precache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';

  if (isNavigation) {
    // Network-first for the app shell, so users get the latest build when online.
    // Falls back to cache, then to the precached app HTML itself as a last resort —
    // this guarantees the app can ALWAYS open, even fully offline or if the exact
    // URL requested isn't the one that was precached.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('fynlo-admin.html'))
        )
    );
    return;
  }

  // Cache-first for static shell assets (icons); network fallback if not yet cached.
  const isShellAsset = PRECACHE_ASSETS.some((a) => request.url.endsWith(a));
  if (isShellAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
