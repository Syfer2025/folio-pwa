/* Folio: an atomic, same-origin app shell. Reading data lives in IndexedDB.
   Build and development server replace the release token with a content hash.
   Updates wait for acceptance so an open reading session is not reloaded. */
'use strict';

const RELEASE = '__FOLIO_RELEASE__';
const SCOPE = self.registration.scope;
const CACHE_PREFIX = 'folio-shell:' + encodeURIComponent(SCOPE) + ':';
const SHELL_CACHE = CACHE_PREFIX + RELEASE;
const SHELL_FILES = [
  'index.html', 'styles.css', 'reader.css', 'app.js', 'catalog.js', 'storage.js',
  'import.js', 'reader.js', 'vendor/fflate.min.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];
const SHELL_URLS = SHELL_FILES.map(file => new URL(file, SCOPE).href);
const SHELL_PATHS = new Map(SHELL_URLS.map(url => [new URL(url).pathname, url]));
const INDEX_URL = new URL('index.html', SCOPE).href;

self.addEventListener('install', event => {
  // addAll is atomic: a missing asset leaves the working version in control.
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(
    SHELL_URLS.map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' }))
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      (key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE) ||
      key === 'folio-v2-shell' || key === 'folio-v2-fonts'
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'GET_VERSION') event.ports?.[0]?.postMessage({ type: 'FOLIO_VERSION', version: RELEASE });
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const indexRequest = request.mode === 'navigate' &&
    (url.pathname === new URL(SCOPE).pathname || url.pathname === new URL(INDEX_URL).pathname);
  const cachedURL = indexRequest ? INDEX_URL : SHELL_PATHS.get(url.pathname);
  // FolioStore owns book downloads. No API, external or user-document cache.
  if (!cachedURL) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(cachedURL);
    if (cached) return cached;
    try { return await fetch(request); }
    catch {
      return new Response(indexRequest
        ? 'O Folio ainda não terminou de preparar o modo offline. Conecte-se e abra o aplicativo novamente.'
        : 'Recurso indisponível offline.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }
  })());
});
