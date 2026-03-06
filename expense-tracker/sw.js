/**
 * Jentrak Service Worker
 *
 * Enables offline-first functionality using cache-first strategy:
 * - Caches app shell (HTML, CSS, JS) assets
 * - Skips caching for API routes, admin pages, and auth pages
 * - Allows users to access previously loaded data without internet
 * - Syncs data when connection is restored
 */

/**
 * Cache version identifier
 * Increment this when making breaking changes to cached assets
 * Old caches are automatically cleared when this changes
 */
const CACHE_NAME = 'jentrak-v8';

/**
 * Assets to precache during service worker installation
 * These files will be available offline and served from cache first
 * Includes all app shell files: HTML, CSS, and JavaScript modules
 */
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

/**
 * Install Event
 * Runs when the service worker is first registered/updated
 * Pre-caches all app shell assets for offline access
 * skipWaiting() immediately activates the new service worker
 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/**
 * Activate Event
 * Runs after a new service worker is installed and old ones are no longer needed
 * Cleans up old cache versions (keeps only the current CACHE_NAME)
 * claim() makes this SW immediately control any existing pages
 */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch Event Handler
 * Intercepts all network requests and implements cache-first strategy
 *
 * Cache-first logic:
 * 1. Check if request is cached → return immediately (fast offline support)
 * 2. If not cached, fetch from network in background
 * 3. If network succeeds and response is 200, cache it for future offline use
 * 4. If network fails, fall back to cached version if available
 *
 * Exclusions (not cached):
 * - POST/PUT/DELETE/PATCH requests (only cache GET)
 * - Admin pages (/admin)
 * - API routes (/api/) → always fetch fresh from server
 * - Login/signup pages → never cache to ensure current auth state
 */
self.addEventListener('fetch', e => {
  // Only handle GET requests; bypass all other methods
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Skip caching for routes that must always be fresh from server
  if (
    url.pathname.startsWith('/admin') ||     // Admin dashboard
    url.pathname.startsWith('/api/') ||      // API endpoints
    url.pathname.endsWith('login.html') ||   // Login page
    url.pathname.endsWith('signup.html')     // Signup page
  ) {
    return;
  }

  // Implement cache-first strategy: serve from cache, update from network
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Fetch from network in parallel
      const fetched = fetch(e.request)
        .then(response => {
          // Only cache successful (200) responses
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => cached); // Network failed: return cached version if available

      // Return cached version immediately, or wait for network fetch
      return cached || fetched;
    })
  );
});
