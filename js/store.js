/**
 * Z-FLOW Enterprise v7.14
 * Store - State Management (Vue 3 Reactive)
 */

// State global reactiv folosind Vue.reactive()
const ZFlowStore = Vue.reactive({
    // Date principale
    dateLocal: [],
    dateFacturiBI: [],
    
    // UI State
    isLoading: false,
    currentTab: 'financiar',
    currentView: 'firme', // firme | analiza | detalii
    selectedClientId: null,
    
    // Filtre BI
    filtruStatusBI: 'toate',
    biPageSize: 50,
    biCurrentPage: 1,
    
    // Chart
    chartInstance: null,
    
    // Map & Scanner
    map: null,
    scanner: null,
    
    // User session
    userSession: null,
    userRole: 'viewer', // admin | user | viewer
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
        canDelete: false,
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
    console.log(`🔐 Rol setat: ${validRole}`, ZFlowStore.userPermissions);
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
    
    // Badge rol în header - profesional, fără emoji
    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
        const roleConfig = { 
            admin: { label: 'Administrator', color: 'bg-purple-100 text-purple-700 border-purple-200' }, 
            user: { label: 'Utilizator', color: 'bg-blue-100 text-blue-700 border-blue-200' }, 
            viewer: { label: 'Vizualizare', color: 'bg-slate-100 text-slate-600 border-slate-200' } 
        };
        const config = roleConfig[ZFlowStore.userRole] || roleConfig.viewer;
        roleBadge.className = `text-[9px] font-semibold px-2.5 py-1 rounded-lg border ${config.color}`;
        roleBadge.innerText = config.label;
    }
}

/**
 * Salvează datele în localStorage
 */
function saveZFlowData() {
    try {
        localStorage.setItem("zflow_data", JSON.stringify({
            dateLocal: ZFlowStore.dateLocal,
            dateFacturiBI: ZFlowStore.dateFacturiBI,
            lastSync: new Date().toISOString()
        }));
    } catch (e) {
        console.warn("localStorage indisponibil:", e);
    }
}

/**
 * Încarcă datele din localStorage
 */
function loadZFlowData() {
    try {
        const saved = localStorage.getItem("zflow_data");
        return saved ? JSON.parse(saved) : null;
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
            if (sessionAge < 24 * 60 * 60 * 1000) { // 24h valid
                ZFlowStore.userSession = { user: { email: parsed.user }, isDemo: true };
                setUserRole(parsed.role || 'user'); // Restabilește rolul
                return true;
            } else {
                localStorage.removeItem("zflow_demo_session");
            }
        }
    } catch (e) {
        console.warn("Demo session check error:", e);
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
        console.warn("Supabase session check error:", e);
        return false;
    }
}

/**
 * Salvează sesiunea demo în localStorage
 */
function saveDemoSession(user, role = 'user') {
    localStorage.setItem("zflow_demo_session", JSON.stringify({
        user: user,
        role: role,
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
        console.warn("Dark mode error:", e);
    }
}

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
