/**
 * Z-FLOW Enterprise — IndexedDB Offline Cache
 * #7 — Cache transparent pentru funcționare offline
 *
 * Stochează local: clienti + facturi
 * Scrie la fiecare fetch reușit; citit automat la eșec de rețea.
 */

const ZFLOW_IDB_NAME = 'zflow-offline';
const ZFLOW_IDB_VERSION = 2;

/**
 * Deschide (și creează dacă e prima oară) baza IndexedDB
 */
function _idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(ZFLOW_IDB_NAME, ZFLOW_IDB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            ['clienti','facturi','furnizori','facturi_platit','produse','miscari_stoc',
             'receptii','livrari','soferi','vehicule','comenzi_transport'].forEach(name => {
                if (!db.objectStoreNames.contains(name))
                    db.createObjectStore(name, { keyPath: 'id' });
            });
            if (!db.objectStoreNames.contains('meta'))
                db.createObjectStore('meta', { keyPath: 'key' });
            // [R4-FIX 2] Store pentru operații offline pendinte
            if (!db.objectStoreNames.contains('pending_ops')) {
                const pendingStore = db.createObjectStore('pending_ops', {
                    keyPath: 'id', autoIncrement: true
                });
                pendingStore.createIndex('table', 'table', { unique: false });
                pendingStore.createIndex('created_at', 'created_at', { unique: false });
            }
        };

        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror  = (e) => reject(e.target.error);
    });
}

/**
 * Salvează (înlocuiește) toate înregistrările unui store
 * @param {'clienti'|'facturi'} storeName
 * @param {Array} records
 */
async function idbSave(storeName, records) {
    if (!Array.isArray(records) || records.length === 0) return;
    try {
        const db = await _idbOpen();
        await new Promise((resolve, reject) => {
            const tx = db.transaction([storeName, 'meta'], 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear();
            records.forEach(r => store.put(r));
            tx.objectStore('meta').put({ key: storeName, updatedAt: Date.now(), count: records.length });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror    = (e) => { db.close(); reject(e.target.error); };
        });
    } catch (err) {
        console.warn('[IDB] Eroare la scriere', storeName, err);
    }
}

/**
 * Citește toate înregistrările unui store
 * @param {'clienti'|'facturi'} storeName
 * @returns {Promise<Array>}
 */
async function idbGetAll(storeName) {
    try {
        const db = await _idbOpen();
        return await new Promise((resolve, reject) => {
            const tx  = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => { db.close(); resolve(req.result || []); };
            req.onerror   = (e) => { db.close(); reject(e.target.error); };
        });
    } catch (err) {
        console.warn('[IDB] Eroare la citire', storeName, err);
        return [];
    }
}

/**
 * Returnează metadatele unui store (updatedAt, count)
 * @param {'clienti'|'facturi'} storeName
 * @returns {Promise<{key:string, updatedAt:number, count:number}|null>}
 */
async function idbGetMeta(storeName) {
    try {
        const db = await _idbOpen();
        return await new Promise((resolve, reject) => {
            const tx  = db.transaction('meta', 'readonly');
            const req = tx.objectStore('meta').get(storeName);
            req.onsuccess = () => { db.close(); resolve(req.result || null); };
            req.onerror   = (e) => { db.close(); reject(e.target.error); };
        });
    } catch (err) {
        return null;
    }
}

/**
 * Șterge toate datele din cache
 */
async function idbClearAll() {
    // [R5-FIX 3] Ətergere completă: toate store-urile relevante
    try {
        const db = await _idbOpen();
        const storeNames = ['clienti', 'facturi', 'furnizori', 'facturi_platit', 'meta'];
        await new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, 'readwrite');
            storeNames.forEach(name => {
                try { tx.objectStore(name).clear(); } catch(e) {}
            });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror    = (e) => { db.close(); reject(e.target.error); };
        });
    } catch (err) {
        console.warn('[IDB] Eroare la ștergere cache', err);
    }
}

/**
 * Returnează un string formatat cu vârsta cache-ului
 */
async function idbCacheAge(storeName) {
    const meta = await idbGetMeta(storeName);
    if (!meta) return null;
    const ms = Date.now() - meta.updatedAt;
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} ore`;
    return `${Math.floor(h / 24)} zile`;
}

// [R4-FIX 2] Salvează o operație CRUD pendentă pentru sync offline
async function idbSavePendingOp(op) {
    // op = { type: 'INSERT'|'UPDATE'|'DELETE', table: string, payload: object }
    try {
        const db = await _idbOpen();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('pending_ops', 'readwrite');
            tx.objectStore('pending_ops').add({ ...op, created_at: Date.now() });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = e => reject(e.target.error);
        });
        // Înregistrează sync tag dacă ServiceWorker disponibil
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
            const reg = await navigator.serviceWorker.ready;
            await reg.sync.register('sync-invoices');
        }
    } catch (e) {
        console.warn('[idbSavePendingOp]', e);
    }
}

// Export global
const ZFlowIDB = {
    save: idbSave,
    getAll: idbGetAll,
    getMeta: idbGetMeta,
    clearAll: idbClearAll,
    cacheAge: idbCacheAge,
    savePendingOp: idbSavePendingOp  // [R4-FIX 2]
};
window.ZFlowIDB = ZFlowIDB;
