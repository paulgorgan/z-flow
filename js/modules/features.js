/**
 * Z-FLOW Enterprise v8.0
 * Modul: Features — Funcționalități Noi
 *
 * Conține implementări pentru:
 *  1. Bifa Verde ANAF e-Factura (validare TVA real-time)
 *  2. Bridge XML — export SAGA / WinMentor / SmartBill
 *  3. SafeFleet / Nexus webhook integration UI
 *  4. Scanner QR end-to-end (recepție / livrare)
 *  5. Cashflow Forecast 30/60/90 zile
 *  6. Multi-firmă — gestionare CUI-uri multiple
 *  7. Raport km vs. facturi livrate
 *  8. Import XML ANAF (e-Factura UBL 2.1)
 *
 * Toate funcțiile sunt expuse pe window.ZFlowFeatures
 * și ca funcții globale pentru apeluri HTML inline.
 * NU modifică codul existent. NU înlocuiește funcții existente.
 */

// ============================================================
// 1. ANAF e-FACTURA — Validare TVA + Bifa Verde SPV
// ============================================================

/**
 * Verifică dacă o firmă este înregistrată în sistemul e-Factura ANAF
 * și dacă este platitor TVA activ.
 * @param {string} cui - CUI-ul firmei (cu sau fără prefix RO)
 */
async function verificaEFactura(cui) {
    const cuiCurat = String(cui || '').replace(/\D/g, '');
    if (!cuiCurat || cuiCurat.length < 2) {
        if (typeof showNotification === 'function') showNotification('CUI invalid', 'error');
        return;
    }

    if (typeof showNotification === 'function') showNotification('⏳ Verificare ANAF...', 'info', 3000);

    const azi = new Date().toISOString().split('T')[0];
    let rezultat = null;

    try {
        // ANAF API v8 — returnează `scpTVA` (platitor TVA activ) și `inRegistruRO_e_Factura`
        const resp = await fetch('https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ cui: parseInt(cuiCurat), data: azi }])
        });

        if (resp.ok) {
            const json = await resp.json();
            rezultat = json?.found?.[0] || null;
        }
    } catch (corsErr) {
        // CORS probabil — folosim datele din store dacă există
        console.warn('[e-Factura] CORS blocat — verificare locală', corsErr.message);
    }

    // Dacă nu s-a putut face fetch (CORS), afișăm un dialog informativ
    if (!rezultat) {
        _afiseazaModalEFactura({
            cui: cuiCurat,
            platitorTVA: null,
            eFactura: null,
            denumire: '',
            eroare: true
        });
        return;
    }

    const info = {
        cui: cuiCurat,
        denumire: rezultat.denumire || '',
        platitorTVA: rezultat.scpTVA === true,
        statusInactiv: rezultat.statusInactivi === true,
        eFactura: rezultat.inRegistruRO_e_Factura === true,
        stare: rezultat.stare_inregistrare || 'ACTIV',
        eroare: false
    };

    _afiseazaModalEFactura(info);
}

function _afiseazaModalEFactura(info) {
    const container = document.getElementById('modal-efactura-overlay');
    if (!container) {
        // Creăm overlay dinamic dacă nu există în HTML
        const overlay = document.createElement('div');
        overlay.id = 'modal-efactura-overlay';
        overlay.className = 'fixed inset-0 z-[200] flex items-end justify-center p-4';
        overlay.style.background = 'rgba(0,0,0,0.45)';
        overlay.innerHTML = _buildEFacturaHTML(info);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    } else {
        container.innerHTML = _buildEFacturaHTML(info);
        container.style.display = 'flex';
    }
}

function _buildEFacturaHTML(info) {
    if (info.eroare) {
        return `<div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl space-y-3">
            <div class="flex items-center gap-3">
                <span class="text-2xl">⚠️</span>
                <div>
                    <p class="text-[11px] font-black text-slate-800 uppercase">Verificare ANAF</p>
                    <p class="text-[9px] text-slate-400">CUI: ${info.cui}</p>
                </div>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p class="text-[10px] text-amber-700 font-bold">API ANAF nu este accesibil direct din browser (CORS). Instanțiați un proxy server sau utilizați o Edge Function Supabase pentru verificare server-side.</p>
            </div>
            <p class="text-[9px] text-slate-400">Endpoint: webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva</p>
            <button onclick="document.getElementById('modal-efactura-overlay').remove()"
                class="w-full py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase">Închide</button>
        </div>`;
    }
    const eFacturaLabel = info.eFactura === true
        ? '<span class="text-emerald-700 font-black">✅ DA — Înscris în RO e-Factura</span>'
        : info.eFactura === false
        ? '<span class="text-red-600 font-black">❌ NU — Neînscris în RO e-Factura</span>'
        : '<span class="text-slate-400">— informație indisponibilă</span>';
    const tvaLabel = info.platitorTVA
        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full uppercase">✅ Platitor TVA activ</span>'
        : '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-full uppercase">Neplatitor TVA</span>';
    const inactiv = info.statusInactiv ? '<span class="text-[9px] text-red-600 font-bold">⚠️ Firmă INACTIVĂ ANAF</span>' : '';
    return `<div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl space-y-4" onclick="event.stopPropagation()">
        <div class="flex items-start gap-3">
            <span class="text-3xl mt-0.5">${info.eFactura ? '🟢' : '🔴'}</span>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-black text-slate-800 truncate">${info.denumire || 'CUI: ' + info.cui}</p>
                <p class="text-[9px] text-slate-400">CUI ${info.cui} · ${info.stare}</p>
            </div>
        </div>
        <div class="space-y-2 bg-slate-50 rounded-xl p-3">
            <div class="flex justify-between items-center">
                <span class="text-[9px] text-slate-500 font-bold uppercase">e-Factura SPV</span>
                <span class="text-[10px]">${eFacturaLabel}</span>
            </div>
            <div class="flex justify-between items-center border-t border-slate-100 pt-2">
                <span class="text-[9px] text-slate-500 font-bold uppercase">Status TVA</span>
                ${tvaLabel}
            </div>
            ${inactiv ? `<div class="border-t border-slate-100 pt-2">${inactiv}</div>` : ''}
        </div>
        <p class="text-[8px] text-slate-400 text-center">Sursă: ANAF webservicesp.anaf.ro · ${new Date().toLocaleDateString('ro-RO')}</p>
        <button onclick="document.getElementById('modal-efactura-overlay').remove()"
            class="w-full py-3 bg-blue-900 text-white rounded-xl text-[10px] font-black uppercase shadow">OK</button>
    </div>`;
}

window.verificaEFactura = verificaEFactura;


// ============================================================
// 2. BRIDGE XML — Export SAGA / WinMentor / SmartBill
// ============================================================

/**
 * Exportă facturile curente din BI ca XML structurat SAGA-compatibil
 * @param {string} tip - 'clienti' | 'furnizori' | 'ambele'
 */
function exportBridgeXML(tip) {
    tip = tip || 'ambele';
    const facturiInc  = (window.ZFlowStore?.dateFacturiBI || []);
    const facturiPlat = (window.ZFlowStore?.dateFacturiPlatit || []);
    const clienti     = window.ZFlowStore?.dateLocal || [];
    const furnizori   = window.ZFlowStore?.dateFurnizori || [];
    const profil      = window.ZFlowUserProfile || {};

    const firmaEmitent = {
        cui: profil.cui || '',
        denumire: profil.nume_firma || 'Z-FLOW',
        adresa: profil.adresa || '',
        oras: profil.oras || '',
        iban: profil.iban || ''
    };

    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<ZFlowExport versiune="1.0" aplicatie="Z-FLOW Enterprise" exportat="' + new Date().toISOString() + '">');
    lines.push('  <Firma>');
    lines.push('    <CUI>' + _escXML(firmaEmitent.cui) + '</CUI>');
    lines.push('    <Denumire>' + _escXML(firmaEmitent.denumire) + '</Denumire>');
    lines.push('    <Adresa>' + _escXML(firmaEmitent.adresa) + '</Adresa>');
    lines.push('    <Oras>' + _escXML(firmaEmitent.oras) + '</Oras>');
    lines.push('  </Firma>');

    if (tip !== 'furnizori') {
        lines.push('  <FacturiIncasare>');
        facturiInc.forEach(f => {
            const cl = clienti.find(c => String(c.id) === String(f.client_id));
            lines.push('    <Factura>');
            lines.push('      <ID>' + _escXML(String(f.id || '')) + '</ID>');
            lines.push('      <NrFactura>' + _escXML(f.nr_factura || '') + '</NrFactura>');
            lines.push('      <DataEmitere>' + (f.data_emitere || '') + '</DataEmitere>');
            lines.push('      <DataScadenta>' + (f.data_scadenta || '') + '</DataScadenta>');
            lines.push('      <Suma>' + (parseFloat(f.suma) || 0).toFixed(2) + '</Suma>');
            lines.push('      <TVA>' + (parseFloat(f.tva) || 0).toFixed(2) + '</TVA>');
            lines.push('      <StatusPlata>' + _escXML(f.status_plata || 'Neincasat') + '</StatusPlata>');
            lines.push('      <UIT>' + _escXML(f.uit || '') + '</UIT>');
            lines.push('      <Descriere>' + _escXML(f.descriere || '') + '</Descriere>');
            if (cl) {
                lines.push('      <Client>');
                lines.push('        <CUI>' + _escXML(cl.cui || '') + '</CUI>');
                lines.push('        <Denumire>' + _escXML(cl.nume_firma || '') + '</Denumire>');
                lines.push('        <Adresa>' + _escXML(cl.adresa || '') + '</Adresa>');
                lines.push('        <IBAN>' + _escXML(cl.iban || '') + '</IBAN>');
                lines.push('      </Client>');
            }
            lines.push('    </Factura>');
        });
        lines.push('  </FacturiIncasare>');
    }

    if (tip !== 'clienti') {
        lines.push('  <FacturiPlata>');
        facturiPlat.forEach(f => {
            const furn = furnizori.find(x => String(x.id) === String(f.furnizor_id));
            lines.push('    <Factura>');
            lines.push('      <ID>' + _escXML(String(f.id || '')) + '</ID>');
            lines.push('      <NrFactura>' + _escXML(f.nr_factura || '') + '</NrFactura>');
            lines.push('      <DataEmitere>' + (f.data_emitere || '') + '</DataEmitere>');
            lines.push('      <DataScadenta>' + (f.data_scadenta || '') + '</DataScadenta>');
            lines.push('      <Suma>' + (parseFloat(f.suma) || 0).toFixed(2) + '</Suma>');
            lines.push('      <TVA>' + (parseFloat(f.tva) || 0).toFixed(2) + '</TVA>');
            lines.push('      <StatusPlata>' + _escXML(f.status_plata || 'Neplatit') + '</StatusPlata>');
            lines.push('      <Descriere>' + _escXML(f.descriere || '') + '</Descriere>');
            if (furn) {
                lines.push('      <Furnizor>');
                lines.push('        <CUI>' + _escXML(furn.cui || '') + '</CUI>');
                lines.push('        <Denumire>' + _escXML(furn.nume_firma || '') + '</Denumire>');
                lines.push('        <Adresa>' + _escXML(furn.adresa || '') + '</Adresa>');
                lines.push('        <IBAN>' + _escXML(furn.iban || '') + '</IBAN>');
                lines.push('      </Furnizor>');
            }
            lines.push('    </Factura>');
        });
        lines.push('  </FacturiPlata>');
    }

    lines.push('</ZFlowExport>');

    const xml = lines.join('\n');
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'zflow_bridge_' + new Date().toISOString().split('T')[0] + '.xml';
    a.click();
    if (typeof showNotification === 'function') showNotification('✅ Export XML Bridge finalizat', 'success');
}

function _escXML(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

window.exportBridgeXML = exportBridgeXML;


// ============================================================
// 3. SAFEFLEET / NEXUS — Integrare webhook Make.com → Supabase
// ============================================================

const ZFlowSafeFleet = {
    _LS_KEY: 'zflow_safefleet_config',

    getConfig() {
        try { return JSON.parse(localStorage.getItem(this._LS_KEY) || '{}'); } catch(e) { return {}; }
    },

    saveConfig(webhookUrl, apiKey) {
        const cfg = { webhookUrl: webhookUrl || '', apiKey: apiKey || '', savedAt: new Date().toISOString() };
        localStorage.setItem(this._LS_KEY, JSON.stringify(cfg));
        if (typeof showNotification === 'function') showNotification('✅ Configurație SafeFleet salvată', 'success');
        this.renderPanel();
    },

    getLastSync() {
        try { return JSON.parse(localStorage.getItem('zflow_safefleet_lastsync') || 'null'); } catch(e) { return null; }
    },

    async testConexiune() {
        const cfg = this.getConfig();
        if (!cfg.webhookUrl) {
            if (typeof showNotification === 'function') showNotification('Configurați mai întâi URL-ul webhook', 'error');
            return;
        }
        if (typeof showNotification === 'function') showNotification('⏳ Testare webhook...', 'info', 3000);
        try {
            const r = await fetch(cfg.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: true, source: 'Z-FLOW', timestamp: Date.now() })
            });
            if (r.ok) {
                if (typeof showNotification === 'function') showNotification('✅ Webhook răspunde corect!', 'success');
            } else {
                if (typeof showNotification === 'function') showNotification('⚠️ Webhook accesibil dar status: ' + r.status, 'warning');
            }
        } catch(e) {
            if (typeof showNotification === 'function') showNotification('❌ Webhook inaccesibil: ' + e.message, 'error');
        }
    },

    async syncManual() {
        const vehicule = window.ZFlowStore?.dateVehicule || [];
        if (!vehicule.length) {
            if (typeof showNotification === 'function') showNotification('Nu există vehicule înregistrate', 'error');
            return;
        }
        // Simulăm un update de coordonate GPS pentru demonstrație
        const updated = vehicule.map(v => ({
            nr_inmatriculare: v.nr_inmatriculare,
            lat: v.locatie_lat || null,
            lng: v.locatie_lng || null,
            viteza_kmh: v.viteza_kmh || 0,
            ultima_actualizare: v.updatedGPS || null
        }));
        const now = new Date().toISOString();
        localStorage.setItem('zflow_safefleet_lastsync', JSON.stringify({ ts: now, vehicule: updated.length }));
        if (typeof showNotification === 'function') showNotification(`🛰️ Sync manual: ${updated.length} vehicule procesate`, 'success');
        this.renderPanel();
    },

    renderPanel() {
        const el = document.getElementById('safefleet-panel-content');
        if (!el) return;
        const cfg = this.getConfig();
        const sync = this.getLastSync();
        el.innerHTML = `
            <div class="space-y-3">
                <div class="bg-slate-50 rounded-xl p-3 space-y-2">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">URL Webhook Make.com</p>
                    <input id="sf-webhook-url" type="url" placeholder="https://hook.eu1.make.com/..." value="${cfg.webhookUrl || ''}"
                        class="w-full p-2.5 bg-white rounded-lg text-[10px] font-bold border border-slate-200 outline-none focus:border-blue-300"/>
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">API Key SafeFleet (opțional)</p>
                    <input id="sf-api-key" type="password" placeholder="••••••••" value="${cfg.apiKey || ''}"
                        class="w-full p-2.5 bg-white rounded-lg text-[10px] font-bold border border-slate-200 outline-none"/>
                </div>
                ${sync ? `<div class="flex items-center gap-2 bg-emerald-50 rounded-xl p-2.5">
                    <span class="text-emerald-600 text-xs">🛰️</span>
                    <span class="text-[9px] text-emerald-700 font-bold">Ultimul sync: ${new Date(sync.ts).toLocaleString('ro-RO')} (${sync.vehicule} vehicule)</span>
                </div>` : `<p class="text-[9px] text-slate-400 italic text-center">Niciun sync efectuat încă</p>`}
                <div class="grid grid-cols-3 gap-2">
                    <button onclick="ZFlowSafeFleet.saveConfig(document.getElementById('sf-webhook-url').value, document.getElementById('sf-api-key').value)"
                        class="py-2.5 bg-blue-900 text-white rounded-xl text-[9px] font-black uppercase col-span-1">Salvează</button>
                    <button onclick="ZFlowSafeFleet.testConexiune()"
                        class="py-2.5 bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase">Test</button>
                    <button onclick="ZFlowSafeFleet.syncManual()"
                        class="py-2.5 bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase">Sync</button>
                </div>
                <div class="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p class="text-[8px] text-amber-700 font-bold leading-relaxed">
                        <strong>Flux recomandat:</strong> SafeFleet/Nexus → Make.com (scenariul de normalizare GPS) → Webhook → Supabase table <code>vehicule</code> (câmpuri locatie_lat, locatie_lng). Funcția <code>actualizaMarkerePeHarta()</code> preia automat coordonatele la fiecare render hartă.
                    </p>
                </div>
            </div>`;
    }
};

window.ZFlowSafeFleet = ZFlowSafeFleet;


// ============================================================
// 4. SCANNER QR END-TO-END — Recepție / Livrare
// ============================================================

/**
 * Procesează rezultatul scanat și încearcă să găsească
 * un produs (în produse), o recepție sau o livrare în store.
 * @param {string} cod - Codul scanat (QR, barcode, etc.)
 */
function processScanResult(cod) {
    const barcodeEl = document.getElementById('barcode-value');
    if (barcodeEl) barcodeEl.innerText = cod;

    const produse   = window.ZFlowStore?.dateProduse || [];
    const receptii  = window.ZFlowStore?.dateReceptii || [];
    const livrari   = window.ZFlowStore?.dateLivrari || [];
    const comenzi   = window.ZFlowStore?.dateComenziTransport || [];

    // Căutare după SKU sau cod_bare produs
    const produs = produse.find(p =>
        String(p.sku || '').trim() === cod.trim() ||
        String(p.cod_bare || '').trim() === cod.trim() ||
        String(p.cod || '').trim() === cod.trim()
    );

    // Căutare recepție după NR document
    const receptie = receptii.find(r => String(r.nr_doc || '').trim() === cod.trim());

    // Căutare livrare sau comandă după tracking
    const livrare = livrari.find(l => String(l.nr_doc || '').trim() === cod.trim());
    const comanda = comenzi.find(c => String(c.tracking_code || '').trim() === cod.trim());

    const resultEl = document.getElementById('scanner-result-panel');
    if (!resultEl) return;

    if (produs) {
        _renderScanProdus(produs, resultEl);
    } else if (receptie) {
        _renderScanReceptie(receptie, resultEl);
    } else if (livrare) {
        _renderScanLivrare(livrare, resultEl);
    } else if (comanda) {
        _renderScanComanda(comanda, resultEl);
    } else {
        resultEl.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p class="text-2xl mb-2">🔍</p>
            <p class="text-[11px] font-black text-amber-800 uppercase">Cod neregsit</p>
            <p class="text-[9px] text-amber-600 mt-1 font-mono break-all">${_escXML(cod)}</p>
            <p class="text-[8px] text-slate-400 mt-2">Verificat: produse · recepții · livrări · comenzi transport</p>
        </div>`;
    }
}

function _calcStocScan(produsId) {
    return (window.ZFlowStore?.dateMiscariStoc || [])
        .filter(m => String(m.produs_id) === String(produsId))
        .reduce((s, m) => m.tip === 'Intrare' ? s + Number(m.cantitate) : s - Number(m.cantitate), 0);
}

function _renderScanProdus(p, el) {
    const stoc = _calcStocScan(p.id);
    const stocColor = stoc <= 0 ? 'text-red-600' : (p.stoc_min && stoc < Number(p.stoc_min)) ? 'text-amber-600' : 'text-emerald-600';
    el.innerHTML = `<div class="bg-white rounded-2xl p-4 border-2 border-blue-200 space-y-3">
        <div class="flex items-start gap-3">
            <span class="text-3xl">📦</span>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-black text-blue-900 truncate">${_escXML(p.denumire || p.nume || '')}</p>
                <p class="text-[9px] text-slate-400">SKU: ${_escXML(p.sku || p.cod || '—')}</p>
            </div>
            <span class="text-xl font-black ${stocColor} flex-shrink-0">${stoc}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[9px]">
            <div class="bg-slate-50 rounded-xl p-2">
                <p class="text-slate-400 uppercase font-bold">Preț achiz.</p>
                <p class="font-black text-slate-800">${Number(p.pret_achizitie||0).toLocaleString('ro-RO')} RON</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-2">
                <p class="text-slate-400 uppercase font-bold">Stoc min</p>
                <p class="font-black text-slate-800">${p.stoc_min || '—'}</p>
            </div>
        </div>
        <div class="flex gap-2">
            <button onclick="_scanActiuneRapidaIntrare('${p.id}')" class="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase">+ Intrare</button>
            <button onclick="_scanActiuneRapidaIesire('${p.id}')" class="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase">− Ieșire</button>
        </div>
    </div>`;
}

function _renderScanReceptie(r, el) {
    el.innerHTML = `<div class="bg-white rounded-2xl p-4 border-2 border-emerald-200 space-y-3">
        <div class="flex items-center gap-3">
            <span class="text-3xl">📥</span>
            <div>
                <p class="text-sm font-black text-emerald-900">Recepție ${_escXML(r.nr_doc || '')}</p>
                <p class="text-[9px] text-slate-400">${r.data || ''} · ${r.status || 'Activ'}</p>
            </div>
        </div>
        <div class="bg-slate-50 rounded-xl p-3 space-y-1 text-[9px]">
            <div class="flex justify-between"><span class="text-slate-400 uppercase font-bold">Furnizor</span><span class="font-black text-slate-700">${_escXML(r.furnizor || r.furnizor_id || '—')}</span></div>
            <div class="flex justify-between"><span class="text-slate-400 uppercase font-bold">Valoare</span><span class="font-black text-slate-700">${Number(r.valoare||0).toLocaleString('ro-RO')} RON</span></div>
        </div>
        <p class="text-[8px] text-slate-400 text-center">Document recepție identificat in Z-FLOW</p>
    </div>`;
}

function _renderScanLivrare(l, el) {
    el.innerHTML = `<div class="bg-white rounded-2xl p-4 border-2 border-purple-200 space-y-3">
        <div class="flex items-center gap-3">
            <span class="text-3xl">📤</span>
            <div>
                <p class="text-sm font-black text-purple-900">Livrare ${_escXML(l.nr_doc || '')}</p>
                <p class="text-[9px] text-slate-400">${l.data || ''} · ${l.status || 'Activ'}</p>
            </div>
        </div>
        <div class="bg-slate-50 rounded-xl p-3 space-y-1 text-[9px]">
            <div class="flex justify-between"><span class="text-slate-400 uppercase font-bold">Client</span><span class="font-black text-slate-700">${_escXML(l.client || l.client_id || '—')}</span></div>
            <div class="flex justify-between"><span class="text-slate-400 uppercase font-bold">Valoare</span><span class="font-black text-slate-700">${Number(l.valoare||0).toLocaleString('ro-RO')} RON</span></div>
        </div>
        <p class="text-[8px] text-slate-400 text-center">Document livrare identificat in Z-FLOW</p>
    </div>`;
}

function _renderScanComanda(c, el) {
    el.innerHTML = `<div class="bg-white rounded-2xl p-4 border-2 border-slate-200 space-y-3">
        <div class="flex items-center gap-3">
            <span class="text-3xl">🚛</span>
            <div>
                <p class="text-sm font-black text-slate-900">${_escXML(c.tracking_code || '')}</p>
                <p class="text-[9px] text-slate-400">${c.ruta_de || ''} → ${c.ruta_la || ''}</p>
            </div>
        </div>
        <div class="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-1 text-[9px]">
            <div><span class="text-slate-400 uppercase font-bold block">Status</span><span class="font-black text-slate-700">${_escXML(c.status || '—')}</span></div>
            <div><span class="text-slate-400 uppercase font-bold block">Valoare</span><span class="font-black text-slate-700">${Number(c.valoare||0).toLocaleString('ro-RO')} RON</span></div>
            <div><span class="text-slate-400 uppercase font-bold block">Plecare</span><span class="font-black text-slate-700">${c.data_plecare || '—'}</span></div>
            <div><span class="text-slate-400 uppercase font-bold block">Livrare</span><span class="font-black text-slate-700">${c.data_livrare || '—'}</span></div>
        </div>
        <p class="text-[8px] text-slate-400 text-center">Comandă transport identificată in Z-FLOW</p>
    </div>`;
}

function _scanActiuneRapidaIntrare(produsId) {
    const cantStr = prompt('Cantitate intrare (buc):');
    const cant = parseFloat(cantStr);
    if (!cant || cant <= 0) return;
    _inregistreazaMiscareRapida(produsId, cant, 'Intrare');
}

function _scanActiuneRapidaIesire(produsId) {
    const cantStr = prompt('Cantitate ieșire (buc):');
    const cant = parseFloat(cantStr);
    if (!cant || cant <= 0) return;
    _inregistreazaMiscareRapida(produsId, cant, 'Iesire');
}

async function _inregistreazaMiscareRapida(produsId, cantitate, tip) {
    const miscare = {
        produs_id: produsId,
        cantitate: cantitate,
        tip: tip,
        data: new Date().toISOString().split('T')[0],
        observatii: 'Scanner rapid Z-FLOW'
    };

    try {
        if (window.ZFlowDB && typeof window.ZFlowDB.insertMiscare === 'function') {
            await window.ZFlowDB.insertMiscare(miscare);
        }
        // Adaugă și local în store pentru refresh imediat
        if (window.ZFlowStore?.dateMiscariStoc) {
            window.ZFlowStore.dateMiscariStoc.push({ ...miscare, id: Date.now() });
        }
        if (typeof showNotification === 'function') showNotification(`✅ ${tip} ${cantitate} buc înregistrată`, 'success');
        // Re-render dacă suntem în view scanner
        if (typeof renderDepozit === 'function') renderDepozit();
    } catch(e) {
        if (typeof showNotification === 'function') showNotification('Eroare înregistrare: ' + e.message, 'error');
    }
}

window.processScanResult = processScanResult;
window._scanActiuneRapidaIntrare = _scanActiuneRapidaIntrare;
window._scanActiuneRapidaIesire  = _scanActiuneRapidaIesire;


// ============================================================
// 5. CASHFLOW FORECAST — Proiecție 30 / 60 / 90 zile
// ============================================================

/**
 * Calculează proiecția cashflow pe N zile viitoare.
 * @param {number} zile - 30, 60 sau 90
 * @returns {{ intrari: number, iesiri: number, net: number, detalii: Array }}
 */
function calculeazaCashflowForecast(zile) {
    zile = parseInt(zile) || 30;
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);
    const limita = new Date(azi.getTime() + zile * 86400000);

    const facturiInc  = window.ZFlowStore?.dateFacturiBI || [];
    const facturiPlat = window.ZFlowStore?.dateFacturiPlatit || [];

    let intrari = 0, iesiri = 0;
    const detalii = [];

    facturiInc.forEach(f => {
        if (f.status_plata === 'Incasat') return;
        const scad = new Date(f.data_scadenta);
        if (scad >= azi && scad <= limita) {
            const suma = parseFloat(f.suma) || 0;
            intrari += suma;
            detalii.push({ tip: 'intrare', suma, scadenta: f.data_scadenta, nr: f.nr_factura, entitate: f.client_id });
        }
    });

    facturiPlat.forEach(f => {
        if (f.status_plata === 'Platit') return;
        const scad = new Date(f.data_scadenta);
        if (scad >= azi && scad <= limita) {
            const suma = parseFloat(f.suma) || 0;
            iesiri += suma;
            detalii.push({ tip: 'iesire', suma, scadenta: f.data_scadenta, nr: f.nr_factura, entitate: f.furnizor_id });
        }
    });

    return { intrari, iesiri, net: intrari - iesiri, detalii, zile };
}

/**
 * Randează panoul de cashflow forecast în elementul #cashflow-forecast-panel
 * @param {number} zile
 */
function renderCashflowForecast(zile) {
    zile = parseInt(zile) || 30;
    const el = document.getElementById('cashflow-forecast-panel');
    if (!el) return;

    const data = calculeazaCashflowForecast(zile);
    const fmt = v => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(v));
    const netColor = data.net >= 0 ? 'text-emerald-700' : 'text-red-600';
    const netSign  = data.net >= 0 ? '+' : '−';

    // Calculare bare proportionale
    const maxVal = Math.max(data.intrari, data.iesiri, 1);
    const pctIntrari = Math.round((data.intrari / maxVal) * 100);
    const pctIesiri  = Math.round((data.iesiri  / maxVal) * 100);

    // Scadente urgente (primele 7 zile)
    const urgente = data.detalii
        .filter(d => {
            const diff = (new Date(d.scadenta) - new Date()) / 86400000;
            return diff >= 0 && diff <= 7;
        })
        .sort((a, b) => new Date(a.scadenta) - new Date(b.scadenta))
        .slice(0, 5);

    el.innerHTML = `
        <!-- Selector zile -->
        <div class="flex gap-1.5 mb-4">
            ${[30,60,90].map(z => `
            <button onclick="renderCashflowForecast(${z})"
                class="flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${z === zile ? 'bg-blue-900 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}">
                ${z} zile
            </button>`).join('')}
        </div>

        <!-- Totale -->
        <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="bg-emerald-50 rounded-xl p-3 text-center">
                <p class="text-[8px] text-emerald-600 font-black uppercase">Intrări</p>
                <p class="text-sm font-black text-emerald-800 tabular-nums">${fmt(data.intrari)}</p>
                <p class="text-[7px] text-emerald-500">RON</p>
            </div>
            <div class="bg-red-50 rounded-xl p-3 text-center">
                <p class="text-[8px] text-red-600 font-black uppercase">Ieșiri</p>
                <p class="text-sm font-black text-red-700 tabular-nums">${fmt(data.iesiri)}</p>
                <p class="text-[7px] text-red-400">RON</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                <p class="text-[8px] text-slate-500 font-black uppercase">Net</p>
                <p class="text-sm font-black ${netColor} tabular-nums">${netSign}${fmt(Math.abs(data.net))}</p>
                <p class="text-[7px] text-slate-400">RON</p>
            </div>
        </div>

        <!-- Bare vizuale -->
        <div class="space-y-2 mb-4">
            <div class="flex items-center gap-2">
                <span class="text-[8px] text-emerald-600 font-bold uppercase w-12 text-right flex-shrink-0">Intrări</span>
                <div class="flex-1 bg-slate-100 rounded-full h-3">
                    <div class="bg-emerald-500 h-3 rounded-full transition-all" style="width:${pctIntrari}%"></div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[8px] text-red-500 font-bold uppercase w-12 text-right flex-shrink-0">Ieșiri</span>
                <div class="flex-1 bg-slate-100 rounded-full h-3">
                    <div class="bg-red-400 h-3 rounded-full transition-all" style="width:${pctIesiri}%"></div>
                </div>
            </div>
        </div>

        <!-- Scadente urgente -->
        ${urgente.length ? `
        <div>
            <p class="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-2">⚡ Scadențe în 7 zile</p>
            <div class="space-y-1">
                ${urgente.map(d => `
                <div class="flex justify-between items-center py-1.5 px-2 bg-amber-50 rounded-lg">
                    <span class="text-[9px] font-bold text-slate-700">${d.tip === 'intrare' ? '💚' : '🔴'} ${d.nr || '—'}</span>
                    <span class="text-[9px] text-slate-500">${d.scadenta}</span>
                    <span class="text-[9px] font-black ${d.tip === 'intrare' ? 'text-emerald-700' : 'text-red-600'}">${fmt(d.suma)} RON</span>
                </div>`).join('')}
            </div>
        </div>` : `<p class="text-[9px] text-slate-400 italic text-center">Nicio scadență în primele 7 zile</p>`}

        <p class="text-[7px] text-slate-300 text-center mt-3">Proiecție pe ${zile} zile · ${data.detalii.length} documente cu scadență</p>
    `;
}

window.calculeazaCashflowForecast = calculeazaCashflowForecast;
window.renderCashflowForecast = renderCashflowForecast;


// ============================================================
// 6. MULTI-FIRMĂ — Gestionare CUI-uri multiple
// ============================================================

const ZFlowMultiFirma = {
    _LS_KEY: 'zflow_firmele_mele',

    getFirme() {
        try {
            const stored = JSON.parse(localStorage.getItem(this._LS_KEY) || '[]');
            // Dacă lista e goală și există un profil activ, populează automat cu firma din profil
            if (stored.length === 0 && window.ZFlowUserProfile) {
                const p = window.ZFlowUserProfile;
                const cuiProfil = p.cui || p.firma_cui || '';
                const numeProfil = p.nume_firma || p.firma_denumire || p.email || 'Firma mea';
                if (cuiProfil || numeProfil !== 'Firma mea') {
                    const firmaActiva = {
                        id: 'firma_profil',
                        cui: cuiProfil,
                        denumire: numeProfil,
                        adresa: p.adresa || '',
                        oras: p.oras || '',
                        telefon: p.telefon || '',
                        email: p.email || '',
                        adaugatLa: new Date().toISOString()
                    };
                    stored.push(firmaActiva);
                    this.saveFirme(stored);
                    localStorage.setItem('zflow_firma_activa_id', firmaActiva.id);
                }
            }
            return stored;
        } catch(e) { return []; }
    },

    saveFirme(firme) {
        localStorage.setItem(this._LS_KEY, JSON.stringify(firme));
    },

    getFirmaActiva() {
        const id = localStorage.getItem('zflow_firma_activa_id');
        const firme = this.getFirme();
        return firme.find(f => f.id === id) || firme[0] || null;
    },

    adaugaFirma(cui, denumire, extra) {
        const cuiCurat = String(cui || '').replace(/\D/g, '');
        if (!cuiCurat || !denumire) {
            if (typeof showNotification === 'function') showNotification('CUI și denumire sunt obligatorii', 'error');
            return;
        }
        const firme = this.getFirme();
        if (firme.some(f => f.cui === cuiCurat)) {
            if (typeof showNotification === 'function') showNotification('Firma cu acest CUI există deja', 'warning');
            return;
        }
        const noua = { id: 'firma_' + Date.now(), cui: cuiCurat, denumire, ...extra, adaugatLa: new Date().toISOString() };
        firme.push(noua);
        this.saveFirme(firme);
        if (typeof showNotification === 'function') showNotification(`✅ Firma ${denumire} adăugată`, 'success');
        this.renderPanel();
    },

    stergeFirma(id) {
        let firme = this.getFirme();
        firme = firme.filter(f => f.id !== id);
        this.saveFirme(firme);
        if (typeof showNotification === 'function') showNotification('Firma eliminată', 'success');
        this.renderPanel();
    },

    switchFirma(id) {
        const firma = this.getFirme().find(f => f.id === id);
        if (!firma) return;
        localStorage.setItem('zflow_firma_activa_id', id);
        // Actualizează profilul activ
        if (window.ZFlowUserProfile) {
            Object.assign(window.ZFlowUserProfile, {
                cui: firma.cui,
                nume_firma: firma.denumire,
                adresa: firma.adresa || window.ZFlowUserProfile.adresa,
                oras: firma.oras || window.ZFlowUserProfile.oras
            });
        }
        if (typeof showNotification === 'function') showNotification(`🔄 Comutat la: ${firma.denumire}`, 'success');
        // Actualizează switcher-ul din header
        const sw = document.getElementById('multifirma-switcher-label');
        if (sw) sw.innerText = firma.denumire.length > 18 ? firma.denumire.slice(0,16) + '…' : firma.denumire;
        this.renderPanel();
    },

    renderPanel(targetId = null) {
        const targets = targetId
            ? [document.getElementById(targetId)].filter(Boolean)
            : ['pf-firme-content', 'multifirma-panel-content'].map(id => document.getElementById(id)).filter(Boolean);
        if (!targets.length) return;
        const firme = this.getFirme();
        const activa = this.getFirmaActiva();
        const html = `
            <div class="space-y-3">
                <!-- Lista firme -->
                ${firme.length === 0 ? '<p class="text-[9px] text-slate-400 italic text-center py-4">Nicio firmă adăugată</p>' :
                    `<div class="space-y-1.5">${firme.map(f => `
                        <div class="flex items-center gap-2 p-2.5 rounded-xl ${f.id === activa?.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}">
                            <div class="flex-1 min-w-0">
                                <p class="text-[10px] font-black text-slate-800 truncate">${_escXML(f.denumire)}</p>
                                <p class="text-[8px] text-slate-400">CUI: ${f.cui}</p>
                            </div>
                            ${f.id === activa?.id ? '<span class="text-[8px] text-blue-600 font-black flex-shrink-0">ACTIV</span>' :
                                `<button onclick="ZFlowMultiFirma.switchFirma('${f.id}')" class="px-2 py-1 bg-blue-900 text-white rounded-lg text-[8px] font-black uppercase flex-shrink-0">Switch</button>`}
                            <button onclick="ZFlowMultiFirma.stergeFirma('${f.id}')" class="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 flex-shrink-0">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>`).join('')}
                    </div>`}
                <!-- Adaugă firmă nouă -->
                <div class="bg-slate-50 rounded-xl p-3 space-y-2 border border-dashed border-slate-200">
                    <p class="text-[8px] font-black text-slate-400 uppercase">Adaugă firmă nouă</p>
                    <div class="flex gap-2">
                        <input id="mf-cui" type="text" placeholder="CUI" class="w-24 p-2 bg-white rounded-lg text-[10px] font-bold border border-slate-200 outline-none focus:border-blue-300 flex-shrink-0"/>
                        <input id="mf-denumire" type="text" placeholder="Denumire firmă" class="flex-1 p-2 bg-white rounded-lg text-[10px] font-bold border border-slate-200 outline-none focus:border-blue-300 min-w-0"/>
                    </div>
                    <button onclick="ZFlowMultiFirma.adaugaFirma(document.getElementById('mf-cui').value, document.getElementById('mf-denumire').value)"
                        class="w-full py-2.5 bg-blue-900 text-white rounded-xl text-[9px] font-black uppercase">Adaugă</button>
                </div>
                <p class="text-[7px] text-slate-300 text-center">Comutarea de firmă actualizează profilul activ și prefixul CUI pe facturi noi</p>
            </div>`;
        targets.forEach(t => t.innerHTML = html);
    },

    initSwitcher() {
        const el = document.getElementById('multifirma-switcher-label');
        if (!el) return;
        const activa = this.getFirmaActiva();
        if (activa) {
            const label = activa.denumire.length > 18 ? activa.denumire.slice(0, 16) + '…' : activa.denumire;
            el.innerText = label;
        }
    }
};

window.ZFlowMultiFirma = ZFlowMultiFirma;

// Init switcher when DOM ready
document.addEventListener('DOMContentLoaded', () => ZFlowMultiFirma.initSwitcher());


// ============================================================
// 7. RAPORT km vs. FACTURI LIVRATE
// ============================================================

/**
 * Calculează raportul km parcurși vs. valoare facturi livrate per vehicul
 * @returns {Array<{ vehicul, nrInmatriculare, comenzi, kmTotal, valoareTransport, facturiLivrare, valoareLivrari }>}
 */
function calculeazaRaportKm() {
    const vehicule  = window.ZFlowStore?.dateVehicule || [];
    const comenzi   = window.ZFlowStore?.dateComenziTransport || [];
    const livrari   = window.ZFlowStore?.dateLivrari || [];

    return vehicule.map(v => {
        const comenziVehicul = comenzi.filter(c => String(c.vehicul_id) === String(v.id));
        const kmTotal = comenziVehicul.reduce((s, c) => s + (Number(c.numar_km || c.km || c.distanta_km) || 0), 0);
        const valoareTransport = comenziVehicul.reduce((s, c) => s + (Number(c.valoare) || 0), 0);

        // Livrari asociate comenzilor acestui vehicul
        const trackingCodes = new Set(comenziVehicul.map(c => c.tracking_code).filter(Boolean));
        const livrariVehicul = livrari.filter(l => trackingCodes.has(l.tracking_code) || trackingCodes.has(l.nr_doc));
        const valoareLivrari = livrariVehicul.reduce((s, l) => s + (Number(l.valoare) || 0), 0);

        return {
            vehicul: `${v.marca || ''} ${v.model || ''}`.trim() || v.nr_inmatriculare,
            nrInmatriculare: v.nr_inmatriculare || '—',
            comenzi: comenziVehicul.length,
            kmTotal,
            valoareTransport,
            facturiLivrare: livrariVehicul.length,
            valoareLivrari,
            costPerKm: kmTotal > 0 ? (valoareTransport / kmTotal).toFixed(2) : '—'
        };
    }).sort((a, b) => b.kmTotal - a.kmTotal);
}

function renderRaportKm() {
    const el = document.getElementById('raport-km-panel');
    if (!el) return;

    const raport = calculeazaRaportKm();
    const fmt = v => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0 }).format(v);

    if (!raport.length) {
        el.innerHTML = '<p class="text-[9px] text-slate-400 italic text-center py-4">Nicio dată disponibilă. Adaugă vehicule și comenzi de transport.</p>';
        return;
    }

    el.innerHTML = `
        <div class="overflow-x-auto rounded-xl">
            <table class="w-full text-[9px]">
                <thead>
                    <tr class="bg-slate-100 text-slate-500 uppercase font-black text-[8px]">
                        <th class="py-2 px-2 text-left rounded-l-xl">Vehicul</th>
                        <th class="py-2 px-1 text-right">Comenzi</th>
                        <th class="py-2 px-1 text-right">km</th>
                        <th class="py-2 px-1 text-right">RON/km</th>
                        <th class="py-2 px-1 text-right">Livrări</th>
                        <th class="py-2 px-2 text-right rounded-r-xl">Val.</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${raport.map(r => `
                    <tr class="hover:bg-slate-50 transition-all">
                        <td class="py-2 px-2">
                            <p class="font-black text-slate-800 truncate max-w-[90px]">${_escXML(r.vehicul)}</p>
                            <p class="text-[7px] text-slate-400">${_escXML(r.nrInmatriculare)}</p>
                        </td>
                        <td class="py-2 px-1 text-right font-bold text-slate-600">${r.comenzi}</td>
                        <td class="py-2 px-1 text-right font-black text-blue-900">${fmt(r.kmTotal)}</td>
                        <td class="py-2 px-1 text-right font-bold text-slate-500">${r.costPerKm}</td>
                        <td class="py-2 px-1 text-right font-bold text-emerald-700">${r.facturiLivrare}</td>
                        <td class="py-2 px-2 text-right font-black text-slate-700">${fmt(r.valoareLivrari)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <button onclick="exportRaportKmCSV()" class="mt-3 w-full py-2.5 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase">Export CSV</button>
    `;
}

function exportRaportKmCSV() {
    const raport = calculeazaRaportKm();
    if (!raport.length) {
        if (typeof showNotification === 'function') showNotification('Nicio dată de exportat', 'error');
        return;
    }
    const headers = ['Vehicul', 'Nr Inmatriculare', 'Comenzi', 'km Total', 'RON/km', 'Facturi Livrare', 'Val Livrari'];
    const rows = raport.map(r => [
        `"${r.vehicul}"`, `"${r.nrInmatriculare}"`, r.comenzi, r.kmTotal, r.costPerKm, r.facturiLivrare, r.valoareLivrari
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `raport_km_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    if (typeof showNotification === 'function') showNotification('✅ Export CSV raport km finalizat', 'success');
}

window.calculeazaRaportKm  = calculeazaRaportKm;
window.renderRaportKm      = renderRaportKm;
window.exportRaportKmCSV   = exportRaportKmCSV;


// ============================================================
// 8. IMPORT XML ANAF — Preluare facturi din SPV (e-Factura UBL 2.1)
// ============================================================

/**
 * Declanșează dialogul de import XML e-Factura ANAF
 * Parsează formatul UBL 2.1 folosit de ANAF SPV
 */
function importaXMLANAF() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.multiple = true;
    input.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        let ok = 0, erori = 0, total = files.length;

        for (const file of files) {
            try {
                const text = await file.text();
                const doc = new DOMParser().parseFromString(text, 'application/xml');
                const err = doc.querySelector('parsererror');
                if (err) { erori++; console.warn('[XML ANAF] Parse error:', file.name); continue; }

                const facturaData = _parseazaUBL(doc, file.name);
                if (!facturaData) { erori++; continue; }

                // Verifică dacă e factură de intrare sau ieșire
                const tip = facturaData._tip;
                delete facturaData._tip;

                if (window.ZFlowDB) {
                    if (tip === 'furnizor') {
                        await window.ZFlowDB.insertFacturaPlatit?.(facturaData);
                    } else {
                        await window.ZFlowDB.insertFactura?.(facturaData);
                    }
                } else {
                    // Adaugă local la store
                    if (tip === 'furnizor') {
                        window.ZFlowStore?.dateFacturiPlatit?.push({ ...facturaData, id: 'xml_' + Date.now() });
                    } else {
                        window.ZFlowStore?.dateFacturiBI?.push({ ...facturaData, id: 'xml_' + Date.now() });
                    }
                }
                ok++;
            } catch(parseErr) {
                erori++;
                console.error('[XML ANAF] Eroare:', file.name, parseErr);
            }
        }

        const msg = `XML ANAF: ${ok}/${total} facturi importate${erori ? `, ${erori} erori` : ''}`;
        if (typeof showNotification === 'function') showNotification(msg, erori ? 'warning' : 'success');
        if (ok > 0 && typeof init === 'function') init();
    };
    input.click();
}

/**
 * Parsează un document XML UBL 2.1 ANAF și extrage datele facturii
 * @param {Document} doc - DOMParser document
 * @param {string} filename - Numele fișierului (pentru loguri)
 * @returns {Object|null}
 */
function _parseazaUBL(doc, filename) {
    try {
        // Helper universal: caută fie în namespace fie fără
        const get = (parent, tag) => {
            let el = parent.getElementsByTagNameNS('*', tag)[0];
            if (!el) el = parent.getElementsByTagName(tag)[0];
            return el?.textContent?.trim() || '';
        };

        const nr = get(doc, 'ID');
        const dataEmitere = get(doc, 'IssueDate');
        const dataScadenta = get(doc, 'DueDate') || dataEmitere;
        const sumaTotal = get(doc, 'PayableAmount') || get(doc, 'LineExtensionAmount');
        const taxTotal = get(doc, 'TaxAmount');
        const moneda = get(doc, 'DocumentCurrencyCode') || 'RON';
        const nota = get(doc, 'Note');

        // Furnizor (AccountingSupplierParty)
        const supplier = doc.getElementsByTagNameNS('*', 'AccountingSupplierParty')[0]
                      || doc.getElementsByTagName('AccountingSupplierParty')[0];
        const supplierCUI = supplier ? (get(supplier, 'CompanyID') || get(supplier, 'ID')) : '';
        const supplierNume = supplier ? (get(supplier, 'Name') || get(supplier, 'RegistrationName')) : '';

        // Cumpărător (AccountingCustomerParty)
        const customer = doc.getElementsByTagNameNS('*', 'AccountingCustomerParty')[0]
                      || doc.getElementsByTagName('AccountingCustomerParty')[0];
        const customerCUI = customer ? (get(customer, 'CompanyID') || get(customer, 'ID')) : '';
        const customerNume = customer ? (get(customer, 'Name') || get(customer, 'RegistrationName')) : '';

        // Determină tipul facturii: dacă supplierCUI == profilul curent → factură de incasare (client)
        const profileCUI = String(window.ZFlowUserProfile?.cui || '').replace(/\D/g, '');
        const supplierCUICarat = String(supplierCUI || '').replace(/\D/g, '');
        const isEmisaDeMine = profileCUI && supplierCUICarat && supplierCUICarat.includes(profileCUI);

        const rezultat = {
            nr_factura: nr || ('XML-' + Date.now()),
            data_emitere: dataEmitere || new Date().toISOString().split('T')[0],
            data_scadenta: dataScadenta || new Date().toISOString().split('T')[0],
            suma: parseFloat(sumaTotal) || 0,
            tva: parseFloat(taxTotal) || 0,
            moneda: moneda,
            status_plata: 'Neincasat',
            descriere: nota || ('Import XML ANAF: ' + filename),
            _furnizorCUI: supplierCUI,
            _furnizorNume: supplierNume,
            _clientCUI: customerCUI,
            _clientNume: customerNume,
            _tip: isEmisaDeMine ? 'client' : 'furnizor'
        };

        return rezultat;
    } catch(e) {
        console.error('[UBL Parse] Eroare la', filename, e);
        return null;
    }
}

window.importaXMLANAF = importaXMLANAF;


// ============================================================
// INIT: Apelat la încărcare pagină pentru a inițializa panel-urile
// ============================================================
document.addEventListener('DOMContentLoaded', function initFeaturesOnDOM() {
    // Inițializare SafeFleet panel (dacă există)
    ZFlowSafeFleet.renderPanel();

    // Inițializare cashflow forecast cu 30 zile implicit
    // (va fi populat la primul render după init())
    // Nu apelăm renderCashflowForecast() acum - datele nu sunt încă încărcate

    // Inițializare multi-firma switcher
    ZFlowMultiFirma.initSwitcher();
});

// Hook: după init() al aplicației principale, re-render panel-urile cu date
// Folosim un MutationObserver pentru a detecta când datele sunt gata
(function waitForData() {
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        const facturiLoaded = (window.ZFlowStore?.dateFacturiBI?.length > 0) ||
                              (window.ZFlowStore?.dateFacturiPlatit?.length > 0) ||
                              (window.ZFlowStore?.dateLocal?.length > 0);
        if (facturiLoaded || attempts > 30) {
            clearInterval(interval);
            if (facturiLoaded) {
                if (typeof renderCashflowForecast === 'function') renderCashflowForecast(30);
                if (typeof renderRaportKm === 'function') renderRaportKm();
                if (typeof ZFlowSafeFleet !== 'undefined') ZFlowSafeFleet.renderPanel();
                if (typeof ZFlowMultiFirma !== 'undefined') ZFlowMultiFirma.renderPanel();
            }
        }
    }, 500);
})();

