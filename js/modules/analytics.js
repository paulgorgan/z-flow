/**
 * Z-FLOW Enterprise v7.14
 * Module: Analytics - Dashboard și Business Intelligence
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowAnalytics = {
    /**
     * Calculează KPI-uri pentru dashboard
     * @returns {Object}
     */
    getKPIs() {
        const facturiInc = window.ZFlowStore?.dateFacturiBI || [];
        const facturiPlat = window.ZFlowStore?.dateFacturiPlatit || [];
        const clienti = window.ZFlowStore?.dateLocal || [];
        const furnizori = window.ZFlowStore?.dateFurnizori || [];
        
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        
        // Calcul încasări
        let totalDeIncasat = 0, incasat = 0, restantInc = 0;
        facturiInc.forEach(f => {
            const suma = parseFloat(f.suma) || 0;
            if (f.status_plata === 'Incasat') {
                incasat += suma;
            } else {
                totalDeIncasat += suma;
                if (new Date(f.data_scadenta) < azi) {
                    restantInc += suma;
                }
            }
        });
        
        // Calcul plăți
        let totalDePlata = 0, platit = 0, restantPlat = 0;
        facturiPlat.forEach(f => {
            const suma = parseFloat(f.suma) || 0;
            if (f.status_plata === 'Platit') {
                platit += suma;
            } else {
                totalDePlata += suma;
                if (new Date(f.data_scadenta) < azi) {
                    restantPlat += suma;
                }
            }
        });
        
        return {
            clienti: clienti.length,
            furnizori: furnizori.length,
            facturiDeIncasat: facturiInc.filter(f => f.status_plata !== 'Incasat').length,
            facturiDePlata: facturiPlat.filter(f => f.status_plata !== 'Platit').length,
            totalDeIncasat,
            totalDePlata,
            incasat,
            platit,
            restantInc,
            restantPlat,
            cashflow: totalDeIncasat - totalDePlata,
            cashflowReal: incasat - platit
        };
    },

    /**
     * Calculează date pentru cashflow chart (pe luni)
     * @param {number} months - Număr de luni în trecut
     * @returns {Object} - { labels, incasari, plati }
     */
    getCashflowData(months = 6) {
        const facturiInc = window.ZFlowStore?.dateFacturiBI || [];
        const facturiPlat = window.ZFlowStore?.dateFacturiPlatit || [];
        
        const labels = [];
        const incasari = [];
        const plati = [];
        
        const azi = new Date();
        
        for (let i = months - 1; i >= 0; i--) {
            const data = new Date(azi.getFullYear(), azi.getMonth() - i, 1);
            const luna = data.toLocaleDateString('ro-RO', { month: 'short', year: '2-digit' });
            labels.push(luna);
            
            const startLuna = new Date(data.getFullYear(), data.getMonth(), 1);
            const endLuna = new Date(data.getFullYear(), data.getMonth() + 1, 0);
            
            // Calculează încasări în luna respectivă
            let incLuna = 0;
            facturiInc.forEach(f => {
                const dataScadenta = new Date(f.data_scadenta);
                if (dataScadenta >= startLuna && dataScadenta <= endLuna) {
                    incLuna += parseFloat(f.suma) || 0;
                }
            });
            incasari.push(incLuna);
            
            // Calculează plăți în luna respectivă
            let platLuna = 0;
            facturiPlat.forEach(f => {
                const dataScadenta = new Date(f.data_scadenta);
                if (dataScadenta >= startLuna && dataScadenta <= endLuna) {
                    platLuna += parseFloat(f.suma) || 0;
                }
            });
            plati.push(platLuna);
        }
        
        return { labels, incasari, plati };
    },

    /**
     * Obține statistici pe perioadă
     * @param {Date} startDate 
     * @param {Date} endDate 
     * @returns {Object}
     */
    getStatsByPeriod(startDate, endDate) {
        const facturiInc = window.ZFlowStore?.dateFacturiBI || [];
        const facturiPlat = window.ZFlowStore?.dateFacturiPlatit || [];
        
        const filteredInc = facturiInc.filter(f => {
            const data = new Date(f.data_emiterii || f.data_emitere || f.created_at);
            return data >= startDate && data <= endDate;
        });
        
        const filteredPlat = facturiPlat.filter(f => {
            const data = new Date(f.data_emiterii || f.data_emitere || f.created_at);
            return data >= startDate && data <= endDate;
        });
        
        const statsInc = window.ZFlowInvoices?.calculeazaTotaluri(filteredInc) || {};
        const statsPlat = window.ZFlowInvoices?.calculeazaTotaluri(filteredPlat) || {};
        
        return {
            incasari: statsInc,
            plati: statsPlat,
            facturiIncasari: filteredInc.length,
            facturiPlati: filteredPlat.length,
            period: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            }
        };
    },

    /**
     * Top 5 clienți după valoare facturi
     * @returns {Array}
     */
    getTopClients(limit = 5) {
        const clienti = window.ZFlowStore?.dateLocal || [];
        
        const clientiCuValoare = clienti.map(c => {
            const totaluri = window.ZFlowClients?.calculeazaTotaluri(c) || { total: 0 };
            return {
                id: c.id,
                nume: c.nume_firma,
                total: totaluri.total,
                restant: totaluri.restant
            };
        });
        
        return clientiCuValoare
            .sort((a, b) => b.total - a.total)
            .slice(0, limit);
    },

    /**
     * Top 5 furnizori după valoare facturi
     * @returns {Array}
     */
    getTopSuppliers(limit = 5) {
        const furnizori = window.ZFlowStore?.dateFurnizori || [];
        
        const furnizoriCuValoare = furnizori.map(f => {
            const totaluri = window.ZFlowSuppliers?.calculeazaTotaluri(f.id) || { total: 0 };
            return {
                id: f.id,
                nume: f.nume_firma,
                total: totaluri.total,
                dePlata: totaluri.dePlata
            };
        });
        
        return furnizoriCuValoare
            .sort((a, b) => b.total - a.total)
            .slice(0, limit);
    },

    /**
     * Obține facturi cu scadență apropiată (pentru notificări)
     * @param {number} zile 
     * @returns {Object} - { inCurand: Array, restante: Array }
     */
    getAlerts(zile = 7) {
        const inCurand = window.ZFlowInvoices?.getDueSoon(null, zile) || [];
        const restante = window.ZFlowInvoices?.getOverdue() || [];
        
        return {
            inCurand,
            restante,
            totalAlerte: inCurand.length + restante.length
        };
    },

    /**
     * Calculează rata de încasare
     * @returns {number} - Procentaj (0-100)
     */
    getCollectionRate() {
        const facturi = window.ZFlowStore?.dateFacturiBI || [];
        if (facturi.length === 0) return 0;
        
        const incasate = facturi.filter(f => f.status_plata === 'Incasat').length;
        return Math.round((incasate / facturi.length) * 100);
    },

    /**
     * Calculează average days to pay (DSO)
     * @returns {number} - Număr mediu de zile
     */
    getDSO() {
        const facturi = window.ZFlowStore?.dateFacturiBI || [];
        const incasate = facturi.filter(f => f.status_plata === 'Incasat' && f.data_incasare);
        
        if (incasate.length === 0) return 0;
        
        let totalZile = 0;
        incasate.forEach(f => {
            const emitere = new Date(f.data_emiterii || f.data_emitere);
            const incasare = new Date(f.data_incasare);
            totalZile += Math.abs(incasare - emitere) / (1000 * 60 * 60 * 24);
        });
        
        return Math.round(totalZile / incasate.length);
    }
};

// Export global
window.ZFlowAnalytics = ZFlowAnalytics;
