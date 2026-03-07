/**
 * Z-FLOW Enterprise V2 - Service Worker
 * Versiune Refactorizată cu Arhitectură Modulară
 */

const CACHE_NAME = 'zflow-v58.0';
const STATIC_ASSETS = [
  '/z-flow/',
  '/z-flow/index.html',
  '/z-flow/css/styles.css',
  '/z-flow/js/app.js',
  '/z-flow/js/store.js',
  '/z-flow/js/services/idb.js',
  '/z-flow/js/services/supabase.js',
  '/z-flow/js/modules/index.js',
  '/z-flow/js/modules/utils.js',
  '/z-flow/js/modules/auth.js',
  '/z-flow/js/modules/ui.js',
  '/z-flow/js/modules/clients.js',
  '/z-flow/js/modules/suppliers.js',
  '/z-flow/js/modules/invoices.js',
  '/z-flow/js/modules/analytics.js',
  '/z-flow/js/modules/export.js',
  '/z-flow/js/modules/import.js',
  '/z-flow/js/modules/notifications.js',
  '/z-flow/js/modules/attachments.js',
  '/z-flow/js/modules/mobile.js',
  '/z-flow/js/modules/bulk.js',
  '/z-flow/js/modules/anaf.js',
  '/z-flow/js/modules/depozit.js',
  '/z-flow/js/modules/logistic.js',
  '/z-flow/js/modules/features.js',
  '/z-flow/manifest.json',
  '/z-flow/icons/icon.svg'
];

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

// Install: Cache static assets
self.addEventListener('install', event => {
  console.log('🔧 SW V2: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 SW V2: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ SW V2: Static assets cached');
        return self.skipWaiting();
      })
      .catch(err => {
        console.warn('⚠️ SW V2: Cache install error:', err);
      })
  );
});

// Activate: Clean old caches
self.addEventListener('activate', event => {
  console.log('🚀 SW V2: Activating...');
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('🗑️ SW V2: Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('✅ SW V2: Activated, claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch: Network first for HTML, cache first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Supabase API calls
  if (url.hostname.includes('supabase')) return;
  
  // HTML: Network first
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // CDN assets: Cache first
  if (CDN_ASSETS.some(cdn => event.request.url.startsWith(cdn.split('/').slice(0, 3).join('/')))) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
          });
        })
    );
    return;
  }
  
  // Static assets (JS/CSS): Network first, cache fallback
  // Always fetch fresh from network so live edits are immediately visible.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('🔄 SW V2: Background sync triggered:', event.tag);
  if (event.tag === 'sync-invoices') {
    event.waitUntil(syncPendingInvoices());
  }
});

async function syncPendingInvoices() {
  // Placeholder for offline sync logic
  console.log('📤 SW V2: Syncing pending invoices...');
}
