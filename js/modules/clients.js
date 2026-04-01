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
            user_id: (typeof _getCurrentUserId === 'function' ? _getCurrentUserId() : null),
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

// ==========================================
// [FEAT 2.2] ISTORIC FACTURI CLIENT
// ==========================================

/**
 * Randează istoricul facturilor pentru un client în #client-invoice-history.
 * Sortare descrescătoare după data emiterii, running total, viteza medie plată.
 * @param {string|number} clientId
 */
function renderClientInvoiceHistory(clientId) {
    const container = document.getElementById('client-invoice-history');
    if (!container) {
        ZFlowLogger.warn('clients', '[renderClientInvoiceHistory] Container #client-invoice-history lipsă din DOM');
        return;
    }

    const facturi = (window.ZFlowStore?.dateFacturiBI || [])
        .filter(f => String(f.client_id) === String(clientId))
        .sort((a, b) => {
            const da = a.data_emiterii || a.data_emitere || '';
            const db = b.data_emiterii || b.data_emitere || '';
            return db.localeCompare(da);
        });

    if (facturi.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic p-3">Fără facturi înregistrate.</p>';
        return;
    }

    // Calcul viteza medie de plată (doar facturi Incasat cu ambele date)
    let totalZile = 0, nrPlatite = 0;
    facturi.forEach(f => {
        if ((f.status_plata === 'Incasat' || f.status_plata === 'Platit') && f.data_emiterii && f.data_scadenta) {
            const emit = new Date(f.data_emiterii.length === 10 ? f.data_emiterii + 'T12:00:00' : f.data_emiterii);
            const scad = new Date(f.data_scadenta.length === 10 ? f.data_scadenta + 'T12:00:00' : f.data_scadenta);
            const zile = Math.round((scad - emit) / 86400000);
            if (zile > 0) { totalZile += zile; nrPlatite++; }
        }
    });
    const medieZile = nrPlatite > 0 ? Math.round(totalZile / nrPlatite) : null;

    // Running total descrescător (suma cumulată de la cel mai recent la cel mai vechi)
    let cumul = 0;
    const items = facturi.map(f => {
        const v = Number(f.valoare || f.suma || 0);
        cumul += v;
        const statusCls = f.status_plata === 'Incasat' || f.status_plata === 'Platit'
            ? 'bg-emerald-100 text-emerald-700'
            : f.status_plata === 'Incasat Partial'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700';
        const fmt = typeof formateazaDataZFlow === 'function' ? formateazaDataZFlow : (d => d);
        return `<div class="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0 text-xs">
            <div class="flex-1 min-w-0">
                <span class="font-semibold text-slate-700 truncate">${f.numar_factura || f.nr_factura || '—'}</span>
                <span class="text-slate-400 ml-1">${fmt(f.data_emiterii || f.data_emitere || '')}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="font-bold text-slate-800">${v.toLocaleString('ro-RO')} RON</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${statusCls}">${f.status_plata || '?'}</span>
                <span class="text-slate-300 text-[9px]">Σ ${cumul.toLocaleString('ro-RO')}</span>
            </div>
        </div>`;
    }).join('');

    const medieTxt = medieZile != null
        ? `<p class="text-[10px] text-slate-400 mt-2">Termen mediu scadență: <strong>${medieZile} zile</strong> (din ${nrPlatite} facturi încasate)</p>`
        : '';

    container.innerHTML = `<div class="px-1">${items}${medieTxt}</div>`;
}
window.renderClientInvoiceHistory = renderClientInvoiceHistory;

// Export global
window.ZFlowClients = ZFlowClients;
