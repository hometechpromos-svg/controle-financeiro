const CACHE_NAME = 'controle-financeiro-v3';
const ARQUIVOS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ARQUIVOS)).catch(() => {})
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(chaves =>
            Promise.all(
                chaves.filter(chave => chave !== CACHE_NAME).map(chave => caches.delete(chave))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached || caches.match('./index.html'));

            if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/') {
                return networkFetch.catch(() => cached);
            }

            return cached || networkFetch;
        })
    );
});
