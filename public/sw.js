const CACHE_NAME = 'ciclista-app-shell-v1';
const MAP_TILES_CACHE_NAME = 'openfreemap-assets-cache-v1';

const STATIC_EXTENSIONS = /\.(?:js|css|wasm|svg|html|json|webmanifest)(?:\?.*)?$/i;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== MAP_TILES_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Cache cross-origin static map assets (sprites, glyphs, vector tiles from tiles.openfreemap.org) with CacheFirst strategy
  if (url.origin === 'https://tiles.openfreemap.org') {
    event.respondWith(
      caches.open(MAP_TILES_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return cachedResponse || new Response('Network error occurred fetching map asset', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      }),
    );
    return;
  }

  // Restrict caching to same-origin app shell assets and navigation requests
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation = request.mode === 'navigate';
  const isStaticAsset = STATIC_EXTENSIONS.test(url.pathname);

  if (!isNavigation && !isStaticAsset) {
    return;
  }

  // Stale-while-revalidate / cache-first strategy for static app shell
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          if (isNavigation) {
            return cache.match('/') || cache.match('/index.html');
          }
          return undefined;
        });

      if (cachedResponse) {
        // Return cached asset immediately; background fetch updates cache
        networkFetch.catch(() => {});
        return cachedResponse;
      }

      const freshResponse = await networkFetch;
      if (freshResponse) {
        return freshResponse;
      }

      if (isNavigation) {
        const fallback = await cache.match('/index.html');
        if (fallback) {
          return fallback;
        }
      }

      return new Response('Network error occurred while offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    }),
  );
});
