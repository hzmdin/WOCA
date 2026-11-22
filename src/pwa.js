// Registers the offline service worker (public/sw.js) in the published app
// only. In development it is skipped so code changes are never stuck in a cache.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base })
    .then(() => console.info('[woca] offline support ready'))
    .catch((error) => console.warn('[woca] offline support unavailable', error));
}
