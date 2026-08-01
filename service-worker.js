/**
 * service-worker.js
 *
 * Changes from the previous version (see docs/ARCHITECTURE.md for full
 * rationale):
 *   - Every current asset is listed (previously several files — including
 *     three now-extracted js/pages/*.js and css/*.css bundles — weren't
 *     cached at all, and calculate.html/index.html were missing too).
 *   - self.skipWaiting() is no longer called unconditionally on install.
 *     A new worker now waits until the page explicitly asks it to activate
 *     (see js/ui/sw-register.js), so a tab is never silently switched to a
 *     new cache while still running old in-memory JS.
 *   - Navigation requests (loading a page) use network-first-then-cache, so
 *     staff get the latest HTML when online, and the last-seen version when
 *     offline. Static assets stay cache-first (they're versioned by the
 *     cache name itself, so cache-first is safe and fast for them).
 *   - Uncached navigations with no network fall back to offline.html
 *     instead of a raw fetch rejection.
 */

const CACHE_NAME = "brews-inventory-v12";

const urlsToCache = [
  "./",
  "./index.html",
  "./calculate.html",
  "./pos.html",
  "./calendar.html",
  "./offline.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/dialog.css",
  "./css/pos.css",
  "./css/calendar.css",
  "./css/index.css",
  "./js/theme.js",
  "./js/data/store.js",
  "./js/ui/dialog.js",
  "./js/ui/sw-register.js",
  "./js/nav.js",
  "./js/header.js",
  "./js/settings.js",
  "./js/sync.js",
  "./js/InventorySystem.js",
  "./js/storage.js",
  "./js/history.js",
  "./js/ui.js",
  "./js/main.js",
  "./js/pages/pos.js",
  "./js/pages/calendar.js",
  "./js/pages/index.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(urlsToCache.map(url =>
        cache.add(url).catch(err => console.warn("SW: failed to cache", url, err))
      ))
    )
  );
  // No self.skipWaiting() here on purpose — see file header comment.
  // The waiting worker activates only when told to via the SKIP_WAITING
  // message (sent by js/ui/sw-register.js after the user confirms).
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return; // never intercept writes (Firestore calls, etc.)

  const isNavigation = req.mode === "navigate" ||
    (req.destination === "document");

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then(cached => cached || caches.match("./offline.html"))
        )
    );
    return;
  }

  // Static assets: cache-first, fall back to network, cache what we fetch.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
