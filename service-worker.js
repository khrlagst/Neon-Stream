const CACHE_NAME = 'neon-stream-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/styles.css',
  '/js/app.js',
  '/test/playback_smoke.html'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); }));
    await clients.claim();
  })());
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  // navigation requests -> serve index.html or offline fallback
  if (req.mode === 'navigate') {
    evt.respondWith(fetch(req).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match('/offline.html') || cache.match('/index.html');
    }));
    return;
  }

  evt.respondWith(caches.match(req).then(res => res || fetch(req).then(r => {
    // cache GET requests for future
    if (req.method === 'GET' && r && r.ok) {
      caches.open(CACHE_NAME).then(c => c.put(req, r.clone()));
    }
    return r;
  }).catch(()=>caches.match('/offline.html'))));
});
