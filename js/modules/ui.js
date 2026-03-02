/**
 * Z-FLOW Enterprise v7.14
 * Module: UI - Componente UI reutilizabile
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowUI = {
    /**
     * Afișează loader global
     * @param {boolean} visible
     */
    setLoader(visible) {
        const loader = document.getElementById("loader-global");
        if (loader) loader.classList.toggle("hidden", !visible);
        if (window.ZFlowStore) ZFlowStore.isLoading = visible;
    },

    /**
     * Afișează notificare toast
     * @param {string} message - Mesajul de afișat
     * @param {string} type - success | error | warning | info
     * @param {number} duration - Durata în ms
     */
    showNotification(message, type = "info", duration = 3500) {
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
    },

    /**
     * Afișează modal de confirmare
     * @param {string} message - Mesajul de confirmare
     * @param {Function} onConfirm - Callback la confirmare
     * @param {Function} onCancel - Callback la anulare (opțional)
     */
    showConfirm(message, onConfirm, onCancel = null) {
        const modal = document.getElementById("modal-confirm");
        const msgEl = document.getElementById("confirm-message");
        const btnConfirm = document.getElementById("btn-confirm-yes");
        
        if (msgEl) msgEl.innerText = message;
        if (modal) modal.classList.add("active");
        
        if (btnConfirm) {
            btnConfirm.onclick = () => {
                modal.classList.remove("active");
                if (onConfirm) onConfirm();
            };
        }
        
        // Stocare onCancel pentru butonul Nu
        window._confirmOnCancel = onCancel;
    },

    /**
     * Închide modal de confirmare
     */
    closeConfirm() {
        const modal = document.getElementById("modal-confirm");
        if (modal) modal.classList.remove("active");
        if (window._confirmOnCancel) {
            window._confirmOnCancel();
            window._confirmOnCancel = null;
        }
    },

    /**
     * Afișează skeleton loader
     * @param {HTMLElement} container - Containerul
     * @param {number} count - Număr de skeletons
     * @param {string} type - client | invoice | row
     */
    showSkeleton(container, count = 5, type = "client") {
        if (!container) return;
        
        let html = '';
        for (let i = 0; i < count; i++) {
            if (type === "client") {
                html += `
                    <div class="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-slate-200 rounded-xl"></div>
                            <div class="flex-1">
                                <div class="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                                <div class="h-3 bg-slate-100 rounded w-1/2"></div>
                            </div>
                            <div class="h-6 bg-slate-200 rounded-lg w-20"></div>
                        </div>
                    </div>`;
            } else if (type === "invoice") {
                html += `
                    <div class="bg-white rounded-xl p-3 shadow-sm animate-pulse">
                        <div class="flex justify-between items-center">
                            <div class="h-4 bg-slate-200 rounded w-24"></div>
                            <div class="h-5 bg-slate-200 rounded w-20"></div>
                        </div>
                        <div class="h-3 bg-slate-100 rounded w-32 mt-2"></div>
                    </div>`;
            } else {
                html += `
                    <div class="bg-white rounded-lg p-3 animate-pulse">
                        <div class="h-4 bg-slate-200 rounded w-full"></div>
                    </div>`;
            }
        }
        container.innerHTML = html;
    },

    /**
     * Ascunde skeleton loader
     * @param {HTMLElement} container
     */
    hideSkeleton(container) {
        if (container) {
            container.querySelectorAll('.animate-pulse').forEach(el => el.remove());
        }
    },

    /**
     * Afișează stare goală cu ilustrație
     * @param {HTMLElement} container
     * @param {string} title
     * @param {string} text
     * @param {string} type - clients | invoices | search | period | default
     */
    showEmptyState(container, title, text, type = "default") {
        const icons = {
            clients: `<svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>`,
            invoices: `<svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`,
            search: `<svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>`,
            period: `<svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>`,
            default: `<svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>`
        };

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 px-6 text-center">
                ${icons[type] || icons.default}
                <h3 class="text-base font-bold text-slate-600 mb-1">${title}</h3>
                <p class="text-xs text-slate-400">${text}</p>
            </div>`;
    },

    /**
     * Toggle clasă pe element
     * @param {string|HTMLElement} selector 
     * @param {string} className 
     */
    toggleClass(selector, className) {
        const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (el) el.classList.toggle(className);
    },

    /**
     * Setează aria labels pentru accesibilitate
     */
    setAriaLabels() {
        document.querySelectorAll('button:not([aria-label])').forEach(btn => {
            const text = btn.innerText?.trim() || btn.title;
            if (text) btn.setAttribute('aria-label', text);
        });
    }
};

// Export global
window.ZFlowUI = ZFlowUI;
