const CACHE_NAME = 'miniarpg-v17';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './src/app.js',
  './src/entities.js',
  './src/combat.js',
  './src/storage.js',
  './src/gems.js',
  './src/supports.js',
  './src/skillResolution.js',
  './src/defense.js',
  './src/npcs.js',
  './src/grid.js',
  './src/equipment.js',
  './src/inventory.js',
  './src/progression.js',
  './src/talentTrees.js',
  './src/maps.js',
  './src/mapProgress.js',
  './src/mapModifiers.js',
  './src/loot.js',
  './src/merchant.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { cache: 'no-store' }).then((response) => cache.put(url, response))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network-first: always try to get the latest deploy. Cache is only a
  // fallback for offline play, never the default source when online.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
