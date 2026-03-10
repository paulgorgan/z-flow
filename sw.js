/**
 * Z-FLOW Enterprise V2 - Service Worker
 * Versiune Refactorizată cu Arhitectură Modulară
 */

const CACHE_NAME = 'zflow-v60.0';
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
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
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
  
  // HTML (app shell): Cache First — reda instant din cache, revalideaza in background
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // Porneste revalidarea in background indiferent de cache
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
        // Returneaza cache-ul imediat (LCP instant) sau reteaua daca nu e cache
        return cached || networkFetch;
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
            return caches.match('/z-flow/index.html') || caches.match('/z-flow/');
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

  // Citeşte toate operațiile pendinte
  const ops = await new Promise((res, rej) => {
      try {
          const tx = db.transaction('pending_ops', 'readonly');
          const req = tx.objectStore('pending_ops').getAll();
          req.onsuccess = e => res(e.target.result || []);
          req.onerror = e => rej(e.target.error);
      } catch (e) { res([]); }
  });

  if (ops.length === 0) {
      console.log('SW: Nicio operație pendinтă');
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
  console.log(`📤 SW: Sync complet — ${synced} reuşite, ${failed} eşuate`);
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
