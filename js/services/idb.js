/**
 * Z-FLOW Enterprise — IndexedDB Offline Cache
 * #7 — Cache transparent pentru funcționare offline
 *
 * Stochează local: clienti + facturi
 * Scrie la fiecare fetch reușit; citit automat la eșec de rețea.
 */

const ZFLOW_IDB_NAME = 'zflow-offline';
const ZFLOW_IDB_VERSION = 1;

/**
 * Deschide (și creează dacă e prima oară) baza IndexedDB
 */
function _idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(ZFLOW_IDB_NAME, ZFLOW_IDB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('clienti')) {
                db.createObjectStore('clienti', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('facturi')) {
                db.createObjectStore('facturi', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' });
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
 * Șterge toate datele din cache (apelat la logout)
 */
async function idbClearAll() {
    try {
        const db = await _idbOpen();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(['clienti', 'facturi', 'meta'], 'readwrite');
            tx.objectStore('clienti').clear();
            tx.objectStore('facturi').clear();
            tx.objectStore('meta').clear();
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

// Export global
const ZFlowIDB = { save: idbSave, getAll: idbGetAll, getMeta: idbGetMeta, clearAll: idbClearAll, cacheAge: idbCacheAge };
