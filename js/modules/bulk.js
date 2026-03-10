/**
 * Z-FLOW Enterprise v7.14
 * Module: Bulk - Acțiuni în masă pe facturi
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowBulk = {
    // [V3-FIX 1] Starea este menținută exclusiv în ZFlowStore (bulkMode + bulkSelectedFacturi)
    // Nu există proprietăți locale selected/isActive — ZFlowBulk este un controller pur

    /**
     * Activează/dezactivează modul bulk
     * @returns {boolean} - Starea nouă
     */
    toggle() {
        if (window.ZFlowStore) ZFlowStore.bulkMode = !ZFlowStore.bulkMode; // [V3-FIX 1]

        if (!(window.ZFlowStore?.bulkMode === true)) { // [V3-FIX 1]
            this.clearSelection();
        }

        this.updateUI();
        return window.ZFlowStore?.bulkMode === true; // [V3-FIX 1]
    },

    /**
     * Selectează/deselectează o factură
     * @param {string} facturaId 
     */
    toggleSelect(facturaId) {
        // [V3-FIX 1] Scrie exclusiv în ZFlowStore
        const arr = (window.ZFlowStore?.bulkSelectedFacturi) || [];
        const idx = arr.indexOf(String(facturaId));
        if (idx === -1) arr.push(String(facturaId)); else arr.splice(idx, 1);
        this.updateUI();
    },

    /**
     * Verifică dacă o factură e selectată
     * @param {string} facturaId 
     * @returns {boolean}
     */
    isSelected(facturaId) {
        return (window.ZFlowStore?.bulkSelectedFacturi || []).includes(String(facturaId)); // [V3-FIX 1]
    },

    /**
     * Selectează toate facturile vizibile
     * @param {Array} facturi - Lista de facturi vizibile
     */
    selectAll(facturi) {
        if (window.ZFlowStore) ZFlowStore.bulkSelectedFacturi = facturi.map(f => String(f.id)); // [V3-FIX 1]
        this.updateUI();
    },

    /**
     * Deselectează toate
     */
    clearSelection() {
        if (window.ZFlowStore) ZFlowStore.bulkSelectedFacturi = []; // [V3-FIX 1]
        this.updateUI();
    },

    /**
     * Obține facturile selectate
     * @returns {Array}
     */
    getSelected() {
        const toateFacturile = window.ZFlowStore?.dateFacturiBI || [];
        const selectedIds = window.ZFlowStore?.bulkSelectedFacturi || []; // [V3-FIX 1]
        return toateFacturile.filter(f => selectedIds.includes(String(f.id)));
    },

    /**
     * Obține numărul de facturi selectate
     * @returns {number}
     */
    getCount() {
        return (window.ZFlowStore?.bulkSelectedFacturi || []).length; // [V3-FIX 1]
    },

    /**
     * Calculează totalul facturilor selectate
     * @returns {number}
     */
    getTotal() {
        return this.getSelected().reduce((sum, f) => sum + (parseFloat(f.valoare ?? f.suma) || 0), 0); // [V3-FIX 2]
    },

    /**
     * Marchează toate facturile selectate ca încasate
     * @returns {Promise<Object>} - { success: number, errors: number }
     */
    async markAsPaid() { // [V3-FIX 3]
        const facturi = this.getSelected();
        if (facturi.length === 0) return { success: 0, errors: 0 };

        if (typeof setLoader === 'function') setLoader(true);

        const rezultate = await Promise.allSettled(
            facturi.map(f =>
                typeof window.toggleStatusPlata === 'function'
                    ? window.toggleStatusPlata(f.id, f.status_plata)
                    : Promise.reject(new Error('toggleStatusPlata nedefinit'))
            )
        );

        const success = rezultate.filter(r => r.status === 'fulfilled').length;
        const errors  = rezultate.filter(r => r.status === 'rejected').length;

        this.clearSelection();
        if (window.ZFlowStore) ZFlowStore.bulkMode = false; // [V3-FIX 3]
        this.updateUI();
        if (typeof setLoader === 'function') setLoader(false);

        if (errors > 0) {
            window.ZFlowUI?.showNotification(
                `${success} facturi actualizate, ${errors} erori`, 'warning');
        } else {
            window.ZFlowUI?.showNotification(
                `${success} facturi marcate cu succes`, 'success');
        }

        return { success, errors };
    },

    /**
     * Șterge definitiv facturile selectate (execuție paralelă)
     * @returns {Promise<Object>} - { success: number, errors: number }
     */
    async deleteSelected() { // [V3-FIX 4]
        const facturi = this.getSelected();
        if (facturi.length === 0) return { success: 0, errors: 0 };

        const confirmed = confirm(
            `Ștergi definitiv ${facturi.length} factur${facturi.length === 1 ? 'ă' : 'i'}? Acțiunea este ireversibilă.`
        );
        if (!confirmed) return { success: 0, errors: 0 };

        if (typeof setLoader === 'function') setLoader(true);

        const rezultate = await Promise.allSettled(
            facturi.map(f =>
                typeof ZFlowDB?.deleteFactura === 'function'
                    ? ZFlowDB.deleteFactura(f.id)
                    : Promise.reject(new Error('deleteFactura nedefinit'))
            )
        );

        const success = rezultate.filter(r => r.status === 'fulfilled').length;
        const errors  = rezultate.filter(r => r.status === 'rejected').length;

        const deletedIds = facturi
            .filter((_, i) => rezultate[i].status === 'fulfilled')
            .map(f => String(f.id));

        if (window.ZFlowStore && deletedIds.length > 0) {
            ZFlowStore.dateFacturiBI = ZFlowStore.dateFacturiBI
                .filter(f => !deletedIds.includes(String(f.id)));
            if (typeof _recomputeFurnizoriData === 'function') _recomputeFurnizoriData();
        }

        this.clearSelection();
        if (window.ZFlowStore) ZFlowStore.bulkMode = false; // [V3-FIX 4]
        this.updateUI();
        if (typeof setLoader === 'function') setLoader(false);

        window.ZFlowUI?.showNotification(
            errors > 0
                ? `${success} șterse, ${errors} erori`
                : `${success} facturi șterse`,
            errors > 0 ? 'warning' : 'success'
        );

        return { success, errors };
    },

    /**
     * Exportă facturile selectate în PDF
     */
    exportPDF() {
        const facturi = this.getSelected();
        if (facturi.length === 0) {
            window.ZFlowUI?.showNotification('Selectați cel puțin o factură', 'warning');
            return;
        }
        window.ZFlowExport?.savePDF(facturi, `facturi-selectie-${Date.now()}.pdf`);
    },

    /**
     * Exportă facturile selectate în Excel
     */
    exportExcel() {
        const facturi = this.getSelected();
        if (facturi.length === 0) {
            window.ZFlowUI?.showNotification('Selectați cel puțin o factură', 'warning');
            return;
        }
        window.ZFlowExport?.saveExcel(facturi, `facturi-selectie-${Date.now()}.xlsx`);
    },

    /**
     * Actualizează UI-ul pentru modul bulk
     */
    updateUI() {
        const isActive = window.ZFlowStore?.bulkMode === true; // [V3-FIX 1]
        const selectedCount = (window.ZFlowStore?.bulkSelectedFacturi || []).length; // [V3-FIX 1]

        const btnBulk = document.getElementById('btn-bulk-mode');
        if (btnBulk) {
            btnBulk.classList.toggle('bg-blue-600', isActive);
            btnBulk.classList.toggle('text-white', isActive);
        }

        const toolbar = document.getElementById('bulk-toolbar');
        if (toolbar) {
            toolbar.classList.toggle('hidden', !isActive || selectedCount === 0);
        }

        const counter = document.getElementById('bulk-count');
        if (counter) {
            counter.innerText = selectedCount;
        }

        const totalEl = document.getElementById('bulk-total');
        if (totalEl) {
            totalEl.innerText = this.formatSuma(this.getTotal());
        }

        document.querySelectorAll('[data-bulk-checkbox]').forEach(cb => {
            const id = cb.dataset.facturaId;
            cb.checked = this.isSelected(id);
        });

        document.querySelectorAll('.bulk-checkbox-container').forEach(el => {
            el.classList.toggle('hidden', !isActive);
        });
    },

    /**
     * Generează HTML pentru checkbox bulk
     * @param {string} facturaId 
     * @returns {string}
     */
    renderCheckbox(facturaId) {
        const isActive = window.ZFlowStore?.bulkMode === true; // [V3-FIX 1]
        const checked = this.isSelected(facturaId) ? 'checked' : '';
        return `
            <div class="bulk-checkbox-container ${isActive ? '' : 'hidden'}">
                <input type="checkbox"
                       data-bulk-checkbox
                       data-factura-id="${facturaId}"
                       ${checked}
                       onclick="ZFlowBulk.toggleSelect('${facturaId}')"
                       class="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
            </div>`;
    },

    /**
     * Helper: Formatare sumă
     * @param {number} suma 
     * @returns {string}
     */
    formatSuma(suma) {
        return new Intl.NumberFormat('ro-RO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(suma || 0) + ' RON';
    }
};

// Export global
window.ZFlowBulk = ZFlowBulk;
