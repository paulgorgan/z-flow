/**
 * Z-FLOW Enterprise v7.14
 * Module: Suppliers - Gestiune furnizori
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowSuppliers = {
    /**
     * Obține lista furnizorilor din store
     * @returns {Array}
     */
    getAll() {
        return window.ZFlowStore?.dateFurnizori || [];
    },

    /**
     * Găsește un furnizor după ID
     * @param {string} id 
     * @returns {Object|null}
     */
    findById(id) {
        return this.getAll().find(f => f.id === id) || null;
    },

    /**
     * Găsește un furnizor după CUI
     * @param {string} cui 
     * @returns {Object|null}
     */
    findByCUI(cui) {
        const cuiCurat = cui?.toString().replace(/\D/g, '');
        return this.getAll().find(f => 
            f.cui?.toString().replace(/\D/g, '') === cuiCurat
        ) || null;
    },

    /**
     * Filtrează furnizorii după termen de căutare
     * @param {string} query 
     * @returns {Array}
     */
    search(query) {
        if (!query || query.trim().length < 2) return this.getAll();
        
        const q = query.toLowerCase().trim();
        return this.getAll().filter(f => {
            const numeFirma = (f.nume_firma || '').toLowerCase();
            const cui = (f.cui || '').toString();
            return numeFirma.includes(q) || cui.includes(q);
        });
    },

    /**
     * Obține facturile de plătit pentru un furnizor
     * @param {string} furnizorId 
     * @returns {Array}
     */
    getFacturi(furnizorId) {
        const facturiPlatit = window.ZFlowStore?.dateFacturiPlatit || [];
        return facturiPlatit.filter(f => f.furnizor_id === furnizorId);
    },

    /**
     * Calculează totaluri pentru un furnizor
     * @param {string} furnizorId 
     * @returns {Object}
     */
    calculeazaTotaluri(furnizorId) {
        const facturi = this.getFacturi(furnizorId);
        let total = 0, platit = 0, dePlata = 0;
        
        facturi.forEach(f => {
            const suma = parseFloat(f.suma) || 0;
            total += suma;
            if (f.status_plata === 'Platit') {
                platit += suma;
            } else {
                dePlata += suma;
            }
        });
        
        return {
            total,
            platit,
            dePlata,
            facturiCount: facturi.length
        };
    },

    /**
     * Obține furnizorii cu facturi de plătit restante
     * @returns {Array}
     */
    getWithOverdue() {
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        const facturiPlatit = window.ZFlowStore?.dateFacturiPlatit || [];
        
        return this.getAll().filter(furnizor => {
            const facturiFurnizor = facturiPlatit.filter(f => f.furnizor_id === furnizor.id);
            return facturiFurnizor.some(f => {
                if (f.status_plata === 'Platit') return false;
                const scadenta = new Date(f.data_scadenta);
                return scadenta < azi;
            });
        });
    },

    /**
     * Sortează furnizorii după nume
     * @param {Array} suppliers 
     * @returns {Array}
     */
    sortByName(suppliers) {
        return [...suppliers].sort((a, b) => 
            (a.nume_firma || '').localeCompare(b.nume_firma || '')
        );
    },

    /**
     * Validează datele unui furnizor
     * @param {Object} data 
     * @returns {Object}
     */
    validate(data) {
        const errors = [];
        
        if (!data.nume_firma?.trim()) {
            errors.push("Numele firmei este obligatoriu");
        }
        
        if (data.cui && !window.ZFlowUtils?.validareCUI(data.cui)) {
            errors.push("CUI invalid");
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Pregătește payload pentru salvare
     * @param {Object} formData 
     * @returns {Object}
     */
    preparePayload(formData) {
        return {
            nume_firma: formData.nume_firma?.trim() || '',
            cui: formData.cui?.toString().replace(/\D/g, '') || null,
            adresa: formData.adresa?.trim() || null,
            oras: formData.oras?.trim() || null,
            telefon: formData.telefon?.trim() || null,
            email: formData.email?.trim().toLowerCase() || null,
            persoana_contact: formData.persoana_contact?.trim() || null,
            iban: formData.iban?.trim().replace(/\s/g, '').toUpperCase() || null,
            observatii: formData.observatii?.trim() || null
        };
    },

    /**
     * Populează un select cu furnizorii
     * @param {string} selectId - ID-ul elementului select
     * @param {string} selectedId - ID-ul furnizorului selectat (opțional)
     */
    populateSelect(selectId, selectedId = null) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const furnizori = this.sortByName(this.getAll());
        
        let html = '<option value="">— Selectează furnizor —</option>';
        furnizori.forEach(f => {
            const selected = f.id === selectedId ? 'selected' : '';
            html += `<option value="${f.id}" ${selected}>${f.nume_firma}</option>`;
        });
        
        select.innerHTML = html;
    }
};

// Export global
window.ZFlowSuppliers = ZFlowSuppliers;
