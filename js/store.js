/**
 * Z-FLOW Enterprise v7.14
 * Store - State Management (Vue 3 Reactive)
 */

// State global reactiv folosind Vue.reactive()
const ZFlowStore = Vue.reactive({
    // Date principale
    dateLocal: [],
    dateFacturiBI: [],
    dateFurnizori: [],
    dateFacturiPlatit: [],
    dateContributii: [],        // Contribuții buget de stat (TVA, CAS, CASS, Impozit)
    selectedFurnizorId: null,

    // Depozit — Stoc & Produse
    dateProduse: [],
    dateMiscariStoc: [],
    dateReceptii: [],
    dateLivrari: [],
    depozitView: 'produse',   // produse | miscari | receptii | livrari | scanner

    // Logistic — Transport
    dateSoferi: [],
    dateVehicule: [],
    dateComenziTransport: [],
    logisticView: 'comenzi',  // comenzi | soferi | vehicule
    
    // UI State
    isLoading: false,
    currentTab: 'financiar',
    currentView: 'firme', // firme | analiza | detalii
    selectedClientId: null,
    sortareClienti: 'scadenta', // [UX5] 'scadenta' | 'sold' | 'alfa'
    
    // Filtre BI
    filtruStatusBI: 'toate',
    filtruTipBI: 'ambele',     // clienti | ambele | furnizori
    includeContributiiInAnaliza: false,
    biPageSize: 5,                // Default 5 facturi/pagina in Analiza
    biCurrentPage: 1,
    biStartVal: null,   // Intervalul activ (persistă după reset input)
    biEndVal: null,
    furnizoriBIPageSize: 5,         // Paginare furnizori in Analiza
    furnizoriBICurrentPage: 1,
    _furnizoriBIFiltrati: [],       // Cache furnizori filtrati BI
    
    // Paginare Listă Clienți
    clientiPageSize: 10,
    clientiCurrentPage: 1,
    filtruCategorieClienti: '',     // filtrare după categorie în lista clienți

    _clientiFiltrati: [],   // Lista curentă filtrată — pentru paginare
    
    // Paginare Listă Furnizori
    furnizoriPageSize: 10,          // Default 10 furnizori/pagina
    furnizoriCurrentPage: 1,
    filtruCategorieFurnizori: '',   // filtrare după categorie în lista furnizori
    _furnizoriFiltrati: [], // Lista curentă filtrată — pentru paginare

    // Paginare Contribuții Buget Stat
    contributiiPageSize: 15,
    contributiiCurrentPage: 1,
    contributiiTipFiltru: '',       // '' = toate | 'TVA' | 'CAS' | etc.
    contributiiStatusFiltru: 'toate', // toate | neachitate | achitate

    // Paginare Depozit
    produsePageSize: 10,
    produseCurrentPage: 1,
    _produseFiltrate: [],
    miscariPageSize: 10,
    miscariCurrentPage: 1,
    _miscariFiltrate: [],
    miscariQuery: '',
    receptiiQuery: '',
    livrariQuery: '',

    // Paginare Logistic
    comenziPageSize: 10,
    comenziCurrentPage: 1,
    _comenziFiltrate: [],
    soferiPageSize: 10,
    soferiCurrentPage: 1,
    _soferiFiltrati: [],
    soferiQuery: '',
    vehiculePageSize: 10,
    vehiculeCurrentPage: 1,
    _vehiculeFiltrate: [],
    vehiculeQuery: '',

    // Lazy Loading Facturi (#6 IMPLEMENTAT)
    facturiPerPage: 20,
    facturiLoadedCount: 0,
    facturiTotalCount: 0,
    hasMoreFacturi: true,
    facturiSortateClient: [], // Referință la facturile sortate pentru Load More
    
    // Bulk Actions (#14 IMPLEMENTAT)
    bulkSelectedFacturi: [], // Array cu ID-urile facturilor selectate
    bulkMode: false, // Mod selecție multiplă activ
    
    // Chart
    chartInstance: null,
    
    // Map, Scanner & GPS
    map: null,
    scanner: null,
    _gpsMarcatori: [],  // Markere Leaflet active pe hartă (GPS logistic)
    
    // User session
    userSession: null,
    userRole: 'viewer', // admin | user | viewer
    userProfile: null, // Profilul firmei utilizatorului curent
    userPermissions: {
        canEdit: false,
        canDelete: false,
        canExport: false,
        canImport: false,
        canManageUsers: false
    }
});

// Definiții roluri și permisiuni
const ROLE_PERMISSIONS = {
    admin: {
        canEdit: true,
        canDelete: true,
        canExport: true,
        canImport: true,
        canManageUsers: true
    },
    user: {
        canEdit: true,
        canDelete: true,
        canExport: true,
        canImport: true,
        canManageUsers: false
    },
    viewer: {
        canEdit: false,
        canDelete: false,
        canExport: true,
        canImport: false,
        canManageUsers: false
    },
    demo_user: {
        canEdit: true,
        canDelete: true,
        canExport: true,
        canImport: true,
        canManageUsers: false
    }
};

/**
 * Setează rolul utilizatorului și permisiunile asociate
 */
function setUserRole(role) {
    const validRole = ROLE_PERMISSIONS[role] ? role : 'viewer';
    ZFlowStore.userRole = validRole;
    ZFlowStore.userPermissions = { ...ROLE_PERMISSIONS[validRole] };
    updateUIForRole();
    ZFlowLogger.debug('store', `🔐 Rol setat: ${validRole}`, ZFlowStore.userPermissions);
}

/**
 * Verifică dacă utilizatorul are o permisiune specifică
 */
function hasPermission(permission) {
    return ZFlowStore.userPermissions[permission] === true;
}

/**
 * Actualizează UI-ul în funcție de rol (ascunde/afișează butoane)
 */
function updateUIForRole() {
    // Butoane de ediție
    document.querySelectorAll('[data-permission="edit"]').forEach(el => {
        el.style.display = hasPermission('canEdit') ? '' : 'none';
    });
    
    // Butoane de ștergere
    document.querySelectorAll('[data-permission="delete"]').forEach(el => {
        el.style.display = hasPermission('canDelete') ? '' : 'none';
    });
    
    // Butoane de import
    document.querySelectorAll('[data-permission="import"]').forEach(el => {
        el.style.display = hasPermission('canImport') ? '' : 'none';
    });
    
    // Badge rol în header — afișat ca text colorat în interiorul butonului unificat
    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
        const roleConfig = { 
            admin:     { label: 'Administrator', color: 'text-purple-600' }, 
            user:      { label: 'Utilizator',    color: 'text-blue-600' }, 
            viewer:    { label: 'Vizualizare',   color: 'text-slate-500' },
            demo_user: { label: 'Prezentare',    color: 'text-amber-600' }
        };
        const config = roleConfig[ZFlowStore.userRole] || roleConfig.viewer;
        roleBadge.className = `text-[7px] font-semibold leading-none mt-0.5 ${config.color}`;
        roleBadge.innerText = config.label;
    }
}

/** * Elimină elementele duplicate dintr-un array pe baza câmpului `id`.
 * Dacă acelasi ID apare de mai multe ori, este păstrat primul element.
 */
function deduplicaPeID(arr) {
    const seen = new Set();
    return (arr || []).filter(item => {
        const k = String(item?.id ?? '');
        return k && !seen.has(k) ? !!seen.add(k) : false;
    });
}
window.deduplicaPeID = deduplicaPeID;

/** * Salvează datele în localStorage — DOAR pentru utilizatori locali (admin/1234 și demo).
 * Utilizatorii Supabase au datele în baza de date + cache IDB; nu scriem redundant în localStorage.
 */
function saveZFlowData() {
    const session = ZFlowStore.userSession;
    const isLocalUser = session?.user?.email === 'admin' || session?.isDemo === true;
    if (!isLocalUser) return;
    const isDemo = session?.isDemo === true;
    try {
        if (isDemo) {
            // Salvăm array-urile principale deduplicatre pentru reload rapid
            localStorage.setItem('zflow_dm__rendered', JSON.stringify({
                dateLocal: deduplicaPeID(ZFlowStore.dateLocal),
                dateFacturiBI: deduplicaPeID(ZFlowStore.dateFacturiBI),
                lastSync: new Date().toISOString()
            }));
        } else {
            localStorage.setItem("zflow_data", JSON.stringify({
                dateLocal: deduplicaPeID(ZFlowStore.dateLocal),
                dateFacturiBI: deduplicaPeID(ZFlowStore.dateFacturiBI),
                lastSync: new Date().toISOString()
            }));
        }
    } catch (e) {
        ZFlowLogger.warn('store', "localStorage indisponibil:", e);
    }
}

/**
 * Încarcă datele din localStorage
 */
function loadZFlowData() {
    try {
        const isDemo = localStorage.getItem('zflow_demo_session') ? JSON.parse(localStorage.getItem('zflow_demo_session'))?.isDemo : false;
        const key = isDemo ? 'zflow_dm__rendered' : 'zflow_data';
        const saved = localStorage.getItem(key);
        if (!saved) return null;
        const data = JSON.parse(saved);
        if (data.dateLocal) data.dateLocal = deduplicaPeID(data.dateLocal);
        if (data.dateFacturiBI) data.dateFacturiBI = deduplicaPeID(data.dateFacturiBI);
        return data;
    } catch (e) {
        return null;
    }
}

/**
 * Verifică sesiunea utilizatorului (Supabase Auth + Demo fallback)
 */
async function checkSession() {
    // 1. Verifică sesiune demo în localStorage
    try {
        const demoSession = localStorage.getItem("zflow_demo_session");
        if (demoSession) {
            const parsed = JSON.parse(demoSession);
            const sessionAge = Date.now() - new Date(parsed.login_time).getTime();
            const ttl = parsed.remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 zile / 24h
            if (sessionAge < ttl) {
                ZFlowStore.userSession = { user: { email: parsed.user }, isDemo: parsed.isDemo === true };
                setUserRole(parsed.role || 'user'); // Restabilește rolul
                return true;
            } else {
                localStorage.removeItem("zflow_demo_session");
            }
        }
    } catch (e) {
        ZFlowLogger.warn('store', "Demo session check error:", e);
    }
    
    // 2. Verifică sesiune Supabase
    try {
        const session = await ZFlowDB.getSession();
        if (session && session.user) {
            ZFlowStore.userSession = session;
            // Pentru utilizatori Supabase, rolul se poate prelua din metadata
            const userRole = session.user.user_metadata?.role || 'user';
            setUserRole(userRole);
            return true;
        }
        return false;
    } catch (e) {
        ZFlowLogger.warn('store', "Supabase session check error:", e);
        return false;
    }
}

/**
 * Salvează sesiunea demo în localStorage
 */
function saveDemoSession(user, role = 'user', isDemo = true, remember = false) {
    localStorage.setItem("zflow_demo_session", JSON.stringify({
        user: user,
        role: role,
        isDemo: isDemo,
        remember: remember,
        login_time: new Date().toISOString()
    }));
}

/**
 * Salvează sesiunea utilizatorului (legacy - pentru compatibilitate)
 */
function saveSession(user) {
    // Supabase gestionează automat sesiunea
    // Această funcție rămâne pentru compatibilitate
    ZFlowStore.userSession = user;
}

/**
 * Încarcă tema salvată
 */
function loadTheme() {
    try {
        const saved = localStorage.getItem("zflow-theme") || "light";
        if (saved === "dark") {
            document.documentElement.classList.add("dark");
        }
    } catch (e) {
        ZFlowLogger.warn('store', "Dark mode error:", e);
    }
}

/**
 * @deprecated Versiunea completă (cu actualizare icoană + toast) se află în app.js.
 * La runtime, versiunea din app.js suprascrie aceasta (app.js se încarcă după store.js).
 * Această versiune rămâne pentru compatibilitate — nu o șterge.
 */
/**
 * Toggle Dark Mode
 */
function toggleDarkMode() {
    document.documentElement.classList.toggle("dark");
    const isDark = document.documentElement.classList.contains("dark");
    localStorage.setItem("zflow-theme", isDark ? "dark" : "light");
}

// Export global
window.ZFlowStore = ZFlowStore;
window.saveZFlowData = saveZFlowData;
window.ZFlowUserProfile = null; // referință rapidă la profilul curent
window.loadZFlowData = loadZFlowData;
window.checkSession = checkSession;
window.saveDemoSession = saveDemoSession;
window.saveSession = saveSession;
window.loadTheme = loadTheme;
window.toggleDarkMode = toggleDarkMode;
window.setUserRole = setUserRole;
window.hasPermission = hasPermission;
window.updateUIForRole = updateUIForRole;
window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
