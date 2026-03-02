/**
 * Z-FLOW Enterprise v7.14
 * Module: Invoices - Gestiune facturi
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowInvoices = {
    /**
     * Obține toate facturile de încasat (clienți)
     * @returns {Array}
     */
    getAllReceivable() {
        return window.ZFlowStore?.dateFacturiBI || [];
    },

    /**
     * Obține toate facturile de plătit (furnizori)
     * @returns {Array}
     */
    getAllPayable() {
        return window.ZFlowStore?.dateFacturiPlatit || [];
    },

    /**
     * Găsește o factură după ID (de încasat)
     * @param {string} id 
     * @returns {Object|null}
     */
    findById(id) {
        return this.getAllReceivable().find(f => f.id === id) || null;
    },

    /**
     * Găsește o factură de plătit după ID
     * @param {string} id 
     * @returns {Object|null}
     */
    findPayableById(id) {
        return this.getAllPayable().find(f => f.id === id) || null;
    },

    /**
     * Obține facturile unui client
     * @param {string} clientId 
     * @returns {Array}
     */
    getByClient(clientId) {
        return this.getAllReceivable().filter(f => f.client_id === clientId);
    },

    /**
     * Obține facturile unui furnizor
     * @param {string} furnizorId 
     * @returns {Array}
     */
    getBySupplier(furnizorId) {
        return this.getAllPayable().filter(f => f.furnizor_id === furnizorId);
    },

    /**
     * Filtrează facturi după status
     * @param {Array} facturi 
     * @param {string} status - Incasat | Neincasat | Platit | toate
     * @returns {Array}
     */
    filterByStatus(facturi, status) {
        if (status === 'toate' || !status) return facturi;
        return facturi.filter(f => f.status_plata === status);
    },

    /**
     * Filtrează facturi după perioadă
     * @param {Array} facturi 
     * @param {Date} startDate 
     * @param {Date} endDate 
     * @returns {Array}
     */
    filterByPeriod(facturi, startDate, endDate) {
        return facturi.filter(f => {
            const dataFactura = new Date(f.data_emitere || f.created_at);
            return dataFactura >= startDate && dataFactura <= endDate;
        });
    },

    /**
     * Obține facturile restante (depășite)
     * @param {Array} facturi 
     * @returns {Array}
     */
    getOverdue(facturi = null) {
        const lista = facturi || this.getAllReceivable();
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        
        return lista.filter(f => {
            if (f.status_plata === 'Incasat' || f.status_plata === 'Platit') return false;
            const scadenta = new Date(f.data_scadenta);
            return scadenta < azi;
        });
    },

    /**
     * Obține facturile care scad în curând (7 zile)
     * @param {Array} facturi 
     * @param {number} zile - Număr de zile anticipate
     * @returns {Array}
     */
    getDueSoon(facturi = null, zile = 7) {
        const lista = facturi || this.getAllReceivable();
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        const limita = new Date(azi);
        limita.setDate(limita.getDate() + zile);
        
        return lista.filter(f => {
            if (f.status_plata === 'Incasat' || f.status_plata === 'Platit') return false;
            const scadenta = new Date(f.data_scadenta);
            return scadenta >= azi && scadenta <= limita;
        });
    },

    /**
     * Sortează facturi
     * @param {Array} facturi 
     * @param {string} by - data | suma | scadenta
     * @param {string} order - asc | desc
     * @returns {Array}
     */
    sort(facturi, by = 'data', order = 'desc') {
        return [...facturi].sort((a, b) => {
            let valA, valB;
            
            switch (by) {
                case 'suma':
                    valA = parseFloat(a.suma) || 0;
                    valB = parseFloat(b.suma) || 0;
                    break;
                case 'scadenta':
                    valA = new Date(a.data_scadenta || 0).getTime();
                    valB = new Date(b.data_scadenta || 0).getTime();
                    break;
                default: // data
                    valA = new Date(a.data_emitere || a.created_at || 0).getTime();
                    valB = new Date(b.data_emitere || b.created_at || 0).getTime();
            }
            
            return order === 'asc' ? valA - valB : valB - valA;
        });
    },

    /**
     * Calculează totaluri pentru un set de facturi
     * @param {Array} facturi 
     * @returns {Object}
     */
    calculeazaTotaluri(facturi) {
        let total = 0, incasat = 0, neincasat = 0, restant = 0;
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        
        facturi.forEach(f => {
            const suma = parseFloat(f.suma) || 0;
            total += suma;
            
            if (f.status_plata === 'Incasat' || f.status_plata === 'Platit') {
                incasat += suma;
            } else {
                neincasat += suma;
                const scadenta = new Date(f.data_scadenta);
                if (scadenta < azi) {
                    restant += suma;
                }
            }
        });
        
        return { total, incasat, neincasat, restant };
    },

    /**
     * Verifică dacă factura e protejată (SAGA/ANAF)
     * @param {Object} factura 
     * @returns {boolean}
     */
    isProtected(factura) {
        return factura.sursa === 'SAGA' || factura.sursa === 'ANAF';
    },

    /**
     * Validează datele unei facturi
     * @param {Object} data 
     * @returns {Object}
     */
    validate(data) {
        const errors = [];
        
        if (!data.nr_factura?.trim()) {
            errors.push("Numărul facturii este obligatoriu");
        }
        
        if (!data.suma || parseFloat(data.suma) <= 0) {
            errors.push("Suma trebuie să fie mai mare decât 0");
        }
        
        if (!data.data_emitere) {
            errors.push("Data emiterii este obligatorie");
        }
        
        if (!data.data_scadenta) {
            errors.push("Data scadenței este obligatorie");
        }
        
        if (data.data_emitere && data.data_scadenta) {
            const emitere = new Date(data.data_emitere);
            const scadenta = new Date(data.data_scadenta);
            if (scadenta < emitere) {
                errors.push("Data scadenței nu poate fi înainte de data emiterii");
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Pregătește payload pentru salvare
     * @param {Object} formData 
     * @param {string} clientId 
     * @returns {Object}
     */
    preparePayload(formData, clientId) {
        return {
            client_id: clientId,
            nr_factura: formData.nr_factura?.trim() || '',
            suma: parseFloat(formData.suma) || 0,
            data_emitere: formData.data_emitere || new Date().toISOString().split('T')[0],
            data_scadenta: formData.data_scadenta || null,
            status_plata: formData.status_plata || 'Neincasat',
            descriere: formData.descriere?.trim() || null,
            observatii: formData.observatii?.trim() || null,
            pdf_url: formData.pdf_url || null
        };
    },

    /**
     * Generează număr factură automat
     * @param {string} prefix - Prefix (ex: "ZF")
     * @returns {string}
     */
    generateNumber(prefix = 'ZF') {
        const year = new Date().getFullYear().toString().slice(-2);
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 9000) + 1000;
        return `${prefix}${year}${month}-${random}`;
    }
};

// Export global
window.ZFlowInvoices = ZFlowInvoices;
