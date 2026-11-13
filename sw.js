const CACHE_NAME = 'byd-raffle-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './register.html',
  './admin.html',
  './car.html',
  './car1.html',
  './car2.html',
  './car3.html',
  './car4.html',
  './git.html',
  './jj.html',
  './ocr.html',
  './offline.html',
  './b.png',
  './c2.jpg',
  './t1.jpg',
  './a1.jpg',
  './c1.jpg',
  './m1.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

function fetchWithTimeout(request, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('NETWORK_TIMEOUT'));
    }, timeoutMs);

    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const urlObj = new URL(request.url);

  // Ignore non-GET requests or Firebase Realtime Database connections
  if (request.method !== 'GET' || urlObj.hostname.includes('firebaseio.com')) {
    return;
  }

  // Handle HTML Page Navigations (clicks to car2.html, index.html, etc.)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetchWithTimeout(request, 4000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return networkResponse;
        })
        .catch(async () => {
          // 1. Try exact requested URL in cache
          let cachedRes = await caches.match(request);
          if (cachedRes) return cachedRes;

          // 2. Try matching by pathname (handles GitHub Pages repo routing differences)
          const allCache = await caches.open(CACHE_NAME);
          const requests = await allCache.keys();
          const match = requests.find(req => new URL(req.url).pathname === urlObj.pathname);
          if (match) {
            cachedRes = await allCache.match(match);
            if (cachedRes) return cachedRes;
          }

          // 3. Fallback to offline page or index
          const offlineFallback = await caches.match('./offline.html') || await caches.match('offline.html');
          if (offlineFallback) return offlineFallback;

          return caches.match('./index.html') || caches.match('index.html');
        })
    );
    return;
  }

  // Handle Images and Static Assets (Cache First, fallback to network)
  event.respondWith(
    caches.match(request).then((cachedAsset) => {
      if (cachedAsset) {
        // Fetch in background to update cache quietly
        fetch(request).then((netRes) => {
          if (netRes && netRes.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, netRes));
          }
        }).catch(() => {});
        return cachedAsset;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return networkResponse;
        })
        .catch(() => {
          // Return nothing or placeholder if image is missing offline
        });
    })
  );
});
