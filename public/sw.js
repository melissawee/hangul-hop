/* Hangul Hop service worker
 *
 * - Precaches the app shell so the game works offline right after the first visit.
 * - Network-first for the app's own files (so a deploy shows up on the next load when online),
 *   falling back to the cache offline.
 * - Google Fonts (CSS + font files) are cached at runtime the first time they load, so the cute
 *   fonts keep working offline too.
 * - A new version waits quietly; the page shows an "Update" button and then sends SKIP_WAITING.
 *
 * Bump VERSION whenever you change the PRECACHE list (a changed sw.js file is what triggers an update).
 */
const VERSION = '2026-11-19.1';
const SHELL = 'hangul-hop-shell-' + VERSION;
const RUNTIME = 'hangul-hop-runtime-v1';
const PRECACHE = [
  './', 'index.html', 'css/styles.css', 'js/engine.js', 'js/app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon.svg', 'icons/favicon-32.png', 'icons/favicon.ico'
];
const scoped = p => new URL(p, self.registration.scope).href;
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE.map(p => new Request(scoped(p), { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, RUNTIME]);
    for (const k of await caches.keys()) if (k.startsWith('hangul-hop-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

// own files: network first (fresh when online), cache when offline
async function networkFirst(req, asShell) {
  const cache = await caches.open(SHELL);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res && res.ok) cache.put(asShell ? scoped('./') : req, res.clone());
    return res;
  } catch (_) {
    return (await cache.match(req, { ignoreSearch: true })) ||
           (asShell ? await cache.match(scoped('./')) : null) ||
           Response.error();
  }
}

// fonts css: show the cached copy instantly, refresh in the background
function staleWhileRevalidate(e, name) {
  return caches.open(name).then(async cache => {
    const hit = await cache.match(e.request);
    const net = fetch(e.request).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  });
}

// font files never change: cache first
async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') return e.respondWith(networkFirst(req, true));
  if (url.origin === self.location.origin) return e.respondWith(networkFirst(req, false));
  if (url.hostname === 'fonts.googleapis.com') return e.respondWith(staleWhileRevalidate(e, RUNTIME));
  if (url.hostname === 'fonts.gstatic.com') return e.respondWith(cacheFirst(req, RUNTIME));
});
