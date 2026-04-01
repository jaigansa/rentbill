const CACHE_NAME = 'rentbill-v10';
const ASSETS = [
  '/',
  '/public/css/style.css',
  '/public/css/modules/variables.css',
  '/public/css/modules/base.css',
  '/public/css/modules/layout.css',
  '/public/css/modules/components.css',
  '/public/css/modules/utilities.css',
  '/js/components/templates.js',
  '/js/services/api.js',
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
  '/js/settings.js',
  '/js/sharing.js',
  '/js/app.js',
  '/public/libs/lucide.min.js',
  '/public/libs/qrcode.min.js',
  '/public/fonts/fonts.css',
  '/public/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Clear old caches on activation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
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
