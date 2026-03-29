/* sw.js — MBRN FinanzRechner v1.0 */
'use strict';

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `finanzrechner-${CACHE_VERSION}`;
const FONT_CACHE = `finanzrechner-fonts-${CACHE_VERSION}`;

const APP_SHELL = [
  '/FinanzRechner/',
  '/FinanzRechner/index.html',
  '/FinanzRechner/style.css',
  '/FinanzRechner/app.js',
  '/FinanzRechner/manifest.json',
  '/FinanzRechner/impressum.html',
  '/FinanzRechner/datenschutz.html',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.error('[SW] Cache installation failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Fonts: cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            if (res?.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // API calls: network-only
  if (url.includes('api.coingecko.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell: network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/FinanzRechner/index.html');
          }
        })
      )
  );
});
