/**
 * Z-FLOW Enterprise v7.14
 * Supabase Service - Database Operations
 */

const URL_Z = "https://exrypxknksgrtrwnbtrl.supabase.co";
const KEY_Z = "sb_publishable_nKFEv_6AOyKBFp3f_AnZmw_MMZ9MXl5";

// Inițializăm clientul Supabase
const zf = supabase.createClient(URL_Z, KEY_Z);

// ==========================================
// HELPERS DEMO / LOCAL USER
// Demo mode: operații in-memory (fără Supabase)
// Local user: fetchProfile/upsertProfile via localStorage
// ==========================================
const _demoOps = {
    isLocal() {
        const e = window.ZFlowStore?.userSession?.user?.email;
        return e === 'admin' || window.ZFlowStore?.userSession?.isDemo === true;
    },
    isDemo() { return window.ZFlowStore?.userSession?.isDemo === true; },
    initialized() { return window.ZFlowStore?._demoClienti !== undefined; },

    // Profile — localStorage pentru admin; in-memory pentru demo
    fetchProfile() {
        // Demo user (user/pass): profil izolat — nu preia profilul admin
        if (window.ZFlowStore?.userSession?.isDemo) return null;
        try { const s = localStorage.getItem('zflow_local_profile'); return s ? JSON.parse(s) : null; } catch(e) { return null; }
    },
    upsertProfile(payload) {
        const p = { ...payload, onboarding_done: true, updated_at: new Date().toISOString() };
        // Demo user: salvare doar în memorie (nu persistă în localStorage)
        if (window.ZFlowStore?.userSession?.isDemo) {
            if (window.ZFlowStore) window.ZFlowStore.userProfile = p;
            return;
        }
        localStorage.setItem('zflow_local_profile', JSON.stringify(p));
        if (window.ZFlowStore) window.ZFlowStore.userProfile = p;
    },

    // In-memory CRUD — clienți
    insertClient(payload) {
        if (!window.ZFlowStore._demoClienti) window.ZFlowStore._demoClienti = [];
        const id = 'cDemo' + Date.now() + Math.random().toString(36).slice(2,4);
        window.ZFlowStore._demoClienti.push({ ...payload, id, created_at: new Date().toISOString() });
        return id;  // ← returnează ID-ul creat
    },
    updateClient(id, payload) {
        const arr = window.ZFlowStore._demoClienti || [];
        const i = arr.findIndex(c => String(c.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
    },
    deleteClient(id) {
        if (!window.ZFlowStore._demoClienti) return;
        const i = window.ZFlowStore._demoClienti.findIndex(c => String(c.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoClienti.splice(i, 1);
    },

    // In-memory CRUD — facturi de încasat
    insertFactura(payload) {
        if (!window.ZFlowStore._demoFacturi) window.ZFlowStore._demoFacturi = [];
        window.ZFlowStore._demoFacturi.push({ ...payload, id: 'fDemo' + Date.now(), created_at: new Date().toISOString() });
    },
    updateFactura(id, payload) {
        const arr = window.ZFlowStore._demoFacturi || [];
        const i = arr.findIndex(f => String(f.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
    },
    deleteFactura(id) {
        if (!window.ZFlowStore._demoFacturi) return;
        const i = window.ZFlowStore._demoFacturi.findIndex(f => String(f.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoFacturi.splice(i, 1);
    },

    // In-memory CRUD — furnizori
    insertFurnizor(payload) {
        if (!window.ZFlowStore._demoFurnizori) window.ZFlowStore._demoFurnizori = [];
        const id = 'furnDemo' + Date.now() + Math.random().toString(36).slice(2,4);
        window.ZFlowStore._demoFurnizori.push({ ...payload, id, created_at: new Date().toISOString() });
        return id;  // ← returnează ID-ul creat
    },
    updateFurnizor(id, payload) {
        const arr = window.ZFlowStore._demoFurnizori || [];
        const i = arr.findIndex(f => String(f.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
    },
    deleteFurnizor(id) {
        if (!window.ZFlowStore._demoFurnizori) return;
        const i = window.ZFlowStore._demoFurnizori.findIndex(f => String(f.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoFurnizori.splice(i, 1);
    },

    // In-memory CRUD — facturi de plătit
    insertFacturaPlatit(payload) {
        if (!window.ZFlowStore._demoFacturiPlatit) window.ZFlowStore._demoFacturiPlatit = [];
        window.ZFlowStore._demoFacturiPlatit.push({ ...payload, id: 'fpDemo' + Date.now(), created_at: new Date().toISOString() });
    },
    updateFacturaPlatit(id, payload) {
        const arr = window.ZFlowStore._demoFacturiPlatit || [];
        const i = arr.findIndex(f => String(f.id) === String(id));
        if (i !== -1) arr[i] = { ...arr[i], ...payload };
    },
    deleteFacturaPlatit(id) {
        if (!window.ZFlowStore._demoFacturiPlatit) return;
        const i = window.ZFlowStore._demoFacturiPlatit.findIndex(f => String(f.id) === String(id));
        if (i !== -1) window.ZFlowStore._demoFacturiPlatit.splice(i, 1);
    },

    // PDF mock — returnează URL local object
    uploadPDF(file) {
        try { return URL.createObjectURL(file); } catch(e) { return ''; }
    }
};

// ==========================================
// EXTINDERE _demoOps — DEPOZIT & LOGISTIC
// ==========================================
Object.assign(_demoOps, {
    // ---- PRODUSE ----
    insertProdus(p) { if (!window.ZFlowStore._demoProduse) window.ZFlowStore._demoProduse = []; window.ZFlowStore._demoProduse.push({...p, id:'prod'+Date.now(), created_at:new Date().toISOString()}); },
    updateProdus(id,p) { const a=window.ZFlowStore._demoProduse||[]; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p}; },
    deleteProdus(id) { if(!window.ZFlowStore._demoProduse)return; const i=window.ZFlowStore._demoProduse.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoProduse.splice(i,1); },
    fetchProduse() { return (window.ZFlowStore._demoProduse||[]).map(x=>({...x})); },
    // ---- MIȘCĂRI STOC ----
    insertMiscare(p) { if(!window.ZFlowStore._demoMiscariStoc)window.ZFlowStore._demoMiscariStoc=[]; window.ZFlowStore._demoMiscariStoc.push({...p,id:'mis'+Date.now(),created_at:new Date().toISOString()}); },
    fetchMiscariStoc() { return (window.ZFlowStore._demoMiscariStoc||[]).map(x=>({...x})); },
    // ---- RECEPȚII ----
    insertReceptie(p) { if(!window.ZFlowStore._demoReceptii)window.ZFlowStore._demoReceptii=[]; window.ZFlowStore._demoReceptii.push({...p,id:'rec'+Date.now(),created_at:new Date().toISOString()}); },
    fetchReceptii() { return (window.ZFlowStore._demoReceptii||[]).map(x=>({...x})); },
    // ---- LIVRĂRI ----
    insertLivrare(p) { if(!window.ZFlowStore._demoLivrari)window.ZFlowStore._demoLivrari=[]; window.ZFlowStore._demoLivrari.push({...p,id:'liv'+Date.now(),created_at:new Date().toISOString()}); },
    fetchLivrari() { return (window.ZFlowStore._demoLivrari||[]).map(x=>({...x})); },
    // ---- ȘOFERI ----
    insertSofer(p) { if(!window.ZFlowStore._demoSoferi)window.ZFlowStore._demoSoferi=[]; window.ZFlowStore._demoSoferi.push({...p,id:'sof'+Date.now(),created_at:new Date().toISOString()}); },
    updateSofer(id,p) { const a=window.ZFlowStore._demoSoferi||[]; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p}; },
    deleteSofer(id) { if(!window.ZFlowStore._demoSoferi)return; const i=window.ZFlowStore._demoSoferi.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoSoferi.splice(i,1); },
    fetchSoferi() { return (window.ZFlowStore._demoSoferi||[]).map(x=>({...x})); },
    // ---- VEHICULE ----
    insertVehicul(p) { if(!window.ZFlowStore._demoVehicule)window.ZFlowStore._demoVehicule=[]; window.ZFlowStore._demoVehicule.push({...p,id:'veh'+Date.now(),created_at:new Date().toISOString()}); },
    updateVehicul(id,p) { const a=window.ZFlowStore._demoVehicule||[]; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p}; },
    deleteVehicul(id) { if(!window.ZFlowStore._demoVehicule)return; const i=window.ZFlowStore._demoVehicule.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoVehicule.splice(i,1); },
    fetchVehicule() { return (window.ZFlowStore._demoVehicule||[]).map(x=>({...x})); },
    // ---- COMENZI TRANSPORT ----
    insertComanda(p) { if(!window.ZFlowStore._demoComenziTransport)window.ZFlowStore._demoComenziTransport=[]; window.ZFlowStore._demoComenziTransport.push({...p,id:'ct'+Date.now(),created_at:new Date().toISOString()}); },
    updateComanda(id,p) { const a=window.ZFlowStore._demoComenziTransport||[]; const i=a.findIndex(x=>String(x.id)===String(id)); if(i!==-1)a[i]={...a[i],...p}; },
    deleteComanda(id) { if(!window.ZFlowStore._demoComenziTransport)return; const i=window.ZFlowStore._demoComenziTransport.findIndex(x=>String(x.id)===String(id)); if(i!==-1)window.ZFlowStore._demoComenziTransport.splice(i,1); },
    fetchComenzi() { return (window.ZFlowStore._demoComenziTransport||[]).map(x=>({...x})); },
    initializedDepozit() { return window.ZFlowStore?._demoProduse !== undefined; },
    initializedLogistic() { return window.ZFlowStore?._demoSoferi !== undefined; }
});

/**
 * Încarcă toți clienții din baza de date
 */
async function fetchClienti() {
    if (_demoOps.isDemo() && _demoOps.initialized()) return (window.ZFlowStore._demoClienti || []).map(c => ({...c}));
    const { data, error } = await zf
        .from("clienti")
        .select("*")
        .order("nume_firma");
    if (error) throw error;
    return data || [];
}

/**
 * Încarcă toate facturile din baza de date
 */
async function fetchFacturi() {
    if (_demoOps.isDemo() && _demoOps.initialized()) return (window.ZFlowStore._demoFacturi || []).map(f => ({...f}));
    const { data, error } = await zf
        .from("facturi")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
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
    let query = zf
        .from("facturi")
        .select("*", { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
    
    // Filtrare opțională după client
    if (clientId) {
        query = query.eq("client_id", clientId);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    return { data: data || [], count: count || 0 };
}

/**
 * Inserează o factură nouă
 */
async function insertFactura(payload, strict = false) {
    if (_demoOps.isDemo()) { _demoOps.insertFactura(payload); return; }
    if (_demoOps.isLocal()) { _demoOps.insertFactura(payload); return; }
    try {
        const { error } = await zf.from("facturi").insert([payload]);
        if (error) throw error;
    } catch(e) {
        if (strict) throw e;
        console.warn('[insertFactura] Supabase failed, fallback local:', e.message);
        _demoOps.insertFactura(payload);
    }
}

/**
 * Actualizează o factură existentă
 */
async function updateFactura(id, payload) {
    if (_demoOps.isDemo()) { _demoOps.updateFactura(id, payload); return; }
    const { error } = await zf.from("facturi").update(payload).eq("id", id);
    if (error) throw error;
}

/**
 * Șterge o factură
 */
async function deleteFactura(id) {
    if (_demoOps.isDemo()) { _demoOps.deleteFactura(id); return; }
    const { error } = await zf.from("facturi").delete().eq("id", id);
    if (error) throw error;
}

/**
 * Inserează un client nou — returnează ID-ul creat
 * Dacă CUI-ul există deja, returnează ID-ul existent
 */
async function insertClient(payload, strict = false) {
    if (_demoOps.isDemo()) return _demoOps.insertClient(payload);
    if (_demoOps.isLocal()) return _demoOps.insertClient(payload);
    try {
        const { data, error } = await zf.from("clienti").insert([payload]).select('id').single();
        if (error) throw error;
        return data.id;
    } catch(e) {
        // Dacă CUI există deja (unique constraint 23505), preluăm ID-ul real
        if (e.code === '23505' && payload.cui) {
            console.warn('[insertClient] CUI existent, preiau ID real din Supabase:', payload.cui);
            try {
                const { data: existing } = await zf.from('clienti').select('id').eq('cui', payload.cui).single();
                if (existing?.id) return existing.id;
            } catch(e2) {}
        }
        if (strict) throw e;
        console.warn('[insertClient] Supabase failed, fallback local:', e.message);
        return _demoOps.insertClient(payload);
    }
}

/**
 * Actualizează un client existent
 */
async function updateClient(id, payload) {
    if (_demoOps.isDemo()) { _demoOps.updateClient(id, payload); return; }
    const { error } = await zf.from("clienti").update(payload).eq("id", id);
    if (error) throw error;
}

/**
 * Șterge un client
 */
async function deleteClient(id) {
    if (_demoOps.isDemo()) { _demoOps.deleteClient(id); return; }
    const { error } = await zf.from("clienti").delete().eq("id", id);
    if (error) throw error;
}

/**
 * Șterge un fișier PDF din storage după URL-ul public
 */
async function deletePDFFromStorage(publicUrl) {
    if (_demoOps.isDemo()) return; // no-op in demo mode
    try {
        // Extrage calea relativă din URL-ul public Supabase
        const marker = '/object/public/facturi-pdf/';
        const idx = publicUrl.indexOf(marker);
        if (idx === -1) return; // URL necunoscut, nu facem nimic
        const filePath = decodeURIComponent(publicUrl.slice(idx + marker.length));
        const { error } = await zf.storage.from('facturi-pdf').remove([filePath]);
        if (error) console.warn('[Storage] Eroare ștergere fișier:', error.message);
    } catch (e) {
        console.warn('[Storage] Eroare ștergere fișier:', e);
    }
}

/**
 * Upload PDF factură în storage
 */
async function uploadFacturaPDF(file, numarFactura, idx = 0) {    if (_demoOps.isDemo()) return _demoOps.uploadPDF(file);    // idx garantează unicitate chiar dacă Date.now() returnează același ms pentru upload-uri rapide
    const fileName = `${Date.now()}_${idx}_${numarFactura.replace(/\s+/g, "_")}.pdf`;
    
    const { data, error } = await zf.storage
        .from("facturi-pdf")
        .upload(fileName, file, { upsert: false });
    
    if (error) throw error;
    
    const { data: publicData } = zf.storage
        .from("facturi-pdf")
        .getPublicUrl(fileName);
    
    return publicData.publicUrl;
}

// ==========================================
// AUTENTIFICARE SUPABASE AUTH
// ==========================================

/**
 * Login cu email și parolă
 */
async function signIn(email, password) {
    const { data, error } = await zf.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) throw error;
    return data;
}

/**
 * Înregistrare utilizator nou
 */
async function signUp(email, password, metadata = {}) {
    const { data, error } = await zf.auth.signUp({
        email: email,
        password: password,
        options: {
            data: metadata
        }
    });
    
    if (error) throw error;
    return data;
}

/**
 * Deconectare
 */
async function signOut() {
    const { error } = await zf.auth.signOut();
    if (error) throw error;
}

/**
 * Obține sesiunea curentă
 */
async function getSession() {
    const { data: { session }, error } = await zf.auth.getSession();
    if (error) throw error;
    return session;
}

/**
 * Obține utilizatorul curent
 */
async function getCurrentUser() {
    const { data: { user }, error } = await zf.auth.getUser();
    if (error) throw error;
    return user;
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
            // Nu e autentificat Supabase — încearcă cache local
            try { const s = localStorage.getItem('zflow_local_profile'); return s ? JSON.parse(s) : null; } catch(e) { return null; }
        }
        const { data, error } = await zf
            .from("profiles")
            .select("*")
            .eq('user_id', user.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        // Merge câmpuri extra salvate local (judet, reg_com, banca)
        try {
            const extras = localStorage.getItem('zflow_pex_' + user.id);
            if (data) return { ...(extras ? JSON.parse(extras) : {}), ...data };
        } catch(e) {}
        if (data) return data;
        // Supabase profiles gol — fallback pe cache localStorage
        console.warn('[Profile] profiles table empty, fallback pe cache local');
        try { const s = localStorage.getItem('zflow_local_profile'); return s ? JSON.parse(s) : null; } catch(e) { return null; }
    } catch(e) {
        console.warn('[Profile] fetchProfile error:', e.message);
        // Fallback pe cache local la orice eroare
        try { const s = localStorage.getItem('zflow_local_profile'); return s ? JSON.parse(s) : null; } catch(e2) { return null; }
    }
}

/**
 * Creează sau actualizează profilul firmei
 */
async function upsertProfile(payload) {
    if (_demoOps.isLocal()) { _demoOps.upsertProfile(payload); return; }
    // Salvează întotdeauna în localStorage ca backup (indiferent de tipul de user)
    try { localStorage.setItem('zflow_local_profile', JSON.stringify({ ...payload, onboarding_done: true })); } catch(e) {}
    const { data: { user } } = await zf.auth.getUser();
    if (!user) {
        // Nu e sesiune Supabase activă — s-a salvat în localStorage, suficient
        if (window.ZFlowStore) window.ZFlowStore.userProfile = { ...payload, onboarding_done: true };
        return;
    }
    // Cacheaza local campurile care pot lipsi din schema Supabase
    const { judet, reg_com, banca, ...dbPayload } = payload;
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
    } catch(e) {}
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
    if (_demoOps.isDemo() && _demoOps.initialized()) return (window.ZFlowStore._demoFurnizori || []).map(f => ({...f}));
    if (_demoOps.isLocal()) return (window.ZFlowStore._demoFurnizori || []).map(f => ({...f}));
    const { data, error } = await zf
        .from("furnizori")
        .select("*")
        .order("nume_firma");
    if (error) throw error;
    return data || [];
}

/**
 * Insereaz\u0103 un furnizor nou \u2014 returneaz\u0103 ID-ul creat
 * Dacă CUI-ul există deja, returnează ID-ul existent
 */
async function insertFurnizor(payload, strict = false) {
    if (_demoOps.isDemo()) return _demoOps.insertFurnizor(payload);
    if (_demoOps.isLocal()) return _demoOps.insertFurnizor(payload);
    try {
        const { data, error } = await zf.from("furnizori").insert([payload]).select('id').single();
        if (error) throw error;
        return data.id;
    } catch(e) {
        // Dacă CUI există deja, preluăm ID-ul real
        if (e.code === '23505' && payload.cui) {
            console.warn('[insertFurnizor] CUI existent, preiau ID real:', payload.cui);
            try {
                const { data: existing } = await zf.from('furnizori').select('id').eq('cui', payload.cui).single();
                if (existing?.id) return existing.id;
            } catch(e2) {}
        }
        if (strict) throw e;
        console.warn('[insertFurnizor] Supabase failed, fallback local:', e.message);
        return _demoOps.insertFurnizor(payload);
    }
}

/**
 * Actualizează un furnizor existent
 */
async function updateFurnizor(id, payload) {
    if (_demoOps.isDemo()) { _demoOps.updateFurnizor(id, payload); return; }
    const { error } = await zf.from("furnizori").update(payload).eq("id", id);
    if (error) throw error;
}

/**
 * Șterge un furnizor
 */
async function deleteFurnizor(id) {
    if (_demoOps.isDemo()) { _demoOps.deleteFurnizor(id); return; }
    const { error } = await zf.from("furnizori").delete().eq("id", id);
    if (error) throw error;
}

// ==========================================
// FACTURI DE PLĂTIT
// ==========================================

/**
 * Încarcă toate facturile de plătit
 */
async function fetchFacturiPlatit() {
    if (_demoOps.isDemo() && _demoOps.initialized()) return (window.ZFlowStore._demoFacturiPlatit || []).map(f => ({...f}));
    const { data, error } = await zf
        .from("facturi_platit")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
}

/**
 * Inserează o factură de plătit
 */
async function insertFacturaPlatit(payload, strict = false) {
    if (_demoOps.isDemo()) { _demoOps.insertFacturaPlatit(payload); return; }
    if (_demoOps.isLocal()) { _demoOps.insertFacturaPlatit(payload); return; }
    try {
        const { error } = await zf.from("facturi_platit").insert([payload]);
        if (error) throw error;
    } catch(e) {
        if (strict) throw e;
        console.warn('[insertFacturaPlatit] Supabase failed, fallback local:', e.message);
        _demoOps.insertFacturaPlatit(payload);
    }
}

/**
 * Actualizează o factură de plătit
 */
async function updateFacturaPlatit(id, payload) {
    if (_demoOps.isDemo()) { _demoOps.updateFacturaPlatit(id, payload); return; }
    const { error } = await zf.from("facturi_platit").update(payload).eq("id", id);
    if (error) throw error;
}

/**
 * Șterge o factură de plătit
 */
async function deleteFacturaPlatit(id) {
    if (_demoOps.isDemo()) { _demoOps.deleteFacturaPlatit(id); return; }
    const { error } = await zf.from("facturi_platit").delete().eq("id", id);
    if (error) throw error;
}

/**
 * Reset parolă
 */
async function resetPassword(email) {
    const { error } = await zf.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
    });
    if (error) throw error;
}

// ==========================================
// DEPOZIT — PRODUSE
// ==========================================
async function fetchProduse() {
    if (_demoOps.isDemo() && _demoOps.initializedDepozit()) return _demoOps.fetchProduse();
    if (_demoOps.isLocal()) return _demoOps.fetchProduse();
    try { const { data, error } = await zf.from('produse').select('*').order('nume'); if (error) throw error; return data || []; } catch(e) { return []; }
}
async function insertProdus(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertProdus(payload); return; }
    try { const { error } = await zf.from('produse').insert([payload]); if (error) throw error; } catch(e) { _demoOps.insertProdus(payload); }
}
async function updateProdus(id, payload) {
    if (_demoOps.isLocal()) { _demoOps.updateProdus(id, payload); return; }
    try { const { error } = await zf.from('produse').update(payload).eq('id', id); if (error) throw error; } catch(e) { _demoOps.updateProdus(id, payload); }
}
async function deleteProdus(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteProdus(id); return; }
    try { const { error } = await zf.from('produse').delete().eq('id', id); if (error) throw error; } catch(e) { _demoOps.deleteProdus(id); }
}

// ==========================================
// DEPOZIT — MIȘCĂRI STOC
// ==========================================
async function fetchMiscariStoc() {
    if (_demoOps.isLocal()) return _demoOps.fetchMiscariStoc();
    try { const { data, error } = await zf.from('miscari_stoc').select('*').order('created_at', {ascending:false}); if (error) throw error; return data || []; } catch(e) { return []; }
}
async function insertMiscare(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertMiscare(payload); return; }
    try { const { error } = await zf.from('miscari_stoc').insert([payload]); if (error) throw error; } catch(e) { _demoOps.insertMiscare(payload); }
}

// ==========================================
// DEPOZIT — RECEPȚII
// ==========================================
async function fetchReceptii() {
    if (_demoOps.isLocal()) return _demoOps.fetchReceptii();
    try { const { data, error } = await zf.from('receptii').select('*').order('created_at', {ascending:false}); if (error) throw error; return data || []; } catch(e) { return []; }
}
async function insertReceptie(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertReceptie(payload); return; }
    try { const { error } = await zf.from('receptii').insert([payload]); if (error) throw error; } catch(e) { _demoOps.insertReceptie(payload); }
}

// ==========================================
// DEPOZIT — LIVRĂRI
// ==========================================
async function fetchLivrari() {
    if (_demoOps.isLocal()) return _demoOps.fetchLivrari();
    try { const { data, error } = await zf.from('livrari').select('*').order('created_at', {ascending:false}); if (error) throw error; return data || []; } catch(e) { return []; }
}
async function insertLivrare(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertLivrare(payload); return; }
    try { const { error } = await zf.from('livrari').insert([payload]); if (error) throw error; } catch(e) { _demoOps.insertLivrare(payload); }
}

// ==========================================
// LOGISTIC — ȘOFERI
// ==========================================
async function fetchSoferi() {
    if (_demoOps.isLocal()) return _demoOps.fetchSoferi();
    try { const { data, error } = await zf.from('soferi').select('*').order('nume'); if (error) throw error; return data || []; } catch(e) { return []; }
}
async function insertSofer(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertSofer(payload); return; }
    try { const { error } = await zf.from('soferi').insert([payload]); if (error) throw error; } catch(e) { _demoOps.insertSofer(payload); }
}
async function updateSofer(id, payload) {
    if (_demoOps.isLocal()) { _demoOps.updateSofer(id, payload); return; }
    try { const { error } = await zf.from('soferi').update(payload).eq('id', id); if (error) throw error; } catch(e) { _demoOps.updateSofer(id, payload); }
}
async function deleteSofer(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteSofer(id); return; }
    try { const { error } = await zf.from('soferi').delete().eq('id', id); if (error) throw error; } catch(e) { _demoOps.deleteSofer(id); }
}

// ==========================================
// LOGISTIC — VEHICULE
// ==========================================
async function fetchVehicule() {
    if (_demoOps.isLocal()) return _demoOps.fetchVehicule();
    try { const { data, error } = await zf.from('vehicule').select('*').order('nr_inmatriculare'); if (error) throw error; return data || []; } catch(e) { return []; }
}
async function insertVehicul(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertVehicul(payload); return; }
    try { const { error } = await zf.from('vehicule').insert([payload]); if (error) throw error; } catch(e) { _demoOps.insertVehicul(payload); }
}
async function updateVehicul(id, payload) {
    if (_demoOps.isLocal()) { _demoOps.updateVehicul(id, payload); return; }
    try { const { error } = await zf.from('vehicule').update(payload).eq('id', id); if (error) throw error; } catch(e) { _demoOps.updateVehicul(id, payload); }
}
async function deleteVehicul(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteVehicul(id); return; }
    try { const { error } = await zf.from('vehicule').delete().eq('id', id); if (error) throw error; } catch(e) { _demoOps.deleteVehicul(id); }
}

// ==========================================
// LOGISTIC — COMENZI TRANSPORT
// ==========================================
async function fetchComenziTransport() {
    if (_demoOps.isLocal()) return _demoOps.fetchComenzi();
    try { const { data, error } = await zf.from('comenzi_transport').select('*').order('created_at', {ascending:false}); if (error) throw error; return data || []; } catch(e) { return []; }
}
async function insertComandaTransport(payload) {
    if (_demoOps.isLocal()) { _demoOps.insertComanda(payload); return; }
    try { const { error } = await zf.from('comenzi_transport').insert([payload]); if (error) throw error; } catch(e) { _demoOps.insertComanda(payload); }
}
async function updateComandaTransport(id, payload) {
    if (_demoOps.isLocal()) { _demoOps.updateComanda(id, payload); return; }
    try { const { error } = await zf.from('comenzi_transport').update(payload).eq('id', id); if (error) throw error; } catch(e) { _demoOps.updateComanda(id, payload); }
}
async function deleteComandaTransport(id) {
    if (_demoOps.isLocal()) { _demoOps.deleteComanda(id); return; }
    try { const { error } = await zf.from('comenzi_transport').delete().eq('id', id); if (error) throw error; } catch(e) { _demoOps.deleteComanda(id); }
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
    deleteComandaTransport
};
