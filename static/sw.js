
const CACHE = 'noir-v5';
const ASSETS = ['/', '/static/css/style.css', '/static/js/noir_v5.js'];
self.addEventListener('install', ev => ev.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch', ev => ev.respondWith(caches.match(ev.request).then(r=> r || fetch(ev.request))));
