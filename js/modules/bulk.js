/**
 * Z-FLOW Enterprise v7.14
 * Module: Bulk - Acțiuni în masă pe facturi
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowBulk = {
    // Facturi selectate
    selected: [],
    
    // Mod bulk activ
    isActive: false,

    /**
     * Activează/dezactivează modul bulk
     * @returns {boolean} - Starea nouă
     */
    toggle() {
        this.isActive = !this.isActive;
        
        if (!this.isActive) {
            this.clearSelection();
        }
        
        this.updateUI();
        return this.isActive;
    },

    /**
     * Selectează/deselectează o factură
     * @param {string} facturaId 
     */
    toggleSelect(facturaId) {
        const index = this.selected.indexOf(facturaId);
        
        if (index === -1) {
            this.selected.push(facturaId);
        } else {
            this.selected.splice(index, 1);
        }
        
        this.updateUI();
    },

    /**
     * Verifică dacă o factură e selectată
     * @param {string} facturaId 
     * @returns {boolean}
     */
    isSelected(facturaId) {
        return this.selected.includes(facturaId);
    },

    /**
     * Selectează toate facturile vizibile
     * @param {Array} facturi - Lista de facturi vizibile
     */
    selectAll(facturi) {
        this.selected = facturi.map(f => f.id);
        this.updateUI();
    },

    /**
     * Deselectează toate
     */
    clearSelection() {
        this.selected = [];
        this.updateUI();
    },

    /**
     * Obține facturile selectate
     * @returns {Array}
     */
    getSelected() {
        const toateFacturile = window.ZFlowStore?.dateFacturiBI || [];
        return toateFacturile.filter(f => this.selected.includes(f.id));
    },

    /**
     * Obține numărul de facturi selectate
     * @returns {number}
     */
    getCount() {
        return this.selected.length;
    },

    /**
     * Calculează totalul facturilor selectate
     * @returns {number}
     */
    getTotal() {
        return this.getSelected().reduce((sum, f) => sum + (parseFloat(f.suma) || 0), 0);
    },

    /**
     * Marchează toate facturile selectate ca încasate
     * @returns {Promise<Object>} - { success: number, errors: number }
     */
    async markAsPaid() {
        const facturi = this.getSelected();
        let success = 0, errors = 0;
        
        for (const f of facturi) {
            try {
                // Folosește funcția existentă din app.js
                if (typeof window.toggleStatusPlata === 'function') {
                    await window.toggleStatusPlata(f.id, f.status_plata);
                    success++;
                }
            } catch (e) {
                console.error(`Eroare la marcarea facturii ${f.id}:`, e);
                errors++;
            }
        }
        
        this.clearSelection();
        this.isActive = false;
        this.updateUI();
        
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
        // Toggle buton mod bulk
        const btnBulk = document.getElementById('btn-bulk-mode');
        if (btnBulk) {
            btnBulk.classList.toggle('bg-blue-600', this.isActive);
            btnBulk.classList.toggle('text-white', this.isActive);
        }
        
        // Afișează/ascunde toolbar bulk
        const toolbar = document.getElementById('bulk-toolbar');
        if (toolbar) {
            toolbar.classList.toggle('hidden', !this.isActive || this.selected.length === 0);
        }
        
        // Actualizează counter
        const counter = document.getElementById('bulk-count');
        if (counter) {
            counter.innerText = this.selected.length;
        }
        
        // Actualizează total
        const totalEl = document.getElementById('bulk-total');
        if (totalEl) {
            totalEl.innerText = this.formatSuma(this.getTotal());
        }
        
        // Actualizează checkbox-uri
        document.querySelectorAll('[data-bulk-checkbox]').forEach(cb => {
            const id = cb.dataset.facturaId;
            cb.checked = this.isSelected(id);
        });
        
        // Afișează/ascunde checkbox-uri
        document.querySelectorAll('.bulk-checkbox-container').forEach(el => {
            el.classList.toggle('hidden', !this.isActive);
        });
    },

    /**
     * Generează HTML pentru checkbox bulk
     * @param {string} facturaId 
     * @returns {string}
     */
    renderCheckbox(facturaId) {
        const checked = this.isSelected(facturaId) ? 'checked' : '';
        return `
            <div class="bulk-checkbox-container ${this.isActive ? '' : 'hidden'}">
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
