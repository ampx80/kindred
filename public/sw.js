/* Kindred service worker: makes the app installable + resilient, and receives
   web push so Aria can reach you with a daily nudge. Cache strategy is
   deliberately conservative: never cache /api/* (always live), network-first for
   navigations with an offline fallback to the app shell, cache-first for hashed
   build assets. Bump CACHE to invalidate old shells. */
const CACHE = 'kindred-v1';
const SHELL = ['/', '/today', '/manifest.webmanifest', '/brand/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;   // never intercept the API

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/today').then((r) => r || caches.match('/')))
    );
    return;
  }
  // Hashed assets: cache-first, fill on miss.
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/brand/'))) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text() }; }
  const title = data.title || 'Aria';
  const options = {
    body: data.body || 'A small moment for you today.',
    icon: '/brand/icon.svg',
    badge: '/brand/icon.svg',
    tag: data.tag || 'kindred-daily',
    data: { url: data.url || '/today' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/today';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(target); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
