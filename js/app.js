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

// Timer debounce pentru căutări
let debounceSearchTimer = null;

// #13 - Drag & Drop: fișier PDF pending drop (nu poate fi setat pe input.files direct)
let pendingPDFFiles = []; // #23 - multiple attachments

// ==========================================
// RATE LIMITING LOGIN - Blocare după 5 încercări
// ==========================================
const LOGIN_RATE_LIMIT = {
    maxAttempts: 5,
    lockoutDuration: 5 * 60 * 1000, // 5 minute în ms
    attempts: 0,
    lockedUntil: null
};

/**
 * Verifică dacă utilizatorul este blocat din cauza încercărilor eșuate
 * @returns {boolean} true dacă e blocat, false dacă poate încerca
 */
function isLoginBlocked() {
    if (!LOGIN_RATE_LIMIT.lockedUntil) return false;
    
    const now = Date.now();
    if (now >= LOGIN_RATE_LIMIT.lockedUntil) {
        // Timpul de blocare a expirat, resetăm
        LOGIN_RATE_LIMIT.attempts = 0;
        LOGIN_RATE_LIMIT.lockedUntil = null;
        return false;
    }
    return true;
}

/**
 * Returnează timpul rămas până la deblocare (în secunde)
 */
function getLoginLockoutRemaining() {
    if (!LOGIN_RATE_LIMIT.lockedUntil) return 0;
    const remaining = Math.ceil((LOGIN_RATE_LIMIT.lockedUntil - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
}

/**
 * Înregistrează o încercare de login eșuată
 */
function recordFailedLoginAttempt() {
    LOGIN_RATE_LIMIT.attempts++;
    console.log(`⚠️ Încercare eșuată: ${LOGIN_RATE_LIMIT.attempts}/${LOGIN_RATE_LIMIT.maxAttempts}`);
    
    if (LOGIN_RATE_LIMIT.attempts >= LOGIN_RATE_LIMIT.maxAttempts) {
        LOGIN_RATE_LIMIT.lockedUntil = Date.now() + LOGIN_RATE_LIMIT.lockoutDuration;
        const minutes = Math.ceil(LOGIN_RATE_LIMIT.lockoutDuration / 60000);
        console.log(`🔒 Cont blocat pentru ${minutes} minute`);
    }
}

/**
 * Resetează contorul de încercări la login reușit
 */
function resetLoginAttempts() {
    LOGIN_RATE_LIMIT.attempts = 0;
    LOGIN_RATE_LIMIT.lockedUntil = null;
}

/**
 * Funcție utilHelper: debounce
 */
function debounce(func, delay) {
    return function (...args) {
        clearTimeout(debounceSearchTimer);
        debounceSearchTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Formatează data în format ZZ/LL/AA
 */
function formateazaDataZFlow(dataString) {
    if (!dataString) return "";
    const d = new Date(dataString);
    if (isNaN(d.getTime())) return dataString;
    const zi = String(d.getDate()).padStart(2, "0");
    const luna = String(d.getMonth() + 1).padStart(2, "0");
    const an = String(d.getFullYear()).slice(-2);
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
    const colors = {
        success: "bg-emerald-500",
        error: "bg-red-500",
        warning: "bg-yellow-500",
        info: "bg-blue-500"
    };
    const notif = document.createElement("div");
    notif.id = id;
    notif.className = `fixed top-4 right-4 ${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg z-[1000] animate-pulse text-sm font-medium`;
    notif.innerText = message;
    document.body.appendChild(notif);
    setTimeout(() => notif?.remove(), duration);
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
    
    console.log("🚀 Start Sincronizare Z-Flow...");
    setLoader(true);

    const listaContainer = document.getElementById("lista-firme-global");
    if (listaContainer) {
        showSkeletonLoader(listaContainer, 8);
    }

    try {
        let cl, fc;

        try {
            // Fetch clienți și facturi din rețea
            cl = await ZFlowDB.fetchClienti();
            console.log("✅ Clienți descărcați:", cl.length);

            fc = await ZFlowDB.fetchFacturi();
            console.log("✅ Facturi descărcate:", fc.length);

            // #7 - Scrie în cache IndexedDB după fiecare fetch reușit
            Promise.all([
                ZFlowIDB.save('clienti', cl),
                ZFlowIDB.save('facturi', fc),
            ]).catch(e => console.warn('[IDB] Eroare scriere cache:', e));

        } catch (networkErr) {
            // #7 - Rețeaua a eșuat → fallback la cache IndexedDB
            console.warn('[IDB] Rețea indisponibilă, încerc cache local...', networkErr.message);
            cl = await ZFlowIDB.getAll('clienti');
            fc = await ZFlowIDB.getAll('facturi');

            if (cl.length === 0 && fc.length === 0) {
                throw networkErr; // fără cache → aruncă eroarea originală
            }

            const varstaCache = await ZFlowIDB.cacheAge('clienti');
            showNotification(`📴 Mod offline · Cache: ${varstaCache || 'N/A'}`, 'warning');
            console.log(`[IDB] Din cache: ${cl.length} clienți, ${fc.length} facturi`);
        }

        ZFlowStore.dateFacturiBI = fc || [];

        const azi = new Date();
        azi.setHours(0, 0, 0, 0);

        // Procesăm datele locale
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

        console.log("📊 Date procesate local:", ZFlowStore.dateLocal.length);

        renderMain();
        updateDashboardKPI();

        // === Furnizori & Facturi de Plătit (non-fatal) ===
        try {
            let fr = [], fp = [];
            try {
                fr = await ZFlowDB.fetchFurnizori();
                fp = await ZFlowDB.fetchFacturiPlatit();
                console.log("✅ Furnizori descărcați:", fr.length, "| Facturi plătit:", fp.length);
                Promise.all([
                    ZFlowIDB.save('furnizori', fr),
                    ZFlowIDB.save('facturi_platit', fp),
                ]).catch(e => console.warn('[IDB] Eroare cache furnizori:', e));
            } catch (fErr) {
                console.warn('[Furnizori] Rețea indisponibilă, încerc cache local...', fErr.message);
                fr = await ZFlowIDB.getAll('furnizori').catch(() => []);
                fp = await ZFlowIDB.getAll('facturi_platit').catch(() => []);
            }
            ZFlowStore.dateFacturiPlatit = fp || [];
            const aziF = new Date(); aziF.setHours(0, 0, 0, 0);
            ZFlowStore.dateFurnizori = (fr || []).map(furn => {
                const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
                const sold = fps.filter(fp2 => fp2.status_plata !== 'Platit').reduce((sum, fp2) => sum + (Number(fp2.valoare) || 0), 0);
                const sumaScadenta = fps.reduce((acc, fac) => {
                    if (fac.status_plata !== 'Platit' && fac.data_scadenta) {
                        const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                        if (d < aziF) return acc + (Number(fac.valoare) || 0);
                    }
                    return acc;
                }, 0);
                return { ...furn, facturi: fps, sold, sumaScadenta };
            });
            renderFurnizori();
            updateFurnizoriKPI();
        } catch (furnErr) {
            console.warn('⚠️ Eroare furnizori (non-fatal):', furnErr.message);
        }

        populeazaBridgeUI();
        if (document.getElementById("map")) renderTransportTab();
        saveZFlowData();
        verificaScadenteNotificari(); // #12 - verifică scadențe și actualizează bell

    } catch (err) {
        console.error("❌ EROARE:", err);
        showNotification("Eroare la încărcare: " + err.message, "error");
    } finally {
        setLoader(false);
    }

    comutaVedereFin("firme");
    updateDateLabels();
    updateSyncStatus();
    setAriaLabels();
    if (goHome) schimbaTab('home', document.getElementById('nav-btn-home'));
    else incarcaDashboard();
}

/**
 * Actualizează statusul sincronizării
 */
function updateSyncStatus() {
    const ultimaSincronizare = new Date();
    const sapteZileInMs = 7 * 24 * 60 * 60 * 1000;
    const acum = new Date();
    const punctStatus = document.querySelector(".bg-blue-900 .w-1\\.5.h-1\\.5");
    const textStatus = document.querySelector(".bg-blue-900 .text-blue-100");

    if (acum - ultimaSincronizare > sapteZileInMs) {
        if (punctStatus) punctStatus.classList.replace("bg-emerald-500", "bg-red-500");
        if (textStatus) textStatus.innerText = "Sincronizare SAGA: Necesară (peste 7 zile)";
    } else {
        if (punctStatus) punctStatus.classList.replace("bg-red-500", "bg-emerald-500");
        if (textStatus) textStatus.innerText = "Sincronizat SAGA: Recent (sub 7 zile)";
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
            // Restante = neîncasate cu scadență DEPĂȘITĂ
            if (f.data_scadenta) {
                const dataScadenta = new Date(f.data_scadenta);
                dataScadenta.setHours(0, 0, 0, 0);
                if (dataScadenta < azi) {
                    totalRestante += valoare;
                }
            }
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
    // Rate limiting check - blocare după 5 încercări eșuate
    if (isLoginBlocked()) {
        const remainingSec = getLoginLockoutRemaining();
        const remainingMin = Math.ceil(remainingSec / 60);
        showNotification(`Cont blocat temporar. Încearcă din nou în ${remainingMin} min.`, "warning");
        return;
    }
    
    const email = document.getElementById("auth-username").value.trim();
    const pass = document.getElementById("auth-password").value;

    if (!email || !pass) {
        showNotification("❌ Completează email și parola", "error");
        return;
    }

    setLoader(true);
    
    // FALLBACK: Credențiale demo (admin/1234 sau user/pass)
    if ((email === "admin" && pass === "1234") || (email === "user" && pass === "pass")) {
        const role = (email === "admin") ? 'admin' : 'user';
        ZFlowStore.userSession = { user: { email: email }, isDemo: true };
        saveDemoSession(email, role); // Salvează sesiunea demo cu rol
        setUserRole(role); // Setează permisiunile
        document.getElementById("modal-auth").classList.remove("active");
        
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';
        
        resetLoginAttempts(); // Reset rate limit la succes
        showNotification(`✅ Bun venit, ${email}! (${role === 'admin' ? 'Admin' : 'User'})`, "success");
        setLoader(false);
        init();
        return;
    }
    
    try {
        // Încearcă autentificare Supabase
        const { session, user } = await ZFlowDB.signIn(email, pass);
        
        ZFlowStore.userSession = session;
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
        
        resetLoginAttempts(); // Reset rate limit la succes
        showNotification(`✅ Bun venit, ${user.email}!`, "success");
        await verificaOnboarding(user);
    } catch (error) {
        console.error("Auth error:", error);
        recordFailedLoginAttempt(); // Înregistrează încercare eșuată
        
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
    } finally {
        setLoader(false);
    }
}

/**
 * Deconectare utilizator (Supabase Auth + Demo)
 */
function confirmaLogout() {
    showConfirmModal(
        "🚪 Ești sigur că dorești să te deconectezi? Sesiunea curentă va fi închisă.",
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
            await ZFlowDB.signOut();
        }
        
        ZFlowStore.userSession = null;

        // #7 - Șterge cache-ul IndexedDB la deconectare (confidențialitate)
        await ZFlowIDB.clearAll();

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
        
        showNotification("👋 Deconectat cu succes!", "info");
    } catch (error) {
        console.error("Logout error:", error);
        showNotification("❌ Eroare la deconectare", "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Deschide modalul de înregistrare
 */
function deschideModalInregistrare() {
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
 * Înregistrare utilizator nou
 */
async function inregistrareUtilizator() {
    const email = document.getElementById("reg-email").value.trim();
    const pass = document.getElementById("reg-password").value;
    const passConfirm = document.getElementById("reg-password-confirm").value;
    const nume = document.getElementById("reg-nume").value.trim();
    
    // Validări
    if (!email || !pass) {
        showNotification("❌ Completează toate câmpurile obligatorii", "error");
        return;
    }
    
    if (pass !== passConfirm) {
        showNotification("❌ Parolele nu coincid", "error");
        return;
    }
    
    if (pass.length < 6) {
        showNotification("❌ Parola trebuie să aibă minim 6 caractere", "error");
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification("❌ Email invalid", "error");
        return;
    }
    
    setLoader(true);
    
    try {
        await ZFlowDB.signUp(email, pass, { nume: nume });
        
        document.getElementById("modal-register").classList.remove("active");
        document.getElementById("modal-auth").classList.add("active");
        
        // Curăță câmpurile
        document.getElementById("reg-email").value = '';
        document.getElementById("reg-password").value = '';
        document.getElementById("reg-password-confirm").value = '';
        document.getElementById("reg-nume").value = '';
        
        showNotification("✅ Cont creat! Verifică-ți email-ul pentru confirmare.", "success");
    } catch (error) {
        console.error("Register error:", error);
        
        let errorMsg = "❌ Eroare la înregistrare";
        if (error.message.includes("already registered")) {
            errorMsg = "❌ Acest email este deja înregistrat";
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
        showNotification("❌ Introdu adresa de email", "error");
        return;
    }
    
    setLoader(true);
    
    try {
        await ZFlowDB.resetPassword(email);
        
        document.getElementById("modal-reset-password").classList.remove("active");
        document.getElementById("modal-auth").classList.add("active");
        
        document.getElementById("reset-email").value = '';
        
        showNotification("✅ Email trimis! Verifică-ți căsuța.", "success");
    } catch (error) {
        console.error("Reset password error:", error);
        showNotification("❌ Eroare la trimiterea email-ului", "error");
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
        console.warn('verificaOnboarding error:', err);
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
        showNotification('❌ Completează CUI-ul și denumirea firmei', 'error');
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
        showNotification('✅ Profil salvat! Bun venit în Z-FLOW!', 'success');
        init();
    } catch (err) {
        console.error('salveazaProfilOnboarding error:', err);
        showNotification('❌ Eroare la salvare: ' + err.message, 'error');
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
    // Nu e disponibil pentru sesiuni demo
    if (ZFlowStore.userSession?.isDemo) {
        showNotification('⚠️ Profilul firmei nu e disponibil în modul demo', 'warning');
        return;
    }

    setLoader(true);
    try {
        const profile = await ZFlowDB.fetchProfile();
        ZFlowStore.userProfile = profile;

        const f = (id) => document.getElementById(id);

        // Afișează email-ul contului (read-only)
        const emailDisplay = f('profil-email-display');
        if (emailDisplay) {
            const session = await ZFlowDB.getSession();
            emailDisplay.textContent = session?.user?.email || '—';
        }

        if (profile) {
            if (f('pf-cui'))              f('pf-cui').value              = profile.cui || '';
            if (f('pf-telefon'))          f('pf-telefon').value          = profile.telefon || '';
            if (f('pf-nume-firma'))       f('pf-nume-firma').value       = profile.nume_firma || '';
            if (f('pf-oras'))             f('pf-oras').value             = profile.oras || '';
            if (f('pf-adresa'))           f('pf-adresa').value           = profile.adresa || '';
            if (f('pf-persoana-contact')) f('pf-persoana-contact').value = profile.persoana_contact || '';
            if (f('pf-email'))            f('pf-email').value            = profile.email || '';
            if (f('pf-iban'))             f('pf-iban').value             = profile.iban || '';
        }

        document.getElementById('modal-profil-firma').classList.add('active');
    } catch (err) {
        console.error('deschideProfilFirma error:', err);
        showNotification('❌ Eroare la încărcarea profilului', 'error');
    } finally {
        setLoader(false);
    }
}

/**
 * Închide modalul de profil firmă
 */
function inchideProfilFirma() {
    document.getElementById('modal-profil-firma').classList.remove('active');
}

/**
 * Salvează modificările din modalul de profil firmă
 */
async function salveazaProfilFirma() {
    const cui       = document.getElementById('pf-cui')?.value.trim();
    const numeFirma = document.getElementById('pf-nume-firma')?.value.trim();

    if (!cui || !numeFirma) {
        showNotification('❌ Completează CUI-ul și denumirea firmei', 'error');
        return;
    }

    setLoader(true);
    try {
        const payload = {
            cui,
            nume_firma:       numeFirma,
            oras:             document.getElementById('pf-oras')?.value.trim()             || null,
            adresa:           document.getElementById('pf-adresa')?.value.trim()           || null,
            telefon:          document.getElementById('pf-telefon')?.value.trim()          || null,
            persoana_contact: document.getElementById('pf-persoana-contact')?.value.trim() || null,
            email:            document.getElementById('pf-email')?.value.trim()            || null,
            iban:             document.getElementById('pf-iban')?.value.trim()             || null,
            onboarding_done: true
        };

        await ZFlowDB.upsertProfile(payload);
        ZFlowStore.userProfile = { ...ZFlowStore.userProfile, ...payload };

        inchideProfilFirma();
        showNotification('✅ Profil actualizat cu succes!', 'success');
    } catch (err) {
        console.error('salveazaProfilFirma error:', err);
        showNotification('❌ Eroare la salvare: ' + err.message, 'error');
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
            input.addEventListener("change", function () {
                const labelId = id === "data-start" ? "label-start" : "label-end";
                const prefix = id === "data-start" ? "DE LA: " : "PÂNĂ LA: ";
                const defaultText = id === "data-start" ? "De la: --" : "Până la: --";
                const labelEl = document.getElementById(labelId);
                if (this.value && labelEl) {
                    labelEl.innerText = prefix + formateazaDataZFlow(this.value);
                    labelEl.parentElement.classList.add("border-blue-200");
                    const startVal = document.getElementById("data-start")?.value;
                    const endVal = document.getElementById("data-end")?.value;
                    if (startVal && endVal) {
                        toggleToateBI(true);
                        // Salvează intervalul în store înainte de a șterge inputurile
                        ZFlowStore.biStartVal = startVal;
                        ZFlowStore.biEndVal = endVal;
                        genereazaBI();
                        // Resetează ambele inputuri după generarea raportului
                        ["data-start", "data-end"].forEach((fid) => {
                            const fi = document.getElementById(fid);
                            const fl = document.getElementById(fid === "data-start" ? "label-start" : "label-end");
                            const fd = fid === "data-start" ? "De la: --" : "Până la: --";
                            if (fi) fi.value = "";
                            if (fl) {
                                fl.innerText = fd;
                                fl.parentElement.classList.remove("border-blue-200");
                            }
                        });
                        return;
                    }
                } else if (labelEl) {
                    labelEl.innerText = defaultText;
                    labelEl.parentElement.classList.remove("border-blue-200");
                }
                genereazaBI();
            });
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

    if (id === "logistic") initMap();
    if (id === "depozit") initScanner();

    const btnActions = document.getElementById("nav-btn-actions");
    if (btnActions) {
        const esteInDetalii = !document.getElementById("view-detalii").classList.contains("hidden");
        btnActions.style.display = id === "financiar" && !esteInDetalii ? "flex" : "none";
    }

    if (id === "home") incarcaDashboard();

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
            } else {
                btnActions.querySelector("span").innerText = "ACȚIUNI";
                btnActions.setAttribute("onclick", "toggleFAB()");
                btnActions.classList.remove("text-blue-600", "animate-pulse");
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

    if (v === "analiza") genereazaBI();
    else if (v === "firme") renderMain();
    else if (v === "furnizori") renderFurnizori();

    // Gestionare History API pentru butonul Back pe mobile
    if (pushState) {
        history.pushState({ zflowView: v }, "", "#" + v);
    }

    ZFlowStore.currentView = v;
}

/**
 * Toggle FAB Menu
 */
function toggleFAB() {
    document.getElementById("fab-menu").classList.toggle("active");
}

// ==========================================
// RENDER CLIENȚI
// ==========================================

/**
 * Renderizează lista principală de clienți
 */
function renderMain(lista = null) {
    const container = document.getElementById("lista-firme-global");
    let sursa = lista || ZFlowStore.dateLocal;
    if (!container) return;

    if (sursa.length === 0) {
        showEmptyState(container, "Niciun client", "Adaugă clienți pentru a-ți gestiona facturile și încasările", "clients");
        return;
    }

    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Sortare: Facturile depășite primele
    sursa.sort((a, b) => {
        const aRestant = (a.facturi || []).some(
            (f) =>
                f.status_plata !== "Incasat" &&
                f.data_scadenta &&
                new Date(f.data_scadenta).setHours(0, 0, 0, 0) < azi
        );
        const bRestant = (b.facturi || []).some(
            (f) =>
                f.status_plata !== "Incasat" &&
                f.data_scadenta &&
                new Date(f.data_scadenta).setHours(0, 0, 0, 0) < azi
        );
        return bRestant - aRestant;
    });

    container.innerHTML = sursa
        .map((f) => {
            const sumaScadenta = (f.facturi || []).reduce((acc, fac) => {
                if (fac.status_plata !== "Incasat" && fac.data_scadenta) {
                    const dScad = new Date(fac.data_scadenta);
                    dScad.setHours(0, 0, 0, 0);
                    if (dScad < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);

            const areRestante = sumaScadenta > 0;

            return `
<div onclick="arataDetalii('${f.id}')" class="card-flow group flex flex-col p-5 mb-3 transition-all cursor-pointer relative overflow-hidden bg-white border border-slate-100 hover:border-blue-200 hover:shadow-lg active:scale-[0.98]">
    ${areRestante ? `<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.3)]"></div>` : ""}
    <div class="flex justify-between items-start w-full">
        <div class="max-w-[60%]">
            <h4 class="font-extrabold text-slate-800 text-[15px] leading-tight truncate tracking-tight">${f.nume_firma || f.cui}</h4>
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="w-2 h-2 rounded-full ${areRestante ? "bg-red-400" : "bg-emerald-400"}"></span>
                <p class="text-[10px] font-semibold text-slate-400">${f.oras || "Zalău"}</p>
            </div>
        </div>
        <div class="text-right flex flex-col items-end">
            <p class="text-blue-900 font-black text-[20px] leading-none tracking-tighter">${Math.round(f.sold).toLocaleString()} <span class="text-[11px] font-bold">lei</span></p>
            <p class="text-[9px] font-semibold text-slate-400 mt-1">Sold total</p>
        </div>
    </div>
    ${areRestante ? `
    <div class="mt-3 py-2.5 px-3 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <p class="text-[9px] font-bold text-red-500 uppercase">Scadență depășită</p>
        </div>
        <p class="text-red-600 font-black text-[13px] leading-none">${Math.round(sumaScadenta).toLocaleString()} lei</p>
    </div>` : ""}
    <div class="flex gap-3 mt-4">
        <button onclick="event.stopPropagation(); arataDetalii('${f.id}')"
                class="flex-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 border border-blue-100 hover:border-blue-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            Facturi
        </button>
        <button onclick="event.stopPropagation(); deschideModal('modal-client', '${f.id}')"
                class="flex-1 bg-slate-50 hover:bg-slate-700 hover:text-white text-slate-600 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Profil
        </button>
    </div>
</div>`;
        })
        .join("");

    // Update Total Portofoliu
    const totalPort = ZFlowStore.dateLocal.reduce((acc, f) => acc + (Number(f.sold) || 0), 0);
    const totalEl = document.getElementById("total-general");
    if (totalEl) totalEl.innerText = `${Math.round(totalPort).toLocaleString()} lei`;
}

// Debounce pentru căutarea clienți
const filtreazaListaFirmeDebounced = debounce(function () {
    const q = document.getElementById("search-firme").value.toLowerCase().trim();
    const filtrate = ZFlowStore.dateLocal.filter(
        (f) =>
            (f.nume_firma || "").toLowerCase().includes(q) ||
            f.cui.includes(q)
    );
    
    // Dacă există căutare activă și nu s-a găsit nimic, afișăm empty state de tip search
    if (q && filtrate.length === 0) {
        const container = document.getElementById("lista-firme-global");
        if (container) {
            showEmptyState(container, "Niciun rezultat", `Nu am găsit clienți pentru "${q}". Verifică termenul de căutare.`, "search");
        }
        return;
    }
    
    renderMain(filtrate);
}, 300);

// ==========================================
// RENDER FURNIZORI
// ==========================================

function renderFurnizori(lista) {
    const container = document.getElementById("lista-furnizori-global");
    const sursa = lista || ZFlowStore.dateFurnizori;
    if (!container) return;

    if (sursa.length === 0) {
        showEmptyState(container, "Niciun furnizor", "Adaugă furnizori pentru a gestiona facturile de plătit", "clients");
        // Actualizează și totalul
        const totalEl = document.getElementById("total-general-platit");
        if (totalEl) totalEl.innerText = "0 lei";
        return;
    }

    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Sortare: restanțele primele
    sursa.sort((a, b) => {
        const aRestant = (a.facturi || []).some(
            (f) => f.status_plata !== "Platit" && f.data_scadenta &&
                new Date(f.data_scadenta).setHours(0, 0, 0, 0) < azi
        );
        const bRestant = (b.facturi || []).some(
            (f) => f.status_plata !== "Platit" && f.data_scadenta &&
                new Date(f.data_scadenta).setHours(0, 0, 0, 0) < azi
        );
        return bRestant - aRestant;
    });

    container.innerHTML = sursa.map((f) => {
        const areRestante = f.sumaScadenta > 0;
        return `
<div onclick="arataDetaliiFurnizor('${f.id}')" class="card-flow group flex flex-col p-5 mb-3 transition-all cursor-pointer relative overflow-hidden bg-white border border-slate-100 hover:border-red-200 hover:shadow-lg active:scale-[0.98]">
    ${areRestante ? `<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.3)]"></div>` : ""}
    <div class="flex justify-between items-start w-full">
        <div class="max-w-[60%]">
            <h4 class="font-extrabold text-slate-800 text-[15px] leading-tight truncate tracking-tight">${f.nume_firma || f.cui}</h4>
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="w-2 h-2 rounded-full ${areRestante ? "bg-red-400" : "bg-emerald-400"}"></span>
                <p class="text-[10px] font-semibold text-slate-400">${f.oras || "—"}</p>
            </div>
        </div>
        <div class="text-right flex flex-col items-end">
            <p class="text-red-700 font-black text-[20px] leading-none tracking-tighter">${Math.round(f.sold).toLocaleString()} <span class="text-[11px] font-bold">lei</span></p>
            <p class="text-[9px] font-semibold text-slate-400 mt-1">De plătit</p>
        </div>
    </div>
    ${areRestante ? `
    <div class="mt-3 py-2.5 px-3 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <p class="text-[9px] font-bold text-red-500 uppercase">Scadență depășită</p>
        </div>
        <p class="text-red-600 font-black text-[13px] leading-none">${Math.round(f.sumaScadenta).toLocaleString()} lei</p>
    </div>` : ""}
    <div class="flex gap-3 mt-4">
        <button onclick="event.stopPropagation(); arataDetaliiFurnizor('${f.id}')"
                class="flex-1 bg-red-50 hover:bg-red-700 hover:text-white text-red-700 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 border border-red-100 hover:border-red-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            Facturi
        </button>
        <button onclick="event.stopPropagation(); deschideModalFurnizor('${f.id}')"
                class="flex-1 bg-slate-50 hover:bg-slate-700 hover:text-white text-slate-600 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Profil
        </button>
    </div>
</div>`;
    }).join("");

    const totalPlatit = ZFlowStore.dateFurnizori.reduce((acc, f) => acc + (Number(f.sold) || 0), 0);
    const totalEl = document.getElementById("total-general-platit");
    if (totalEl) totalEl.innerText = `${Math.round(totalPlatit).toLocaleString()} lei`;
}

/**
 * Debounce căutare furnizori
 */
const filtreazaListaFurnizoriDebounced = debounce(function () {
    const q = document.getElementById("search-furnizori")?.value.toLowerCase().trim() || "";
    const filtrate = ZFlowStore.dateFurnizori.filter(
        (f) => (f.nume_firma || "").toLowerCase().includes(q) || (f.cui || "").includes(q)
    );
    if (q && filtrate.length === 0) {
        const container = document.getElementById("lista-furnizori-global");
        if (container) showEmptyState(container, "Niciun rezultat", `Nu am găsit furnizori pentru "${q}".`, "search");
        return;
    }
    renderFurnizori(filtrate);
}, 300);

function filtreazaListaFurnizori() {
    filtreazaListaFurnizoriDebounced();
}

/**
 * Arată detalii furnizor (view-detalii-furnizor)
 */
function arataDetaliiFurnizor(id) {
    const furnizor = ZFlowStore.dateFurnizori.find((f) => String(f.id) === String(id));
    if (!furnizor) return;

    ZFlowStore.selectedFurnizorId = id;

    const cardEl = document.getElementById("card-detaliu-furnizor");
    if (cardEl) {
        cardEl.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h2 class="text-2xl font-extrabold leading-tight">${furnizor.nume_firma || furnizor.cui}</h2>
                    <p class="text-red-200 text-sm mt-1">CUI: ${furnizor.cui || "—"}</p>
                </div>
                <span class="text-3xl font-black text-white/80">${Math.round(furnizor.sold || 0).toLocaleString()} lei</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
                ${furnizor.oras ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Oraș</p><p class="font-semibold">${furnizor.oras}</p></div>` : ""}
                ${furnizor.telefon ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Telefon</p><p class="font-semibold">${furnizor.telefon}</p></div>` : ""}
                ${furnizor.persoana_contact ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Contact</p><p class="font-semibold">${furnizor.persoana_contact}</p></div>` : ""}
                ${furnizor.contact_email ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Email</p><p class="font-semibold truncate">${furnizor.contact_email}</p></div>` : ""}
                ${furnizor.iban ? `<div class="col-span-2"><p class="text-red-300 text-[9px] uppercase font-bold">IBAN</p><p class="font-semibold font-mono text-xs">${furnizor.iban}</p></div>` : ""}
            </div>
            <button onclick="deschideModalFacturaPlatit('${id}')" class="mt-5 w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-2xl text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                Adaugă Factură de Plătit
            </button>`;
    }

    const listaEl = document.getElementById("lista-facturi-platit-detaliu");
    if (listaEl) {
        const facturi = furnizor.facturi || [];
        const azi = new Date(); azi.setHours(0, 0, 0, 0);
        if (facturi.length === 0) {
            showEmptyState(listaEl, "Nicio factură", "Adaugă prima factură de plătit pentru acest furnizor", "period");
        } else {
            listaEl.innerHTML = facturi.sort((a, b) => {
                if (a.status_plata === "Platit" && b.status_plata !== "Platit") return 1;
                if (b.status_plata === "Platit" && a.status_plata !== "Platit") return -1;
                return 0;
            }).map((fac) => {
                const isPlatit = fac.status_plata === "Platit";
                const isDepasit = !isPlatit && fac.data_scadenta && new Date(fac.data_scadenta).setHours(0,0,0,0) < azi;
                return `
<div class="card-flow flex items-center justify-between min-h-[65px] mb-2 ${isPlatit ? "bg-white" : "bg-red-50/40 border-red-100"}">
    <div class="flex items-center gap-3">
        <span class="w-2 h-2 rounded-full flex-shrink-0 ${isPlatit ? "bg-emerald-400" : isDepasit ? "bg-red-500" : "bg-amber-400"}"></span>
        <div>
            <p class="text-[11px] font-black text-slate-800 uppercase">#${fac.numar_factura || "—"}</p>
            <p class="text-[8px] font-bold text-slate-400 uppercase">E: ${formateazaDataZFlow(fac.data_emiterii)} | S: ${fac.data_scadenta ? formateazaDataZFlow(fac.data_scadenta) : "—"}</p>
        </div>
    </div>
    <div class="flex items-center gap-3">
        <div class="text-right">
            <b class="text-xs ${isPlatit ? "text-blue-900" : "text-red-600"}">${Number(fac.valoare).toLocaleString()} lei</b>
            <p class="text-[7px] text-slate-400 uppercase">${fac.status_plata}</p>
        </div>
        <div class="flex flex-col gap-1">
            <button onclick="event.stopPropagation(); toggleStatusPlatit('${fac.id}', '${fac.status_plata}')"
                    class="w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isPlatit ? "bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-600"}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            </button>
            <button onclick="event.stopPropagation(); deschideModalFacturaPlatit('${id}', '${fac.id}')"
                    class="w-8 h-8 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-lg flex items-center justify-center transition-all">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
            </button>
        </div>
    </div>
</div>`;
            }).join("");
        }
    }

    comutaVedereFin("detalii-furnizor");
}

/**
 * Toggle status plătit/neplătit pentru o factură de plătit
 */
async function toggleStatusPlatit(id, statusCurent) {
    const nouStatus = statusCurent === "Platit" ? "Neplatit" : "Platit";
    try {
        const payload = {
            status_plata: nouStatus,
            data_plata: nouStatus === "Platit" ? new Date().toISOString().split("T")[0] : null
        };
        await ZFlowDB.updateFacturaPlatit(id, payload);
        // Actualizează local
        const fp = ZFlowStore.dateFacturiPlatit.find(f => String(f.id) === String(id));
        if (fp) { fp.status_plata = nouStatus; fp.data_plata = payload.data_plata; }
        // Recalculeaza dateFurnizori
        const azi = new Date(); azi.setHours(0, 0, 0, 0);
        ZFlowStore.dateFurnizori = ZFlowStore.dateFurnizori.map(furn => {
            const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
            const sold = fps.filter(fp2 => fp2.status_plata !== "Platit").reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
            const sumaScadenta = fps.reduce((acc, fac) => {
                if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                    const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0);
                    if (d < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            return { ...furn, facturi: fps, sold, sumaScadenta };
        });
        updateFurnizoriKPI();
        if (ZFlowStore.selectedFurnizorId) arataDetaliiFurnizor(ZFlowStore.selectedFurnizorId);
        showNotification(nouStatus === "Platit" ? "✅ Marcat ca Plătit" : "↩️ Marcat ca Neplătit", "success");
    } catch (err) {
        showNotification("❌ Eroare: " + err.message, "error");
    }
}

/**
 * Actualizează KPI-urile din view-furnizori
 */
function updateFurnizoriKPI() {
    const facturi = ZFlowStore.dateFacturiPlatit || [];
    const furnizori = ZFlowStore.dateFurnizori || [];
    const azi = new Date(); azi.setHours(0, 0, 0, 0);
    const lunaCurenta = azi.getMonth();
    const anulCurent = azi.getFullYear();

    let totalPlatit = 0, totalRestante = 0, totalLuna = 0;
    facturi.forEach(f => {
        const val = Number(f.valoare) || 0;
        if (f.status_plata === "Platit") {
            totalPlatit += val;
        } else {
            if (f.data_scadenta) {
                const d = new Date(f.data_scadenta); d.setHours(0,0,0,0);
                if (d < azi) totalRestante += val;
            }
        }
        if (f.data_emiterii) {
            const d = new Date(f.data_emiterii);
            if (d.getMonth() === lunaCurenta && d.getFullYear() === anulCurent) totalLuna += val;
        }
    });

    const fmt = (v) => v >= 1000000 ? (v/1000000).toFixed(1)+"M" : v >= 1000 ? (v/1000).toFixed(0)+"k" : Math.round(v).toString();

    const kpiPlatit = document.getElementById("kpi-platit");
    const kpiRest = document.getElementById("kpi-restante-furnizori");
    const kpiFurn = document.getElementById("kpi-furnizori");
    const kpiLuna = document.getElementById("kpi-luna-furnizori");
    if (kpiPlatit) kpiPlatit.innerText = fmt(totalPlatit);
    if (kpiRest) kpiRest.innerText = fmt(totalRestante);
    if (kpiFurn) kpiFurn.innerText = furnizori.length.toString();
    if (kpiLuna) kpiLuna.innerText = fmt(totalLuna);
}

/**
 * Deschide modal furnizor (nou sau editare)
 */
function deschideModalFurnizor(id) {
    const modal = document.getElementById("modal-furnizor");
    if (!modal) return;
    const btnSterge = document.getElementById("btn-sterge-furnizor");
    const title = document.getElementById("modal-furnizor-title");

    document.getElementById("in-furn-id").value = "";
    ["in-furn-cui","in-furn-nume","in-furn-adresa","in-furn-contact","in-furn-tel","in-furn-email","in-furn-iban","in-furn-oras","in-furn-note"].forEach(el => {
        const inp = document.getElementById(el);
        if (inp) inp.value = "";
    });

    if (id) {
        const f = ZFlowStore.dateFurnizori.find(f => String(f.id) === String(id));
        if (f) {
            document.getElementById("in-furn-id").value = f.id;
            document.getElementById("in-furn-cui").value = f.cui || "";
            document.getElementById("in-furn-nume").value = f.nume_firma || "";
            document.getElementById("in-furn-adresa").value = f.adresa || "";
            const contactEl = document.getElementById("in-furn-contact");
            if (contactEl) contactEl.value = f.persoana_contact || "";
            document.getElementById("in-furn-tel").value = f.telefon || "";
            document.getElementById("in-furn-email").value = f.contact_email || "";
            document.getElementById("in-furn-iban").value = f.iban || "";
            document.getElementById("in-furn-oras").value = f.oras || "";
            document.getElementById("in-furn-note").value = f.note || "";
        }
        if (title) title.innerText = "Editare Furnizor";
        if (btnSterge) btnSterge.classList.remove("hidden");
    } else {
        if (title) title.innerText = "Furnizor Nou";
        if (btnSterge) btnSterge.classList.add("hidden");
    }

    modal.classList.add("active");
}

/**
 * Salvează furnizor (insert sau update)
 */
async function salveazaFurnizor() {
    const id = document.getElementById("in-furn-id")?.value.trim();
    const numeFirma = document.getElementById("in-furn-nume")?.value.trim();
    const cui = document.getElementById("in-furn-cui")?.value.trim();

    if (!numeFirma && !cui) {
        showNotification("❌ Completează cel puțin CUI-ul sau denumirea firmei", "error");
        return;
    }

    setLoader(true);
    try {
        const payload = {
            cui: cui || null,
            nume_firma: numeFirma || null,
            adresa: document.getElementById("in-furn-adresa")?.value.trim() || null,
            persoana_contact: document.getElementById("in-furn-contact")?.value.trim() || null,
            telefon: document.getElementById("in-furn-tel")?.value.trim() || null,
            contact_email: document.getElementById("in-furn-email")?.value.trim() || null,
            iban: document.getElementById("in-furn-iban")?.value.trim() || null,
            oras: document.getElementById("in-furn-oras")?.value.trim() || null,
            note: document.getElementById("in-furn-note")?.value.trim() || null,
            updated_at: new Date().toISOString()
        };

        if (id) {
            await ZFlowDB.updateFurnizor(id, payload);
            showNotification("✅ Furnizor actualizat!", "success");
        } else {
            await ZFlowDB.insertFurnizor(payload);
            showNotification("✅ Furnizor adăugat!", "success");
        }

        inchideModal("modal-furnizor");
        // Reîncarcă furnizori
        const fr = await ZFlowDB.fetchFurnizori();
        ZFlowStore.dateFacturiPlatit = ZFlowStore.dateFacturiPlatit || [];
        const azi = new Date(); azi.setHours(0,0,0,0);
        ZFlowStore.dateFurnizori = fr.map(furn => {
            const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
            const sold = fps.filter(fp2 => fp2.status_plata !== "Platit").reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
            const sumaScadenta = fps.reduce((acc, fac) => {
                if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                    const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0);
                    if (d < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            return { ...furn, facturi: fps, sold, sumaScadenta };
        });
        renderFurnizori();
        updateFurnizoriKPI();
        if (id && ZFlowStore.selectedFurnizorId === id) arataDetaliiFurnizor(id);
    } catch (err) {
        showNotification("❌ Eroare: " + err.message, "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Șterge furnizor din modal
 */
function stergeFurnizorModal() {
    const id = document.getElementById("in-furn-id")?.value;
    if (!id) return;
    deschideModalConfirm(
        "Ștergi furnizorul? Toate facturile asociate vor fi șterse.",
        async () => {
            setLoader(true);
            try {
                await ZFlowDB.deleteFurnizor(id);
                inchideModal("modal-furnizor");
                const fr = await ZFlowDB.fetchFurnizori();
                const fp = await ZFlowDB.fetchFacturiPlatit();
                ZFlowStore.dateFacturiPlatit = fp || [];
                const azi = new Date(); azi.setHours(0,0,0,0);
                ZFlowStore.dateFurnizori = fr.map(furn => {
                    const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
                    const sold = fps.filter(fp2 => fp2.status_plata !== "Platit").reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
                    const sumaScadenta = fps.reduce((acc, fac) => {
                        if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                            const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0);
                            if (d < azi) return acc + (Number(fac.valoare) || 0);
                        }
                        return acc;
                    }, 0);
                    return { ...furn, facturi: fps, sold, sumaScadenta };
                });
                comutaVedereFin("furnizori");
                renderFurnizori();
                updateFurnizoriKPI();
                showNotification("✅ Furnizor șters!", "success");
            } catch (err) {
                showNotification("❌ Eroare: " + err.message, "error");
            } finally {
                setLoader(false);
            }
        }
    );
}

/**
 * Populează select-ul de furnizori în modal-factura-platit
 */
function populeazaSelectFurnizori(selectedId) {
    const sel = document.getElementById("in-fp-furnizor");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Alege furnizorul —</option>` +
        ZFlowStore.dateFurnizori.map(f =>
            `<option value="${f.id}" ${String(f.id) === String(selectedId) ? "selected" : ""}>${f.nume_firma || f.cui}</option>`
        ).join("");
}

// ==========================================
// ADAUGĂ FIRMĂ (Client / Furnizor / Ambele)
// ==========================================

/**
 * Deschide modalul unificat pentru firmă nouă
 */
function deschideFirmaNou() {
    ["fn-cui","fn-nume","fn-adresa","fn-contact","fn-tel","fn-email","fn-iban","fn-oras","fn-note"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    selectTipFirmaNou("client");
    document.getElementById("modal-firma-nou").classList.add("active");
}

/**
 * Selectează/schimbă tipul de firmă în modal-firma-nou
 */
function selectTipFirmaNou(tip) {
    document.querySelectorAll(".fn-tip-btn").forEach(btn => {
        const isActive = btn.dataset.tip === tip;
        btn.classList.toggle("bg-blue-900", isActive);
        btn.classList.toggle("text-white", isActive);
        btn.classList.toggle("shadow", isActive);
        btn.classList.toggle("text-slate-500", !isActive);
    });
}

/**
 * Lookup ANAF pentru câmpurile din modal-firma-nou
 */
async function autoCautareCUIFirmaNou() {
    const cuiRaw = document.getElementById("fn-cui").value;
    const cui = cuiRaw.replace(/\D/g, "");
    if (!cui || cui.length < 2) return showNotification("Introdu un CUI valid (doar cifrele)!", "warning");

    const anafUrl = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva";
    const dataAzi = new Date().toISOString().split("T")[0];
    const body = JSON.stringify([{ cui: parseInt(cui), data: dataAzi }]);
    const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

    const aplicaDate = (d) => {
        document.getElementById("fn-nume").value   = d.date_generale?.denumire || "";
        document.getElementById("fn-adresa").value = d.adresa_domiciliu_fiscal?.adresa || "";
        document.getElementById("fn-oras").value   = d.adresa_domiciliu_fiscal?.localitate || "";
    };

    setLoader(true);
    try {
        const r = await fetch(anafUrl, { method: "POST", headers: jsonHeaders, body, signal: AbortSignal.timeout(5000) });
        if (r.ok) {
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); setLoader(false); return; }
        }
    } catch (_) {}

    const edgeFnUrl = `${URL_Z}/functions/v1/anaf-proxy`;
    try {
        const r = await fetch(edgeFnUrl, { method: "POST", headers: { ...jsonHeaders, "Authorization": `Bearer ${KEY_Z}` }, body, signal: AbortSignal.timeout(8000) });
        if (r.ok) {
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); setLoader(false); return; }
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
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); setLoader(false); return; }
            else { showNotification(`CUI-ul ${cui} nu a fost găsit în baza ANAF.`, "warning"); setLoader(false); return; }
        } catch (_) {}
    }
    showNotification("Nu s-a putut contacta ANAF. Completează manual.", "warning");
    setLoader(false);
}

/**
 * Salvează firma nouă (Client / Furnizor / Ambele)
 */
async function salveazaFirmaNou() {
    const tipActiv = document.querySelector(".fn-tip-btn.bg-blue-900")?.dataset.tip || "client";
    const cui = document.getElementById("fn-cui").value.trim();
    const numeFirma = document.getElementById("fn-nume").value.trim();

    if (!cui || !numeFirma) {
        showNotification("❌ CUI-ul și Denumirea sunt obligatorii!", "error");
        return;
    }

    const payload = {
        cui,
        nume_firma: numeFirma,
        adresa: document.getElementById("fn-adresa").value.trim() || null,
        persoana_contact: document.getElementById("fn-contact").value.trim() || null,
        telefon: document.getElementById("fn-tel").value.trim() || null,
        contact_email: document.getElementById("fn-email").value.trim() || null,
        iban: document.getElementById("fn-iban").value.trim() || null,
        oras: document.getElementById("fn-oras").value.trim() || null,
        note: document.getElementById("fn-note").value.trim() || null,
        updated_at: new Date().toISOString()
    };

    setLoader(true);
    try {
        if (tipActiv === "client" || tipActiv === "ambele") {
            await ZFlowDB.insertClient(payload);
        }
        if (tipActiv === "furnizor" || tipActiv === "ambele") {
            await ZFlowDB.insertFurnizor(payload);
        }
        inchideModal("modal-firma-nou");
        const label = tipActiv === "ambele" ? "Client + Furnizor adăugat!" : tipActiv === "client" ? "Client adăugat!" : "Furnizor adăugat!";
        showNotification("✅ " + label, "success");
        await init(false);
    } catch (e) {
        showNotification("❌ Eroare: " + e.message, "error");
    } finally {
        setLoader(false);
    }
}

// ==========================================
// ADAUGĂ FACTURĂ (De Încasat / De Plătit)
// ==========================================

/**
 * Deschide modalul unificat pentru factură nouă
 */
function deschideFacturaNou() {
    // Reset câmpuri
    ["fn-fac-nr","fn-fac-val","fn-fac-note"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
    });
    ["fn-fac-emisie","fn-fac-scad"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
    });
    document.getElementById("display-fn-fac-emisie").innerText = "Alege data";
    document.getElementById("display-fn-fac-scad").innerText = "Alege data";

    // Populează selecturi
    const selClient = document.getElementById("fn-fac-client");
    if (selClient) {
        selClient.innerHTML = `<option value="">— Alege clientul —</option>` +
            ZFlowStore.dateLocal.map(c => `<option value="${c.id}">${c.nume_firma || c.cui}</option>`).join("");
    }
    const selFurnizor = document.getElementById("fn-fac-furnizor");
    if (selFurnizor) {
        selFurnizor.innerHTML = `<option value="">— Alege furnizorul —</option>` +
            ZFlowStore.dateFurnizori.map(f => `<option value="${f.id}">${f.nume_firma || f.cui}</option>`).join("");
    }

    comutaTipFacturaNou("incasat");
    document.getElementById("modal-factura-nou").classList.add("active");
}

/**
 * Comută tipul de factură în modal-factura-nou
 */
function comutaTipFacturaNou(tip) {
    document.querySelectorAll(".fn-fac-tip-btn").forEach(btn => {
        const isActive = btn.dataset.tip === tip;
        btn.classList.toggle("bg-blue-900", isActive);
        btn.classList.toggle("text-white", isActive);
        btn.classList.toggle("shadow", isActive);
        btn.classList.toggle("text-slate-500", !isActive);
    });
    document.getElementById("fn-fac-client-wrap").classList.toggle("hidden", tip !== "incasat");
    document.getElementById("fn-fac-furnizor-wrap").classList.toggle("hidden", tip !== "platit");
}

/**
 * Salvează factura nouă (de încasat sau de plătit)
 */
async function salveazaFacturaNou() {
    const tip = document.querySelector(".fn-fac-tip-btn.bg-blue-900")?.dataset.tip || "incasat";
    const nr = document.getElementById("fn-fac-nr").value.trim();
    const val = parseFloat(document.getElementById("fn-fac-val").value);
    const emisie = document.getElementById("fn-fac-emisie").value || null;
    const scad = document.getElementById("fn-fac-scad").value || null;
    const note = document.getElementById("fn-fac-note").value.trim() || null;

    if (!val || isNaN(val)) {
        showNotification("❌ Valoarea este obligatorie!", "error");
        return;
    }

    setLoader(true);
    try {
        if (tip === "incasat") {
            const clientId = document.getElementById("fn-fac-client").value;
            if (!clientId) { showNotification("❌ Selectează un client!", "error"); setLoader(false); return; }
            await ZFlowDB.insertFactura({
                client_id: clientId,
                nr_factura: nr || null,
                valoare: val,
                data_emitere: emisie,
                data_scadenta: scad,
                note,
                status_plata: "Neincasat",
                updated_at: new Date().toISOString()
            });
            showNotification("✅ Factură de încasat adăugată!", "success");
        } else {
            const furnizorId = document.getElementById("fn-fac-furnizor").value;
            if (!furnizorId) { showNotification("❌ Selectează un furnizor!", "error"); setLoader(false); return; }
            await ZFlowDB.insertFacturaPlatit({
                furnizor_id: furnizorId,
                nr_factura: nr || null,
                valoare: val,
                data_emitere: emisie,
                data_scadenta: scad,
                note,
                status_plata: "Neplatit",
                updated_at: new Date().toISOString()
            });
            showNotification("✅ Factură de plătit adăugată!", "success");
        }
        inchideModal("modal-factura-nou");
        await init(false);
    } catch (e) {
        showNotification("❌ Eroare: " + e.message, "error");
    } finally {
        setLoader(false);
    }
}

// ==========================================
// DASHBOARD HOME
// ==========================================

/**
 * Populează secțiunea Home cu KPI-uri, alerte și activitate recentă
 */
function incarcaDashboard() {
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

    const inUltimele30 = (f) => {
        const d = parseDataFactura(f.data_emiterii);
        return d && d >= acum30 && d <= azi;
    };

    // Filtrare comună pe ultimele 30 zile
    const facturiIncasat30 = facturiIncasat.filter(inUltimele30);
    const facturiPlatit30  = facturiPlatit.filter(inUltimele30);

    // KPI: Total facturat în ultimele 30 zile
    const totalFacturat = facturiIncasat30.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    // KPI: De încasat (restanțe clienți) — facturi neîncasate emise în ultimele 30 zile
    const neincasat = facturiIncasat30.filter(f => f.status_plata !== "Incasat").reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    // KPI: De plătit (datorii furnizori) — facturi neplătite emise în ultimele 30 zile
    const neplatit = facturiPlatit30.filter(f => f.status_plata !== "Platit").reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    // KPI: Cashflow net = intrări totale - ieșiri totale din ultimele 30 zile
    const intrari30 = facturiIncasat30.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    const iesiri30  = facturiPlatit30.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    const net = intrari30 - iesiri30;

    const fmt = (v) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(v);

    const setKPI = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setKPI("home-kpi-facturat", fmt(totalFacturat));
    setKPI("home-kpi-neincasat", fmt(neincasat));
    setKPI("home-kpi-neplatit", fmt(neplatit));
    // KPI Net — culoare dinamică
    const elNet = document.getElementById("home-kpi-net");
    if (elNet) {
        elNet.innerText = fmt(net);
        elNet.className = `text-lg font-black tabular-nums truncate ${net > 0 ? "text-emerald-600" : net < 0 ? "text-rose-600" : "text-slate-500"}`;
    }

    // Firma header
    const p = ZFlowStore.userProfile;
    if (p) {
        const numeParts = (p.nume_firma || "Z FLOW").split(" ");
        const initiale = numeParts.slice(0, 2).map(w => w[0]).join("").toUpperCase();
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setEl("home-firma-initiale", initiale);
        setEl("home-firma-nume", p.nume_firma || "—");
        setEl("home-firma-cui", p.cui ? "CUI: " + p.cui : "");
        setEl("home-firma-oras", p.oras || "");
        setEl("home-data-azi", new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    }

    // Alerte: facturi scadente sau depășite
    const scadenteClient = facturiIncasat.filter(f => {
        if (f.status_plata === "Incasat" || !f.data_scadenta) return false;
        const d = new Date(f.data_scadenta); d.setHours(0,0,0,0);
        return d <= azi;
    });
    const scadenteFurnizor = facturiPlatit.filter(f => {
        if (f.status_plata === "Platit" || !f.data_scadenta) return false;
        const d = new Date(f.data_scadenta); d.setHours(0,0,0,0);
        return d <= azi;
    });

    const alerteContainer = document.getElementById("home-alerte");
    if (alerteContainer) {
        const nrAlerte = scadenteClient.length + scadenteFurnizor.length;
        if (nrAlerte > 0) {
            alerteContainer.classList.remove("hidden");
            alerteContainer.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p class="text-xs font-black text-red-700 uppercase mb-2">⚠️ Alerte scadențe</p>
                  ${scadenteClient.length ? `<p class="text-[11px] text-red-600 font-semibold">${scadenteClient.length} factur${scadenteClient.length > 1 ? "i" : "ă"} de încasat depășit${scadenteClient.length > 1 ? "e" : "ă"}</p>` : ""}
                  ${scadenteFurnizor.length ? `<p class="text-[11px] text-red-600 font-semibold">${scadenteFurnizor.length} factur${scadenteFurnizor.length > 1 ? "i" : "ă"} de plătit depășit${scadenteFurnizor.length > 1 ? "e" : "ă"}</p>` : ""}
                </div>`;
        } else {
            alerteContainer.classList.add("hidden");
        }
        // Badge pe butonul Financiar
        const badge = document.getElementById("nav-badge-financiar");
        if (badge) {
            if (nrAlerte > 0) { badge.innerText = nrAlerte; badge.classList.remove("hidden"); }
            else { badge.classList.add("hidden"); }
        }
    }

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

    const canvas = document.getElementById("home-chart-cashflow");
    if (canvas) {
        if (window._homeCashflowChart) {
            window._homeCashflowChart.destroy();
            window._homeCashflowChart = null;
        }
        if (window._homeCashflowRAF) {
            cancelAnimationFrame(window._homeCashflowRAF);
            window._homeCashflowRAF = null;
        }
        window._homeCashflowRAF = requestAnimationFrame(() => {
            window._homeCashflowRAF = null;
            if (window._homeCashflowChart) {
                window._homeCashflowChart.destroy();
                window._homeCashflowChart = null;
            }
            window._homeCashflowChart = new Chart(canvas, {
                type: "bar",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Intrări",
                            data: datriIntrari,
                            backgroundColor: "rgba(16,185,129,0.72)",
                            borderColor: "transparent",
                            borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
                            borderSkipped: false,
                            order: 2,
                            yAxisID: "y",
                        },
                        {
                            label: "Ieșiri",
                            data: datriIesiri,
                            backgroundColor: "rgba(239,68,68,0.68)",
                            borderColor: "transparent",
                            borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
                            borderSkipped: false,
                            order: 2,
                            yAxisID: "y",
                        },
                        {
                            label: "Net",
                            type: "line",
                            data: datriNet,
                            borderColor: "rgba(99,102,241,0.9)",
                            backgroundColor: "rgba(99,102,241,0.07)",
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: "rgba(99,102,241,1)",
                            fill: true,
                            tension: 0.35,
                            order: 1,
                            yAxisID: "y",
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 500, easing: "easeOutQuart" },
                    interaction: { mode: "index", intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: "rgba(15,23,42,0.93)",
                            titleColor: "#94a3b8",
                            bodyColor: "#e2e8f0",
                            titleFont: { size: 10, weight: "700" },
                            bodyFont: { size: 11 },
                            padding: 12,
                            cornerRadius: 12,
                            boxPadding: 4,
                            callbacks: {
                                title: ctx => ctx[0].label,
                                label: ctx => {
                                    const icons = { "Intrări": "↑", "Ieșiri": "↓", "Net": "≈" };
                                    return `  ${icons[ctx.dataset.label] || ""} ${ctx.dataset.label}: ${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(ctx.raw)} RON`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            border: { display: false },
                            ticks: {
                                font: { size: 8, weight: "600" },
                                color: ctx => ctx.index === 29 ? "#1e3a5f" : "#94a3b8",
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 10,
                            }
                        },
                        y: {
                            grid: { color: "rgba(241,245,249,0.9)" },
                            border: { display: false },
                            ticks: {
                                font: { size: 8 },
                                color: "#cbd5e1",
                                maxTicksLimit: 5,
                                callback: v => v === 0 ? "0" : v >= 1000 ? (v / 1000).toFixed(0) + "k" : v
                            }
                        }
                    }
                }
            });
        });
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
    document.getElementById("display-fp-emisie").innerText = "Alege data";
    document.getElementById("display-fp-scadenta").innerText = "Alege data";

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
async function salveazaFacturaPlatit() {
    const id = document.getElementById("in-fp-id")?.value.trim();
    const furnizorId = document.getElementById("in-fp-furnizor")?.value.trim() ||
                       document.getElementById("in-fp-furnizor-id")?.value.trim();
    const val = parseFloat(document.getElementById("in-fp-val")?.value) || 0;

    if (!furnizorId) {
        showNotification("❌ Selectează furnizorul", "error");
        return;
    }
    if (val <= 0) {
        showNotification("❌ Completează valoarea facturii", "error");
        return;
    }

    setLoader(true);
    try {
        const payload = {
            furnizor_id: furnizorId,
            numar_factura: document.getElementById("in-fp-nr")?.value.trim() || null,
            valoare: val,
            data_emiterii: document.getElementById("in-fp-emisie")?.value || null,
            data_scadenta: document.getElementById("in-fp-scad")?.value || null,
            note: document.getElementById("in-fp-note")?.value.trim() || null,
            status_plata: "Neplatit",
            updated_at: new Date().toISOString()
        };

        if (id) {
            await ZFlowDB.updateFacturaPlatit(id, payload);
            showNotification("✅ Factură actualizată!", "success");
        } else {
            await ZFlowDB.insertFacturaPlatit(payload);
            showNotification("✅ Factură adăugată!", "success");
        }

        inchideModal("modal-factura-platit");

        // Reîncarcă
        const fp = await ZFlowDB.fetchFacturiPlatit();
        ZFlowStore.dateFacturiPlatit = fp || [];
        const azi = new Date(); azi.setHours(0,0,0,0);
        ZFlowStore.dateFurnizori = ZFlowStore.dateFurnizori.map(furn => {
            const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
            const sold = fps.filter(fp2 => fp2.status_plata !== "Platit").reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
            const sumaScadenta = fps.reduce((acc, fac) => {
                if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                    const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0);
                    if (d < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            return { ...furn, facturi: fps, sold, sumaScadenta };
        });
        renderFurnizori();
        updateFurnizoriKPI();
        if (ZFlowStore.selectedFurnizorId) arataDetaliiFurnizor(ZFlowStore.selectedFurnizorId);
    } catch (err) {
        showNotification("❌ Eroare: " + err.message, "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Șterge factură de plătit din modal
 */
function stergeFacturaPlatitModal() {
    const id = document.getElementById("in-fp-id")?.value;
    if (!id) return;
    deschideModalConfirm(
        "Ștergi această factură de plătit?",
        async () => {
            setLoader(true);
            try {
                await ZFlowDB.deleteFacturaPlatit(id);
                inchideModal("modal-factura-platit");
                const fp = await ZFlowDB.fetchFacturiPlatit();
                ZFlowStore.dateFacturiPlatit = fp || [];
                const azi = new Date(); azi.setHours(0,0,0,0);
                ZFlowStore.dateFurnizori = ZFlowStore.dateFurnizori.map(furn => {
                    const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
                    const sold = fps.filter(fp2 => fp2.status_plata !== "Platit").reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
                    const sumaScadenta = fps.reduce((acc, fac) => {
                        if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                            const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0);
                            if (d < azi) return acc + (Number(fac.valoare) || 0);
                        }
                        return acc;
                    }, 0);
                    return { ...furn, facturi: fps, sold, sumaScadenta };
                });
                renderFurnizori();
                updateFurnizoriKPI();
                if (ZFlowStore.selectedFurnizorId) arataDetaliiFurnizor(ZFlowStore.selectedFurnizorId);
                showNotification("✅ Factură ștearsă!", "success");
            } catch (err) {
                showNotification("❌ Eroare: " + err.message, "error");
            } finally {
                setLoader(false);
            }
        }
    );
}

// ==========================================
// CASHFLOW ANALIZĂ
// ==========================================

/**
 * Calculează și afișează cashflow-ul în cardul din view-analiza.
 * Preia aceleași filtre de dată și selecție ca genereazaBI().
 * Sincronizat cu perioada și clienții/furnizorii selectați.
 */
function calculeazaCashflow() {
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
    const activeClientIds = selectedClientIds.length > 0 ? selectedClientIds : allClientIds;

    // Obține furnizorii selectați din checkboxes (sincronizare cu rapoarte)
    const selectedFurnizorIds = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
    const allFurnizorIds = (ZFlowStore.dateFurnizori || []).map(f => String(f.id));
    const activeFurnizorIds = selectedFurnizorIds.length > 0 ? selectedFurnizorIds : allFurnizorIds;

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

    const net = intrari - iesiri;
    const fmt = (v) => `${Math.round(Math.abs(v)).toLocaleString()} lei`;

    const cfIntrari = document.getElementById("cf-intrari");
    const cfIesiri = document.getElementById("cf-iesiri");
    const cfNet = document.getElementById("cf-net");

    if (cfIntrari) cfIntrari.innerText = tip === 'furnizori' ? '—' : fmt(intrari);
    if (cfIesiri) cfIesiri.innerText = tip === 'clienti' ? '—' : fmt(iesiri);
    if (cfNet) {
        cfNet.innerText = tip === 'ambele' ? (net >= 0 ? '+' : '−') + " " + fmt(net) : '—';
        cfNet.className = `text-[0.875rem] font-semibold tabular-nums leading-tight ${net >= 0 ? "text-emerald-600" : "text-red-600"}`;
    }
}

function filtreazaListaFirme() {
    filtreazaListaFirmeDebounced();
}

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
    // Clienți
    document.querySelectorAll("#container-bi-checks label").forEach(label => {
        const text = label.textContent.toLowerCase();
        label.style.display = !term || text.includes(term) ? "" : "none";
    });
    // Furnizori
    document.querySelectorAll("#container-bi-furnizori-checks label").forEach(label => {
        const text = label.textContent.toLowerCase();
        label.style.display = !term || text.includes(term) ? "" : "none";
    });
}

// ==========================================
// DETALII CLIENT & FACTURI
// ==========================================

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

    const sagaBadge = (fac.is_imported || fac.id_descarcare_anaf) ? `
        <div class="absolute top-2 right-2 z-10 flex items-center gap-1 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-full">
            <svg class="w-2.5 h-2.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            <span class="text-[8px] font-black text-violet-700 uppercase tracking-wide">SAGA</span>
        </div>` : '';

    return `
    <div class="card-factura-client swipeable-card rounded-2xl shadow-sm mb-3 relative overflow-hidden" data-nr="${fac.numar_factura}" data-factura-id="${fac.id}" data-status="${fac.status_plata}">
        ${sagaBadge}
        <!-- Swipe Action Left (Delete) -->
        <div class="swipe-actions swipe-action-left">
            <button class="swipe-action-btn" onclick="swipeStergeFactura('${fac.id}')">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span>Șterge</span>
            </button>
        </div>
        <!-- Swipe Action Right (Toggle Payment) -->
        <div class="swipe-actions swipe-action-right">
            <button class="swipe-action-btn" onclick="swipeToggleIncasare('${fac.id}', '${fac.status_plata}')">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>${isIncasat ? 'Anulează' : 'Încasare'}</span>
            </button>
        </div>
        <!-- Card Content -->
        <div class="swipe-content card-flow flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-2xl">
            <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2 bg-slate-50 border border-slate-100 px-2 py-2 rounded-xl">
                    <span class="flex h-2 w-2 relative">
                        <span class="relative inline-flex rounded-full h-2 w-2 ${fac.status_anaf === 'validated' ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
                    </span>
                    <span class="text-[9px] font-black uppercase tracking-tighter ${fac.status_anaf === 'validated' ? 'text-emerald-700' : 'text-amber-700'}">
                        ${fac.status_anaf === 'validated' ? 'SPV VALIDAT' : 'SPV AȘTEPTARE'}
                    </span>
                </div>
                ${uitHtml}
            </div>

            <div class="flex justify-between items-center py-1">
                <div>
                    <h4 class="font-black text-slate-800 text-[15px]">#${fac.numar_factura || 'N/A'}</h4>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">Emis: ${formateazaDataZFlow(fac.data_emiterii)}</p>
                </div>
                <div class="text-right">
                    <p class="font-black ${esteScadenta ? 'text-red-600 animate-pulse' : 'text-blue-900'} text-[18px] leading-none tracking-tighter">
                        ${Number(fac.valoare || 0).toLocaleString()} lei
                    </p>
                    <p class="text-[9px] font-black text-slate-300 uppercase mt-1">Scadență: ${formateazaDataZFlow(fac.data_scadenta)}</p>
                </div>
            </div>

            ${fac.note ? `
            <div class="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <svg class="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
                <p class="text-[10px] font-medium text-amber-800 leading-snug">${fac.note}</p>
            </div>` : ''}

            <div class="flex flex-col gap-2 mt-1">
                <button onclick="toggleStatusPlata('${fac.id}', '${fac.status_plata}')"
                        class="w-full ${isIncasat ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-blue-900 text-white hover:bg-blue-800'} h-11 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                    ${isIncasat ? 'ACHITAT' : 'NEACHITAT'}
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
                <button onclick="event.stopPropagation(); trimiteEmailDebitor('${f.contact_email}', '${fac.numar_factura}', '${fac.valoare}')"
                        class="h-11 ${esteScadenta ? 'bg-red-600 text-white animate-pulse hover:bg-red-700' : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600'} rounded-xl flex items-center justify-center transition-all"
                        title="Trimite Email">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0l-9.75 6.75-9.75-6.75m19.5 0l-9.75-6.75" /></svg>
                </button>
                <button onclick="event.stopPropagation(); trimiteWhatsAppReminder('${f.telefon || ''}', '${f.nume_firma || ''}', '${fac.numar_factura}', '${fac.valoare}', '${fac.data_scadenta || ''}')"
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
        <h2 class="text-2xl font-black uppercase tracking-tight leading-tight">${f.nume_firma || f.cui}</h2>
        <p class="text-[11px] opacity-70 uppercase mt-1 font-bold tracking-widest text-blue-200">CUI: ${f.cui}</p>
        <div class="mt-4">
            <p class="text-[9px] font-bold opacity-50 uppercase tracking-widest">Sold de Încasat</p>
            <p class="text-3xl font-black text-white tracking-tighter">${Math.round(f.sold).toLocaleString()} lei</p>
        </div>
        ${areScadenta ? `
        <div class="mt-6 py-3 px-4 bg-red-500/20 rounded-2xl border border-red-400/50 flex justify-between items-center animate-pulse">
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
                    <p class="text-[11px] font-bold text-slate-700 truncate">#${fac.numar_factura}</p>
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

    // Sortare Facturi
    const facturiSortate = [...f.facturi].sort((a, b) => {
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

    // Generare HTML Facturi - cu Lazy Loading (#6 TODO)
    // Salvăm facturile sortate pentru Load More
    ZFlowStore.facturiSortateClient = facturiSortate;
    ZFlowStore.facturiLoadedCount = Math.min(facturiSortate.length, ZFlowStore.facturiPerPage);
    ZFlowStore.facturiTotalCount = facturiSortate.length;
    ZFlowStore.hasMoreFacturi = facturiSortate.length > ZFlowStore.facturiPerPage;
    
    // Afișăm doar primele N facturi inițial
    const facturiDeAfisat = facturiSortate.slice(0, ZFlowStore.facturiPerPage);
    
    // Folosim funcția helper pentru generarea cardurilor cu suport swipe
    const htmlFacturi = facturiDeAfisat.map((fac) => genereazaCardFactura(fac, f, azi)).join("");

    // Bară de Căutare Sticky & Rezultate
    containerFacturi.innerHTML = `
        <div class="sticky top-0 bg-[#f1f5f9]/95 backdrop-filter backdrop-blur-md z-30 pb-4 pt-2">
            <div class="relative">
                <input type="text" id="search-facturi-detaliu" oninput="filtreazaFacturiInDetalii()" placeholder="Caută nr. factură..." class="w-full h-12 pl-12 bg-white rounded-2xl border border-slate-200 text-[13px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                <div class="absolute left-4 top-3.5 text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
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
        const nrFactura = card.getAttribute("data-nr") ? card.getAttribute("data-nr").toLowerCase() : "";

        if (nrFactura.includes(termen)) {
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
function loadMoreFacturiClient() {
    if (!ZFlowStore.facturiSortateClient || !ZFlowStore.hasMoreFacturi) return;
    
    const f = ZFlowStore.dateLocal.find((x) => String(x.id) === String(ZFlowStore.selectedClientId));
    if (!f) return;
    
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);
    
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
    ZFlowStore.hasMoreFacturi = end < ZFlowStore.facturiTotalCount;
    
    // Actualizăm sau ascundem butonul
    const loadMoreDiv = document.getElementById("load-more-facturi");
    if (loadMoreDiv) {
        if (ZFlowStore.hasMoreFacturi) {
            loadMoreDiv.querySelector("button").innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                Încarcă mai multe (${ZFlowStore.facturiLoadedCount}/${ZFlowStore.facturiTotalCount})`;
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
            ZFlowStore.dateLocal.map((f) => `<option value="${f.id}">${f.nume_firma || f.cui}</option>`).join("");
    }

    // Checkbox-uri clienți pentru analiză
    const containerBI = document.getElementById("container-bi-checks");
    if (containerBI) {
        containerBI.innerHTML = ZFlowStore.dateLocal
            .map((f) => `
                <label class="flex justify-between items-center p-4 bg-slate-50 rounded-xl mb-1 text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                    <span>${f.nume_firma || f.cui}</span>
                    <input type="checkbox" value="${f.id}" checked
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
                <label class="flex justify-between items-center p-4 bg-red-50 rounded-xl mb-1 text-[10px] font-bold uppercase cursor-pointer hover:bg-red-100 transition-colors">
                    <span>${f.nume_firma || f.cui}</span>
                    <input type="checkbox" value="${f.id}" checked
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
            new Notification(`🔴 ${restante.length} Facturi Restante — Z-FLOW`, {
                body: restante.slice(0, 3).map(f => {
                    const c = ZFlowStore.dateLocal.find(cl => String(cl.id) === String(f.client_id));
                    return `Factura ${f.numar_factura} · ${c?.nume_firma || ''} · ${f.data_scadenta}`.trim();
                }).join('\n') + (restante.length > 3 ? `\n...si inca ${restante.length - 3}` : ''),
                icon: 'icons/icon.svg',
                tag: 'zflow-restante'
            });
        } catch(e) { console.warn('Notif error:', e); }
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
        } catch(e) { console.warn('Notif error:', e); }
    });

    if (scadenteMaine.length > 0) {
        try {
            new Notification(`⚡ ${scadenteMaine.length} Scadențe Mâine — Z-FLOW`, {
                body: scadenteMaine.map(f => {
                    const c = ZFlowStore.dateLocal.find(cl => String(cl.id) === String(f.client_id));
                    return `Factura ${f.numar_factura} · ${c?.nume_firma || ''}`.trim();
                }).join('\n'),
                icon: 'icons/icon.svg',
                tag: 'zflow-scad-maine'
            });
        } catch(e) { console.warn('Notif error:', e); }
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
            showNotification('✅ Notificări activate! Vei fi anunțat la scadențe.', 'success');
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
    showNotification('🔔 Notificările sunt active', 'info');
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
    console.log("🔍 Filtrare BI - Start:", startVal, "End:", endVal, "Clienți selectați:", ids.length, "Total facturi:", ZFlowStore.dateFacturiBI.length);
    
    // Log primele 3 facturi pentru debug
    if (ZFlowStore.dateFacturiBI.length > 0) {
        console.log("📋 Sample facturi (primele 3):");
        ZFlowStore.dateFacturiBI.slice(0, 3).forEach((f, i) => {
            console.log(`  ${i+1}. data_emiterii: "${f.data_emiterii}", created_at: "${f.created_at}", nr: ${f.numar_factura}`);
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

    console.log("✅ Facturi filtrate:", filtrate.length);

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
    const totalPages = Math.ceil(filtrate.length / ZFlowStore.biPageSize) || 1;
    if (ZFlowStore.biCurrentPage > totalPages) ZFlowStore.biCurrentPage = totalPages;
    const pageInfo = document.getElementById("bi-page-info");
    if (pageInfo) pageInfo.innerText = `Pagina ${ZFlowStore.biCurrentPage} din ${totalPages} (${filtrate.length} facturi)`;

    if (filtrate.length === 0) {
        showEmptyState(container, "Niciun rezultat", "Nu există facturi pentru perioada și filtrele selectate. Modifică intervalul de date sau clienții selectați.", "period");
        if (ZFlowStore.filtruStatusBI === 'toate') {
            appendFurnizoriBI(container, startDate, endDate, q);
        }
        calculeazaCashflow();
        return;
    }

    const startIdx = (ZFlowStore.biCurrentPage - 1) * ZFlowStore.biPageSize;
    const endIdx = startIdx + ZFlowStore.biPageSize;
    const paginatedData = filtrate.slice(startIdx, endIdx);

    container.innerHTML = paginatedData.map((f) => {
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
                <span class="text-[10px] font-black text-slate-800 uppercase truncate">${client?.nume_firma || 'Client'}</span>
                ${pdfLink}
              </div>
              <span class="text-[8px] text-slate-400 font-semibold">#${f.numar_factura} &middot; ${formateazaDataZFlow(f.data_emiterii)}${f.data_scadenta ? ' &middot; S: ' + formateazaDataZFlow(f.data_scadenta) : ''}</span>
            </div>
            <b class="text-[0.875rem] font-semibold flex-shrink-0 ${isIncasat ? 'text-blue-900' : 'text-red-600'} tabular-nums">${Number(f.valoare).toLocaleString()} lei</b>
        </div>`;
    }).join("");

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

    const ids = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
    const allIds = ZFlowStore.dateFurnizori.map(f => String(f.id));
    const activeIds = ids.length > 0 ? ids : allIds;

    const filtrate = _filtreazaFacturiPlatit(startDate, endDate, activeIds, q);

    // Update totals display
    const sumaClienti = document.getElementById("suma-selectata-bi");
    const sumaFurnizori = document.getElementById("suma-platit-bi");
    if (sumaClienti) sumaClienti.innerText = "0 lei";
    const total = filtrate.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    if (sumaFurnizori) sumaFurnizori.innerText = `${Math.round(total).toLocaleString()} lei`;

    if (filtrate.length === 0) {
        showEmptyState(container, "Niciun rezultat", "Nu există facturi de plătit pentru filtrele selectate.", "period");
        return;
    }
    container.innerHTML = _htmlFurnizoriRows(filtrate, azi);
}

/**
 * Adaugă furnizori rows după clienți rows (mode ambele)
 */
function appendFurnizoriBI(container, startDate, endDate, q) {
    const sumaPlatit2 = document.getElementById("suma-platit-bi");

    const ids = Array.from(document.querySelectorAll("#container-bi-furnizori-checks input:checked")).map(i => String(i.value));
    const allIds = ZFlowStore.dateFurnizori.map(f => String(f.id));
    const activeIds = ids.length > 0 ? ids : allIds;

    if (activeIds.length === 0) return;

    const azi = new Date(); azi.setHours(0,0,0,0);
    const filtrate = _filtreazaFacturiPlatit(startDate, endDate, activeIds, q);

    const total2 = filtrate.reduce((s, f) => s + (Number(f.valoare) || 0), 0);
    if (sumaPlatit2) sumaPlatit2.innerText = `${Math.round(total2).toLocaleString()} lei`;
    if (filtrate.length === 0) return;

    // Separator + furnizori rows
    container.innerHTML += `
<div class="w-full flex items-center gap-3 my-4">
  <div class="flex-1 h-px bg-red-100"></div>
  <span class="text-[9px] font-black text-red-600 uppercase tracking-widest px-2 py-1 bg-red-50 rounded-full">Furnizori — Facturi de Plătit (${filtrate.length})</span>
  <div class="flex-1 h-px bg-red-100"></div>
</div>
${_htmlFurnizoriRows(filtrate, azi)}`;
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
        const furnizor = ZFlowStore.dateFurnizori.find(furn => String(furn.id) === String(f.furnizor_id));
        const isPlatit = f.status_plata === "Platit";
        const isDepasit = !isPlatit && f.data_scadenta && new Date(f.data_scadenta).setHours(0,0,0,0) < azi;
        return `<div class="flex items-center gap-2 px-3 py-2 rounded-xl mb-1 border ${isPlatit ? 'bg-white border-slate-100' : 'bg-red-50/40 border-red-100'} hover:shadow-sm transition-all" data-furnizor-id="${f.furnizor_id}" data-fp-id="${f.id}">
    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPlatit ? 'bg-emerald-400' : isDepasit ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}"></span>
    <div class="flex-1 min-w-0">
        <span class="text-[10px] font-black text-slate-800 uppercase truncate block">${furnizor?.nume_firma || 'Furnizor'}</span>
        <span class="text-[8px] text-slate-400 font-semibold">#${f.numar_factura || '—'} &middot; ${formateazaDataZFlow(f.data_emiterii)}${f.data_scadenta ? ' &middot; S: ' + formateazaDataZFlow(f.data_scadenta) : ''}</span>
    </div>
    <b class="text-[0.875rem] font-semibold flex-shrink-0 ${isPlatit ? 'text-blue-900' : 'text-red-600'} tabular-nums">${Number(f.valoare).toLocaleString()} lei</b>
    <button onclick="event.stopPropagation(); toggleStatusPlatit('${f.id}', '${f.status_plata}')"
            class="w-6 h-6 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${isPlatit ? 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
    </button>
</div>`;
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

// ==========================================
// BULK ACTIONS (#14 TODO)
// ==========================================

/**
 * Activează/dezactivează modul de selecție multiplă
 */
function toggleBulkMode() {
    ZFlowStore.bulkMode = !ZFlowStore.bulkMode;
    ZFlowStore.bulkSelectedFacturi = [];

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
        showNotification("⛔ Nu ai permisiunea de a edita facturi", "error");
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
            
            // Update local
            const factura = ZFlowStore.dateFacturiBI.find(f => String(f.id) === String(facturaId));
            if (factura) {
                factura.status_plata = "Incasat";
                factura.data_incasarii = new Date().toISOString().split('T')[0];
            }
            success++;
        } catch (err) {
            console.error("Eroare bulk update:", err);
            failed++;
        }
    }
    
    setLoader(false);
    ZFlowStore.bulkSelectedFacturi = [];
    toggleBulkMode();
    genereazaBI();
    updateDashboardKPI();
    
    if (failed === 0) {
        showNotification(`✅ ${success} facturi marcate ca încasate`, "success");
    } else {
        showNotification(`${success} reușite, ${failed} eșuate`, "warning");
    }
}

/**
 * Export PDF pentru facturi SELECTATE (bulk mode)
 * Apelată de exportaPDF() când există selecție
 */
function exportaPDFSelectie() {
    const facturiSelectate = ZFlowStore.dateFacturiBI.filter(f => 
        ZFlowStore.bulkSelectedFacturi.includes(String(f.id))
    );
    
    if (facturiSelectate.length === 0) {
        showNotification("Nicio factură selectată", "warning");
        return;
    }
    
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
        headStyles: { fillColor: [30, 58, 138], fontSize: 8, halign: "center" },
        styles: { fontSize: 7, cellPadding: 2, halign: "center" },
        columnStyles: {
            0: { cellWidth: 40, halign: "center" },
            1: { cellWidth: 30, halign: "center" },
            2: { cellWidth: 22, halign: "center" },
            3: { cellWidth: 22, halign: "center" },
            4: { cellWidth: 30, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 25, halign: "center", fontStyle: "bold" },
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
function exportaExcelSelectie() {
    const facturiSelectate = ZFlowStore.dateFacturiBI.filter(f => 
        ZFlowStore.bulkSelectedFacturi.includes(String(f.id))
    );
    
    if (facturiSelectate.length === 0) {
        showNotification("Nicio factură selectată", "warning");
        return;
    }
    
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
    XLSX.writeFile(wb, `facturi_selectie_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotification(`📊 Excel generat cu ${facturiSelectate.length} facturi selectate`, "success");
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
            document.getElementById("in-fac-emisie").value = new Date().toISOString().split("T")[0];
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
    const zone = document.getElementById('pdf-drop-zone');
    const fileInput = document.getElementById('in-fac-file');
    const label = document.getElementById('pdf-drop-label');
    const filesList = document.getElementById('pdf-files-list');
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
        showNotification('🗑️ Atașament șters', 'success');
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
        alert("Eroare: Nu am putut identifica clientul pentru această factură.");
    }
}

// ==========================================
// OPERAȚIUNI CRUD
// ==========================================

/**
 * Logică UIT (pentru transporturi >10000)
 */
function logicUIT(v) {
    const uitBox = document.getElementById("uit-trigger-box");
    if (uitBox) uitBox.classList.toggle("hidden", Number(v) < 10000);
}

/**
 * Salvează client
 */
async function salveazaClient() {
    if (!hasPermission('canEdit')) {
        showNotification("⛔ Nu ai permisiunea de a edita clienți", "error");
        return;
    }
    const id = document.getElementById("in-client-id").value;

    const dateFirma = {
        nume_firma: document.getElementById("in-nume").value,
        cui: document.getElementById("in-cui").value,
        oras: document.getElementById("in-oras").value,
        adresa: document.getElementById("in-adresa").value,
        persoana_contact: document.getElementById("in-contact").value,
        telefon: document.getElementById("in-tel").value,
        contact_email: document.getElementById("in-email").value,
        iban: document.getElementById("in-iban").value,
    };

    const cuiRegex = /^\d{1,10}$/;
    if (!dateFirma.nume_firma || !dateFirma.cui) return alert("Denumirea și CUI-ul sunt obligatorii!");
    if (!cuiRegex.test(dateFirma.cui.toString().trim())) return alert("❌ CUI-ul invalid: doar cifre (2-10 caractere)");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (dateFirma.contact_email && !emailRegex.test(dateFirma.contact_email.trim())) {
        if (!confirm("Email nevalid. Continuați oricum?")) return;
    }

    setLoader(true);
    try {
        if (id) {
            await ZFlowDB.updateClient(id, dateFirma);
        } else {
            await ZFlowDB.insertClient(dateFirma);
        }

        inchideModal("modal-client");
        await init();
        if (id) arataDetalii(id);
    } catch (e) {
        console.error("Eroare Supabase:", e);
        alert("Eroare Schema: " + e.message);
    } finally {
        setLoader(false);
    }
}

/**
 * Salvează factură
 */
async function salveazaFacturaOrchestrator() {
    if (!hasPermission('canEdit')) {
        showNotification("⛔ Nu ai permisiunea de a edita facturi", "error");
        return;
    }
    const id = document.getElementById("in-fac-id").value;

    // Guard facturi importate din SAGA / ANAF
    if (id) {
        const fExist = ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(id));
        if (fExist && (fExist.is_imported || fExist.id_descarcare_anaf)) {
            showNotification("⛔ Factura este importată din SAGA/ANAF și nu poate fi modificată din aplicație", "error", 5000);
            return;
        }
    }
    const cid = document.getElementById("in-fac-client").value;
    const nr = document.getElementById("in-fac-nr").value;
    const val = document.getElementById("in-fac-val").value;
    const de = document.getElementById("in-fac-emisie").value;
    const ds = document.getElementById("in-fac-scad").value;
    const auto = document.getElementById("in-auto").value;
    const note = document.getElementById("in-fac-note")?.value || "";
    const fileInput = document.getElementById("in-fac-file");

    if (!cid || !nr || !val) return alert("Selectează clientul, seria și suma!");

    setLoader(true);
    try {
        // #23 - Upload toate fișierele pending
        let newUrls = [];
        if (pendingPDFFiles.length > 0) {
            for (let i = 0; i < pendingPDFFiles.length; i++) {
                const uploadedUrl = await ZFlowDB.uploadFacturaPDF(pendingPDFFiles[i], nr, i);
                if (uploadedUrl) newUrls.push(uploadedUrl);
            }
        }

        const payload = {
            client_id: cid,
            numar_factura: nr,
            valoare: parseFloat(val),
            data_emiterii: de || new Date().toISOString().split("T")[0],
            data_scadenta: ds,
            numar_auto: auto,
            note: note.trim() || null,
        };

        // Salvează URL-urile: îmbină cele existente cu cele noi (#23)
        if (newUrls.length > 0) {
            const facExistenta = id ? ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(id)) : null;
            const existingUrls = facExistenta ? _getPDFUrls(facExistenta) : [];
            const allUrls = [...existingUrls, ...newUrls];
            payload.pdf_url = allUrls.length === 1 ? allUrls[0] : JSON.stringify(allUrls);
        }
        // Dacă 0 fișiere noi → nu atingem pdf_url existent (la editare rămâne intact)

        if (id) {
            await ZFlowDB.updateFactura(id, payload);
        } else {
            payload.status_plata = "Neincasat";
            await ZFlowDB.insertFactura(payload);
        }

        fileInput.value = "";
        pendingPDFFiles = []; // #23 - reset după salvare
        inchideModal("modal-factura");
        await init();
        if (cid) arataDetalii(cid);
    } catch (err) {
        console.error("Eroare salvare:", err);
        alert("Eroare: " + err.message);
    } finally {
        setLoader(false);
    }
}

/**
 * Toggle status plată factură
 */
async function toggleStatusPlata(id, currentStatus) {
    const f = ZFlowStore.dateFacturiBI.find((x) => String(x.id) === String(id));

    if (f && (f.is_imported || f.id_descarcare_anaf)) {
        return alert("SAGA factură - Nu poate fi modificată");
    }

    const noulStatus = currentStatus === "Incasat" ? "Neincasat" : "Incasat";

    const doToggle = async () => {
        const updatePayload = {
            status_plata: noulStatus,
            data_plata: noulStatus === "Incasat" ? new Date().toISOString().split("T")[0] : null
        };
        setLoader(true);
        try {
            await ZFlowDB.updateFactura(id, updatePayload);
            await init();
            saveZFlowData();
            if (f) arataDetalii(f.client_id);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoader(false);
        }
    };

    if (noulStatus === "Incasat") {
        showConfirmModal(
            "⚠️ Atenție: Această aplicație este un instrument de suport. Marcând factura ca ACHITATĂ, datele pot diferi față de programul de contabilitate (Saga sau alt soft). Continui?",
            doToggle
        );
    } else {
        await doToggle();
    }
}

// ==========================================
// MODAL CONFIRMARE STYLED
// ==========================================
let confirmCallback = null;

/**
 * Afișează modal de confirmare styled
 */
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("modal-confirm");
    const msgEl = document.getElementById("confirm-message");
    const btnConfirm = document.getElementById("btn-confirm-action");
    
    if (msgEl) msgEl.innerText = message;
    confirmCallback = onConfirm;
    
    // Reset și setează handler
    if (btnConfirm) {
        btnConfirm.onclick = async () => {
            if (confirmCallback) {
                await confirmCallback();
                confirmCallback = null;
            }
            inchideModalConfirm();
        };
    }
    
    if (modal) modal.classList.add("active");
}

/**
 * Închide modal confirmare
 */
function inchideModalConfirm() {
    const modal = document.getElementById("modal-confirm");
    if (modal) modal.classList.remove("active");
    confirmCallback = null;
}

/**
 * Șterge factură
 */
async function stergeFactura(id) {
    if (!hasPermission('canDelete')) {
        showNotification("⛔ Nu ai permisiunea de a șterge facturi", "error");
        return;
    }
    // Guard facturi importate din SAGA / ANAF
    const fExist = ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(id));
    if (fExist && (fExist.is_imported || fExist.id_descarcare_anaf)) {
        showNotification("⛔ Factura este importată din SAGA/ANAF și nu poate fi ștearsă din aplicație", "error", 5000);
        return;
    }
    showConfirmModal("Ștergi factura definitiv? Această acțiune nu poate fi anulată.", async () => {
        await ZFlowDB.deleteFactura(id);
        init();
        comutaVedereFin("firme");
    });
}

/**
 * Șterge client
 */
async function stergeFirma(id) {
    if (!hasPermission('canDelete')) {
        showNotification("⛔ Nu ai permisiunea de a șterge clienți", "error");
        return;
    }
    showConfirmModal("Ștergi clientul definitiv? Toate facturile asociate vor fi orfane.", async () => {
        await ZFlowDB.deleteClient(id);
        init();
        comutaVedereFin("firme");
    });
}

// ==========================================
// IMPORT / EXPORT
// ==========================================

/**
 * Import date din CSV (SAGA)
 */
async function importaDateSaga() {
    console.log("🔄 importaDateSaga() apelat");
    console.log("🔐 Permisiune canImport:", hasPermission('canImport'));
    console.log("🔐 Rol curent:", ZFlowStore.userRole);
    
    if (!hasPermission('canImport')) {
        showNotification("⛔ Nu ai permisiunea de a importa date", "error");
        return;
    }
    
    console.log("📂 Se deschide dialog selectare fișier...");
    
    let fileInput = document.getElementById("import-saga-file");
    if (!fileInput) {
        console.log("📂 Creez input file nou");
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "import-saga-file";
        fileInput.accept = ".csv,.xlsx";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        fileInput.addEventListener("change", async function (e) {
            console.log("📂 Fișier selectat:", e.target.files[0]?.name);
            const file = e.target.files[0];
            if (!file) return;

            setLoader(true);
            try {
                const text = await file.text();
                const linii = text.split("\n").filter(l => l.trim());
                
                console.log("📂 Import CSV - Total linii:", linii.length);
                console.log("📂 Prima linie (header):", linii[0]);
                console.log("📂 Clienți disponibili:", ZFlowStore.dateLocal.length);
                console.log("📂 CUI-uri clienți:", ZFlowStore.dateLocal.map(c => c.cui));

                let importate = 0;
                let erori = [];
                
                for (let i = 1; i < linii.length; i++) {
                    const linie = linii[i].trim();
                    if (!linie) continue;
                    
                    const cols = linie.split(/[,;]/);
                    if (cols.length < 3) {
                        console.warn(`Linia ${i} - coloane insuficiente:`, cols);
                        continue;
                    }

                    const cui = cols[0]?.trim().replace(/"/g, "");
                    const nrFactura = cols[1]?.trim().replace(/"/g, "");
                    const valoare = parseFloat(cols[2]?.trim().replace(/"/g, "").replace(",", ".")) || 0;
                    const dataEmiterii = cols[3]?.trim().replace(/"/g, "") || new Date().toISOString().split("T")[0];
                    const dataScadenta = cols[4]?.trim().replace(/"/g, "") || null;

                    // Căutare client cu logging - caută după CUI sau nume_firma
                    const client = ZFlowStore.dateLocal.find(c => {
                        const cuiClient = String(c.cui || "").trim().toLowerCase();
                        const numeClient = String(c.nume_firma || "").trim().toLowerCase();
                        const cuiCSV = String(cui).trim().toLowerCase();
                        return cuiClient === cuiCSV || numeClient === cuiCSV;
                    });
                    
                    if (!client) {
                        console.warn(`Linia ${i} - Client negăsit pentru CUI/Nume: "${cui}"`);
                        erori.push(`CUI/Nume ${cui} negăsit`);
                        continue;
                    }

                    // Verifică dacă factura există deja (evită duplicate)
                    const facturaExistenta = ZFlowStore.dateFacturiBI.find(f => 
                        String(f.client_id) === String(client.id) && 
                        String(f.numar_factura).trim().toLowerCase() === String(nrFactura).trim().toLowerCase()
                    );
                    
                    if (facturaExistenta) {
                        console.warn(`⚠️ Factură duplicat ignorată: ${nrFactura} pentru ${client.nume_firma}`);
                        erori.push(`Duplicat: ${nrFactura}`);
                        continue;
                    }

                    try {
                        await ZFlowDB.insertFactura({
                            client_id: client.id,
                            numar_factura: nrFactura,
                            valoare: valoare,
                            data_emiterii: dataEmiterii,
                            data_scadenta: dataScadenta,
                            status_plata: "Neincasat",
                            is_imported: true
                        });
                        importate++;
                        console.log(`✓ Factură ${nrFactura} importată pentru ${client.nume_firma}`);
                    } catch (insertErr) {
                        console.error(`Eroare inserare factură ${nrFactura}:`, insertErr);
                        erori.push(`Eroare inserare ${nrFactura}`);
                    }
                }

                localStorage.setItem("lastSagaSync", new Date().toISOString());
                
                let mesaj = `✅ Import: ${importate} facturi noi`;
                if (erori.filter(e => e.startsWith('Duplicat')).length > 0) {
                    mesaj += ` (${erori.filter(e => e.startsWith('Duplicat')).length} duplicate ignorate)`;
                }
                
                if (importate > 0) {
                    showNotification(mesaj, "success");
                    await init();
                } else if (erori.length > 0) {
                    const duplicates = erori.filter(e => e.startsWith('Duplicat')).length;
                    if (duplicates === erori.length) {
                        showNotification(`Toate facturile există deja (${duplicates} duplicate)`, "warning");
                    } else {
                        showNotification(`0 facturi importate. Verifică consola (F12)`, "warning");
                    }
                    console.error("Erori import:", erori);
                } else {
                    showNotification(`Fișierul nu conține date valide`, "warning");
                }
            } catch (err) {
                console.error("Eroare import CSV:", err);
                showNotification("Eroare import: " + err.message, "error");
            } finally {
                setLoader(false);
                fileInput.value = "";
            }
        });
    } else {
        console.log("📂 Input file existent reutilizat");
    }

    console.log("📂 Apel fileInput.click()...");
    fileInput.click();
}

/**
 * Export PDF - INTELIGENT: detectează dacă există selecție bulk
 * Dacă sunt facturi selectate -> exportă doar selecția
 * Altfel -> exportă toate facturile filtrate
 */
function exportaPDF() {
    // VERIFICARE BULK SELECTION - dacă există facturi selectate, exportă doar selecția
    if (ZFlowStore.bulkMode && ZFlowStore.bulkSelectedFacturi.length > 0) {
        console.log("📄 Export PDF - MOD SELECȚIE: " + ZFlowStore.bulkSelectedFacturi.length + " facturi");
        exportaPDFSelectie();
        return;
    }
    
    console.log("📄 Export PDF - MOD COMPLET: toate facturile filtrate");

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
                                f.status_plata === ZFlowStore.filtruStatusBI;
            let facturaDate = f.data_emiterii ? new Date(f.data_emiterii) : null;
            if (facturaDate) facturaDate.setHours(12,0,0,0);
            const dOk = facturaDate && !isNaN(facturaDate);
            let matchData = true;
            if (pdfStartDate && dOk) matchData = matchData && facturaDate >= pdfStartDate;
            if (pdfEndDate && dOk) matchData = matchData && facturaDate <= pdfEndDate;
            return matchData && matchStatus;
          })
        : [];

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text(curataText("RAPORT ANALIZA FINANCIARA"), 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(curataText(`Perioada auditata: ${pStart} - ${pEnd}`), 14, 28);
    doc.setFontSize(13);
    doc.text(curataText(`TOTAL GENERAL: ${sumaTotala}`), 14, 38);

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

    doc.autoTable({
        startY: 45,
        head: [[curataText("CLIENT"), curataText("DOCUMENT"), curataText("EMIS LA"), curataText("SCADENTA"), curataText("SUMA"), curataText("STATUS")]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [30, 58, 138], fontSize: 8, halign: "center" },
        styles: { fontSize: 7, cellPadding: 2, halign: "center" },
        columnStyles: {
            0: { cellWidth: 40, halign: "center" },
            1: { cellWidth: 30, halign: "center" },
            2: { cellWidth: 22, halign: "center" },
            3: { cellWidth: 22, halign: "center" },
            4: { cellWidth: 30, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 25, halign: "center", fontStyle: "bold" },
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
        const allFurnIds = selFurnIds.length > 0 ? selFurnIds : ZFlowStore.dateFurnizori.map(f => String(f.id));
        const filtrateFP = _filtreazaFacturiPlatit(sD, eD, allFurnIds, '');

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
                headStyles: { fillColor: [185, 28, 28], fontSize: 8, halign: 'center' },
                styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
                columnStyles: {
                    0: { cellWidth: 40 }, 1: { cellWidth: 30 }, 2: { cellWidth: 22 },
                    3: { cellWidth: 22 }, 4: { cellWidth: 30, fontStyle: 'bold' }, 5: { cellWidth: 25, fontStyle: 'bold' }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 5) {
                        data.cell.styles.textColor = data.cell.raw === 'Platit' ? [16, 185, 129] : [239, 68, 68];
                    }
                }
            });
        }
    }

    doc.save(`Analiza_ZFlow_${new Date().toISOString().slice(0, 10)}.pdf`);
    saveZFlowData();
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
function exportaExcel() {
    // VERIFICARE BULK SELECTION - dacă există facturi selectate, exportă doar selecția
    if (ZFlowStore.bulkMode && ZFlowStore.bulkSelectedFacturi.length > 0) {
        console.log("📊 Export Excel - MOD SELECȚIE: " + ZFlowStore.bulkSelectedFacturi.length + " facturi");
        exportaExcelSelectie();
        return;
    }
    
    console.log("📊 Export Excel - MOD COMPLET: toate facturile filtrate");
    const s = document.getElementById("data-start")?.value || ZFlowStore.biStartVal || null;
    const e = document.getElementById("data-end")?.value || ZFlowStore.biEndVal || null;
    const ids = Array.from(document.querySelectorAll("#container-bi-checks input:checked")).map((i) => String(i.value));
    const xlsxStartDate = s ? new Date(s + "T00:00:00") : null;
    const xlsxEndDate = e ? new Date(e + "T23:59:59") : null;

    const facturiFiltrate = (ZFlowStore.filtruStatusBI !== 'Platit')
        ? (ZFlowStore.dateFacturiBI || []).filter(f => {
            if (!ids.includes(String(f.client_id))) return false;
            const matchStatus = ZFlowStore.filtruStatusBI === 'toate' ||
                                f.status_plata === ZFlowStore.filtruStatusBI;
            let fd = f.data_emiterii ? new Date(f.data_emiterii) : null;
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
        const allFurnIds = selFurnIdsXlsx.length > 0 ? selFurnIdsXlsx : ZFlowStore.dateFurnizori.map(f => String(f.id));
        const filtrateFP = _filtreazaFacturiPlatit(sD2, eD2, allFurnIds, '');
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

    // Foaie 3: Cashflow summary (la Toate)
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

    XLSX.writeFile(wb, `zflow_analiza_${new Date().toISOString().slice(0, 10)}.xlsx`);
    saveZFlowData();
}

// ==========================================
// EMAIL & PRINT
// ==========================================

/**
 * Trimite email debitor
 */
function trimiteEmailDebitor(email, nr, suma) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || email === "undefined" || email === "null" || !emailRegex.test(email)) {
        return alert("Eroare: Adresa de email nu este validă!");
    }
    const subiect = encodeURIComponent(`Notificare plată factură nr. ${nr}`);
    const corp = encodeURIComponent(`Bună ziua,\n\nVă reamintim de plata facturii nr. ${nr} în valoare de ${suma} RON.\n\nVă mulțumim!`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subiect}&body=${corp}`, "_blank");
}

/**
 * Trimite reminder WhatsApp - generează link direct cu mesaj pre-definit
 * #30 TODO - WhatsApp notificări
 */
function trimiteWhatsAppReminder(telefon, numeClient, nrFactura, suma, dataScadenta) {
    // Validare număr telefon
    if (!telefon || telefon === "undefined" || telefon === "null" || telefon.trim() === "") {
        showNotification("Clientul nu are număr de telefon configurat", "warning");
        return;
    }
    
    // Curăță numărul de telefon (elimină spații, paranteze, liniițe)
    let telefonCurat = telefon.replace(/[\s\-\(\)\.]/g, "");
    
    // Adăugare prefix România dacă lipsește
    if (telefonCurat.startsWith("07")) {
        telefonCurat = "40" + telefonCurat.substring(1); // 07xx -> 407xx
    } else if (telefonCurat.startsWith("0")) {
        telefonCurat = "40" + telefonCurat.substring(1);
    } else if (!telefonCurat.startsWith("40") && !telefonCurat.startsWith("+")) {
        telefonCurat = "40" + telefonCurat;
    }
    
    // Elimină "+" dacă există (WhatsApp API nu are nevoie)
    telefonCurat = telefonCurat.replace("+", "");
    
    // Formatează data scadenței
    const dataFormatata = dataScadenta ? formateazaDataZFlow(dataScadenta) : "necunoscută";
    
    // Compune mesajul
    const mesaj = `Bună ziua,

Vă contactăm pentru factura nr. *${nrFactura}* în valoare de *${Number(suma).toLocaleString()} lei*.

Scadența: ${dataFormatata}

Vă rugăm să efectuați plata cât mai curând posibil.

Mulțumim!
_Z-FLOW Enterprise_`;
    
    const mesajEncodat = encodeURIComponent(mesaj);
    const whatsappUrl = `https://wa.me/${telefonCurat}?text=${mesajEncodat}`;
    
    // Deschide WhatsApp (web sau app nativ)
    window.open(whatsappUrl, "_blank");
    showNotification(`📤 WhatsApp deschis pentru ${numeClient}`, "success");
}

/**
 * Partajează factura via Web Share API (nativ pe mobil)
 * Fallback: copiere în clipboard pe desktop
 * #36 - Share API nativ
 */
async function trimiteShareFactura(facturaId) {
    const fac = ZFlowStore.dateFacturiBI.find(f => String(f.id) === String(facturaId));
    if (!fac) return;
    const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(fac.client_id));
    const numeClient = client?.nume_firma || 'Client necunoscut';
    const dataScadFormatat = fac.data_scadenta ? formateazaDataZFlow(fac.data_scadenta) : 'N/A';
    const valoareFormatata = Number(fac.valoare).toLocaleString('ro-RO', { minimumFractionDigits: 2 });

    const shareText = `Factură nr. ${fac.numar_factura}\nClient: ${numeClient}\nValoare: ${valoareFormatata} lei\nScadență: ${dataScadFormatat}\nStatus: ${fac.status_plata === 'Incasat' ? '✅ Încasat' : '⏳ Neîncasat'}`;

    if (navigator.share) {
        try {
            const shareData = {
                title: `Z-FLOW · Factură ${fac.numar_factura}`,
                text: shareText,
            };
            const pdfUrls = _getPDFUrls(fac);
            if (pdfUrls.length > 0) shareData.url = pdfUrls[0];
            await navigator.share(shareData);
            if (navigator.vibrate) navigator.vibrate(30);
        } catch (err) {
            if (err.name !== 'AbortError') {
                showNotification('Eroare la partajare', 'error');
            }
        }
    } else {
        // Fallback clipboard pentru desktop
        try {
            await navigator.clipboard.writeText(shareText);
            showNotification('📋 Detalii factură copiate în clipboard!', 'success');
        } catch (e) {
            showNotification('Partajarea nu este suportată pe acest dispozitiv.', 'warning');
        }
    }
}

/**
 * Print factură
 */
function printInvoice(id) {
    try {
        const invoice = ZFlowStore.dateFacturiBI.find(f => String(f.id) === String(id));
        const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(invoice?.client_id));

        if (!invoice || !client) {
            alert("Factură nu a fost găsită!");
            return;
        }

        const w = window.open("", "Print");
        w.document.write("<h1>Z-FLOW Enterprise v7.14</h1>");
        w.document.write("<hr>");
        w.document.write("<h2>Factură #" + invoice.numar_factura + "</h2>");
        w.document.write("<p><strong>Client:</strong> " + client.nume_firma + "</p>");
        w.document.write("<p><strong>CUI:</strong> " + client.cui + "</p>");
        w.document.write("<p><strong>Data Emiterii:</strong> " + (invoice.data_emiterii || "-") + "</p>");
        w.document.write("<p><strong>Data Scadenței:</strong> " + (invoice.data_scadenta || "-") + "</p>");
        w.document.write("<p><strong>Status Plată:</strong> " + invoice.status_plata + "</p>");
        w.document.write("<hr>");
        w.document.write("<table border='1' cellpadding='10' style='width:100%;'>");
        w.document.write("<tr><th>Descriere</th><th style='text-align:right;'>Valoare (RON)</th></tr>");
        w.document.write("<tr><td>Servicii prestate</td><td style='text-align:right;'>" + Number(invoice.valoare || 0).toLocaleString() + "</td></tr>");
        w.document.write("</table>");
        w.document.write("<hr>");
        w.document.write("<h3 style='text-align:right;'>Total: " + Number(invoice.valoare || 0).toLocaleString() + " RON</h3>");
        w.document.write("<p style='font-size:10px; color:#999;'>Document generat electronic din Z-FLOW Enterprise</p>");
        w.document.write("<p style='font-size:10px; color:#999;'>Data: " + new Date().toLocaleDateString() + "</p>");
        w.print();
        w.close();
    } catch (err) {
        console.error("Eroare print:", err);
        alert("Eroare la print: " + err.message);
    }
}

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
        console.log("Date ANAF:", d);
    };

    setLoader(true);

    // 1. Încearcă apel direct (funcționează dacă ANAF permite CORS)
    try {
        const r = await fetch(anafUrl, {
            method: "POST", headers: jsonHeaders, body,
            signal: AbortSignal.timeout(5000)
        });
        if (r.ok) {
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); setLoader(false); return; }
        }
    } catch (_) { /* CORS blocat, trecem la proxy */ }

    // 2. Supabase Edge Function (cel mai fiabil — deploy din _detalii/_docs/supabase_edge_anaf_proxy.ts)
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
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); setLoader(false); return; }
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
                aplicaDate(res.found[0]); setLoader(false); return;
            } else {
                showNotification(`CUI-ul ${cui} nu a fost găsit în baza ANAF.`, "warning");
                setLoader(false); return;
            }
        } catch (e) {
            console.warn("Proxy eșuat:", proxyUrl, e.message);
        }
    }

    // 3. Toate au eșuat — îi propunem alternativa Edge Function
    setLoader(false);
    showNotification("Serviciul ANAF nu răspunde. Dacă eroarea persistă, contactează administratorul.", "error", 6000);
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
                    <p class="text-[9px] font-bold text-blue-600 mt-1 uppercase">🚚 Camion: ${t.numar_auto}</p>
                </div>
                <span class="text-[8px] font-extrabold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-700">WAIT UIT</span>
            </div>`
        )
        .join("");
}

function initMap() {
    if (!ZFlowStore.map) {
        ZFlowStore.map = L.map("map", { zoomControl: false }).setView([47.18, 23.05], 13);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(ZFlowStore.map);
    }
    setTimeout(() => ZFlowStore.map.invalidateSize(), 400);
}

function initScanner() {
    if (!ZFlowStore.scanner) {
        ZFlowStore.scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
        ZFlowStore.scanner.render((t) => (document.getElementById("barcode-value").innerText = t));
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
        console.warn("Theme load failed");
    }

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
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_OUT') {
            logout();
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
window.inchideModalRegister = inchideModalRegister;
window.inchideModalResetPassword = inchideModalResetPassword;
// Onboarding & Profil Firmă
window.verificaOnboarding = verificaOnboarding;
window.salveazaProfilOnboarding = salveazaProfilOnboarding;
window.salteOnboarding = salteOnboarding;
window.deschideProfilFirma = deschideProfilFirma;
window.inchideProfilFirma = inchideProfilFirma;
window.salveazaProfilFirma = salveazaProfilFirma;
window.schimbaTab = schimbaTab;
window.comutaVedereFin = comutaVedereFin;
window.toggleFAB = toggleFAB;
window.renderMain = renderMain;
window.filtreazaListaFirme = filtreazaListaFirme;
window.arataDetalii = arataDetalii;
window.filtreazaFacturiInDetalii = filtreazaFacturiInDetalii;
window.loadMoreFacturiClient = loadMoreFacturiClient;
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
    // Inițializăm pe listele de facturi
    SwipeHandler.init('#lista-facturi-content');
    SwipeHandler.init('#rezultat-analiza');

    // ── Offline / Online Banner ─────────────────────────────────
    const offlineBanner = document.getElementById('offline-banner');
    const setOfflineUI = (isOffline) => {
        if (!offlineBanner) return;
        if (isOffline) {
            offlineBanner.classList.remove('hidden');
            // Decalez header-ul și main-ul cu înălțimea banner-ului
            document.querySelector('header')?.classList.add('mt-8');
            showNotification('📡 Fără conexiune la internet. Datele pot fi neactualizate.', 'error', 5000);
        } else {
            offlineBanner.classList.add('hidden');
            document.querySelector('header')?.classList.remove('mt-8');
            showNotification('✅ Conexiune restaurată!', 'success', 3000);
        }
    };

    // Stare inițială
    if (!navigator.onLine) setOfflineUI(true);

    window.addEventListener('offline', () => setOfflineUI(true));
    window.addEventListener('online', () => setOfflineUI(false));

    // ── PWA Back Button Handler ──────────────────────────────────────────
    // Adăugăm o intrare inițială în history pentru a preveni ieșirea din app
    history.replaceState({ zflowView: 'firme' }, '', '#firme');

    window.addEventListener('popstate', (e) => {
        // 1. Dacă există un modal deschis, îl închidem și rămânem în app
        const modalDeschis = document.querySelector('.modal-sheet.active');
        if (modalDeschis) {
            modalDeschis.classList.remove('active');
            // Re-pushăm starea curentă pentru a putea da back din nou
            history.pushState({ zflowView: ZFlowStore.currentView }, '', '#' + ZFlowStore.currentView);
            return;
        }

        // 2. Dacă FAB menu e deschis, îl închidem
        const fabMenu = document.getElementById('fab-menu');
        if (fabMenu && fabMenu.classList.contains('active')) {
            fabMenu.classList.remove('active');
            history.pushState({ zflowView: ZFlowStore.currentView }, '', '#' + ZFlowStore.currentView);
            return;
        }

        const view = e.state?.zflowView;

        if (view && view !== 'firme') {
            // Navigăm înapoi la vederea anterioară (fără pushState - suntem pe popstate)
            comutaVedereFin(view === 'detalii' ? 'firme' : view, false);
            // Re-pushăm 'firme' ca bază, astfel încât un alt back rămâne în app
            history.pushState({ zflowView: ZFlowStore.currentView }, '', '#' + ZFlowStore.currentView);
        } else {
            // Suntem deja la 'firme' - rămânem în app, re-pushăm starea
            comutaVedereFin('firme', false);
            history.pushState({ zflowView: 'firme' }, '', '#firme');
        }
    });
});

// Re-inițializăm după navigare
const originalArataDetalii = typeof arataDetalii === 'function' ? arataDetalii : null;

// ==========================================
// WINDOW EXPORTS
// ==========================================

window.biNextPage = biNextPage;
window.biPrevPage = biPrevPage;
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
window.deschideModal = deschideModal;
window.inchideModal = inchideModal;
window.deschideModalDirectFactura = deschideModalDirectFactura;
window.logicUIT = logicUIT;
window.salveazaClient = salveazaClient;
window.salveazaFacturaOrchestrator = salveazaFacturaOrchestrator;
window.toggleStatusPlata = toggleStatusPlata;
window.stergeFactura = stergeFactura;
window.stergeFirma = stergeFirma;
window.swipeToggleIncasare = swipeToggleIncasare;
window.swipeStergeFactura = swipeStergeFactura;
window.resetAllSwipeCards = resetAllSwipeCards;
window.showConfirmModal = showConfirmModal;
window.inchideModalConfirm = inchideModalConfirm;
window.importaDateSaga = importaDateSaga;
window.exportaPDF = exportaPDF;
window.exportaExcel = exportaExcel;
window.verificaScadenteNotificari = verificaScadenteNotificari;
window.toggleBellNotificari = toggleBellNotificari;
window.trimiteEmailDebitor = trimiteEmailDebitor;
window.trimiteWhatsAppReminder = trimiteWhatsAppReminder;
window.trimiteShareFactura = trimiteShareFactura;
window.removePendingPDF = removePendingPDF;
window.stergeAtasamentPDF = stergeAtasamentPDF;
window.printInvoice = printInvoice;
window.autoCautareCUI = autoCautareCUI;
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
window.initScanner = initScanner;
window.setLoader = setLoader;
window.showNotification = showNotification;
window.formateazaDataZFlow = formateazaDataZFlow;

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

(function initializeV2Modules() {
    console.log('🚀 Z-FLOW - Inițializare Module Refactorizate');
    
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
        console.log(`✅ Module încărcate (${loadedModules.length}/${modules.length}):`, loadedModules.join(', '));
    }
    
    if (missingModules.length > 0) {
        console.warn(`⚠️ Module lipsă:`, missingModules.join(', '));
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
    
    console.log('📦 Acces rapid disponibil prin: ZF.Utils, ZF.Auth, ZF.UI, etc.');
    console.log('📖 Documentație: js/modules/index.js');
})();
