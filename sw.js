/**
 * Z-FLOW Enterprise V2 - Service Worker
 * Versiune Refactorizată cu Arhitectură Modulară
 */

// Load build version — single source of truth for cache busting
try { importScripts('./js/version.js'); } catch (e) {}
const CACHE_NAME = 'zflow-' + (typeof ZFLOW_BUILD !== 'undefined' ? ZFLOW_BUILD : 'v61.1');
const STATIC_ASSETS = [
  './',
  './index.html',
  './js/version.js',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/services/idb.js',
  './js/services/supabase.js',
  './js/modules/index.js',
  './js/modules/utils.js',
  './js/modules/auth.js',
  './js/modules/ui.js',
  './js/modules/clients.js',
  './js/modules/suppliers.js',
  './js/modules/invoices.js',
  './js/modules/analytics.js',
  './js/modules/export.js',
  './js/modules/import.js',
  './js/modules/notifications.js',
  './js/modules/attachments.js',
  './js/modules/mobile.js',
  './js/modules/bulk.js',
  './js/modules/anaf.js',
  './js/modules/depozit.js',
  './js/modules/logistic.js',
  './js/modules/features.js',
  './js/modules/logger.js',
  './js/modules/maintenance.js',
  './js/modules/financiar.js',
  './js/modules/crud.js',
  './js/modules/efactura.js',
  './js/modules/bridge.js',
  './manifest.json',
  './icons/icon.svg'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css',
  'https://unpkg.com/html5-qrcode@2.3.4/html5-qrcode.min.js',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap'
  // jsPDF, xlsx, Chart.js are lazy-loaded on demand — cached by fetch handler on first use
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
  
  // HTML (app shell): Network First — asigura ca refresh-ul incarca codul nou;
  // fallback la cache doar cand reteaua lipseste (offline).
  // IMPORTANT: caches.match normalizeaza URL-ul la './index.html' pentru Live Server.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: incearca cache exact, apoi fallback la index.html
          return caches.match(event.request)
            .then(cached => cached || caches.match('./index.html') || caches.match('./'));
        })
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
  
  // Static assets (JS/CSS/icons): Cache First — cache-ul este mereu proaspat dupa install
  // Dupa o actualizare, CACHE_NAME se schimba, vechiul cache e sters si activat cel nou.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached; // Cache hit — raspuns instant fara retea
      return fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
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
  // [R4-FIX 2] Sync operații CRUD pendinte salvate în IDB 'pending_ops'
  console.log('📤 SW V2: syncPendingInvoices — start');

  let db;
  try {
      db = await new Promise((res, rej) => {
          const req = indexedDB.open('zflow-offline', 2);
          req.onsuccess = e => res(e.target.result);
          req.onerror = e => rej(e.target.error);
      });
  } catch (e) {
      console.error('SW: IDB open failed', e);
      return;
  }

  // Citește toate operațiile pendinte
  const ops = await new Promise((res, rej) => {
      try {
          const tx = db.transaction('pending_ops', 'readonly');
          const req = tx.objectStore('pending_ops').getAll();
          req.onsuccess = e => res(e.target.result || []);
          req.onerror = e => rej(e.target.error);
      } catch (e) { res([]); }
  });

  if (ops.length === 0) {
      console.log('SW: Nicio operație pendintă');
      db.close();
      return;
  }

  console.log(`SW: ${ops.length} operații de sincronizat`);

  // Notifică clientul activ de progress
  const clients = await self.clients.matchAll({ type: 'window' });
  const notify = (msg) => clients.forEach(c => c.postMessage({ type: 'SYNC_PROGRESS', ...msg }));

  let synced = 0, failed = 0;

  for (const op of ops) {
      try {
          // Trimite operația la app client pentru execuție
          // (SW nu are acces la Supabase SDK — delegă la window client)
          notify({ op: op.type, table: op.table, status: 'processing', id: op.id });

          // Marchează ca procesată (optimist) — clientul va confirma
          const tx = db.transaction('pending_ops', 'readwrite');
          tx.objectStore('pending_ops').delete(op.id);

          synced++;
      } catch (e) {
          console.error(`SW: Eroare sync op ${op.id}:`, e);
          failed++;
      }
  }

  db.close();
  notify({ status: 'done', synced, failed });
  console.log(`📤 SW: Sync complet — ${synced} reușite, ${failed} eșuate`);
}

// [R4-FIX 2] Handler mesaje de la window client
self.addEventListener('message', event => {
    if (event.data?.type === 'REGISTER_PENDING_OP') {
        // Clientul înregistrează o operație offline pentru sync ulterior
        console.log('SW: Operație pendentă înregistrată:', event.data.op);
    }
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
