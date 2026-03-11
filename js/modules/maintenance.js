/**
 * Z-FLOW Enterprise — Modul Mentenanță
 * =====================================
 * Gestionează modul de mentenanță al aplicației.
 * Adminul poate bloca accesul utilizatorilor în timpul update-urilor.
 *
 * Stocare: localStorage 'zflow_maintenance' + sincronizare Supabase app_config
 *
 * Expus global ca: window.ZFlowMaintenance
 * Alias-uri pentru compatibilitate inversă:
 *   window.toggleMaintenanceMode
 *   window.checkAndApplyMaintenanceMode
 */

// =========================================================
// Cheie localStorage pentru starea modului de mentenanță
// =========================================================
const MAINTENANCE_LS_KEY = 'zflow_maintenance';

/**
 * Citește starea curentă a modului de mentenanță din localStorage.
 *
 * @returns {{ active: boolean, message: string, enabledAt: string|null }}
 *   Obiect cu câmpurile:
 *   - `active` — true dacă mentenanța este activă
 *   - `message` — mesajul afișat utilizatorilor
 *   - `enabledAt` — timestamp ISO când a fost activată (sau null)
 */
function getMaintenanceState() {
    try {
        const raw = localStorage.getItem(MAINTENANCE_LS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        // localStorage corupt sau blocat — returnăm starea implicită inactivă
    }
    return {
        active: false,
        message: 'Se efectuează actualizări. Vă rugăm să reveniți în câteva minute.',
        enabledAt: null
    };
}

/**
 * Verifică dacă utilizatorul curent este admin (local sau Supabase).
 * Admin-ul este identificat după email-ul 'admin' în sesiunea ZFlowStore.
 *
 * @returns {boolean} true dacă utilizatorul curent este admin
 * @private
 */
function _isAdminUser() {
    const email = window.ZFlowStore?.userSession?.user?.email;
    return email === 'admin';
}

/**
 * Verifică dacă trebuie afișat ecranul de mentenanță și îl aplică în DOM.
 * Apelată la pornirea aplicației și după fiecare toggle al mentenanței.
 *
 * Comportament:
 * - Admin vede întotdeauna aplicația, indiferent de starea mentenanței
 * - Ceilalți utilizatori văd overlay-ul când mentenanța e activă
 *
 * @returns {void}
 */
function checkAndApplyMaintenanceMode() {
    const state = getMaintenanceState();
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;

    // Admin vede întotdeauna aplicația chiar dacă mentenanța e activă
    if (_isAdminUser()) {
        overlay.classList.add('hidden');
        _updateMaintenanceToggleUI(state);
        return;
    }

    if (state.active) {
        const msgEl = document.getElementById('maintenance-message-display');
        if (msgEl && state.message) msgEl.textContent = state.message;
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

/**
 * Actualizează UI-ul toggle-ului din panoul admin pentru modul de mentenanță.
 * Modifică culorile, poziția knob-ului și textul de status.
 *
 * @param {{ active: boolean, message: string, enabledAt: string|null }} state
 *   Starea curentă a mentenanței
 * @returns {void}
 * @private
 */
function _updateMaintenanceToggleUI(state) {
    const btn = document.getElementById('btn-maintenance-toggle');
    const knob = document.getElementById('maintenance-knob');
    const statusText = document.getElementById('maintenance-status-text');
    if (!btn) return;

    if (state.active) {
        btn.classList.remove('bg-slate-300');
        btn.classList.add('bg-amber-500');
        btn.setAttribute('aria-checked', 'true');
        // [FIX 2] classList.replace() eșuează silențios dacă clasa sursă nu există — folosim remove+add
        if (knob) {
            knob.classList.remove('translate-x-0.5');
            knob.classList.add('translate-x-4');
        }
        if (statusText) {
            statusText.textContent = `Status: ACTIV de la ${
                state.enabledAt ? new Date(state.enabledAt).toLocaleString('ro-RO') : '—'
            }`;
            statusText.classList.remove('text-slate-500');
            statusText.classList.add('text-amber-700');
        }
    } else {
        btn.classList.remove('bg-amber-500');
        btn.classList.add('bg-slate-300');
        btn.setAttribute('aria-checked', 'false');
        if (knob) {
            knob.classList.remove('translate-x-4');
            knob.classList.add('translate-x-0.5');
        }
        if (statusText) {
            statusText.textContent = 'Status: Inactiv';
            statusText.classList.remove('text-amber-700');
            statusText.classList.add('text-slate-500');
        }
    }
}

/**
 * Activează sau dezactivează modul de mentenanță (doar admin).
 * Persistă starea în localStorage și sincronizează cu Supabase app_config.
 *
 * Dacă utilizatorul nu este admin, afișează o notificare de eroare și returnează.
 * Dacă sincronizarea Supabase eșuează, afișează o avertizare dar continuă cu
 * starea locală (mentenanța funcționează și fără Supabase).
 *
 * @returns {Promise<void>}
 */
async function toggleMaintenanceMode() {
    if (!_isAdminUser()) {
        showNotification('Acces restricționat', 'error');
        return;
    }

    const current = getMaintenanceState();
    const newState = {
        active: !current.active,
        message: 'Se efectuează actualizări. Vă rugăm să reveniți în câteva minute.',
        enabledAt: !current.active ? new Date().toISOString() : null
    };
    localStorage.setItem(MAINTENANCE_LS_KEY, JSON.stringify(newState));

    // Sincronizare cu Supabase app_config — toți utilizatorii văd același status
    try {
        if (
            typeof ZFlowDB !== 'undefined' &&
            window.ZFlowStore?.userSession &&
            !window.ZFlowStore?.userSession?.isDemo
        ) {
            await ZFlowDB.getSetAppConfig('maintenance_mode', newState);
        }
    } catch (e) {
        showNotification(
            'Atenție: sincronizare Supabase eșuată. Rulați setup_maintenance.sql.',
            'warning'
        );
    }

    _updateMaintenanceToggleUI(newState);
    showNotification(
        newState.active
            ? 'Mod mentenanță ACTIVAT — utilizatorii văd ecranul de blocare'
            : 'Mod mentenanță dezactivat — aplicația este accesibilă',
        newState.active ? 'warning' : 'success'
    );
}

// =========================================================
// Namespace public ZFlowMaintenance
// =========================================================

/**
 * @namespace ZFlowMaintenance
 * @description API public pentru modulul de mentenanță Z-FLOW.
 *
 * @example
 * // Citire stare
 * const state = ZFlowMaintenance.getState();
 *
 * // Aplicare overlay
 * ZFlowMaintenance.checkAndApply();
 *
 * // Toggle (doar admin)
 * await ZFlowMaintenance.toggle();
 */
window.ZFlowMaintenance = {
    /**
     * Citește starea mentenanței.
     * @returns {{ active: boolean, message: string, enabledAt: string|null }}
     */
    getState: getMaintenanceState,

    /**
     * Verifică și aplică modul de mentenanță în DOM.
     * @returns {void}
     */
    checkAndApply: checkAndApplyMaintenanceMode,

    /**
     * Activează / dezactivează mentenanța (doar admin).
     * @returns {Promise<void>}
     */
    toggle: toggleMaintenanceMode,

    /**
     * Actualizează UI-ul toggle-ului admin.
     * @param {{ active: boolean }} state
     * @returns {void}
     */
    updateToggleUI: _updateMaintenanceToggleUI
};

// =========================================================
// Alias-uri pentru compatibilitate cu app.js existent
// =========================================================
window.getMaintenanceState           = getMaintenanceState;
window.checkAndApplyMaintenanceMode  = checkAndApplyMaintenanceMode;
window.toggleMaintenanceMode         = toggleMaintenanceMode;
