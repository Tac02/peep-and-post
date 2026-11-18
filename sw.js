// Peep & Post service worker: lets the app open with no signal on the range.
// Bump VERSION whenever you change any app file so installed copies refresh their saved files.
const VERSION = 'pp-v4';
const CORE = [
  './',
  './index.html',
  './css/app.css',
  './js/data.js',
  './js/ballistics.js',
  './js/plot.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's own HTTP cache so a new version really gets the new files.
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Try the network first (so updates show straight away), but don't wait more than a few
// seconds on a poor signal: fall back to the saved copy.
function networkFirst(req, key) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(key || req).then(hit => hit || caches.match('./index.html'));
    const timer = setTimeout(() => { if (!done) fromCache().then(hit => { if (hit && !done) { done = true; resolve(hit); } }); }, 3500);
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key || req, copy)); }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => fromCache().then(hit => { if (!done) { done = true; clearTimeout(timer); resolve(hit || Response.error()); } }));
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    event.respondWith(networkFirst(req, req.mode === 'navigate' ? './index.html' : undefined));
    return;
  }
  // Google Fonts: saved copy first, refreshed in the background.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
