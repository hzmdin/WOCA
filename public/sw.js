// WOCA service worker: lets the installed app run with no internet.
// Only the app's own files are cached; nothing about the user is stored here.
//  - On install: cache the page, its JS/CSS, the face model and MediaPipe WASM (~35 MB).
//  - Page (navigation): network first, so an online visit picks up updates;
//    falls back to the cached page when offline.
//  - Everything else: cache first (built JS/CSS have hashed names, so a new
//    release fetches new files automatically).
// Bump CACHE when the face model or @mediapipe/tasks-vision version changes
// (those files keep the same names).
const CACHE = 'woca-v1';

const CORE = [
  './',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'models/face_landmarker.task',
  'mediapipe/wasm/vision_wasm_internal.js',
  'mediapipe/wasm/vision_wasm_internal.wasm',
  'mediapipe/wasm/vision_wasm_module_internal.js',
  'mediapipe/wasm/vision_wasm_module_internal.wasm',
];

/** The built page references hashed JS/CSS files; find them so they are cached too. */
async function pageAssets() {
  const html = await (await fetch('./', { cache: 'no-store' })).text();
  return [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => new URL(m[1], self.registration.scope).href);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([...CORE, ...(await pageAssets())]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(request);
          if (fresh.ok) await cache.put('./', fresh.clone());
          return fresh;
        } catch {
          return (await cache.match('./')) ?? Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const fresh = await fetch(request);
      if (fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    })()
  );
});
