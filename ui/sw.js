const CACHE_NAME = 'rentbill-v18';
const ASSETS = [
  '/',
  '/css/style.css',
  '/css/modules/variables.css',
  '/css/modules/base.css',
  '/css/modules/layout.css',
  '/css/modules/components.css',
  '/css/modules/utilities.css',
  '/js/components/templates.js',
  '/js/services/api.js',
  '/js/services/sync.js',
  '/js/components/ui.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/navigation.js',
  '/js/dashboard.js',
  '/js/tenants.js',
  '/js/billing.js',
  '/js/history.js',
  '/js/expenses.js',
  '/js/withdrawals.js',
  '/js/received.js',
  '/js/settings.js',
  '/js/sharing.js',
  '/js/app.js',
  '/libs/lucide.min.js',
  '/libs/qrcode.min.js',
  '/libs/chart.min.js',
  '/fonts/fonts.css',
  '/icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
