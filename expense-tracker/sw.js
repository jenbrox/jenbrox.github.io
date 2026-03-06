const CACHE_NAME = 'jentrak-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  '/css/main.css',
  '/css/components.css',
  '/css/charts.css',
  '/js/utils.js',
  '/js/auth.js',
  '/js/store.js',
  '/js/transactions.js',
  '/js/categories.js',
  '/js/ui.js',
  '/js/dashboard.js',
  '/js/recurring.js',
  '/js/goals.js',
  '/js/charts.js',
  '/js/debts.js',
  '/js/wishlist.js',
  '/js/accounts.js',
  '/js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Skip caching for admin and API routes
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/') || url.pathname.endsWith('login.html') || url.pathname.endsWith('signup.html')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
