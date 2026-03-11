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
            const suma = parseFloat(f.valoare ?? f.suma) /* [R4-FIX 4] */ || 0;
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
            const suma = parseFloat(f.valoare ?? f.suma) /* [R4-FIX 4] */ || 0;
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
                    incLuna += parseFloat(f.valoare ?? f.suma) /* [R4-FIX 4] */ || 0;
                }
            });
            incasari.push(incLuna);
            
            // Calculează plăți în luna respectivă
            let platLuna = 0;
            facturiPlat.forEach(f => {
                const dataScadenta = new Date(f.data_scadenta);
                if (dataScadenta >= startLuna && dataScadenta <= endLuna) {
                    platLuna += parseFloat(f.valoare ?? f.suma) /* [R4-FIX 4] */ || 0;
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
            const data = new Date(f.data_emiterii || f.created_at); // [RISK-FIX 5]
            return data >= startDate && data <= endDate;
        });
        
        const filteredPlat = facturiPlat.filter(f => {
            const data = new Date(f.data_emiterii || f.created_at); // [RISK-FIX 5]
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
            const emitere = new Date(f.data_emiterii); // [RISK-FIX 5]
            const incasare = new Date(f.data_incasare);
            totalZile += Math.abs(incasare - emitere) / (1000 * 60 * 60 * 24);
        });
        
        return Math.round(totalZile / incasate.length);
    },

    // ── Lazy-load Chart.js on demand ──────────────────────────────────────
    _loadScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = url; s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
        });
    },
    async _ensureChartJS() {
        if (window.Chart) return;
        await this._loadScript('https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js');
    },

    /**
     * Randează cashflow chart pe canvasul dat — încarcă Chart.js la cerere
     * @param {string} canvasId
     * @param {number} months
     */
    async renderCashflowChart(canvasId, months = 6) {
        await this._ensureChartJS();
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const { labels, incasari, plati } = this.getCashflowData(months);
        if (canvas._chartInstance) canvas._chartInstance.destroy();
        canvas._chartInstance = new window.Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Intrări',  data: incasari, backgroundColor: 'rgba(52,211,153,0.7)', borderRadius: 4 },
                    { label: 'Ieșiri',   data: plati,    backgroundColor: 'rgba(248,113,113,0.7)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { font: { size: 9 } } },
                    x: { ticks: { font: { size: 9 } } }
                }
            }
        });
    }
};

// Export global
window.ZFlowAnalytics = ZFlowAnalytics;

// =========================================================
// CASHFLOW PROIECTIE ZILNICA — [R10-FIX 4]
// =========================================================

/**
 * Calculeaza proiectia cashflow zilnica pe N zile viitoare.
 * Diferit fata de calculeazaCashflowForecast (din features.js) care returneaza
 * totaluri agregate — aceasta returneaza sold zilnic cumulativ pentru graf.
 *
 * @param {number} zile - Numarul de zile de proiectat (implicit 90)
 * @param {number} soldInitial - Soldul curent de pornire (implicit 0)
 * @returns {Array<{ data: string, sold_estimat: number, intrari: number, iesiri: number }>}
 */
function calculeazaCashflowProiectie(zile, soldInitial) {
    zile = parseInt(zile) || 90;
    soldInitial = parseFloat(soldInitial) || 0;

    var facturiInc  = (window.ZFlowStore && window.ZFlowStore.dateFacturiBI) ? window.ZFlowStore.dateFacturiBI : [];
    var facturiPlat = (window.ZFlowStore && window.ZFlowStore.dateFacturiPlatit) ? window.ZFlowStore.dateFacturiPlatit : [];

    // Construieste map: data ISO → { intrari, iesiri }
    var zilMap = {};
    var azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Pre-populaza toate zilele cu 0
    for (var i = 0; i < zile; i++) {
        var d = new Date(azi.getTime() + i * 86400000);
        var key = d.toISOString().split('T')[0];
        zilMap[key] = { intrari: 0, iesiri: 0 };
    }

    // Distribuie facturile neincasate pe ziua de scadenta
    facturiInc.forEach(function(f) {
        if (f.status_plata === 'Incasat') return;
        var key2 = (f.data_scadenta || '').split('T')[0];
        if (zilMap[key2]) {
            zilMap[key2].intrari += parseFloat(f.valoare || 0);
        }
    });

    facturiPlat.forEach(function(f) {
        if (f.status_plata === 'Platit') return;
        var key3 = (f.data_scadenta || '').split('T')[0];
        if (zilMap[key3]) {
            zilMap[key3].iesiri += parseFloat(f.valoare || 0);
        }
    });

    // Calculeaza sold cumulativ
    var soldCurent = soldInitial;
    var rezultat = Object.entries(zilMap)
        .sort(function(a, b) { return a[0].localeCompare(b[0]); })
        .map(function(entry) {
            var data = entry[0];
            var intrari = entry[1].intrari;
            var iesiri = entry[1].iesiri;
            soldCurent += intrari - iesiri;
            return { data: data, sold_estimat: Math.round(soldCurent * 100) / 100, intrari: intrari, iesiri: iesiri };
        });

    return rezultat;
}
window.calculeazaCashflowProiectie = calculeazaCashflowProiectie;

/**
 * Verifica daca soldul proiectat devine negativ in urmatoarele 30 de zile.
 * Daca da, afiseaza o alerta automata.
 *
 * @param {number} soldInitial
 */
function verificaAlertaCashflow(soldInitial) {
    var proiectie30 = calculeazaCashflowProiectie(30, soldInitial || 0);
    var primaZiNegativa = proiectie30.find(function(z) { return z.sold_estimat < 0; });
    if (primaZiNegativa) {
        var formatData = new Date(primaZiNegativa.data).toLocaleDateString('ro-RO', {
            day: '2-digit', month: 'short'
        });
        if (typeof showNotification === 'function') {
            showNotification(
                'Cashflow negativ estimat pe ' + formatData + ' (' + primaZiNegativa.sold_estimat.toLocaleString('ro-RO') + ' RON)',
                'warning',
                8000
            );
        }
        if (window.ZFlowLogger && typeof ZFlowLogger.warn === 'function') {
            ZFlowLogger.warn('Cashflow', 'Sold negativ proiectat', primaZiNegativa);
        }
    }
}
window.verificaAlertaCashflow = verificaAlertaCashflow;

/**
 * Randeaza graful de proiectie cashflow folosind Chart.js.
 * Creeaza canvas daca nu exista; actualizeaza daca exista.
 *
 * Zona verde = sold pozitiv, zona rosie = sold negativ.
 *
 * @param {string} containerId - ID-ul div-ului container
 * @param {number} zile - 30 | 60 | 90
 * @param {number} soldInitial - Sold de pornire
 */
async function renderCashflowProiectieGraf(containerId, zile, soldInitial) {
    zile = parseInt(zile) || 90;
    var container = document.getElementById(containerId);
    if (!container) return;

    // Asigura Chart.js
    if (!window.Chart) {
        await new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    var proiectie = calculeazaCashflowProiectie(zile, soldInitial);
    var labels = proiectie.map(function(p) {
        return new Date(p.data).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
    });
    var values = proiectie.map(function(p) { return p.sold_estimat; });

    var pointColors = values.map(function(v) { return v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'; });
    var lineColor   = values.some(function(v) { return v < 0; }) ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)';

    var canvas = container.querySelector('canvas#cashflow-proiectie-canvas');
    if (!canvas) {
        container.innerHTML = '<canvas id="cashflow-proiectie-canvas" style="max-height:220px"></canvas>';
        canvas = container.querySelector('canvas');
    }

    if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
    }

    canvas._chartInstance = new window.Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sold estimat (RON)',
                data: values,
                borderColor: lineColor,
                backgroundColor: values.map(function(v) {
                    return v >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
                }),
                pointBackgroundColor: pointColors,
                pointRadius: 2,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.3,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            var v = ctx.raw;
                            var pz = proiectie[ctx.dataIndex];
                            return [
                                ' Sold: ' + v.toLocaleString('ro-RO') + ' RON',
                                ' Intrari: +' + pz.intrari.toLocaleString('ro-RO'),
                                ' Iesiri: -' + pz.iesiri.toLocaleString('ro-RO'),
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { font: { size: 8 }, maxTicksLimit: 10 },
                    grid: { display: false }
                },
                y: {
                    ticks: {
                        font: { size: 9 },
                        callback: function(v) { return v.toLocaleString('ro-RO') + ' RON'; }
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });

    // Alerta automata daca sold negativ in 30 zile
    if (zile >= 30) verificaAlertaCashflow(soldInitial);
}
window.renderCashflowProiectieGraf = renderCashflowProiectieGraf;
