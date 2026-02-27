/**
 * Z-FLOW Enterprise - Service Worker
 * PWA cu funcționalitate offline
 */

const CACHE_NAME = 'zflow-v7.14';
const STATIC_ASSETS = [
    '/index-refactored.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/store.js',
    '/js/services/supabase.js',
    '/manifest.json'
];

// CDN assets (cache on first use)
const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/html5-qrcode@2.3.4/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/vue@3/dist/vue.global.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap'
];

// Instalare - cache static assets
self.addEventListener('install', event => {
    console.log('🔧 Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activare - cleanup old caches
self.addEventListener('activate', event => {
    console.log('✅ Service Worker: Activated');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('🗑️ Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Supabase API calls (always network)
    if (url.hostname.includes('supabase')) return;

    // For HTML pages - Network first
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // For other assets - Cache first, network fallback
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then(response => {
                    // Cache CDN assets on first fetch
                    if (response.ok && (url.origin !== location.origin || CDN_ASSETS.some(cdn => request.url.includes(cdn)))) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                });
            })
    );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
    console.log('🔄 Background sync:', event.tag);
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Placeholder for future offline sync functionality
    console.log('📤 Syncing offline data...');
}

// Push notifications (for future use)
self.addEventListener('push', event => {
    const data = event.data?.json() || {};
    const title = data.title || 'Z-FLOW';
    const options = {
        body: data.body || 'Notificare nouă',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: data.url || '/'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data)
    );
});
