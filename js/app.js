/**
 * Z-FLOW Enterprise V2 (v8.0)
 * App Principal - Vue 3 CDN + Arhitectură Modulară
 * 
 * Această versiune păstrează 100% funcțiile originale din v7.14
 * și adaugă module refactorizate pentru scalabilitate.
 * 
 * Module disponibile în js/modules/:
 * - utils.js, auth.js, ui.js, clients.js, suppliers.js
 * - invoices.js, analytics.js, export.js, import.js
 * - notifications.js, attachments.js, mobile.js, bulk.js, anaf.js
 */

// ==========================================
// MOD MENTENANȚĂ → js/modules/maintenance.js
// Funcțiile getMaintenanceState, checkAndApplyMaintenanceMode,
// toggleMaintenanceMode, _updateMaintenanceToggleUI au fost mutate
// în modulul dedicat. Alias-urile window.* sunt menținute acolo.
// ==========================================


// #13 - Drag & Drop: fișier PDF pending drop (nu poate fi setat pe input.files direct)
let pendingPDFFiles = []; // #23 - multiple attachments

// Rate limiting → ZFlowAuth (js/modules/auth.js)

// debounce — definit în js/modules/utils.js (window.debounce) — nu duplica aici

/**
 * Formatează data în format ZZ/LL/AA
 */
function formateazaDataZFlow(dataString) {
    if (!dataString) return "";
    // T12:00:00 evită decalajul de fus orar care ar putea afișa ziua anterioară
    const d = new Date(typeof dataString === 'string' && dataString.length === 10 ? dataString + 'T12:00:00' : dataString);
    if (isNaN(d.getTime())) return dataString;
    const zi = String(d.getDate()).padStart(2, "0");
    const luna = String(d.getMonth() + 1).padStart(2, "0");
    const an = d.getFullYear();
    return `${zi}/${luna}/${an}`;
}

/**
 * Setează loader global
 */
function setLoader(v) {
    const loader = document.getElementById("loader-global");
    if (loader) loader.classList.toggle("hidden", !v);
    ZFlowStore.isLoading = v;
}

/**
 * Afișează notificare toast
 */
function showNotification(message, type = "info", duration = 3500) {
    const id = "notify-" + Date.now();
    const styles = {
        success: { bg: "bg-emerald-500", icon: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>` },
        error:   { bg: "bg-red-500",     icon: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>` },
        warning: { bg: "bg-amber-500",   icon: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>` },
        info:    { bg: "bg-blue-500",    icon: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>` }
    };
    const s = styles[type] || styles.info;
    // Elimina emoji-urile din prefix (caractere speciale la inceput)
    const cleanMsg = message.replace(/^[\u{1F000}-\u{1FFFF}\u2600-\u27BF\u2300-\u23FF\u25A0-\u27BF\uD800-\uDFFF\u26A1\u26A0\u2705\u274C\u2714\u2716\uFE0F\u20E3]+[\s]*/gu, '');
    const notif = document.createElement("div");
    notif.id = id;
    notif.className = `fixed top-4 right-4 ${s.bg} text-white px-4 py-3 rounded-xl shadow-xl z-[1000] text-sm font-semibold flex items-center gap-3 max-w-[320px] transition-opacity duration-300`;
    notif.style.opacity = '0';
    notif.innerHTML = `${s.icon}<span class="leading-snug">${cleanMsg}</span>`;
    document.body.appendChild(notif);
    requestAnimationFrame(() => { notif.style.opacity = '1'; });
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif?.remove(), 300);
    }, duration);
}

/**
 * Afișează mesaj "niciun rezultat" cu ilustrații SVG contextuale
 * @param {HTMLElement} container - Containerul unde se afișează
 * @param {string} title - Titlul mesajului
 * @param {string} text - Descrierea detaliată
 * @param {string} type - Tipul: 'clients' | 'invoices' | 'search' | 'period' | 'default'
 */
function showEmptyState(container, title = "Niciun rezultat", text = "Nicio dată disponibilă", type = "default") {
    const illustrations = {
        // Niciun client - ilustrație cu persoane/firme
        clients: `
            <svg class="w-24 h-24 mx-auto mb-4" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8 4"/>
                <rect x="35" y="45" width="50" height="35" rx="4" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
                <rect x="40" y="50" width="20" height="3" rx="1.5" fill="#cbd5e1"/>
                <rect x="40" y="56" width="35" height="2" rx="1" fill="#e2e8f0"/>
                <rect x="40" y="61" width="28" height="2" rx="1" fill="#e2e8f0"/>
                <circle cx="75" cy="38" r="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
                <path d="M75 35v6M72 38h6" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
                <path d="M45 75v8M55 75v8M65 75v8" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
        
        // Nicio factură - ilustrație cu documente
        invoices: `
            <svg class="w-24 h-24 mx-auto mb-4" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8 4"/>
                <rect x="38" y="28" width="44" height="56" rx="4" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
                <path d="M70 28v12a4 4 0 004 4h12" stroke="#cbd5e1" stroke-width="2" fill="none"/>
                <rect x="46" y="50" width="28" height="3" rx="1.5" fill="#cbd5e1"/>
                <rect x="46" y="58" width="20" height="2" rx="1" fill="#e2e8f0"/>
                <rect x="46" y="64" width="24" height="2" rx="1" fill="#e2e8f0"/>
                <rect x="46" y="70" width="16" height="2" rx="1" fill="#e2e8f0"/>
                <circle cx="82" cy="78" r="12" fill="white" stroke="#cbd5e1" stroke-width="2"/>
                <path d="M79 78h6M82 75v6" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
        
        // Căutare fără rezultate - ilustrație cu lupă
        search: `
            <svg class="w-24 h-24 mx-auto mb-4" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8 4"/>
                <circle cx="52" cy="52" r="20" stroke="#cbd5e1" stroke-width="3" fill="#f8fafc"/>
                <path d="M66 66l16 16" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
                <path d="M45 52h14M52 45v14" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
                <circle cx="85" cy="35" r="6" fill="#fef3c7" stroke="#fcd34d" stroke-width="1.5"/>
                <text x="85" y="38" text-anchor="middle" font-size="9" fill="#d97706" font-weight="bold">?</text>
            </svg>`,
        
        // Fără date în perioadă - ilustrație cu calendar
        period: `
            <svg class="w-24 h-24 mx-auto mb-4" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8 4"/>
                <rect x="32" y="35" width="56" height="50" rx="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
                <rect x="32" y="35" width="56" height="14" rx="6" fill="#cbd5e1"/>
                <rect x="32" y="43" width="56" height="6" fill="#cbd5e1"/>
                <circle cx="44" cy="42" r="3" fill="#f1f5f9"/>
                <circle cx="76" cy="42" r="3" fill="#f1f5f9"/>
                <rect x="40" y="58" width="8" height="8" rx="2" fill="#e2e8f0"/>
                <rect x="56" y="58" width="8" height="8" rx="2" fill="#e2e8f0"/>
                <rect x="72" y="58" width="8" height="8" rx="2" fill="#e2e8f0"/>
                <rect x="40" y="72" width="8" height="8" rx="2" fill="#e2e8f0"/>
                <rect x="56" y="72" width="8" height="8" rx="2" fill="#e2e8f0"/>
                <path d="M70 72l12 12M82 72l-12 12" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
        
        // Default - ilustrație generică inbox gol
        default: `
            <svg class="w-24 h-24 mx-auto mb-4" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8 4"/>
                <path d="M30 55l30 20 30-20" stroke="#cbd5e1" stroke-width="2" fill="none"/>
                <rect x="30" y="55" width="60" height="35" rx="4" stroke="#cbd5e1" stroke-width="2" fill="#f8fafc"/>
                <path d="M30 55l30 18 30-18" fill="#f1f5f9"/>
                <circle cx="60" cy="70" r="8" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="2"/>
                <path d="M57 70h6M60 67v6" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`
    };
    
    const illustration = illustrations[type] || illustrations.default;
    
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 px-8">
            ${illustration}
            <p class="font-bold text-slate-500 text-sm uppercase tracking-wider mb-2">${title}</p>
            <p class="text-xs text-slate-400 text-center max-w-xs leading-relaxed">${text}</p>
        </div>`;
}

/**
 * Skeleton Loader pentru încărcare - #17 TODO
 */
function showSkeletonLoader(container, count = 5, type = "client") {
    if (!container) return;
    container.innerHTML = "";

    const skeletonTypes = {
        // Skeleton pentru carduri clienți
        client: `
            <div class="skeleton-card">
                <div class="flex items-center gap-4 mb-3">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="flex-1">
                        <div class="skeleton skeleton-text lg w-3/4 mb-2"></div>
                        <div class="skeleton skeleton-text sm w-1/2"></div>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <div class="skeleton skeleton-text md w-1/3"></div>
                    <div class="skeleton skeleton-text xl w-1/4"></div>
                </div>
            </div>`,
        
        // Skeleton pentru carduri furnizori
        furnizor: `
            <div class="skeleton-card">
              <div class="flex items-center gap-3 p-3">
                <div class="skeleton skeleton-avatar"></div>
                <div class="flex-1">
                  <div class="skeleton skeleton-text lg w-2/3 mb-2"></div>
                  <div class="skeleton skeleton-text sm w-1/3"></div>
                </div>
                <div class="skeleton skeleton-text md w-16"></div>
              </div>
            </div>`,
        // Skeleton pentru carduri facturi
        factura: `
            <div class="skeleton-card">
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <div class="skeleton skeleton-text sm w-full h-8 rounded-xl"></div>
                    <div class="skeleton skeleton-text sm w-full h-8 rounded-xl"></div>
                </div>
                <div class="flex justify-between items-center mb-3">
                    <div class="flex flex-col gap-1">
                        <div class="skeleton skeleton-text md w-20"></div>
                        <div class="skeleton skeleton-text sm w-16"></div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <div class="skeleton skeleton-text xl w-24"></div>
                        <div class="skeleton skeleton-text sm w-20"></div>
                    </div>
                </div>
                <div class="skeleton skeleton-button w-full mb-2"></div>
                <div class="grid grid-cols-6 gap-1.5">
                    <div class="skeleton h-11 rounded-xl"></div>
                    <div class="skeleton h-11 rounded-xl"></div>
                    <div class="skeleton h-11 rounded-xl"></div>
                    <div class="skeleton h-11 rounded-xl"></div>
                    <div class="skeleton h-11 rounded-xl"></div>
                    <div class="skeleton h-11 rounded-xl"></div>
                </div>
            </div>`,
        
        // Skeleton pentru KPI cards
        kpi: `
            <div class="skeleton-card p-5">
                <div class="skeleton skeleton-text sm w-24 mb-3"></div>
                <div class="skeleton skeleton-text xl w-32 mb-2"></div>
                <div class="skeleton skeleton-text sm w-20"></div>
            </div>`,
        
        // Skeleton pentru istoric plăți
        istoric: `
            <div class="skeleton-card">
                <div class="flex items-center gap-2 mb-4">
                    <div class="skeleton w-4 h-4 rounded"></div>
                    <div class="skeleton skeleton-text md w-24"></div>
                </div>
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <div class="skeleton h-16 rounded-xl"></div>
                    <div class="skeleton h-16 rounded-xl"></div>
                    <div class="skeleton h-16 rounded-xl"></div>
                </div>
                <div class="skeleton h-2 rounded-full w-full mb-4"></div>
                <div class="space-y-3">
                    <div class="flex items-center gap-3">
                        <div class="skeleton w-8 h-8 rounded-full"></div>
                        <div class="flex-1"><div class="skeleton skeleton-text md w-full"></div></div>
                        <div class="skeleton skeleton-text md w-16"></div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="skeleton w-8 h-8 rounded-full"></div>
                        <div class="flex-1"><div class="skeleton skeleton-text md w-full"></div></div>
                        <div class="skeleton skeleton-text md w-16"></div>
                    </div>
                </div>
            </div>`
    };
    
    const template = skeletonTypes[type] || skeletonTypes.client;

    for (let i = 0; i < count; i++) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = template;
        container.appendChild(wrapper.firstElementChild);
    }
}

/**
 * Ascunde skeleton și afișează conținut real cu animație
 */
function hideSkeletonLoader(container) {
    if (!container) return;
    container.querySelectorAll('.skeleton-card').forEach(el => el.remove());
    container.classList.add('skeleton-loaded');
    setTimeout(() => container.classList.remove('skeleton-loaded'), 300);
}

/**
 * Auto-label pentru accessibility
 */
function setAriaLabels() {
    document.querySelectorAll("button").forEach(btn => {
        if (!btn.getAttribute("aria-label") && btn.innerText) {
            btn.setAttribute("aria-label", btn.innerText.trim());
        }
    });
    document.querySelectorAll("input[placeholder]").forEach(inp => {
        if (!inp.getAttribute("aria-label") && inp.placeholder) {
            inp.setAttribute("aria-label", inp.placeholder);
        }
    });
}

// ==========================================
// FUNCȚII DE INIȚIALIZARE
// ==========================================

/**
 * Funcție principală de inițializare
 */
async function init(goHome = true) {
    // Verificare autentificare obligatorie (async)
    const isAuthenticated = await checkSession();
    
    if (!isAuthenticated) {
        document.getElementById("modal-auth").classList.add("active");
        
        // Ascunde interfața
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = 'none';
        if (header) header.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabMenu) fabMenu.style.display = 'none';
        
        setLoader(false);
        return; // Blochează încărcarea datelor fără autentificare
    }

    // [FIX B1] Aplică imediat restricțiile UI admin pentru a evita flash pe hard refresh
    aplicaUIAdmin();

    ZFlowLogger.debug('app', "\uD83D\uDE80 Start Sincronizare Z-Flow...");
    setLoader(true);
    invalidateCashflowCache(); // Invalidează cache cashflow la fiecare reload de date

    // DEMO: Inițializează array-urile in-memory ÎNAINTEA oricărui fetch
    // Fără această ordine, fetchClienti() ar ajunge la Supabase cu datele reale!
    if (ZFlowStore.userSession?.isDemo === true && ZFlowStore._demoClienti === undefined) {
        ZFlowStore._demoClienti         = [];
        ZFlowStore._demoFacturi         = [];
        ZFlowStore._demoFurnizori       = [];
        ZFlowStore._demoFacturiPlatit   = [];
        // Depozit & Logistic demo arrays
        ZFlowStore._demoProduse         = [];
        ZFlowStore._demoMiscariStoc     = [];
        ZFlowStore._demoReceptii        = [];
        ZFlowStore._demoLivrari         = [];
        ZFlowStore._demoSoferi          = [];
        ZFlowStore._demoVehicule        = [];
        ZFlowStore._demoComenziTransport= [];
        ZFlowLogger.debug('app', 'Demo mode: array-uri in-memory inițializate (date izolate)');
    }
    // NOTĂ: Admin local (admin/1234) NU pre-inițializăm array-urile.
    // _restore() din _demoOps le va încărca din localStorage la prima accesare.

    const listaContainer = document.getElementById("lista-firme-global");
    if (listaContainer) {
        showSkeletonLoader(listaContainer, 8);
    }

    // [PERF-FIX SWR] Stale-while-revalidate: afișează date IDB cached imediat pentru sesiunile Supabase
    // IDB rezolvă în ~50ms față de ~500-2000ms Supabase → first-paint rapid
    const _isSWRApplicable = !(ZFlowStore.userSession?.user?.email === 'admin'
        || ZFlowStore.userSession?.isDemo === true);
    ZFlowStore._freshDataLoaded = false;
    if (_isSWRApplicable) {
        (async () => {
            const [clC, fcC] = await Promise.all([
                ZFlowIDB.getAll('clienti').catch(() => []),
                ZFlowIDB.getAll('facturi').catch(() => []),
            ]);
            if (clC.length > 0 && !ZFlowStore._freshDataLoaded) {
                ZFlowStore.dateFacturiBI = fcC;
                ZFlowStore.dateLocal = clC.map(c => ({
                    ...c,
                    facturi: fcC.filter(f => String(f.client_id) === String(c.id)),
                    sold: fcC.filter(f => String(f.client_id) === String(c.id) && f.status_plata !== 'Incasat')
                              .reduce((s, f) => s + (Number(f.valoare) || 0), 0),
                    sumaScadenta: 0,
                }));
                if (typeof renderMain === 'function') renderMain();
                incarcaDashboard();
            }
        })().catch(() => {});
    }

    try {
        // [PERF-FIX] FIX 1 — fetch toate 4 surse de date în paralel cu Promise.all
        // Reduce timpul de inițializare față de await-uri secvențiale
        let cl, fc, fr, fp;

        try {
            const [clRes, fcResult, frRes, fpRes, profileRes] = await Promise.all([
                ZFlowDB.fetchClienti(),
                ZFlowDB.fetchFacturiPaginated(500, 0),
                ZFlowDB.fetchFurnizori(),
                ZFlowDB.fetchFacturiPlatit(),
                // [PERF-FIX R18] fetchProfile paralel — elimină 200–400ms serial
                (!ZFlowStore.userProfile && !(ZFlowStore.userSession?.user?.email === 'admin' || ZFlowStore.userSession?.isDemo === true))
                    ? ZFlowDB.fetchProfile().catch(() => null)
                    : Promise.resolve(null)
            ]);
            cl = clRes;
            fc = fcResult.data || [];
            fr = frRes;
            fp = fpRes;
            if (profileRes) ZFlowStore.userProfile = profileRes;
            ZFlowStore._freshDataLoaded = true; // [SWR] date Supabase au sosit — blochează render stale
            ZFlowStore._facturiTotal  = fcResult.count || 0;
            ZFlowStore._facturiLoaded = fc.length;
            ZFlowStore._facturiTotalSupabase = fcResult.count || 0; // [V3-FIX 5]
            ZFlowLogger.debug('app', `✅ Clienți: ${cl.length}, Facturi: ${fc.length}/${ZFlowStore._facturiTotal}, Furnizori: ${fr.length}, Facturi plătit: ${fp.length}`);

            // [PERF-FIX] FIX 2 — avertizare când se afișează doar 500 din totalul facturilor
            if (fcResult.count > 500) {
                showNotification(`Afișezi 500 din ${fcResult.count} facturi. Folosiți filtrul de client pentru a vedea toate facturile.`, 'warning');
            }

            // #7 - Scrie în cache IndexedDB DOAR pentru sesiunile Supabase reale
            // Admin și demo folosesc localStorage/in-memory — scrierea în IDB shared
            // ar putea suprascrie cache-ul unui alt utilizator real.
            const _isLocalSession = ZFlowStore.userSession?.user?.email === 'admin'
                || ZFlowStore.userSession?.isDemo === true;
            if (!_isLocalSession) {
                Promise.all([
                    ZFlowIDB.save('clienti', cl),
                    ZFlowIDB.save('facturi', fc),
                    ZFlowIDB.save('furnizori', fr),
                    ZFlowIDB.save('facturi_platit', fp),
                ]).catch(e => ZFlowLogger.warn('app', '[IDB] Eroare scriere cache:', e));
            }

            // [R5-FIX 5] Marchează ultimul fetch reușit — util pentru diagnosticare
            try {
                const _uid = window.ZFlowStore?.userSession?.user?.id;
                if (_uid) {
                    localStorage.setItem('zflow_last_fetch_' + _uid,
                        JSON.stringify({ ts: Date.now(), clienti: cl?.length || 0, facturi: fc?.length || 0 })
                    );
                }
            } catch(e) {}

        } catch (networkErr) {
            // #7 - Rețeaua a eșuat → fallback la cache IndexedDB pentru toate sursele
            ZFlowLogger.warn('app', '[IDB] Rețea indisponibilă, încerc cache local...', networkErr.message);
            cl = await ZFlowIDB.getAll('clienti');
            fc = await ZFlowIDB.getAll('facturi');
            fr = await ZFlowIDB.getAll('furnizori').catch(() => []);
            fp = await ZFlowIDB.getAll('facturi_platit').catch(() => []);

            if (cl.length === 0 && fc.length === 0) {
                throw networkErr; // fără cache → aruncă eroarea originală
            }

            const varstaCache = await ZFlowIDB.cacheAge('clienti');
            showNotification(`Mod offline · Cache: ${varstaCache || 'N/A'}`, 'warning');
            ZFlowLogger.debug('app', `[IDB] Din cache: ${cl.length} clienți, ${fc.length} facturi, ${fr.length} furnizori, ${fp.length} facturi plătit`);
        }

        // Procesare date comune
        ZFlowStore.dateFacturiBI    = fc || [];
        ZFlowStore.dateFacturiPlatit = fp || [];

        const azi = new Date();
        azi.setHours(0, 0, 0, 0);

        // Procesăm datele clienților
        ZFlowStore.dateLocal = (cl || []).map((c) => {
            const fcs = ZFlowStore.dateFacturiBI.filter((f) => String(f.client_id) === String(c.id));
            const sold = fcs
                .filter((f) => f.status_plata !== "Incasat")
                .reduce((sum, f) => sum + (Number(f.valoare) || 0), 0);
            const sumaScadenta = fcs.reduce((acc, fac) => {
                if (fac.status_plata !== "Incasat" && fac.data_scadenta) {
                    const dScad = new Date(fac.data_scadenta);
                    dScad.setHours(0, 0, 0, 0);
                    if (dScad < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            return {
                ...c,
                facturi: fcs,
                sold: sold,
                sumaScadenta: sumaScadenta,
            };
        });

        ZFlowLogger.debug('app', "📊 Date procesate local:", ZFlowStore.dateLocal.length);

        // Procesăm datele furnizorilor
        ZFlowStore.dateFurnizori = (fr || []).map(furn => {
            const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
            const sold = fps.filter(fp2 => fp2.status_plata !== 'Platit').reduce((sum, fp2) => sum + (Number(fp2.valoare) || 0), 0);
            const sumaScadenta = fps.reduce((acc, fac) => {
                if (fac.status_plata !== 'Platit' && fac.data_scadenta) {
                    const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                    if (d < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            return { ...furn, facturi: fps, sold, sumaScadenta };
        });

        // Demo mode: golire date la prima pornire (prezentare fără date reale)
        if (ZFlowStore.userSession?.isDemo && ZFlowStore._demoClienti === undefined) {
            ZFlowStore.dateLocal = [];
            ZFlowStore.dateFacturiBI = [];
            ZFlowStore._demoClienti = [];
            ZFlowStore._demoFacturi = [];
            ZFlowStore._demoFurnizori = [];
            ZFlowStore._demoFacturiPlatit = [];
        }
        if (ZFlowStore.userSession?.isDemo && ZFlowStore._demoFurnizori === undefined) {
            ZFlowStore.dateFurnizori = [];
            ZFlowStore.dateFacturiPlatit = [];
            ZFlowStore._demoFurnizori = [];
            ZFlowStore._demoFacturiPlatit = [];
        }

        // [PERF-FIX R18] fetchProfile mutat în Promise.all principal (paralel) — elimină await serial
        // Fallback: dacă profilul nu s-a încărcat din Promise.all (sesiune locală/demo), încearcă din nou
        if (!ZFlowStore.userProfile && !(ZFlowStore.userSession?.user?.email === 'admin' || ZFlowStore.userSession?.isDemo === true)) {
            try { const p = await ZFlowDB.fetchProfile(); if (p) ZFlowStore.userProfile = p; } catch(e) {
                ZFlowLogger.warn('app', '[init] fetchProfile error:', e.message);
            }
        }

        // [PERF-FIX] FIX 1 — render o singură dată după procesarea completă a tuturor datelor
        if (typeof renderMain === 'function') renderMain();
        updateDashboardKPI();
        if (typeof renderFurnizori === 'function') renderFurnizori();
        if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();

        // === Contribuții buget stat — fire-and-forget (non-blocking) ===
        ZFlowDB.fetchContributii().then(r => {
            ZFlowStore.dateContributii = r || [];
            invalidateCashflowCache();
            if (typeof calculeazaCashflow === 'function') calculeazaCashflow();
            if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
        }).catch(() => {});

        // === Depozit & Logistic — fire-and-forget (non-blocking) ===
        // [PERF-FIX R18] Nu mai blochăm loader-ul pentru date secundare.
        // UI-ul Home + Financiar se afișează imediat; Depozit/Logistic se populează în background.
        Promise.all([
            typeof initDepozit  === 'function' ? initDepozit()  : Promise.resolve(),
            typeof initLogistic === 'function' ? initLogistic() : Promise.resolve(),
        ]).then(() => {
            if (typeof calculeazaKPIDepozit  === 'function') calculeazaKPIDepozit();
            if (typeof calculeazaKPILogistic === 'function') calculeazaKPILogistic();
            // Re-render tab activ dacă userul e deja pe depozit/logistic
            const tab = ZFlowStore.currentTab;
            if (tab === 'depozit'  && typeof renderDepozit  === 'function') renderDepozit();
            if (tab === 'logistic' && typeof renderLogistic === 'function') renderLogistic();
            // Actualizează mini-widget-urile din Home
            if (typeof _updateHomeMiniDepozit  === 'function') _updateHomeMiniDepozit();
            if (typeof _updateHomeMiniLogistic === 'function') _updateHomeMiniLogistic();
        }).catch(() => {}).finally(() => {
        });

        populeazaBridgeUI();
        if (document.getElementById("map")) renderTransportTab();
        setBIRange('30'); // Setare implicită interval BI: ultimele 30 de zile
        saveZFlowData();
        verificaScadenteNotificari(); // #12 - verifică scadențe și actualizează bell

        // Task 9 — Supabase Realtime (multi-device sync, skip pentru local/demo)
        try { if (typeof ZFlowDB !== 'undefined') ZFlowDB.initRealtimeSubscriptions(); } catch(e) {}

    } catch (err) {
        ZFlowLogger.error('app', "❌ EROARE:", err);
        showNotification("Eroare la încărcare: " + err.message, "error");
    } finally {
        setLoader(false);
    }

    // [PERF-FIX] FIX 5 — cache referințe DOM stabile, populate după ce DOM-ul este gata
    window._DOM = {
        listaFirme:     document.getElementById('lista-firme-global'),
        listaFurnizori: document.getElementById('lista-furnizori-global'),
        totalGeneral:   document.getElementById('total-general'),
        searchFirme:    document.getElementById('search-firme'),
        searchFurnizori:document.getElementById('search-furnizori'),
        tabFinanciar:   document.getElementById('tab-financiar'),
        tabFurnizori:   document.getElementById('tab-furnizori'),
        tabDepozit:     document.getElementById('tab-depozit'),
        tabLogistic:    document.getElementById('tab-logistic'),
    };

    comutaVedereFin("firme", false);
    updateDateLabels();
    aplicaUIAdmin();
    updateSyncStatus();
    setAriaLabels();
    if (goHome) schimbaTab('home', document.getElementById('nav-btn-home'));
    else incarcaDashboard();
}

/**
 * Aplică vizibilitatea elementelor UI specifice modului admin.
 * Trebuie apelat la init() și după autentificare.
 */
function aplicaUIAdmin() {
    const isAdminLocal = ZFlowStore.userSession?.user?.email === 'admin';
    document.querySelectorAll('[data-hide-admin]').forEach(el => {
        el.classList.toggle('hidden', isAdminLocal);
    });
}
window.aplicaUIAdmin = aplicaUIAdmin;

/**
 * Actualizează statusul sincronizării SAGA
 */
function updateSyncStatus() {
    const lastSyncISO = localStorage.getItem('lastSagaSync');
    const ultimaSincronizare = lastSyncISO ? new Date(lastSyncISO) : null;
    const sapteZileInMs = 7 * 24 * 60 * 60 * 1000;
    const acum = new Date();
    const punctStatus = document.querySelector(".bg-blue-900 .w-1\\.5.h-1\\.5");
    const textStatus = document.querySelector(".bg-blue-900 .text-blue-100");

    if (!ultimaSincronizare || (acum - ultimaSincronizare > sapteZileInMs)) {
        // Sincronizare necesară (peste 7 zile sau niciodată)
        if (punctStatus) {
            punctStatus.classList.remove("bg-emerald-500");
            punctStatus.classList.add("bg-red-500");
        }
        if (textStatus) {
            if (!ultimaSincronizare) {
                textStatus.innerText = "Sincronizare SAGA: Prima sincronizare necesară";
            } else {
                const zileDeDupaSinc = Math.floor((acum - ultimaSincronizare) / (24 * 60 * 60 * 1000));
                textStatus.innerText = `Sincronizare SAGA: Necesară (${zileDeDupaSinc} zile)`;
            }
        }
    } else {
        // Sincronizare recentă (sub 7 zile)
        if (punctStatus) {
            punctStatus.classList.remove("bg-red-500");
            punctStatus.classList.add("bg-emerald-500");
        }
        if (textStatus) {
            const zileDeDupaSinc = Math.floor((acum - ultimaSincronizare) / (24 * 60 * 60 * 1000));
            if (zileDeDupaSinc === 0) {
                textStatus.innerText = "Sincronizat SAGA: Azi";
            } else if (zileDeDupaSinc === 1) {
                textStatus.innerText = "Sincronizat SAGA: Ieri";
            } else {
                textStatus.innerText = `Sincronizat SAGA: Acum ${zileDeDupaSinc} zile`;
            }
        }
    }
}

/**
 * Actualizează mini-dashboard KPI
 */
function updateDashboardKPI() {
    const facturi = ZFlowStore.dateFacturiBI || [];
    const clienti = ZFlowStore.dateLocal || [];
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);
    
    // Luna curentă
    const lunaCurenta = azi.getMonth();
    const anulCurent = azi.getFullYear();
    
    let totalIncasat = 0;
    let totalRestante = 0; // Doar facturile DEPĂȘITE (scadență < azi)
    let totalLunaAceasta = 0;
    
    facturi.forEach(f => {
        const valoare = Number(f.valoare) || 0;
        
        // Încasat total
        if (f.status_plata === "Incasat") {
            totalIncasat += valoare;
        } else {
            // Neîncasat = TOATE facturile neachitate (similar cu FURNIZORI „Neplătit")
            totalRestante += valoare;
        }
        
        // Facturat luna aceasta (după data emiterii)
        if (f.data_emiterii) {
            const dataEmitere = new Date(f.data_emiterii);
            if (dataEmitere.getMonth() === lunaCurenta && dataEmitere.getFullYear() === anulCurent) {
                totalLunaAceasta += valoare;
            }
        }
    });
    
    // Format scurt pentru numere mari
    const formatScurt = (val) => {
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return Math.round(val).toString();
    };
    
    // Update UI
    const kpiIncasat = document.getElementById("kpi-incasat");
    const kpiRestante = document.getElementById("kpi-restante");
    const kpiClienti = document.getElementById("kpi-clienti");
    const kpiLuna = document.getElementById("kpi-luna");
    
    if (kpiIncasat) kpiIncasat.innerText = formatScurt(totalIncasat);
    if (kpiRestante) kpiRestante.innerText = formatScurt(totalRestante);
    if (kpiClienti) kpiClienti.innerText = clienti.length.toString();
    if (kpiLuna) kpiLuna.innerText = formatScurt(totalLunaAceasta);
}

/**
 * Verifică autentificarea și inițializează (Supabase Auth + Demo fallback)
 */
async function verificaAuth() {
    // Ascunde mesajul de eroare anterior
    const _errDiv = document.getElementById('auth-error-msg');
    if (_errDiv) _errDiv.classList.add('hidden');
    // [R4-FIX 3] Rate limiting eliminat din client — gestionat de Supabase Auth
    // Supabase returnează eroare HTTP 429 (Too Many Requests) după încercări repetate
    // Eroarea e prinsă automat în blocul catch de mai jos și afișată utilizatorului
    
    const email = document.getElementById("auth-username").value.trim();
    const pass = document.getElementById("auth-password").value;

    if (!email || !pass) {
        showNotification("Completează email și parola", "error");
        return;
    }

    setLoader(true);
    
    // ADMIN: Acces complet, fără restricții demo
    const _adminStoredPass = localStorage.getItem('zflow_ad_admin_password') || '1234';
    if (email === "admin" && pass === _adminStoredPass) {
        // Curăță localStorage-ul rezidual din sesiuni Supabase anterioare
        // (previne afișarea soldurilor greșite din date vechi cached)
        try {
            const keysToKeep = ['zflow_ad_admin_password', 'zflow_session_admin', 'zflow_remember_admin'];
            Object.keys(localStorage)
                .filter(k => k.startsWith('sb-') || (k.startsWith('zflow_') && !keysToKeep.includes(k)))
                .forEach(k => localStorage.removeItem(k));
        } catch(e) {}

        ZFlowStore.userSession = { user: { email: 'admin' }, isDemo: false };
        const rememberMe = document.getElementById('auth-remember')?.checked || false;
        saveDemoSession('admin', 'admin', false, rememberMe);
        setUserRole('admin');
        document.getElementById("modal-auth").classList.remove("active");

        // Golire date reziduale din sesiunile anterioare — admin vede mereu date proprii, goale
        ZFlowStore.dateLocal = [];
        ZFlowStore.dateFacturiBI = [];
        ZFlowStore.dateFurnizori = [];
        ZFlowStore.dateFacturiPlatit = [];
        ZFlowStore.dateProduse = [];
        ZFlowStore.dateMiscariStoc = [];
        ZFlowStore.dateReceptii = [];
        ZFlowStore.dateLivrari = [];
        ZFlowStore.dateSoferi = [];
        ZFlowStore.dateVehicule = [];
        ZFlowStore.dateComenziTransport = [];
        ZFlowStore.userProfile = null;

        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');

        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';

        ZFlowAuth.resetAttempts();
        showNotification('Bun venit, Admin! Acces complet activat.', 'success');
        setLoader(false);
        init();
        return;
    }

    // DEMO USER: Aplicație cu date temporare (prezentare către clienți)
    if (email === "user" && pass === "pass") {
        ZFlowStore.userSession = { user: { email: 'user' }, isDemo: true };
        const rememberMeDemo = document.getElementById('auth-remember')?.checked || false;
        saveDemoSession('user', 'demo_user', true, rememberMeDemo);
        setUserRole('demo_user');  // Acces complet — date salvate doar în sesiune
        document.getElementById("modal-auth").classList.remove("active");

        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');

        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';

        ZFlowAuth.resetAttempts();
        showNotification('Mod Prezentare — Date temporare (se șterg la delogare)', 'info');
        setLoader(false);
        init();
        return;
    }
    
    try {
        // Încearcă autentificare Supabase
        const { session, user } = await ZFlowDB.signIn(email, pass);
        
        ZFlowStore.userSession = session;
        setUserRole('user'); // Supabase users primesc permisiuni complete
        document.getElementById("modal-auth").classList.remove("active");
        
        // Afișează interfața după autentificare reușită
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';
        
        ZFlowAuth.resetAttempts(); // Reset rate limit la succes
        showNotification(`Bun venit, ${user.email}!`, "success");

        // [R7-FIX 5a] Consumă token pending dacă există (înregistrare cu email confirmation activ)
        const _pendingToken = localStorage.getItem('zflow_pending_token');
        if (_pendingToken) {
            try {
                await ZFlowDB.consumeSubscriptionToken(_pendingToken, user.email, null);
                localStorage.removeItem('zflow_pending_token');
            } catch(_) {}
        }

        // [R7-FIX 5c] Aplică planul pending (stocat la înregistrare când sesiunea lipsea)
        const _pendingPlan = localStorage.getItem('zflow_pending_plan');
        if (_pendingPlan) {
            try {
                const _planInfo = JSON.parse(_pendingPlan);
                await ZFlowDB.upsertProfile(_planInfo);
                localStorage.removeItem('zflow_pending_plan');
            } catch(_planErr) {
                ZFlowLogger.warn('app', '[Login] Aplicare plan pending non-fatală:', _planErr.message);
            }
        }

        // [R7-FIX 5b] Verifică dacă abonamentul a expirat
        try {
            const _profil = await ZFlowDB.fetchProfile();
            if (_profil) {
                ZFlowStore.userProfile = _profil;
                if (_profil.subscription_expires_at) {
                    const _expDate = new Date(_profil.subscription_expires_at);
                    const _acum    = new Date();
                    if (_expDate < _acum) {
                        await ZFlowDB.signOut();
                        ZFlowStore.userSession = null;
                        if (typeof _adminUsersCache !== 'undefined') _adminUsersCache = null;
                        document.querySelector('main').style.display        = 'none';
                        document.querySelector('header').style.display      = 'none';
                        document.querySelector('.bottom-nav').style.display = 'none';
                        document.getElementById("modal-auth")?.classList.add("active");
                        showNotification(
                            `Abonamentul a expirat pe ${_expDate.toLocaleDateString('ro-RO')}. Contactează echipa Z-FLOW pentru reînnoire.`,
                            'error'
                        );
                        setLoader(false);
                        return;
                    }
                    const _zileRamase = Math.ceil((_expDate - _acum) / (1000 * 60 * 60 * 24));
                    if (_zileRamase <= 14) {
                        setTimeout(() => showNotification(
                            `Atenție: abonamentul expiră în ${_zileRamase} zile (${_expDate.toLocaleDateString('ro-RO')})`,
                            'warning'
                        ), 3000);
                    }
                }
            }
        } catch(_subErr) {
            ZFlowLogger.warn('app', '[Login] Verificare abonament non-fatală:', _subErr.message);
        }

        // [FIX 2] Verifică modul mentenanță și după login Supabase (poate fi activat în timp ce userul era pe pagina de login)
        try {
            const remoteState = await ZFlowDB.getSetAppConfig('maintenance_mode').catch(() => null);
            if (remoteState !== null) localStorage.setItem(MAINTENANCE_LS_KEY, JSON.stringify(remoteState));
            checkAndApplyMaintenanceMode();
        } catch(e) {}
        await verificaOnboarding(user);
    } catch (error) {
        ZFlowLogger.error('app', "Auth error:", error);
        ZFlowAuth.recordFailedAttempt(); // Înregistrează încercare eșuată
        
        // Mesaje de eroare prietenoase
        let errorMsg = "Eroare la autentificare";
        if (error.message.includes("Invalid login")) {
            errorMsg = "Email sau parolă incorectă";
        } else if (error.message.includes("Email not confirmed")) {
            errorMsg = "Confirmă email-ul înainte de autentificare";
        } else if (error.message.includes("Too many requests")) {
            errorMsg = "Prea multe încercări. Așteaptă puțin.";
        }
        
        showNotification(errorMsg, "error");
        // Afișează eroarea și în div-ul vizibil din modal
        const errDiv = document.getElementById('auth-error-msg');
        const errTxt = document.getElementById('auth-error-text');
        if (errDiv && errTxt) { errTxt.textContent = errorMsg; errDiv.classList.remove('hidden'); }
        setLoader(false);
    }
}

/**
 * Deconectare utilizator (Supabase Auth + Demo)
 */
function confirmaLogout() {
    showConfirmModal(
        "Ești sigur că dorești să te deconectezi? Sesiunea curentă va fi închisă.",
        logout
    );
}

async function logout() {
    setLoader(true);
    
    try {
        // Șterge sesiunea demo dacă există
        localStorage.removeItem("zflow_demo_session");
        
        // Încearcă deconectare Supabase (dacă nu e sesiune demo)
        if (ZFlowStore.userSession && !ZFlowStore.userSession.isDemo) {
            try { ZFlowDB.stopRealtimeSubscriptions(); } catch(e) {}
            await ZFlowDB.signOut();
        }
        
        ZFlowStore.userSession = null;
        if (typeof _adminUsersCache !== 'undefined') _adminUsersCache = null;

        // [FIX 4] Resetează cache-ul intern _demoOps._restoreCache pentru a permite
        // re-încărcarea datelor admin local la re-login (altfel _restore() returnează
        // imediat fără să citească din localStorage, lăsând datele goale)
        if (typeof ZFlowDB !== 'undefined' && ZFlowDB.resetLocalSession) ZFlowDB.resetLocalSession();

        // Curăță datele demo din memorie — izolează sesiunile (evită afișarea datelor din sesiunea anterioară)
        const _demoStoreKeys = ['_demoClienti','_demoFacturi','_demoFurnizori','_demoFacturiPlatit',
            '_demoProduse','_demoMiscariStoc','_demoReceptii','_demoLivrari',
            '_demoSoferi','_demoVehicule','_demoComenziTransport'];
        _demoStoreKeys.forEach(k => { delete ZFlowStore[k]; });
        // Resetează listele principale de date
        ZFlowStore.dateLocal = [];
        ZFlowStore.dateFacturiBI = [];
        ZFlowStore.dateFurnizori = [];
        ZFlowStore.dateFacturiPlatit = [];
        // Resetează depozit
        ZFlowStore.dateProduse = [];
        ZFlowStore.dateMiscariStoc = [];
        ZFlowStore.dateReceptii = [];
        ZFlowStore.dateLivrari = [];
        // Resetează logistic
        ZFlowStore.dateSoferi = [];
        ZFlowStore.dateVehicule = [];
        ZFlowStore.dateComenziTransport = [];
        ZFlowStore.userProfile = null;

        // [R5-FIX 3] NU ștergăm IDB-ul la logout — datele rămân ca cache pentru
        // re-login rapid. IDB-ul e per-browser, nu conține date sensibile că sunt
        // protejate de RLS în Supabase. La re-login, fetch-ul Supabase suprascrie IDB.
        // IDB se șterge DOAR la cerere explicită (buton "Golire cache" din profil).
        ZFlowLogger.debug('app', '[Logout] Cache IDB păstrat pentru re-login rapid'); // [R5-FIX 3]

        // Ascunde interfața
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = 'none';
        if (header) header.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabMenu) fabMenu.style.display = 'none';
        
        // Curăță câmpurile de autentificare
        document.getElementById("auth-username").value = '';
        document.getElementById("auth-password").value = '';
        
        // Afișează modalul de autentificare
        document.getElementById("modal-auth").classList.add("active");
        
        showNotification("Deconectat cu succes!", "info");
    } catch (error) {
        ZFlowLogger.error('app', "Logout error:", error);
        showNotification("Eroare la deconectare", "error");
    } finally {
        setLoader(false);
    }
}

// [R5-FIX 3] Permite utilizatorului să golească manual cache-ul IDB
async function clearIDBCache() {
    try {
        await ZFlowIDB.clearAll();
        showNotification('Cache local șters. La next refresh datele se re-descarcă din cloud.', 'info');
    } catch(e) {
        showNotification('Eroare la golirea cache-ului', 'error');
    }
}
window.clearIDBCache = clearIDBCache;

/**
 * Deschide modalul de înregistrare
 */
function deschideModalInregistrare() {
    // Ascunde bannerul de verificare email dacă era afișat
    document.getElementById('auth-verify-banner')?.classList.add('hidden');
    document.getElementById("modal-auth").classList.remove("active");
    document.getElementById("modal-register").classList.add("active");
}

/**
 * Deschide modalul de reset parolă
 */
function deschideModalResetParola() {
    document.getElementById("modal-auth").classList.remove("active");
    document.getElementById("modal-reset-password").classList.add("active");
}

/**
 * [R7-FIX 4] Înregistrare utilizator nou cu plan de subscripție.
 * Flux: validare token → plan info → signUp → consume token → salvare profil cu plan
 */
async function inregistrareUtilizator() {
    const email    = document.getElementById("reg-email")?.value.trim();
    const pass     = document.getElementById("reg-password")?.value;
    const passConf = document.getElementById("reg-password-confirm")?.value;
    const nume     = document.getElementById("reg-nume")?.value.trim();
    const codToken = document.getElementById("reg-subscription-code")?.value.trim().toUpperCase();

    if (!email || !pass)         { showNotification("Completează toate câmpurile obligatorii", "error"); return; }
    if (pass !== passConf)       { showNotification("Parolele nu coincid", "error"); return; }
    if (pass.length < 6)         { showNotification("Parola trebuie să aibă minim 6 caractere", "error"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showNotification("Email invalid", "error"); return; }
    if (!codToken)               { showNotification("Codul de abonament este obligatoriu", "error"); return; }

    setLoader(true);
    try {
        // PASUL 1: Validează tokenul și obține planul
        const tokenInfo = await ZFlowDB.validateSubscriptionToken(codToken);
        if (!tokenInfo) {
            showNotification("Cod abonament invalid, expirat sau deja folosit", "error");
            setLoader(false);
            return;
        }

        const planLabels = { trial: 'Trial 30 zile', standard: 'Standard 1 an', pro: 'Pro 1 an', enterprise: 'Enterprise' };
        const planLabel  = planLabels[tokenInfo.plan_type] || tokenInfo.plan_type;

        // PASUL 2: Calculează data expirării
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (tokenInfo.duration_days || 365));

        // PASUL 3: Creează contul în Supabase Auth
        await ZFlowDB.signUp(email, pass, { full_name: nume || email, plan_type: tokenInfo.plan_type });

        // PASUL 4: Consume token (cu autentificare automată)
        await ZFlowDB.consumeSubscriptionToken(codToken, email, pass);

        // Salvează info plan în localStorage — va fi aplicat la primul login
        // (necesar când email confirmation e activă și PASUL 5 nu are sesiune)
        localStorage.setItem('zflow_pending_plan', JSON.stringify({
            display_name: nume || null,
            plan_type: tokenInfo.plan_type,
            subscription_expires_at: expiresAt.toISOString(),
            subscription_token: codToken
        }));

        // PASUL 5: Salvează planul în profil
        try {
            await ZFlowDB.upsertProfile({
                display_name: nume || null,
                plan_type: tokenInfo.plan_type,
                subscription_expires_at: expiresAt.toISOString(),
                subscription_token: codToken
            });
        } catch(profileErr) {
            ZFlowLogger.warn('app', '[Register] Profil plan se va salva la onboarding:', profileErr.message);
        }

        // Curăță câmpurile
        ['reg-email','reg-password','reg-password-confirm','reg-nume','reg-subscription-code']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

        document.getElementById("modal-register")?.classList.remove("active");
        document.getElementById("modal-auth")?.classList.add("active");
        // Arată banner de confirmare email în modalul de login
        const _verifBanner = document.getElementById('auth-verify-banner');
        const _verifEmail  = document.getElementById('auth-verify-email');
        if (_verifBanner) _verifBanner.classList.remove('hidden');
        if (_verifEmail)  _verifEmail.textContent = email;
        showNotification(`Cont creat! Plan: ${planLabel}. Verifică email-ul pentru confirmare.`, "success", 6000);

    } catch (error) {
        ZFlowLogger.error('app', "Register error:", error);
        let errorMsg = "Eroare la înregistrare";
        if (error.message?.includes("already registered") || error.message?.includes("already been registered")) {
            errorMsg = "Acest email este deja înregistrat";
        } else if (error.message?.includes("Password")) {
            errorMsg = "Parola prea slabă — încearcă una mai complexă";
        }
        showNotification(errorMsg, "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Trimite email pentru reset parolă
 */
async function trimiteResetParola() {
    const email = document.getElementById("reset-email").value.trim();
    
    if (!email) {
        showNotification("Introdu adresa de email", "error");
        return;
    }
    
    setLoader(true);
    
    try {
        await ZFlowDB.resetPassword(email);
        
        document.getElementById("modal-reset-password").classList.remove("active");
        document.getElementById("modal-auth").classList.add("active");
        
        document.getElementById("reset-email").value = '';
        
        showNotification("Email trimis! Verifică-ți căsuța.", "success");
    } catch (error) {
        ZFlowLogger.error('app', "Reset password error:", error);
        showNotification("Eroare la trimiterea email-ului", "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Schimbă email-ul și/sau parola contului Supabase curent
 */
async function schimbaDateCont() {
    const email = document.getElementById('cont-nou-email')?.value.trim();
    const parola = document.getElementById('cont-nou-parola')?.value;
    const parolaConfirm = document.getElementById('cont-nou-parola-confirm')?.value;

    const errDiv = document.getElementById('schimba-cont-error');
    const errTxt = document.getElementById('schimba-cont-error-text');
    if (errDiv) errDiv.classList.add('hidden');

    if (!email && !parola) {
        if (errDiv && errTxt) { errTxt.textContent = 'Completează cel puțin un câmp.'; errDiv.classList.remove('hidden'); }
        return;
    }
    if (parola && parola !== parolaConfirm) {
        if (errDiv && errTxt) { errTxt.textContent = 'Parolele nu coincid.'; errDiv.classList.remove('hidden'); }
        return;
    }
    if (parola && parola.length < 6) {
        if (errDiv && errTxt) { errTxt.textContent = 'Parola minim 6 caractere.'; errDiv.classList.remove('hidden'); }
        return;
    }

    setLoader(true);
    try {
        const isAdmin = ZFlowStore.userSession?.user?.email === 'admin';

        if (isAdmin) {
            // Admin local: salvează parola nouă în localStorage
            if (parola) localStorage.setItem('zflow_ad_admin_password', parola);
            document.getElementById('modal-schimba-cont').classList.remove('active');
            document.getElementById('cont-nou-parola').value = '';
            document.getElementById('cont-nou-parola-confirm').value = '';
            showNotification('Parolă admin actualizată! Activ la următorul login.', 'success');
            setLoader(false);
            return;
        }

        const updates = {};
        if (email) updates.email = email;
        if (parola) updates.password = parola;
        await ZFlowDB.updateUser(updates);

        document.getElementById('modal-schimba-cont').classList.remove('active');
        document.getElementById('cont-nou-email').value = '';
        document.getElementById('cont-nou-parola').value = '';
        document.getElementById('cont-nou-parola-confirm').value = '';

        const msg = email
            ? 'Date cont actualizate! Dacă ai schimbat emailul, verifică noul inbox pentru confirmare.'
            : 'Parolă actualizată cu succes!';
        showNotification(msg, 'success');
    } catch (err) {
        ZFlowLogger.error('app', 'schimbaDateCont error:', err);
        const msg = err.message || 'Eroare necunoscută';
        if (errDiv && errTxt) { errTxt.textContent = msg; errDiv.classList.remove('hidden'); }
    } finally {
        setLoader(false);
    }
}

/**
 * Închide modalul de înregistrare și revine la login
 */
function inchideModalRegister() {
    document.getElementById("modal-register").classList.remove("active");
    document.getElementById("modal-auth").classList.add("active");
}

/**
 * Închide modalul de reset parolă și revine la login
 */
function inchideModalResetPassword() {
    document.getElementById("modal-reset-password").classList.remove("active");
    document.getElementById("modal-auth").classList.add("active");
}

// ==========================================
// ONBOARDING & PROFIL FIRMĂ
// ==========================================

/**
 * Verifică după login dacă userul a completat onboarding-ul.
 * Dacă nu, arată modalul de onboarding; altfel pornește app normal.
 * @param {Object} user - Obiectul user Supabase
 */
async function verificaOnboarding(user) {
    try {
        const profile = await ZFlowDB.fetchProfile();
        ZFlowStore.userProfile = profile;

        if (!profile || !profile.onboarding_done) {
            // Pre-populează email-ul dacă e disponibil
            const emailInput = document.getElementById('ob-email');
            if (emailInput && user?.email) emailInput.value = user.email;

            // Dacă are deja date parțiale, le reafisăm
            if (profile) {
                const f = (id) => document.getElementById(id);
                if (f('ob-cui'))              f('ob-cui').value              = profile.cui || '';
                if (f('ob-nume-firma'))       f('ob-nume-firma').value       = profile.nume_firma || '';
                if (f('ob-oras'))             f('ob-oras').value             = profile.oras || '';
                if (f('ob-adresa'))           f('ob-adresa').value           = profile.adresa || '';
                if (f('ob-telefon'))          f('ob-telefon').value          = profile.telefon || '';
                if (f('ob-persoana-contact')) f('ob-persoana-contact').value = profile.persoana_contact || '';
                if (f('ob-email'))            f('ob-email').value            = profile.email || user?.email || '';
                if (f('ob-iban'))             f('ob-iban').value             = profile.iban || '';
            }

            document.getElementById('modal-onboarding').classList.add('active');
        } else {
            // Onboarding terminat, intră în aplicație
            init();
        }
    } catch (err) {
        ZFlowLogger.warn('app', 'verificaOnboarding error:', err);
        // în caz de eroare, intrăm oricum în aplicație
        init();
    }
}

/**
 * Salvează datele firmei din modalul de onboarding
 */
async function salveazaProfilOnboarding() {
    const cui       = document.getElementById('ob-cui')?.value.trim();
    const numeFirma = document.getElementById('ob-nume-firma')?.value.trim();

    if (!cui || !numeFirma) {
        showNotification('Completează CUI-ul și denumirea firmei', 'error');
        return;
    }

    setLoader(true);
    try {
        const payload = {
            cui,
            nume_firma:       numeFirma,
            oras:             document.getElementById('ob-oras')?.value.trim()             || null,
            adresa:           document.getElementById('ob-adresa')?.value.trim()           || null,
            telefon:          document.getElementById('ob-telefon')?.value.trim()          || null,
            persoana_contact: document.getElementById('ob-persoana-contact')?.value.trim() || null,
            email:            document.getElementById('ob-email')?.value.trim()            || null,
            iban:             document.getElementById('ob-iban')?.value.trim()             || null,
            onboarding_done: true
        };

        await ZFlowDB.upsertProfile(payload);
        ZFlowStore.userProfile = { ...ZFlowStore.userProfile, ...payload };

        document.getElementById('modal-onboarding').classList.remove('active');
        showNotification('Profil salvat! Bun venit în Z-FLOW!', 'success');
        init();
    } catch (err) {
        ZFlowLogger.error('app', 'salveazaProfilOnboarding error:', err);
        showNotification('Eroare la salvare: ' + err.message, 'error');
    } finally {
        setLoader(false);
    }
}

/**
 * Sare onboarding-ul (nu marca onboarding_done = true)
 */
function salteOnboarding() {
    document.getElementById('modal-onboarding').classList.remove('active');
    init();
}

/**
 * Deschide modalul de editare profil firmă
 */
async function deschideProfilFirma() {
    // Nu e disponibil pentru sesiuni demo (exclud admin și demo_user)
    if (ZFlowStore.userSession?.isDemo && !['admin','demo_user'].includes(ZFlowStore.userRole)) {
        showNotification('Profilul firmei nu e disponibil în modul demo', 'warning');
        return;
    }

    setLoader(true);
    try {
        const profile = await ZFlowDB.fetchProfile();
        // Nu reseta profilul din memorie dacă deja există (evită pierderea datelor la re-deschidere modal)
        if (profile) ZFlowStore.userProfile = profile;

        // Restaurează preferința "Dată implicită = Azi"
        const prefDataAzi = localStorage.getItem('zflow_pref_data_azi');
        const prefEl = document.getElementById('pref-data-azi');
        if (prefEl) prefEl.checked = prefDataAzi !== '0'; // default ON

        const f = (id) => document.getElementById(id);

        // Afișează email-ul contului (read-only) — fallback sigur pentru admin local
        const emailDisplay = f('profil-email-display');
        if (emailDisplay) {
            try {
                const session = await ZFlowDB.getSession();
                emailDisplay.textContent = session?.user?.email
                    || ZFlowStore.userSession?.user?.email
                    || '—';
            } catch (_) {
                // Admin local: nu are sesiune Supabase, afișăm emailul din store
                emailDisplay.textContent = ZFlowStore.userSession?.user?.email || '—';
            }
        }

        const profileToLoad = ZFlowStore.userProfile;
        if (profileToLoad) {
            if (f('pf-cui'))    f('pf-cui').value    = profileToLoad.cui || '';
            if (f('pf-nome'))   f('pf-nome').value   = profileToLoad.nume_firma || '';
            if (f('pf-adresa')) f('pf-adresa').value = profileToLoad.adresa || '';
            if (f('pf-oras'))   f('pf-oras').value   = profileToLoad.oras || '';
            if (f('pf-judet'))  f('pf-judet').value  = profileToLoad.judet || '';
            if (f('pf-regcom')) f('pf-regcom').value = profileToLoad.reg_com || '';
            if (f('pf-iban'))   f('pf-iban').value   = profileToLoad.iban || '';
            if (f('pf-banca'))  f('pf-banca').value  = profileToLoad.banca || '';
            if (f('pf-tel'))    f('pf-tel').value    = profileToLoad.telefon || '';
            if (f('pf-email'))  f('pf-email').value  = profileToLoad.email || '';
        }

        // Afișează secțiunea de acțiuni în funcție de tipul de cont
        const adminSection = document.getElementById('admin-delete-section');
        if (adminSection) {
            const email = ZFlowStore.userSession?.user?.email || '';
            const isAdminLocal = email === 'admin';
            const isDemo = ZFlowStore.userSession?.isDemo === true;
            const isSupabaseUser = !isAdminLocal && !isDemo;

            // Secțiunea e vizibilă pentru admin și utilizatorii Supabase reali, nu pentru demo
            adminSection.classList.toggle('hidden', isDemo);

            // Elementele [data-admin-only] sunt vizibile DOAR pentru admin local
            adminSection.querySelectorAll('[data-admin-only]').forEach(el => {
                el.classList.toggle('hidden', !isAdminLocal);
            });
            // Ascunde elemente irelevante în modul admin (tab Financiar/Firme, Profil Firmă)
            aplicaUIAdmin();
            // Bug #6: Ascunde formularul detalii firmă și Firmele Mele pentru admin
            const pfFirmaForm = document.getElementById('pf-firma-form');
            const pfFirmeMeleSection = document.getElementById('pf-firme-mele-section');
            if (pfFirmaForm) pfFirmaForm.classList.toggle('hidden', isAdminLocal);
            if (pfFirmeMeleSection) pfFirmeMeleSection.classList.toggle('hidden', isAdminLocal);
            // Elementele [data-supabase-only] sunt vizibile DOAR pentru useri Supabase reali
            adminSection.querySelectorAll('[data-supabase-only]').forEach(el => {
                el.classList.toggle('hidden', !isSupabaseUser);
            });
            // Elementele [data-account-only] sunt vizibile pentru admin și Supabase (nu demo)
            adminSection.querySelectorAll('[data-account-only]').forEach(el => {
                el.classList.toggle('hidden', isDemo);
            });
        }

        document.getElementById('modal-profil-firma').classList.add('active');
        // Populare secțiune Firmele Mele integrată în modal
        if (window.ZFlowMultiFirma) window.ZFlowMultiFirma.renderPanel('pf-firme-content');
    } catch (err) {
        ZFlowLogger.error('app', 'deschideProfilFirma error:', err);
        showNotification('Eroare la încărcarea profilului', 'error');
    } finally {
        setLoader(false);
    }
}

/**
 * Închide modalul de profil firmă
 */
/**
 * [R8-FIX 3] Panou admin utilizatori — înlocuiește prompt() cu modal dedicat
 */
async function deschideAdminUserPanel() {
    const section = document.getElementById('admin-user-search-section');
    if (!section) return;
    // Reset stare
    const emailInput = document.getElementById('admin-target-email');
    const resultDiv  = document.getElementById('admin-user-result');
    if (emailInput) emailInput.value = '';
    if (resultDiv)  resultDiv.classList.add('hidden');
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.deschideAdminUserPanel = deschideAdminUserPanel;

async function adminCautaUtilizator() {
    const email = document.getElementById('admin-target-email')?.value.trim();
    if (!email || !email.includes('@')) {
        showNotification('Introdu un email valid', 'error');
        return;
    }
    setLoader(true);
    try {
        const userData = await ZFlowDB.adminGetUserData(email);
        const resultDiv = document.getElementById('admin-user-result');
        const infoDiv   = document.getElementById('admin-user-info');
        if (!userData) {
            showNotification(`Utilizatorul ${email} nu a fost găsit`, 'warning');
            return;
        }
        if (infoDiv) {
            infoDiv.innerHTML = `
                <p class="text-xs font-bold text-slate-700">📧 ${escapeHtml(userData.email || email)}</p>
                <p class="text-[10px] text-slate-400 font-mono mt-0.5">ID: ${escapeHtml(userData.id || 'necunoscut')}</p>`;
        }
        // Salvează datele pentru acțiunile ulterioare
        if (resultDiv) {
            resultDiv.dataset.userId  = userData.id || '';
            resultDiv.dataset.email   = userData.email || email;
            resultDiv.classList.remove('hidden');
        }
        // Actualizează hint-ul de confirmare cu emailul real
        const hintEl = document.getElementById('admin-delete-hint');
        const confirmInput = document.getElementById('admin-delete-confirm');
        if (hintEl) hintEl.textContent = `STERGE ${userData.email || email}`;
        if (confirmInput) confirmInput.placeholder = `STERGE ${userData.email || email}`;
    } catch(e) {
        showNotification('Eroare căutare: ' + e.message, 'error');
    } finally {
        setLoader(false);
    }
}
window.adminCautaUtilizator = adminCautaUtilizator;

async function adminTrimiteNotificare() {
    const resultDiv = document.getElementById('admin-user-result');
    const email     = resultDiv?.dataset.email;
    const mesaj     = document.getElementById('admin-notif-text')?.value.trim();
    if (!email || !mesaj) { showNotification('Email și mesaj obligatorii', 'error'); return; }
    setLoader(true);
    try {
        const ok = await ZFlowDB.adminSendNotification(email, mesaj);
        showNotification(ok ? `Notificare trimisă către ${email}` : 'Eroare la trimitere', ok ? 'success' : 'error');
        if (ok) document.getElementById('admin-notif-text').value = '';
    } catch(e) {
        showNotification('Eroare: ' + e.message, 'error');
    } finally {
        setLoader(false);
    }
}
window.adminTrimiteNotificare = adminTrimiteNotificare;

async function adminStergeDate() {
    const panel     = document.getElementById('admin-delete-panel');
    const email     = panel?.dataset.email;
    if (!email) { showNotification('Deschide panoul de ștergere din cardul utilizatorului', 'error'); return; }
    const confirmEl = document.getElementById('admin-delete-confirm');
    if (confirmEl?.value !== `STERGE ${email}`) {
        showNotification(`Scrie exact: STERGE ${email}`, 'error');
        return;
    }
    setLoader(true);
    try {
        let userId = panel?.dataset.userId;
        if (!userId) {
            const ud = await ZFlowDB.adminGetUserData(email);
            userId = ud?.id;
        }
        if (!userId) { showNotification('ID utilizator negăsit', 'error'); return; }
        const rezultate = await ZFlowDB.adminDeleteUserData(userId);
        const reusite   = Object.values(rezultate).filter(r => r.success).length;
        const erori     = Object.values(rezultate).filter(r => !r.success).length;
        showNotification(
            `Date șterse: ${reusite} tabele OK${erori > 0 ? `, ${erori} erori` : ''}`,
            erori > 0 ? 'warning' : 'success'
        );
        if (panel) panel.classList.add('hidden');
        await reincarcaUseriAdmin();
    } catch(e) {
        showNotification('Eroare ștergere: ' + e.message, 'error');
    } finally {
        setLoader(false);
    }
}
window.adminStergeDate = adminStergeDate;

function adminDeschideStergere(email, userId) {
    const panel     = document.getElementById('admin-delete-panel');
    const emailEl   = document.getElementById('admin-delete-email');
    const hintEl    = document.getElementById('admin-delete-hint');
    const confirmEl = document.getElementById('admin-delete-confirm');
    if (!panel) return;
    if (emailEl)   emailEl.value = email;
    if (hintEl)    hintEl.textContent = `STERGE ${email}`;
    if (confirmEl) { confirmEl.value = ''; confirmEl.placeholder = `STERGE ${email}`; }
    panel.dataset.email = email;
    if (userId) panel.dataset.userId = userId;
    else delete panel.dataset.userId;
    // Ascunde celelalte pannouri pentru claritate
    document.getElementById('admin-extend-panel')?.classList.add('hidden');
    document.getElementById('admin-notif-panel')?.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.adminDeschideStergere = adminDeschideStergere;

function adminFiltreazaUseri(val) {
    if (!_adminUsersCache) return;
    const q = (val || '').toLowerCase().trim();
    const filtered = q
        ? _adminUsersCache.filter(u =>
            (u.email || '').toLowerCase().includes(q) ||
            (u.display_name || '').toLowerCase().includes(q))
        : _adminUsersCache;
    renderAdminUsersList(filtered);
}
window.adminFiltreazaUseri = adminFiltreazaUseri;

function inchideAdminUsers() {
    document.getElementById('admin-user-search-section')?.classList.add('hidden');
}
window.inchideAdminUsers = inchideAdminUsers;

/**
 * [R7-FIX 6] Generator tokeni abonament — doar pentru admin local
 */
async function genereazaTokenAdmin() {
    const plan  = document.getElementById('admin-token-plan')?.value || 'standard';
    const zile  = parseInt(document.getElementById('admin-token-zile')?.value || '365');
    const nota  = document.getElementById('admin-token-nota')?.value.trim() || null;
    const pfx   = { trial: 'TRL', standard: 'STD', pro: 'PRO', enterprise: 'ENT' }[plan] || 'STD';
    const rnd   = Math.random().toString(36).substring(2, 7).toUpperCase();
    const token = `ZFLOW-${pfx}-${new Date().getFullYear()}-${rnd}`;
    const exp   = new Date(); exp.setFullYear(exp.getFullYear() + 1);

    setLoader(true);
    try {
        const { error } = await ZFlowDB._supabase()
            .from('subscription_tokens')
            .insert([{ token, plan_type: plan, duration_days: zile, expires_at: exp.toISOString(), notes: nota }]);
        if (error) throw new Error(error.message);
        const outEl = document.getElementById('admin-token-output');
        const boxEl = document.getElementById('admin-token-result');
        if (outEl) outEl.textContent = token;
        if (boxEl) boxEl.classList.remove('hidden');
        const nota2El = document.getElementById('admin-token-nota');
        if (nota2El) nota2El.value = '';
        showNotification(`Token generat: ${token}`, 'success');
    } catch(e) {
        showNotification('Eroare generare token: ' + e.message, 'error');
    } finally {
        setLoader(false);
    }
}
window.genereazaTokenAdmin = genereazaTokenAdmin;

/**
 * [R8-FIX 1] Sincronizează câmpul "zile" cu planul selectat din dropdown.
 * Apelat de onchange pe #admin-token-plan.
 */
function sincronizeazaZilePlan(plan) {
    const zilePlanMap = { trial: 30, standard: 365, pro: 365, enterprise: 365 };
    const zileEl = document.getElementById('admin-token-zile');
    if (zileEl) zileEl.value = zilePlanMap[plan] || 365;
    // Ascunde rezultatul anterior când se schimbă planul
    const boxEl = document.getElementById('admin-token-result');
    if (boxEl) boxEl.classList.add('hidden');
}
window.sincronizeazaZilePlan = sincronizeazaZilePlan;

function inchideProfilFirma() {
    document.getElementById('modal-profil-firma').classList.remove('active');
}

/**
 * Salvează modificările din modalul de profil firmă
 */
async function salveazaProfilFirma() {
    const cui       = document.getElementById('pf-cui')?.value.trim();
    const numeFirma = document.getElementById('pf-nome')?.value.trim();

    if (!cui || !numeFirma) {
        showNotification('Completează CUI-ul și denumirea firmei', 'error');
        return;
    }

    setLoader(true);
    try {
        const payload = {
            cui,
            nume_firma: numeFirma,
            oras:       document.getElementById('pf-oras')?.value.trim()   || null,
            adresa:     document.getElementById('pf-adresa')?.value.trim() || null,
            judet:      document.getElementById('pf-judet')?.value.trim()  || null,
            reg_com:    document.getElementById('pf-regcom')?.value.trim() || null,
            iban:       document.getElementById('pf-iban')?.value.trim()   || null,
            banca:      document.getElementById('pf-banca')?.value.trim()  || null,
            telefon:    document.getElementById('pf-tel')?.value.trim()    || null,
            email:      document.getElementById('pf-email')?.value.trim()  || null,
            onboarding_done: true
        };

        await ZFlowDB.upsertProfile(payload);
        ZFlowStore.userProfile = { ...ZFlowStore.userProfile, ...payload };

        // Actualizează header-ul firmei din home imediat
        const _setH = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        const _p = ZFlowStore.userProfile;
        if (_p) { _setH("home-firma-nume", _p.nume_firma || "—"); _setH("home-firma-cui", _p.cui ? "CUI: " + _p.cui : ""); _setH("home-firma-oras", _p.oras || ""); _setH("home-firma-initiale", (_p.nume_firma||"ZF").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()); }

        inchideProfilFirma();
        showNotification('Profil actualizat cu succes!', 'success');
    } catch (err) {
        ZFlowLogger.error('app', 'salveazaProfilFirma error:', err);
        showNotification('Eroare la salvare: ' + err.message, 'error');
    } finally {
        setLoader(false);
    }
}

/**
 * Update date labels pentru filtre perioadă
 */
function updateDateLabels() {
    ["data-start", "data-end"].forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            // onchange = assignment evită acumularea de listeners la fiecare init()
            input.onchange = function () {
                const labelId = id === "data-start" ? "label-start" : "label-end";
                const prefix = id === "data-start" ? "DE LA: " : "PÂNĂ LA: ";
                const defaultText = id === "data-start" ? "De la: --" : "Până la: --";
                const labelEl = document.getElementById(labelId);
                if (this.value && labelEl) {
                    labelEl.innerText = prefix + formateazaDataZFlow(this.value);
                    labelEl.parentElement.classList.add("border-blue-200");
                    const startVal = document.getElementById("data-start")?.value;
                    const endVal = document.getElementById("data-end")?.value;
                    // Salvează intervalul în store (persistă la navigare) — datele rămân vizibile
                    if (startVal) ZFlowStore.biStartVal = startVal;
                    if (endVal) ZFlowStore.biEndVal = endVal;
                } else if (labelEl) {
                    labelEl.innerText = defaultText;
                    labelEl.parentElement.classList.remove("border-blue-200");
                    // Resetează valoarea din store dacă câmpul e golit manual
                    if (id === "data-start") ZFlowStore.biStartVal = null;
                    if (id === "data-end") ZFlowStore.biEndVal = null;
                }
                genereazaBI();
            };
        }
    });
}

// ==========================================
// NAVIGARE UI
// ==========================================

/**
 * Schimbă tab-ul principal
 */
function schimbaTab(id, btn) {
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.querySelectorAll(".nav-item").forEach((l) => l.classList.remove("active"));
    if (btn) btn.classList.add("active");

    if (id === 'depozit') {
        if (typeof renderDepozit === 'function') renderDepozit();
    }

    if (id === 'logistic') {
        if (typeof renderLogistic === 'function') renderLogistic();
        // Nu inițializa harta aici — #map e în logistic-view-vehicule care e hidden implicit.
        // L.map() inițializat pe un container display:none are dimensiune 0×0 și nu încarcă tile-uri.
        // initMap() rulează din schimbaViewLogistic('vehicule') când div-ul e deja vizibil.
    }
    // initScanner() este apelat doar când utilizatorul navighează explicit la view-ul Scanner din depozit

    const btnActions = document.getElementById("nav-btn-actions");
    if (btnActions) {
        if (id === "financiar") {
            const esteInDetalii = !document.getElementById("view-detalii").classList.contains("hidden");
            const esteInDetaliiFurnizor = !document.getElementById("view-detalii-furnizor").classList.contains("hidden");
            btnActions.style.display = "flex";
            if (esteInDetalii) {
                btnActions.querySelector("span").innerText = "DOC NOU";
                btnActions.setAttribute("onclick", "deschideModalDirectFactura()");
                btnActions.classList.add("text-blue-600", "animate-pulse");
                btnActions.classList.remove("text-red-600");
            } else if (esteInDetaliiFurnizor) {
                btnActions.querySelector("span").innerText = "DOC NOU";
                btnActions.setAttribute("onclick", "deschideModalFacturaPlatit(ZFlowStore.selectedFurnizorId)");
                btnActions.classList.add("text-red-600", "animate-pulse");
                btnActions.classList.remove("text-blue-600");
            } else {
                btnActions.querySelector("span").innerText = "ACȚIUNI";
                btnActions.setAttribute("onclick", "toggleFAB()");
                btnActions.classList.remove("text-blue-600", "text-red-600", "animate-pulse");
            }
        } else {
            btnActions.style.display = "none";
        }
    }

    if (id === "home") { _dashboardHash = null; incarcaDashboard(); }

    ZFlowStore.currentTab = id;
}

/**
 * Comută vederea financiară
 */
function comutaVedereFin(v, pushState = true) {
    ["view-firme", "view-analiza", "view-detalii", "view-furnizori", "view-detalii-furnizor"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add("hidden");
            el.style.display = "";
        }
    });

    const vedereActiva = document.getElementById("view-" + v);
    if (vedereActiva) {
        vedereActiva.classList.remove("hidden");
    }

    // Buton ACȚIUNI vizibil DOAR când suntem pe tab-ul Financiar
    const btnActions = document.getElementById("nav-btn-actions");
    if (btnActions) {
        // Verificăm dacă suntem efectiv pe tab-ul Financiar
        const isOnFinanciarTab = document.getElementById("financiar")?.classList.contains("active");
        if (isOnFinanciarTab) {
            btnActions.style.display = "flex";
            if (v === "detalii") {
                btnActions.querySelector("span").innerText = "DOC NOU";
                btnActions.setAttribute("onclick", "deschideModalDirectFactura()");
                btnActions.classList.add("text-blue-600", "animate-pulse");
                btnActions.classList.remove("text-red-600");
            } else if (v === "detalii-furnizor") {
                btnActions.querySelector("span").innerText = "DOC NOU";
                btnActions.setAttribute("onclick", "deschideModalFacturaPlatit(ZFlowStore.selectedFurnizorId)");
                btnActions.classList.add("text-red-600", "animate-pulse");
                btnActions.classList.remove("text-blue-600");
            } else {
                btnActions.querySelector("span").innerText = "ACȚIUNI";
                btnActions.setAttribute("onclick", "toggleFAB()");
                btnActions.classList.remove("text-blue-600", "text-red-600", "animate-pulse");
            }
        } else {
            btnActions.style.display = "none";
        }
    }

    // Update vizual butoane Pill
    document.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
    if (v !== "detalii" && v !== "detalii-furnizor") {
        const btnActiv = document.getElementById("btn-" + v);
        if (btnActiv) btnActiv.classList.add("active");
    }

    if (v === "analiza") {
        // Auto-setează ultimele 30 de zile dacă nu există deja un interval ales
        const hasStart = document.getElementById("data-start")?.value || ZFlowStore.biStartVal;
        if (!hasStart) {
            setBIRange('30');  // setează de la 30 de zile în urmă până azi și cheamă genereazaBI()
        } else {
            genereazaBI();
        }
    }
    else if (v === "firme") {
        // Skeleton rapid dacă lista e goală (primul load sau după logout)
        if (typeof renderMain === 'function') {
            const ct = window._DOM?.listaFirme || document.getElementById('lista-firme-global');
            if (ct && (ZFlowStore.dateLocal || []).length === 0 && typeof showSkeletonLoader === 'function') {
                showSkeletonLoader(ct, 6, 'client');
            }
            renderMain();
        }
    }
    else if (v === "furnizori") {
        if (typeof renderFurnizori === 'function') {
            const ct = window._DOM?.listaFurnizori || document.getElementById('lista-furnizori-global');
            if (ct && (ZFlowStore.dateFurnizori || []).length === 0 && typeof showSkeletonLoader === 'function') {
                showSkeletonLoader(ct, 5, 'furnizor');
            }
            renderFurnizori();
        }
    }

    // Gestionare History API — URL curat, fără hash
    if (pushState) {
        history.pushState({ zflowView: v }, "", location.pathname);
    }

    ZFlowStore.currentView = v;
}

/**
 * Toggle FAB Menu
 */
function toggleFAB() {
    document.getElementById("fab-menu").classList.toggle("active");
}

/**
 * Setare rapidă interval date BI
 * @param {string} range - 'luna', '30', '90', '180', 'an', 'all'
 */
function setBIRange(range) {
    const azi = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    let start = null, end = fmt(azi);

    if (range === 'all') {
        start = null; end = null;
    } else if (range === 'luna') {
        start = fmt(new Date(azi.getFullYear(), azi.getMonth(), 1));
    } else if (range === 'an') {
        start = fmt(new Date(azi.getFullYear(), 0, 1));
    } else {
        const d = new Date();
        d.setDate(d.getDate() - (parseInt(range) - 1));
        start = fmt(d);
    }

    const inStart = document.getElementById('data-start');
    const inEnd   = document.getElementById('data-end');
    const lblStart = document.getElementById('label-start');
    const lblEnd   = document.getElementById('label-end');

    if (inStart) {
        inStart.value = start || '';
        inStart.setAttribute('value', start || ''); // cross-browser: unele browsere ignora .value la refresh
        ZFlowStore.biStartVal = start;
    }
    if (inEnd) {
        inEnd.value   = end   || '';
        inEnd.setAttribute('value', end || '');
        ZFlowStore.biEndVal   = end;
    }

    const fmtLbl = (v) => v ? formateazaDataZFlow(v) : '--';
    if (lblStart) lblStart.innerText = 'De la: ' + fmtLbl(start);
    if (lblEnd)   lblEnd.innerText   = 'Până la: ' + fmtLbl(end);

    // Actualizare dropdown interval rapid (înlocuiește butoanele quick-range-btn)
    const presetSel = document.getElementById('bi-range-preset');
    if (presetSel) presetSel.value = range;

    genereazaBI();
}
window.setBIRange = setBIRange;

// → financiar.js (extrase în Runda 9)
// ==========================================
// CORELARE FINANCIAR ↔ DEPOZIT / LOGISTIC
// ==========================================

/**
 * Afișează un prompt non-blocant de corelare inter-module.
 * Ex: după salvarea unei facturi client, oferă crearea unui bon de livrare.
 * @param {'livrare'|'intrare'|'transport'} type 
 * @param {Object} opts - Date pre-populate (tip, obs)
 */
function showCorrelationPrompt(type, opts) {
    if (!hasPermission('canEdit')) return;
    const cfg = {
        livrare:   { text: 'Adaugi și o ieșire din depozit (bon livrare)?' },
        intrare:   { text: 'Adaugi și o recepție/intrare în depozit?' },
        transport: { text: 'Creezi și o comandă de transport?' }
    };
    const svgIcons = {
        livrare:   `<svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.75 7.5h16.5M13.5 3.75h-3a1.5 1.5 0 00-1.5 1.5v2.25h6V5.25a1.5 1.5 0 00-1.5-1.5z"/></svg>`,
        intrare:   `<svg class="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>`,
        transport: `<svg class="w-5 h-5 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>`
    };
    const c = cfg[type];
    if (!c) return;

    // Salvează acțiunea în variabilă globală (accesibilă din onclick)
    window._corrOpts = opts;

    const id = 'corr-toast-' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:10000;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;box-shadow:0 10px 40px rgba(0,0,0,.12);display:flex;align-items:center;gap:10px;min-width:280px;max-width:90vw';
    el.innerHTML = `${svgIcons[type]}
      <span style="flex:1;font-size:11px;font-weight:600;color:#334155;line-height:1.3">${c.text}</span>
      <button onclick="document.getElementById('${id}')?.remove(); executaCorelareMod('${type}');"
        style="background:#2563eb;color:#fff;border:none;border-radius:10px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">Da</button>
      <button onclick="document.getElementById('${id}')?.remove();"
        style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px 6px;line-height:1">&times;</button>`;
    document.body.appendChild(el);
    setTimeout(() => document.getElementById(id)?.remove(), 9000);
}

/**
 * Execută acțiunea de corelare inter-module (apelată din toast onclick)
 */
function executaCorelareMod(type) {
    const opts = window._corrOpts || {};
    window._corrOpts = null;

    // Comută la tab-ul Depozit / Logistic dacă nu suntem deja acolo
    if ((type === 'livrare' || type === 'intrare') && typeof schimbaTab === 'function') {
        schimbaTab('depozit', document.querySelector('[data-tab="depozit"]'));
        schimbaViewDepozit && schimbaViewDepozit('miscari');
    } else if (type === 'transport' && typeof schimbaTab === 'function') {
        schimbaTab('logistic', document.querySelector('[data-tab="logistic"]'));
        schimbaViewLogistic && schimbaViewLogistic('comenzi');
    }

    // Deschide modalul corespunzător cu date pre-populate
    setTimeout(() => {
        if (type === 'livrare' || type === 'intrare') {
            if (typeof deschideModalMiscare === 'function') {
                deschideModalMiscare(null, { tip: type === 'livrare' ? 'Iesire' : 'Intrare', obs: opts.obs || '' });
            }
        } else if (type === 'transport') {
            if (typeof deschideModalComandaTransport === 'function') {
                deschideModalComandaTransport(null, opts);
            }
        }
    }, 400);
}

// ==========================================
// DASHBOARD HOME
// ==========================================

// ── Dashboard KPI cache (Task 10) ────────────────────────────────────────────
/** Hash dirty-check pentru dashboard — evită redraw complet când datele nu s-au schimbat */
let _dashboardHash = null;
function _getDashboardHash() {
    const fi = ZFlowStore.dateFacturiBI || [];
    const fp = ZFlowStore.dateFacturiPlatit || [];
    const dl = ZFlowStore.dateLocal || [];
    const df = ZFlowStore.dateFurnizori || [];
    const sumFi = fi.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    const sumFp = fp.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    const neincasatFi = fi.filter(f => f.status_plata !== 'Incasat').length;
    const neplatitFp  = fp.filter(f => f.status_plata !== 'Platit').length;
    const restCli  = dl.filter(c => (c.facturi || []).some(f => f.status_plata !== 'Incasat' && f.data_scadenta)).length;
    const restFurn = df.filter(f => (f.sumaScadenta || 0) > 0).length;
    return `${fi.length}|${fp.length}|${sumFi | 0}|${sumFp | 0}|${neincasatFi}|${neplatitFp}|${restCli}|${restFurn}|${new Date().toDateString()}`;
}

/**
 * Populează secțiunea Home cu KPI-uri, alerte și activitate recentă
 */
function incarcaDashboard() {
    // ── KPI Cache: sare peste redraw dacă datele nu s-au schimbat (Task 10)
    const dHash = _getDashboardHash();
    if (dHash === _dashboardHash) return;
    _dashboardHash = dHash;

    const facturiIncasat = ZFlowStore.dateFacturiBI || [];
    const facturiPlatit  = ZFlowStore.dateFacturiPlatit || [];
    const azi = new Date(); azi.setHours(23,59,59,999);
    const acum30 = new Date(); acum30.setDate(acum30.getDate() - 29); acum30.setHours(0,0,0,0);

    // Parser comun date (DD/MM/YY sau ISO)
    const parseDataFactura = (s) => {
        if (!s) return null;
        if (s.includes("/")) {
            const p = s.split("/");
            if (p.length === 3) {
                let y = parseInt(p[2]); if (y < 100) y += 2000;
                return new Date(y, parseInt(p[1]) - 1, parseInt(p[0]));
            }
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    };

    // Filtru: ultimele 30 de zile (pentru TOATE KPI-urile home)
    const inUltimele30 = (dateStr) => {
        const d = parseDataFactura(dateStr);
        return d && d >= acum30 && d <= azi;
    };

    // Facturile din ultimele 30 zile
    const facturiIncasat30 = facturiIncasat.filter(f => inUltimele30(f.data_emiterii));
    const facturiPlatit30  = facturiPlatit.filter(f => inUltimele30(f.data_emiterii || f.data_plata));

    // KPI 1: Total FACTURAT în ultimele 30 zile (clienți — toate statusurile)
    const totalFacturat = facturiIncasat30.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    // KPI 2: ÎNCASAT efectiv în ultimele 30 zile (facturi cu status_plata === 'Incasat')
    const neincasat = facturiIncasat30.filter(f => f.status_plata === "Incasat").reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    // KPI 3: De PLĂTIT — neplătit furnizori, primit în ultimele 30 zile
    const neplatit = facturiPlatit30.filter(f => f.status_plata !== "Platit").reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    // KPI 4: Cashflow NET 30 zile = încasat efectiv - plătit efectiv - contribuții buget neachitate
    const incasat30Efectiv = facturiIncasat30.filter(f => f.status_plata === "Incasat").reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    const platit30Efectiv  = facturiPlatit30.filter(f => f.status_plata === "Platit").reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    // Contribuții buget stat neachitate (preluate automat în Home, independent de Analiză)
    const contributii30 = (ZFlowStore.dateContributii || []).filter(c => {
        return !c.achitat;
    }).reduce((s, c) => s + (Number(c.suma) || 0), 0);
    const net = incasat30Efectiv - platit30Efectiv - contributii30;

    const fmt = (v) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(v);

    const setKPI = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setKPI("home-kpi-facturat", fmt(totalFacturat));
    setKPI("home-kpi-neincasat", fmt(neincasat));
    setKPI("home-kpi-neplatit", fmt(neplatit));
    // KPI Net — culoare dinamică
    const elNet = document.getElementById("home-kpi-net");
    if (elNet) {
        elNet.innerText = fmt(net);
        elNet.className = `text-lg font-black tabular-nums truncate leading-tight ${net > 0 ? "text-emerald-600" : net < 0 ? "text-rose-600" : "text-slate-500"}`;
    }
    // [FIX B4] Net 30 breakdown: afișează componentele de incasat și de plătit
    const elNetBreakdown = document.getElementById("home-kpi-net-breakdown");
    if (elNetBreakdown) {
        if (incasat30Efectiv > 0 || platit30Efectiv > 0 || contributii30 > 0) {
            elNetBreakdown.innerText = `\u2191 ${Math.round(incasat30Efectiv).toLocaleString()} / \u2193 ${Math.round(platit30Efectiv).toLocaleString()} / Buget ${Math.round(contributii30).toLocaleString()} lei`;
        } else {
            elNetBreakdown.innerText = 'Net total';
        }
    }

    // Firma header
    const p = ZFlowStore.userProfile;
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    if (p) {
        const numeParts = (p.nume_firma || "Z FLOW").split(" ");
        const initiale = numeParts.slice(0, 2).map(w => w[0]).join("").toUpperCase();
        setEl("home-firma-initiale", initiale);
        setEl("home-firma-nume", p.nume_firma || "—");
        // [R7-FIX 7] Badge plan abonament
        const _planBadge = document.getElementById('home-plan-badge');
        if (_planBadge && ZFlowStore.userProfile) {
            const _plan = ZFlowStore.userProfile.plan_type || 'standard';
            const _exp  = ZFlowStore.userProfile.subscription_expires_at;
            const _col  = { trial:'bg-yellow-100 text-yellow-700', standard:'bg-blue-100 text-blue-700',
                            pro:'bg-purple-100 text-purple-700', enterprise:'bg-emerald-100 text-emerald-700' }[_plan] || 'bg-blue-100 text-blue-700';
            const _expStr = _exp ? new Date(_exp).toLocaleDateString('ro-RO', { month:'short', year:'numeric' }) : '';
            _planBadge.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${_col}">${_plan}${_expStr ? ' · ' + _expStr : ''}</span>`;
            _planBadge.classList.remove('hidden');
        }
        setEl("home-firma-cui", p.cui ? "CUI: " + p.cui : "");
        setEl("home-firma-oras", p.oras || "");
        setEl("home-data-azi", new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    } else {
        // Fără profil (admin/demo) — resetăm header-ul la valori implicite pentru a evita
        // afișarea datelor din sesiunea anterioară a altui utilizator.
        setEl("home-firma-initiale", "ZF");
        setEl("home-firma-nume", "—");
        setEl("home-firma-cui", "");
        setEl("home-firma-oras", "");
        setEl("home-data-azi", new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
        const _planBadge = document.getElementById('home-plan-badge');
        if (_planBadge) _planBadge.classList.add('hidden');
    }

    // Alerte din CLIENTI și FURNIZORI — sursă: ZFlowStore.dateLocal / dateFurnizori (entități cu facturi scadente)
    const _parseScad = (s) => {
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s); d.setHours(0,0,0,0); return isNaN(d)?null:d; }
        if (s.includes('/')) {
            const p = s.split('/'); if (p.length !== 3) return null;
            let y = parseInt(p[2],10); if (y < 100) y += 2000;
            const d = new Date(y, parseInt(p[1],10)-1, parseInt(p[0],10)); d.setHours(0,0,0,0);
            return isNaN(d)?null:d;
        }
        return null;
    };
    // Clienți cu cel puțin o factură neîncasată cu scadența <= azi
    const clientiRestanti = (ZFlowStore.dateLocal || []).filter(cli =>
        (cli.facturi || []).some(f => {
            if (f.status_plata === 'Incasat') return false;
            const d = _parseScad(f.data_scadenta); return d && d <= azi;
        })
    );
    const totalScadenteClientVal = clientiRestanti.reduce((s, cli) =>
        s + (cli.facturi || []).reduce((acc, f) => {
            if (f.status_plata === 'Incasat') return acc;
            const d = _parseScad(f.data_scadenta); if (!d || d > azi) return acc;
            return acc + (Number(f.valoare) || 0);
        }, 0)
    , 0);
    // Furnizori cu sumaScadenta > 0 (calculat în _recomputeFurnizoriData)
    const furnizoriRestanti = (ZFlowStore.dateFurnizori || []).filter(furn => (furn.sumaScadenta || 0) > 0);
    const totalScadenteFurnizorVal = furnizoriRestanti.reduce((s, f) => s + (f.sumaScadenta || 0), 0);

    // Contribuții buget stat neachitate cu scadența depășită — scadenta = 25 ale lunii URMĂTOARE față de luna raportată
    const contributiiScadente = (ZFlowStore.dateContributii || []).filter(c => {
        if (c.achitat) return false;
        if (!c.luna) return false;
        const parts = (c.luna || '').substring(0, 7).split('-');
        if (parts.length < 2) return false;
        let an = parseInt(parts[0], 10);
        let lunaIdx = parseInt(parts[1], 10); // 1-12
        lunaIdx += 1;
        if (lunaIdx > 12) { lunaIdx = 1; an += 1; }
        const scad = new Date(an, lunaIdx - 1, 25, 23, 59, 59, 999);
        return scad < azi;
    });
    const totalCtbScadenta = contributiiScadente.reduce((s, c) => s + (Number(c.suma) || 0), 0);

    const alerteContainer = document.getElementById("home-alerte");
    const alerteList     = document.getElementById("home-alerte-list");
    if (alerteContainer && alerteList) {
        const nrAlerte = clientiRestanti.length + furnizoriRestanti.length + contributiiScadente.length;
        // #home-alerte este mereu vizibil — nu mai togglem hidden
        if (nrAlerte > 0) {
            const totalVal = totalScadenteClientVal + totalScadenteFurnizorVal + totalCtbScadenta;
            alerteList.innerHTML = `
                <button onclick="schimbaTab('financiar', document.getElementById('nav-btn-fin'))" class="w-full text-left bg-red-50 border border-red-200 rounded-2xl p-4 hover:bg-red-100 active:bg-red-200 transition-all">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-black text-red-700 uppercase flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                      Alerte scadențe
                    </p>
                    <span class="text-[9px] font-black text-red-400 uppercase tracking-wide flex items-center gap-0.5">
                      Vezi în Financiar
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
                    </span>
                  </div>
                  <div class="space-y-1.5">
                    ${clientiRestanti.length ? `
                    <div class="flex items-center justify-between bg-red-100/60 rounded-xl px-3 py-1.5">
                        <p class="text-[10px] text-red-700 font-bold">${clientiRestanti.length} client${clientiRestanti.length > 1 ? "i cu" : " cu"} scadențe depășite</p>
                        <p style="font-size:0.9375rem!important" class="font-black text-red-700">${Math.round(totalScadenteClientVal).toLocaleString()} lei</p>
                    </div>` : ''}
                    ${furnizoriRestanti.length ? `
                    <div class="flex items-center justify-between bg-red-100/60 rounded-xl px-3 py-1.5">
                        <p class="text-[10px] text-red-700 font-bold">${furnizoriRestanti.length} furnizor${furnizoriRestanti.length > 1 ? "i cu" : " cu"} facturi restante</p>
                        <p style="font-size:0.9375rem!important" class="font-black text-red-700">${Math.round(totalScadenteFurnizorVal).toLocaleString()} lei</p>
                    </div>` : ''}
                    ${contributiiScadente.length ? `
                    <div class="flex items-center justify-between bg-orange-100/80 rounded-xl px-3 py-1.5">
                        <p class="text-[10px] text-orange-700 font-bold">${contributiiScadente.length} contribuție${contributiiScadente.length > 1 ? 'i buget' : ' buget'} scadent${contributiiScadente.length > 1 ? 'e' : 'ă'} (25 luna)</p>
                        <p style="font-size:0.9375rem!important" class="font-black text-orange-700">${Math.round(totalCtbScadenta).toLocaleString()} lei</p>
                    </div>` : ''}
                  </div>
                </button>`;
        } else {
            // Stare OK — buton verde permanent
            alerteList.innerHTML = `
                <button onclick="schimbaTab('financiar', document.getElementById('nav-btn-fin'))" class="w-full text-left bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5 hover:bg-emerald-100 active:bg-emerald-200 transition-all flex items-center gap-3">
                  <div class="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div class="text-left">
                                        <p class="text-[11px] font-black text-emerald-800 uppercase">Toate la zi</p>
                    <p class="text-[9px] font-bold text-emerald-600 mt-0.5">Nicio scadență depășită</p>
                  </div>
                  <svg class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                  </svg>
                </button>`;
        }
        // Badge pe butonul Financiar
        const badge = document.getElementById("nav-badge-financiar");
        if (badge) {
            if (nrAlerte > 0) { badge.innerText = nrAlerte; badge.classList.remove("hidden"); }
            else { badge.classList.add("hidden"); }
        }
    }

    // ── Trend indicatori KPI ──
    const lunaPrec = new Date(azi.getFullYear(), azi.getMonth() - 1, 1);
    const lunaPrec_sfarsit = new Date(azi.getFullYear(), azi.getMonth(), 0);  // ultima zi luna precedenta
    lunaPrec_sfarsit.setHours(23, 59, 59, 999);
    const inLunaPrecedenta = (f) => {
        const d = parseDataFactura(f.data_emiterii);
        return d && d >= lunaPrec && d <= lunaPrec_sfarsit;
    };
    const totalFacturatPrec = facturiIncasat.filter(inLunaPrecedenta).reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    const trendPct = totalFacturatPrec > 0 ? Math.round(((totalFacturat - totalFacturatPrec) / totalFacturatPrec) * 100) : null;

    const setTrend = (id, pct, pozitivBun = true) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (pct === null) { el.innerText = ''; return; }
        const up = pct >= 0;
        const good = pozitivBun ? up : !up;
        const color = good ? 'text-emerald-600' : 'text-red-500';
        el.className = `text-[7px] font-black ${color}`;
        el.innerText = (up ? '↑' : '↓') + ' ' + Math.abs(pct) + '%';
    };
    setTrend('home-kpi-facturat-trend', trendPct, true);

    // [R18] Trend: creștere încasări e BUNĂ (pozitivBun = true)
    const neincasatPrec = facturiIncasat.filter(inLunaPrecedenta).filter(f => f.status_plata === 'Incasat')
        .reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    const trendNeincasat = neincasatPrec > 0 ? Math.round(((neincasat - neincasatPrec) / neincasatPrec) * 100) : null;
    setTrend('home-kpi-neincasat-trend', trendNeincasat, true);

    // Cashflow chart — ultimele 30 de zile (rolling window, se actualizează zilnic)
    const labels = [];
    const datriIntrari = [];
    const datriIesiri = [];
    const aziChart = new Date(); aziChart.setHours(0,0,0,0);

    // Generăm ultimele 30 de zile (inclusiv azi)
    for (let i = 29; i >= 0; i--) {
        const ziData = new Date(aziChart);
        ziData.setDate(aziChart.getDate() - i);
        ziData.setHours(0, 0, 0, 0);
        
        const ziAn = ziData.getFullYear();
        const ziLuna = ziData.getMonth();
        const ziZi = ziData.getDate();
        
        // Formatul etichetei: ziua + inițiala lunii (ex: "15 I", "28 F")
        const numeleLuna = ["I", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"];
        labels.push(ziZi + " " + numeleLuna[ziLuna]);
        
        const intrari = facturiIncasat.reduce((s, f) => {
            const d = parseDataFactura(f.data_emiterii);
            if (!d || d.getFullYear() !== ziAn || d.getMonth() !== ziLuna || d.getDate() !== ziZi) return s;
            return s + (Number(f.valoare) || 0);
        }, 0);
        const iesiri = facturiPlatit.reduce((s, f) => {
            const d = parseDataFactura(f.data_emiterii);
            if (!d || d.getFullYear() !== ziAn || d.getMonth() !== ziLuna || d.getDate() !== ziZi) return s;
            return s + (Number(f.valoare) || 0);
        }, 0);
        datriIntrari.push(intrari);
        datriIesiri.push(iesiri);
    }

    // Net zilnic = intrări – ieșiri
    const datriNet = datriIntrari.map((v, i) => v - datriIesiri[i]);

    // Perioadă afișată în titlul graficului
    const perioadaFmt = (d) => d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
    const perioadaStartDate = new Date(aziChart); perioadaStartDate.setDate(aziChart.getDate() - 29);
    const elPeriod = document.getElementById("home-chart-period");
    if (elPeriod) elPeriod.innerText = perioadaFmt(perioadaStartDate) + " – " + perioadaFmt(aziChart);

    // [R4-FIX 7] Chart cashflow eliminat din Home — canvas șters din index.html
    // KPI-urile rămân funcționale (home-kpi-facturat, home-kpi-neincasat, etc.)
    if (window._homeCashflowChart) {
        window._homeCashflowChart.destroy();
        window._homeCashflowChart = null;
    }
    if (window._homeCashflowRAF) {
        cancelAnimationFrame(window._homeCashflowRAF);
        window._homeCashflowRAF = null;
    }
    // \u2500\u2500\u2500 Trend vs. 30 zile anterioare \u2500\u2500\u2500
    const _acum60 = new Date(); _acum60.setDate(_acum60.getDate() - 59); _acum60.setHours(0,0,0,0);
    const _acum31 = new Date(); _acum31.setDate(_acum31.getDate() - 30); _acum31.setHours(23,59,59,999);
    const _inPrev = f => { const d = parseDataFactura(f.data_emiterii); return d && d >= _acum60 && d <= _acum31; };
    const _fp = facturiIncasat.filter(_inPrev);
    const _fpI = facturiPlatit.filter(_inPrev);
    const prevF  = _fp.reduce((s, f) => s + (Number(f.valoare)||0), 0);
    const prevNI = _fp.filter(f => f.status_plata !== 'Incasat').reduce((s, f) => s + (Number(f.valoare)||0), 0);
    const prevNP = _fpI.filter(f => f.status_plata !== 'Platit').reduce((s, f) => s + (Number(f.valoare)||0), 0);
    const prevIncasat30Ef = _fp.filter(f => f.status_plata === 'Incasat').reduce((s, f) => s + (Number(f.valoare)||0), 0);
    const prevPlatit30Ef  = _fpI.filter(f => f.status_plata === 'Platit').reduce((s, f) => s + (Number(f.valoare)||0), 0);
    const prevNet = prevIncasat30Ef - prevPlatit30Ef;
    const _setTrend = (id, curr, prev) => {
        const el = document.getElementById(id); if (!el) return;
        if (prev === 0) { el.innerText = ''; return; }
        const pct = Math.round(((curr - prev) / prev) * 100);
        if (pct > 0) { el.innerText = `\u2191 ${pct}%`; el.className = 'text-[7px] font-black text-emerald-500'; }
        else if (pct < 0) { el.innerText = `\u2193 ${Math.abs(pct)}%`; el.className = 'text-[7px] font-black text-rose-500'; }
        else { el.innerText = '\u2014'; el.className = 'text-[7px] font-black text-slate-400'; }
    };
    _setTrend('home-kpi-facturat-trend',  totalFacturat, prevF);
    // [R18] prevNI = încasat efectiv din perioada anterioară (nu restanțe)
    const prevIncasatEfPrec = _fp.filter(f => f.status_plata === 'Incasat').reduce((s, f) => s + (Number(f.valoare)||0), 0);
    _setTrend('home-kpi-neincasat-trend', neincasat, prevIncasatEfPrec);
    _setTrend('home-kpi-neplatit-trend',  neplatit, prevNP);
    _setTrend('home-kpi-net-trend',       net, prevNet);

    // [R19] Widgets secundare Home
    _updateHomeMiniDepozit();
    _updateHomeMiniLogistic();
    _updateHomeAlerteSummary(clientiRestanti, furnizoriRestanti, totalScadenteClientVal, totalScadenteFurnizorVal, contributiiScadente, totalCtbScadenta);
}

// [R19] Helper: mini-widget Depozit pe Home
function _updateHomeMiniDepozit() {
    const produse = ZFlowStore.dateProduse || [];
    const elText   = document.getElementById('home-mini-depozit-text');
    const elAlerta = document.getElementById('home-mini-depozit-alerta');
    const elBadge  = document.getElementById('home-mini-depozit-badge');
    if (!elText) return;

    let alerteStoc = 0;
    produse.forEach(p => {
        const stocCurent = (typeof calcStocCurent === 'function')
            ? calcStocCurent(p.id)
            : (Number(p.stoc_initial) || 0);
        if (p.stoc_min && stocCurent < Number(p.stoc_min)) alerteStoc++;
    });

    elText.textContent = produse.length === 0
        ? 'Niciun produs'
        : produse.length + (produse.length === 1 ? ' produs' : ' produse');

    if (elAlerta && elBadge) {
        if (alerteStoc > 0) {
            elBadge.innerHTML = `<svg class="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A2 2 0 004.5 20h15a2 2 0 001.71-3.14l-7.5-13a2 2 0 00-3.42 0z"/></svg><span>${alerteStoc} sub stoc minim</span>`;
            elAlerta.classList.remove('hidden');
        } else {
            elAlerta.classList.add('hidden');
        }
    }
}

// [R19] Helper: mini-widget Logistic pe Home
function _updateHomeMiniLogistic() {
    const comenzi  = ZFlowStore.dateComenziTransport || [];
    const elText   = document.getElementById('home-mini-logistic-text');
    const elActiv  = document.getElementById('home-mini-logistic-activ');
    const elBadge  = document.getElementById('home-mini-logistic-badge');
    if (!elText) return;

    const active = comenzi.filter(c => c.status === 'In curs' || c.status === 'Planificat').length;
    const total  = comenzi.length;

    elText.textContent = total === 0
        ? 'Nicio comandă'
        : total + (total === 1 ? ' comandă' : ' comenzi');

    if (elActiv && elBadge) {
        if (active > 0) {
            elBadge.textContent = '● ' + active + ' în curs';
            elActiv.classList.remove('hidden');
        } else {
            elActiv.classList.add('hidden');
        }
    }
}

// [R19] Helper: buton alerte scadențe pe Home (mereu vizibil, stare dinamică)
function _updateHomeAlerteSummary(clientiRestanti, furnizoriRestanti, totalCliVal, totalFurnVal, contributiiScadente, totalCtbScadenta) {
    const elSubtitle  = document.getElementById('home-alerte-scadente-subtitle');
    const elIconWrap  = document.getElementById('home-alerte-icon-wrap');
    const elIcon      = document.getElementById('home-alerte-icon');
    if (!elSubtitle) return;

    const nrClR  = (clientiRestanti  || []).length;
    const nrFurnR = (furnizoriRestanti || []).length;
    const nrCtb  = (contributiiScadente || []).length;
    const total   = nrClR + nrFurnR + nrCtb;

    if (total === 0) {
        // Stare OK — verde
        elSubtitle.textContent = 'Toate la zi';
        elSubtitle.className   = 'text-[9px] font-bold text-emerald-500 mt-0.5';
        if (elIconWrap) elIconWrap.className = 'w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0';
        if (elIcon)     elIcon.className    = 'w-4 h-4 text-emerald-500';
    } else {
        // Stare alertă — roșu, afișează detalii
        const parts = [];
        if (nrClR  > 0) parts.push(nrClR  + (nrClR  === 1 ? ' client' : ' clienți'));
        if (nrFurnR > 0) parts.push(nrFurnR + (nrFurnR === 1 ? ' furnizor' : ' furnizori'));
        if (nrCtb  > 0) parts.push(nrCtb  + (nrCtb  === 1 ? ' contribuție' : ' contribuții'));
        const totalLei = Math.round((totalCliVal || 0) + (totalFurnVal || 0) + (totalCtbScadenta || 0));
        elSubtitle.textContent = parts.join(' + ') + ' · ' + totalLei.toLocaleString() + ' lei restanți';
        elSubtitle.className   = 'text-[9px] font-bold text-red-500 mt-0.5';
        if (elIconWrap) elIconWrap.className = 'w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0';
        if (elIcon)     elIcon.className    = 'w-4 h-4 text-red-500';
    }
}

function deschideModalFacturaPlatit(furnizorId, facturaId) {
    const modal = document.getElementById("modal-factura-platit");
    if (!modal) return;
    const btnSterge = document.getElementById("btn-sterge-fp");
    const title = document.getElementById("modal-fp-title");

    // Reset
    document.getElementById("in-fp-id").value = "";
    document.getElementById("in-fp-furnizor-id").value = furnizorId || "";
    document.getElementById("in-fp-nr").value = "";
    document.getElementById("in-fp-val").value = "";
    document.getElementById("in-fp-emisie").value = "";
    document.getElementById("in-fp-scad").value = "";
    document.getElementById("in-fp-note").value = "";
    // Default azi pentru factură nouă (suprascris la editare mai jos)
    const _aziFP = getDataImplicita();
    document.getElementById("in-fp-emisie").value = _aziFP;
    document.getElementById("in-fp-scad").value = _aziFP;
    document.getElementById("display-fp-emisie").innerText = (_aziFP && typeof formateazaDataZFlow === 'function') ? formateazaDataZFlow(_aziFP) : (_aziFP || 'Alege data');
    document.getElementById("display-fp-scadenta").innerText = (_aziFP && typeof formateazaDataZFlow === 'function') ? formateazaDataZFlow(_aziFP) : (_aziFP || 'Alege data');

    // Listeners date pickers
    document.getElementById("in-fp-emisie").onchange = function () {
        document.getElementById("display-fp-emisie").innerText = this.value ? formateazaDataZFlow(this.value) : "Alege data";
    };
    document.getElementById("in-fp-scad").onchange = function () {
        document.getElementById("display-fp-scadenta").innerText = this.value ? formateazaDataZFlow(this.value) : "Alege data";
    };

    populeazaSelectFurnizori(furnizorId);

    if (facturaId) {
        const fac = ZFlowStore.dateFacturiPlatit.find(f => String(f.id) === String(facturaId));
        if (fac) {
            document.getElementById("in-fp-id").value = fac.id;
            document.getElementById("in-fp-furnizor-id").value = fac.furnizor_id || "";
            document.getElementById("in-fp-nr").value = fac.numar_factura || "";
            document.getElementById("in-fp-val").value = fac.valoare || "";
            document.getElementById("in-fp-emisie").value = fac.data_emiterii || "";
            document.getElementById("in-fp-scad").value = fac.data_scadenta || "";
            document.getElementById("in-fp-note").value = fac.note || "";
            if (fac.data_emiterii) document.getElementById("display-fp-emisie").innerText = formateazaDataZFlow(fac.data_emiterii);
            if (fac.data_scadenta) document.getElementById("display-fp-scadenta").innerText = formateazaDataZFlow(fac.data_scadenta);
            populeazaSelectFurnizori(fac.furnizor_id);
        }
        if (title) title.innerText = "Editare Factură";
        if (btnSterge) btnSterge.classList.remove("hidden");
    } else {
        if (title) title.innerText = "Factură de Plătit";
        if (btnSterge) btnSterge.classList.add("hidden");
    }

    modal.classList.add("active");
}

/**
 * Deschide modal factură platit direct (din butonul DOC NOU în detalii-furnizor)
 */
function deschideModalFacturaPlatitDirect() {
    deschideModalFacturaPlatit(ZFlowStore.selectedFurnizorId);
}

/**
 * Salvează o factură de plătit
 */
// salveazaFacturaPlatit și stergeFacturaPlatit → mutate în js/modules/crud.js
// Alias pentru compatibilitate cu orice referință directă din HTML
function stergeFacturaPlatitModal() {
    const id = document.getElementById("in-fp-id")?.value;
    if (id && typeof stergeFacturaPlatit === 'function') stergeFacturaPlatit(id);
}
window.stergeFacturaPlatitModal = stergeFacturaPlatitModal;

// ==========================================
// CASHFLOW ANALIZĂ
// ==========================================

/** Cache hash pentru dirty-check — evită recalculare când inputurile nu s-au schimbat */
let _cashflowHash = null;

function _getCashflowHash() {
    const dataStart = document.getElementById('data-start')?.value || '';
    const dataEnd   = document.getElementById('data-end')?.value   || '';
    const sel  = Array.from(document.querySelectorAll('#container-bi-checks input:checked')).map(i => i.value).join(',');
    const selF = Array.from(document.querySelectorAll('#container-bi-furnizori-checks input:checked')).map(i => i.value).join(',');
    const tip  = ZFlowStore.filtruTipBI || 'ambele';
    const withContrib = ZFlowStore.includeContributiiInAnaliza ? '1' : '0';
    return `${dataStart}|${dataEnd}|${sel}|${selF}|${tip}|${withContrib}|${ZFlowStore.dateFacturiBI?.length ?? 0}|${ZFlowStore.dateFacturiPlatit?.length ?? 0}|${ZFlowStore.dateContributii?.length ?? 0}`;
}

/** Invalidează cache-ul cashflow (cheamă când datele sunt modificate) */
function invalidateCashflowCache() { _cashflowHash = null; _dashboardHash = null; }

/**
 * Calculează și afișează cashflow-ul în cardul din view-analiza.
 * Preia aceleași filtre de dată și selecție ca genereazaBI().
 * Sincronizat cu perioada și clienții/furnizorii selectați.
 */
function calculeazaCashflow() {
    const hash = _getCashflowHash();
    if (hash === _cashflowHash) return; // datele nu s-au schimbat
    _cashflowHash = hash;

    const dataStart = document.getElementById("data-start")?.value || null;
    const dataEnd = document.getElementById("data-end")?.value || null;

    const tip = ZFlowStore.filtruTipBI || 'ambele';

    const parseData = (s) => s ? new Date(s + "T00:00:00") : null;
    const start = parseData(dataStart);
    const end = parseData(dataEnd);

    // Parsare dată compatibilă cu formatul DD/MM/YY stocat în data_emiterii
    const parseDataFactura = (dateStr) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'string' && dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
                let year = parseInt(parts[2]);
                if (year < 100) year += 2000;
                const d = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
                return isNaN(d.getTime()) ? null : d;
            }
        }
        const d = new Date(dateStr.length <= 10 ? dateStr + "T12:00:00" : dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    const inRange = (dateStr) => {
        if (!dateStr) return !start && !end; // fără filtru de dată = include tot
        const d = parseDataFactura(dateStr);
        if (!d) return true; // dată invalidă = nu excludem
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    };

    // Obține clienții selectați din checkboxes (sincronizare cu rapoarte)
    const selectedClientIds = Array.from(document.querySelectorAll("#container-bi-checks input:checked")).map(i => String(i.value));
    const allClientIds = (ZFlowStore.dateLocal || []).map(c => String(c.id));
    // Nu folosim fallback la allClientIds — comportament consistent cu genereazaBI
    const activeClientIds = selectedClientIds;

    // Obține furnizorii selectați din checkboxes (sincronizare cu rapoarte)
    // Niciun fallback la allFurnizorIds — comportament consistent cu clienții:
    // dacă nu e selectat niciun furnizor, ieșirile sunt 0.
    const selectedFurnizorIds = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
    const activeFurnizorIds = selectedFurnizorIds;

    // Intrări: TOATE facturile clienți în perioadă - filtrate după selecție
    const intrari = (tip !== 'furnizori')
        ? (ZFlowStore.dateFacturiBI || []).filter(f => 
            inRange(f.data_emiterii) &&
            activeClientIds.includes(String(f.client_id))
          ).reduce((sum, f) => sum + (Number(f.valoare) || 0), 0)
        : 0;

    // Ieșiri: TOATE facturile furnizori în perioadă - filtrate după selecție
    const iesiri = (tip !== 'clienti')
        ? (ZFlowStore.dateFacturiPlatit || []).filter(f => 
            inRange(f.data_emiterii) &&
            activeFurnizorIds.includes(String(f.furnizor_id))
          ).reduce((sum, f) => sum + (Number(f.valoare) || 0), 0)
        : 0;

    // Contribuții buget de stat (TVA, CAS, CASS, Impozit) — doar NEACHITATE, filtrate pe aceeași perioadă
    const contributii = ZFlowStore.includeContributiiInAnaliza
        ? (ZFlowStore.dateContributii || []).filter(c => {
            if (c.achitat) return false; // cf-contributii = total NEACHITAT
            if (!c.luna) return !start && !end;
            const d = new Date((c.luna.length === 7 ? c.luna + '-01' : c.luna) + 'T12:00:00');
            if (isNaN(d)) return true;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        }).reduce((sum, c) => sum + (Number(c.suma) || 0), 0)
        : 0;

    const totalIesiri = iesiri + contributii;
    const net = intrari - totalIesiri;
    const fmt = (v) => `${Math.round(Math.abs(v)).toLocaleString()} lei`;

    const cfIntrari = document.getElementById("cf-intrari");
    const cfIesiri = document.getElementById("cf-iesiri");
    const cfNet = document.getElementById("cf-net");

    if (cfIntrari) cfIntrari.innerText = tip === 'furnizori' ? '—' : fmt(intrari);
    if (cfIesiri) cfIesiri.innerText = tip === 'clienti' ? '—' : fmt(totalIesiri);
    const cfContributii = document.getElementById("cf-contributii");
    if (cfContributii) cfContributii.innerText = contributii > 0 ? fmt(contributii) : '0 lei';
    if (cfNet) {
        cfNet.innerText = tip === 'ambele' ? (net >= 0 ? '+' : '\u2212') + " " + fmt(net) : '—';
        cfNet.className = `text-[0.875rem] font-semibold tabular-nums leading-tight ${net >= 0 ? "text-emerald-600" : "text-red-600"}`;
    }
    renderListaContributii();
}

// ==========================================
// CONTRIBUȚII BUGET STAT — CRUD
// ==========================================

/**
 * Randează lista contribuțiilor în panoul din view-furnizori.
 * Suportă paginare (15/pagină), filtrare după tip și status, afișare dată prietenoasă,
 * toggle rapid achitat și sumar total.
 */
function renderListaContributii() {
    const container = document.getElementById('lista-contributii');
    if (!container) return;

    const lista = ZFlowStore.dateContributii || [];

    // Filtrare
    const tipFiltru    = ZFlowStore.contributiiTipFiltru    || '';
    const statusFiltru = ZFlowStore.contributiiStatusFiltru || 'toate';
    let filtrate = lista;
    if (tipFiltru)               filtrate = filtrate.filter(c => c.tip === tipFiltru);
    if (statusFiltru === 'neachitate') filtrate = filtrate.filter(c => !c.achitat);
    if (statusFiltru === 'achitate')   filtrate = filtrate.filter(c => !!c.achitat);

    // Sortare: luna descrescătoare
    filtrate = [...filtrate].sort((a, b) => (b.luna || '') > (a.luna || '') ? 1 : -1);

    if (filtrate.length === 0) {
        container.innerHTML = '<p class="text-[9px] text-slate-400 text-center py-2">Nicio contribuție.</p>';
        return;
    }

    // Paginare
    const ps   = ZFlowStore.contributiiPageSize   || 15;
    const total = filtrate.length;
    const totalPages = Math.max(1, Math.ceil(total / ps));
    const page = Math.min(Math.max(1, ZFlowStore.contributiiCurrentPage || 1), totalPages);
    ZFlowStore.contributiiCurrentPage = page;
    const from = (page - 1) * ps;
    const paginate = filtrate.slice(from, from + ps);

    // Formatare lună: '2026-03-01' sau '2026-03' → 'Mar 2026'
    const fmtLuna = (s) => {
        if (!s) return '—';
        const d = new Date(s.length >= 10 ? s + 'T00:00:00' : s + '-01T00:00:00');
        if (isNaN(d)) return s.substring(0, 7);
        return d.toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' });
    };

    // Sumar total neachitat pentru filtrul curent
    const totalNeachitat = filtrate.filter(c => !c.achitat).reduce((s, c) => s + (Number(c.suma) || 0), 0);
    const nrNeachitate   = filtrate.filter(c => !c.achitat).length;
    const totalNeachitatGlobal = (lista || []).filter(c => !c.achitat).reduce((s, c) => s + (Number(c.suma) || 0), 0);
    const cfContributiiEl = document.getElementById('cf-contributii');
    if (cfContributiiEl) {
        cfContributiiEl.innerText = totalNeachitatGlobal > 0
            ? `${new Intl.NumberFormat('ro-RO').format(Math.round(totalNeachitatGlobal))} lei`
            : '0 lei';
    }

    const rows = paginate.map(c => {
        const badgeClass = c.achitat
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-rose-100 text-rose-700';
        const badgeText = c.achitat
            ? '<svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.7"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
            : '!';
        const suma = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(c.suma) || 0);
        return `<div class="flex items-center gap-2 px-2 py-1.5 rounded-lg border ${c.achitat ? 'bg-white border-slate-100' : 'bg-orange-50 border-orange-100'} hover:shadow-sm transition-all">
            <button type="button"
                    class="w-5 h-5 flex-shrink-0 rounded-full text-[9px] font-black flex items-center justify-center ${badgeClass} hover:opacity-75 transition-all"
                    title="${c.achitat ? 'Marchează ca neachitat' : 'Marchează ca achitat'}"
                    onclick="toggleAchitatContributie('${c.id}')">${badgeText}</button>
            <div class="flex-1 min-w-0 cursor-pointer" data-action="deschideModalContributie" data-arg="${c.id}">
                <span class="text-[9px] font-bold text-slate-700 truncate block">${c.tip} <span class="text-slate-400 font-semibold">· ${fmtLuna(c.luna)}</span></span>
                ${c.observatii ? `<span class="text-[8px] text-slate-400 truncate block">${c.observatii}</span>` : ''}
            </div>
            <span class="text-[10px] font-black tabular-nums flex-shrink-0 ${c.achitat ? 'text-slate-400 line-through' : 'text-orange-700'}">${suma} lei</span>
        </div>`;
    }).join('');

    // Bara paginare inline
    const prevDis = page <= 1 ? 'disabled opacity-40 cursor-default' : 'cursor-pointer hover:bg-slate-200';
    const nextDis = page >= totalPages ? 'disabled opacity-40 cursor-default' : 'cursor-pointer hover:bg-slate-200';
    const paginareHTML = totalPages > 1 ? `
<div class="flex items-center justify-between mt-2 px-1">
    <button type="button" class="px-2 py-1 bg-slate-100 rounded-lg text-[8px] font-bold uppercase ${prevDis} transition-all" onclick="contributiiPrevPage()" ${page<=1?'disabled':''}>← Ant.</button>
    <span class="text-[8px] font-bold text-slate-400">${page}/${totalPages} (${total})</span>
    <button type="button" class="px-2 py-1 bg-slate-100 rounded-lg text-[8px] font-bold uppercase ${nextDis} transition-all" onclick="contributiiNextPage()" ${page>=totalPages?'disabled':''}>Urm. →</button>
</div>` : '';

    // Sumar
    const sumarHTML = nrNeachitate > 0
        ? `<div class="flex justify-between items-center px-1 mb-1">
               <span class="text-[8px] text-slate-400 font-semibold">${nrNeachitate} neachitate</span>
               <span class="text-[9px] font-black text-orange-600">${new Intl.NumberFormat('ro-RO').format(Math.round(totalNeachitat))} lei</span>
           </div>`
        : '';

    container.innerHTML = sumarHTML + rows + paginareHTML;
}

/** Avansează pagina contribuțiilor */
function contributiiNextPage() {
    const ps = ZFlowStore.contributiiPageSize || 15;
    const total = (ZFlowStore.dateContributii || []).length;
    const tp = Math.max(1, Math.ceil(total / ps));
    if ((ZFlowStore.contributiiCurrentPage || 1) < tp) {
        ZFlowStore.contributiiCurrentPage = (ZFlowStore.contributiiCurrentPage || 1) + 1;
        renderListaContributii();
    }
}
window.contributiiNextPage = contributiiNextPage;

/** Retrocedează pagina contribuțiilor */
function contributiiPrevPage() {
    if ((ZFlowStore.contributiiCurrentPage || 1) > 1) {
        ZFlowStore.contributiiCurrentPage--;
        renderListaContributii();
    }
}
window.contributiiPrevPage = contributiiPrevPage;

/**
 * Toggle rapid achitat/neachitat pentru o contribuție direct din listă.
 */
async function toggleAchitatContributie(id) {
    const ctb = (ZFlowStore.dateContributii || []).find(c => String(c.id) === String(id));
    if (!ctb) return;
    const newVal = !ctb.achitat;
    try {
        await ZFlowDB.updateContributie(id, { achitat: newVal });
        ctb.achitat = newVal; // update optimist în store
        invalidateCashflowCache();
        calculeazaCashflow();
        if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
        renderListaContributii();
    } catch (err) {
        ZFlowLogger.error('ctb', 'Eroare toggle achitat:', err);
        showNotification('Eroare la actualizare.', 'error');
    }
}
window.toggleAchitatContributie = toggleAchitatContributie;

/**
 * Toggle vizibilitate panou contribu\u021bii (collapsed implicit).
 */
function toggleContributiiCollapse() {
    const body = document.getElementById('contributii-body');
    const chevron = document.getElementById('contributii-chevron');
    if (!body) return;
    const isHidden = body.classList.toggle('hidden');
    if (chevron) chevron.style.transform = isHidden ? '' : 'rotate(180deg)';
    if (!isHidden) renderListaContributii();
}
window.toggleContributiiCollapse = toggleContributiiCollapse;

/**
 * Randează butoane toggle categorie \u00een containerele #filtru-categorie-clienti / #filtru-categorie-furnizori.
 * Extrage categoriile unice din store, creeaz\u0103 pill-uri clicabile.
 */
function renderFiltruCategorieBtns() {
    // --- Clien\u021bi ---
    const wrapCli = document.getElementById('filtru-categorie-clienti');
    if (wrapCli) {
        const catsCli = [...new Set((ZFlowStore.dateLocal || []).map(c => (c.categorie || '').trim()).filter(Boolean))].sort();
        const selCli = ZFlowStore.filtruCategorieClienti || '';
        wrapCli.innerHTML = catsCli.map(cat => {
            const active = selCli === cat;
            const esc = cat.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            return `<button type="button" onclick="_toggleCategorieClienti('${esc}')"
              class="flex-shrink-0 text-[8px] font-black px-2 py-0.5 rounded-full transition-all select-none ${active ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-800'}"
            >${cat}</button>`;
        }).join('');
    }

    // --- Furnizori ---
    const wrapFurn = document.getElementById('filtru-categorie-furnizori');
    if (wrapFurn) {
        const catsFurn = [...new Set((ZFlowStore.dateFurnizori || []).map(f => (f.categorie || '').trim()).filter(Boolean))].sort();
        const selFurn = ZFlowStore.filtruCategorieFurnizori || '';
        wrapFurn.innerHTML = catsFurn.map(cat => {
            const active = selFurn === cat;
            return `<button type="button" onclick="_toggleCategorieFurnizori('${cat.replace(/'/g,"\\'")}')"
              class="flex-shrink-0 text-[8px] font-black px-2 py-0.5 rounded-full transition-all select-none ${active ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-800'}"
            >${cat}</button>`;
        }).join('');
    }
}
window.renderFiltruCategorieBtns = renderFiltruCategorieBtns;

function _toggleCategorieClienti(cat) {
    ZFlowStore.filtruCategorieClienti = (ZFlowStore.filtruCategorieClienti === cat) ? '' : cat;
    renderFiltruCategorieBtns();
    filtreazaListaFirme();
}
window._toggleCategorieClienti = _toggleCategorieClienti;

function _toggleCategorieFurnizori(cat) {
    ZFlowStore.filtruCategorieFurnizori = (ZFlowStore.filtruCategorieFurnizori === cat) ? '' : cat;
    renderFiltruCategorieBtns();
    filtreazaListaFurnizori();
}
window._toggleCategorieFurnizori = _toggleCategorieFurnizori;

/**
 * Deschide modalul pentru adăugare / editare contribuție buget stat.
 * @param {string|null} id – id-ul contribuției existente (null = adăugare nouă)
 */
async function deschideModalContributie(id = null) {
    // Reset formular
    document.getElementById('ctb-id').value = '';
    document.getElementById('ctb-tip').value = 'TVA';
    document.getElementById('ctb-suma').value = '';
    document.getElementById('ctb-luna').value = new Date().toISOString().slice(0, 7);
    document.getElementById('ctb-achitat').checked = false;
    document.getElementById('ctb-observatii').value = '';
    document.getElementById('btn-sterge-ctb').classList.add('hidden');

    if (id) {
        const existing = (ZFlowStore.dateContributii || []).find(c => String(c.id) === String(id));
        if (existing) {
            document.getElementById('ctb-id').value = existing.id;
            document.getElementById('ctb-tip').value = existing.tip || 'TVA';
            document.getElementById('ctb-suma').value = existing.suma ?? '';
            document.getElementById('ctb-luna').value = (existing.luna || '').substring(0, 7);
            document.getElementById('ctb-achitat').checked = !!existing.achitat;
            document.getElementById('ctb-observatii').value = existing.observatii || '';
            document.getElementById('btn-sterge-ctb').classList.remove('hidden');
        }
    }

    deschideModal('modal-contributie');
}
window.deschideModalContributie = deschideModalContributie;

/**
 * Salvează (insert sau update) contribuția curentă din modal.
 */
async function salveazaContributie() {
    const id = document.getElementById('ctb-id')?.value?.trim() || null;
    const suma = parseFloat(document.getElementById('ctb-suma')?.value) || 0;
    if (!suma || suma <= 0) {
        showNotification('Introduceți o sumă validă (> 0).', 'error');
        return;
    }
    const _lunaRaw = document.getElementById('ctb-luna')?.value || null;
    const payload = {
        tip:         document.getElementById('ctb-tip')?.value || 'TVA',
        suma,
        luna:        _lunaRaw ? (_lunaRaw.length === 7 ? _lunaRaw + '-01' : _lunaRaw) : null,
        achitat:     document.getElementById('ctb-achitat')?.checked || false,
        observatii:  document.getElementById('ctb-observatii')?.value?.trim() || null,
    };

    try {
        if (id) {
            await ZFlowDB.updateContributie(id, payload);
        } else {
            await ZFlowDB.insertContributie(payload);
        }
        // Reîncarcă lista și actualizează cashflow
        ZFlowStore.dateContributii = await ZFlowDB.fetchContributii() || [];
        invalidateCashflowCache();
        calculeazaCashflow();
        if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
        inchideModal('modal-contributie');
        showNotification('Contribuție salvată.', 'success');
    } catch (err) {
        ZFlowLogger.error('ctb', 'Eroare salvare contribuție:', err);
        showNotification('Eroare la salvare. Verificați consola.', 'error');
    }
}
window.salveazaContributie = salveazaContributie;

/**
 * Șterge contribuția activă (id-ul din câmpul ascuns ctb-id).
 */
async function stergeContributie() {
    const id = document.getElementById('ctb-id')?.value?.trim();
    if (!id) return;
    if (!confirm('Ștergeți această contribuție?')) return;
    try {
        await ZFlowDB.deleteContributie(id);
        ZFlowStore.dateContributii = await ZFlowDB.fetchContributii() || [];
        invalidateCashflowCache();
        calculeazaCashflow();
        if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
        inchideModal('modal-contributie');
        showNotification('Contribuție ștearsă.', 'success');
    } catch (err) {
        ZFlowLogger.error('ctb', 'Eroare ștergere contribuție:', err);
        showNotification('Eroare la ștergere. Verificați consola.', 'error');
    }
}
window.stergeContributie = stergeContributie;

/**
 * Import contribuții buget stat din fișier CSV.
 * Coloane așteptate (header case-insensitive): tip, suma, luna, achitat, observatii
 * @param {HTMLInputElement} input
 */
async function importaContributiiCSV(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { showNotification('Fișier CSV gol sau fără date.', 'error'); return; }
    const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const idx = k => headers.indexOf(k);
    let importate = 0, erori = 0;
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
        const suma = parseFloat((cols[idx('suma')] || '').replace(',', '.'));
        if (!suma || suma <= 0) { erori++; continue; }
        const _csvLuna = cols[idx('luna')] || null;
        const payload = {
            tip:        cols[idx('tip')] || 'Altele',
            suma,
            luna:       _csvLuna ? (_csvLuna.length === 7 ? _csvLuna + '-01' : _csvLuna) : null,
            achitat:    ['da','true','1','yes'].includes((cols[idx('achitat')] || '').toLowerCase()),
            observatii: cols[idx('observatii')] || null,
        };
        try { await ZFlowDB.insertContributie(payload); importate++; } catch(e) { erori++; }
    }
    ZFlowStore.dateContributii = await ZFlowDB.fetchContributii() || [];
    invalidateCashflowCache();
    if (typeof renderListaContributii === 'function') renderListaContributii();
    if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
    showNotification(`Import contribuții: ${importate} adăugate${erori > 0 ? `, ${erori} erori` : ''}.`, importate > 0 ? 'success' : 'error');
}
window.importaContributiiCSV = importaContributiiCSV;

function filtreazaListaFirme() {
    filtreazaListaFirmeDebounced();
}
window.filtreazaListaFirme = filtreazaListaFirme;

/**
 * Toggle secțiunea de filtrare firme (checkboxuri) — collapsible
 */
function toggleFirmeCollapse() {
    const panel = document.getElementById("bi-firme-collapse");
    const icon = document.getElementById("firme-collapse-icon");
    if (!panel) return;
    const isHidden = panel.classList.toggle("hidden");
    if (icon) icon.style.transform = isHidden ? "" : "rotate(180deg)";
    // Focus search când se deschide
    if (!isHidden) {
        setTimeout(() => document.getElementById("search-firme-collapse")?.focus(), 150);
    }
}

/**
 * Filtrare live a checkboxurilor din panoul "Filtrează firme" după nume sau CUI
 */
function filtreazaFirmeInCollapse(q) {
    const term = (q || "").toLowerCase().trim();
    const matchedInputs = [];
    // Clienți — caută și după CUI stocat în data-cui
    document.querySelectorAll("#container-bi-checks label").forEach(label => {
        const text = label.textContent.toLowerCase();
        const cui = (label.dataset.cui || "").toLowerCase();
        const matched = !term || text.includes(term) || cui.includes(term);
        label.style.display = matched ? "" : "none";
        if (term && matched) {
            const input = label.querySelector('input[type="checkbox"]');
            if (input) matchedInputs.push(input);
        }
    });
    // Furnizori — idem
    document.querySelectorAll("#container-bi-furnizori-checks label").forEach(label => {
        const text = label.textContent.toLowerCase();
        const cui = (label.dataset.cui || "").toLowerCase();
        const matched = !term || text.includes(term) || cui.includes(term);
        label.style.display = matched ? "" : "none";
        if (term && matched) {
            const input = label.querySelector('input[type="checkbox"]');
            if (input) matchedInputs.push(input);
        }
    });

    // Căutare firmă/CUI în Analiză: păstrează doar prima potrivire selectată și recalculează totalurile.
    if (term && matchedInputs.length > 0) {
        document.querySelectorAll('#container-bi-checks input, #container-bi-furnizori-checks input').forEach(c => {
            c.checked = false;
        });
        matchedInputs[0].checked = true;
        genereazaBI();
        return;
    }

    // Când căutarea este goală, resetăm selecția (nicio firmă bifată).
    if (!term) {
        let changed = false;
        document.querySelectorAll('#container-bi-checks input, #container-bi-furnizori-checks input').forEach(c => {
            if (c.checked) changed = true;
            c.checked = false;
        });
        if (changed) genereazaBI();
    }
}

// ==========================================
// DETALII CLIENT & FACTURI
// ==========================================

// ── Helpers sortare facturi după scadența cea mai apropiată de azi ──────────────
/** Parsare sigură dată: suportă YYYY-MM-DD (ISO) și DD/MM/YY sau DD/MM/YYYY */
function _parseInvoiceDateSafe(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s + (s.length === 10 ? 'T12:00:00' : ''));
        return isNaN(d) ? null : d;
    }
    if (s.includes('/')) {
        const p = s.split('/');
        if (p.length === 3) {
            let y = parseInt(p[2], 10); if (y < 100) y += 2000;
            const d = new Date(y, parseInt(p[1], 10) - 1, parseInt(p[0], 10), 12, 0, 0);
            return isNaN(d) ? null : d;
        }
    }
    return null;
}
/** Distanța în zile (valoare absolută) față de azi — folosit la sortare */
function _dueDistanceDaysForSort(dateStr, azi) {
    const d = _parseInvoiceDateSafe(dateStr);
    if (!d) return 9999;
    d.setHours(0, 0, 0, 0);
    return Math.abs(d - azi) / 86400000;
}
/** Comparator: facturi neachitate cu scadența cea mai apropiată de azi prime; achitate ultimele */
function _sortFacturiByDueClosest(a, b, azi, paidStatus) {
    const aPlata = a.status_plata === paidStatus;
    const bPlata = b.status_plata === paidStatus;
    if (aPlata && !bPlata) return 1;
    if (!aPlata && bPlata) return -1;
    return _dueDistanceDaysForSort(a.data_scadenta, azi) - _dueDistanceDaysForSort(b.data_scadenta, azi);
}

/**
 * Generează HTML pentru un card de factură (cu suport swipe pe mobile)
 * @param {Object} fac - Obiectul facturii
 * @param {Object} client - Obiectul clientului
 * @param {Date} azi - Data curentă (pentru comparații scadență)
 * @returns {string} HTML-ul cardului
 */
function genereazaCardFactura(fac, client, azi) {
    const isIncasat = fac.status_plata === "Incasat";
    const dScad = fac.data_scadenta ? new Date(fac.data_scadenta) : null;
    if (dScad) dScad.setHours(0, 0, 0, 0);
    const esteScadenta = !isIncasat && dScad && dScad < azi;
    const esteIminent = !isIncasat && dScad && !esteScadenta && dScad >= azi && dScad <= new Date(+azi + 5*86400000);
    const serie = fac.serie || fac.serie_factura || '';

    const f = client; // alias pentru compatibilitate cu codul vechi

    const uitHtml = fac.numar_auto ? `
        <div onclick="event.stopPropagation(); schimbaTab('logistic', document.querySelectorAll('.nav-item')[1])"
             class="flex items-center justify-center gap-2 bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl cursor-pointer hover:bg-blue-600 group transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-blue-900 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" />
            </svg>
            <span class="text-[10px] font-black text-blue-900 group-hover:text-white uppercase">${fac.numar_auto}</span>
        </div>` : `
        <div class="flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 px-3 py-2 rounded-xl opacity-40">
            <span class="text-[9px] font-bold text-slate-400 uppercase italic">FĂRĂ TRP</span>
        </div>`;

    return `
    <div class="card-factura-client rounded-2xl shadow-sm mb-3 relative overflow-hidden" data-nr="${fac.numar_factura}" data-serie="${serie}" data-factura-id="${fac.id}" data-status="${fac.status_plata}">
        <!-- Card Content -->
        <div class="card-flow flex flex-col gap-2 p-3 mb-2 ${isIncasat ? 'bg-white' : 'bg-red-50/40 border-red-100'} border rounded-2xl">
            <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2 ${fac.status_anaf === 'validated' ? 'bg-slate-50 border-slate-100' : 'bg-amber-50 border-amber-200 animate-pulse'} border px-2 py-2 rounded-xl">
                    <span class="flex h-2 w-2 relative">
                        <span class="relative inline-flex rounded-full h-2 w-2 ${fac.status_anaf === 'validated' ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                    </span>
                    <span class="text-[9px] font-black uppercase tracking-tighter ${fac.status_anaf === 'validated' ? 'text-emerald-700' : 'text-amber-700'}">
                        ${fac.status_anaf === 'validated' ? 'SPV VALIDAT' : 'SPV AȘTEPTARE'}
                    </span>
                </div>
                ${uitHtml}
            </div>

            <!-- Info row — stil identic cu #lista-facturi-platit-detaliu > .flex.items-center.justify-between -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="w-2 h-2 rounded-full flex-shrink-0 ${isIncasat ? 'bg-emerald-400' : esteScadenta ? 'bg-red-500' : esteIminent ? 'bg-amber-400' : 'bg-blue-400'}"></span>
                    <div>
                        <p class="text-[11px] font-black text-slate-800 uppercase">${serie ? escapeHtml(serie) + ' ' : ''}#${escapeHtml(fac.numar_factura) || '—'}</p>
                        <p class="text-[8px] font-bold text-slate-400 uppercase">Emis: ${formateazaDataZFlow(fac.data_emiterii)}</p>
                        <p class="text-[8px] font-bold ${esteScadenta ? 'text-red-400' : esteIminent ? 'text-amber-400' : 'text-slate-400'} uppercase">Scad: ${fac.data_scadenta ? formateazaDataZFlow(fac.data_scadenta) : '—'}</p>
                        ${esteScadenta ? '<span class="inline-block mt-0.5 bg-red-100 text-red-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">Depășit</span>' : esteIminent ? '<span class="inline-block mt-0.5 bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">Iminent</span>' : ''}
                    </div>
                </div>
                <div class="text-right">
                    <b class="text-xs ${isIncasat ? 'text-blue-900' : esteScadenta ? 'text-red-600' : 'text-amber-600'}">${Number(fac.valoare || 0).toLocaleString()} lei</b>
                    <p class="text-[7px] font-black uppercase ${isIncasat ? 'text-emerald-600' : esteScadenta ? 'text-red-500' : 'text-amber-500'}">${isIncasat ? 'ACHITAT' : esteScadenta ? 'RESTANT' : 'NEACHITAT'}</p>
                </div>
            </div>

            <div class="flex flex-col gap-2 mt-1">
                <button onclick="toggleStatusPlata('${fac.id}', '${fac.status_plata}')"
                        ${fac.is_imported ? 'disabled title="Facturat SAGA — status blocat"' : ''}
                        class="w-full ${fac.is_imported ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : isIncasat ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-blue-900 text-white hover:bg-blue-800'} h-11 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                    ${fac.is_imported ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg> SAGA' : isIncasat ? 'ACHITAT' : 'NEACHITAT'}
                </button>
                <div class="grid grid-cols-7 gap-1.5 w-full">
                <button onclick="deschideModal('modal-factura', '${fac.id}')"
                        class="h-11 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center border border-slate-100 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onclick="event.stopPropagation(); printInvoice('${fac.id}')"
                        class="h-11 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center border border-slate-100 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-200 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                ${(() => {
                    const pdfUrls = _getPDFUrls(fac);
                    if (pdfUrls.length === 0) {
                        return `<button onclick="deschideModal('modal-factura', '${fac.id}')" class="h-11 bg-white text-slate-300 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-100 hover:bg-slate-50 hover:text-slate-500 hover:border-slate-300 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                        </button>`;
                    } else if (pdfUrls.length === 1) {
                        return `<a href="${pdfUrls[0]}" target="_blank" class="h-11 bg-slate-800 text-white flex items-center justify-center rounded-xl shadow-sm hover:bg-slate-700 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /></svg>
                        </a>`;
                    } else {
                        // Multiple PDFs - dropdown-style button
                        return `<div class="relative h-11 group">
                            <button class="h-11 w-full bg-slate-800 text-white flex items-center justify-center gap-1 rounded-xl shadow-sm hover:bg-slate-700 transition-all px-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /></svg>
                                <span class="text-[9px] font-black">${pdfUrls.length}</span>
                            </button>
                            <div class="absolute bottom-12 left-0 hidden group-hover:flex flex-col gap-1 bg-white border border-slate-100 rounded-xl shadow-lg p-1.5 z-50 min-w-[120px]">
                                ${pdfUrls.map((url, i) => `<a href="${url}" target="_blank" class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 rounded-lg whitespace-nowrap">
                                    <svg class="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/></svg>
                                    PDF ${i + 1}
                                </a>`).join('')}
                            </div>
                        </div>`;
                    }
                })()}
                <button onclick="event.stopPropagation(); trimiteEmailDebitor('${escapeHtml(f.contact_email)}', '${escapeHtml(fac.numar_factura)}', '${fac.valoare}')"
                        class="h-11 ${esteScadenta ? 'bg-red-600 text-white animate-pulse hover:bg-red-700' : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600'} rounded-xl flex items-center justify-center transition-all"
                        title="Trimite Email">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0l-9.75 6.75-9.75-6.75m19.5 0l-9.75-6.75" /></svg>
                </button>
                <button onclick="event.stopPropagation(); trimiteWhatsAppReminder('${escapeHtml(f.telefon || '')}', '${escapeHtml(f.nume_firma || '')}', '${escapeHtml(fac.numar_factura)}', '${fac.valoare}', '${fac.data_scadenta || ''}')"
                        class="h-11 ${esteScadenta ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700'} rounded-xl flex items-center justify-center transition-all"
                        title="Trimite WhatsApp">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </button>
                <button onclick="event.stopPropagation(); trimiteShareFactura('${fac.id}')"
                        class="h-11 bg-sky-50 text-sky-500 rounded-xl flex items-center justify-center border border-sky-100 hover:bg-sky-100 hover:text-sky-600 hover:border-sky-200 transition-all"
                        title="Partajează">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
                </button>
                <button onclick="stergeFactura('${fac.id}')"
                        class="h-11 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 hover:bg-red-100 hover:text-red-600 hover:border-red-200 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                </div>
            </div>
        </div>
    </div>`;
}

/**
 * Arată detaliile unui client
 */
function arataDetalii(id) {
    const f = ZFlowStore.dateLocal.find((x) => String(x.id) === String(id));
    if (!f) return;

    const inputIdClient = document.getElementById("in-client-id");
    if (inputIdClient) inputIdClient.value = id;

    ZFlowStore.selectedClientId = id;
    comutaVedereFin("detalii");

    document.getElementById("btn-edit-client-active").onclick = () => deschideModal("modal-client", f.id);

    // Header Profil cu ALERTA pentru Scadență
    const sumaScadenta = f.sumaScadenta || 0;
    const areScadenta = sumaScadenta > 0;
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    document.getElementById("card-detaliu").innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <h2 class="text-2xl font-extrabold leading-tight">${escapeHtml(f.nume_firma || f.cui)}</h2>
                <div class="flex items-center gap-2 mt-1">${f.cui ? `<p class="text-blue-200 text-sm">CUI: ${escapeHtml(f.cui)}</p><button onclick="navigator.clipboard.writeText('${escapeHtml(f.cui)}').then(()=>showNotification('CUI copiat','success',1500))" class="text-blue-300 hover:text-white transition-colors flex-shrink-0" title="Copiază CUI"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>` : ''}</div>
            </div>
            <span class="text-3xl font-black text-white/80">${Math.round(f.sold).toLocaleString()} lei</span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
            ${f.oras ? `<div><p class="text-blue-300 text-[9px] uppercase font-bold">Oraș</p><p class="font-semibold">${escapeHtml(f.oras)}</p></div>` : ""}
            ${f.telefon ? `<div><p class="text-blue-300 text-[9px] uppercase font-bold">Telefon</p><a href="tel:${escapeHtml(f.telefon)}" class="font-semibold hover:text-white transition-colors">${escapeHtml(f.telefon)}</a></div>` : ""}
            ${f.persoana_contact ? `<div><p class="text-blue-300 text-[9px] uppercase font-bold">Contact</p><p class="font-semibold">${escapeHtml(f.persoana_contact)}</p></div>` : ""}
            ${f.contact_email ? `<div><p class="text-blue-300 text-[9px] uppercase font-bold">Email</p><a href="mailto:${escapeHtml(f.contact_email)}" class="font-semibold truncate hover:text-white transition-colors">${escapeHtml(f.contact_email)}</a></div>` : ""}
            ${f.iban ? `<div class="col-span-2"><p class="text-blue-300 text-[9px] uppercase font-bold">IBAN</p><div class="flex items-center gap-2"><p class="font-semibold font-mono text-xs flex-1">${escapeHtml(f.iban)}</p><button onclick="navigator.clipboard.writeText('${escapeHtml(f.iban)}').then(()=>showNotification('IBAN copiat','success',1500))" class="text-blue-300 hover:text-white transition-colors flex-shrink-0" title="Copiază IBAN"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button></div></div>` : ""}
        </div>
        ${areScadenta ? `
        <div class="mt-4 py-3 px-4 bg-red-500/20 rounded-2xl border border-red-400/50 flex justify-between items-center animate-pulse">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                <p class="text-[8px] font-black text-red-300 uppercase tracking-widest">Facturi Depășite</p>
            </div>
            <p class="text-red-200 font-black text-[14px] leading-none">${Math.round(sumaScadenta).toLocaleString()} lei</p>
        </div>` : ''}
    `;

    // Generăm secțiunea Istoric Plăți (#21 TODO)
    const istoricPlatiContainer = document.getElementById("istoric-plati-client");
    if (istoricPlatiContainer && f.facturi && f.facturi.length > 0) {
        const facturiIncasate = f.facturi.filter(fac => fac.status_plata === "Incasat");
        const facturiNeincasate = f.facturi.filter(fac => fac.status_plata !== "Incasat");
        const totalIncasat = facturiIncasate.reduce((sum, fac) => sum + Number(fac.valoare || 0), 0);
        const totalNeincasat = facturiNeincasate.reduce((sum, fac) => sum + Number(fac.valoare || 0), 0);
        const rataIncasare = f.facturi.length > 0 ? Math.round((facturiIncasate.length / f.facturi.length) * 100) : 0;
        
        // Ultimele 5 plăți cu dată
        const ultimelePlati = facturiIncasate
            .filter(fac => fac.data_plata)
            .sort((a, b) => new Date(b.data_plata) - new Date(a.data_plata))
            .slice(0, 5);
        
        const timelineHtml = ultimelePlati.length > 0 ? ultimelePlati.map(fac => `
            <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-slate-700 truncate">#${escapeHtml(fac.numar_factura)}</p>
                    <p class="text-[9px] text-slate-400">${formateazaDataZFlow(fac.data_plata)}</p>
                </div>
                <p class="text-[12px] font-black text-emerald-600">${Number(fac.valoare || 0).toLocaleString()} lei</p>
            </div>
        `).join('') : `
            <div class="text-center py-4">
                <p class="text-[10px] text-slate-400 italic">Nu există plăți înregistrate cu dată</p>
            </div>
        `;
        
        istoricPlatiContainer.innerHTML = `
            <div class="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <div class="flex items-center gap-2 mb-4">
                    <svg class="w-4 h-4 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <h4 class="text-[11px] font-black text-slate-800 uppercase tracking-wider">Istoric Plăți</h4>
                </div>
                
                <!-- Statistici Rapide -->
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <div class="bg-emerald-50 rounded-xl p-3 text-center">
                        <p class="text-[18px] font-black text-emerald-600">${rataIncasare}%</p>
                        <p class="text-[8px] font-bold text-emerald-700 uppercase">Rată încasare</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-3 text-center">
                        <p class="text-[14px] font-black text-slate-700">${facturiIncasate.length}</p>
                        <p class="text-[8px] font-bold text-slate-500 uppercase">Achitate</p>
                    </div>
                    <div class="bg-amber-50 rounded-xl p-3 text-center">
                        <p class="text-[14px] font-black text-amber-600">${facturiNeincasate.length}</p>
                        <p class="text-[8px] font-bold text-amber-700 uppercase">În așteptare</p>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="mb-4">
                    <div class="flex justify-between text-[9px] font-bold mb-1">
                        <span class="text-emerald-600">${totalIncasat.toLocaleString()} lei încasat</span>
                        <span class="text-slate-400">${totalNeincasat.toLocaleString()} lei restant</span>
                    </div>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style="width: ${rataIncasare}%"></div>
                    </div>
                </div>
                
                <!-- Timeline Ultimele Plăți -->
                <div class="border-t border-slate-100 pt-3">
                    <p class="text-[9px] font-bold text-slate-400 uppercase mb-2">Ultimele Plăți</p>
                    ${timelineHtml}
                </div>
            </div>
        `;
        istoricPlatiContainer.classList.remove('hidden');
    } else if (istoricPlatiContainer) {
        istoricPlatiContainer.classList.add('hidden');
    }

    const containerFacturi = document.getElementById("lista-facturi-detaliu");

    // Verificăm dacă clientul are facturi
    if (!f.facturi || f.facturi.length === 0) {
        showEmptyState(containerFacturi, "Nicio factură", "Acest client nu are facturi înregistrate. Adaugă o factură nouă sau importă din SAGA.", "invoices");
        return;
    }

    // Sortare Facturi — scadența cea mai apropiată de azi prima; achitate ultimele
    const facturiSortate = [...f.facturi].sort((a, b) => _sortFacturiByDueClosest(a, b, azi, 'Incasat'));

    // Generare HTML Facturi - cu Lazy Loading (#6 TODO)
    // Salvăm facturile sortate pentru Load More
    ZFlowStore.facturiSortateClient = facturiSortate;
    ZFlowStore.facturiLoadedCount = Math.min(facturiSortate.length, ZFlowStore.facturiPerPage);
    ZFlowStore.facturiTotalCount = facturiSortate.length;
    ZFlowStore.hasMoreFacturi = facturiSortate.length > ZFlowStore.facturiPerPage;
    // Dacă totalul din Supabase e mai mare decât facturile în memorie, avertizează
    if (ZFlowStore._facturiTotalSupabase > (ZFlowStore.dateFacturiBI?.length || 0)) {
        const lipsesc = ZFlowStore._facturiTotalSupabase - (ZFlowStore.dateFacturiBI?.length || 0);
        ZFlowLogger.warn('app', `[LazyLoad] ${lipsesc} facturi înărcate din Supabase — total real: ${ZFlowStore._facturiTotalSupabase}`); // [V3-FIX 5]
    }
    
    // Afișăm doar primele N facturi inițial
    const facturiDeAfisat = facturiSortate.slice(0, ZFlowStore.facturiPerPage);
    
    // Folosim funcția helper pentru generarea cardurilor cu suport swipe
    const htmlFacturi = facturiDeAfisat.map((fac) => genereazaCardFactura(fac, f, azi)).join("");

    // Bară de Căutare Sticky + Header Facturi + Selector per-page
    const ppFacturi = ZFlowStore.facturiPerPage || 20;
    containerFacturi.innerHTML = `
        <div class="sticky top-0 bg-[#f1f5f9]/95 backdrop-filter backdrop-blur-md z-30 pb-4 pt-2">
            <div class="relative">
                <input type="text" id="search-facturi-detaliu" oninput="filtreazaFacturiInDetalii()" placeholder="Caută nr. factură..." class="zf-search-input w-full h-12 pl-12 bg-white rounded-2xl border border-slate-200 text-[13px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                <div class="absolute left-4 top-3.5 text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>
        </div>
        <div class="flex items-center justify-between px-1 mb-2 mt-1">
            <span class="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5"><svg class="w-3 h-3 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.3"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5l8 7-8 7"/></svg>Facturi de Încasat</span>
            <div class="flex items-center gap-2">
                <span class="zf-category-label">Afișare</span>
                <select onchange="facturiSetPerPage(this.value)"
                        class="text-[10px] font-black text-slate-700 bg-slate-100 border-none rounded-lg px-2 py-1.5 cursor-pointer outline-none hover:bg-slate-200 transition-all">
                    <option value="10" ${ppFacturi===10?'selected':''}>10</option>
                    <option value="20" ${ppFacturi===20?'selected':''}>20</option>
                    <option value="50" ${ppFacturi===50?'selected':''}>50</option>
                    <option value="99999" ${ppFacturi>=99999?'selected':''}>Toate</option>
                </select>
                <span class="text-[9px] font-semibold text-slate-400">din ${facturiSortate.length}</span>
            </div>
        </div>
        <div id="lista-facturi-content" class="flex flex-col gap-3">${htmlFacturi}</div>
        ${ZFlowStore.hasMoreFacturi ? `
        <div id="load-more-facturi" class="mt-4 mb-6">
            <button onclick="loadMoreFacturiClient()" class="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                Încărcă mai multe (${ZFlowStore.facturiLoadedCount}/${ZFlowStore.facturiTotalCount})
            </button>
        </div>` : ''}`;
    
    // Inițializăm SwipeHandler pentru acțiunile touch pe mobile
    SwipeHandler.init('#lista-facturi-content');
}

/**
 * Filtrează facturile în detalii
 */
function filtreazaFacturiInDetalii() {
    const input = document.getElementById("search-facturi-detaliu");
    if (!input) return;

    const termen = input.value.toLowerCase().trim();
    const carduri = document.querySelectorAll("#lista-facturi-content .card-factura-client");
    const container = document.getElementById("lista-facturi-content");
    
    let visibleCount = 0;

    carduri.forEach(card => {
        const nrFactura = (card.getAttribute("data-nr") || "").toLowerCase();
        const serie     = (card.getAttribute("data-serie") || "").toLowerCase();

        if (!termen || nrFactura.includes(termen) || serie.includes(termen)) {
            card.style.setProperty("display", "flex", "important");
            visibleCount++;
        } else {
            card.style.setProperty("display", "none", "important");
        }
    });
    
    // Gestionăm empty state pentru căutare
    let emptySearchDiv = container?.querySelector(".empty-search-state");
    
    if (termen && visibleCount === 0) {
        // Adăugăm empty state dacă nu există
        if (!emptySearchDiv && container) {
            emptySearchDiv = document.createElement("div");
            emptySearchDiv.className = "empty-search-state col-span-full";
            emptySearchDiv.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 px-8">
                    <svg class="w-20 h-20 mx-auto mb-4" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8 4"/>
                        <circle cx="52" cy="52" r="20" stroke="#cbd5e1" stroke-width="3" fill="#f8fafc"/>
                        <path d="M66 66l16 16" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
                        <path d="M45 52h14M52 45v14" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
                    </svg>
                    <p class="font-bold text-slate-500 text-sm uppercase tracking-wider mb-2">Nicio factură găsită</p>
                    <p class="text-xs text-slate-400 text-center">Nu am găsit facturi cu numărul "<span class="font-semibold">${termen}</span>"</p>
                </div>`;
            container.appendChild(emptySearchDiv);
        }
    } else if (emptySearchDiv) {
        // Eliminăm empty state dacă există rezultate
        emptySearchDiv.remove();
    }
}

/**
 * Încarcă mai multe facturi pentru clientul curent (Lazy Loading)
 * #6 TODO - Lazy loading facturi
 */
async function loadMoreFacturiClient() {
    if (!ZFlowStore.facturiSortateClient || !ZFlowStore.hasMoreFacturi) return;
    
    const f = ZFlowStore.dateLocal.find((x) => String(x.id) === String(ZFlowStore.selectedClientId));
    if (!f) return;
    
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // [R4-FIX 1] Dacă am epuizat facturile in-memory DAR mai sunt în Supabase,
    // facem fetch pentru pagina următoare înainte de a continua paginarea in-memory
    const inMemoryTotal = ZFlowStore.dateFacturiBI?.length || 0;
    const supabaseTotal = ZFlowStore._facturiTotalSupabase || 0;
    const allInMemoryShown = ZFlowStore.facturiLoadedCount >= inMemoryTotal;

    if (allInMemoryShown && inMemoryTotal < supabaseTotal) {
        // Fetch pagina următoare din Supabase
        const nextOffset = inMemoryTotal;
        const pageSize = 100;
        const loadBtn = document.querySelector('#load-more-facturi button');
        if (loadBtn) loadBtn.disabled = true;

        try {
            const { data: newFacturi } = await ZFlowDB.fetchFacturiPage(pageSize, nextOffset);
            if (newFacturi && newFacturi.length > 0) {
                // Adaugă la store fără a re-randa tot
                ZFlowStore.dateFacturiBI = [...(ZFlowStore.dateFacturiBI || []), ...newFacturi];
                // Recalculează facturiSortateClient pentru clientul curent
                const clientId = ZFlowStore.selectedClientId;
                const clientFacturi = ZFlowStore.dateFacturiBI.filter(
                    f => String(f.client_id) === String(clientId)
                );
                // Re-sortează și actualizează
                ZFlowStore.facturiSortateClient = clientFacturi.sort((a, b) => {
                    // Păstrează logica de sortare existentă: restante primele
                    const aDepas = a.status_plata !== 'Incasat' && a.data_scadenta && new Date(a.data_scadenta) < new Date();
                    const bDepas = b.status_plata !== 'Incasat' && b.data_scadenta && new Date(b.data_scadenta) < new Date();
                    const aPriority = aDepas ? 3 : (a.status_plata !== 'Incasat' ? 2 : 1);
                    const bPriority = bDepas ? 3 : (b.status_plata !== 'Incasat' ? 2 : 1);
                    if (aPriority !== bPriority) return bPriority - aPriority;
                    return 0;
                });
                ZFlowStore.facturiTotalCount = ZFlowStore.facturiSortateClient.length;
                ZFlowStore.hasMoreFacturi = ZFlowStore.facturiTotalCount > ZFlowStore.facturiLoadedCount
                    || ZFlowStore.dateFacturiBI.length < supabaseTotal;
            }
        } catch (e) {
            ZFlowLogger.error('app', '[LazyLoad R4] Fetch pagina:', e);
            showNotification('Eroare la încărcarea facturilor suplimentare', 'error');
            if (loadBtn) loadBtn.disabled = false;
            return;
        }
        if (loadBtn) loadBtn.disabled = false;
    }

    const start = ZFlowStore.facturiLoadedCount;
    const end = Math.min(start + ZFlowStore.facturiPerPage, ZFlowStore.facturiTotalCount);
    const facturiNoi = ZFlowStore.facturiSortateClient.slice(start, end);
    
    // Generăm HTML pentru facturile noi folosind funcția helper
    const htmlNou = facturiNoi.map((fac) => genereazaCardFactura(fac, f, azi)).join("");
    
    // Adăugăm la container
    const container = document.getElementById("lista-facturi-content");
    if (container) {
        container.insertAdjacentHTML('beforeend', htmlNou);
    }
    
    // Re-inițializăm SwipeHandler pentru noile carduri
    SwipeHandler.init('#lista-facturi-content');
    
    // Actualizăm contorul
    ZFlowStore.facturiLoadedCount = end;
    // [R4-FIX 1] hasMoreFacturi = mai sunt în memorie SAU mai sunt în Supabase
    ZFlowStore.hasMoreFacturi = end < ZFlowStore.facturiTotalCount
        || (ZFlowStore.dateFacturiBI?.length || 0) < (ZFlowStore._facturiTotalSupabase || 0);
    
    // Actualizăm sau ascundem butonul
    const loadMoreDiv = document.getElementById("load-more-facturi");
    if (loadMoreDiv) {
        if (ZFlowStore.hasMoreFacturi) {
            // [R4-FIX 1] Dacă mai sunt facturi de adus din Supabase, arată indicator diferit
            const moreFromServer = (ZFlowStore.dateFacturiBI?.length || 0) < (ZFlowStore._facturiTotalSupabase || 0);
            const remainingLocal = ZFlowStore.facturiTotalCount - ZFlowStore.facturiLoadedCount;
            const label = moreFromServer && remainingLocal === 0
                ? `⬇ Încarcă din server (${ZFlowStore._facturiTotalSupabase - ZFlowStore.dateFacturiBI.length} rămase)`
                : `Încarcă mai multe (${ZFlowStore.facturiLoadedCount}/${ZFlowStore.facturiTotalCount})`;
            loadMoreDiv.querySelector("button").innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                ... ${label}`;
        } else {
            loadMoreDiv.innerHTML = `
                <div class="text-center py-4 text-slate-400 text-[10px] font-bold uppercase flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                    Toate facturile încărcate (${ZFlowStore.facturiTotalCount})
                </div>`;
        }
    }
    
    showNotification(`Încărcate ${facturiNoi.length} facturi`, "info");
}

// ==========================================
// ANALIZĂ BI
// ==========================================

/**
 * Populează UI-ul pentru analiză BI
 */
function populeazaBridgeUI() {
    // Dropdown factură
    const selectClient = document.getElementById("in-fac-client");
    if (selectClient) {
        selectClient.innerHTML =
            '<option value="">Alege Clientul...</option>' +
            ZFlowStore.dateLocal.map((f) => `<option value="${f.id}">${escapeHtml(f.nume_firma || f.cui)}</option>`).join("");
    }

    // Checkbox-uri clienți pentru analiză
    const containerBI = document.getElementById("container-bi-checks");
    if (containerBI) {
        containerBI.innerHTML = ZFlowStore.dateLocal
            .map((f) => `
                <label data-cui="${escapeHtml(String(f.cui || ''))}" onclick="selectSingleBIFirma('${f.id}', 'client', event)" class="flex justify-between items-center p-4 bg-slate-50 rounded-xl mb-1 text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                    <span>${escapeHtml(f.nume_firma || f.cui)}</span>
                    <input type="checkbox" value="${f.id}" checked
                           onclick="event.stopPropagation()"
                           onchange="genereazaBI()"
                           class="w-5 h-5 accent-blue-900 bi-checkbox">
                </label>
            `)
            .join("");
    }

    // Checkbox-uri furnizori pentru analiză
    const containerBIFurnizori = document.getElementById("container-bi-furnizori-checks");
    if (containerBIFurnizori) {
        containerBIFurnizori.innerHTML = ZFlowStore.dateFurnizori
            .map((f) => `
                <label data-cui="${escapeHtml(String(f.cui || ''))}" onclick="selectSingleBIFirma('${f.id}', 'furnizor', event)" class="flex justify-between items-center p-4 bg-red-50 rounded-xl mb-1 text-[10px] font-bold uppercase cursor-pointer hover:bg-red-100 transition-colors">
                    <span>${escapeHtml(f.nume_firma || f.cui)}</span>
                    <input type="checkbox" value="${f.id}" checked
                           onclick="event.stopPropagation()"
                           onchange="genereazaBI()"
                           class="w-5 h-5 accent-red-700 bi-furn-checkbox">
                </label>
            `)
            .join("");
    }

    // Aplica vizibilitate seciuni SI coloane totale conform filtruTipBI curent
    const clientiSection = document.getElementById("bi-clienti-section");
    const furnizoriSection = document.getElementById("bi-furnizori-section");
    if (clientiSection) clientiSection.classList.toggle("hidden", ZFlowStore.filtruTipBI === "furnizori");
    if (furnizoriSection) furnizoriSection.classList.toggle("hidden", ZFlowStore.filtruTipBI === "clienti");

    const colClienti = document.getElementById("bi-total-clienti-col");
    const colFurnizori = document.getElementById("bi-total-furnizori-col");
    if (colClienti) colClienti.classList.toggle("hidden", ZFlowStore.filtruTipBI === "furnizori");
    if (colFurnizori) colFurnizori.classList.toggle("hidden", ZFlowStore.filtruTipBI === "clienti");

    // Sync buton Plătit
    const btnPlatit = document.getElementById("bi-btn-platit");
    if (btnPlatit) btnPlatit.classList.toggle("hidden", ZFlowStore.filtruTipBI === "clienti");

    const includeContrib = document.getElementById('bi-include-contributii');
    if (includeContrib) includeContrib.checked = !!ZFlowStore.includeContributiiInAnaliza;

    genereazaBI();
}

/**
 * Selectează rapid o singură firmă în analiză (fără pasul „Niciuna”).
 */
function selectSingleBIFirma(id, tip, event) {
    if (event?.target?.tagName === 'INPUT') return;
    const allChecks = document.querySelectorAll('#container-bi-checks input, #container-bi-furnizori-checks input');
    allChecks.forEach(c => { c.checked = false; });
    const selector = tip === 'furnizor'
        ? `#container-bi-furnizori-checks input[value="${String(id)}"]`
        : `#container-bi-checks input[value="${String(id)}"]`;
    const target = document.querySelector(selector);
    if (target) target.checked = true;
    genereazaBI();
}

function toggleContributiiInAnaliza(checked) {
    ZFlowStore.includeContributiiInAnaliza = !!checked;
    invalidateCashflowCache();
    genereazaBI();
}

/**
 * Toggle toate/niciuna UNIFICAT — select/deselect toate checkbox-urile vizibile
 * (clienți dacă sectiunea e vizibilă, furnizori dacă secțiunea e vizibilă)
 */
function toggleToateBI(status) {
    const clientiSection = document.getElementById("bi-clienti-section");
    const furnizoriSection = document.getElementById("bi-furnizori-section");
    if (clientiSection && !clientiSection.classList.contains("hidden")) {
        clientiSection.querySelectorAll("input[type=checkbox]").forEach(c => c.checked = status);
    }
    if (furnizoriSection && !furnizoriSection.classList.contains("hidden")) {
        furnizoriSection.querySelectorAll("input[type=checkbox]").forEach(c => c.checked = status);
    }
    genereazaBI();
}

/**
 * Toggle toate firmele în BI (păstrat pentru compatibilitate)
 */
function toggleFirmeBI(status) {
    document.querySelectorAll("#container-bi-checks input").forEach((c) => (c.checked = status));
    genereazaBI();
}

// ==========================================
// NOTIFICĂRI PUSH SCADENȞE - #12
// ==========================================

/**
 * Actualizează vizual butonul bell din header
 */
function updateBellUI(count) {
    const bell = document.getElementById('btn-bell-notif');
    if (!bell) return;
    const badge = document.getElementById('bell-badge');

    // Actualizeaza badge-ul intotdeauna, indiferent de permisiunea notificarilor
    if (count > 0) {
        if (badge) { badge.textContent = count > 9 ? '9+' : count; badge.classList.remove('hidden'); }
        bell.classList.remove('text-emerald-500', 'opacity-30');
        bell.classList.add('text-amber-500');
    } else {
        if (badge) badge.classList.add('hidden');
        bell.classList.remove('text-amber-500');
    }

    if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
        bell.title = 'Notificările sunt blocate în browser';
        bell.classList.add('opacity-30');
        return;
    }
    if (Notification.permission === 'default') {
        bell.title = 'Clic pentru a activa notificările de scadență';
        return;
    }
    // Granted
    if (count > 0) {
        if (badge) { badge.textContent = count > 9 ? '9+' : count; badge.classList.remove('hidden'); }
        bell.title = `${count} facturi scadente azi sau mâine`;
        bell.classList.add('text-amber-500');
    } else {
        if (badge) badge.classList.add('hidden');
        bell.title = 'Nicio scadență iminenta';
        bell.classList.remove('text-amber-500');
        bell.classList.add('text-emerald-500');
    }
}

/**
 * Verifică facturile scadente și trimite notificări (o singură dată per sesiune)
 * #12 - Notificări push scadențe
 */
function verificaScadenteNotificari() {
    const azi = new Date().toISOString().split('T')[0];
    const maine = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Include restante (data depasita), scadente azi si scadente maine
    const scadente = ZFlowStore.dateFacturiBI.filter(f =>
        f.status_plata === 'Neincasat' &&
        f.data_scadenta &&
        (f.data_scadenta <= maine)
    );

    updateBellUI(scadente.length);

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    // Arata notificarile o singura data per sesiune
    if (sessionStorage.getItem('zflow_notif_shown')) return;
    sessionStorage.setItem('zflow_notif_shown', '1');

    const scadenteAzi = scadente.filter(f => f.data_scadenta === azi);
    const scadenteMaine = scadente.filter(f => f.data_scadenta === maine);
    const restante = scadente.filter(f => f.data_scadenta < azi);

    if (restante.length > 0) {
        try {
            new Notification(`${restante.length} Facturi Restante — Z-FLOW`, {
                body: restante.slice(0, 3).map(f => {
                    const c = ZFlowStore.dateLocal.find(cl => String(cl.id) === String(f.client_id));
                    return `Factura ${f.numar_factura} · ${c?.nume_firma || ''} · ${f.data_scadenta}`.trim();
                }).join('\n') + (restante.length > 3 ? `\n...si inca ${restante.length - 3}` : ''),
                icon: 'icons/icon.svg',
                tag: 'zflow-restante'
            });
        } catch(e) { ZFlowLogger.warn('app', 'Notif error:', e); }
    }

    scadenteAzi.forEach(fac => {
        const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(fac.client_id));
        const numeClient = client?.nume_firma || 'Client';
        const valFormatat = Number(fac.valoare).toLocaleString('ro-RO', { minimumFractionDigits: 2 });
        try {
            new Notification('⏰ Scadență AZI — Z-FLOW', {
                body: `Factura ${fac.numar_factura} · ${numeClient} · ${valFormatat} lei`,
                icon: 'icons/icon.svg',
                tag: `zflow-scad-${fac.id}`,
                requireInteraction: false
            });
        } catch(e) { ZFlowLogger.warn('app', 'Notif error:', e); }
    });

    if (scadenteMaine.length > 0) {
        try {
            new Notification(`${scadenteMaine.length} Scadențe Mâine — Z-FLOW`, {
                body: scadenteMaine.map(f => {
                    const c = ZFlowStore.dateLocal.find(cl => String(cl.id) === String(f.client_id));
                    return `Factura ${f.numar_factura} · ${c?.nume_firma || ''}`.trim();
                }).join('\n'),
                icon: 'icons/icon.svg',
                tag: 'zflow-scad-maine'
            });
        } catch(e) { ZFlowLogger.warn('app', 'Notif error:', e); }
    }
}

/**
 * Toggle/Solicită permisiunea pentru notificări push
 */
async function toggleBellNotificari() {
    if (typeof Notification === 'undefined') {
        showNotification('Notificările nu sunt suportate pe acest dispozitiv', 'warning');
        return;
    }
    if (Notification.permission === 'denied') {
        showNotification('Notificările sunt blocate. Le poți activa din setarile browserului.', 'warning');
        return;
    }
    if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
            showNotification('Notificări activate! Vei fi anunțat la scadențe.', 'success');
            sessionStorage.removeItem('zflow_notif_shown'); // permite re-triggering
            verificaScadenteNotificari();
        } else {
            showNotification('Notificările au fost refuzate.', 'warning');
            updateBellUI(0);
        }
        return;
    }
    // Deja granted - re-verifică scadențele
    sessionStorage.removeItem('zflow_notif_shown');
    verificaScadenteNotificari();
    showNotification('Notificările sunt active', 'info');
}

/**
 * Recalculează analiza instant
 */
function updateAnalizaInstant() {
    if (!document.getElementById("view-analiza") || document.getElementById("view-analiza").classList.contains("hidden")) return;
    genereazaBI();
}

/**
 * Generează raportul BI
 */
function genereazaBI() {
    // Resetează butonul "Selectează toate" la fiecare re-render (lista s-a schimbat)
    _resetBulkSelectAllBtn();
    const startVal = document.getElementById("data-start")?.value || ZFlowStore.biStartVal || null;
    const endVal = document.getElementById("data-end")?.value || ZFlowStore.biEndVal || null;
    const q = document.getElementById("search-bi")?.value.toLowerCase();
    const container = document.getElementById("rezultat-analiza");
    const sumaDisplay = document.getElementById("suma-selectata-bi");
    if (!container) return;

    // NEPLĂTITE = doar facturi furnizori neplătite, skip secțiunea clienți
    if (ZFlowStore.filtruStatusBI === 'Platit') {
        if (sumaDisplay) sumaDisplay.innerText = "0 lei";
        container.innerHTML = '';
        const sVN = document.getElementById("data-start")?.value;
        const eVN = document.getElementById("data-end")?.value;
        const qN = document.getElementById("search-bi")?.value.toLowerCase();
        const sDN = sVN ? new Date(sVN + "T00:00:00") : null;
        const eDN = eVN ? new Date(eVN + "T23:59:59") : null;
        appendFurnizoriBI(container, sDN, eDN, qN);
        calculeazaCashflow();
        return;
    }

    // Resetează suma furnizori — va fi recalculată de appendFurnizoriBI doar pentru tab Toate
    const sumaPlatitEl = document.getElementById("suma-platit-bi");
    if (sumaPlatitEl) sumaPlatitEl.innerText = "0 lei";

    const ids = Array.from(document.querySelectorAll("#container-bi-checks input:checked")).map((i) => String(i.value));
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Convertim datele de filtru în obiecte Date pentru comparație corectă
    const startDate = startVal ? new Date(startVal) : null;
    const endDate = endVal ? new Date(endVal) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    // Debug log
    ZFlowLogger.debug('app', "🔍 Filtrare BI - Start:", startVal, "End:", endVal, "Clienți selectați:", ids.length, "Total facturi:", ZFlowStore.dateFacturiBI.length);
    
    // Log primele 3 facturi pentru debug
    if (ZFlowStore.dateFacturiBI.length > 0) {
        ZFlowLogger.debug('app', "📋 Sample facturi (primele 3):");
        ZFlowStore.dateFacturiBI.slice(0, 3).forEach((f, i) => {
            ZFlowLogger.debug('app', `  ${i+1}. data_emiterii: "${f.data_emiterii}", created_at: "${f.created_at}", nr: ${f.numar_factura}`);
        });
    }

    const filtrate = ZFlowStore.dateFacturiBI.filter((f) => {
        // Folosim data_emiterii pentru filtrare, cu fallback la created_at
        const dataFactura = f.data_emiterii || f.created_at || "";
        
        // Parsăm data - suportăm mai multe formate
        let facturaDate = null;
        if (dataFactura) {
            // Verificăm dacă e în format DD/MM/YY sau DD/MM/YYYY
            if (dataFactura.includes("/")) {
                const parts = dataFactura.split("/");
                if (parts.length === 3) {
                    let year = parseInt(parts[2]);
                    if (year < 100) year += 2000; // 26 -> 2026
                    facturaDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            } else {
                // Format ISO sau similar
                facturaDate = new Date(dataFactura);
            }
            if (facturaDate) facturaDate.setHours(12, 0, 0, 0);
        }
        
        // Verificăm dacă data e validă
        const dateValid = facturaDate && !isNaN(facturaDate.getTime());
        
        // Match pe interval de date
        let matchData = true;
        if (startDate && dateValid) {
            matchData = matchData && facturaDate >= startDate;
        }
        if (endDate && dateValid) {
            matchData = matchData && facturaDate <= endDate;
        }
        
        // 'Platit' (Neplătite) filtrează furnizori, nu clienți — clienții apar toți
        // 'Neincasat' (Restante) = orice factură care NU este Incasată
        const matchStatus = ZFlowStore.filtruStatusBI === "toate" ||
                            ZFlowStore.filtruStatusBI === "Platit" ||
                            (ZFlowStore.filtruStatusBI === "Neincasat"
                                ? f.status_plata !== "Incasat"
                                : f.status_plata === ZFlowStore.filtruStatusBI);
        const client = ZFlowStore.dateLocal.find((c) => String(c.id) === String(f.client_id));
        const numeClient = (client?.nume_firma || "").toLowerCase();
        const nrFactura = (f.numar_factura || "").toLowerCase();
        const matchSearch = !q || numeClient.includes(q) || nrFactura.includes(q);
        return matchData && ids.includes(String(f.client_id)) && matchStatus && matchSearch;
    });

    ZFlowLogger.debug('app', "✅ Facturi filtrate:", filtrate.length);

    // Sortare
    filtrate.sort((a, b) => {
        const aScad = a.data_scadenta ? new Date(a.data_scadenta).setHours(0, 0, 0, 0) : null;
        const bScad = b.data_scadenta ? new Date(b.data_scadenta).setHours(0, 0, 0, 0) : null;
        const aDepas = a.status_plata !== "Incasat" && aScad && aScad < azi ? 1 : 0;
        const bDepas = b.status_plata !== "Incasat" && bScad && bScad < azi ? 1 : 0;

        const aPriority = aDepas ? 3 : (a.status_plata !== "Incasat" ? 2 : 1);
        const bPriority = bDepas ? 3 : (b.status_plata !== "Incasat" ? 2 : 1);

        if (aPriority !== bPriority) return bPriority - aPriority;
        if (aScad && bScad && (aDepas || bDepas)) return aScad - bScad;
        if (aScad && bScad) return aScad - bScad;
        return 0;
    });

    const total = filtrate.reduce((acc, f) => acc + (Number(f.valoare) || 0), 0);
    if (sumaDisplay) sumaDisplay.innerText = `${Math.round(total).toLocaleString()} lei`;

    // Paginare
    const totalPages = ZFlowStore.biPageSize === 0 ? 1 : (Math.ceil(filtrate.length / ZFlowStore.biPageSize) || 1);
    if (ZFlowStore.biCurrentPage > totalPages) ZFlowStore.biCurrentPage = totalPages;
    const pageInfo = document.getElementById("bi-page-info");
    if (pageInfo) pageInfo.innerText = `Pagina ${ZFlowStore.biCurrentPage} din ${totalPages} (${filtrate.length} facturi)`;
    _renderBIPagination(filtrate.length);

    if (filtrate.length === 0) {
        showEmptyState(container, "Niciun rezultat", "Nu există facturi pentru perioada și filtrele selectate. Modifică intervalul de date sau clienții selectați.", "period");
        if (ZFlowStore.filtruStatusBI === 'toate') {
            appendFurnizoriBI(container, startDate, endDate, q);
        }
        calculeazaCashflow();
        return;
    }

    const startIdx = ZFlowStore.biPageSize === 0 ? 0 : (ZFlowStore.biCurrentPage - 1) * ZFlowStore.biPageSize;
    const endIdx = ZFlowStore.biPageSize === 0 ? filtrate.length : startIdx + ZFlowStore.biPageSize;
    const paginatedData = filtrate.slice(startIdx, endIdx);

    container.innerHTML = paginatedData.map((f) => {
        try {
        const client = ZFlowStore.dateLocal.find((c) => String(c.id) === String(f.client_id));
        const isIncasat = f.status_plata === "Incasat";
        const isSelected = ZFlowStore.bulkSelectedFacturi.includes(String(f.id));
        const checkboxHtml = ZFlowStore.bulkMode ? `
            <input type="checkbox" class="bulk-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                   data-factura-id="${f.id}" 
                   ${isSelected ? 'checked' : ''} 
                   onclick="event.stopPropagation(); toggleBulkSelectFactura('${f.id}')" />` : '';
        const pdfUrls = _getPDFUrls(f);
        const pdfLink = pdfUrls.length > 0 ? `<a href="${pdfUrls[0]}" target="_blank" onclick="event.stopPropagation()" class="text-blue-400 flex-shrink-0"><svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/></svg></a>` : '';
        return `<div class="flex items-center gap-2 px-3 py-2 rounded-xl mb-1 border ${isIncasat ? 'bg-white border-slate-100' : 'bg-red-50/40 border-red-100'} ${isSelected ? 'ring-2 ring-blue-500' : ''} cursor-pointer hover:shadow-sm transition-all" data-client-id="${f.client_id}" data-factura-id="${f.id}" ${ZFlowStore.bulkMode ? `onclick="toggleBulkSelectFactura('${f.id}')"` : ''}>
            ${checkboxHtml}
            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${isIncasat ? 'bg-emerald-400' : 'bg-red-400'}"></span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-black text-slate-800 uppercase truncate">${escapeHtml(client?.nume_firma || 'Client')}</span>
                ${pdfLink}
              </div>
              <span class="text-[8px] text-slate-400 font-semibold">#${escapeHtml(f.numar_factura)} &middot; ${formateazaDataZFlow(f.data_emiterii)}${f.data_scadenta ? ' &middot; S: ' + formateazaDataZFlow(f.data_scadenta) : ''}</span>
            </div>
            <b class="text-[0.875rem] font-semibold flex-shrink-0 ${isIncasat ? 'text-blue-900' : 'text-red-600'} tabular-nums">${Math.round(Number(f.valoare) || 0).toLocaleString()} lei</b>
        </div>`;
        } catch(cardErr) {
            ZFlowLogger.warn('app', '[BI] Eroare randare factură:', cardErr, f);
            return `<div class="text-xs text-red-400 px-3 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare factură #${f?.numar_factura || '?'}</div>`;
        }
    }).join("") + '<div id="bi-pagination" class="mt-1"></div>';
    _renderBIPagination(filtrate.length);

    // Append furnizori doar în modul TOATE
    if (ZFlowStore.filtruStatusBI === 'toate') {
        appendFurnizoriBI(container, startDate, endDate, q);
    }

    // Actualizează cardul cashflow
    calculeazaCashflow();
}

/**
 * Render DOAR furnizori în panoul de analiză (mode furnizori)
 */
function renderFurnizoriBI() {
    const container = document.getElementById("rezultat-analiza");
    if (!container) return;

    const startVal = document.getElementById("data-start")?.value;
    const endVal = document.getElementById("data-end")?.value;
    const q = document.getElementById("search-bi")?.value.toLowerCase();
    const startDate = startVal ? new Date(startVal + "T00:00:00") : null;
    const endDate = endVal ? new Date(endVal + "T23:59:59") : null;
    const azi = new Date(); azi.setHours(0,0,0,0);

    const activeIds = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));

    const filtrate = _filtreazaFacturiPlatit(startDate, endDate, activeIds, q);

    // Update totals display
    const sumaClienti = document.getElementById("suma-selectata-bi");
    const sumaFurnizori = document.getElementById("suma-platit-bi");
    if (sumaClienti) sumaClienti.innerText = "0 lei";
    const total = filtrate.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    if (sumaFurnizori) sumaFurnizori.innerText = `${Math.round(total).toLocaleString()} lei`;

    if (filtrate.length === 0) {
        showEmptyState(container, "Niciun rezultat", "Nu există facturi de plătit pentru filtrele selectate.", "period");
        _renderFurnizoriBIPagination(0);
        calculeazaCashflow();
        return;
    }

    // Salvează lista filtrată și aplică paginare
    ZFlowStore._furnizoriBIFiltrati = filtrate;
    const fbiPS = ZFlowStore.furnizoriBIPageSize != null ? ZFlowStore.furnizoriBIPageSize : 5;
    const fbiCP = ZFlowStore.furnizoriBICurrentPage || 1;
    const fbiStart = fbiPS === 0 ? 0 : (fbiCP - 1) * fbiPS;
    const fbiEnd   = fbiPS === 0 ? filtrate.length : fbiStart + fbiPS;
    const paginated = filtrate.slice(fbiStart, fbiEnd);

    container.innerHTML = _htmlFurnizoriRows(paginated, azi) + '<div id="bi-pagination-furnizori" class="mt-1"></div>';
    _renderFurnizoriBIPagination(filtrate.length);
    calculeazaCashflow();
}

/**
 * Adaugă furnizori rows după clienți rows (mode ambele) — cu paginare
 */
function appendFurnizoriBI(container, startDate, endDate, q) {
    const sumaPlatit2 = document.getElementById("suma-platit-bi");

    const activeIds = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));

    if (activeIds.length === 0) { _renderFurnizoriBIPagination(0); return; }

    const azi = new Date(); azi.setHours(0,0,0,0);
    const filtrate = _filtreazaFacturiPlatit(startDate, endDate, activeIds, q);

    // Salvează pentru navigare pagini
    ZFlowStore._furnizoriBIFiltrati = filtrate;

    const total2 = filtrate.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    if (sumaPlatit2) sumaPlatit2.innerText = `${Math.round(total2).toLocaleString()} lei`;
    if (filtrate.length === 0) { _renderFurnizoriBIPagination(0); return; }

    // Paginare furnizori BI
    const fbiPS = ZFlowStore.furnizoriBIPageSize != null ? ZFlowStore.furnizoriBIPageSize : 5;
    const fbiCP = ZFlowStore.furnizoriBICurrentPage || 1;
    const fbiStart = fbiPS === 0 ? 0 : (fbiCP - 1) * fbiPS;
    const fbiEnd   = fbiPS === 0 ? filtrate.length : fbiStart + fbiPS;
    const paginated = filtrate.slice(fbiStart, fbiEnd);

    // Separator + furnizori rows (paginate)
    container.innerHTML += `
<div class="w-full flex items-center gap-3 my-4">
  <div class="flex-1 h-px bg-red-100"></div>
  <span class="text-[9px] font-black text-red-600 uppercase tracking-widest px-2 py-1 bg-red-50 rounded-full">Furnizori — Facturi de Plătit (${filtrate.length})</span>
  <div class="flex-1 h-px bg-red-100"></div>
</div>
${_htmlFurnizoriRows(paginated, azi)}
<div id="bi-pagination-furnizori" class="mt-1"></div>`;

    _renderFurnizoriBIPagination(filtrate.length);
}

/**
 * Filtrare comună facturi_platit după dată + furnizori IDs + căutare text
 */
function _filtreazaFacturiPlatit(startDate, endDate, furnizoriIds, q) {
    const statusFiltru = ZFlowStore.filtruStatusBI || 'toate';
    return (ZFlowStore.dateFacturiPlatit || []).filter(f => {
        // 'Neplătite' = arată facturi neplătite către furnizori (excludem cele deja plătite)
        if (statusFiltru === 'Platit' && f.status_plata === 'Platit') return false;
        // 'Restante'/'Incasate' se aplică doar clienților — furnizorii apar toți

        const furnizor = ZFlowStore.dateFurnizori.find(furn => String(furn.id) === String(f.furnizor_id));
        const numeFurnizor = (furnizor?.nume_firma || "").toLowerCase();
        const nrFac = (f.numar_factura || "").toLowerCase();
        const matchSearch = !q || numeFurnizor.includes(q) || nrFac.includes(q);
        if (!matchSearch) return false;
        if (!furnizoriIds.includes(String(f.furnizor_id))) return false;

        const dataFactura = f.data_emiterii || f.created_at || "";
        let facturaDate = dataFactura ? new Date(dataFactura) : null;
        if (facturaDate) facturaDate.setHours(12,0,0,0);
        const dateValid = facturaDate && !isNaN(facturaDate.getTime());
        let matchData = true;
        if (startDate && dateValid) matchData = matchData && facturaDate >= startDate;
        if (endDate && dateValid) matchData = matchData && facturaDate <= endDate;
        return matchData;
    });
}

/**
 * Generează HTML rows pentru furnizori (folosit de render + append)
 */
function _htmlFurnizoriRows(filtrate, azi) {
    return filtrate.sort((a, b) => {
        const aOk = a.status_plata === "Platit"; const bOk = b.status_plata === "Platit";
        if (aOk && !bOk) return 1; if (!aOk && bOk) return -1; return 0;
    }).map(f => {
        try {
        const furnizor = ZFlowStore.dateFurnizori.find(furn => String(furn.id) === String(f.furnizor_id));
        const isPlatit = f.status_plata === "Platit";
        const isDepasit = !isPlatit && f.data_scadenta && new Date(f.data_scadenta).setHours(0,0,0,0) < azi;
        const isSelected = ZFlowStore.bulkMode && ZFlowStore.bulkSelectedFacturi.includes(String(f.id));
        const checkboxHtml = ZFlowStore.bulkMode ? `
            <input type="checkbox" class="bulk-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer flex-shrink-0"
                   data-factura-id="${f.id}" ${isSelected ? 'checked' : ''}
                   onclick="event.stopPropagation(); toggleBulkSelectFactura('${f.id}')"/>` : '';
        return `<div class="flex items-center gap-2 px-3 py-2 rounded-xl mb-1 border ${isPlatit ? 'bg-white border-slate-100' : 'bg-red-50/40 border-red-100'} ${isSelected ? 'ring-2 ring-blue-400' : ''} hover:shadow-sm transition-all ${ZFlowStore.bulkMode ? 'cursor-pointer' : ''}" data-furnizor-id="${f.furnizor_id}" data-factura-id="${f.id}" ${ZFlowStore.bulkMode ? `onclick="toggleBulkSelectFactura('${f.id}')"` : ''}>
    ${checkboxHtml}
    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPlatit ? 'bg-emerald-400' : isDepasit ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}"></span>
    <div class="flex-1 min-w-0">
        <span class="text-[10px] font-black text-slate-800 uppercase truncate block">${escapeHtml(furnizor?.nume_firma || 'Furnizor')}</span>
        <span class="text-[8px] text-slate-400 font-semibold">#${escapeHtml(f.numar_factura || '—')} &middot; ${formateazaDataZFlow(f.data_emiterii)}${f.data_scadenta ? ' &middot; S: ' + formateazaDataZFlow(f.data_scadenta) : ''}</span>
    </div>
    <b class="text-[0.875rem] font-semibold flex-shrink-0 ${isPlatit ? 'text-blue-900' : 'text-red-600'} tabular-nums">${Math.round(Number(f.valoare) || 0).toLocaleString()} lei</b>
</div>`;
        } catch(rowErr) {
            ZFlowLogger.warn('app', '[BI furnizori] Eroare randare rând:', rowErr, f);
            return `<div class="text-xs text-red-400 px-3 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare factură furnizor #${f?.numar_factura || '?'}</div>`;
        }
    }).join("");
}
function biNextPage() {
    ZFlowStore.biCurrentPage++;
    genereazaBI();
}

function biPrevPage() {
    if (ZFlowStore.biCurrentPage > 1) {
        ZFlowStore.biCurrentPage--;
        genereazaBI();
    }
}

/**
 * Setează dimensiunea paginii pentru Analiza BI
 */
function biSetPageSize(n) {
    ZFlowStore.biPageSize = Number(n); // 0 = Toate
    ZFlowStore.biCurrentPage = 1;
    genereazaBI();
}

// ============================================
// PAGINARE LISTE — helpers universale
// ============================================

/**
 * Generează HTML-ul bara de paginare
 */
function _paginareHTML(total, pageSize, currentPage, prefix) {
    const totalPages = pageSize === 0 ? 1 : Math.ceil(total / pageSize);
    const arataInfo = pageSize === 0
        ? `${total} înregistrări`
        : `${currentPage}/${totalPages} (${total})`;
    const optiuni = [5, 10, 20, 50].map(v =>
        `<option value="${v}" ${pageSize === v ? 'selected' : ''}>${v}</option>`
    ).join('');
    return `
<div class="flex flex-col items-center gap-1.5 mt-2 mb-4 px-1">
    <div class="flex items-center justify-center gap-2 flex-wrap w-full">
        <span class="zf-category-label">Afișare</span>
        <select onchange="${prefix}SetPageSize(this.value)"
                class="text-[11px] font-black text-slate-700 bg-slate-100 border-none rounded-lg px-2 py-1.5 cursor-pointer outline-none hover:bg-slate-200 transition-all min-w-[60px] min-h-[32px]">
            ${optiuni}
            <option value="0" ${pageSize === 0 ? 'selected' : ''}>Toate</option>
        </select>
    </div>
    <div class="flex items-center gap-2">
        <button onclick="${prefix}PrevPage()"
                class="px-3 py-2 bg-slate-100 rounded-xl text-[9px] font-bold uppercase hover:bg-slate-200 transition-all disabled:opacity-40 min-h-[32px]"
                ${currentPage <= 1 ? 'disabled' : ''}>← Ant.</button>
        <span class="text-[9px] font-black text-slate-500 whitespace-nowrap">${arataInfo}</span>
        <button onclick="${prefix}NextPage()"
                class="px-3 py-2 bg-slate-100 rounded-xl text-[9px] font-bold uppercase hover:bg-slate-200 transition-all disabled:opacity-40 min-h-[32px]"
                ${pageSize === 0 || currentPage >= totalPages ? 'disabled' : ''}>Urm. →</button>
    </div>
</div>`;
}

/**
 * Render bara paginare clienți
 */
function _renderClientiPagination(total) {
    const el = document.getElementById("clienti-pagination");
    if (!el) return;
    if (total === 0) { el.innerHTML = ''; return; }
    el.innerHTML = _paginareHTML(total, ZFlowStore.clientiPageSize, ZFlowStore.clientiCurrentPage, 'clienti');
}

function clientiNextPage() {
    const ps = ZFlowStore.clientiPageSize;
    if (ps === 0) return;
    const tp = Math.ceil(ZFlowStore._clientiFiltrati.length / ps);
    if (ZFlowStore.clientiCurrentPage < tp) {
        ZFlowStore.clientiCurrentPage++;
        renderMain(ZFlowStore._clientiFiltrati);
    }
}
function initInfiniteScrollClienti() {
    if (window.innerWidth >= 768) return;
    const sentinel = document.getElementById('clienti-scroll-sentinel');
    if (!sentinel) return;
    if (window._clientiScrollObs) window._clientiScrollObs.disconnect();
    const _psCheck = ZFlowStore.clientiPageSize;
    if (_psCheck === 0) return;
    const _tpCheck = Math.ceil((ZFlowStore._clientiFiltrati||[]).length / _psCheck);
    if (ZFlowStore.clientiCurrentPage >= _tpCheck) return;
    let firstFire = true;
    window._clientiScrollObs = new IntersectionObserver(entries => {
        if (firstFire) { firstFire = false; return; }
        if (!entries[0].isIntersecting) return;
        const ps = ZFlowStore.clientiPageSize;
        if (ps === 0) return;
        const tp = Math.ceil((ZFlowStore._clientiFiltrati||[]).length / ps);
        if (ZFlowStore.clientiCurrentPage < tp) clientiNextPage();
    }, { rootMargin: '120px' });
    window._clientiScrollObs.observe(sentinel);
}
window.initInfiniteScrollClienti = initInfiniteScrollClienti;
function clientiPrevPage() {
    if (ZFlowStore.clientiCurrentPage > 1) {
        ZFlowStore.clientiCurrentPage--;
        renderMain(ZFlowStore._clientiFiltrati);
    }
}
function clientiSetPageSize(n) {
    ZFlowStore.clientiPageSize = Number(n) || 0;
    ZFlowStore.clientiCurrentPage = 1;
    // Folosim _clientiFiltrati direct (poate fi [] la prima randare) — renderMain
    // va folosi dateLocal dacă array-ul e gol, păstrând contextul de filtrare
    renderMain(ZFlowStore._clientiFiltrati.length > 0 ? ZFlowStore._clientiFiltrati : ZFlowStore.dateLocal);
}

/**
 * Render bara paginare furnizori
 */
function _renderFurnizoriPagination(total) {
    const el = document.getElementById("furnizori-pagination");
    if (!el) return;
    if (total === 0) { el.innerHTML = ''; return; }
    el.innerHTML = _paginareHTML(total, ZFlowStore.furnizoriPageSize, ZFlowStore.furnizoriCurrentPage, 'furnizori');
}

function furnizoriNextPage() {
    const ps = ZFlowStore.furnizoriPageSize;
    if (ps === 0) return;
    const tp = Math.ceil(ZFlowStore._furnizoriFiltrati.length / ps);
    if (ZFlowStore.furnizoriCurrentPage < tp) {
        ZFlowStore.furnizoriCurrentPage++;
        renderFurnizori(ZFlowStore._furnizoriFiltrati);
    }
}
function initInfiniteScrollFurnizori() {
    if (window.innerWidth >= 768) return;
    const sentinel = document.getElementById('furnizori-scroll-sentinel');
    if (!sentinel) return;
    if (window._furnizoriScrollObs) window._furnizoriScrollObs.disconnect();
    // Nu crea observer dacă suntem deja pe ultima pagină — previne auto-avans
    const _psCheck = ZFlowStore.furnizoriPageSize;
    if (_psCheck === 0) return;
    const _tpCheck = Math.ceil((ZFlowStore._furnizoriFiltrati||[]).length / _psCheck);
    if (ZFlowStore.furnizoriCurrentPage >= _tpCheck) return;
    let firstFire = true;
    window._furnizoriScrollObs = new IntersectionObserver(entries => {
        if (firstFire) { firstFire = false; return; }
        if (!entries[0].isIntersecting) return;
        const ps = ZFlowStore.furnizoriPageSize;
        if (ps === 0) return;
        const tp = Math.ceil((ZFlowStore._furnizoriFiltrati||[]).length / ps);
        if (ZFlowStore.furnizoriCurrentPage < tp) furnizoriNextPage();
    }, { rootMargin: '80px' });
    window._furnizoriScrollObs.observe(sentinel);
}
window.initInfiniteScrollFurnizori = initInfiniteScrollFurnizori;
function furnizoriPrevPage() {
    if (ZFlowStore.furnizoriCurrentPage > 1) {
        ZFlowStore.furnizoriCurrentPage--;
        renderFurnizori(ZFlowStore._furnizoriFiltrati);
    }
}
function furnizoriSetPageSize(n) {
    ZFlowStore.furnizoriPageSize = Number(n) || 0;
    ZFlowStore.furnizoriCurrentPage = 1;
    renderFurnizori(ZFlowStore._furnizoriFiltrati.length > 0 ? ZFlowStore._furnizoriFiltrati : ZFlowStore.dateFurnizori);
}

/**
 * Render bara paginare Analiza BI
 */
function _renderBIPagination(total) {
    const el = document.getElementById("bi-pagination");
    if (!el) return;
    if (total === 0) { el.innerHTML = ''; return; }
    el.innerHTML = _paginareHTML(total, ZFlowStore.biPageSize, ZFlowStore.biCurrentPage, 'bi');
}

/**
 * Paginare Furnizori în Analiza BI (secțiunea de jos)
 */
function _renderFurnizoriBIPagination(total) {
    const el = document.getElementById("bi-pagination-furnizori");
    if (!el) return;
    if (total === 0) { el.innerHTML = ''; return; }
    el.innerHTML = _paginareHTML(total, ZFlowStore.furnizoriBIPageSize || 5, ZFlowStore.furnizoriBICurrentPage || 1, 'furnizoriBI');
}
function furnizoriBINextPage() {
    const ps = ZFlowStore.furnizoriBIPageSize || 5;
    if (ps === 0) return;
    const total = (ZFlowStore._furnizoriBIFiltrati || []).length;
    const tp = Math.ceil(total / ps);
    if ((ZFlowStore.furnizoriBICurrentPage || 1) < tp) {
        ZFlowStore.furnizoriBICurrentPage = (ZFlowStore.furnizoriBICurrentPage || 1) + 1;
        genereazaBI();
    }
}
function furnizoriBIPrevPage() {
    if ((ZFlowStore.furnizoriBICurrentPage || 1) > 1) {
        ZFlowStore.furnizoriBICurrentPage--;
        genereazaBI();
    }
}
function furnizoriBISetPageSize(n) {
    ZFlowStore.furnizoriBIPageSize = Number(n) || 0;
    ZFlowStore.furnizoriBICurrentPage = 1;
    genereazaBI();
}

/**
 * Setează numărul de facturi per pagină în vizualizare detalii furnizor
 */
function furnizoriFacturiSetPerPage(n) {
    ZFlowStore.furnizoriFacturiPerPage = Number(n) >= 0 ? Number(n) : 20;
    if (ZFlowStore.selectedFurnizorId) {
        arataDetaliiFurnizor(ZFlowStore.selectedFurnizorId);
    }
}

/**
 * Detectează automat statusul de plată al unei facturi importate din CSV.
 * Logică:
 *  - Dacă statusul explicit din CSV este 'Incasat'/'Platit' → marcat ca plătit
 *  - Dacă există o dată de plată (`data_plata`) → marcat ca plătit
 *  - Dacă suma restantă/sold din CSV este 0 → marcat ca plătit
 *  - Altfel → neplătit
 * @param {Object} csvFact - rândul mapat din CSV
 * @param {boolean} isFurnizori - true = furnizori, false = clienți
 * @returns {string} status_plata
 */
function _detectaStatusPlata(csvFact, isFurnizori) {
    const statusCSV = (csvFact.status_plata || '').trim().toLowerCase();
    // Explicit paid
    const platitKeywords = ['incasat', 'platit', 'achitat', 'paid', 'yes', 'da', '1'];
    if (platitKeywords.includes(statusCSV)) {
        return isFurnizori ? 'Platit' : 'Incasat';
    }
    // Data plata completata => plătit
    if (csvFact.data_plata && String(csvFact.data_plata).trim().length > 0) {
        return isFurnizori ? 'Platit' : 'Incasat';
    }
    // Suma restanta 0 => plătit
    const sold = parseFloat(String(csvFact.sold_ramas || csvFact.rest_plata || csvFact.suma_restanta || '').replace(/[^0-9.,\-]/g,'').replace(',','.'));
    if (!isNaN(sold) && sold === 0) {
        return isFurnizori ? 'Platit' : 'Incasat';
    }
    // Implicit neplătit
    return isFurnizori ? 'Neplatit' : 'Neincasat';
}

/**
 * Import facturi din CSV SAGA cu auto-detectare tip (clienți / furnizori)
 */
async function importaDateSagaAuto() {
    if (!hasPermission('canImport')) {
        showNotification('Nu ai permisiunea de a importa date', 'error');
        return;
    }
    // Pas 1: un singur file picker — citire completă a fișierului
    const file = await new Promise(resolve => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.csv,.xlsx'; inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.addEventListener('change', e => { document.body.removeChild(inp); resolve(e.target.files[0] || null); }, { once: true });
        inp.click();
    });
    if (!file) return;

    // Pas 2: citire + detectare tip din antete
    const rawText = await file.text();
    const text = rawText.replace(/^\uFEFF/, '');
    const delimiter = typeof ZFlowImport !== 'undefined' ? ZFlowImport.detectDelimiter(text) : (text.split('\n')[0].includes(';') ? ';' : ',');
    const firstLine = text.split('\n')[0] || '';
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/_/g, ' '));
    ZFlowLogger.debug('app', '[AutoImport] Headere detectate:', headers);

    // Detectare tip: furnizori dacă conține cuvintele cheie furnizor
    const isFurnizori = headers.some(h =>
        h.includes('furnizor') || h === 'platit' || h === 'neplatit' ||
        (h.includes('plat') && !headers.some(h2 => h2.includes('client') || h2.includes('incasat')))
    );
    const tipDetectat = isFurnizori ? 'furnizori' : 'clienti';
    const tipLabel = isFurnizori ? 'Furnizori (facturi de plătit)' : 'Clienți (facturi de încasat)';

    // Pas 3: confirmă cu utilizatorul
    const confirmed = confirm(`Tip detectat: ${tipLabel}\n\nHeader-e găsite: ${headers.slice(0,6).join(', ')}...\n\nContinui importul?`);
    if (!confirmed) return;

    // Pas 4: text pre-citit → importaDateSaga îl preia fără al doilea file picker
    window.__sagaAutoText = text;
    await importaDateSaga(tipDetectat);
    window.__sagaAutoText = null; // curăță dacă nu a fost consumat
}

function facturiSetPerPage(n) {
    ZFlowStore.facturiPerPage = Number(n) > 0 ? Number(n) : 99999; // 99999 = toate
    if (ZFlowStore.selectedClientId) {
        arataDetalii(ZFlowStore.selectedClientId);
    }
}

// ============================================
// PAGINARE — DEPOZIT & LOGISTIC (proxy spre module)
// ============================================
function produseNextPage()    { const s=ZFlowStore,ps=s.produsePageSize||10; if(!ps) return; if((s.produseCurrentPage||1)<Math.ceil((s._produseFiltrate||[]).length/ps)){s.produseCurrentPage=(s.produseCurrentPage||1)+1; if(window.renderProduse) window.renderProduse();} }
function produsePrevPage()    { if((ZFlowStore.produseCurrentPage||1)>1){ZFlowStore.produseCurrentPage--;if(window.renderProduse) window.renderProduse();} }
function produseSetPageSize(n){ ZFlowStore.produsePageSize=Number(n)||0; ZFlowStore.produseCurrentPage=1; if(window.renderProduse) window.renderProduse(); }

function miscariNextPage()    { const s=ZFlowStore,ps=s.miscariPageSize||10; if(!ps) return; if((s.miscariCurrentPage||1)<Math.ceil((s._miscariFiltrate||[]).length/ps)){s.miscariCurrentPage=(s.miscariCurrentPage||1)+1; if(window.renderMiscariStoc) window.renderMiscariStoc();} }
function miscariPrevPage()    { if((ZFlowStore.miscariCurrentPage||1)>1){ZFlowStore.miscariCurrentPage--;if(window.renderMiscariStoc) window.renderMiscariStoc();} }
function miscariSetPageSize(n){ ZFlowStore.miscariPageSize=Number(n)||0; ZFlowStore.miscariCurrentPage=1; if(window.renderMiscariStoc) window.renderMiscariStoc(); }

function comenziNextPage()    { const s=ZFlowStore,ps=s.comenziPageSize||10; if(!ps) return; if((s.comenziCurrentPage||1)<Math.ceil((s._comenziFiltrate||[]).length/ps)){s.comenziCurrentPage=(s.comenziCurrentPage||1)+1; if(window.renderComenziTransport) window.renderComenziTransport();} }
function comenziPrevPage()    { if((ZFlowStore.comenziCurrentPage||1)>1){ZFlowStore.comenziCurrentPage--;if(window.renderComenziTransport) window.renderComenziTransport();} }
function comenziSetPageSize(n){ ZFlowStore.comenziPageSize=Number(n)||0; ZFlowStore.comenziCurrentPage=1; if(window.renderComenziTransport) window.renderComenziTransport(); }

function soferiNextPage()     { const s=ZFlowStore,ps=s.soferiPageSize||10; if(!ps) return; if((s.soferiCurrentPage||1)<Math.ceil((s._soferiFiltrati||[]).length/ps)){s.soferiCurrentPage=(s.soferiCurrentPage||1)+1; if(window.renderSoferi) window.renderSoferi();} }
function soferiPrevPage()     { if((ZFlowStore.soferiCurrentPage||1)>1){ZFlowStore.soferiCurrentPage--;if(window.renderSoferi) window.renderSoferi();} }
function soferiSetPageSize(n) { ZFlowStore.soferiPageSize=Number(n)||0; ZFlowStore.soferiCurrentPage=1; if(window.renderSoferi) window.renderSoferi(); }

function vehiculeNextPage()   { const s=ZFlowStore,ps=s.vehiculePageSize||10; if(!ps) return; if((s.vehiculeCurrentPage||1)<Math.ceil((s._vehiculeFiltrate||[]).length/ps)){s.vehiculeCurrentPage=(s.vehiculeCurrentPage||1)+1; if(window.renderVehicule) window.renderVehicule();} }
function vehiculePrevPage()   { if((ZFlowStore.vehiculeCurrentPage||1)>1){ZFlowStore.vehiculeCurrentPage--;if(window.renderVehicule) window.renderVehicule();} }
function vehiculeSetPageSize(n){ ZFlowStore.vehiculePageSize=Number(n)||0; ZFlowStore.vehiculeCurrentPage=1; if(window.renderVehicule) window.renderVehicule(); }

/**
 * Activează/dezactivează modul de selecție multiplă
 */
function toggleBulkMode() {
    if (window.ZFlowBulk) { ZFlowBulk.toggle(); } else { ZFlowStore.bulkMode = !ZFlowStore.bulkMode; ZFlowStore.bulkSelectedFacturi = []; } // [V3-FIX 1]

    const bulkInline = document.getElementById("bulk-inline-bar");
    const searchRow = document.getElementById("search-bi-row");
    const toggleBtn = document.getElementById("btn-toggle-bulk");

    if (ZFlowStore.bulkMode) {
        if (bulkInline) bulkInline.classList.remove("hidden");
        if (searchRow) searchRow.classList.add("hidden");
        if (toggleBtn) {
            toggleBtn.classList.add("bg-blue-900", "border-blue-900", "text-white");
            toggleBtn.classList.remove("text-slate-400");
        }
    } else {
        if (bulkInline) bulkInline.classList.add("hidden");
        if (searchRow) searchRow.classList.remove("hidden");
        if (toggleBtn) {
            toggleBtn.classList.remove("bg-blue-900", "border-blue-900", "text-white");
            toggleBtn.classList.add("text-slate-400");
        }
        _resetBulkSelectAllBtn();
    }

    updateBulkUI();
    genereazaBI(); // Re-render cu/fără checkbox-uri

    // La activare, selectează automat toate facturile vizibile
    if (ZFlowStore.bulkMode) {
        bulkSelectAll();
    }
}

/**
 * Toggle selectare factură individuală
 */
function toggleBulkSelectFactura(facturaId) {
    if (window.ZFlowBulk) { ZFlowBulk.toggleSelect(facturaId); return; } // [V3-FIX 1]
    const idx = ZFlowStore.bulkSelectedFacturi.indexOf(String(facturaId));
    if (idx > -1) {
        ZFlowStore.bulkSelectedFacturi.splice(idx, 1);
    } else {
        ZFlowStore.bulkSelectedFacturi.push(String(facturaId));
    }
    // Dacă userul a modificat manual selecția, resetăm starea butonului "Selectează toate"
    const btn = document.getElementById("btn-bulk-select-all");
    if (btn) {
        btn._allSelected = false;
        btn.classList.remove("bg-emerald-500", "scale-[1.02]", "shadow-md");
        btn.classList.add("bg-slate-800");
        btn.innerHTML = "Selectează toate";
    }
    updateBulkUI();
}

/**
 * Reseteză stilul butonului Selectează toate la starea inițială
 */
function _resetBulkSelectAllBtn() {
    const btn = document.getElementById("btn-bulk-select-all");
    if (!btn) return;
    btn.classList.remove("bg-emerald-500", "scale-[1.02]", "shadow-md");
    btn.classList.add("bg-slate-800");
    btn.innerHTML = "Selectează toate";
    btn._allSelected = false;
}

/**
 * Toggle selectare toate / deselectare toate facturile vizibile
 */
function bulkSelectAll() {
    const btn = document.getElementById("btn-bulk-select-all");
    const allSelected = btn?._allSelected;

    if (allSelected) {
        // Deselectează toate
        ZFlowStore.bulkSelectedFacturi = [];
        updateBulkUI();
        _resetBulkSelectAllBtn();
        return;
    }

    // Selectează toate rândurile vizibile (clienți + furnizori) după data-factura-id
    document.querySelectorAll("#rezultat-analiza [data-factura-id]").forEach(card => {
        const facturaId = card.getAttribute("data-factura-id");
        if (facturaId && !ZFlowStore.bulkSelectedFacturi.includes(facturaId)) {
            ZFlowStore.bulkSelectedFacturi.push(facturaId);
        }
    });
    updateBulkUI();

    // Stilizează butonul ca "activât"
    if (btn) {
        btn.classList.remove("bg-slate-800");
        btn.classList.add("bg-emerald-500", "scale-[1.02]", "shadow-md");
        btn.innerHTML = `<svg class="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Deselectează toate`;
        btn._allSelected = true;
    }
}

/**
 * Actualizează UI-ul pentru bulk actions
 */
function updateBulkUI() {
    const countEl = document.getElementById("bulk-count");
    if (countEl) countEl.innerText = ZFlowStore.bulkSelectedFacturi.length;
    
    // Actualizează checkbox-urile
    document.querySelectorAll("#rezultat-analiza .bulk-checkbox").forEach(cb => {
        const facturaId = cb.getAttribute("data-factura-id");
        cb.checked = ZFlowStore.bulkSelectedFacturi.includes(facturaId);
    });

    // Actualizează suma afișată pe baza facturilor selectate
    const sumaDisplay = document.getElementById("suma-selectata-bi");
    if (sumaDisplay && ZFlowStore.bulkMode && ZFlowStore.bulkSelectedFacturi.length > 0) {
        const allFacturi = [
            ...(ZFlowStore.dateFacturiBI || []),
            ...(ZFlowStore.dateFacturiPlatit || [])
        ];
        const sumaSelectata = allFacturi
            .filter(f => ZFlowStore.bulkSelectedFacturi.includes(String(f.id)))
            .reduce((acc, f) => acc + (Number(f.valoare) || 0), 0);
        sumaDisplay.innerText = `${Math.round(sumaSelectata).toLocaleString()} lei`;
    }
    
    // Actualizează label-urile butoanelor de export (Export Inteligent)
    updateExportButtonLabels();
}

/**
 * Marchează toate facturile selectate ca încasate
 */
async function bulkMarkPaid() {
    if (ZFlowStore.bulkSelectedFacturi.length === 0) {
        showNotification("Selectează cel puțin o factură", "warning");
        return;
    }
    
    if (!hasPermission('canEdit')) {
        showNotification("Nu ai permisiunea de a edita facturi", "error");
        return;
    }
    
    const count = ZFlowStore.bulkSelectedFacturi.length;
    if (!confirm(`Marchezi ${count} facturi ca ÎNCASATE?`)) return;
    
    setLoader(true);
    let success = 0;
    let failed = 0;
    
    for (const facturaId of ZFlowStore.bulkSelectedFacturi) {
        try {
            await ZFlowDB.updateFactura(facturaId, { 
                status_plata: "Incasat",
                data_incasarii: new Date().toISOString().split('T')[0]
            });
            
            // Update local — caută în ambele colecții (clienti + furnizori)
            const facturaClient = ZFlowStore.dateFacturiBI.find(f => String(f.id) === String(facturaId));
            if (facturaClient) {
                facturaClient.status_plata = "Incasat";
                facturaClient.data_incasarii = new Date().toISOString().split('T')[0];
            }
            const facturaFurnizor = (ZFlowStore.dateFacturiPlatit || []).find(f => String(f.id) === String(facturaId));
            if (facturaFurnizor) {
                facturaFurnizor.status_plata = "Incasat";
                facturaFurnizor.data_incasarii = new Date().toISOString().split('T')[0];
            }
            success++;
        } catch (err) {
            ZFlowLogger.error('app', "Eroare bulk update:", err);
            failed++;
        }
    }
    
    setLoader(false);
    ZFlowStore.bulkSelectedFacturi = [];
    toggleBulkMode();
    genereazaBI();
    updateDashboardKPI();
    
    if (failed === 0) {
        showNotification(`${success} facturi marcate ca încasate`, "success");
    } else {
        showNotification(`${success} reușite, ${failed} eșuate`, "warning");
    }
}

/**
 * Export PDF pentru facturi SELECTATE (bulk mode)
 * Apelată de exportaPDF() când există selecție
 */
async function exportaPDFSelectie() {
    const facturiSelectate = ZFlowStore.dateFacturiBI.filter(f => 
        ZFlowStore.bulkSelectedFacturi.includes(String(f.id))
    );
    
    if (facturiSelectate.length === 0) {
        showNotification("Nicio factură selectată", "warning");
        return;
    }

    if (window.ZFlowExport) await window.ZFlowExport._ensureJsPDF();
    
    const curataText = (text) => {
        if (!text) return "";
        return text.toString()
            .replace(/ș/g, "s").replace(/Ș/g, "S")
            .replace(/ț/g, "t").replace(/Ț/g, "T")
            .replace(/ă/g, "a").replace(/Ă/g, "A")
            .replace(/î/g, "i").replace(/Î/g, "I")
            .replace(/â/g, "a").replace(/Â/g, "A");
    };
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    
    const totalSelectat = facturiSelectate.reduce((acc, f) => acc + (Number(f.valoare) || 0), 0);
    
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text(curataText("RAPORT FACTURI SELECTATE"), 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(curataText(`Generat: ${new Date().toLocaleDateString("ro-RO")} | ${facturiSelectate.length} facturi selectate`), 14, 28);
    doc.setFontSize(13);
    doc.text(curataText(`TOTAL SELECTAT: ${Math.round(totalSelectat).toLocaleString()} lei`), 14, 38);
    
    const headers = [[curataText("CLIENT"), curataText("DOCUMENT"), curataText("EMIS LA"), curataText("SCADENTA"), curataText("SUMA"), curataText("STATUS")]];
    const rows = facturiSelectate.map(f => {
        const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(f.client_id));
        return [
            curataText(client?.nume_firma || "N/A"),
            curataText(f.numar_factura || "N/A"),
            curataText(formateazaDataZFlow(f.data_emiterii)),
            curataText(formateazaDataZFlow(f.data_scadenta)),
            curataText(`${Number(f.valoare).toLocaleString()} lei`),
            curataText(f.status_plata === "Incasat" ? "INCASAT" : "NEINCASAT")
        ];
    });
    
    doc.autoTable({
        startY: 45,
        head: headers,
        body: rows,
        theme: "striped",
        tableWidth: 182,
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [30, 58, 138], fontSize: 8, halign: "center" },
        styles: { fontSize: 7, cellPadding: 2, minCellHeight: 6, halign: "center", overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 44, halign: "center" },
            1: { cellWidth: 30, halign: "center" },
            2: { cellWidth: 24, halign: "center" },
            3: { cellWidth: 24, halign: "center" },
            4: { cellWidth: 34, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        },
        didParseCell: function (data) {
            if (data.section === "body" && data.column.index === 5) {
                if (data.cell.raw === "INCASAT") {
                    data.cell.styles.textColor = [16, 185, 129];
                } else {
                    data.cell.styles.textColor = [239, 68, 68];
                }
            }
        },
    });
    
    doc.save(`facturi_selectie_${new Date().toISOString().slice(0, 10)}.pdf`);
    showNotification(`PDF generat cu ${facturiSelectate.length} facturi selectate`, "success");
}

/**
 * Export Excel pentru facturi SELECTATE (bulk mode)
 * Apelată de exportaExcel() când există selecție
 */
async function exportaExcelSelectie() {
    const facturiSelectate = ZFlowStore.dateFacturiBI.filter(f => 
        ZFlowStore.bulkSelectedFacturi.includes(String(f.id))
    );
    
    if (facturiSelectate.length === 0) {
        showNotification("Nicio factură selectată", "warning");
        return;
    }

    if (window.ZFlowExport) await window.ZFlowExport._ensureXLSX();
    
    const headers = ["Client", "Factură", "Valoare", "Status", "Data Emiterii", "Scadență"];
    const rows = facturiSelectate.map(f => {
        const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(f.client_id));
        return [
            client?.nume_firma || "N/A",
            f.numar_factura || "N/A",
            f.valoare || 0,
            f.status_plata === "Incasat" ? "Încasat" : "Neîncasat",
            formateazaDataZFlow(f.data_emiterii),
            formateazaDataZFlow(f.data_scadenta)
        ];
    });
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturi Selectate");

    // Sumar BI vizibil (pentru consistență cu valorile afișate în UI)
    const biClienti = document.getElementById("suma-selectata-bi")?.innerText?.trim() || "0 lei";
    const biFurnizori = document.getElementById("suma-platit-bi")?.innerText?.trim() || "0 lei";
    const biContributii = ZFlowStore.includeContributiiInAnaliza
        ? (document.getElementById("cf-contributii")?.innerText?.trim() || "0 lei")
        : "0 lei";
    const biNet = (document.getElementById("cf-net")?.innerText?.trim() || "0 lei").replace(/\u2212/g, "-");
    const wsSumarSelectie = XLSX.utils.aoa_to_sheet([
        ["Z-FLOW — SUMAR BI (SELECȚIE)"],
        [],
        ["Total Clienți (facturat)", biClienti],
        ["Total Furnizori (plăți)", biFurnizori],
        ["Contribuții Buget Stat", biContributii],
        ["Diferență Net", biNet],
    ]);
    wsSumarSelectie["!cols"] = [{ wch: 30 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsSumarSelectie, "Sumar BI");

    XLSX.writeFile(wb, `facturi_selectie_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotification(`Excel generat cu ${facturiSelectate.length} facturi selectate`, "success");
}

/**
 * Actualizează label-urile butoanelor de export în funcție de context
 * Arată "Export Selecție" când sunt facturi selectate, altfel "Export Raport"
 */
function updateExportButtonLabels() {
    const btnPDF = document.getElementById("btn-export-pdf");
    const btnExcel = document.getElementById("btn-export-excel");
    const hasSelection = ZFlowStore.bulkMode && ZFlowStore.bulkSelectedFacturi.length > 0;
    const count = ZFlowStore.bulkSelectedFacturi.length;
    
    if (btnPDF) {
        const labelPDF = btnPDF.querySelector(".export-label");
        if (labelPDF) {
            labelPDF.textContent = hasSelection ? `Export ${count} Selectate PDF` : "Export Raport PDF";
        }
        // Schimbă culoarea pentru a indica modul
        if (hasSelection) {
            btnPDF.classList.remove("bg-slate-800");
            btnPDF.classList.add("bg-blue-600");
        } else {
            btnPDF.classList.remove("bg-blue-600");
            btnPDF.classList.add("bg-slate-800");
        }
    }
    
    if (btnExcel) {
        const labelExcel = btnExcel.querySelector(".export-label");
        if (labelExcel) {
            labelExcel.textContent = hasSelection ? `Export ${count} Selectate Excel` : "Export Date Excel";
        }
        // Schimbă culoarea pentru a indica modul
        if (hasSelection) {
            btnExcel.classList.remove("bg-emerald-600");
            btnExcel.classList.add("bg-blue-500");
        } else {
            btnExcel.classList.remove("bg-blue-500");
            btnExcel.classList.add("bg-emerald-600");
        }
    }
}

// Păstrăm funcția veche pentru compatibilitate (delegă către exportaPDF)
function bulkExportPDF() {
    exportaPDF();
}

/**
 * Setează filtrul de status BI
 */
function setFiltruStatusBI(status, btn) {
    ZFlowStore.filtruStatusBI = status;
    ZFlowStore.biCurrentPage = 1;

    document.querySelectorAll(".bi-status-btn").forEach((b) => {
        b.classList.remove("bg-white", "text-blue-900", "shadow-sm", "text-red-600", "text-emerald-600", "text-red-700");
        b.classList.add("text-slate-500");
    });

    btn.classList.remove("text-slate-500");
    btn.classList.add("bg-white", "shadow-sm");
    if (status === "Neincasat") btn.classList.add("text-red-600");
    else if (status === "Incasat") btn.classList.add("text-emerald-600");
    else if (status === "Platit") btn.classList.add("text-red-700");
    else btn.classList.add("text-blue-900");

    // Vizibilitate coloane totale în funcție de tab
    const colClienti = document.getElementById("bi-total-clienti-col");
    const colFurnizori = document.getElementById("bi-total-furnizori-col");
    const colNet = document.getElementById("bi-total-net-col");
    if (colClienti) colClienti.classList.toggle("hidden", status === 'Platit');
    if (colFurnizori) colFurnizori.classList.toggle("hidden", status === 'Neincasat' || status === 'Incasat');
    if (colNet) colNet.classList.toggle("hidden", status !== 'toate');

    updateAnalizaInstant();
}

// Debounce pentru căutare BI — genereazaBI() citește deja valoarea din #search-bi
const filtreazaFirmeInBIDebounced = debounce(function () {
    genereazaBI();
}, 300);

function filtreazaFirmeInBI() {
    if (filtreazaFirmeInBIDebounced) filtreazaFirmeInBIDebounced();
}

/**
 * Setsă tipul de documente vizualizate în analiză: clienti | ambele | furnizori
 */
function setFiltruTipBI(tip, btn) {
    ZFlowStore.filtruTipBI = tip;

    // Update visual state
    document.querySelectorAll(".bi-tip-btn").forEach(b => {
        b.classList.remove("bg-white", "text-slate-800", "shadow-sm");
        b.classList.add("text-slate-500");
    });
    if (btn) {
        btn.classList.add("bg-white", "text-slate-800", "shadow-sm");
        btn.classList.remove("text-slate-500");
    }

    // Show/hide sections
    const clientiSection = document.getElementById("bi-clienti-section");
    const furnizoriSection = document.getElementById("bi-furnizori-section");
    if (clientiSection) clientiSection.classList.toggle("hidden", tip === "furnizori");
    if (furnizoriSection) furnizoriSection.classList.toggle("hidden", tip === "clienti");

    // Totale bar: arată col furnizori doar când mode !== clienti
    const colClienti = document.getElementById("bi-total-clienti-col");
    const colFurnizori = document.getElementById("bi-total-furnizori-col");
    const colNet = document.getElementById("bi-total-net-col");
    if (colClienti) colClienti.classList.toggle("hidden", tip === "furnizori");
    if (colFurnizori) colFurnizori.classList.toggle("hidden", tip === "clienti");
    if (colNet) colNet.classList.toggle("hidden", tip !== "ambele");

    // Reset sume la 0 la schimbarea modului
    const sumaClienti = document.getElementById("suma-selectata-bi");
    const sumaFurnizori = document.getElementById("suma-platit-bi");
    if (sumaClienti) sumaClienti.innerText = "0 lei";
    if (sumaFurnizori) sumaFurnizori.innerText = "0 lei";

    // Butoane status: vizibilitate per mod
    const btnRestant = document.getElementById("bi-btn-restant");
    const btnIncasat = document.getElementById("bi-btn-incasat");
    const btnPlatit = document.getElementById("bi-btn-platit");
    // Clienti: Toate + Restant + Incasat (fara De Platit)
    // Furnizori: Toate + De Platit (fara Restant + Incasat)
    // Ambele: toate 4
    if (btnRestant) btnRestant.classList.toggle("hidden", tip === "furnizori");
    if (btnIncasat) btnIncasat.classList.toggle("hidden", tip === "furnizori");
    if (btnPlatit) btnPlatit.classList.toggle("hidden", tip === "clienti");

    // Reset filtruStatusBI dacă butonul activ devine invizibil
    const statusCurent = ZFlowStore.filtruStatusBI;
    const needsReset =
        (tip === "clienti" && statusCurent === "Platit") ||
        (tip === "furnizori" && (statusCurent === "Neincasat" || statusCurent === "Incasat"));
    if (needsReset) {
        ZFlowStore.filtruStatusBI = "toate";
        document.querySelectorAll(".bi-status-btn").forEach(b => {
            b.classList.remove("bg-white", "shadow-sm", "text-red-600", "text-emerald-600", "text-red-700", "text-blue-900");
            b.classList.add("text-slate-500");
        });
        const btnToate = document.querySelector(".bi-status-btn");
        if (btnToate) { btnToate.classList.remove("text-slate-500"); btnToate.classList.add("bg-white", "shadow-sm", "text-blue-900"); }
    }

    calculeazaCashflow();
    genereazaBI();
}
function toggleFurnizoriBI(status) {
    document.querySelectorAll("#container-bi-furnizori-checks input").forEach(c => c.checked = status);
    genereazaBI();
}

function actualizeazaSumaVizibilaBI() {
    // Recalculăm suma din date brute (nu din DOM) pentru a evita
    // parsing-ul greșit cu toLocaleString (ex: "12.450" → 12.45 în loc de 12450)
    genereazaBI();
}

// ==========================================
// MODALE
// ==========================================

/**
 * Deschide un modal
 */
function deschideModal(id, targetId = null) {
    const fabMenu = document.getElementById("fab-menu");
    if (fabMenu && fabMenu.classList.contains("active")) {
        toggleFAB();
    }

    if (id === "modal-client") {
        // Arată/ascunde banner avertizare suport client
        const warningCl = document.getElementById("modal-client-suport-warning");
        if (warningCl) {
            !targetId ? warningCl.classList.remove("hidden") : warningCl.classList.add("hidden");
        }
        const title = document.getElementById("modal-client-title");
        if (targetId) {
            const f = ZFlowStore.dateLocal.find((x) => String(x.id) === String(targetId));
            if (f) {
                title.innerText = "Editează Profil Client";
                document.getElementById("in-client-id").value = f.id;
                document.getElementById("in-cui").value = f.cui || "";
                document.getElementById("in-nume").value = f.nume_firma || "";
                document.getElementById("in-adresa").value = f.adresa || "";
                document.getElementById("in-contact").value = f.persoana_contact || "";
                document.getElementById("in-tel").value = f.telefon || "";
                document.getElementById("in-email").value = f.contact_email || "";
                document.getElementById("in-iban").value = f.iban || "";
                document.getElementById("in-oras").value = f.oras || "";
                const inEticheta = document.getElementById("in-eticheta");
                const inCategorie = document.getElementById("in-categorie");
                if (inEticheta) inEticheta.value = f.eticheta || "";
                if (inCategorie) inCategorie.value = f.categorie || "";
            }
        } else {
            title.innerText = "Client Bridge Nou";
            document.getElementById("in-client-id").value = "";
            document.querySelectorAll("#modal-client input:not([type='hidden'])").forEach((i) => (i.value = ""));
        }
    }

    if (id === "modal-factura") {
        populeazaBridgeUI();

        const title = document.getElementById("modal-factura-title");
        const anafBox = document.getElementById("anaf-info-box");
        const anafBadge = document.getElementById("anaf-status-badge");
        const anafId = document.getElementById("anaf-id-display");
        const dispEmisie = document.getElementById("display-emisie");
        const dispScadenta = document.getElementById("display-scadenta");

        const sincronizeazaDateVizual = () => {
            const dataEmisie = document.getElementById("in-fac-emisie").value;
            const dataScadenta = document.getElementById("in-fac-scad").value;
            dispEmisie.innerText = dataEmisie ? formateazaDataZFlow(dataEmisie) : "Alege data";
            dispScadenta.innerText = dataScadenta ? formateazaDataZFlow(dataScadenta) : "Alege data";
        };

        document.getElementById("in-fac-emisie").onchange = sincronizeazaDateVizual;
        document.getElementById("in-fac-scad").onchange = sincronizeazaDateVizual;

        if (targetId) {
            const fc = ZFlowStore.dateFacturiBI.find((x) => String(x.id) === String(targetId));
            if (fc) {
                title.innerText = "Editează Factura " + (fc.numar_factura || "");
                document.getElementById("in-fac-id").value = fc.id;
                document.getElementById("in-fac-client").value = fc.client_id;
                document.getElementById("in-fac-nr").value = fc.numar_factura;
                document.getElementById("in-fac-val").value = fc.valoare;
                document.getElementById("in-fac-emisie").value = fc.data_emiterii;
                document.getElementById("in-fac-scad").value = fc.data_scadenta;
                document.getElementById("in-auto").value = fc.numar_auto || "";
                const uitEl = document.getElementById("in-uit"); if (uitEl) uitEl.value = fc.uit_code || "";
                document.getElementById("in-fac-note").value = fc.note || "";
                sincronizeazaDateVizual();

                if (anafBox) {
                    anafBox.classList.remove("hidden");
                    if (fc.status_anaf === "validated") {
                        anafBadge.innerText = "VALIDAT";
                        anafBadge.className = "text-[9px] font-extrabold uppercase p-1 rounded bg-green-50 text-green-600 px-2";
                    } else if (fc.status_anaf === "error") {
                        anafBadge.innerText = "EROARE";
                        anafBadge.className = "text-[9px] font-extrabold uppercase p-1 rounded bg-red-50 text-red-600 px-2";
                    } else {
                        anafBadge.innerText = "ÎN AȘTEPTARE";
                        anafBadge.className = "text-[9px] font-extrabold uppercase p-1 rounded bg-slate-100 text-slate-400 px-2";
                    }
                    anafId.innerText = fc.id_descarcare_anaf ? "ID: " + fc.id_descarcare_anaf : "";
                }
                logicUIT(fc.valoare);
            }
        } else {
            title.innerText = "Factură Nouă";
            document.getElementById("in-fac-id").value = "";
            document.getElementById("in-fac-client").value = "";
            document.querySelectorAll("#modal-factura input:not([type='hidden'])").forEach((i) => (i.value = ""));
            document.getElementById("in-fac-note").value = "";
            const _dataFacImplicita = getDataImplicita();
            document.getElementById("in-fac-emisie").value = _dataFacImplicita;
            document.getElementById("in-fac-scad").value = _dataFacImplicita;
            sincronizeazaDateVizual();
            if (anafBox) anafBox.classList.add("hidden");
            logicUIT(0);
        }
        // Arată/ascunde banner avertizare suport
        const warningFac = document.getElementById("modal-factura-suport-warning");
        if (warningFac) {
            const isNew = !targetId;
            isNew ? warningFac.classList.remove("hidden") : warningFac.classList.add("hidden");
        }
        // #23 - Reset fișiere & arată atașamente existente la deschidere modal
        pendingPDFFiles = [];
        renderExistingPDFList(targetId || null);
        setTimeout(() => initDragDropPDF(), 80);
    }

    const modalElement = document.getElementById(id);
    if (modalElement) {
        setTimeout(() => modalElement.classList.add("active"), 50);
    }
}

/**
 * Închide un modal
 */
function inchideModal(id) {
    document.getElementById(id).classList.remove("active");
}

/**
 * Inițializează zona Drag & Drop pentru upload PDF
 * #13/#23 - Drag & drop vizual zone, suport fișiere multiple
 */
function initDragDropPDF() {
    const zone = document.getElementById('dropzone-factura');
    const fileInput = document.getElementById('in-fac-file');
    const label = document.getElementById('pdf-drop-label') || null; // not present in HTML, guarded below
    const filesList = document.getElementById('pending-pdf-list');
    if (!zone || !fileInput) return;

    // Reset vizual la deschidere
    zone.classList.remove('has-file', 'drag-over');
    if (label) label.innerHTML = 'Trage PDF-urile aici sau <span class="text-blue-600 underline">alege fișierele</span>';
    if (filesList) { filesList.classList.add('hidden'); filesList.innerHTML = ''; }

    // Click pe input (fallback clasic)
    fileInput.onchange = (e) => {
        Array.from(e.target.files).forEach(f => _addPendingPDF(f));
        fileInput.value = '';
    };

    // Drag events
    zone.ondragover = (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    };
    zone.ondragleave = (e) => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    };
    zone.ondrop = (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        Array.from(e.dataTransfer.files).forEach(f => {
            if (f.type === 'application/pdf') {
                _addPendingPDF(f);
            } else {
                showNotification(`Fișierul "${f.name}" nu este PDF!`, 'warning');
            }
        });
    };
}

/**
 * Adaugă un fișier la lista de pending PDFs (#23)
 */
function _addPendingPDF(file) {
    if (file.size > 10 * 1024 * 1024) {
        showNotification(`"${file.name}" depășește limita de 10MB!`, 'error');
        return;
    }
    if (pendingPDFFiles.length >= 5) {
        showNotification('Max 5 fișiere per factură!', 'warning');
        return;
    }
    // Evită duplicate
    if (pendingPDFFiles.some(f => f.name === file.name && f.size === file.size)) {
        showNotification(`"${file.name}" este deja adăugat!`, 'warning');
        return;
    }
    pendingPDFFiles.push(file);
    renderPDFFileList();
    if (navigator.vibrate) navigator.vibrate(30);
}

/**
 * Randează lista fișierelor PDF în așteptare (#23)
 */
function renderPDFFileList() {
    const zone = document.getElementById('pdf-drop-zone');
    const label = document.getElementById('pdf-drop-label');
    const filesList = document.getElementById('pdf-files-list');
    if (!filesList) return;

    if (pendingPDFFiles.length === 0) {
        filesList.classList.add('hidden');
        filesList.innerHTML = '';
        if (zone) zone.classList.remove('has-file');
        if (label) label.innerHTML = 'Trage PDF-urile aici sau <span class="text-blue-600 underline">alege fișierele</span>';
        return;
    }

    if (zone) zone.classList.add('has-file');
    if (label) label.innerHTML = `<span class="text-emerald-700 font-black">${pendingPDFFiles.length} fișier${pendingPDFFiles.length > 1 ? 'e' : ''} selectat${pendingPDFFiles.length > 1 ? 'e' : ''}</span><br/><span class="text-[9px] text-slate-400 font-normal">Clic pentru a adăuga mai multe</span>`;

    filesList.classList.remove('hidden');
    filesList.innerHTML = pendingPDFFiles.map((f, i) => `
        <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">
            <svg class="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            <span class="text-[10px] font-bold text-emerald-800 truncate flex-1">${f.name}</span>
            <span class="text-[8px] text-slate-400">${(f.size / 1024).toFixed(0)}KB</span>
            <button onclick="removePendingPDF(${i})" class="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors flex-shrink-0" title="Elimină">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('');
}

/**
 * Elimină un fișier din lista pending (#23)
 */
function removePendingPDF(idx) {
    pendingPDFFiles.splice(idx, 1);
    renderPDFFileList();
}

/**
 * Randează lista atașamentelor deja salvate în modal (mod editare) — #23
 * @param {string|null} facturaId
 */
function renderExistingPDFList(facturaId) {
    const el = document.getElementById('pdf-existing-list');
    if (!el) return;
    if (!facturaId) { el.classList.add('hidden'); el.innerHTML = ''; return; }

    const fac = ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(facturaId));
    const urls = _getPDFUrls(fac);

    if (urls.length === 0) { el.classList.add('hidden'); el.innerHTML = ''; return; }

    el.classList.remove('hidden');
    el.innerHTML = `
        <p class="text-[8px] font-extrabold text-slate-400 uppercase ml-1">Atașamente salvate:</p>
        ${urls.map((url, i) => `
            <div class="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5">
                <svg class="w-3 h-3 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/></svg>
                <a href="${url}" target="_blank" class="text-[10px] font-bold text-blue-700 truncate flex-1 underline">PDF ${i + 1}</a>
                <button onclick="stergeAtasamentPDF('${facturaId}', '${encodeURIComponent(url)}')"
                        class="w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        title="Șterge atașament">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        `).join('')}
    `;
}

/**
 * Șterge un atașament PDF deja salvat la o factură — #23
 * Elimină fișierul din Storage și actualizează pdf_url în DB + store local
 */
async function stergeAtasamentPDF(facturaId, encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    const fac = ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(facturaId));
    if (!fac) return;

    const urlActuale = _getPDFUrls(fac);
    const urlRamase = urlActuale.filter(u => u !== url);

    try {
        setLoader(true);
        // Actualizare DB
        const nouPdfUrl = urlRamase.length === 0 ? null
            : urlRamase.length === 1 ? urlRamase[0]
            : JSON.stringify(urlRamase);
        await ZFlowDB.updateFactura(facturaId, { pdf_url: nouPdfUrl });

        // Șterge fișier din storage (best-effort, nu blochează dacă eșuează)
        ZFlowDB.deletePDFFromStorage(url).catch(() => {});

        // Actualizare store local (fără re-fetch complet)
        const idx = ZFlowStore.dateFacturiBI.findIndex(x => String(x.id) === String(facturaId));
        if (idx !== -1) ZFlowStore.dateFacturiBI[idx].pdf_url = nouPdfUrl;

        // Re-randează lista în modal
        renderExistingPDFList(facturaId);
        showNotification('Atașament șters', 'success');
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    } catch (err) {
        showNotification('Eroare la ștergere: ' + err.message, 'error');
    } finally {
        setLoader(false);
    }
}

/**
 * Helper: extrage lista de PDF URL-uri dintr-o factură (#23)
 * Suportă atât formatul nou (JSON array) cât și cel vechi (string simplu)
 */
function _getPDFUrls(fac) {
    if (!fac || !fac.pdf_url) return [];
    try {
        const parsed = JSON.parse(fac.pdf_url);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e) {}
    return [fac.pdf_url];
}

/**
 * Helper intern: aplică fișierul selectat/dropped pe zona vizuală (legacy - neutilizat)
 */
function _setDroppedPDF(file, zone, label) {
    _addPendingPDF(file);
}

/**
 * Deschide modal factură direct pentru clientul curent
 */
function deschideModalDirectFactura() {
    const idClientCurent = document.getElementById("in-client-id").value;

    if (idClientCurent) {
        deschideModal("modal-factura");
        setTimeout(() => {
            const selectClient = document.getElementById("in-fac-client");
            if (selectClient) {
                selectClient.value = idClientCurent;
                selectClient.dispatchEvent(new Event("change"));
            }
        }, 100);
    } else {
        showNotification("Nu am putut identifica clientul pentru această factură.", "error");
    }
}

// → crud.js (CRUD + Modal confirmare, extrase în Runda 9)
// ==========================================
// IMPORT / EXPORT
// ==========================================

/**
 * Afișează un modal cu erorile de import — vizibil fără F12
 */
function showImportEroriModal(erori, tipLabel) {
    // Grupează erorile pe tipuri
    const duplicate = erori.filter(e => e.startsWith('Duplicat'));
    const negasite  = erori.filter(e => e.includes('negăsit'));
    const inserare  = erori.filter(e => e.includes('Eroare inserare') || e.includes('insert'));
    const mapare    = erori.filter(e => e.includes('Lipsă') || e.includes('Rândul'));
    const altele    = erori.filter(e => !duplicate.includes(e) && !negasite.includes(e) && !inserare.includes(e) && !mapare.includes(e));

    const sectiune = (titlu, lista, culoare) => lista.length === 0 ? '' : `
        <div class="mb-3">
            <p class="text-xs font-black uppercase tracking-wide text-${culoare}-600 mb-1">${titlu} (${lista.length})</p>
            ${lista.slice(0, 8).map(e => `<p class="text-xs text-slate-700 bg-${culoare}-50 rounded px-2 py-1 mb-0.5 truncate">• ${e}</p>`).join('')}
            ${lista.length > 8 ? `<p class="text-xs text-slate-400 italic">...și alte ${lista.length - 8}</p>` : ''}
        </div>`;

    const htmlContiunt = `
        <div class="fixed inset-0 bg-black/60 z-[9999] flex items-end justify-center p-4" id="modal-import-erori" onclick="if(event.target===this)this.remove()">
            <div class="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
                    <div>
                        <p class="text-xs font-black uppercase tracking-widest text-red-500">Import ${tipLabel} — Erori</p>
                        <h2 class="text-xl font-black text-slate-900">0 facturi importate</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${erori.length} probleme detectate</p>
                    </div>
                    <button onclick="document.getElementById('modal-import-erori')?.remove()" class="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg">×</button>
                </div>
                <div class="overflow-y-auto px-6 py-4 flex-1">
                    ${mapare.length > 0 ? `
                    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
                        <p class="text-xs font-black text-amber-700 uppercase tracking-wide mb-1">Headere CSV nerecunoscute</p>
                        <p class="text-xs text-amber-600">Coloanele din fișier nu se potrivesc cu formatul așteptat. Deschide <strong>F12 → Console</strong> și caută <code>[Import] Headere detectate</code> pentru a vedea ce coloane au fost găsite.</p>
                    </div>` : ''}
                    ${negasite.length > 0 ? `
                    <div class="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
                        <p class="text-xs font-black text-red-700 uppercase tracking-wide mb-1">Clienți/Furnizori negăsiți</p>
                        <p class="text-xs text-red-600 mb-2">CUI-urile din CSV nu există în baza de date și nu au putut fi create.</p>
                        ${negasite.slice(0, 5).map(e => `<p class="text-xs font-mono bg-white rounded px-2 py-0.5 mb-0.5 text-red-800">• ${e}</p>`).join('')}
                        ${negasite.length > 5 ? `<p class="text-xs text-red-400 italic mt-1">...și alte ${negasite.length - 5} erori similare</p>` : ''}
                    </div>` : ''}
                    ${inserare.length > 0 ? `
                    <div class="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
                        <p class="text-xs font-black text-orange-700 uppercase tracking-wide mb-1">Erori inserare Supabase</p>
                        ${inserare.slice(0, 5).map(e => `<p class="text-xs font-mono bg-white rounded px-2 py-0.5 mb-0.5 text-orange-800 break-all">• ${e}</p>`).join('')}
                        ${inserare.length > 5 ? `<p class="text-xs text-orange-400 italic mt-1">...și alte ${inserare.length - 5}</p>` : ''}
                    </div>` : ''}
                    ${duplicate.length > 0 ? `
                    <div class="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4">
                        <p class="text-xs font-black text-blue-700 uppercase tracking-wide mb-1">Duplicate (${duplicate.length})</p>
                        <p class="text-xs text-blue-600">Aceste facturi există deja în baza de date.</p>
                    </div>` : ''}
                    ${altele.length > 0 ? `
                    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-4">
                        <p class="text-xs font-black text-slate-600 uppercase tracking-wide mb-1">Alte erori</p>
                        ${altele.slice(0, 5).map(e => `<p class="text-xs bg-white rounded px-2 py-0.5 mb-0.5 text-slate-700">• ${e}</p>`).join('')}
                    </div>` : ''}
                    <div class="bg-slate-100 rounded-2xl p-3 mt-2">
                        <p class="text-xs font-bold text-slate-600 mb-1">Soluție rapidă</p>
                        <p class="text-xs text-slate-500">1. Verifică că CSV-ul are coloanele: <strong>DENUMIRE, CUI, NR. FACTURA, VALOARE, DATA</strong><br>2. Asigură-te că delimitatorul este <strong>;</strong> (punct și virgulă)<br>3. Deschide <strong>F12 → Console</strong> → caută <code>[Import] Headere</code> pentru detalii complete</p>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-slate-100">
                    <button onclick="document.getElementById('modal-import-erori')?.remove()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl py-3 text-sm transition-all">Închide</button>
                </div>
            </div>
        </div>`;

    document.getElementById('modal-import-erori')?.remove();
    document.body.insertAdjacentHTML('beforeend', htmlContiunt);
}

/**
 * Import date din CSV (SAGA)
 */
async function importaDateSaga(tipImport = 'clienti') {
    ZFlowLogger.debug('app', "🔄 importaDateSaga() apelat, tip:", tipImport);
    ZFlowLogger.debug('app', "🔐 Permisiune canImport:", hasPermission('canImport'));
    ZFlowLogger.debug('app', "🔐 Rol curent:", ZFlowStore.userRole);
    
    if (!hasPermission('canImport')) {
        showNotification("Nu ai permisiunea de a importa date", "error");
        return;
    }
    
    ZFlowLogger.debug('app', "📂 Se deschide dialog selectare fișier...");
    
    const _sagaInputId = tipImport === 'furnizori' ? 'import-saga-furnizori-file' : 'import-saga-file';
    let fileInput = document.getElementById(_sagaInputId);
    if (!fileInput) {
        ZFlowLogger.debug('app', "📂 Creez input file nou");
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = _sagaInputId;
        fileInput.accept = ".csv,.xlsx";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        fileInput.addEventListener("change", async function (e) {
            const file = e.target.files[0];
            if (!file) return;

            setLoader(true);
            try {
                const rawText = await file.text();
                // Strip UTF-8 BOM dacă există
                const text = rawText.replace(/^\uFEFF/, '');
                const isFurnizori = tipImport === 'furnizori';
                const tipLabel = isFurnizori ? 'Furnizori' : 'Clienți';
                let importate = 0;
                let actualizate = 0;      // facturi existente cu status actualizat (ex. Neincasat→Incasat)
                let duplicateSilent = 0;  // facturi existente fără nicio modificare — skip silențios
                let clientiNoi = 0;
                const erori = [];

                // ── Cale 1: ZFlowImport disponibil → CSV cu headere (format SAGA standard) ──
                if (typeof ZFlowImport !== 'undefined' && ZFlowImport.parseCSV) {
                    const delimiter = ZFlowImport.detectDelimiter(text);
                    const rows = ZFlowImport.parseCSV(text, { delimiter });
                    ZFlowLogger.debug('app', '[Import] ─────────────────────────────────────');
                    ZFlowLogger.debug('app', '[Import] Delimiter detectat:', JSON.stringify(delimiter), '| Rânduri date:', rows.length);
                    if (rows.length > 0) {
                        const headere = Object.keys(rows[0]);
                        ZFlowLogger.debug('app', '[Import] Headere CSV detectate (' + headere.length + '):', headere);
                        ZFlowLogger.debug('app', '[Import] Primul rând valorificat:', JSON.stringify(rows[0]));
                    }
                    const { clienti: csvClienti, facturi: csvFacturi, errors: mapErrors } = ZFlowImport.mapSAGAData(rows);
                    ZFlowLogger.debug('app', '[Import] Clienți detectați:', csvClienti.length, '| Facturi:', csvFacturi.length, '| Erori mapare:', mapErrors.length);
                    if (csvClienti.length > 0) ZFlowLogger.debug('app', '[Import] Primul client mapat:', JSON.stringify(csvClienti[0]));
                    if (mapErrors.length > 0) { ZFlowLogger.warn('app', '[Import] Erori mapare:'); mapErrors.forEach(e => ZFlowLogger.warn('app', ' -', e)); }
                    ZFlowLogger.debug('app', '[Import] ZFlowStore.dateLocal:', ZFlowStore.dateLocal?.length, 'clienți | dateFacturiBI:', ZFlowStore.dateFacturiBI?.length, 'facturi');
                    ZFlowLogger.debug('app', '[Import] ─────────────────────────────────────');
                    erori.push(...mapErrors);

                    // ── Avertizare entități dual (client + furnizor) ────────────────
                    if (csvClienti.length > 0) {
                        const altaLista = isFurnizori ? (ZFlowStore.dateLocal||[]) : (ZFlowStore.dateFurnizori||[]);
                        const duale = csvClienti.filter(csvC => {
                            const cuiN = String(csvC.cui||'').replace(/\D/g,'');
                            if (!cuiN) return false;
                            return altaLista.some(e => String(e.cui||'').replace(/\D/g,'') === cuiN);
                        });
                        if (duale.length > 0) {
                            const numeDuale = duale.slice(0, 3).map(d => d.nume_firma || d.cui).join(', ');
                            const extra = duale.length > 3 ? ` și alte ${duale.length - 3}` : '';
                            showNotification(
                                `Atenție: ${duale.length} ${duale.length === 1 ? 'firmă este' : 'firme sunt'} atât client cât și furnizor: ${numeDuale}${extra}. Facturile se importă ca ${isFurnizori ? 'furnizori' : 'clienți'}.`,
                                'warning', 8000
                            );
                        }
                    }

                    // Pasul 1: Mapare entități existente & inserare entități noi
                    // clientIdMap: entityKey (CUI sau DENUMIRE) → ID real (Supabase sau local)
                    const clientIdMap = new Map();
                    const _totalImport = csvClienti.length + csvFacturi.length;
                    let _importProces = 0;
                    const _updateImportProgress = (_totalImport > 30)
                        ? () => { _importProces++; if (_importProces % 10 === 0) showNotification(`Import în curs: ${_importProces}/${_totalImport}...`, 'info', 900); }
                        : () => {};
                    for (const csvClient of csvClienti) {
                        const clientKey = (csvClient.cui || csvClient.nume_firma || '').trim();
                        if (!clientKey) {
                            ZFlowLogger.warn('app', '[Import] Client fără CUI și fără nume — sărit:', csvClient);
                            erori.push(`Client fără identificator (CUI/Nume lipsă) — verifică structura CSV`);
                            continue;
                        }
                        // Căutăm în sursele corecte: clienți sau furnizori
                        const surse = isFurnizori ? (ZFlowStore.dateFurnizori||[]) : (ZFlowStore.dateLocal||[]);
                        const existing = surse.find(c =>
                            (c.cui && csvClient.cui && String(c.cui).replace(/\D/g,'').toLowerCase() === String(csvClient.cui).replace(/\D/g,'').toLowerCase()) ||
                            (c.nume_firma && String(c.nume_firma).toLowerCase().trim() === String(csvClient.nume_firma||'').toLowerCase().trim())
                        );
                        if (existing) {
                            clientIdMap.set(clientKey, existing.id);
                            ZFlowLogger.debug('app', '[Import] Client existent găsit:', clientKey, '→', existing.id);
                        } else {
                            try {
                                const payload = {
                                    nume_firma: csvClient.nume_firma || csvClient.cui || '',
                                    cui: csvClient.cui || null,  // null în loc de '' — evită UNIQUE conflict
                                    adresa: csvClient.adresa || '',
                                    oras: csvClient.oras || ''
                                };
                                // Verificări payload
                                if (!payload.cui && !payload.nume_firma) {
                                    erori.push(`Client fără CUI și Denumire — skip`);
                                    continue;
                                }
                                if (!csvClient.nume_firma && csvClient.cui) {
                                    erori.push(`Atenție: Client ${csvClient.cui} — coloana DENUMIRE lipsă în CSV, a fost folosit CUI-ul ca denumire. Editați manual după import.`);
                                }
                                // insertClient / insertFurnizor returnează acum ID-ul creat direct
                                // strict=true → aruncă eroarea reală în loc de fallback demo
                                const newId = isFurnizori
                                    ? await ZFlowDB.insertFurnizor(payload, true)
                                    : await ZFlowDB.insertClient(payload, true);
                                if (newId) {
                                    clientIdMap.set(clientKey, newId);
                                    clientiNoi++;
                                } else {
                                    ZFlowLogger.warn('app', '[Import] insertClient/Furnizor returned falsy for key:', clientKey);
                                    erori.push(`${isFurnizori ? 'Furnizor' : 'Client'} ${csvClient.nume_firma || csvClient.cui}: insert a returnat ID null`);
                                }
                            } catch (clientErr) {
                                erori.push(`${isFurnizori ? 'Furnizor' : 'Client'} ${csvClient.nume_firma}: ${clientErr.message}`);
                            }
                        }
                        _updateImportProgress();
                    }
                    // Pasul 2: Importă facturi — lookup by entityKey (_tempClientKey din mapSAGAData)
                    ZFlowLogger.debug('app', '[Import] clientIdMap construit:', clientIdMap.size, 'entități. Keys:', [...clientIdMap.keys()]);
                    const idField = isFurnizori ? 'furnizor_id' : 'client_id';
                    for (const csvFact of csvFacturi) {
                        const factKey = (csvFact._tempClientKey || '').trim();
                        const realEntityId = clientIdMap.get(factKey);
                        if (!realEntityId) {
                            ZFlowLogger.warn('app', '[Import] Factură negăsită clientKey:', JSON.stringify(factKey), '| Available keys:', [...clientIdMap.keys()]);
                            erori.push(`Factură ${csvFact.nr_factura}: ${isFurnizori ? 'furnizor' : 'client'} negăsit (key: "${factKey}")`);
                            continue;
                        }

                        const _dupArray = isFurnizori ? (ZFlowStore.dateFacturiPlatit||[]) : (ZFlowStore.dateFacturiBI||[]);
                        const existingFact = _dupArray.find(f =>
                            String(f[idField]||'') === String(realEntityId) &&
                            String(f.numar_factura||'').trim() === String(csvFact.nr_factura||'').trim()
                        );
                        if (existingFact) {
                            // Factură existentă — verificăm dacă statusul sau nota s-a schimbat
                            const newStatus = _detectaStatusPlata(csvFact, isFurnizori);
                            const isPaidNow = isFurnizori ? (newStatus === 'Platit') : (newStatus === 'Incasat');
                            const wasUnpaid = isFurnizori
                                ? (existingFact.status_plata !== 'Platit')
                                : (existingFact.status_plata !== 'Incasat');
                            const newNote = (csvFact.descriere || '').trim();
                            const noteChanged = newNote && newNote !== (existingFact.note || '').trim();
                            if ((isPaidNow && wasUnpaid) || noteChanged) {
                                // Status schimbat spre plătit SAU nota actualizată → upsert
                                try {
                                    const updatePayload = {};
                                    if (isPaidNow && wasUnpaid) updatePayload.status_plata = newStatus;
                                    if (noteChanged) updatePayload.note = newNote;
                                    if (isFurnizori) {
                                        await ZFlowDB.updateFacturaPlatit(existingFact.id, updatePayload);
                                    } else {
                                        await ZFlowDB.updateFactura(existingFact.id, updatePayload);
                                    }
                                    actualizate++;
                                } catch (updErr) {
                                    erori.push(`Eroare actualizare ${csvFact.nr_factura}: ${updErr.message}`);
                                }
                            } else {
                                // Datele identice → duplicat silențios, NU adaugăm în erori
                                duplicateSilent++;
                            }
                            continue; // factură existentă procesată, trecem la următoarea
                        }

                        try {
                            if (isFurnizori) {
                                const autoStatusFurn = _detectaStatusPlata(csvFact, true);
                                await ZFlowDB.insertFacturaPlatit({
                                    furnizor_id: realEntityId,
                                    numar_factura: csvFact.nr_factura,
                                    valoare: csvFact.suma,
                                    data_emiterii: csvFact.data_emitere,
                                    data_scadenta: csvFact.data_scadenta,
                                    status_plata: autoStatusFurn,
                                    is_imported: true,
                                    note: csvFact.descriere || ''
                                }, true);
                            } else {
                                const autoStatusClient = _detectaStatusPlata(csvFact, false);
                                await ZFlowDB.insertFactura({
                                    client_id: realEntityId,
                                    numar_factura: csvFact.nr_factura,
                                    valoare: csvFact.suma,
                                    data_emiterii: csvFact.data_emitere,
                                    data_scadenta: csvFact.data_scadenta,
                                    status_plata: autoStatusClient,
                                    is_imported: true,
                                    note: csvFact.descriere || ''
                                }, true);
                            }
                            importate++;
                        } catch (insErr) {
                            erori.push(`Eroare inserare ${csvFact.nr_factura}: ${insErr.message}`);
                        }
                        _updateImportProgress();
                    }

                } else {
                    // ── Cale 2: Fallback — parsare pozițională (fișiere fără headere) ──
                    const linii = text.split('\n').filter(l => l.trim());
                    for (let i = 1; i < linii.length; i++) {
                        const cols = linii[i].trim().split(/[,;]/);
                        if (cols.length < 3) continue;
                        const cui = cols[0]?.trim().replace(/"/g, '');
                        const nrFactura = cols[1]?.trim().replace(/"/g, '');
                        const valoare = parseFloat(cols[2]?.trim().replace(/"/g, '').replace(',', '.')) || 0;
                        const dataEmiterii = cols[3]?.trim().replace(/"/g, '') || new Date().toISOString().split('T')[0];
                        const dataScadenta = cols[4]?.trim().replace(/"/g, '') || null;
                        const client = ZFlowStore.dateLocal.find(c =>
                            String(c.cui || '').trim().toLowerCase() === String(cui).trim().toLowerCase() ||
                            String(c.nume_firma || '').trim().toLowerCase() === String(cui).trim().toLowerCase()
                        );
                        if (!client) { erori.push(`CUI/Nume ${cui} negăsit`); continue; }
                        const dup = ZFlowStore.dateFacturiBI.find(f =>
                            String(f.client_id) === String(client.id) &&
                            String(f.numar_factura||'').trim().toLowerCase() === String(nrFactura).trim().toLowerCase()
                        );
                        if (dup) { erori.push(`Duplicat: ${nrFactura}`); continue; }
                        try {
                            await ZFlowDB.insertFactura({ client_id: client.id, numar_factura: nrFactura, valoare, data_emiterii: dataEmiterii, data_scadenta: dataScadenta, status_plata: 'Neincasat', is_imported: true });
                            importate++;
                        } catch (ie) { erori.push(`Eroare inserare ${nrFactura}`); }
                    }
                }

                localStorage.setItem('lastSagaSync', new Date().toISOString());
                updateSyncStatus(); // Update UI sync status after successful import

                const duplicates = erori.filter(e => e.startsWith('Duplicat')).length;
                const entitatiLabel = isFurnizori ? 'furnizori' : 'clienți';
                let mesaj = `Import ${tipLabel}: ${importate} facturi noi`;
                if (actualizate > 0) mesaj += `, ${actualizate} actualizate`;
                if (clientiNoi > 0) mesaj += `, ${clientiNoi} ${entitatiLabel} noi`;
                if (duplicateSilent > 0) mesaj += ` (${duplicateSilent} duplicate ignorate)`;
                else if (duplicates > 0) mesaj += ` (${duplicates} duplicate ignorate)`;

                if (importate > 0 || actualizate > 0 || clientiNoi > 0) {
                    showNotification(mesaj, 'success');
                    // Reîncarcă store din Supabase fără reinit complet (evită pierderea datelor)
                    try {
                        const [clNew, fcRes] = await Promise.all([
                            ZFlowDB.fetchClienti(),
                            ZFlowDB.fetchFacturiPaginated(500, 0)
                        ]);
                        ZFlowStore.dateFacturiBI = fcRes.data || [];
                        ZFlowStore._facturiTotal = fcRes.count || 0;
                        // [PERF-FIX] FIX 2 — avertizare limită 500 facturi după import
                        if (fcRes.count > 500) {
                            showNotification(`Afișezi 500 din ${fcRes.count} facturi. Folosiți filtrul de client pentru a vedea toate facturile.`, 'warning');
                        }
                        const aziR = new Date(); aziR.setHours(0, 0, 0, 0);
                        ZFlowStore.dateLocal = (clNew || []).map(c => {
                            const fcs = ZFlowStore.dateFacturiBI.filter(f => String(f.client_id) === String(c.id));
                            const sold = fcs.filter(f => f.status_plata !== 'Incasat').reduce((s, f) => s + (Number(f.valoare) || 0), 0);
                            const sumaScadenta = fcs.reduce((acc, fac) => {
                                if (fac.status_plata !== 'Incasat' && fac.data_scadenta) {
                                    const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                                    if (d < aziR) return acc + (Number(fac.valoare) || 0);
                                }
                                return acc;
                            }, 0);
                            return { ...c, facturi: fcs, sold, sumaScadenta };
                        });
                        if (isFurnizori) {
                            const [frNew, fpNew] = await Promise.all([ZFlowDB.fetchFurnizori(), ZFlowDB.fetchFacturiPlatit()]);
                            ZFlowStore.dateFacturiPlatit = fpNew || [];
                            const aziF = new Date(); aziF.setHours(0, 0, 0, 0);
                            ZFlowStore.dateFurnizori = (frNew || []).map(furn => {
                                const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
                                const sold = fps.filter(fp2 => fp2.status_plata !== 'Platit').reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
                                const sumaScadenta = fps.reduce((acc, fac) => {
                                    if (fac.status_plata !== 'Platit' && fac.data_scadenta) {
                                        const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                                        if (d < aziF) return acc + (Number(fac.valoare) || 0);
                                    }
                                    return acc;
                                }, 0);
                                return { ...furn, facturi: fps, sold, sumaScadenta };
                            });
                        }
                        invalidateCashflowCache();
                        renderMain();
                        updateDashboardKPI();
                        if (isFurnizori && typeof renderFurnizori === 'function') renderFurnizori();
                        if (isFurnizori && typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
                        populeazaBridgeUI();   // Actualizează checkboxurile BI cu noile entități importate
                        incarcaDashboard();    // Actualizează KPI-urile Home cu noile date
                        ZFlowLogger.debug('app', '[Import] Store reîncărcat:', ZFlowStore.dateLocal.length, 'clienți,', ZFlowStore.dateFacturiBI.length, 'facturi');
                    } catch (refreshErr) {
                        ZFlowLogger.error('app', '[Import] Eroare reîncărcare date:', refreshErr);
                        await init(false);
                    }
                } else if (duplicateSilent > 0 && erori.length === 0) {
                    showNotification(`Toate facturile există deja (${duplicateSilent} duplicate ignorate)`, 'warning');
                } else if (duplicates === erori.length && erori.length > 0) {
                    showNotification(`Toate facturile există deja (${duplicates} duplicate)`, 'warning');
                } else if (erori.length > 0) {
                    // Log individual pentru fiecare eroare
                    console.group('[Import] Erori detaliate (' + erori.length + ')');
                    erori.forEach((e, i) => ZFlowLogger.warn('app', `  #${i+1}: ${e}`));
                    console.groupEnd();
                    // Afișaj vizual în UI — nu necesită F12
                    const primele5 = erori.slice(0, 5).map(e => `• ${e}`).join('\n');
                    const restul = erori.length > 5 ? `\n...și alte ${erori.length - 5} erori (vezi F12 Console)` : '';
                    showImportEroriModal(erori, tipLabel);
                } else {
                    showNotification('Fișierul nu conține date valide', 'warning');
                }
            } catch (err) {
                ZFlowLogger.error('app', 'Eroare import CSV:', err);
                showNotification('Eroare import: ' + err.message, 'error');
            } finally {
                setLoader(false);
                fileInput.value = '';
            }
        });
    } else {
        ZFlowLogger.debug('app', "📂 Input file existent reutilizat");
    }

    // Auto-detect mode: text pre-citit din importaDateSagaAuto -> procesare fara al doilea file picker
    if (window.__sagaAutoText) {
        const sagaText = window.__sagaAutoText;
        window.__sagaAutoText = null;
        try {
            const dt = new DataTransfer();
            dt.items.add(new File([sagaText], 'import-auto.csv', { type: 'text/plain' }));
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change'));
        } catch(dtErr) {
            ZFlowLogger.warn('app', '[AutoImport] DataTransfer nesupported:', dtErr.message);
            fileInput.click();
        }
        return;
    }

    fileInput.click();
}

/**
 * Export PDF - INTELIGENT: detectează dacă există selecție bulk
 * Dacă sunt facturi selectate -> exportă doar selecția
 * Altfel -> exportă toate facturile filtrate
 */
async function exportaPDF() {
    try {
        if (window.ZFlowExport) await window.ZFlowExport._ensureJsPDF();
    } catch (e) {
        // Retry automat o singură dată după 1.2s (CDN poate fi temporar lent)
        try {
            await new Promise(r => setTimeout(r, 1200));
            if (window.ZFlowExport) await window.ZFlowExport._ensureJsPDF();
        } catch (e2) {
            ZFlowLogger.error('app', 'Eroare la încărcarea jsPDF (retry eșuat): ' + e2.message);
            showNotification('Export PDF indisponibil · Verificați conexiunea la internet', 'error');
            return;
        }
    }

    // VERIFICARE BULK SELECTION - dacă există facturi selectate, exportă doar selecția
    if (ZFlowStore.bulkMode && ZFlowStore.bulkSelectedFacturi.length > 0) {
        ZFlowLogger.debug('app', "Export PDF - MOD SELECȚIE: " + ZFlowStore.bulkSelectedFacturi.length + " facturi");
        exportaPDFSelectie();
        return;
    }
    
    ZFlowLogger.debug('app', "Export PDF - MOD COMPLET: toate facturile filtrate");
    if (!window.jspdf?.jsPDF) {
        showNotification('Biblioteca PDF nu este disponibilă. Reîncarcă pagina și încearcă din nou.', 'error');
        return;
    }

    try {

    const curataText = (text) => {
        if (!text) return "";
        return text.toString()
            .replace(/ș/g, "s").replace(/Ș/g, "S")
            .replace(/ț/g, "t").replace(/Ț/g, "T")
            .replace(/ă/g, "a").replace(/Ă/g, "A")
            .replace(/î/g, "i").replace(/Î/g, "I")
            .replace(/â/g, "a").replace(/Â/g, "A");
    };

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const pdfStartVal = document.getElementById("data-start")?.value || ZFlowStore.biStartVal || null;
    const pdfEndVal = document.getElementById("data-end")?.value || ZFlowStore.biEndVal || null;
    const pdfStartDate = pdfStartVal ? new Date(pdfStartVal + "T00:00:00") : null;
    const pdfEndDate = pdfEndVal ? new Date(pdfEndVal + "T23:59:59") : null;
    const pdfIds = Array.from(document.querySelectorAll("#container-bi-checks input:checked")).map(i => String(i.value));
    const pStart = pdfStartVal ? formateazaDataZFlow(pdfStartVal) : (document.getElementById("label-start")?.innerText || "--");
    const pEnd = pdfEndVal ? formateazaDataZFlow(pdfEndVal) : (document.getElementById("label-end")?.innerText || "--");
    const sumaTotala = document.getElementById("suma-selectata-bi")?.innerText || "0 lei";

    // Construiește rândurile din ZFlowStore direct (nu din DOM)
    const facturiFiltratePDF = (ZFlowStore.filtruStatusBI !== 'Platit')
        ? (ZFlowStore.dateFacturiBI || []).filter(f => {
            if (!pdfIds.includes(String(f.client_id))) return false;
            const matchStatus = ZFlowStore.filtruStatusBI === 'toate' ||
                                (ZFlowStore.filtruStatusBI === 'Neincasat'
                                    ? f.status_plata !== 'Incasat'
                                    : f.status_plata === ZFlowStore.filtruStatusBI);
            const dataFactura = f.data_emiterii || '';
            let facturaDate = null;
            if (dataFactura.includes('/')) {
                const pts = dataFactura.split('/');
                if (pts.length === 3) { let y = parseInt(pts[2]); if (y < 100) y += 2000; facturaDate = new Date(y, parseInt(pts[1])-1, parseInt(pts[0])); }
            } else { facturaDate = dataFactura ? new Date(dataFactura) : null; }
            if (facturaDate) facturaDate.setHours(12,0,0,0);
            const dOk = facturaDate && !isNaN(facturaDate);
            let matchData = true;
            if (pdfStartDate && dOk) matchData = matchData && facturaDate >= pdfStartDate;
            if (pdfEndDate && dOk) matchData = matchData && facturaDate <= pdfEndDate;
            return matchData && matchStatus;
          })
        : [];

    // ── Preia sumele din bi-totale-bar si contributii ───────────────────
    const biClienti   = document.getElementById("suma-selectata-bi")?.innerText?.trim() || "0 lei";
    const biFurnizori = document.getElementById("suma-platit-bi")?.innerText?.trim()    || "0 lei";
    const biNet       = document.getElementById("cf-net")?.innerText?.trim()            || "0 lei";
    const biContributii = document.getElementById("cf-contributii")?.innerText?.trim() || "0 lei";
    const biNetNormalized = biNet.replace(/\u2212/g, '-');
    const cfNetVal    = parseFloat(biNetNormalized.replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;

    // ── Header raport ─────────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(curataText("RAPORT ANALIZA FINANCIARA — Z-FLOW"), 14, 18);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(curataText(`Perioada: ${pStart} — ${pEnd}   |   Generat: ${new Date().toLocaleDateString("ro-RO")}`), 14, 25);

    // ── Tabel sumar bi-totale-bar + contributii ───────────────────────
    doc.autoTable({
        startY: 29,
        head: [[
            curataText("TOTAL CLIENȚI (facturat)"),
            curataText("TOTAL FURNIZORI (plăți)"),
            curataText("CONTRIBUȚII BUGET STAT"),
            curataText("DIFERENȚĂ NET")
        ]],
        body: [[
            curataText(biClienti),
            curataText(biFurnizori),
            curataText(biContributii),
            curataText(biNetNormalized)
        ]],
        theme: "grid",
        tableWidth: 182,
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [30, 58, 138], fontSize: 6.8, halign: "center", fontStyle: "bold", cellPadding: 2 },
        styles: { fontSize: 9, minCellHeight: 6, halign: "center", fontStyle: "bold", cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 45.5, textColor: [30, 58, 138] },
            1: { cellWidth: 45.5, textColor: [185, 28, 28] },
            2: { cellWidth: 45.5, textColor: [217, 119, 6] },
            3: { cellWidth: 45.5, textColor: cfNetVal >= 0 ? [5, 150, 105] : [185, 28, 28] },
        }
    });

    const rows = facturiFiltratePDF.map(f => {
        const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(f.client_id));
        return [
            curataText(client?.nume_firma || 'Client'),
            curataText(f.numar_factura || '—'),
            curataText(formateazaDataZFlow(f.data_emiterii)),
            curataText(f.data_scadenta ? formateazaDataZFlow(f.data_scadenta) : '—'),
            curataText(`${Math.round(Number(f.valoare) || 0).toLocaleString()} lei`),
            curataText(f.status_plata === 'Incasat' ? 'INCASAT' : 'NEINCASAT')
        ];
    });

    const firstTableEndY = doc.lastAutoTable?.finalY || 39;
    doc.autoTable({
        startY: firstTableEndY + 8,
        head: [[curataText("CLIENT"), curataText("DOCUMENT"), curataText("EMIS LA"), curataText("SCADENTA"), curataText("SUMA"), curataText("STATUS")]],
        body: rows,
        theme: "striped",
        tableWidth: 182,
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [30, 58, 138], fontSize: 8, halign: "center" },
        styles: { fontSize: 7, cellPadding: 2, minCellHeight: 6, halign: "center", overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 44, halign: "center" },
            1: { cellWidth: 30, halign: "center" },
            2: { cellWidth: 24, halign: "center" },
            3: { cellWidth: 24, halign: "center" },
            4: { cellWidth: 34, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        },
        didParseCell: function (data) {
            if (data.section === "body" && data.column.index === 5) {
                if (data.cell.raw === "INCASAT") {
                    data.cell.styles.textColor = [16, 185, 129];
                } else {
                    data.cell.styles.textColor = [239, 68, 68];
                }
            }
        },
    });

    // Adaugă secțiunea furnizori dacă statusFiltru include furnizori (Toate sau Neplătite)
    if ((ZFlowStore.filtruStatusBI === 'toate' || ZFlowStore.filtruStatusBI === 'Platit') && ZFlowStore.dateFacturiPlatit?.length > 0) {
        const sD = pdfStartDate;
        const eD = pdfEndDate;
        const selFurnIds = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
        // Fără fallback — consistent cu calculeazaCashflow: nicio selecție = nicio intrare
        const filtrateFP = _filtreazaFacturiPlatit(sD, eD, selFurnIds, '');

        if (filtrateFP.length > 0) {
            const rowsFP = filtrateFP.map(f => {
                const furn = ZFlowStore.dateFurnizori.find(fr => String(fr.id) === String(f.furnizor_id));
                return [
                    curataText(furn?.nume_firma || 'Furnizor'),
                    curataText(f.numar_factura || '—'),
                    curataText(formateazaDataZFlow(f.data_emiterii)),
                    curataText(f.data_scadenta ? formateazaDataZFlow(f.data_scadenta) : '—'),
                    curataText(`${Math.round(f.valoare || 0).toLocaleString()} lei`),
                    curataText(f.status_plata || 'Neplatit')
                ];
            });

            const totalFP = filtrateFP.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
            const lastY = doc.lastAutoTable?.finalY || 60;
            doc.setFontSize(12);
            doc.setTextColor(185, 28, 28);
            doc.text(curataText('FURNIZORI — FACTURI DE PLATIT'), 14, lastY + 12);
            doc.setFontSize(10);
            doc.text(curataText(`Total furnizori: ${Math.round(totalFP).toLocaleString()} lei`), 14, lastY + 18);
            doc.autoTable({
                startY: lastY + 22,
                head: [[curataText('FURNIZOR'), curataText('DOCUMENT'), curataText('EMIS LA'), curataText('SCADENTA'), curataText('SUMA'), curataText('STATUS')]],
                body: rowsFP,
                theme: 'striped',
                tableWidth: 182,
                margin: { left: 14, right: 14 },
                headStyles: { fillColor: [185, 28, 28], fontSize: 8, halign: 'center' },
                styles: { fontSize: 7, cellPadding: 2, minCellHeight: 6, halign: 'center', overflow: 'linebreak' },
                columnStyles: {
                    0: { cellWidth: 44 }, 1: { cellWidth: 30 }, 2: { cellWidth: 24 },
                    3: { cellWidth: 24 }, 4: { cellWidth: 34, fontStyle: 'bold' }, 5: { cellWidth: 26, fontStyle: 'bold' }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 5) {
                        data.cell.styles.textColor = data.cell.raw === 'Platit' ? [16, 185, 129] : [239, 68, 68];
                    }
                }
            });
        }
    }

    // ── Grafic evoluție lunară (line chart) ─────────────────────────────────
    try {
        // Agreg facturile clienți pe luni
        const luniMap = {};
        facturiFiltratePDF.forEach(f => {
            const d = f.data_emiterii ? f.data_emiterii.substring(0, 7) : null;
            if (!d) return;
            if (!luniMap[d]) luniMap[d] = { clienti: 0, furnizori: 0 };
            luniMap[d].clienti += Number(f.valoare) || 0;
        });
        // Agreg facturile furnizori pe luni (dacă sunt disponibile)
        const selFurnIdsChart = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
        // Fără fallback — consistent cu selecția activă
        const filtrateFPChart = _filtreazaFacturiPlatit(pdfStartDate, pdfEndDate, selFurnIdsChart, '');
        filtrateFPChart.forEach(f => {
            const d = f.data_emiterii ? f.data_emiterii.substring(0, 7) : null;
            if (!d) return;
            if (!luniMap[d]) luniMap[d] = { clienti: 0, furnizori: 0 };
            luniMap[d].furnizori += Number(f.valoare) || 0;
        });

        const luni = Object.keys(luniMap).sort();
        if (luni.length >= 2) {
            // Adaugă pagină nouă pentru grafic
            doc.addPage();
            const chartStartY = 20;
            const chartW = 182; // mm (A4 - margini)
            const chartH = 80;
            const marginL = 14;
            const maxVal = Math.max(...luni.map(l => Math.max(luniMap[l].clienti, luniMap[l].furnizori)), 1);
            const stepX = luni.length > 1 ? chartW / (luni.length - 1) : chartW;

            doc.setFontSize(12);
            doc.setTextColor(30, 58, 138);
            doc.text(curataText('GRAFIC EVOLUTIE LUNARA'), marginL, chartStartY - 4);

            // Axe
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            // Linii orizontale (grid)
            for (let i = 0; i <= 4; i++) {
                const y = chartStartY + chartH - (i / 4) * chartH;
                doc.line(marginL, y, marginL + chartW, y);
                const label = Math.round((maxVal * i / 4) / 1000);
                doc.setFontSize(5);
                doc.setTextColor(150, 150, 150);
                doc.text(`${label}k`, marginL - 1, y + 1, { align: 'right' });
            }

            // Puncte + linii pentru clienți/furnizori
            const clientiPoints = luni.map((luna, i) => {
                const x = marginL + i * stepX;
                const y = chartStartY + chartH - ((luniMap[luna].clienti / maxVal) * chartH);
                return { x, y, label: luna };
            });
            const furnizoriPoints = luni.map((luna, i) => {
                const x = marginL + i * stepX;
                const y = chartStartY + chartH - ((luniMap[luna].furnizori / maxVal) * chartH);
                return { x, y, label: luna };
            });

            doc.setDrawColor(30, 58, 138);
            doc.setLineWidth(0.8);
            for (let i = 1; i < clientiPoints.length; i++) {
                doc.line(clientiPoints[i - 1].x, clientiPoints[i - 1].y, clientiPoints[i].x, clientiPoints[i].y);
            }
            doc.setDrawColor(185, 28, 28);
            doc.setLineWidth(0.8);
            for (let i = 1; i < furnizoriPoints.length; i++) {
                doc.line(furnizoriPoints[i - 1].x, furnizoriPoints[i - 1].y, furnizoriPoints[i].x, furnizoriPoints[i].y);
            }

            clientiPoints.forEach((p) => {
                doc.setFillColor(30, 58, 138);
                doc.circle(p.x, p.y, 1.2, 'F');
            });
            furnizoriPoints.forEach((p) => {
                doc.setFillColor(185, 28, 28);
                doc.circle(p.x, p.y, 1.2, 'F');
            });

            // Etichete luni pe axa X
            doc.setFontSize(5);
            doc.setTextColor(80, 80, 80);
            luni.forEach((luna, i) => {
                const x = marginL + i * stepX;
                const labelLuna = luna.slice(5);
                doc.text(labelLuna, x, chartStartY + chartH + 4, { align: 'center' });
            });

            // Legendă
            const legY = chartStartY + chartH + 14;
            doc.setFillColor(30, 58, 138);
            doc.rect(marginL, legY, 6, 3, 'F');
            doc.setFontSize(6);
            doc.setTextColor(30, 58, 138);
            doc.text(curataText('Clienți (de încasat)'), marginL + 8, legY + 2.5);
            doc.setFillColor(185, 28, 28);
            doc.rect(marginL + 55, legY, 6, 3, 'F');
            doc.setTextColor(185, 28, 28);
            doc.text(curataText('Furnizori (de plătit)'), marginL + 63, legY + 2.5);

            // Tabel date lunare sumar
            const rowsGrafic = luni.map(l => [
                curataText(l),
                curataText(`${Math.round(luniMap[l].clienti).toLocaleString()} lei`),
                curataText(`${Math.round(luniMap[l].furnizori).toLocaleString()} lei`),
                curataText(`${Math.round(luniMap[l].clienti - luniMap[l].furnizori).toLocaleString()} lei`)
            ]);
            doc.autoTable({
                startY: legY + 12,
                head: [[curataText('LUNA'), curataText('INCASARI'), curataText('PLATI'), curataText('DIFERENTA')]],
                body: rowsGrafic,
                theme: 'grid',
                tableWidth: 182,
                margin: { left: marginL, right: 14 },
                headStyles: { fillColor: [30, 58, 138], fontSize: 7, halign: 'center' },
                styles: { fontSize: 7, cellPadding: 2, minCellHeight: 6, halign: 'center' },
            });
        }
    } catch (_chartErr) {
        ZFlowLogger.warn('app', 'Grafic PDF ignorat:', _chartErr.message);
    }

    doc.save(`Analiza_ZFlow_${new Date().toISOString().slice(0, 10)}.pdf`);
    saveZFlowData();

    } catch (pdfErr) {
        ZFlowLogger.error('app', 'Eroare la generarea PDF: ' + pdfErr.message);
        showNotification('Eroare la generarea PDF · ' + pdfErr.message, 'error');
    }
}

/**
 * Resetează filtrele BI după export
 */
function resetFiltreBIExport() {
    // Reset date picker-uri
    const dataStart = document.getElementById("data-start");
    const dataEnd = document.getElementById("data-end");
    const labelStart = document.getElementById("label-start");
    const labelEnd = document.getElementById("label-end");
    
    if (dataStart) {
        dataStart.value = "";
        if (labelStart) {
            labelStart.innerText = "De la: --";
            labelStart.parentElement?.classList.remove("border-blue-200");
        }
    }
    if (dataEnd) {
        dataEnd.value = "";
        if (labelEnd) {
            labelEnd.innerText = "Până la: --";
            labelEnd.parentElement?.classList.remove("border-blue-200");
        }
    }
    
    // Regenerează BI fără filtre de date
    genereazaBI();
}

/**
 * Export Excel - INTELIGENT: detectează dacă există selecție bulk
 * Dacă sunt facturi selectate -> exportă doar selecția
 * Altfel -> exportă toate facturile filtrate
 */
async function exportaExcel() {
    if (window.ZFlowExport) await window.ZFlowExport._ensureXLSX();

    // VERIFICARE BULK SELECTION - dacă există facturi selectate, exportă doar selecția
    if (ZFlowStore.bulkMode && ZFlowStore.bulkSelectedFacturi.length > 0) {
        ZFlowLogger.debug('app', "📊 Export Excel - MOD SELECȚIE: " + ZFlowStore.bulkSelectedFacturi.length + " facturi");
        exportaExcelSelectie();
        return;
    }
    
    ZFlowLogger.debug('app', "📊 Export Excel - MOD COMPLET: toate facturile filtrate");
    const s = document.getElementById("data-start")?.value || ZFlowStore.biStartVal || null;
    const e = document.getElementById("data-end")?.value || ZFlowStore.biEndVal || null;
    const ids = Array.from(document.querySelectorAll("#container-bi-checks input:checked")).map((i) => String(i.value));
    const xlsxStartDate = s ? new Date(s + "T00:00:00") : null;
    const xlsxEndDate = e ? new Date(e + "T23:59:59") : null;

    const facturiFiltrate = (ZFlowStore.filtruStatusBI !== 'Platit')
        ? (ZFlowStore.dateFacturiBI || []).filter(f => {
            if (!ids.includes(String(f.client_id))) return false;
            const matchStatus = ZFlowStore.filtruStatusBI === 'toate' ||
                                (ZFlowStore.filtruStatusBI === 'Neincasat'
                                    ? f.status_plata !== 'Incasat'
                                    : f.status_plata === ZFlowStore.filtruStatusBI);
            const dataFactura = f.data_emiterii || '';
            let fd = null;
            if (dataFactura.includes('/')) {
                const pts = dataFactura.split('/');
                if (pts.length === 3) { let y = parseInt(pts[2]); if (y < 100) y += 2000; fd = new Date(y, parseInt(pts[1])-1, parseInt(pts[0])); }
            } else { fd = dataFactura ? new Date(dataFactura) : null; }
            if (fd) fd.setHours(12,0,0,0);
            const dOk = fd && !isNaN(fd);
            let matchData = true;
            if (xlsxStartDate && dOk) matchData = matchData && fd >= xlsxStartDate;
            if (xlsxEndDate && dOk) matchData = matchData && fd <= xlsxEndDate;
            return matchData && matchStatus;
          })
        : [];

    const headers = ["Client", "Factură", "Valoare", "Status", "Scadență"];
    const rows = facturiFiltrate.map((f) => {
        const c = ZFlowStore.dateLocal.find((cl) => String(cl.id) === String(f.client_id));
        return [c?.nume_firma || "", f.numar_factura, f.valoare, f.status_plata, formateazaDataZFlow(f.data_scadenta)];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clienti - Incasat");

    // Foaie 2: Furnizori (la Toate sau Neplătite)
    if ((ZFlowStore.filtruStatusBI === 'toate' || ZFlowStore.filtruStatusBI === 'Platit') && ZFlowStore.dateFacturiPlatit?.length > 0) {
        const sD2 = s ? new Date(s + "T00:00:00") : null;
        const eD2 = e ? new Date(e + "T23:59:59") : null;
        const selFurnIdsXlsx = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
        // Fără fallback la toți furnizorii — exportul trebuie să reflecte exact selecția din BI
        const filtrateFP = _filtreazaFacturiPlatit(sD2, eD2, selFurnIdsXlsx, '');
        const headersFP = ["Furnizor", "Nr. Factură", "Valoare", "Status", "Data Emitere", "Scadență", "Data Plată"];
        const rowsFP = filtrateFP.map(f => {
            const furn = ZFlowStore.dateFurnizori.find(fr => String(fr.id) === String(f.furnizor_id));
            return [
                furn?.nume_firma || '',
                f.numar_factura || '',
                f.valoare || 0,
                f.status_plata || 'Neplatit',
                formateazaDataZFlow(f.data_emiterii),
                f.data_scadenta ? formateazaDataZFlow(f.data_scadenta) : '',
                f.data_plata ? formateazaDataZFlow(f.data_plata) : ''
            ];
        });
        const wsFP = XLSX.utils.aoa_to_sheet([headersFP, ...rowsFP]);
        XLSX.utils.book_append_sheet(wb, wsFP, "Furnizori - De Platit");
    }

    // Foaie 3: Contribuții Buget Stat
    if (ZFlowStore.dateContributii?.length > 0) {
        const contributiiData = ZFlowStore.dateContributii.map(c => [
            c.tip || 'N/A',
            c.suma || 0,
            c.luna || '',
            c.achitat ? 'Da' : 'Nu',
            c.observatii || ''
        ]);
        const headersContributii = ['Tip', 'Suma (RON)', 'Luna', 'Achitat', 'Observații'];
        const wsContributii = XLSX.utils.aoa_to_sheet([headersContributii, ...contributiiData]);
        XLSX.utils.book_append_sheet(wb, wsContributii, 'Contributii');
    }
    
    // Foaie 4: Cashflow summary (la Toate)
    if (ZFlowStore.filtruStatusBI === 'toate') {
        const totalIncasat = (ZFlowStore.dateFacturiBI || []).filter(f => f.status_plata === 'Incasat').reduce((s, f) => s + (Number(f.valoare) || 0), 0);
        const totalNeincasat = (ZFlowStore.dateFacturiBI || []).filter(f => f.status_plata !== 'Incasat').reduce((s, f) => s + (Number(f.valoare) || 0), 0);
        const totalPlatit = (ZFlowStore.dateFacturiPlatit || []).filter(f => f.status_plata === 'Platit').reduce((s, f) => s + (Number(f.valoare) || 0), 0);
        const totalNeplatit = (ZFlowStore.dateFacturiPlatit || []).filter(f => f.status_plata !== 'Platit').reduce((s, f) => s + (Number(f.valoare) || 0), 0);
        const headersCF = ["Indicator", "Valoare (RON)"];
        const rowsCF = [
            ["Total Facturat Clienți", totalIncasat + totalNeincasat],
            ["  - Incasat", totalIncasat],
            ["  - Neincasat", totalNeincasat],
            ["", ""],
            ["Total Facturi Furnizori", totalPlatit + totalNeplatit],
            ["  - Platit", totalPlatit],
            ["  - Neplatit", totalNeplatit],
            ["", ""],
            ["Cashflow Net (Incasat - Neplatit)", totalNeincasat - totalNeplatit]
        ];
        const wsCF = XLSX.utils.aoa_to_sheet([headersCF, ...rowsCF]);
        XLSX.utils.book_append_sheet(wb, wsCF, "Cashflow");
    }

    // ── Foaie Sumar — datele vizibile în bi-totale-bar + contributii ────
    const _biClienti   = document.getElementById("suma-selectata-bi")?.innerText?.trim() || "0 lei";
    const _biFurnizori = document.getElementById("suma-platit-bi")?.innerText?.trim()    || "0 lei";
    const _biNet       = (document.getElementById("cf-net")?.innerText?.trim()            || "0 lei").replace(/\u2212/g, "-");
    const _biContributii = document.getElementById("cf-contributii")?.innerText?.trim() || "0 lei";
    const _perioadaS   = document.getElementById("label-start")?.innerText?.trim() || s || "—";
    const _perioadaE   = document.getElementById("label-end")?.innerText?.trim()   || e || "—";
    const _filtru      = { 'toate': 'Toate', 'Neincasat': 'Neîncasate', 'Platit': 'Neplătite' }[ZFlowStore.filtruStatusBI] || 'Toate';

    const wsSumar = XLSX.utils.aoa_to_sheet([
        ["Z-FLOW — RAPORT ANALIZA FINANCIARA"],
        [],
        ["Perioada",              `${_perioadaS} — ${_perioadaE}`],
        ["Generat la",            new Date().toLocaleDateString("ro-RO")],
        ["Filtru aplicat",        _filtru],
        [],
        ["INDICATOR",               "VALOARE"],
        ["Total Clienți (facturat)", _biClienti],
        ["Total Furnizori (plăți)",  _biFurnizori],
        ["Contribuții Buget Stat",   _biContributii],
        ["Diferență Net",            _biNet],
    ]);
    wsSumar["!cols"] = [{ wch: 30 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsSumar, "Sumar BI");

    // ── Foaie Grafic Evolutie Lunara — date agregate pe luni ────────────
    try {
        const luniGraficMap = {};
        facturiFiltrate.forEach(f => {
            const d = (f.data_emiterii || '').substring(0, 7);
            if (!d || d.length !== 7) return;
            if (!luniGraficMap[d]) luniGraficMap[d] = { incasari: 0, plati: 0 };
            luniGraficMap[d].incasari += Number(f.valoare) || 0;
        });
        const furnIdsGrafic = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
        const filtrateFPGrafic = _filtreazaFacturiPlatit(xlsxStartDate, xlsxEndDate, furnIdsGrafic, '');
        filtrateFPGrafic.forEach(f => {
            const d = (f.data_emiterii || '').substring(0, 7);
            if (!d || d.length !== 7) return;
            if (!luniGraficMap[d]) luniGraficMap[d] = { incasari: 0, plati: 0 };
            luniGraficMap[d].plati += Number(f.valoare) || 0;
        });
        const luniSortate = Object.keys(luniGraficMap).sort();
        if (luniSortate.length > 0) {
            const headersGrafic = ['Luna', 'Incasari (RON)', 'Plati Furnizori (RON)', 'Diferenta (RON)'];
            const rowsGrafic = luniSortate.map(l => {
                const { incasari, plati } = luniGraficMap[l];
                return [l, Math.round(incasari), Math.round(plati), Math.round(incasari - plati)];
            });
            const wsGrafic = XLSX.utils.aoa_to_sheet([headersGrafic, ...rowsGrafic]);
            wsGrafic['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(wb, wsGrafic, 'Grafic Evolutie');
        }
    } catch (_graficErr) {
        ZFlowLogger.warn('app', 'Foaie grafic ignorată:', _graficErr.message);
    }

    XLSX.writeFile(wb, `zflow_analiza_${new Date().toISOString().slice(0, 10)}.xlsx`);
    saveZFlowData();
}

// → crud.js (Email & Print, extrase în Runda 9)
// ==========================================
// CĂUTARE CUI ANAF
// ==========================================

async function autoCautareCUI() {
    const cuiRaw = document.getElementById("in-cui").value;
    const cui = cuiRaw.replace(/\D/g, "");

    if (!cui || cui.length < 2) return showNotification("Introdu un CUI valid (doar cifrele)!", "warning");

    const anafUrl = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva";
    const dataAzi = new Date().toISOString().split("T")[0];
    const body = JSON.stringify([{ cui: parseInt(cui), data: dataAzi }]);
    const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

    // Aplică datele găsite în câmpurile din modal
    const aplicaDate = (d) => {
        document.getElementById("in-nume").value   = d.date_generale?.denumire || "";
        document.getElementById("in-adresa").value = d.adresa_domiciliu_fiscal?.adresa || "";
        document.getElementById("in-oras").value   = d.adresa_domiciliu_fiscal?.localitate || "";
        ZFlowLogger.debug('app', "Date ANAF:", d);
    };

    setLoader(true);
    try {

    // 1. Supabase Edge Function (cel mai fiabil — deploy din _detalii/_docs/supabase_edge_anaf_proxy.ts)
    const edgeFnUrl = `${URL_Z}/functions/v1/anaf-proxy`;
    try {
        const r = await fetch(edgeFnUrl, {
            method: "POST",
            headers: { ...jsonHeaders, "Authorization": `Bearer ${KEY_Z}` },
            body,
            signal: AbortSignal.timeout(8000)
        });
        if (r.ok) {
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); return; }
        }
    } catch (_) { /* Edge function nedeploy-ată, trecem la proxy public */ }

    // 3. Proxy-uri fallback
    const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(anafUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(anafUrl)}`,
        `https://cors.sh/${anafUrl}`,
    ];

    for (const proxyUrl of proxies) {
        try {
            const r = await fetch(proxyUrl, {
                method: "POST", headers: jsonHeaders, body,
                signal: AbortSignal.timeout(8000)
            });
            if (!r.ok) continue;
            const res = await r.json();
            if (res.found?.[0]?.date_generale) {
                aplicaDate(res.found[0]); return;
            } else {
                showNotification(`CUI-ul ${cui} nu a fost găsit în baza ANAF.`, "warning");
                return;
            }
        } catch (e) {
            ZFlowLogger.warn('app', "Proxy eșuat:", proxyUrl, e.message);
        }
    }

    // 3. Toate au eșuat — îi propunem alternativa Edge Function
    showNotification("Serviciul ANAF nu răspunde. Dacă eroarea persistă, contactează administratorul.", "error", 6000);
    } finally {
        setLoader(false);
    }
}

/**
 * Caută CUI furnizor la ANAF și completează modalul furnizor
 */
async function autoCautareCUIFurnizor() {
    const cuiRaw = document.getElementById("in-furn-cui")?.value || "";
    const cui = cuiRaw.replace(/\D/g, "");

    if (!cui || cui.length < 2) return showNotification("Introdu un CUI valid (doar cifrele)!", "warning");

    const anafUrl = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva";
    const dataAzi = new Date().toISOString().split("T")[0];
    const body = JSON.stringify([{ cui: parseInt(cui), data: dataAzi }]);
    const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

    const aplicaDate = (d) => {
        const numeEl = document.getElementById("in-furn-nume");
        const adresaEl = document.getElementById("in-furn-adresa");
        const orasEl = document.getElementById("in-furn-oras");
        if (numeEl) numeEl.value = d.date_generale?.denumire || "";
        if (adresaEl) adresaEl.value = d.adresa_domiciliu_fiscal?.adresa || "";
        if (orasEl) orasEl.value = d.adresa_domiciliu_fiscal?.localitate || "";
    };

    setLoader(true);
    try {

    const edgeFnUrl = `${URL_Z}/functions/v1/anaf-proxy`;
    try {
        const r = await fetch(edgeFnUrl, { method: "POST", headers: { ...jsonHeaders, "Authorization": `Bearer ${KEY_Z}` }, body, signal: AbortSignal.timeout(8000) });
        if (r.ok) {
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); return; }
        }
    } catch (_) {}

    const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(anafUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(anafUrl)}`,
    ];
    for (const proxyUrl of proxies) {
        try {
            const r = await fetch(proxyUrl, { method: "POST", headers: jsonHeaders, body, signal: AbortSignal.timeout(8000) });
            if (!r.ok) continue;
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); return; }
            else { showNotification(`CUI-ul ${cui} nu a fost găsit în baza ANAF.`, "warning"); return; }
        } catch (e) { ZFlowLogger.warn('app', "Proxy eșuat:", proxyUrl, e.message); }
    }

    showNotification("Serviciul ANAF nu răspunde.", "error", 6000);
    } finally {
        setLoader(false);
    }
}

// ==========================================
// TRANSPORTURI & MAP
// ==========================================

function renderTransportTab() {
    const container = document.getElementById("lista-transporturi");
    const trans = [];
    ZFlowStore.dateLocal.forEach((c) =>
        c.facturi.forEach((f) => {
            if (f.numar_auto) trans.push({ ...f, firma: c.nume_firma });
        })
    );
    container.innerHTML = trans
        .map((t) =>
            `<div class="card-flow flex justify-between items-center animate-pop">
                <div>
                    <p class="text-[11px] font-extrabold text-slate-800 uppercase">${t.firma}</p>
                    <p class="text-[9px] font-bold text-blue-600 mt-1 uppercase">Camion: ${t.numar_auto}</p>
                    ${t.uit_code ? `<p class="text-[9px] font-bold text-green-600 mt-0.5 uppercase">UIT: ${t.uit_code}</p>` : ''}
                </div>
                ${t.uit_code
                    ? `<span class="text-[8px] font-extrabold uppercase px-3 py-1 rounded-full bg-green-100 text-green-700">${t.uit_code}</span>`
                    : `<span class="text-[8px] font-extrabold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-700">WAIT UIT</span>`}
            </div>`
        )
        .join("");
}

let _initMapRetries = 0;
function initMap() {
    // [R6-FIX 1] Guard: Leaflet se încarcă cu defer — poate să nu fie gata imediat
    if (typeof L === 'undefined') {
        _initMapRetries++;
        if (_initMapRetries > 20) {
            ZFlowLogger.error('Map', 'Leaflet nu s-a încărcat după 20 reîncercări — verifică CDN');
            _initMapRetries = 0;
            return;
        }
        ZFlowLogger.warn('Map', 'Leaflet nu e încărcat încă — retry ' + _initMapRetries + '/20');
        setTimeout(initMap, 500);
        return;
    }
    _initMapRetries = 0;
    if (!ZFlowStore.map) {
        ZFlowStore.map = L.map("map", { zoomControl: false }).setView([47.18, 23.05], 13);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(ZFlowStore.map);
        L.control.zoom({ position: 'bottomright' }).addTo(ZFlowStore.map);
    }
    setTimeout(() => {
        ZFlowStore.map.invalidateSize();
        actualizaMarkerePeHarta();
    }, 400);
}

/**
 * Plasează markere GPS pentru vehicule pe hartă (Leaflet + OpenStreetMap).
 * Pozițiile sunt reale dacă vehiculul are gps_lat/gps_lng salvat,
 * altfel se folosesc poziții simulate în zona Zalău pentru testare.
 */
function actualizaMarkerePeHarta() {
    if (!ZFlowStore.map) { ZFlowLogger.warn('Map', 'map null în actualizaMarkerePeHarta'); return; }
    // [R6-FIX 1] Guard Leaflet
    if (typeof L === 'undefined') { ZFlowLogger.warn('Map', 'Leaflet nedisponibil în actualizaMarkerePeHarta'); return; }

    const vehicule = ZFlowStore.dateVehicule || [];
    ZFlowLogger.debug('Map', 'Plasez markere pentru ' + vehicule.length + ' vehicule');
    // Șterge markere vechi
    if (ZFlowStore._gpsMarcatori) {
        ZFlowStore._gpsMarcatori.forEach(m => { try { m.remove(); } catch(e) {} });
    }
    ZFlowStore._gpsMarcatori = [];

    const comenzi  = (ZFlowStore.dateComenziTransport || []).filter(c => c.status === 'In curs');

    // Zone simulate în județul Sălaj (Zalău + împrejurimi) pentru demo GPS
    const pozsDemo = [
        [47.1985, 23.0592], [47.2012, 23.0671], [47.1845, 23.0445],
        [47.2156, 23.0510], [47.1923, 23.0789], [47.2078, 23.0355],
    ];

    const bounds = [];

    vehicule.forEach((v, idx) => {
        const isLive = Boolean(v.gps_lat && v.gps_lng);
        const lat = isLive ? Number(v.gps_lat) : (pozsDemo[idx % pozsDemo.length][0] + (Math.random() - 0.5) * 0.004);
        const lng = isLive ? Number(v.gps_lng) : (pozsDemo[idx % pozsDemo.length][1] + (Math.random() - 0.5) * 0.004);

        const couleur = isLive ? '#16a34a' : '#1e3a8a'; // verde = live, albastru = simulat
        const icon = L.divIcon({
            html: `<div style="background:${couleur};color:#fff;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white">${v.nr_inmatriculare || '?'}</div>`,
            className: '',
            iconAnchor: [40, 16]
        });
        const comanda = comenzi.find(c => String(c.vehicul_id) === String(v.id));
        const popupContent = `
            <div style="min-width:160px">
                <p style="font-weight:900;font-size:13px;margin-bottom:4px">${v.nr_inmatriculare || '?'}</p>
                <p style="font-size:11px;color:#64748b">${v.marca || ''} ${v.model || ''} &middot; ${v.tip || 'Auto'}</p>
                ${comanda ? `<p style="font-size:11px;margin-top:6px"><b>Ruta:</b> ${comanda.ruta_de} → ${comanda.ruta_la}</p>` : ''}
                <p style="font-size:10px;margin-top:4px;color:${isLive ? '#16a34a' : '#94a3b8'}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isLive ? '#16a34a' : '#3b82f6'};margin-right:4px"></span>${isLive ? 'GPS Live' : 'Poziție simulată (test)'}</p>
            </div>`;
        const marker = L.marker([lat, lng], { icon })
            .addTo(ZFlowStore.map)
            .bindPopup(popupContent);
        ZFlowStore._gpsMarcatori.push(marker);
        bounds.push([lat, lng]);
    });

    if (bounds.length === 0) {
        ZFlowStore.map.setView([47.198, 23.059], 13);
    } else if (bounds.length === 1) {
        ZFlowStore.map.setView(bounds[0], 14);
    } else {
        ZFlowStore.map.flyToBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    }
}

function initScanner() {
    if (!ZFlowStore.scanner) {
        ZFlowStore.scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
        ZFlowStore.scanner.render((t) => {
            // Afișare cod scanat (comportament original)
            const barcodeEl = document.getElementById("barcode-value");
            if (barcodeEl) barcodeEl.innerText = t;
            // Procesare smart: produs / recepție / livrare / comandă (features.js)
            if (typeof processScanResult === 'function') processScanResult(t);
        });
    }
}

// ==========================================
// MOBILE KEYBOARD FIX
// ==========================================

function setupMobileKeyboardFix() {
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', () => {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                setTimeout(() => activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
        });
    }

    document.querySelectorAll('.sheet-content input, .sheet-content textarea').forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        });
    });
}

/**
 * Setup Enter key pentru autentificare
 */
function setupAuthEnterKey() {
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verificaAuth();
        }
    };
    
    if (authUsername) authUsername.addEventListener('keypress', handleEnter);
    if (authPassword) authPassword.addEventListener('keypress', handleEnter);
}

// ==========================================
// INIȚIALIZARE LA ÎNCĂRCARE
// ==========================================

window.onload = async () => {
    try {
        loadTheme();
    } catch (e) {
        ZFlowLogger.warn('app', "Theme load failed");
    }

    // Verifică modul de mentenanță înainte de orice altceva
    // (admin vede întotdeauna aplicația; ceilalți văd overlay-ul dacă e activ)
    try {
        // Încearcă să citească flag-ul din Supabase (tabel app_config)
        // Dacă tabelul nu există, fallback la localStorage
        const remoteState = await ZFlowDB.getSetAppConfig('maintenance_mode').catch(() => null);
        if (remoteState !== null) {
            localStorage.setItem(MAINTENANCE_LS_KEY, JSON.stringify(remoteState));
        }
    } catch(e) { /* silently ignore — tabel app_config poate să nu existe */ }
    checkAndApplyMaintenanceMode();

    // Ascunde conținutul principal până la autentificare
    const mainContent = document.querySelector('main');
    const header = document.querySelector('header');
    const bottomNav = document.querySelector('.bottom-nav');
    const fabMenu = document.getElementById('fab-menu');
    
    // Verifică sesiunea Supabase (async)
    const isAuthenticated = await checkSession();
    
    if (!isAuthenticated) {
        // Blochează accesul la interfață
        if (mainContent) mainContent.style.display = 'none';
        if (header) header.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabMenu) fabMenu.style.display = 'none';
        
        document.getElementById("modal-auth").classList.add("active");
    } else {
        // Afișează interfața și inițializează
        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';
        
        if (typeof init === 'function') {
            init();
        }
    }

    setupMobileKeyboardFix();
    setupAuthEnterKey();
    
    // Ascultă schimbările de autentificare Supabase
    ZFlowDB.onAuthStateChange((event, session) => {
        ZFlowLogger.debug('app', 'Auth state changed:', event);
        // Ignoră evenimentele Supabase când utilizatorul local (admin/demo) este activ
        const _isLocalSession = ZFlowStore.userSession?.user?.email === 'admin' || ZFlowStore.userSession?.isDemo === true;
        if (event === 'SIGNED_OUT') {
            if (!_isLocalSession) logout();
        }
        if (event === 'TOKEN_REFRESHED') {
            // [R5-FIX 5] Token reînnoit — actualizează sesiunea în store
            // Guard: nu suprascrie sesiunea admin/demo cu o sesiune Supabase reziduală
            if (session && ZFlowStore.userSession && !_isLocalSession) {
                ZFlowStore.userSession = session;
                ZFlowLogger.debug('app', '[Auth] Token reînnoit, sesiune actualizată');
            }
        }
    });
};

// Export global pentru toate funcțiile
window.init = init;
window.verificaAuth = verificaAuth;
window.logout = logout;
window.confirmaLogout = confirmaLogout;
window.deschideModalInregistrare = deschideModalInregistrare;
window.deschideModalResetParola = deschideModalResetParola;
window.inregistrareUtilizator = inregistrareUtilizator;
window.trimiteResetParola = trimiteResetParola;
window.schimbaDateCont = schimbaDateCont;

function deschideModalSchimbaParola() {
    const isAdmin = ZFlowStore.userSession?.user?.email === 'admin';
    const emailWrap = document.getElementById('cont-email-wrap');
    const adminNote = document.getElementById('cont-admin-note');
    if (emailWrap) emailWrap.classList.toggle('hidden', isAdmin);
    if (adminNote) adminNote.classList.toggle('hidden', !isAdmin);
    document.getElementById('modal-profil-firma').classList.remove('active');
    setTimeout(() => document.getElementById('modal-schimba-cont').classList.add('active'), 150);
}
window.deschideModalSchimbaParola = deschideModalSchimbaParola;

function salveazaPrefDataAzi(checked) {
    localStorage.setItem('zflow_pref_data_azi', checked ? '1' : '0');
    showNotification(checked ? 'Dată implicită: Azi activat' : 'Dată implicită: câmp gol', 'info', 2000);
}
window.salveazaPrefDataAzi = salveazaPrefDataAzi;

function getDataImplicita() {
    return localStorage.getItem('zflow_pref_data_azi') !== '0'
        ? new Date().toISOString().split('T')[0]
        : '';
}
window.getDataImplicita = getDataImplicita;

window.inchideModalRegister = inchideModalRegister;
window.inchideModalResetPassword = inchideModalResetPassword;
// Onboarding & Profil Firmă
window.verificaOnboarding = verificaOnboarding;
window.salveazaProfilOnboarding = salveazaProfilOnboarding;
window.salteOnboarding = salteOnboarding;
window.deschideProfilFirma = deschideProfilFirma;
window.inchideProfilFirma = inchideProfilFirma;
window.salveazaProfilFirma = salveazaProfilFirma;

// ==========================================
// ȘTERGERE DATE ADMIN (Task 3)
// ==========================================
function stergeToateDateleAdmin() {
    const isAdmin = window.ZFlowStore?.userSession?.user?.email === 'admin';
    if (!isAdmin) { showNotification('Disponibil doar pentru contul admin', 'error'); return; }
    if (!confirm('ATENȚIE: Ștergi TOATE datele salvate de contul admin (clienți, facturi, produse, comenzi etc.). Această acțiune este ireversibilă! Continui?')) return;

    // Șterge din localStorage (prefixul zflow_ad_)
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('zflow_ad_'));
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Resetează store-ul în memorie
    const storeKeys = ['_demoClienti','_demoFacturi','_demoFurnizori','_demoFacturiPlatit',
        '_demoProduse','_demoMiscariStoc','_demoReceptii','_demoLivrari',
        '_demoSoferi','_demoVehicule','_demoComenziTransport',
        'dateLocal','dateFacturiBI','dateFurnizori','dateFacturiPlatit',
        'dateProduse','dateMiscariStoc','dateReceptii','dateLivrari',
        'dateSoferi','dateVehicule','dateComenziTransport'];
    storeKeys.forEach(k => { delete ZFlowStore[k]; });
    ['dateLocal','dateFacturiBI','dateFurnizori','dateFacturiPlatit',
     'dateProduse','dateMiscariStoc','dateReceptii','dateLivrari',
     'dateSoferi','dateVehicule','dateComenziTransport'].forEach(k => { ZFlowStore[k] = []; });

    inchideProfilFirma();
    showNotification('Toate datele admin au fost șterse', 'success');
    // Reîncarcă UI-ul
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderDepozit === 'function') renderDepozit();
    if (typeof renderLogistic === 'function') renderLogistic();
}
window.stergeToateDateleAdmin = stergeToateDateleAdmin;

// ==========================================
// RESET DATE USER (disponibil oricui)
// ==========================================

/**
 * Șterge toate datele utilizatorului curent (local + Supabase dacă e conectat).
 * Fără dependența de rol admin.
 */
async function resetCompletDateUser() {
    showConfirmModal(
        'ATENȚIE: Se vor șterge TOATE datele (clienți, facturi, furnizori, produse, comenzi).\n\nAceastă acțiune este ireversibilă. Continui?',
        async () => {
            setLoader(true);
            try {
                // 1) Curăță localStorage (prefixe cunoscute)
                const prefixe = ['zflow_ad_', 'zflow_demo_', 'zflow_local_'];
                Object.keys(localStorage)
                    .filter(k => prefixe.some(p => k.startsWith(p)))
                    .forEach(k => localStorage.removeItem(k));

                // 2) Curăță IndexedDB
                if (typeof ZFlowIDB !== 'undefined') await ZFlowIDB.clearAll();

                // 3) Curăță Supabase DOAR pentru utilizatori Supabase reali (nu admin, nu demo)
                const isAdminLocal = ZFlowStore.userSession?.user?.email === 'admin';
                const isRealSupabase = ZFlowStore.userSession && !ZFlowStore.userSession.isDemo && !isAdminLocal;
                if (isRealSupabase) {
                    try {
                        const listeStergere = [
                            ZFlowStore.dateFacturiBI || [],
                            ZFlowStore.dateFacturiPlatit || []
                        ];
                        for (const lista of listeStergere) {
                            for (const item of lista) {
                                if (item.id) {
                                    try { await ZFlowDB.deleteFactura?.(item.id); } catch(_) {}
                                    try { await ZFlowDB.deleteFacturaPlatit?.(item.id); } catch(_) {}
                                }
                            }
                        }
                        for (const c of (ZFlowStore.dateLocal || [])) {
                            if (c.id) try { await ZFlowDB.deleteClient?.(c.id); } catch(_) {}
                        }
                        for (const f of (ZFlowStore.dateFurnizori || [])) {
                            if (f.id) try { await ZFlowDB.deleteFurnizor?.(f.id); } catch(_) {}
                        }
                    } catch (supErr) {
                        ZFlowLogger.warn('app', '[Reset] Eroare parțială Supabase:', supErr.message);
                    }
                }

                // 4) Resetează store în memorie
                const listeCheie = ['dateLocal','dateFacturiBI','dateFurnizori','dateFacturiPlatit',
                    'dateProduse','dateMiscariStoc','dateReceptii','dateLivrari',
                    'dateSoferi','dateVehicule','dateComenziTransport'];
                listeCheie.forEach(k => { ZFlowStore[k] = []; });

                // 5) Re-render UI
                if (typeof renderMain === 'function') renderMain();
                if (typeof renderFurnizori === 'function') renderFurnizori();
                if (typeof renderDepozit === 'function') renderDepozit();
                if (typeof renderLogistic === 'function') renderLogistic();
                if (typeof incarcaDashboard === 'function') incarcaDashboard();

                showNotification('Toate datele au fost șterse și resetate', 'success');
            } catch (err) {
                showNotification('Eroare la reset: ' + err.message, 'error');
            } finally {
                setLoader(false);
            }
        }
    );
}
window.resetCompletDateUser = resetCompletDateUser;

// ==========================================
// HELPER: firmă duplicată (client + furnizor)
// ==========================================

/**
 * Returnează true dacă CUI-ul apare atât în clienți cât și în furnizori
 * @param {string} cui
 * @returns {boolean}
 */
function esteSiClientSiFurnizor(cui) {
    if (!cui) return false;
    const cuiCurat = String(cui).replace(/\D/g, '').toLowerCase();
    const inClienti   = (ZFlowStore.dateLocal || []).some(c => String(c.cui||'').replace(/\D/g,'').toLowerCase() === cuiCurat);
    const inFurnizori = (ZFlowStore.dateFurnizori || []).some(f => String(f.cui||'').replace(/\D/g,'').toLowerCase() === cuiCurat);
    return inClienti && inFurnizori;
}
window.esteSiClientSiFurnizor = esteSiClientSiFurnizor;

/**
 * Exportă toate datele contului admin ca fișier JSON descărcabil.
 * Se rulează ÎNAINTE de crearea unui cont Supabase real.
 */
function exportareDateAdmin() {
    if (ZFlowStore.userSession?.user?.email !== 'admin') {
        showNotification('Disponibil doar pentru contul admin local', 'warning');
        return;
    }
    const backup = { _versiune: 'zflow-v8', _exportat_la: new Date().toISOString() };
    const keys = ['clienti','facturi','furnizori','facturi_platit','produse',
                  'miscari_stoc','receptii','livrari','soferi','vehicule','comenzi_transport'];
    keys.forEach(k => {
        try { const r = localStorage.getItem('zflow_ad_' + k); backup[k] = r ? JSON.parse(r) : []; }
        catch(e) { backup[k] = []; }
    });
    try { const p = localStorage.getItem('zflow_local_profile'); backup._profil = p ? JSON.parse(p) : null; } catch(e) {}

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Backup exportat! Loghează-te cu contul Supabase și importă fișierul.', 'success');
}
window.exportareDateAdmin = exportareDateAdmin;

/**
 * Export complet: XLSX multi-sheet + JSON — disponibil doar pentru admin local.
 * Folosește SheetJS (XLSX) deja încărcat în pagină.
 */
function exportareCompleta() {
    if (ZFlowStore.userSession?.user?.email !== 'admin') {
        showNotification('Exportul complet este disponibil doar pentru contul admin local', 'warning');
        return;
    }
    const dataAzi = new Date().toISOString().slice(0, 10);
    const mapLS = {
        'Clienti':            'zflow_ad_clienti',
        'Facturi':            'zflow_ad_facturi',
        'Furnizori':          'zflow_ad_furnizori',
        'Facturi Platite':    'zflow_ad_facturi_platit',
        'Produse':            'zflow_ad_produse',
        'Miscari Stoc':       'zflow_ad_miscari_stoc',
        'Receptii':           'zflow_ad_receptii',
        'Livrari':            'zflow_ad_livrari',
        'Soferi':             'zflow_ad_soferi',
        'Vehicule':           'zflow_ad_vehicule',
        'Comenzi Transport':  'zflow_ad_comenzi_transport',
    };
    // Construiește workbook XLSX cu câte o foaie per categorie
    try {
        const wb = XLSX.utils.book_new();
        let hasData = false;
        const backup = { _versiune: 'zflow-v8', _exportat_la: new Date().toISOString() };
        for (const [sheetName, lsKey] of Object.entries(mapLS)) {
            let rows = [];
            try { const raw = localStorage.getItem(lsKey); rows = raw ? JSON.parse(raw) : []; } catch(_) {}
            backup[lsKey.replace('zflow_ad_', '')] = rows;
            if (rows.length > 0) {
                hasData = true;
                const ws = XLSX.utils.json_to_sheet(rows);
                XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
            }
        }
        if (!hasData) { showNotification('Nu există date pentru export', 'warning'); return; }
        // Descarcă XLSX
        XLSX.writeFile(wb, `zflow_backup_${dataAzi}.xlsx`);
        // Descarcă JSON (cu întârziere mică pentru browser)
        setTimeout(() => {
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
            const u = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = u; a.download = `zflow_backup_${dataAzi}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(u);
        }, 500);
        showNotification('Export complet: fișiere XLSX + JSON descărcate!', 'success');
    } catch (err) {
        showNotification('Eroare export: ' + err.message, 'error');
    }
}
window.exportareCompleta = exportareCompleta;

/**
 * Resetare unificată — se comportă diferit în funcție de tipul de cont:
 *  - admin local: șterge datele din localStorage (zflow_ad_*)
 *  - Supabase user: șterge datele din Supabase + IDB
 */
function resetDateUnificat() {
    const email = ZFlowStore.userSession?.user?.email || '';
    const isAdmin = email === 'admin';
    if (isAdmin) {
        // Curăță date reziduale din sesiuni Supabase anterioare (evita afisarea datelor reale in admin)
        try {
            const keysToKeep = ['zflow_ad_admin_password', 'zflow_ad_admin_data'];
            Object.keys(localStorage)
                .filter(k => k.startsWith('zflow_') && !keysToKeep.some(keep => k.includes(keep)))
                .forEach(k => localStorage.removeItem(k));
        } catch(e) {}
        stergeToateDateleAdmin();
    } else {
        resetCompletDateUser();
    }
}
window.resetDateUnificat = resetDateUnificat;

/**
 * Importă un backup JSON în contul Supabase curent.
 * Se rulează DUPĂ autentificarea cu un cont Supabase real.
 */
async function importareDateDinBackup() {
    const email = ZFlowStore.userSession?.user?.email;
    const isLocal = email === 'admin' || ZFlowStore.userSession?.isDemo === true;
    if (isLocal) {
        showNotification('Importul funcționează doar pentru conturi Supabase reale. Mai întâi exportă ca JSON, creează un cont Supabase, loghează-te, apoi importă.', 'warning');
        return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            if (!backup._versiune?.startsWith('zflow')) throw new Error('Fișier backup Z-FLOW invalid');

            setLoader(true);
            let ok = 0, fail = 0;
            const proc = async (key, insertFn) => {
                const rows = backup[key] || [];
                for (const row of rows) {
                    try {
                        const { id: _id, created_at: _ca, user_id: _uid, ...rest } = row;
                        await insertFn(rest);
                        ok++;
                    } catch(err) {
                        fail++;
                        ZFlowLogger.warn('app', `[Import ${key}]:`, err.message);
                    }
                }
            };

            await proc('clienti',           (r) => ZFlowDB.insertClient(r));
            await proc('furnizori',          (r) => ZFlowDB.insertFurnizor(r));
            await proc('facturi',            (r) => ZFlowDB.insertFactura(r));
            await proc('facturi_platit',     (r) => ZFlowDB.insertFacturaPlatit(r));
            await proc('produse',            (r) => ZFlowDB.insertProdus(r));
            await proc('miscari_stoc',       (r) => ZFlowDB.insertMiscare(r));
            await proc('receptii',           (r) => ZFlowDB.insertReceptie(r));
            await proc('livrari',            (r) => ZFlowDB.insertLivrare(r));
            await proc('soferi',             (r) => ZFlowDB.insertSofer(r));
            await proc('vehicule',           (r) => ZFlowDB.insertVehicul(r));
            await proc('comenzi_transport',  (r) => ZFlowDB.insertComandaTransport(r));

            if (backup._profil) {
                try { await ZFlowDB.upsertProfile(backup._profil); } catch(_) {}
            }

            const msg = `Import finalizat: ${ok} înregistrări${fail ? `, ${fail} erori (vezi consolă)` : ''}.`;
            showNotification(msg, fail ? 'warning' : 'success');
            inchideProfilFirma();
            await init();
        } catch (err) {
            showNotification('Eroare import: ' + err.message, 'error');
        } finally {
            setLoader(false);
        }
    };
    input.click();
}
window.importareDateDinBackup = importareDateDinBackup;

// ==========================================
// ACTIVARE NOTIFICĂRI PUSH (Task 7)
// ==========================================
async function activareNotificariPush() {
    if (!('Notification' in window)) {
        showNotification('Browser-ul nu suportă notificări push', 'error');
        return;
    }
    if (Notification.permission === 'granted') {
        showNotification('Notificările push sunt deja active!', 'success');
        // Execută imediat o verificare
        verificaScadenteNotificari();
        return;
    }
    if (Notification.permission === 'denied') {
        showNotification('Notificările sunt blocate. Activează-le din setările browser-ului (pictograma lacăt lângă URL).', 'error');
        return;
    }
    const permisiune = await Notification.requestPermission();
    if (permisiune === 'granted') {
        showNotification('Notificări activate! Vei fi alertat la scadențe.', 'success');
        sessionStorage.removeItem('zflow_notif_shown'); // permite re-fire imediat
        verificaScadenteNotificari();
    } else {
        showNotification('Notificările nu au fost activate.', 'error');
    }
}
window.activareNotificariPush = activareNotificariPush;
window.schimbaTab = schimbaTab;
window.comutaVedereFin = comutaVedereFin;
window.toggleFAB = toggleFAB;
window.filtreazaFacturiInDetalii = filtreazaFacturiInDetalii;

/**
 * Filtrează facturile furnizorului după număr și serie — analog cu filtreazaFacturiInDetalii
 */
function filtreazaFacturiFurnizorInDetalii() {
    const input = document.getElementById('search-facturi-furnizor-detaliu');
    if (!input) return;

    const termen = input.value.toLowerCase().trim();
    const carduri = document.querySelectorAll('#lista-facturi-platit-detaliu .card-flow[data-nr]');
    const container = document.getElementById('lista-facturi-platit-detaliu');

    let visibleCount = 0;

    carduri.forEach(card => {
        const nr    = (card.getAttribute('data-nr')    || '').toLowerCase();
        const serie = (card.getAttribute('data-serie') || '').toLowerCase();

        if (!termen || nr.includes(termen) || serie.includes(termen)) {
            card.style.removeProperty('display');
            visibleCount++;
        } else {
            card.style.setProperty('display', 'none', 'important');
        }
    });

    // Empty state
    let emptyDiv = container?.querySelector('.empty-search-state-furn');
    if (termen && visibleCount === 0) {
        if (!emptyDiv && container) {
            emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-search-state-furn';
            emptyDiv.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 px-8">
                    <svg class="w-14 h-14 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <p class="font-bold text-slate-400 text-sm uppercase tracking-wider mb-1">Nicio factură găsită</p>
                    <p class="text-xs text-slate-400 text-center">Căutare: "<span class="font-semibold">${termen}</span>"</p>
                </div>`;
            container.appendChild(emptyDiv);
        }
    } else if (emptyDiv) {
        emptyDiv.remove();
    }
}
window.filtreazaFacturiFurnizorInDetalii = filtreazaFacturiFurnizorInDetalii;
window.populeazaBridgeUI = populeazaBridgeUI;
window.toggleFirmeBI = toggleFirmeBI;
window.genereazaBI = genereazaBI;
// ==========================================
// SWIPE ACTIONS - MOBILE GESTURES (#34 TODO)
// ==========================================

/**
 * Inițializează swipe actions pe cardurile de facturi
 * Swipe stânga → ștergere
 * Swipe dreapta → toggle status plată
 */
const SwipeHandler = {
    touchStartX: 0,
    touchStartY: 0,
    touchEndX: 0,
    touchEndY: 0,
    currentCard: null,
    swipeThreshold: 80, // pixeli minimi pentru a considera un swipe
    isSwipeing: false,
    
    /**
     * Inițializează event listeners pentru o listă de carduri
     */
    init(containerSelector) {
        // Detectăm dacă e dispozitiv touch
        if (!('ontouchstart' in window)) return;
        
        const container = document.querySelector(containerSelector);
        if (!container) return;
        
        // Delegăm evenimente la container
        container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    },
    
    /**
     * Găsește cardul părinte din target
     */
    findCard(element) {
        return element.closest('.swipeable-card');
    },
    
    /**
     * La începutul touch-ului
     */
    handleTouchStart(e) {
        const card = this.findCard(e.target);
        if (!card) return;
        
        this.currentCard = card;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.isSwipeing = false;
        
        // Resetăm alte carduri deschise
        document.querySelectorAll('.swipeable-card.swiped-left, .swipeable-card.swiped-right').forEach(c => {
            if (c !== card) {
                c.classList.remove('swiped-left', 'swiped-right');
                const content = c.querySelector('.swipe-content');
                if (content) content.style.transform = '';
            }
        });
    },
    
    /**
     * În timpul mișcării touch
     */
    handleTouchMove(e) {
        if (!this.currentCard) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const diffX = touchX - this.touchStartX;
        const diffY = touchY - this.touchStartY;
        
        // Verificăm dacă e scroll vertical
        if (Math.abs(diffY) > Math.abs(diffX) && !this.isSwipeing) {
            return;
        }
        
        // E swipe orizontal
        if (Math.abs(diffX) > 10) {
            this.isSwipeing = true;
            e.preventDefault(); // Prevenim scroll-ul
        }
        
        if (!this.isSwipeing) return;
        
        // Limităm distanța de swipe
        const maxSwipe = 100;
        const clampedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
        
        const content = this.currentCard.querySelector('.swipe-content');
        if (content) {
            content.style.transform = `translateX(${clampedDiff}px)`;
            content.style.transition = 'none';
        }
        
        // Afișăm acțiunile
        const leftAction = this.currentCard.querySelector('.swipe-action-left');
        const rightAction = this.currentCard.querySelector('.swipe-action-right');
        
        if (leftAction) {
            leftAction.style.opacity = Math.min(1, Math.abs(diffX) / this.swipeThreshold);
        }
        if (rightAction) {
            rightAction.style.opacity = Math.min(1, Math.abs(diffX) / this.swipeThreshold);
        }
    },
    
    /**
     * La finalul touch-ului
     */
    handleTouchEnd(e) {
        if (!this.currentCard || !this.isSwipeing) {
            this.currentCard = null;
            return;
        }
        
        const diffX = e.changedTouches[0].clientX - this.touchStartX;
        const content = this.currentCard.querySelector('.swipe-content');
        
        if (content) {
            content.style.transition = 'transform 0.3s ease';
        }
        
        // Swipe stânga = ștergere
        if (diffX < -this.swipeThreshold) {
            this.currentCard.classList.add('swiped-left');
            if (content) content.style.transform = 'translateX(-100px)';
            
            // Vibrație (haptic feedback)
            if (navigator.vibrate) navigator.vibrate(50);
            
        // Swipe dreapta = încasare
        } else if (diffX > this.swipeThreshold) {
            this.currentCard.classList.add('swiped-right');
            if (content) content.style.transform = 'translateX(100px)';
            
            if (navigator.vibrate) navigator.vibrate(50);
            
        } else {
            // Reset la poziția inițială
            this.currentCard.classList.remove('swiped-left', 'swiped-right');
            if (content) content.style.transform = '';
        }
        
        this.currentCard = null;
        this.isSwipeing = false;
    },
    
    /**
     * Execută acțiunea de swipe și resetează cardul
     */
    executeAction(button) {
        const card = button.closest('.swipeable-card');
        if (!card) return;
        
        const content = card.querySelector('.swipe-content');
        if (content) {
            content.style.transition = 'transform 0.3s ease';
            content.style.transform = '';
        }
        card.classList.remove('swiped-left', 'swiped-right');
    }
};

/**
 * Resetează toate cardurile swipe la poziția inițială
 */
function resetAllSwipeCards() {
    document.querySelectorAll('.swipeable-card.swiped-left, .swipeable-card.swiped-right').forEach(card => {
        card.classList.remove('swiped-left', 'swiped-right');
        const content = card.querySelector('.swipe-content');
        if (content) {
            content.style.transition = 'transform 0.3s ease';
            content.style.transform = '';
        }
    });
}

/**
 * Acțiune swipe pentru încasare rapidă
 */
function swipeToggleIncasare(facturaId, statusCurent) {
    SwipeHandler.executeAction(event.target);
    toggleStatusPlata(facturaId, statusCurent);
}

/**
 * Acțiune swipe pentru ștergere rapidă
 */
function swipeStergeFactura(facturaId) {
    SwipeHandler.executeAction(event.target);
    stergeFactura(facturaId);
}

// Inițializăm SwipeHandler după DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // ── Z-FLOW Changelog ────────────────────────────────────────
    console.groupCollapsed('%c Z-FLOW v2.1 — Changelog', 'color:#3b82f6;font-weight:bold;font-size:13px');
    ZFlowLogger.debug('app', '%c[UI] Eliminat grupul butoane (Client/Furnizor nou, Doc nou, Import) din listele de clienți și furnizori', 'color:#64748b');
    ZFlowLogger.debug('app', '%c[UI] Buton "DOC NOU" în bara de navigare de jos, contextual: client → factură incasare | furnizor → factură plată', 'color:#64748b');
    ZFlowLogger.debug('app', '%c[FIX] Buton "Editare Profil" client — funcțional acum direct din HTML (onclick inline)', 'color:#16a34a');
    ZFlowLogger.debug('app', '%c[FIX] Home KPIs: toate cele 4 carduri → ultimele 30 zile (facturat, neîncasat, neplătit, net)', 'color:#16a34a');
    ZFlowLogger.debug('app', '%c[FIX] Furnizori: KPI Restante sincronizat cu totalul banneru-ului (updateFurnizoriKPI la fiecare render)', 'color:#16a34a');
    ZFlowLogger.debug('app', '%c[FIX] Analiza BI furnizori: eliminat butonul de check (neadecvat în modul analiză)', 'color:#16a34a');
    ZFlowLogger.debug('app', '%c[FIX] Analiza BI: paginare clienți sub lista clienți, paginare furnizori sub lista furnizori', 'color:#16a34a');
    ZFlowLogger.debug('app', '%c[UI]  Depozit sub-nav Stoc/Documente: rezolvat conflict Tailwind hidden+flex', 'color:#64748b');
    ZFlowLogger.debug('app', '%c[FEAT] Badge "Client + Furnizor" pe carduri dacă același CUI apare la ambii', 'color:#9333ea');
    ZFlowLogger.debug('app', '%c[FEAT] Detectare automată status plată la import CSV (platit/neplatit din câmpuri)', 'color:#9333ea');
    ZFlowLogger.debug('app', '%c[FEAT] Ștergere completă date utilizator cu confirmare (buton Reset în profil)', 'color:#9333ea');
    ZFlowLogger.debug('app', '%c[FEAT] Hartă GPS mutată în secțiunea Vehicule (Logistic)', 'color:#9333ea');
    console.groupEnd();
    // ────────────────────────────────────────────────────────────
    // Inițializăm pe listele de facturi
    SwipeHandler.init('#lista-facturi-content');
    SwipeHandler.init('#rezultat-analiza');

    // ── ZFlowMobile — funcționalități mobile suplimentare ────────
    // setupOfflineHandler + setupBackButton există deja mai sus în acest bloc
    // Adăugăm doar ce lipsește: keyboard fix iOS + orientare portrait
    if (typeof ZFlowMobile !== 'undefined') {
        ZFlowMobile.setupKeyboardFix();        // iOS: scroll la input la focus
        ZFlowMobile.lockOrientationPortrait(); // Blochează rotire (dacă API disponibil)
        ZFlowLogger.debug('mobile', '📱 ZFlowMobile keyboard+orientation initialized');
    }

    // ── Offline / Online Banner ─────────────────────────────────
    const offlineBanner = document.getElementById('offline-banner');
    const setOfflineUI = (isOffline) => {
        if (!offlineBanner) return;
        if (isOffline) {
            offlineBanner.classList.remove('hidden');
            // Decalez header-ul și main-ul cu înălțimea banner-ului
            document.querySelector('header')?.classList.add('mt-8');
            showNotification('Fără conexiune la internet. Datele pot fi neactualizate.', 'error', 5000);
        } else {
            offlineBanner.classList.add('hidden');
            document.querySelector('header')?.classList.remove('mt-8');
            showNotification('Conexiune restaurată!', 'success', 3000);
        }
    };

    // Stare inițială
    if (!navigator.onLine) setOfflineUI(true);

    window.addEventListener('offline', () => setOfflineUI(true));
    window.addEventListener('online', () => setOfflineUI(false));

    // ── PWA Back Button Handler ──────────────────────────────────────────
    // Intrare inițială în history fără hash (URL curat)
    history.replaceState({ zflowView: 'firme' }, '', location.pathname);

    // Variabilă pentru double-back-to-exit
    let _backPressedOnce = false;
    let _backPressTimer  = null;

    window.addEventListener('popstate', (e) => {
        // 1. Modal deschis → închide modal, rămâne în app
        const modalDeschis = document.querySelector('.modal-sheet.active');
        if (modalDeschis) {
            modalDeschis.classList.remove('active');
            history.pushState({ zflowView: ZFlowStore.currentTab || 'home' }, '', location.pathname);
            return;
        }

        // 2. FAB menu deschis → închide FAB
        const fabMenu = document.getElementById('fab-menu');
        if (fabMenu && fabMenu.classList.contains('active')) {
            fabMenu.classList.remove('active');
            history.pushState({ zflowView: ZFlowStore.currentTab || 'home' }, '', location.pathname);
            return;
        }

        // 3. Detalii client/furnizor deschise → înapoi la lista
        const viewDetalii = document.getElementById('view-detalii');
        const viewDetaliiFurn = document.getElementById('view-detalii-furnizor');
        if (viewDetalii && !viewDetalii.classList.contains('hidden')) {
            if (typeof comutaVedereFin === 'function') comutaVedereFin('firme', false);
            history.pushState({ zflowView: 'financiar' }, '', location.pathname);
            return;
        }
        if (viewDetaliiFurn && !viewDetaliiFurn.classList.contains('hidden')) {
            if (typeof comutaVedereFin === 'function') comutaVedereFin('furnizori', false);
            history.pushState({ zflowView: 'financiar' }, '', location.pathname);
            return;
        }

        // 4. Tab activ !== home → mergi la Home
        const tabActiv = ZFlowStore.currentTab || 'home';
        if (tabActiv !== 'home') {
            const homeBtn = document.getElementById('nav-btn-home');
            if (typeof schimbaTab === 'function') schimbaTab('home', homeBtn);
            history.pushState({ zflowView: 'home' }, '', location.pathname);
            return;
        }

        // 5. Deja pe Home → double-back-to-exit
        if (_backPressedOnce) {
            // Al doilea back: ieși din app
            clearTimeout(_backPressTimer);
            // PWA: încearcă window.close(), fallback history.go(-1)
            if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
                // PWA standalone — nu poți window.close(), forțează minimizare
                window.history.go(-(window.history.length));
            } else {
                window.close();
            }
            return;
        }

        // Primul back pe Home
        _backPressedOnce = true;
        showNotification('Apasă din nou Back pentru a ieși din aplicație', 'info', 2500);
        history.pushState({ zflowView: 'home' }, '', location.pathname);

        _backPressTimer = setTimeout(() => {
            _backPressedOnce = false;
        }, 2500);
    });
});

// Re-inițializăm după navigare
const originalArataDetalii = typeof arataDetalii === 'function' ? arataDetalii : null;

// ==========================================
// WINDOW EXPORTS
// ==========================================

window.biNextPage = biNextPage;
window.biPrevPage = biPrevPage;
window.biSetPageSize = biSetPageSize;
window.furnizoriBINextPage = furnizoriBINextPage;
window.furnizoriBIPrevPage = furnizoriBIPrevPage;
window.furnizoriBISetPageSize = furnizoriBISetPageSize;
window.clientiNextPage = clientiNextPage;
window.clientiPrevPage = clientiPrevPage;
window.clientiSetPageSize = clientiSetPageSize;
window.furnizoriNextPage = furnizoriNextPage;
window.furnizoriPrevPage = furnizoriPrevPage;
window.furnizoriSetPageSize = furnizoriSetPageSize;
// Paginare module Depozit & Logistic
window._paginareHTML       = _paginareHTML;
window.produseNextPage     = produseNextPage;   window.produsePrevPage    = produsePrevPage;   window.produseSetPageSize  = produseSetPageSize;
window.miscariNextPage     = miscariNextPage;   window.miscariPrevPage    = miscariPrevPage;   window.miscariSetPageSize  = miscariSetPageSize;
window.comenziNextPage     = comenziNextPage;   window.comenziPrevPage    = comenziPrevPage;   window.comenziSetPageSize  = comenziSetPageSize;
window.soferiNextPage      = soferiNextPage;    window.soferiPrevPage     = soferiPrevPage;    window.soferiSetPageSize   = soferiSetPageSize;
window.vehiculeNextPage    = vehiculeNextPage;  window.vehiculePrevPage   = vehiculePrevPage;  window.vehiculeSetPageSize = vehiculeSetPageSize;
window.facturiSetPerPage        = facturiSetPerPage;
window.furnizoriFacturiSetPerPage = furnizoriFacturiSetPerPage;
window.importaDateSagaAuto      = importaDateSagaAuto;
// deschideModalConfirm — alias pentru showConfirmModal (funcții care îl apelează direct)
window.toggleBulkMode = toggleBulkMode;
window.toggleBulkSelectFactura = toggleBulkSelectFactura;
window.bulkSelectAll = bulkSelectAll;
window.bulkMarkPaid = bulkMarkPaid;
window.bulkExportPDF = bulkExportPDF;
window.setFiltruStatusBI = setFiltruStatusBI;
window.setFiltruTipBI = setFiltruTipBI;
window.toggleFurnizoriBI = toggleFurnizoriBI;
window.toggleFirmeBI = toggleFirmeBI;
window.filtreazaFirmeInBI = filtreazaFirmeInBI;
window.toggleFirmeCollapse = toggleFirmeCollapse;
window.toggleToateBI = toggleToateBI;
window.selectSingleBIFirma = selectSingleBIFirma;
window.toggleContributiiInAnaliza = toggleContributiiInAnaliza;
window.deschideModal = deschideModal;
window.inchideModal = inchideModal;
window.arataDetalii = arataDetalii; // exportat din app.js (nu din financiar.js — previne ReferenceError)
window.deschideModalDirectFactura = deschideModalDirectFactura;
window.logicUIT = logicUIT;
window.swipeToggleIncasare = swipeToggleIncasare;
window.swipeStergeFactura = swipeStergeFactura;
window.resetAllSwipeCards = resetAllSwipeCards;
window.importaDateSaga = importaDateSaga;
window.exportaPDF = exportaPDF;
window.exportaExcel = exportaExcel;
window.verificaScadenteNotificari = verificaScadenteNotificari;
window.toggleBellNotificari = toggleBellNotificari;
window.removePendingPDF = removePendingPDF;
window.stergeAtasamentPDF = stergeAtasamentPDF;
window.autoCautareCUI = autoCautareCUI;
window.autoCautareCUIFurnizor = autoCautareCUIFurnizor;
window.deschideFirmaNou = deschideFirmaNou;
window.selectTipFirmaNou = selectTipFirmaNou;
window.autoCautareCUIFirmaNou = autoCautareCUIFirmaNou;
window.salveazaFirmaNou = salveazaFirmaNou;
window.deschideFacturaNou = deschideFacturaNou;
window.comutaTipFacturaNou = comutaTipFacturaNou;
window.salveazaFacturaNou = salveazaFacturaNou;
window.incarcaDashboard = incarcaDashboard;
window.renderTransportTab = renderTransportTab;
window.initMap = initMap;
window.actualizaMarkerePeHarta = actualizaMarkerePeHarta;
window.initScanner = initScanner;
window.setLoader = setLoader;
window.showNotification = showNotification;
window.formateazaDataZFlow = formateazaDataZFlow;
window.showCorrelationPrompt = showCorrelationPrompt;
window.executaCorelareMod = executaCorelareMod;

// ============================================
// Z-FLOW V2 - INTEGRARE CU MODULELE REFACTORIZATE
// ============================================
// Modulele sunt încărcate ca script-uri separate și pot fi utilizate
// în paralel cu funcțiile existente. Exemplu de utilizare:
//
// - ZFlowUtils.debounce(), ZFlowUtils.formateazaSuma()
// - ZFlowAuth.verificaAuth(), ZFlowAuth.logout()
// - ZFlowUI.showNotification(), ZFlowUI.setLoader()
// - ZFlowClients.getAll(), ZFlowClients.findById()
// - ZFlowInvoices.filterByStatus(), ZFlowInvoices.sortByDate()
// - ZFlowAnalytics.getKPIs(), ZFlowAnalytics.getCashflowData()
// - ZFlowExport.generatePDF(), ZFlowExport.saveExcel()
// - ZFlowImport.parseCSV(), ZFlowImport.mapSAGAData()
// - ZFlowNotifications.checkDueInvoices()
// - ZFlowMobile.initSwipeHandlers()
// - ZFlowBulk.selectAll(), ZFlowBulk.exportSelected()
// - ZFlowANAF.lookupCUI()
//
// Toate funcțiile originale rămân disponibile pentru compatibilitate!
// ============================================

// Rulează DUPĂ ce toate scripturile defer s-au executat (DOMContentLoaded garantează asta).
// app.js se încarcă înaintea analytics.js / export.js / anaf.js / attachments.js / bulk.js,
// deci verificarea modulelor trebuie amânată până când întreg DOM-ul + scripturile sunt gata.
document.addEventListener('DOMContentLoaded', function initializeV2Modules() {
    ZFlowLogger.debug('app', '🚀 Z-FLOW - Inițializare Module Refactorizate');
    
    // Verificăm dacă modulele sunt încărcate
    const modules = [
        'ZFlowUtils', 'ZFlowAuth', 'ZFlowUI', 'ZFlowClients',
        'ZFlowSuppliers', 'ZFlowInvoices', 'ZFlowAnalytics',
        'ZFlowExport', 'ZFlowImport', 'ZFlowNotifications',
        'ZFlowAttachments', 'ZFlowMobile', 'ZFlowBulk', 'ZFlowANAF'
    ];
    
    const loadedModules = modules.filter(m => typeof window[m] !== 'undefined');
    const missingModules = modules.filter(m => typeof window[m] === 'undefined');
    
    if (loadedModules.length > 0) {
        ZFlowLogger.debug('app', `✅ Module încărcate (${loadedModules.length}/${modules.length}):`, loadedModules.join(', '));
    }
    
    if (missingModules.length > 0) {
        ZFlowLogger.warn('app', `Module lipsă:`, missingModules.join(', '));
    }
    
    // Expunem referințe rapide pentru dezvoltatori
    window.ZF = {
        Utils: window.ZFlowUtils,
        Auth: window.ZFlowAuth,
        UI: window.ZFlowUI,
        Clients: window.ZFlowClients,
        Suppliers: window.ZFlowSuppliers,
        Invoices: window.ZFlowInvoices,
        Analytics: window.ZFlowAnalytics,
        Export: window.ZFlowExport,
        Import: window.ZFlowImport,
        Notifications: window.ZFlowNotifications,
        Attachments: window.ZFlowAttachments,
        Mobile: window.ZFlowMobile,
        Bulk: window.ZFlowBulk,
        ANAF: window.ZFlowANAF
    };
    
    ZFlowLogger.debug('app', '📦 Acces rapid disponibil prin: ZF.Utils, ZF.Auth, ZF.UI, etc.');
    ZFlowLogger.debug('app', '📖 Documentație: js/modules/index.js');
});

// ==========================================
// INDICATOR ONLINE / OFFLINE
// ==========================================
(function initOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) {
        // Banner-ul poate nu existe încă în DOM la încărcarea scriptului
        window.addEventListener('load', function() {
            const b = document.getElementById('offline-banner');
            if (!b) return;
            const toggle = () => b.classList.toggle('hidden', navigator.onLine);
            window.addEventListener('online',  toggle);
            window.addEventListener('offline', toggle);
            toggle();
        });
        return;
    }
    const toggle = () => banner.classList.toggle('hidden', navigator.onLine);
    window.addEventListener('online',  toggle);
    window.addEventListener('offline', toggle);
    toggle(); // stare inițială
})();

// ==========================================
// EXPORT CSV
// ==========================================

/**
 * Exportă datele curente ca fișier CSV descărcabil.
 * @param {'clienti'|'furnizori'|'facturi'|'facturi_platit'} tip - Ce date să exporte
 */
function exportaCSV(tip) {
    const BOM = '\uFEFF'; // UTF-8 BOM pentru Excel
    let csv = '';
    let numeFile = 'export';

    if (tip === 'clienti') {
        const rows = ZFlowStore.dateLocal || [];
        if (rows.length === 0) { showNotification('Nu există clienți de exportat', 'warning'); return; }
        const headers = ['CUI', 'Denumire', 'Oras', 'Adresa', 'Telefon', 'Email', 'IBAN', 'Sold (lei)'];
        const lines = rows.map(c => [
            c.cui || '',
            c.nume_firma || '',
            c.oras || '',
            c.adresa || '',
            c.telefon || '',
            c.contact_email || '',
            c.iban || '',
            Math.round(c.sold || 0)
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        csv = BOM + [headers.join(','), ...lines].join('\n');
        numeFile = `zflow_clienti_${new Date().toISOString().split('T')[0]}.csv`;

    } else if (tip === 'furnizori') {
        const rows = ZFlowStore.dateFurnizori || [];
        if (rows.length === 0) { showNotification('Nu există furnizori de exportat', 'warning'); return; }
        const headers = ['CUI', 'Denumire', 'Oras', 'Adresa', 'Telefon', 'Email', 'IBAN', 'Sold de platit (lei)'];
        const lines = rows.map(f => [
            f.cui || '',
            f.nume_firma || '',
            f.oras || '',
            f.adresa || '',
            f.telefon || '',
            f.contact_email || '',
            f.iban || '',
            Math.round(f.sold || 0)
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        csv = BOM + [headers.join(','), ...lines].join('\n');
        numeFile = `zflow_furnizori_${new Date().toISOString().split('T')[0]}.csv`;

    } else if (tip === 'facturi') {
        const rows = ZFlowStore.dateFacturiBI || [];
        if (rows.length === 0) { showNotification('Nu există facturi de exportat', 'warning'); return; }
        const headers = ['Nr Factura', 'Client', 'CUI Client', 'Valoare (lei)', 'Data Emitere', 'Data Scadenta', 'Status', 'Nr Auto', 'Note'];
        const lines = rows.map(f => {
            const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(f.client_id));
            return [
                f.numar_factura || '',
                client?.nume_firma || '',
                client?.cui || '',
                Number(f.valoare || 0),
                f.data_emiterii || '',
                f.data_scadenta || '',
                f.status_plata || '',
                f.numar_auto || '',
                f.note || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        // Secțiune secundară: facturi de încasat cu scadența în ultimele 30 zile
        const azi30 = new Date(); azi30.setHours(23, 59, 59, 999);
        const start30 = new Date(); start30.setDate(start30.getDate() - 29); start30.setHours(0, 0, 0, 0);
        const facturiIncasare30 = rows.filter(f => {
            if (f.status_plata === 'Incasat') return false;
            const d = _parseInvoiceDateSafe(f.data_scadenta || f.data_emiterii);
            return d && d >= start30 && d <= azi30;
        });
        const lines30 = facturiIncasare30.map(f => {
            const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(f.client_id));
            return [
                f.numar_factura || '',
                client?.nume_firma || '',
                client?.cui || '',
                Number(f.valoare || 0),
                f.data_emiterii || '',
                f.data_scadenta || '',
                f.status_plata || '',
                f.numar_auto || '',
                f.note || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        csv = BOM + [
            headers.join(','),
            ...lines,
            '',
            '"Facturi clienti de incasat in ultimele 30 zile"',
            headers.join(','),
            ...lines30
        ].join('\n');
        numeFile = `zflow_facturi_clienti_${new Date().toISOString().split('T')[0]}.csv`;

    } else if (tip === 'facturi_platit') {
        const rows = ZFlowStore.dateFacturiPlatit || [];
        if (rows.length === 0) { showNotification('Nu există facturi furnizori de exportat', 'warning'); return; }
        const headers = ['Nr Factura', 'Furnizor', 'CUI Furnizor', 'Valoare (lei)', 'Data Emitere', 'Data Scadenta', 'Status', 'Note'];
        const lines = rows.map(f => {
            const furnizor = ZFlowStore.dateFurnizori.find(fr => String(fr.id) === String(f.furnizor_id));
            return [
                f.numar_factura || '',
                furnizor?.nume_firma || '',
                furnizor?.cui || '',
                Number(f.valoare || 0),
                f.data_emiterii || '',
                f.data_scadenta || '',
                f.status_plata || '',
                f.note || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });
        csv = BOM + [headers.join(','), ...lines].join('\n');
        numeFile = `zflow_facturi_furnizori_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
        showNotification('Tip export necunoscut', 'warning');
        return;
    }

    // Creăm blob și descărcăm
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = numeFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const numRows = (tip === 'clienti' ? ZFlowStore.dateLocal : tip === 'furnizori' ? ZFlowStore.dateFurnizori : tip === 'facturi' ? ZFlowStore.dateFacturiBI : ZFlowStore.dateFacturiPlatit)?.length || 0;
    showNotification(`Export CSV: ${numRows} înregistrări → ${numeFile}`, 'success');
}

// ==========================================
// DARK MODE
// ==========================================

/**
 * Toggle dark mode — suprascrie versiunea din store.js cu actualizare iconă
 * Folosește aceeași cheie localStorage ca store.js: 'zflow-theme'
 */
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('zflow-theme', isDark ? 'dark' : 'light');
    // Actualizează iconița butonului (soare = light mode activ, lună = dark mode activ)
    const btnIcon = document.getElementById('dark-mode-icon');
    if (btnIcon) {
        btnIcon.setAttribute('d', isDark
            ? 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z'
            : 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z');
    }
    showNotification(isDark ? 'Mod întunecat activat' : 'Mod luminos activat', 'info');
}

// Actualizează iconița la încărcarea paginii (dacă dark mode era salvat)
document.addEventListener('DOMContentLoaded', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const btnIcon = document.getElementById('dark-mode-icon');
    if (isDark && btnIcon) {
        btnIcon.setAttribute('d', 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z');
    }
});

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================

/**
 * Scurtături de tastatură globale
 * Esc   → închide orice modal/sheet activ
 * Alt+N → factură nouă
 * Alt+K → caută clienți (focus search)
 * Alt+D → toggle dark mode
 * Alt+E → exportă CSV date curente (clienți)
 */
document.addEventListener('keydown', function(e) {
    // Ignoră dacă utilizatorul tastează într-un input/textarea/select
    const tag = document.activeElement?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Escape → închide primul modal/sheet activ
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-sheet.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            return;
        }
        const activeOverlay = document.querySelector('[id^="modal-"].active');
        if (activeOverlay) {
            activeOverlay.classList.remove('active');
            return;
        }
    }

    // Scurtăturile cu Alt nu necesită verificarea inInput și nu conflictează cu browser/OS
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'n': // Alt+N → Factură nouă
                e.preventDefault();
                if (typeof deschideFacturaNou === 'function') { deschideFacturaNou(); }
                break;
            case 'k': // Alt+K → Focus căutare clienți
                e.preventDefault();
                const searchFirme = document.getElementById('search-firme');
                if (searchFirme) { searchFirme.focus(); searchFirme.select(); }
                break;
            case 'd': // Alt+D → Toggle dark mode
                e.preventDefault();
                toggleDarkMode();
                break;
            case 'e': // Alt+E → Export CSV clienți
                if (!inInput) {
                    e.preventDefault();
                    exportaCSV('clienti');
                }
                break;
        }
    }

    // Ctrl+F / Cmd+F → focus search bar contextual
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !inInput) {
        const tab = ZFlowStore?.currentTab || 'financiar';
        let searchEl = null;
        if (tab === 'financiar') {
            const inDet  = !document.getElementById('view-detalii')?.classList.contains('hidden');
            const inDetF = !document.getElementById('view-detalii-furnizor')?.classList.contains('hidden');
            if (inDet)  searchEl = document.getElementById('search-facturi-detaliu');
            else if (inDetF) searchEl = document.getElementById('search-facturi-furnizor-detaliu');
            else {
                const inFurn = !document.getElementById('view-furnizori')?.classList.contains('hidden');
                searchEl = inFurn
                    ? document.getElementById('search-furnizori')
                    : document.getElementById('search-firme');
            }
        } else if (tab === 'depozit')  searchEl = document.getElementById('depozit-search-produse');
        else if (tab === 'logistic')   searchEl = document.querySelector('#logistic input[type="text"]');
        if (searchEl) { e.preventDefault(); searchEl.focus(); searchEl.select(); }
    }
});

// ==========================================
// DASHBOARD ADMIN UTILIZATORI — [R9-FIX 1]
// ==========================================

let _adminUsersCache = null;

async function deschideDashboardAdmin() {
    const modal = document.getElementById('modal-dashboard-admin');
    if (!modal) return;
    modal.classList.add('active');
    const filter = document.getElementById('admin-filter-users');
    if (filter) filter.value = '';
    await reincarcaUseriAdmin();
}
window.deschideDashboardAdmin = deschideDashboardAdmin;

async function reincarcaUseriAdmin() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;
    container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Se încarcă...</p>';
    setLoader(true);
    try {
        const users = await ZFlowDB.adminGetAllUsers();
        _adminUsersCache = users;
        renderAdminUsersList(users);
    } catch(e) {
        container.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Eroare la încărcare</p>';
    } finally {
        setLoader(false);
    }
}
window.reincarcaUseriAdmin = reincarcaUseriAdmin;

function renderAdminUsersList(users) {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Niciun utilizator înregistrat</p>';
        return;
    }

    const planColors = {
        trial:      'bg-yellow-100 text-yellow-700 border-yellow-200',
        standard:   'bg-blue-100 text-blue-700 border-blue-200',
        pro:        'bg-purple-100 text-purple-700 border-purple-200',
        enterprise: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    };

    container.innerHTML = users.map((u, i) => {
        const plan = u.plan_type || 'standard';
        const planCls = planColors[plan] || planColors.standard;
        const expira = u.subscription_expires_at
            ? new Date(u.subscription_expires_at).toLocaleDateString('ro-RO', { day:'2-digit', month:'short', year:'numeric' })
            : 'fără expirare';
        const zile = u.zile_pana_la_expirare;
        let expireStatus = '';
        if (zile !== null) {
            if (zile < 0) expireStatus = `<span class="text-[8px] font-black text-red-500">EXPIRAT acum ${Math.abs(zile)} zile</span>`;
            else if (zile <= 14) expireStatus = `<span class="text-[8px] font-black text-orange-500">Atenție: ${zile} zile rămase</span>`;
            else expireStatus = `<span class="text-[8px] text-slate-400">${zile} zile rămase</span>`;
        }

        return `
        <div class="bg-white rounded-2xl border border-slate-100 p-3 space-y-2 shadow-sm">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-xs font-black text-slate-800 truncate">${escapeHtml(u.display_name || u.email)}</p>
                    <p class="text-[9px] text-slate-400 truncate">${escapeHtml(u.email)}</p>
                </div>
                <span class="shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${planCls}">${escapeHtml(plan)}</span>
            </div>

            <div class="flex items-center gap-3 text-[9px] text-slate-500 font-bold">
                <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 3.75h7.5A2.25 2.25 0 0117.25 6v12a2.25 2.25 0 01-2.25 2.25h-6A2.25 2.25 0 016.75 18V6A2.25 2.25 0 019 3.75zM9 7.5h6M9 11.25h6M9 15h3"/></svg>${u.nr_facturi || 0} facturi</span>
                <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72A8.97 8.97 0 0012 16.5a8.97 8.97 0 00-6 2.22M15 9a3 3 0 11-6 0 3 3 0 016 0z"/></svg>${u.nr_clienti || 0} clienți</span>
                <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7.5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM3 4.5h2.25l1.5 10.5h10.944a1.5 1.5 0 001.46-1.159l1.096-4.341H6.3"/></svg>${u.nr_comenzi || 0} comenzi</span>
            </div>

            <div class="flex items-center justify-between">
                <div>
                    <p class="text-[9px] text-slate-400">Expiră: ${expira}</p>
                    ${expireStatus}
                </div>
                <div class="flex gap-1.5">
                    <button
                        onclick="adminDeschideExtindere('${escapeHtml(u.email)}', '${escapeHtml(plan)}')"
                        class="text-[8px] font-black bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg border border-blue-200 transition-all">
                        Extinde
                    </button>
                    <button
                        onclick="adminDeschideNotificare('${escapeHtml(u.email)}')"
                        class="text-[8px] font-black bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded-lg border border-slate-200 transition-all">
                        Notifică
                    </button>
                    <button
                        onclick="adminDeschideStergere('${escapeHtml(u.email)}', '${escapeHtml(u.user_id || '')}')"
                        class="text-[8px] font-black bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-lg border border-red-200 transition-all"
                        title="Șterge date utilizator">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A2 2 0 004.5 20h15a2 2 0 001.71-3.14l-7.5-13a2 2 0 00-3.42 0z"/></svg>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}
window.renderAdminUsersList = renderAdminUsersList;

function adminDeschideExtindere(email, planCurent) {
    const panel = document.getElementById('admin-extend-panel');
    const emailEl = document.getElementById('admin-extend-email');
    const planEl = document.getElementById('admin-extend-plan');
    if (panel) panel.classList.remove('hidden');
    if (emailEl) emailEl.value = email;
    if (planEl) planEl.value = planCurent || 'standard';
    panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.adminDeschideExtindere = adminDeschideExtindere;

function adminDeschideNotificare(email) {
    const panel = document.getElementById('admin-notif-panel');
    const emailEl = document.getElementById('admin-notif-email-quick');
    if (panel) panel.classList.remove('hidden');
    if (emailEl) emailEl.value = email;
    panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.adminDeschideNotificare = adminDeschideNotificare;

async function adminExtindeAbonament() {
    const email = document.getElementById('admin-extend-email')?.value.trim();
    const zile  = parseInt(document.getElementById('admin-extend-zile')?.value || '365');
    const plan  = document.getElementById('admin-extend-plan')?.value || 'standard';
    if (!email) { showNotification('Email lipsă', 'error'); return; }
    setLoader(true);
    try {
        const ok = await ZFlowDB.adminExtendSubscription(email, zile, plan);
        if (ok) {
            showNotification(`Abonament extins pentru ${email} (+${zile} zile, plan ${plan})`, 'success');
            document.getElementById('admin-extend-panel')?.classList.add('hidden');
            await reincarcaUseriAdmin();
        } else {
            showNotification('User negăsit sau eroare', 'error');
        }
    } catch(e) {
        showNotification('Eroare: ' + e.message, 'error');
    } finally {
        setLoader(false);
    }
}
window.adminExtindeAbonament = adminExtindeAbonament;

async function adminTrimiteNotificareQuick() {
    const email = document.getElementById('admin-notif-email-quick')?.value.trim();
    const mesaj = document.getElementById('admin-notif-text-quick')?.value.trim();
    if (!email || !mesaj) { showNotification('Email și mesaj obligatorii', 'error'); return; }
    setLoader(true);
    try {
        const ok = await ZFlowDB.adminSendNotification(email, mesaj);
        showNotification(ok ? `Notificare trimisă` : 'Eroare la trimitere', ok ? 'success' : 'error');
        if (ok) {
            document.getElementById('admin-notif-text-quick').value = '';
            document.getElementById('admin-notif-panel')?.classList.add('hidden');
        }
    } finally {
        setLoader(false);
    }
}
window.adminTrimiteNotificareQuick = adminTrimiteNotificareQuick;

function inchideDashboardAdmin() {
    document.getElementById('modal-dashboard-admin')?.classList.remove('active');
}
window.inchideDashboardAdmin = inchideDashboardAdmin;

// Export
window.invalidateCashflowCache = invalidateCashflowCache;
window.exportaCSV = exportaCSV;
window.toggleDarkMode = toggleDarkMode;

/**
 * Inițializează dark mode la startup — respectă preferința salvată sau OS
 * Trebuie apelată sincron din <script> în <head> pentru a preveni FOUC
 */
function initDarkMode() {
    const saved = localStorage.getItem('zflow-theme');
    if (saved === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (saved === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('zflow-theme', 'dark');
    }
}
window.initDarkMode = initDarkMode;
