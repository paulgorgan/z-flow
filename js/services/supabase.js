/**
 * Z-FLOW Enterprise v7.14
 * Supabase Service - Database Operations
 */

const URL_Z = "https://exrypxknksgrtrwnbtrl.supabase.co";
// KEY_Z este cheia "publishable" (anon/public) — intenționat vizibilă pe client.
// Securitatea datelor este asigurată prin politicile RLS (Row Level Security) din Supabase,
// nu prin ascunderea acestei chei. Fiecare utilizator vede strict propriile rânduri (user_id = auth.uid()).
// [SEC-FIX] Cheia poate fi injectată extern — în producție folosiți:
//   <meta name="zflow-key" content="CHEIA_TA"> în index.html
//   sau window.__ZFLOW_CONFIG__ = { supabaseKey: 'CHEIA_TA' } dintr-un script server-side.
const KEY_Z = (
    window.__ZFLOW_CONFIG__?.supabaseKey ||
    document.querySelector('meta[name="zflow-key"]')?.getAttribute('content') ||
    "sb_publishable_nKFEv_6AOyKBFp3f_AnZmw_MMZ9MXl5" // fallback development
);

// Inițializăm clientul Supabase
const zf = supabase.createClient(URL_Z, KEY_Z);

// ==========================================
// RETRY — Exponential Backoff pentru erori de rețea
// ==========================================

/**
 * Execută o funcție asincronă cu reîncercări și exponential backoff.
 * Nu reîncercă erori de autentificare / autorizare (401, 403) sau
 * constrângeri de unicitate (cod Postgres 23505) — acestea sunt definitive.
 * @param {Function} fn - Funcția async de executat
 * @param {number} [maxRetries=3] - Numărul maxim de reîncercări după primul eșec
 * @param {number} [baseDelay=1000] - Delay-ul inițial în ms (se dublează la fiecare retry)
 * @returns {Promise<*>}
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            // Erorile definitive nu se reîncarcă
            const status = error?.status ?? error?.response?.status;
            if (status === 401 || status === 403 || error?.code === '23505') throw error;
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt); // 1s → 2s → 4s
                ZFlowLogger.warn('supabase', `[Retry] Tentativa ${attempt + 1}/${maxRetries} eșuată. Reîncerc în ${delay}ms:`, error?.message || error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

/**
 * Returnează UUID-ul utilizatorului Supabase curent (null pentru admin/demo local)
 * Folosit pentru a seta user_id în toate inserările, garantând izolarea datelor per user.
 */
function _getCurrentUserId() {
    // Admin local și demo user nu au UUID Supabase real
    if (window.ZFlowStore?.userSession?.user?.email === 'admin') return null;
    if (window.ZFlowStore?.userSession?.isDemo === true) return null;
    // Pentru utilizatorii Supabase, user_id este obligatoriu
    const id = window.ZFlowStore?.userSession?.user?.id;
    if (!id) {
        ZFlowLogger.error('supabase', '[Security] user_id lipsă pentru sesiune non-locală — operație blocată');
        throw new Error('Autentificare Supabase necesară');
    }
    return id;
}

// ==========================================
// HELPERS DEMO / LOCAL USER
// "admin/1234"   → date salvate în localStorage (persistă la refresh)
// "user/pass"    → date in-memory volatile (demo prezentare)
// Supabase users → date în Supabase (RLS per user)
// ==========================================

/**
 * Persistă/restaurează datele contului admin în localStorage.
 * Prefixul 'zflow_ad_' evită conflicte cu alte chei.
 */
const _adminLS = {
    _p: 'zflow_ad_',
    get(key) {
        try { const r = localStorage.getItem(this._p + key); return r ? JSON.parse(r) : null; } catch(e) { return null; }
    },
    set(key, val) {
        try { localStorage.setItem(this._p + key, JSON.stringify(val)); } catch(e) {}
    },
    clear() {
        try {
            Object.keys(localStorage).filter(k => k.startsWith(this._p)).forEach(k => localStorage.removeItem(k));
        } catch(e) {}
    }
};

/**
 * Persistă/restaurează datele contului DEMO în localStorage.
 * Prefixul 'zflow_dm_' evită conflicte cu admin și alte chei.
 */
const _demoLS = {
    _p: 'zflow_dm_',
    get(key) {
        try { const r = localStorage.getItem(this._p + key); return r ? JSON.parse(r) : null; } catch(e) { return null; }
    },
    set(key, val) {
        try { localStorage.setItem(this._p + key, JSON.stringify(val)); } catch(e) {}
    },
    clear() {
        try {
            Object.keys(localStorage).filter(k => k.startsWith(this._p)).forEach(k => localStorage.removeItem(k));
        } catch(e) {}
    }
};

const _demoOps = {
    // [PERF-FIX] Cache pentru _restore() — evită citiri redundante din localStorage per sesiune
    _restoreCache: new Set(),

    /** true dacă utilizatorul curent NU este autentificat Supabase (admin local SAU demo) */
    isLocal() {
        const e = window.ZFlowStore?.userSession?.user?.email;
        return e === 'admin' || window.ZFlowStore?.userSession?.isDemo === true;
    },
    /** true DOAR pentru contul demo user/pass (date volatile, se șterg la logout) */
    isDemo() { return window.ZFlowStore?.userSession?.isDemo === true; },
    /** true DOAR pentru contul admin/1234 (date persistate în localStorage) */
    isAdminLocal() {
        const email = window.ZFlowStore?.userSession?.user?.email;
        const storedUser = localStorage.getItem('zflow_ad_admin_username') || 'admin';
        return email === storedUser || email === 'admin';
    },
    /** Generează ID unic fără coliziuni — evită race condition Date.now() în bucle rapide */
    _uid() { return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8); },

    /**
     * Restaurează din localStorage în memorie (o singură dată per sesiune).
     * Apelat înainte de orice operație care citește datele.
     */
    _restore(lsKey, storeKey) {
        // [PERF-FIX] dacă storeKey e deja restaurat în această sesiune, nu mai citi din localStorage
        if (this._restoreCache.has(storeKey)) return;
        if (this.isAdminLocal() && window.ZFlowStore[storeKey] === undefined)
            window.ZFlowStore[storeKey] = _adminLS.get(lsKey) || [];
        if (this.isDemo() && window.ZFlowStore[storeKey] === undefined)
            window.ZFlowStore[storeKey] = _demoLS.get(lsKey) || [];
        if (!window.ZFlowStore[storeKey]) window.ZFlowStore[storeKey] = [];
        this._restoreCache.add(storeKey); // marchează ca restaurat în această sesiune
    },
    /** Salvează în localStorage — admin → zflow_ad_, demo → zflow_dm_. */
    _persist(lsKey, storeKey) {
        if (this.isAdminLocal()) _adminLS.set(lsKey, window.ZFlowStore[storeKey] || []);
        if (this.isDemo()) _demoLS.set(lsKey, window.ZFlowStore[storeKey] || []);
    },

    initialized() {
        if (this.isAdminLocal()) return window.ZFlowStore?._demoClienti !== undefined || _adminLS.get('clienti') !== null;
        return window.ZFlowStore?._demoClienti !== undefined;
    },

    // Profile — localStorage per-admin (namespaced); in-memory pentru demo
    fetchProfile() {
        if (window.ZFlowStore?.userSession?.isDemo) return null;
        try { return _adminLS.get('profile'); } catch(e) { return null; }
    },
    upsertProfile(payload) {
        const p = { ...payload, onboarding_done: true, updated_at: new Date().toISOString() };
        if (window.ZFlowStore?.userSession?.isDemo) {
            if (window.ZFlowStore) window.ZFlowStore.userProfile = p;
            return;
        }
        _adminLS.set('profile', p);
        if (window.ZFlowStore) window.ZFlowStore.userProfile = p;
    },

    // ── CRUD clienți ──────────────────────────────────────────────────
    insertClient(payload) {
        this._restore('clienti', '_demoClienti');
        const id = 'cDemo' + Date.now() + Math.random().toString(36).slice(2,4);
        window.ZFlowStore._demoClienti.push({ ...payload, id, created_at: new Date().toISOString() });
        this._persist('clienti', '_demoClienti');
        return id;
    },
    updateClient(id, payload) {
        this._restore('clienti', '_demoClienti');
        const arr = window.ZFlowStore._demoClienti;
        const i = arr.findIndex(c => String(c.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
        this._persist('clienti', '_demoClienti');
    },
    deleteClient(id) {
        this._restore('clienti', '_demoClienti');
        const i = window.ZFlowStore._demoClienti.findIndex(c => String(c.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoClienti.splice(i, 1);
        this._persist('clienti', '_demoClienti');
    },

    // ── CRUD facturi de încasat ───────────────────────────────────────
    insertFactura(payload) {
        this._restore('facturi', '_demoFacturi');
        window.ZFlowStore._demoFacturi.push({ ...payload, id: 'fDemo' + Date.now(), created_at: new Date().toISOString() });
        this._persist('facturi', '_demoFacturi');
    },
    updateFactura(id, payload) {
        this._restore('facturi', '_demoFacturi');
        const arr = window.ZFlowStore._demoFacturi;
        const i = arr.findIndex(f => String(f.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
        this._persist('facturi', '_demoFacturi');
    },
    deleteFactura(id) {
        this._restore('facturi', '_demoFacturi');
        const i = window.ZFlowStore._demoFacturi.findIndex(f => String(f.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoFacturi.splice(i, 1);
        this._persist('facturi', '_demoFacturi');
    },

    // ── CRUD furnizori ────────────────────────────────────────────────
    insertFurnizor(payload) {
        this._restore('furnizori', '_demoFurnizori');
        const id = 'furnDemo' + Date.now() + Math.random().toString(36).slice(2,4);
        window.ZFlowStore._demoFurnizori.push({ ...payload, id, created_at: new Date().toISOString() });
        this._persist('furnizori', '_demoFurnizori');
        return id;
    },
    updateFurnizor(id, payload) {
        this._restore('furnizori', '_demoFurnizori');
        const arr = window.ZFlowStore._demoFurnizori;
        const i = arr.findIndex(f => String(f.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
        this._persist('furnizori', '_demoFurnizori');
    },
    deleteFurnizor(id) {
        this._restore('furnizori', '_demoFurnizori');
        const i = window.ZFlowStore._demoFurnizori.findIndex(f => String(f.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoFurnizori.splice(i, 1);
        this._persist('furnizori', '_demoFurnizori');
    },

    // ── CRUD facturi de plătit ────────────────────────────────────────
    insertFacturaPlatit(payload) {
        this._restore('facturi_platit', '_demoFacturiPlatit');
        const id = 'fpDemo' + Date.now();
        window.ZFlowStore._demoFacturiPlatit.push({ ...payload, id, created_at: new Date().toISOString() });
        this._persist('facturi_platit', '_demoFacturiPlatit');
        return id; // [QUALITY-FIX] returnează ID-ul nou — necesar pentru optimistic insert în FIX 6
    },
    updateFacturaPlatit(id, payload) {
        this._restore('facturi_platit', '_demoFacturiPlatit');
        const arr = window.ZFlowStore._demoFacturiPlatit;
        const i = arr.findIndex(f => String(f.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
        this._persist('facturi_platit', '_demoFacturiPlatit');
    },
    deleteFacturaPlatit(id) {
        this._restore('facturi_platit', '_demoFacturiPlatit');
        const i = window.ZFlowStore._demoFacturiPlatit.findIndex(f => String(f.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoFacturiPlatit.splice(i, 1);
        this._persist('facturi_platit', '_demoFacturiPlatit');
    },

    // PDF mock — returnează URL local object
    uploadPDF(file) {
        try { return URL.createObjectURL(file); } catch(e) { return ''; }
    }
};

// ==========================================
// EXTINDERE _demoOps — DEPOZIT & LOGISTIC
// (același pattern: _restore + _persist pentru admin localStorage)
// ==========================================
Object.assign(_demoOps, {
    // ---- PRODUSE ----
    insertProdus(p) {
        this._restore('produse','_demoProduse');
        window.ZFlowStore._demoProduse.push({...p,id:'prod'+Date.now(),created_at:new Date().toISOString()});
        this._persist('produse','_demoProduse');
    },
    updateProdus(id,p) {
        this._restore('produse','_demoProduse');
        const a=window.ZFlowStore._demoProduse; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p};
        this._persist('produse','_demoProduse');
    },
    deleteProdus(id) {
        this._restore('produse','_demoProduse');
        const i=window.ZFlowStore._demoProduse.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoProduse.splice(i,1);
        this._persist('produse','_demoProduse');
    },
    fetchProduse() { this._restore('produse','_demoProduse'); return (window.ZFlowStore._demoProduse||[]).map(x=>({...x})); },
    // ---- MIȘCĂRI STOC ----
    insertMiscare(p) {
        this._restore('miscari_stoc','_demoMiscariStoc');
        window.ZFlowStore._demoMiscariStoc.push({...p,id:'mis'+Date.now(),created_at:new Date().toISOString()});
        this._persist('miscari_stoc','_demoMiscariStoc');
    },
    fetchMiscariStoc() { this._restore('miscari_stoc','_demoMiscariStoc'); return (window.ZFlowStore._demoMiscariStoc||[]).map(x=>({...x})); },
    // ---- RECEPȚII ----
    insertReceptie(p) {
        this._restore('receptii','_demoReceptii');
        window.ZFlowStore._demoReceptii.push({...p,id:'rec'+Date.now(),created_at:new Date().toISOString()});
        this._persist('receptii','_demoReceptii');
    },
    fetchReceptii() { this._restore('receptii','_demoReceptii'); return (window.ZFlowStore._demoReceptii||[]).map(x=>({...x})); },
    // ---- LIVRĂRI ----
    insertLivrare(p) {
        this._restore('livrari','_demoLivrari');
        window.ZFlowStore._demoLivrari.push({...p,id:'liv'+Date.now(),created_at:new Date().toISOString()});
        this._persist('livrari','_demoLivrari');
    },
    fetchLivrari() { this._restore('livrari','_demoLivrari'); return (window.ZFlowStore._demoLivrari||[]).map(x=>({...x})); },
    // ---- ȘOFERI ----
    insertSofer(p) {
        this._restore('soferi','_demoSoferi');
        window.ZFlowStore._demoSoferi.push({...p,id:'sof'+Date.now(),created_at:new Date().toISOString()});
        this._persist('soferi','_demoSoferi');
    },
    updateSofer(id,p) {
        this._restore('soferi','_demoSoferi');
        const a=window.ZFlowStore._demoSoferi; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p};
        this._persist('soferi','_demoSoferi');
    },
    deleteSofer(id) {
        this._restore('soferi','_demoSoferi');
        const i=window.ZFlowStore._demoSoferi.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoSoferi.splice(i,1);
        this._persist('soferi','_demoSoferi');
    },
    fetchSoferi() { this._restore('soferi','_demoSoferi'); return (window.ZFlowStore._demoSoferi||[]).map(x=>({...x})); },
    // ---- VEHICULE ----
    insertVehicul(p) {
        this._restore('vehicule','_demoVehicule');
        window.ZFlowStore._demoVehicule.push({...p, id:'veh_'+this._uid(), created_at:new Date().toISOString()});
        this._persist('vehicule','_demoVehicule');
    },
    updateVehicul(id,p) {
        this._restore('vehicule','_demoVehicule');
        const a=window.ZFlowStore._demoVehicule; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p};
        this._persist('vehicule','_demoVehicule');
    },
    deleteVehicul(id) {
        this._restore('vehicule','_demoVehicule');
        const i=window.ZFlowStore._demoVehicule.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoVehicule.splice(i,1);
        this._persist('vehicule','_demoVehicule');
    },
    fetchVehicule() { this._restore('vehicule','_demoVehicule'); return (window.ZFlowStore._demoVehicule||[]).map(x=>({...x})); },
    // ---- COMENZI TRANSPORT ----
    insertComanda(p) {
        this._restore('comenzi_transport','_demoComenziTransport');
        window.ZFlowStore._demoComenziTransport.push({...p, id:'ct_'+this._uid(), created_at:new Date().toISOString()});
        this._persist('comenzi_transport','_demoComenziTransport');
    },
    updateComanda(id,p) {
        this._restore('comenzi_transport','_demoComenziTransport');
        const a=window.ZFlowStore._demoComenziTransport; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p};
        this._persist('comenzi_transport','_demoComenziTransport');
    },
    deleteComanda(id) {
        this._restore('comenzi_transport','_demoComenziTransport');
        const i=window.ZFlowStore._demoComenziTransport.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoComenziTransport.splice(i,1);
        this._persist('comenzi_transport','_demoComenziTransport');
    },
    fetchComenzi() { this._restore('comenzi_transport','_demoComenziTransport'); return (window.ZFlowStore._demoComenziTransport||[]).map(x=>({...x})); },
    initializedDepozit() {
        if (this.isAdminLocal()) return window.ZFlowStore?._demoProduse !== undefined || _adminLS.get('produse') !== null;
        return window.ZFlowStore?._demoProduse !== undefined;
    },
    initializedLogistic() {
        if (this.isAdminLocal()) return window.ZFlowStore?._demoSoferi !== undefined || _adminLS.get('soferi') !== null;
        return window.ZFlowStore?._demoSoferi !== undefined;
    }
});

function _normalizeFacturi(arr) {
    // [R4-FIX 4] Alias-uri deprecate eliminate — toate modulele folosesc câmpurile canonice
    // Câmpuri canonice: numar_factura, valoare, data_emiterii
    if (!Array.isArray(arr)) return [];
    return arr.filter(f => f != null).map(f => ({
        ...f,
        // Normalizare defensivă: acceptă variante vechi din CSV/import dar nu le propagă
        numar_factura: f.numar_factura || f.nr_factura || '',
        valoare:       f.valoare != null ? f.valoare : (f.suma != null ? f.suma : 0),
        data_emiterii: f.data_emiterii || f.data_emitere || '',
        // Câmpuri numerice garantate
        id:            f.id,
        client_id:     f.client_id,
        user_id:       f.user_id,
        // Notă: nr_factura, suma, data_emitere NU mai sunt adăugate ca alias-uri
    }));
}

/**
 * Încarcă toți clienții din baza de date
 */
async function fetchClienti() {
    try {
        if (_demoOps.isLocal()) {
            _demoOps._restore('clienti', '_demoClienti');
            return (window.ZFlowStore._demoClienti || []).map(c => ({...c}));
        }
        const uid = _getCurrentUserId();
        return await withRetry(async () => {
            const { data, error } = await zf.from("clienti").select("*").order("nume_firma").eq('user_id', uid);
            if (error) throw error;
            return data || [];
        });
    } catch (err) {
        ZFlowLogger.error('supabase', '[fetchClienti] ' + (err.message || err));
        throw err;
    }
}

/**
 * Încarcă toate facturile din baza de date
 * @deprecated Folosiți fetchFacturiPaginated() pentru fetch la init.
 * Handler-ele Realtime folosesc acum update incremental din payload (după FIX 3).
 * [QUALITY-FIX] Această funcție rămâne disponibilă pentru cazuri specifice (ex: export complet).
 */
async function fetchFacturi() {
    try {
        if (_demoOps.isLocal()) {
            _demoOps._restore('facturi', '_demoFacturi');
            return _normalizeFacturi(window.ZFlowStore._demoFacturi || []);
        }
        const uid = _getCurrentUserId();
        return await withRetry(async () => {
            const { data, error } = await zf.from("facturi").select("*").order("created_at", { ascending: false }).eq('user_id', uid);
            if (error) throw error;
            return _normalizeFacturi(data || []);
        });
    } catch (err) {
        ZFlowLogger.error('supabase', '[fetchFacturi] ' + (err.message || err));
        throw err;
    }
}

/**
 * Încarcă facturi cu paginare (lazy loading)
 * #6 TODO - Lazy loading facturi
 * @param {number} limit - Numărul de facturi de încărcat
 * @param {number} offset - Offset-ul de unde să înceapă
 * @param {string} clientId - Optional: filtrare după client
 * @returns {Promise<{data: Array, count: number}>}
 */
async function fetchFacturiPaginated(limit = 50, offset = 0, clientId = null) {
    try {
        // Local check — admin și demo user folosesc stocul in-memory exclusiv, fără acces Supabase
        if (_demoOps.isLocal()) {
            const all = _normalizeFacturi(window.ZFlowStore._demoFacturi || []);
            const filtered = clientId ? all.filter(f => String(f.client_id) === String(clientId)) : all;
            return { data: filtered, count: filtered.length };
        }
        const uid = _getCurrentUserId();
        let query = zf
            .from("facturi")
            .select("*", { count: 'exact' })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)
            .eq('user_id', uid);
        if (clientId) query = query.eq("client_id", clientId);
        const { data, error, count } = await query;
        if (error) throw error;
        return { data: _normalizeFacturi(data || []), count: count || 0 };
    } catch (err) {
        ZFlowLogger.error('supabase', '[fetchFacturiPaginated] ' + (err.message || err));
        throw err;
    }
}

/**
 * Fetch o pagină suplimentară de facturi din Supabase (lazy loading real)
 */
async function fetchFacturiPage(limit = 100, offset = 0) {
    // [R4-FIX 1] Fetch o pagină suplimentară de facturi din Supabase
    // Folosit de lazy loading real pentru facturile 501+
    const uid = _getCurrentUserId();
    if (!uid) return { data: [], count: 0 };
    try {
        const { data, error, count } = await zf
            .from('facturi')
            .select('*', { count: 'exact' })
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        return { data: _normalizeFacturi(data || []), count: count || 0 };
    } catch (e) {
        ZFlowLogger.error('supabase', '[fetchFacturiPage]', e);
        return { data: [], count: 0 };
    }
}

/**
 * Inserează o factură nouă
 */
async function insertFactura(payload, strict = false) {
    if (_demoOps.isDemo()) { _demoOps.insertFactura(payload); return; }
    if (_demoOps.isLocal()) { _demoOps.insertFactura(payload); return; }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try {
        const { error } = await zf.from("facturi").insert([p]);
        if (error) throw error;
    } catch(e) {
        if (strict) throw e;
        ZFlowLogger.warn('supabase', '[insertFactura] Supabase failed, fallback local:', e.message);
        _demoOps.insertFactura(payload);
    }
}

/**
 * Actualizează o factură existentă
 */
async function updateFactura(id, payload) {
    try {
        if (_demoOps.isLocal()) { _demoOps.updateFactura(id, payload); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from("facturi").update(payload).eq("id", id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare actualizare factură');
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateFactura] ' + (err.message || err));
        throw err;
    }
}

/**
 * Șterge o factură
 */
async function deleteFactura(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteFactura(id); return; }
    try {
        const uid = _getCurrentUserId();
        const { error } = await zf.from("facturi").delete().eq("id", id).eq('user_id', uid);
        if (error) throw error;
    } catch (err) {
        ZFlowLogger.error('facturi', 'deleteFactura failed: ' + (err.message || err));
        throw err;
    }
}

/**
 * Inserează un client nou — returnează ID-ul creat
 * Dacă CUI-ul există deja, returnează ID-ul existent
 */
async function insertClient(payload, strict = false) {
    if (_demoOps.isDemo()) return _demoOps.insertClient(payload);
    if (_demoOps.isLocal()) return _demoOps.insertClient(payload);
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try {
        const { data, error } = await zf.from("clienti").insert([p]).select('id').single();
        if (error) throw error;
        return data.id;
    } catch(e) {
        // Dacă CUI există deja (unique constraint 23505), preluăm ID-ul real
        if (e.code === '23505' && payload.cui) {
            ZFlowLogger.warn('supabase', '[insertClient] CUI existent, preiau ID real din Supabase:', payload.cui);
            try {
                const { data: existing } = await zf.from('clienti').select('id').eq('cui', payload.cui).single();
                if (existing?.id) return existing.id;
            } catch(e2) {}
        }
        if (strict) throw e;
        ZFlowLogger.warn('supabase', '[insertClient] Supabase failed, fallback local:', e.message);
        return _demoOps.insertClient(payload);
    }
}

/**
 * Actualizează un client existent
 */
async function updateClient(id, payload) {
    try {
        if (_demoOps.isLocal()) { _demoOps.updateClient(id, payload); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from("clienti").update(payload).eq("id", id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare actualizare client');
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateClient] ' + (err.message || err));
        throw err;
    }
}

/**
 * Șterge un client
 */
async function deleteClient(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteClient(id); return; }
    try {
        const uid = _getCurrentUserId();
        const { error } = await zf.from("clienti").delete().eq("id", id).eq('user_id', uid);
        if (error) throw error;
    } catch (err) {
        ZFlowLogger.error('clienti', 'deleteClient failed: ' + (err.message || err));
        throw err;
    }
}

/**
 * Șterge un fișier PDF din storage după URL-ul public
 */
async function deletePDFFromStorage(publicUrl) {
    if (_demoOps.isLocal()) return; // no-op in demo/admin mode
    try {
        // Extrage calea relativă din URL-ul public Supabase
        const marker = '/object/public/facturi-pdf/';
        const idx = publicUrl.indexOf(marker);
        if (idx === -1) return; // URL necunoscut, nu facem nimic
        const filePath = decodeURIComponent(publicUrl.slice(idx + marker.length));
        const { error } = await zf.storage.from('facturi-pdf').remove([filePath]);
        if (error) ZFlowLogger.warn('supabase', '[Storage] Eroare ștergere fișier:', error.message);
    } catch (e) {
        ZFlowLogger.warn('supabase', '[Storage] Eroare ștergere fișier:', e);
    }
}

/**
 * Upload PDF factură în storage
 */
async function uploadFacturaPDF(file, numarFactura, idx = 0) {
    try {
        if (_demoOps.isLocal()) return _demoOps.uploadPDF(file);
        // idx garantează unicitate chiar dacă Date.now() returnează același ms pentru upload-uri rapide
        const fileName = `${Date.now()}_${idx}_${numarFactura.replace(/\s+/g, "_")}.pdf`;
        const { data, error } = await zf.storage
            .from("facturi-pdf")
            .upload(fileName, file, { upsert: false });
        if (error) throw new Error(error.message || 'Eroare upload PDF');
        const { data: publicData } = zf.storage
            .from("facturi-pdf")
            .getPublicUrl(fileName);
        return publicData.publicUrl;
    } catch (err) {
        ZFlowLogger.error('supabase', '[uploadFacturaPDF] ' + (err.message || err));
        throw err;
    }
}

// ==========================================
// AUTENTIFICARE SUPABASE AUTH
// ==========================================

/**
 * Login cu email și parolă
 */
async function signIn(email, password) {
    try {
        const { data, error } = await zf.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        return data;
    } catch (err) {
        ZFlowLogger.error('auth', 'signIn failed: ' + (err.message || err));
        throw err;
    }
}

/**
 * Înregistrare utilizator nou
 */
async function signUp(email, password, metadata = {}) {
    try {
        const { data, error } = await zf.auth.signUp({
            email: email,
            password: password,
            options: {
                data: metadata,
                emailRedirectTo: 'https://paulgorgan.github.io/z-flow/'
            }
        });
        if (error) throw error;
        return data;
    } catch (err) {
        ZFlowLogger.error('auth', 'signUp failed: ' + (err.message || err));
        throw err;
    }
}

/**
 * Deconectare
 */
async function signOut() {
    try {
        // [PERF-FIX] golește cache _restore la deconectare — sesiunea nouă va reîncărca din localStorage
        _demoOps._restoreCache.clear();
        const { error } = await zf.auth.signOut();
        if (error) throw error;
    } catch (err) {
        ZFlowLogger.error('auth', 'signOut failed: ' + (err.message || err));
        throw err;
    }
}

/**
 * Obține sesiunea curentă
 */
async function getSession() {
    try {
        const { data: { session }, error } = await zf.auth.getSession();
        if (error) throw error;
        return session;
    } catch (err) {
        ZFlowLogger.error('supabase', '[getSession] ' + (err.message || err));
        throw err;
    }
}

/**
 * Obține utilizatorul curent
 */
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await zf.auth.getUser();
        if (error) throw error;
        return user;
    } catch (err) {
        ZFlowLogger.error('supabase', '[getCurrentUser] ' + (err.message || err));
        throw err;
    }
}

/**
 * Ascultă schimbările de autentificare
 */
function onAuthStateChange(callback) {
    return zf.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

/**
 * Obține profilul firmei utilizatorului curent
 * Fallback pe localStorage dacă Supabase nu are date
 */
async function fetchProfile() {
    if (_demoOps.isLocal()) return _demoOps.fetchProfile();
    // Încearcă Supabase
    try {
        const { data: { user } } = await zf.auth.getUser();
        if (!user) {
            // Nu e autentificat Supabase — încearcă fallback localStorage
            try { const s = localStorage.getItem('zflow_profile_fallback'); return s ? JSON.parse(s) : null; } catch(e) { return null; }
        }
        const { data, error } = await zf
            .from("profiles")
            .select("*")
            .eq('id', user.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        // Merge câmpuri extra salvate local (judet, reg_com, banca)
        try {
            const extras = localStorage.getItem('zflow_pex_' + user.id);
            if (data) return { ...(extras ? JSON.parse(extras) : {}), ...data };
        } catch(e) {}
        if (data) return data;
        // Supabase profiles gol — fallback pe cache per-user
        ZFlowLogger.warn('supabase', '[Profile] profiles table empty, fallback pe cache per-user');
        try { const s = localStorage.getItem('zflow_prc_' + user.id); return s ? JSON.parse(s) : null; } catch(e) { return null; }
    } catch(e) {
        ZFlowLogger.warn('supabase', '[Profile] fetchProfile error:', e.message);
        return null;
    }
}

/**
 * Creează sau actualizează profilul firmei
 */
async function upsertProfile(payload) {
    if (_demoOps.isLocal()) { _demoOps.upsertProfile(payload); return; }
    const { data: { user } } = await zf.auth.getUser();
    if (!user) {
        // Nu e sesiune Supabase activă — salvează în localStorage ca fallback
        if (window.ZFlowStore) window.ZFlowStore.userProfile = { ...payload, onboarding_done: true };
        try { localStorage.setItem('zflow_profile_fallback', JSON.stringify({ ...payload, onboarding_done: true })); } catch(e) {}
        return;
    }
    // Cache per-user (namespaced, nu shared) pentru recuperare offline
    try { localStorage.setItem('zflow_prc_' + user.id, JSON.stringify({ ...payload, onboarding_done: true })); } catch(e) {}
    // Cacheaza local campurile care pot lipsi din schema Supabase
    const { judet, reg_com, banca, ...dbPayload } = payload; // [R7-FIX 3] plan_type, subscription_expires_at, display_name incluse automat
    try {
        localStorage.setItem('zflow_pex_' + user.id, JSON.stringify({ judet, reg_com, banca }));
    } catch(e) {}
    // Incearca mai intai cu payload complet, fallback la campurile de baza
    let saved = false;
    try {
        const { error } = await zf
            .from("profiles")
            .upsert({ ...payload, id: user.id, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (!error) saved = true;
    } catch(e) { ZFlowLogger.warn('supabase', '[Profile] upsert payload complet eșuat, încerc minimal:', e.message); }
    if (!saved) {
        const { error } = await zf
            .from("profiles")
            .upsert({ ...dbPayload, id: user.id, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
    }
}

// ==========================================
// FURNIZORI
// ==========================================

/**
 * Încarcă toți furnizorii din baza de date
 */
async function fetchFurnizori() {
    try {
        if (_demoOps.isLocal()) {
            _demoOps._restore('furnizori', '_demoFurnizori');
            return (window.ZFlowStore._demoFurnizori || []).map(f => ({...f}));
        }
        const uid = _getCurrentUserId();
        return await withRetry(async () => {
            const { data, error } = await zf.from("furnizori").select("*").order("nume_firma").eq('user_id', uid);
            if (error) throw error;
            return data || [];
        });
    } catch (err) {
        ZFlowLogger.error('supabase', '[fetchFurnizori] ' + (err.message || err));
        throw err;
    }
}

/**
 * Insereaz\u0103 un furnizor nou \u2014 returneaz\u0103 ID-ul creat
 * Dacă CUI-ul există deja, returnează ID-ul existent
 */
async function insertFurnizor(payload, strict = false) {
    if (_demoOps.isDemo()) return _demoOps.insertFurnizor(payload);
    if (_demoOps.isLocal()) return _demoOps.insertFurnizor(payload);
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try {
        const { data, error } = await zf.from("furnizori").insert([p]).select('id').single();
        if (error) throw error;
        return data.id;
    } catch(e) {
        // Dacă CUI există deja, preluăm ID-ul real
        if (e.code === '23505' && payload.cui) {
            ZFlowLogger.warn('supabase', '[insertFurnizor] CUI existent, preiau ID real:', payload.cui);
            try {
                const { data: existing } = await zf.from('furnizori').select('id').eq('cui', payload.cui).single();
                if (existing?.id) return existing.id;
            } catch(e2) {}
        }
        if (strict) throw e;
        ZFlowLogger.warn('supabase', '[insertFurnizor] Supabase failed, fallback local:', e.message);
        return _demoOps.insertFurnizor(payload);
    }
}

/**
 * Actualizează un furnizor existent
 */
async function updateFurnizor(id, payload) {
    try {
        if (_demoOps.isLocal()) { _demoOps.updateFurnizor(id, payload); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from("furnizori").update(payload).eq("id", id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare actualizare furnizor');
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateFurnizor] ' + (err.message || err));
        throw err;
    }
}

/**
 * Șterge un furnizor
 */
async function deleteFurnizor(id) {
    try {
        if (_demoOps.isLocal()) { _demoOps.deleteFurnizor(id); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from("furnizori").delete().eq("id", id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare ștergere furnizor');
    } catch (err) {
        ZFlowLogger.error('supabase', '[deleteFurnizor] ' + (err.message || err));
        throw err;
    }
}

// ==========================================
// FACTURI DE PLĂTIT
// ==========================================

/**
 * Încarcă toate facturile de plătit
 */
async function fetchFacturiPlatit() {
    try {
        if (_demoOps.isLocal()) {
            _demoOps._restore('facturi_platit', '_demoFacturiPlatit');
            return _normalizeFacturi(window.ZFlowStore._demoFacturiPlatit || []);
        }
        const uid = _getCurrentUserId();
        return await withRetry(async () => {
            const { data, error } = await zf.from("facturi_platit").select("*").order("created_at", { ascending: false }).eq('user_id', uid);
            if (error) throw error;
            return _normalizeFacturi(data || []);
        });
    } catch (err) {
        ZFlowLogger.error('supabase', '[fetchFacturiPlatit] ' + (err.message || err));
        throw err;
    }
}

/**
 * Inserează o factură de plătit
 * Returnează ID-ul noii înregistrări (folosit de optimistic update din FIX 6)
 */
async function insertFacturaPlatit(payload, strict = false) {
    if (_demoOps.isDemo()) { return _demoOps.insertFacturaPlatit(payload); }
    if (_demoOps.isLocal()) { return _demoOps.insertFacturaPlatit(payload); }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try {
        // [QUALITY-FIX] select('id') returnează ID-ul noii înregistrări pentru optimistic insert
        const { data, error } = await zf.from("facturi_platit").insert([p]).select('id').single();
        if (error) throw error;
        return data?.id;
    } catch(e) {
        if (strict) throw e;
        ZFlowLogger.warn('supabase', '[insertFacturaPlatit] Supabase failed, fallback local:', e.message);
        return _demoOps.insertFacturaPlatit(payload);
    }
}

/**
 * Actualizează o factură de plătit
 */
async function updateFacturaPlatit(id, payload) {
    try {
        if (_demoOps.isLocal()) { _demoOps.updateFacturaPlatit(id, payload); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from("facturi_platit").update(payload).eq("id", id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare actualizare factură furnizor');
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateFacturaPlatit] ' + (err.message || err));
        throw err;
    }
}

/**
 * Șterge o factură de plătit
 */
async function deleteFacturaPlatit(id) {
    try {
        if (_demoOps.isLocal()) { _demoOps.deleteFacturaPlatit(id); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from("facturi_platit").delete().eq("id", id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare ștergere factură furnizor');
    } catch (err) {
        ZFlowLogger.error('supabase', '[deleteFacturaPlatit] ' + (err.message || err));
        throw err;
    }
}

/**
 * Reset parolă
 */
async function resetPassword(email) {
    try {
        const { error } = await zf.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + (window.location.pathname.includes('/z-flow') ? '/z-flow/' : '/') + 'index.html'
        });
        if (error) throw error;
    } catch (err) {
        ZFlowLogger.error('supabase', '[resetPassword] ' + (err.message || err));
        throw err;
    }
}

/**
 * Actualizează email-ul sau parola utilizatorului curent
 * @param {Object} updates - { email: string } | { password: string }
 */
async function updateUser(updates) {
    try {
        const { data, error } = await zf.auth.updateUser(updates);
        if (error) throw error;
        return data;
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateUser] ' + (err.message || err));
        throw err;
    }
}

/**
 * Actualizează metadata utilizatorului autentificat (ex: maintenance_mode)
 * @param {Object} meta - cheie-valoare de adăugat în user_metadata
 */
async function updateUserMeta(meta) {
    try {
        const { data, error } = await zf.auth.updateUser({ data: meta });
        if (error) throw error;
        return data;
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateUserMeta] ' + (err.message || err));
        throw err;
    }
}

/**
 * Citește/scrie configurația globală a aplicației (tabel app_config)
 * Rulați setup_maintenance.sql în Supabase pentru a crea tabelul + RLS policies.
 * @param {string} key
 * @param {*} value - dacă undefined, doar citire
 */
async function getSetAppConfig(key, value) {
    if (value !== undefined) {
        const { error } = await zf.from('app_config').upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
        if (error) throw error;
        return value;
    }
    const { data, error } = await zf.from('app_config').select('value').eq('key', key).single();
    if (error) return null;
    try { return JSON.parse(data.value); } catch(e) { return data.value; }
}

/**
 * [R7-FIX 1] Validează token abonament.
 * Returnează { valid, plan_type, duration_days } sau null dacă invalid/expirat/folosit.
 */
async function validateSubscriptionToken(token) {
    if (!token || token.trim().length < 6) return null;
    try {
        const { data, error } = await zf
            .from('subscription_tokens')
            .select('id, used, expires_at, plan_type, duration_days')
            .eq('token', token.trim().toUpperCase())
            .maybeSingle();
        if (error || !data) return null;
        if (data.used) return null;
        if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
        return { valid: true, plan_type: data.plan_type || 'standard', duration_days: data.duration_days || 365 };
    } catch(e) {
        ZFlowLogger.warn('supabase', '[validateSubscriptionToken]', e.message);
        return null;
    }
}

/**
 * [R7-FIX 2] Marchează tokenul ca folosit.
 * Autentifică explicit cu parola proaspătă înainte de UPDATE (RLS cere authenticated).
 * Dacă email confirmation e activ, salvează tokenul pending în localStorage.
 */
async function consumeSubscriptionToken(token, email, password) {
    try {
        let hasSession = false;
        try {
            const { data: { session } } = await zf.auth.getSession();
            hasSession = !!session;
        } catch(_) {}

        if (!hasSession && password) {
            try {
                await zf.auth.signInWithPassword({ email, password });
                hasSession = true;
            } catch(loginErr) {
                // Email confirmation activ — token se consumă la primul login real (R7-FIX 5)
                ZFlowLogger.warn('supabase', '[consumeSubscriptionToken] Sesiune indisponibilă — token pending:', loginErr.message);
                try { localStorage.setItem('zflow_pending_token', token.trim().toUpperCase()); } catch(_) {}
                return;
            }
        }

        if (hasSession) {
            await zf
                .from('subscription_tokens')
                .update({ used: true, used_by: email, used_at: new Date().toISOString() })
                .eq('token', token.trim().toUpperCase());
        }
    } catch(e) {
        ZFlowLogger.warn('supabase', '[consumeSubscriptionToken]', e.message);
    }
}

// ==========================================
// DEPOZIT — PRODUSE
// ==========================================
async function fetchProduse() {
    if (_demoOps.isDemo() && _demoOps.initializedDepozit()) return _demoOps.fetchProduse();
    if (_demoOps.isLocal()) return _demoOps.fetchProduse();
    const uid = _getCurrentUserId();
    try {
        const { data, error } = await zf.from('produse').select('*').order('nume').eq('user_id', uid);
        if (error) throw error;
        return data || [];
    } catch(e) { ZFlowLogger.warn('supabase', '[DB] fetchProduse:', e.message); return []; }
}
async function insertProdus(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertProdus(payload); return; }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try { const { error } = await zf.from('produse').insert([p]); if (error) throw error; } catch(e) { _demoOps.insertProdus(payload); }
}
async function updateProdus(id, payload) {
    if (_demoOps.isLocal()) { _demoOps.updateProdus(id, payload); return; }
    const uid = _getCurrentUserId();
    try { const { error } = await zf.from('produse').update(payload).eq('id', id).eq('user_id', uid); if (error) throw error; } catch(e) { _demoOps.updateProdus(id, payload); }
}
async function deleteProdus(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteProdus(id); return; }
    const uid = _getCurrentUserId();
    try { const { error } = await zf.from('produse').delete().eq('id', id).eq('user_id', uid); if (error) throw error; } catch(e) { _demoOps.deleteProdus(id); }
}

// ==========================================
// DEPOZIT — MIȘCĂRI STOC
// ==========================================
async function fetchMiscariStoc() {
    if (_demoOps.isLocal()) return _demoOps.fetchMiscariStoc();
    const uid = _getCurrentUserId();
    try {
        const { data, error } = await zf.from('miscari_stoc').select('*').order('data', {ascending:false}).order('created_at', {ascending:false}).eq('user_id', uid);
        if (error) throw error;
        return data || [];
    } catch(e) { ZFlowLogger.warn('supabase', '[DB] fetchMiscariStoc:', e.message); return []; }
}
async function insertMiscare(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertMiscare(payload); return; }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try { const { error } = await zf.from('miscari_stoc').insert([p]); if (error) throw error; } catch(e) { _demoOps.insertMiscare(payload); }
}

// ==========================================
// SUPABASE REALTIME SUBSCRIPTIONS (Task 9)
// ==========================================
let _realtimeChannel = null;

function initRealtimeSubscriptions() {
    if (_demoOps.isLocal()) return; // nicio subscriere pentru admin/demo
    if (!zf) return;
    if (_realtimeChannel) return; // deja subscris

    // [PERF-FIX] Handler-e separate INSERT/UPDATE/DELETE — actualizează store incremental
    // fără re-fetch complet din DB, reducesând inutile round-trip-uri de rețea
    _realtimeChannel = zf.channel('zflow-realtime-v1')
        // ── clienti ──
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clienti' }, (payload) => {
            // [PERF-FIX] Adaugă incremental în store — fără fetch complet
            if (window.ZFlowStore) {
                window.ZFlowStore.dateLocal = [
                    { ...payload.new, facturi: [], sold: 0, sumaScadenta: 0 },
                    ...(window.ZFlowStore.dateLocal || [])
                ];
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderMain(); else if (typeof renderMain === 'function') renderMain();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clienti' }, (payload) => {
            // [PERF-FIX] Actualizare incrementală — păstrează câmpurile computate (facturi, sold)
            if (window.ZFlowStore?.dateLocal) {
                const i = window.ZFlowStore.dateLocal.findIndex(c => String(c.id) === String(payload.new.id));
                if (i !== -1) window.ZFlowStore.dateLocal[i] = { ...window.ZFlowStore.dateLocal[i], ...payload.new };
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderMain(); else if (typeof renderMain === 'function') renderMain();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clienti' }, (payload) => {
            // [PERF-FIX] Ștergere incrementală din store
            if (window.ZFlowStore?.dateLocal) {
                window.ZFlowStore.dateLocal = window.ZFlowStore.dateLocal.filter(c => String(c.id) !== String(payload.old.id));
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderMain(); else if (typeof renderMain === 'function') renderMain();
        })
        // ── facturi ──
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'facturi' }, (payload) => {
            // [PERF-FIX] Adaugă incremental factură în store + normalizează câmpurile
            if (window.ZFlowStore) {
                const newFact = _normalizeFacturi([payload.new])[0];
                window.ZFlowStore.dateFacturiBI = [newFact, ...(window.ZFlowStore.dateFacturiBI || [])];
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderMain(); else if (typeof renderMain === 'function') renderMain();
            if (typeof verificaScadenteNotificari === 'function') verificaScadenteNotificari();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'facturi' }, (payload) => {
            // [PERF-FIX] Actualizare incrementală factură cu normalizare câmpuri
            if (window.ZFlowStore?.dateFacturiBI) {
                const normalized = _normalizeFacturi([payload.new])[0];
                const i = window.ZFlowStore.dateFacturiBI.findIndex(f => String(f.id) === String(payload.new.id));
                if (i !== -1) window.ZFlowStore.dateFacturiBI[i] = normalized;
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderMain(); else if (typeof renderMain === 'function') renderMain();
            if (typeof verificaScadenteNotificari === 'function') verificaScadenteNotificari();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'facturi' }, (payload) => {
            // [PERF-FIX] Ștergere incrementală factură din store
            if (window.ZFlowStore?.dateFacturiBI) {
                window.ZFlowStore.dateFacturiBI = window.ZFlowStore.dateFacturiBI.filter(f => String(f.id) !== String(payload.old.id));
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderMain(); else if (typeof renderMain === 'function') renderMain();
            if (typeof verificaScadenteNotificari === 'function') verificaScadenteNotificari(); // [RISK-FIX 1]
        })
        // ── furnizori ──
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'furnizori' }, (payload) => {
            // [PERF-FIX] Adaugă incremental furnizor în store
            if (window.ZFlowStore) {
                window.ZFlowStore.dateFurnizori = [
                    { ...payload.new, facturi: [], sold: 0, sumaScadenta: 0 },
                    ...(window.ZFlowStore.dateFurnizori || [])
                ];
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderFurnizori(); else if (typeof renderFurnizori === 'function') renderFurnizori();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'furnizori' }, (payload) => {
            // [PERF-FIX] Actualizare incrementală furnizor — păstrează câmpurile computate
            if (window.ZFlowStore?.dateFurnizori) {
                const i = window.ZFlowStore.dateFurnizori.findIndex(f => String(f.id) === String(payload.new.id));
                if (i !== -1) window.ZFlowStore.dateFurnizori[i] = { ...window.ZFlowStore.dateFurnizori[i], ...payload.new };
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderFurnizori(); else if (typeof renderFurnizori === 'function') renderFurnizori();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'furnizori' }, (payload) => {
            // [PERF-FIX] Ștergere incrementală furnizor din store
            if (window.ZFlowStore?.dateFurnizori) {
                window.ZFlowStore.dateFurnizori = window.ZFlowStore.dateFurnizori.filter(f => String(f.id) !== String(payload.old.id));
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderFurnizori(); else if (typeof renderFurnizori === 'function') renderFurnizori();
        })
        // ── facturi_platit ──
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'facturi_platit' }, (payload) => {
            // [PERF-FIX] Adaugă incremental factură de plătit în store + normalizează
            if (window.ZFlowStore) {
                const newFP = _normalizeFacturi([payload.new])[0];
                window.ZFlowStore.dateFacturiPlatit = [newFP, ...(window.ZFlowStore.dateFacturiPlatit || [])];
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderFurnizori(); else if (typeof renderFurnizori === 'function') renderFurnizori();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'facturi_platit' }, (payload) => {
            // [PERF-FIX] Actualizare incrementală factură de plătit
            if (window.ZFlowStore?.dateFacturiPlatit) {
                const normalized = _normalizeFacturi([payload.new])[0];
                const i = window.ZFlowStore.dateFacturiPlatit.findIndex(f => String(f.id) === String(payload.new.id));
                if (i !== -1) window.ZFlowStore.dateFacturiPlatit[i] = normalized;
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderFurnizori(); else if (typeof renderFurnizori === 'function') renderFurnizori();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'facturi_platit' }, (payload) => {
            // [PERF-FIX] Ștergere incrementală factură de plătit din store
            if (window.ZFlowStore?.dateFacturiPlatit) {
                window.ZFlowStore.dateFacturiPlatit = window.ZFlowStore.dateFacturiPlatit.filter(f => String(f.id) !== String(payload.old.id));
            }
            if (window.ZFlowFinanciar) ZFlowFinanciar.renderFurnizori(); else if (typeof renderFurnizori === 'function') renderFurnizori();
        })
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                ZFlowLogger.info('supabase', '[Realtime] Canal activ — schimbările din DB vor apărea în timp real');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                ZFlowLogger.warn('supabase', '[Realtime] Eroare canal:', status, err?.message || '');
            } else if (status === 'CLOSED') {
                ZFlowLogger.info('supabase', '[Realtime] Canal închis (cleanup normal)');
            } else {
                ZFlowLogger.info('supabase', '[Realtime] status:', status);
            }
        });
}

function stopRealtimeSubscriptions() {
    if (_realtimeChannel && zf) {
        zf.removeChannel(_realtimeChannel);
        _realtimeChannel = null;
    }
}

// ==========================================
// DEPOZIT — RECEPȚII
// ==========================================
async function fetchReceptii() {
    if (_demoOps.isLocal()) return _demoOps.fetchReceptii();
    const uid = _getCurrentUserId();
    try { const { data, error } = await zf.from('receptii').select('*').order('created_at', {ascending:false}).eq('user_id', uid); if (error) throw error; return data || []; } catch(e) { ZFlowLogger.warn('supabase', '[DB] fetchReceptii:', e.message); return []; }
}
async function insertReceptie(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertReceptie(payload); return; }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try { const { error } = await zf.from('receptii').insert([p]); if (error) throw error; } catch(e) { _demoOps.insertReceptie(payload); }
}

// ==========================================
// DEPOZIT — LIVRĂRI
// ==========================================
async function fetchLivrari() {
    if (_demoOps.isLocal()) return _demoOps.fetchLivrari();
    const uid = _getCurrentUserId();
    try { const { data, error } = await zf.from('livrari').select('*').order('created_at', {ascending:false}).eq('user_id', uid); if (error) throw error; return data || []; } catch(e) { ZFlowLogger.warn('supabase', '[DB] fetchLivrari:', e.message); return []; }
}
async function insertLivrare(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertLivrare(payload); return; }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try { const { error } = await zf.from('livrari').insert([p]); if (error) throw error; } catch(e) { _demoOps.insertLivrare(payload); }
}

// ==========================================
// LOGISTIC — ȘOFERI
// ==========================================
async function fetchSoferi() {
    if (_demoOps.isLocal()) return _demoOps.fetchSoferi();
    const uid = _getCurrentUserId();
    try { const { data, error } = await zf.from('soferi').select('*').order('nume').eq('user_id', uid); if (error) throw error; return data || []; } catch(e) { ZFlowLogger.warn('supabase', '[DB] fetchSoferi:', e.message); return []; }
}
async function insertSofer(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertSofer(payload); return; }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try { const { error } = await zf.from('soferi').insert([p]); if (error) throw error; } catch(e) { _demoOps.insertSofer(payload); }
}
async function updateSofer(id, payload) {
    if (_demoOps.isLocal()) { _demoOps.updateSofer(id, payload); return; }
    const uid = _getCurrentUserId();
    try { const { error } = await zf.from('soferi').update(payload).eq('id', id).eq('user_id', uid); if (error) throw error; } catch(e) { _demoOps.updateSofer(id, payload); }
}
async function deleteSofer(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteSofer(id); return; }
    const uid = _getCurrentUserId();
    try { const { error } = await zf.from('soferi').delete().eq('id', id).eq('user_id', uid); if (error) throw error; } catch(e) { _demoOps.deleteSofer(id); }
}

// ==========================================
// LOGISTIC — VEHICULE
// ==========================================
async function fetchVehicule() {
    if (_demoOps.isLocal()) return _demoOps.fetchVehicule();
    const uid = _getCurrentUserId();
    try { const { data, error } = await zf.from('vehicule').select('*').order('nr_inmatriculare').eq('user_id', uid); if (error) throw error; return data || []; } catch(e) { ZFlowLogger.warn('supabase', '[DB] fetchVehicule:', e.message); return []; }
}
async function insertVehicul(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertVehicul(payload); return; }
    const uid = _getCurrentUserId();
    const p = { ...payload, user_id: uid };
    try { const { error } = await zf.from('vehicule').insert([p]); if (error) throw error; } catch(e) { _demoOps.insertVehicul(payload); }
}
async function updateVehicul(id, payload) {
    if (_demoOps.isLocal()) { _demoOps.updateVehicul(id, payload); return; }
    const uid = _getCurrentUserId();
    try { const { error } = await zf.from('vehicule').update(payload).eq('id', id).eq('user_id', uid); if (error) throw error; } catch(e) { _demoOps.updateVehicul(id, payload); }
}
async function deleteVehicul(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteVehicul(id); return; }
    const uid = _getCurrentUserId();
    try { const { error } = await zf.from('vehicule').delete().eq('id', id).eq('user_id', uid); if (error) throw error; } catch(e) { _demoOps.deleteVehicul(id); }
}

// ==========================================
// LOGISTIC — COMENZI TRANSPORT
// ==========================================
async function fetchComenziTransport() {
    if (_demoOps.isLocal()) return _demoOps.fetchComenzi();
    const uid = _getCurrentUserId();
    try { const { data, error } = await zf.from('comenzi_transport').select('*').order('created_at', {ascending:false}).eq('user_id', uid); if (error) throw error; return data || []; } catch(e) { ZFlowLogger.warn('supabase', '[DB] fetchComenziTransport:', e.message); return []; }
}
async function insertComandaTransport(payload) {
    // [R6-FIX 2] Verificare user_id înainte de insert
    if (_demoOps.isLocal()) { _demoOps.insertComanda(payload); return; }
    const uid = _getCurrentUserId();
    if (!uid) throw new Error('Sesiune expirată — reconectează-te pentru a importa date');
    const p = { ...payload, user_id: uid };
    const { error } = await zf.from('comenzi_transport').insert([p]);
    if (error) throw new Error(error.message || 'Eroare salvare comandă transport');
}
async function updateComandaTransport(id, payload) {
    try {
        if (_demoOps.isLocal()) { _demoOps.updateComanda(id, payload); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from('comenzi_transport').update(payload).eq('id', id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare actualizare comandă transport');
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateComandaTransport] ' + (err.message || err));
        throw err;
    }
}
async function deleteComandaTransport(id) {
    try {
        if (_demoOps.isLocal()) { _demoOps.deleteComanda(id); return; }
        const uid = _getCurrentUserId();
        const { error } = await zf.from('comenzi_transport').delete().eq('id', id).eq('user_id', uid);
        if (error) throw new Error(error.message || 'Eroare ștergere comandă transport');
    } catch (err) {
        ZFlowLogger.error('supabase', '[deleteComandaTransport] ' + (err.message || err));
        throw err;
    }
}

// [R4-FIX 5] Admin: funcții pentru gestionarea datelor altor utilizatori Supabase

// TODO: Creați RPC-ul în Supabase SQL Editor:
// CREATE OR REPLACE FUNCTION admin_get_user_by_email(p_email text)
// RETURNS TABLE(id uuid, email text, display_name text, created_at timestamptz)
// LANGUAGE plpgsql SECURITY DEFINER AS $$
// BEGIN
//   RETURN QUERY SELECT id, email::text, raw_user_meta_data->>'full_name' AS display_name, created_at
//   FROM auth.users WHERE email = p_email LIMIT 1;
// END; $$;

async function adminGetUserData(targetEmail) {
    // [R4-FIX 5] Admin: accesează datele unui utilizator Supabase după email
    if (!targetEmail || typeof targetEmail !== 'string') return null;
    const email = targetEmail.trim().toLowerCase();
    try {
        const { data: rpcData, error: rpcErr } = await zf.rpc('admin_get_user_by_email', { p_email: email });
        if (!rpcErr && rpcData) return rpcData;
    } catch (e) {
        ZFlowLogger.warn('supabase', '[adminGetUserData] RPC indisponibil, încerc fallback profiles');
    }
    try {
        const { data, error } = await zf
            .from('profiles')
            .select('id, email, display_name, created_at')
            .eq('email', email)
            .single();
        if (error) throw error;
        return data;
    } catch (e) {
        ZFlowLogger.warn('supabase', '[adminGetUserData] Nu s-a putut găsi utilizatorul:', e.message);
        return null;
    }
}

async function adminDeleteUserData(targetUserId, tables) {
    // [R4-FIX 5] Admin: șterge datele unui utilizator din tabelele selectate
    // ATENTIE: Necesită RLS policy specială sau service_role — verifică în Supabase Dashboard
    if (!tables) tables = ['facturi', 'clienti', 'furnizori', 'facturi_platit'];
    if (!targetUserId) throw new Error('targetUserId lipsă');
    const rezultate = {};
    for (const table of tables) {
        try {
            const { error, count } = await zf
                .from(table)
                .delete({ count: 'exact' })
                .eq('user_id', targetUserId);
            if (error) throw error;
            rezultate[table] = { success: true, deleted: count || 0 };
            ZFlowLogger.debug('supabase', `[adminDelete] ${table}: ${count} înregistrări șterse`);
        } catch (e) {
            rezultate[table] = { success: false, error: e.message };
            ZFlowLogger.error('supabase', `[adminDelete] Eroare la ${table}:`, e.message);
        }
    }
    return rezultate;
}

async function adminSendNotification(targetEmail, mesaj) {
    // [R4-FIX 5] Admin: trimite notificare unui utilizator
    if (!targetEmail || !mesaj) return false;
    try {
        const { error } = await zf.from('admin_notifications').insert({
            to_email: targetEmail.trim().toLowerCase(),
            message: String(mesaj).slice(0, 500),
            from_admin: true,
            created_at: new Date().toISOString(),
            read: false
        });
        if (error) throw error;
        return true;
    } catch (e) {
        ZFlowLogger.warn('supabase', '[adminSendNotification]', e.message);
        return false;
    }
}

/**
 * [FIX 4] Resetează cache-ul intern _restore al _demoOps.
 * Trebuie apelat la logout pentru ca datele admin local să se re-încarce
 * corect la următorul re-login (altfel _restoreCache rămâne populated
 * din sesiunea anterioară, iar _restore() returnează imediat fără să
 * încarce datele din localStorage).
 */
function resetLocalSession() {
    _demoOps._restoreCache.clear();
    ZFlowLogger.debug('supabase', '[Auth] _demoOps._restoreCache resetat — date admin local vor fi re-încarcate la re-login');
}

// [R9-FIX 1] Admin dashboard — lista completa utilizatori
async function adminGetAllUsers() {
    try {
        const { data, error } = await zf.rpc('admin_get_all_users');
        if (error) throw error;
        return data || [];
    } catch(e) {
        ZFlowLogger.warn('supabase', '[adminGetAllUsers]', e.message);
        return [];
    }
}

// [R9-FIX 1] Admin — extinde abonament user
async function adminExtendSubscription(email, days, plan) {
    try {
        const { data, error } = await zf.rpc('admin_extend_subscription', {
            p_email: email,
            p_days: parseInt(days) || 365,
            p_plan: plan || 'standard'
        });
        if (error) throw error;
        return !!data;
    } catch(e) {
        ZFlowLogger.warn('supabase', '[adminExtendSubscription]', e.message);
        return false;
    }
}

// Export pentru utilizare globală (fără module ES6 native în browser)
window.ZFlowDB = {
    zf,
    fetchClienti,
    fetchFacturi,
    fetchFacturiPaginated,
    insertFactura,
    updateFactura,
    deleteFactura,
    insertClient,
    updateClient,
    deleteClient,
    uploadFacturaPDF,
    deletePDFFromStorage,
    // Auth functions
    signIn,
    signUp,
    signOut,
    getSession,
    getCurrentUser,
    onAuthStateChange,
    resetPassword,
    // Profile functions
    fetchProfile,
    upsertProfile,
    // Furnizori
    fetchFurnizori,
    insertFurnizor,
    updateFurnizor,
    deleteFurnizor,
    // Facturi de plătit
    fetchFacturiPlatit,
    insertFacturaPlatit,
    updateFacturaPlatit,
    deleteFacturaPlatit,
    // Depozit — Produse
    fetchProduse,
    insertProdus,
    updateProdus,
    deleteProdus,
    // Depozit — Mișcări stoc
    fetchMiscariStoc,
    initRealtimeSubscriptions,
    stopRealtimeSubscriptions,
    insertMiscare,
    // Depozit — Recepții
    fetchReceptii,
    insertReceptie,
    // Depozit — Livrări
    fetchLivrari,
    insertLivrare,
    // Logistic — Șoferi
    fetchSoferi,
    insertSofer,
    updateSofer,
    deleteSofer,
    // Logistic — Vehicule
    fetchVehicule,
    insertVehicul,
    updateVehicul,
    deleteVehicul,
    // Logistic — Comenzi transport
    fetchComenziTransport,
    insertComandaTransport,
    updateComandaTransport,
    deleteComandaTransport,
    // Cont utilizator
    updateUser,
    validateSubscriptionToken,
    consumeSubscriptionToken,
    // [R7-FIX 3] Expune clientul Supabase pentru operații admin directe (generare tokeni etc.)
    _supabase() { return zf; },
    // Config aplicație (mentenanță)
    updateUserMeta,
    getSetAppConfig,
    fetchFacturiPage, // [R4-FIX 1]
    // Admin [R4-FIX 5]
    adminGetUserData,
    adminDeleteUserData,
    adminSendNotification,
    // Admin dashboard [R9-FIX 1]
    adminGetAllUsers,
    adminExtendSubscription,
    // Session helpers [FIX 4]
    resetLocalSession
};

// ── Contribuții buget de stat (TVA, CAS, CASS, Impozit) ──────────────────────
async function fetchContributii() {
    try {
        if (_demoOps.isLocal() || _demoOps.isDemo()) return [];
        const uid = _getCurrentUserId();
        const { data, error } = await zf.from('contributii_buget').select('*').eq('user_id', uid).order('luna', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (err) {
        ZFlowLogger.error('supabase', '[fetchContributii] ' + err.message);
        return [];
    }
}
async function insertContributie(payload) {
    try {
        if (_demoOps.isLocal() || _demoOps.isDemo()) {
            const id = 'demo_' + Date.now();
            window.ZFlowStore.dateContributii = [...(window.ZFlowStore.dateContributii || []), { id, ...payload }];
            return id;
        }
        const uid = _getCurrentUserId();
        const { data, error } = await zf.from('contributii_buget').insert({ ...payload, user_id: uid }).select('id').single();
        if (error) throw error;
        return data.id;
    } catch (err) {
        ZFlowLogger.error('supabase', '[insertContributie] ' + err.message);
        throw err;
    }
}
async function updateContributie(id, payload) {
    try {
        if (_demoOps.isLocal() || _demoOps.isDemo()) {
            const idx = (window.ZFlowStore.dateContributii || []).findIndex(x => x.id === id);
            if (idx >= 0) window.ZFlowStore.dateContributii[idx] = { ...window.ZFlowStore.dateContributii[idx], ...payload };
            return;
        }
        const { error } = await zf.from('contributii_buget').update(payload).eq('id', id);
        if (error) throw error;
    } catch (err) {
        ZFlowLogger.error('supabase', '[updateContributie] ' + err.message);
        throw err;
    }
}
async function deleteContributie(id) {
    try {
        if (_demoOps.isLocal() || _demoOps.isDemo()) {
            window.ZFlowStore.dateContributii = (window.ZFlowStore.dateContributii || []).filter(x => x.id !== id);
            return;
        }
        const { error } = await zf.from('contributii_buget').delete().eq('id', id);
        if (error) throw error;
    } catch (err) {
        ZFlowLogger.error('supabase', '[deleteContributie] ' + err.message);
        throw err;
    }
}
window.ZFlowDB.fetchContributii   = fetchContributii;
window.ZFlowDB.insertContributie  = insertContributie;
window.ZFlowDB.updateContributie  = updateContributie;
window.ZFlowDB.deleteContributie  = deleteContributie;
