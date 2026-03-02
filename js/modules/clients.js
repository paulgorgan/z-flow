/**
 * Z-FLOW Enterprise v7.14
 * Module: Clients - Gestiune clienți
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowClients = {
    /**
     * Obține lista clienților din store
     * @returns {Array}
     */
    getAll() {
        return window.ZFlowStore?.dateLocal || [];
    },

    /**
     * Găsește un client după ID
     * @param {string} id 
     * @returns {Object|null}
     */
    findById(id) {
        return this.getAll().find(c => c.id === id) || null;
    },

    /**
     * Găsește un client după CUI
     * @param {string} cui 
     * @returns {Object|null}
     */
    findByCUI(cui) {
        const cuiCurat = cui?.toString().replace(/\D/g, '');
        return this.getAll().find(c => 
            c.cui?.toString().replace(/\D/g, '') === cuiCurat
        ) || null;
    },

    /**
     * Filtrează clienții după termen de căutare
     * @param {string} query - Termen de căutare
     * @returns {Array}
     */
    search(query) {
        if (!query || query.trim().length < 2) return this.getAll();
        
        const q = query.toLowerCase().trim();
        return this.getAll().filter(c => {
            const numeFirma = (c.nume_firma || '').toLowerCase();
            const cui = (c.cui || '').toString();
            return numeFirma.includes(q) || cui.includes(q);
        });
    },

    /**
     * Calculează totaluri pentru un client
     * @param {Object} client 
     * @returns {Object} - { total, incasat, restant, facturiCount }
     */
    calculeazaTotaluri(client) {
        const facturi = client.facturi || [];
        let total = 0, incasat = 0, restant = 0;
        
        facturi.forEach(f => {
            const suma = parseFloat(f.suma) || 0;
            total += suma;
            if (f.status_plata === 'Incasat') {
                incasat += suma;
            } else {
                restant += suma;
            }
        });
        
        return {
            total,
            incasat,
            restant,
            facturiCount: facturi.length
        };
    },

    /**
     * Obține clienții cu facturi restante
     * @returns {Array}
     */
    getWithOverdue() {
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        
        return this.getAll().filter(client => {
            return (client.facturi || []).some(f => {
                if (f.status_plata === 'Incasat') return false;
                const scadenta = new Date(f.data_scadenta);
                return scadenta < azi;
            });
        });
    },

    /**
     * Sortează clienții - restanțe primele
     * @param {Array} clients - Lista de clienți
     * @returns {Array}
     */
    sortByOverdue(clients) {
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        
        return [...clients].sort((a, b) => {
            const aRestant = (a.facturi || []).some(f =>
                f.status_plata !== 'Incasat' &&
                f.data_scadenta &&
                new Date(f.data_scadenta) < azi
            );
            const bRestant = (b.facturi || []).some(f =>
                f.status_plata !== 'Incasat' &&
                f.data_scadenta &&
                new Date(f.data_scadenta) < azi
            );
            
            if (aRestant && !bRestant) return -1;
            if (!aRestant && bRestant) return 1;
            return (a.nume_firma || '').localeCompare(b.nume_firma || '');
        });
    },

    /**
     * Validează datele unui client
     * @param {Object} data 
     * @returns {Object} - { valid: boolean, errors: Array }
     */
    validate(data) {
        const errors = [];
        
        if (!data.nume_firma?.trim()) {
            errors.push("Numele firmei este obligatoriu");
        }
        
        if (data.cui && !window.ZFlowUtils?.validareCUI(data.cui)) {
            errors.push("CUI invalid");
        }
        
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push("Format email invalid");
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
            judet: formData.judet?.trim() || null,
            tara: formData.tara?.trim() || 'Romania',
            telefon: formData.telefon?.trim() || null,
            email: formData.email?.trim().toLowerCase() || null,
            persoana_contact: formData.persoana_contact?.trim() || null,
            nr_reg_com: formData.nr_reg_com?.trim() || null,
            banca: formData.banca?.trim() || null,
            iban: formData.iban?.trim().replace(/\s/g, '').toUpperCase() || null,
            observatii: formData.observatii?.trim() || null
        };
    }
};

// Export global
window.ZFlowClients = ZFlowClients;
