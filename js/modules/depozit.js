/**
 * Z-FLOW Enterprise v7.14
 * Modul Depozit — Gestionare Stoc, Produse, Recepții, Livrări
 */

// ==========================================
// KPI & RENDER PRINCIPAL
// ==========================================

function calculeazaKPIDepozit() {
    const produse = ZFlowStore.dateProduse || [];
    let valoare = 0, alerte = 0;
    produse.forEach(p => {
        const stoc = calcStocCurent(p.id);
        valoare += stoc * (Number(p.pret_achizitie) || 0);
        if (p.stoc_min && stoc < Number(p.stoc_min)) alerte++;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    set('depozit-kpi-produse', produse.length);
    const fmtVal = v => v >= 1000000 ? (v/1000000).toFixed(1).replace(/\.0$/,'') + 'M lei'
        : v >= 1000 ? Math.round(v/1000) + 'k lei'
        : Math.round(v).toLocaleString() + ' lei';
    set('depozit-kpi-valoare', fmtVal(valoare));
    set('depozit-kpi-alerte', alerte);
}

function calcStocCurent(produsId) {
    return (ZFlowStore.dateMiscariStoc || [])
        .filter(m => String(m.produs_id) === String(produsId))
        .reduce((sum, m) => {
            const q = Number(m.cantitate) || 0;
            return m.tip === 'Intrare' ? sum + q : sum - q;
        }, 0);
}

function renderDepozit() {
    calculeazaKPIDepozit();
    schimbaViewDepozit(ZFlowStore.depozitView || 'produse', false);
}

function schimbaViewDepozit(view, updateStore = true) {
    if (updateStore) ZFlowStore.depozitView = view;
    ['produse', 'miscari', 'receptii', 'livrari', 'scanner'].forEach(v => {
        const el = document.getElementById('depozit-view-' + v);
        if (el) el.classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.depozit-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'produse')  renderProduse();
    else if (view === 'miscari')   renderMiscariStoc();
    else if (view === 'receptii')  renderReceptiiDepozit();
    else if (view === 'livrari')   renderLivrariDepozit();
    else if (view === 'scanner')  { if (typeof initScanner === 'function') initScanner(); }
}

// ==========================================
// PRODUSE
// ==========================================

function renderProduse() {
    const container = document.getElementById('depozit-lista-produse');
    if (!container) return;
    const q = (document.getElementById('depozit-search-produse')?.value || '').toLowerCase();
    const all = (ZFlowStore.dateProduse || []).filter(p =>
        !q || (p.sku||'').toLowerCase().includes(q) || (p.nume||'').toLowerCase().includes(q)
    );
    ZFlowStore._produseFiltrate = all;
    const ps  = ZFlowStore.produsePageSize ?? 10;
    const pg  = ZFlowStore.produseCurrentPage || 1;
    const tp  = ps === 0 ? 1 : Math.ceil(all.length / ps);
    if (pg > tp) ZFlowStore.produseCurrentPage = 1;
    const s0  = ps === 0 ? 0 : ((ZFlowStore.produseCurrentPage||1) - 1) * ps;
    const list = ps === 0 ? all : all.slice(s0, s0 + ps);
    const pgEl = document.getElementById('produse-pagination');

    if (!all.length) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
          </svg>
          <p class="text-sm font-bold">Niciun produs în depozit</p>
          <p class="text-xs mt-1 opacity-70">Adaugă primul produs pentru a gestiona stocul</p>
        </div>`;
        if (pgEl) pgEl.innerHTML = '';
        return;
    }

    container.innerHTML = list.map(p => {
        try {
            const stoc = calcStocCurent(p.id);
            const isLow = p.stoc_min && stoc < Number(p.stoc_min);
            const stCls = stoc <= 0 ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
            const stLabel = stoc <= 0 ? 'Epuizat' : isLow ? 'Stoc redus' : 'Disponibil';
            return `<div class="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="deschideModalProdus('${p.id}')">
              <div class="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-black text-slate-800 truncate">${p.nume}</p>
                  ${p.sku ? `<span class="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">${p.sku}</span>` : ''}
                </div>
                <p class="text-xs text-slate-400 font-semibold">${p.um || 'buc'} &middot; Stoc: <b class="text-slate-700">${stoc}</b> ${p.stoc_min ? `&middot; Min: ${p.stoc_min}` : ''}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[9px] font-black uppercase px-2 py-1 rounded-full ${stCls}">${stLabel}</span>
                <button onclick="event.stopPropagation(); deschideModalMiscare('${p.id}')" title="Mișcare stoc" class="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-blue-50 text-blue-500 transition-all" data-permission="edit">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
                </button>
                <button onclick="event.stopPropagation(); stergeProdus('${p.id}')" class="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400 transition-all" data-permission="delete">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>`;
        } catch (itemErr) {
            console.warn('[Depozit] renderProduse item error:', itemErr);
            return `<div class="text-xs text-red-400 px-4 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare produs</div>`;
        }
    }).join('');
    if (pgEl && typeof window._paginareHTML === 'function') {
        pgEl.innerHTML = all.length > 5 ? window._paginareHTML(all.length, ps, ZFlowStore.produseCurrentPage||1, 'produse') : '';
    }
}

// ==========================================
// MIȘCĂRI STOC
// ==========================================

function renderMiscariStoc() {
    const container = document.getElementById('depozit-lista-miscari');
    if (!container) return;
    const all = (ZFlowStore.dateMiscariStoc || [])
        .slice().sort((a, b) => new Date(b.data || b.created_at || 0) - new Date(a.data || a.created_at || 0));
    ZFlowStore._miscariFiltrate = all;
    const ps  = ZFlowStore.miscariPageSize ?? 10;
    const pg  = ZFlowStore.miscariCurrentPage || 1;
    const tp  = ps === 0 ? 1 : Math.ceil(all.length / ps);
    if (pg > tp) ZFlowStore.miscariCurrentPage = 1;
    const s0  = ps === 0 ? 0 : ((ZFlowStore.miscariCurrentPage||1) - 1) * ps;
    const list = ps === 0 ? all : all.slice(s0, s0 + ps);
    const pgEl = document.getElementById('miscari-pagination');

    if (!all.length) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm font-bold">Nicio mișcare de stoc înregistrată</div>`;
        if (pgEl) pgEl.innerHTML = '';
        return;
    }
    container.innerHTML = list.map(m => {
        try {
            const p = (ZFlowStore.dateProduse || []).find(x => String(x.id) === String(m.produs_id));
            const isIn = m.tip === 'Intrare';
            return `<div class="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm mb-1">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-emerald-100' : 'bg-red-100'}">
                <svg class="w-4 h-4 ${isIn ? 'text-emerald-600' : 'text-red-600'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  ${isIn ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>'}
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-black text-slate-800 truncate">${p?.nume || 'Produs șters'} ${p?.sku ? `(${p.sku})` : ''}</p>
                <p class="text-[10px] text-slate-400">${m.data ? new Date(m.data).toLocaleDateString('ro-RO') : '—'} &middot; ${m.observatii || m.tip}</p>
              </div>
              <b class="text-sm font-black tabular-nums ${isIn ? 'text-emerald-600' : 'text-red-600'}">${isIn ? '+' : '-'}${m.cantitate} ${p?.um || 'buc'}</b>
            </div>`;
        } catch (itemErr) {
            console.warn('[Depozit] renderMiscariStoc item error:', itemErr);
            return `<div class="text-xs text-red-400 px-4 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare mișcare</div>`;
        }
    }).join('');
    if (pgEl && typeof window._paginareHTML === 'function') {
        pgEl.innerHTML = all.length > 5 ? window._paginareHTML(all.length, ps, ZFlowStore.miscariCurrentPage||1, 'miscari') : '';
    }
}

// ==========================================
// RECEPȚII
// ==========================================

function renderReceptiiDepozit() {
    const container = document.getElementById('depozit-lista-receptii');
    if (!container) return;
    const list = (ZFlowStore.dateReceptii || [])
        .slice().sort((a, b) => new Date(b.data || b.created_at || 0) - new Date(a.data || a.created_at || 0));

    if (!list.length) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm font-bold">Nicio recepție înregistrată</div>`;
        return;
    }
    container.innerHTML = list.map(r => {
        try {
            const furn = (ZFlowStore.dateFurnizori || []).find(f => String(f.id) === String(r.furnizor_id));
            const items = (r.items || []).length;
            const val = (r.items || []).reduce((s, i) => s + (Number(i.cantitate)||0)*(Number(i.pret_unitar)||0), 0);
            return `<div class="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm mb-1">
              <div class="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-black text-slate-800">Recepție #${(r.id||'').toString().slice(-4) || '—'}</p>
                <p class="text-xs text-slate-400">${furn?.nume_firma || 'Furnizor'} &middot; ${r.data ? new Date(r.data).toLocaleDateString('ro-RO') : '—'} &middot; ${items} produse</p>
              </div>
              <b class="text-sm font-black text-slate-700 tabular-nums">${val > 0 ? Math.round(val).toLocaleString() + ' lei' : '—'}</b>
            </div>`;
        } catch (itemErr) {
            console.warn('[Depozit] renderReceptiiDepozit item error:', itemErr);
            return `<div class="text-xs text-red-400 px-4 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare recepție</div>`;
        }
    }).join('');
}

// ==========================================
// LIVRĂRI
// ==========================================

function renderLivrariDepozit() {
    const container = document.getElementById('depozit-lista-livrari');
    if (!container) return;
    const list = (ZFlowStore.dateLivrari || [])
        .slice().sort((a, b) => new Date(b.data || b.created_at || 0) - new Date(a.data || a.created_at || 0));

    if (!list.length) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm font-bold">Niciun bon de livrare emis</div>`;
        return;
    }
    container.innerHTML = list.map(l => {
        try {
            const cl = (ZFlowStore.dateLocal || []).find(c => String(c.id) === String(l.client_id));
            const items = (l.items || []).length;
            const stCls = l.status === 'Livrat' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
            return `<div class="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm mb-1">
              <div class="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-black text-slate-800">BL #${l.nr_bon || (l.id||'').toString().slice(-4) || '—'}</p>
                <p class="text-xs text-slate-400">${cl?.nume_firma || 'Client'} &middot; ${l.data ? new Date(l.data).toLocaleDateString('ro-RO') : '—'} &middot; ${items} produse</p>
              </div>
              <span class="text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${stCls}">${l.status || 'Draft'}</span>
            </div>`;
        } catch (itemErr) {
            console.warn('[Depozit] renderLivrariDepozit item error:', itemErr);
            return `<div class="text-xs text-red-400 px-4 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare livrare</div>`;
        }
    }).join('');
}

// ==========================================
// MODAL PRODUS — ADD / EDIT
// ==========================================

function deschideModalProdus(id) {
    const modal = document.getElementById('modal-produs');
    if (!modal) return;
    const f = el => document.getElementById(el);
    if (f('produs-modal-title')) f('produs-modal-title').innerText = id ? 'Editează Produs' : 'Produs Nou';
    if (f('produs-id-hidden'))   f('produs-id-hidden').value = id || '';
    ['produs-sku','produs-name','produs-um','produs-cat','produs-pret-ach','produs-pret-vanz','produs-stoc-min','produs-obs','produs-stoc-initial'].forEach(el => { const e = f(el); if (e) e.value = ''; });

    if (id) {
        const p = (ZFlowStore.dateProduse || []).find(x => String(x.id) === String(id));
        if (p) {
            if (f('produs-sku'))       f('produs-sku').value       = p.sku || '';
            if (f('produs-name'))      f('produs-name').value      = p.nume || '';
            if (f('produs-um'))        f('produs-um').value        = p.um || 'buc';
            if (f('produs-cat'))       f('produs-cat').value       = p.categorie || '';
            if (f('produs-pret-ach'))  f('produs-pret-ach').value  = p.pret_achizitie || '';
            if (f('produs-pret-vanz')) f('produs-pret-vanz').value = p.pret_vanzare || '';
            if (f('produs-stoc-min'))  f('produs-stoc-min').value  = p.stoc_min || '';
            if (f('produs-obs'))       f('produs-obs').value       = p.observatii || '';
        }
    }
    const stocSec = document.getElementById('produs-stoc-initial-section');
    if (stocSec) stocSec.classList.toggle('hidden', !!id);
    modal.classList.add('active');
}

function inchideModalProdus() {
    const m = document.getElementById('modal-produs'); if (m) m.classList.remove('active');
}

async function salveazaProdus() {
    const fv = el => document.getElementById(el)?.value?.trim() || '';
    const id = document.getElementById('produs-id-hidden')?.value;
    const name = fv('produs-name');
    if (!name) { showNotification('❌ Completează denumirea produsului', 'error'); return; }

    setLoader(true);
    try {
        const payload = {
            sku:            fv('produs-sku') || null,
            nume:           name,
            um:             fv('produs-um') || 'buc',
            categorie:      fv('produs-cat') || null,
            pret_achizitie: Number(fv('produs-pret-ach')) || 0,
            pret_vanzare:   Number(fv('produs-pret-vanz')) || 0,
            stoc_min:       Number(fv('produs-stoc-min')) || 0,
            observatii:     fv('produs-obs') || null
        };

        if (id) {
            await ZFlowDB.updateProdus(id, payload);
            const arr = ZFlowStore.dateProduse;
            const i = arr.findIndex(x => String(x.id) === String(id));
            if (i !== -1) arr[i] = { ...arr[i], ...payload };
        } else {
            await ZFlowDB.insertProdus(payload);
            ZFlowStore.dateProduse = await ZFlowDB.fetchProduse();
            // Stoc inițial
            const stocInit = Number(document.getElementById('produs-stoc-initial')?.value) || 0;
            if (stocInit > 0) {
                const newP = ZFlowStore.dateProduse[ZFlowStore.dateProduse.length - 1];
                if (newP) {
                    await ZFlowDB.insertMiscare({ produs_id: newP.id, tip: 'Intrare', cantitate: stocInit, pret_unitar: payload.pret_achizitie, data: new Date().toISOString().slice(0,10), observatii: 'Stoc inițial' });
                    ZFlowStore.dateMiscariStoc = await ZFlowDB.fetchMiscariStoc();
                }
            }
        }
        inchideModalProdus();
        calculeazaKPIDepozit();
        renderProduse();
        showNotification('✅ Produs salvat!', 'success');
    } catch (err) {
        showNotification('❌ Eroare: ' + err.message, 'error');
    } finally { setLoader(false); }
}

async function stergeProdus(id) {
    if (!confirm('Ștergi produsul și mișcările de stoc asociate?')) return;
    setLoader(true);
    try {
        await ZFlowDB.deleteProdus(id);
        ZFlowStore.dateProduse = ZFlowStore.dateProduse.filter(x => String(x.id) !== String(id));
        ZFlowStore.dateMiscariStoc = ZFlowStore.dateMiscariStoc.filter(x => String(x.produs_id) !== String(id));
        calculeazaKPIDepozit();
        renderProduse();
        showNotification('✅ Produs șters', 'success');
    } catch (err) {
        showNotification('❌ Eroare: ' + err.message, 'error');
    } finally { setLoader(false); }
}

// ==========================================
// MODAL MIȘCARE STOC
// ==========================================

function deschideModalMiscare(produsId, opts) {
    const modal = document.getElementById('modal-miscare-stoc');
    if (!modal) return;
    const sel = document.getElementById('miscare-produs-select');
    if (sel) {
        sel.innerHTML = '<option value="">\u2014 Selecteaz\u0103 produs \u2014</option>' +
            (ZFlowStore.dateProduse || []).map(p =>
                `<option value="${p.id}" ${String(p.id) === String(produsId) ? 'selected' : ''}>${p.nume}${p.sku ? ` (${p.sku})` : ''}</option>`
            ).join('');
    }
    const dateEl = document.getElementById('miscare-data');
    if (dateEl) dateEl.value = new Date().toISOString().slice(0,10);
    const tipEl = document.getElementById('miscare-tip');
    if (tipEl) tipEl.value = (opts && opts.tip) ? opts.tip : 'Intrare';
    // Pre-populeaz\u0103 observa\u021bii cu referinta din modulul financiar (dac\u0103 exist\u0103)
    const obsEl = document.getElementById('miscare-obs');
    if (obsEl && opts && opts.obs) obsEl.value = opts.obs;
    modal.classList.add('active');
}

function inchideModalMiscare() {
    const m = document.getElementById('modal-miscare-stoc'); if (m) m.classList.remove('active');
}

async function salveazaMiscare() {
    const produsId = document.getElementById('miscare-produs-select')?.value;
    const tip      = document.getElementById('miscare-tip')?.value;
    const cant     = Number(document.getElementById('miscare-cantitate')?.value);
    const data     = document.getElementById('miscare-data')?.value;
    const obs      = document.getElementById('miscare-obs')?.value?.trim() || null;

    if (!produsId || !tip || !cant || cant <= 0) {
        showNotification('❌ Completează toate câmpurile obligatorii', 'error'); return;
    }
    setLoader(true);
    try {
        const produs = (ZFlowStore.dateProduse || []).find(p => String(p.id) === String(produsId));
        await ZFlowDB.insertMiscare({ produs_id: produsId, tip, cantitate: cant, pret_unitar: produs?.pret_achizitie || 0, data: data || new Date().toISOString().slice(0,10), observatii: obs });
        ZFlowStore.dateMiscariStoc = await ZFlowDB.fetchMiscariStoc();
        inchideModalMiscare();
        calculeazaKPIDepozit();
        renderMiscariStoc();
        if (ZFlowStore.depozitView === 'produse') renderProduse();
        showNotification(`✅ Mișcare ${tip} înregistrată!`, 'success');
    } catch (err) {
        showNotification('❌ Eroare: ' + err.message, 'error');
    } finally { setLoader(false); }
}

// ==========================================
// INIȚIALIZARE DATE DEPOZIT
// ==========================================

async function initDepozit() {
    try {
        const [produse, miscari, receptii, livrari] = await Promise.all([
            ZFlowDB.fetchProduse(),
            ZFlowDB.fetchMiscariStoc(),
            ZFlowDB.fetchReceptii(),
            ZFlowDB.fetchLivrari()
        ]);
        ZFlowStore.dateProduse     = produse;
        ZFlowStore.dateMiscariStoc = miscari;
        ZFlowStore.dateReceptii    = receptii;
        ZFlowStore.dateLivrari     = livrari;
        console.log(`📦 Depozit: ${produse.length} produse, ${miscari.length} mișcări`);
    } catch (err) {
        console.warn('[Depozit] Eroare inițializare (non-fatal):', err.message);
        ZFlowStore.dateProduse     = ZFlowStore.dateProduse     || [];
        ZFlowStore.dateMiscariStoc = ZFlowStore.dateMiscariStoc || [];
        ZFlowStore.dateReceptii    = ZFlowStore.dateReceptii    || [];
        ZFlowStore.dateLivrari     = ZFlowStore.dateLivrari     || [];
    }
}

// ==========================================
// IMPORT CSV PRODUSE
// ==========================================
async function importaProduse() {
    if (typeof hasPermission === 'function' && !hasPermission('canImport')) {
        if (typeof showNotification === 'function') showNotification('Nu ai permisiunea de import', 'error');
        return;
    }

    let fileInput = document.getElementById('import-produse-file');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'import-produse-file';
        fileInput.accept = '.csv';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (typeof setLoader === 'function') setLoader(true);
            try {
                const text = await file.text();
                const delimiter = (typeof ZFlowImport !== 'undefined' && ZFlowImport.detectDelimiter)
                    ? ZFlowImport.detectDelimiter(text)
                    : ((text.split(';').length > text.split(',').length) ? ';' : ',');

                const linii = text.split('\n').map(l => l.trim()).filter(l => l);
                if (linii.length < 2) {
                    if (typeof showNotification === 'function') showNotification('Fișierul nu conține date valide', 'warning');
                    return;
                }

                // Parse antete — normalizare lowercase + fără ghilimele
                const headers = linii[0].split(delimiter).map(h => h.replace(/"/g, '').trim().toLowerCase());
                const col = (...names) => { for (const n of names) { const i = headers.indexOf(n); if (i !== -1) return i; } return -1; };
                const idx = {
                    sku:       col('sku', 'cod'),
                    nume:      col('nume', 'denumire', 'produs'),
                    um:        col('um', 'unitate masura', 'unitate'),
                    cat:       col('categorie', 'cat'),
                    pret_ach:  col('pret_achizitie', 'pret achizitie', 'pret ach'),
                    pret_vanz: col('pret_vanzare', 'pret vanzare', 'pret vanz'),
                    stoc_min:  col('stoc_minim', 'stoc_min', 'stoc minim'),
                    stoc_init: col('stoc_initial', 'stoc initial', 'stoc'),
                    obs:       col('observatii', 'obs', 'note')
                };

                if (idx.nume === -1) {
                    if (typeof showNotification === 'function') showNotification('Coloana "nume" lipsă din CSV', 'error');
                    return;
                }

                const getVal = (cols, i) => (i >= 0 && i < cols.length) ? cols[i].replace(/"/g, '').trim() : '';
                const getNum = (cols, i) => { const v = getVal(cols, i); return v ? (parseFloat(v.replace(',', '.')) || 0) : 0; };

                let importate = 0;
                let duplicate = 0;
                const erori = [];
                const pendingMiscari = [];

                for (let i = 1; i < linii.length; i++) {
                    const cols = linii[i].split(delimiter);
                    const sku  = getVal(cols, idx.sku);
                    const nume = getVal(cols, idx.nume);
                    if (!nume) { erori.push(`Rândul ${i + 1}: lipsă denumire`); continue; }

                    // Verificare duplicat după SKU sau nume
                    const dup = (ZFlowStore.dateProduse || []).find(p =>
                        (sku && p.sku && String(p.sku).toLowerCase() === sku.toLowerCase()) ||
                        String(p.nume || '').toLowerCase() === nume.toLowerCase()
                    );
                    if (dup) { duplicate++; continue; }

                    const stocInit = getNum(cols, idx.stoc_init);
                    const payload = {
                        sku:            sku || null,
                        nume,
                        um:             getVal(cols, idx.um) || 'buc',
                        categorie:      getVal(cols, idx.cat) || null,
                        pret_achizitie: getNum(cols, idx.pret_ach),
                        pret_vanzare:   getNum(cols, idx.pret_vanz),
                        stoc_min:       getNum(cols, idx.stoc_min),
                        observatii:     getVal(cols, idx.obs) || null
                    };

                    try {
                        await ZFlowDB.insertProdus(payload);
                        importate++;
                        if (stocInit > 0) pendingMiscari.push({ sku, nume, stocInit, pret_achizitie: payload.pret_achizitie });
                    } catch(insErr) {
                        erori.push(`${nume}: ${insErr.message}`);
                    }
                }

                // Mișcări stoc inițial
                if (pendingMiscari.length > 0) {
                    ZFlowStore.dateProduse = await ZFlowDB.fetchProduse().catch(() => ZFlowStore.dateProduse || []);
                    for (const pm of pendingMiscari) {
                        const produs = ZFlowStore.dateProduse.find(p =>
                            (pm.sku && p.sku && String(p.sku).toLowerCase() === pm.sku.toLowerCase()) ||
                            String(p.nume || '').toLowerCase() === pm.nume.toLowerCase()
                        );
                        if (produs) {
                            try {
                                await ZFlowDB.insertMiscare({
                                    produs_id: produs.id, tip: 'Intrare',
                                    cantitate: pm.stocInit, pret_unitar: pm.pret_achizitie,
                                    data: new Date().toISOString().slice(0, 10),
                                    observatii: 'Stoc inițial import'
                                });
                            } catch(_) { /* non-critical */ }
                        }
                    }
                    ZFlowStore.dateMiscariStoc = await ZFlowDB.fetchMiscariStoc().catch(() => ZFlowStore.dateMiscariStoc || []);
                }

                if (importate > 0) {
                    ZFlowStore.dateProduse = await ZFlowDB.fetchProduse().catch(() => ZFlowStore.dateProduse || []);
                    calculeazaKPIDepozit();
                    renderProduse();
                }

                let mesaj = `Import: ${importate} produse noi`;
                if (duplicate > 0) mesaj += `, ${duplicate} duplicate ignorate`;
                const tipNotif = importate > 0 ? 'success' : (erori.length > 0 ? 'error' : 'warning');
                if (typeof showNotification === 'function') showNotification(mesaj, tipNotif);
                if (erori.length > 0) console.warn('[Depozit Import Produse] Erori:', erori);

            } catch(err) {
                if (typeof showNotification === 'function') showNotification('Eroare import produse: ' + err.message, 'error');
                console.error('[Depozit Import Produse]', err);
            } finally {
                if (typeof setLoader === 'function') setLoader(false);
                fileInput.value = '';
            }
        });
    }
    fileInput.click();
}

// ==========================================
// MODAL RECEPȚIE — Task 1
// ==========================================
let _receptieItems = [];

function deschideModalReceptie() {
    _receptieItems = [];
    const modal = document.getElementById('modal-receptie');
    if (!modal) return;
    // Populează furnizor dropdown
    const furnSel = document.getElementById('rec-furnizor-select');
    if (furnSel) {
        furnSel.innerHTML = '<option value="">-- Furnizor (opțional) --</option>' +
            (ZFlowStore.dateFurnizori || []).map(f =>
                `<option value="${f.id}">${f.nume_firma || f.cui || f.id.slice(-4)}</option>`
            ).join('');
    }
    // Data implicit azi
    const dateEl = document.getElementById('rec-data');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    // Curăță items + obs
    const obsEl = document.getElementById('rec-obs');
    if (obsEl) obsEl.value = '';
    _renderItemsReceptie();
    modal.classList.add('active');
}

function inchideModalReceptie() {
    const m = document.getElementById('modal-receptie');
    if (m) m.classList.remove('active');
}

function _optiuniProduse() {
    return (ZFlowStore.dateProduse || [])
        .map(p => `<option value="${p.id}">${p.sku ? p.sku + ' – ' : ''}${p.nume || '?'} (${p.um || 'buc'})</option>`)
        .join('');
}

function _renderItemsReceptie() {
    const container = document.getElementById('rec-items-list');
    if (!container) return;
    if (!_receptieItems.length) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">Niciun produs adăugat</p>`;
        recalcTotalReceptie();
        return;
    }
    container.innerHTML = _receptieItems.map((item, idx) => `
        <div class="flex gap-2 items-center mb-1">
          <select class="flex-1 min-w-0 p-2 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
            onchange="_receptieItems[${idx}].produs_id=this.value">
            <option value="">-- Produs --</option>${_optiuniProduse()}
          </select>
          <input type="number" min="0.001" step="any" placeholder="Cant." value="${item.cantitate||''}"
            class="w-20 p-2 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
            oninput="_receptieItems[${idx}].cantitate=Number(this.value); recalcTotalReceptie()"/>
          <input type="number" min="0" step="any" placeholder="Preț/U" value="${item.pret_unitar||''}"
            class="w-20 p-2 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
            oninput="_receptieItems[${idx}].pret_unitar=Number(this.value); recalcTotalReceptie()"/>
          <button onclick="stergeItemReceptie(${idx})" class="text-red-500 hover:text-red-700 font-black text-base leading-none px-1">✕</button>
        </div>`).join('');
    // Re-selectăm produsele deja alese
    _receptieItems.forEach((item, idx) => {
        const sel = container.querySelectorAll('select')[idx];
        if (sel && item.produs_id) sel.value = item.produs_id;
    });
    recalcTotalReceptie();
}

function adaugaItemReceptie() {
    _receptieItems.push({ produs_id: '', cantitate: 1, pret_unitar: 0 });
    _renderItemsReceptie();
}

function stergeItemReceptie(idx) {
    _receptieItems.splice(idx, 1);
    _renderItemsReceptie();
}

function recalcTotalReceptie() {
    const total = _receptieItems.reduce((s, i) => s + (Number(i.cantitate)||0) * (Number(i.pret_unitar)||0), 0);
    const el = document.getElementById('rec-total-display');
    if (el) el.innerText = `Total: ${Math.round(total * 100) / 100} lei`;
}

async function salveazaReceptie() {
    const itemsValide = _receptieItems.filter(i => i.produs_id && Number(i.cantitate) > 0);
    if (!itemsValide.length) { showNotification('❌ Adaugă cel puțin un produs valid', 'error'); return; }
    const furnizorId = document.getElementById('rec-furnizor-select')?.value || null;
    const data = document.getElementById('rec-data')?.value || new Date().toISOString().split('T')[0];
    const obs = document.getElementById('rec-obs')?.value?.trim() || null;
    const total = itemsValide.reduce((s, i) => s + i.cantitate * i.pret_unitar, 0);

    setLoader(true);
    try {
        await ZFlowDB.insertReceptie({ furnizor_id: furnizorId || null, data, total, observatii: obs });
        for (const item of itemsValide) {
            await ZFlowDB.insertMiscare({
                produs_id: item.produs_id,
                tip: 'Intrare',
                cantitate: item.cantitate,
                pret_unitar: item.pret_unitar,
                data,
                referinta: `Recepție ${data}`,
                observatii: obs
            });
        }
        ZFlowStore.dateReceptii    = await ZFlowDB.fetchReceptii();
        ZFlowStore.dateMiscariStoc = await ZFlowDB.fetchMiscariStoc();
        inchideModalReceptie();
        calculeazaKPIDepozit();
        renderReceptiiDepozit();
        showNotification('✅ Recepție salvată!', 'success');
    } catch(err) {
        showNotification('❌ Eroare: ' + err.message, 'error');
    } finally { setLoader(false); }
}

// ==========================================
// MODAL LIVRARE — Task 1
// ==========================================
let _livrareItems = [];

function deschideModalLivrare() {
    _livrareItems = [];
    const modal = document.getElementById('modal-livrare');
    if (!modal) return;
    const clSel = document.getElementById('liv-client-select');
    if (clSel) {
        clSel.innerHTML = '<option value="">-- Client (opțional) --</option>' +
            (ZFlowStore.dateLocal || []).map(c =>
                `<option value="${c.id}">${c.nume_firma || c.cui || c.id.slice(-4)}</option>`
            ).join('');
    }
    const dateEl = document.getElementById('liv-data');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const obsEl = document.getElementById('liv-obs');
    if (obsEl) obsEl.value = '';
    _renderItemsLivrare();
    modal.classList.add('active');
}

function inchideModalLivrare() {
    const m = document.getElementById('modal-livrare');
    if (m) m.classList.remove('active');
}

function _renderItemsLivrare() {
    const container = document.getElementById('liv-items-list');
    if (!container) return;
    if (!_livrareItems.length) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">Niciun produs adăugat</p>`;
        recalcTotalLivrare();
        return;
    }
    container.innerHTML = _livrareItems.map((item, idx) => {
        const stoc = calcStocCurent(item.produs_id);
        return `<div class="flex gap-2 items-center mb-1">
          <select class="flex-1 min-w-0 p-2 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
            onchange="_livrareItems[${idx}].produs_id=this.value; _renderItemsLivrare()">
            <option value="">-- Produs --</option>${_optiuniProduse()}
          </select>
          <input type="number" min="0.001" step="any" placeholder="Cant." value="${item.cantitate||''}"
            class="w-20 p-2 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
            oninput="_livrareItems[${idx}].cantitate=Number(this.value); recalcTotalLivrare()"/>
          <input type="number" min="0" step="any" placeholder="Preț/U" value="${item.pret_unitar||''}"
            class="w-20 p-2 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200"
            oninput="_livrareItems[${idx}].pret_unitar=Number(this.value); recalcTotalLivrare()"/>
          <button onclick="stergeItemLivrare(${idx})" class="text-red-500 hover:text-red-700 font-black text-base leading-none px-1">✕</button>
        </div>`;
    }).join('');
    _livrareItems.forEach((item, idx) => {
        const sel = container.querySelectorAll('select')[idx];
        if (sel && item.produs_id) sel.value = item.produs_id;
    });
    recalcTotalLivrare();
}

function adaugaItemLivrare() {
    _livrareItems.push({ produs_id: '', cantitate: 1, pret_unitar: 0 });
    _renderItemsLivrare();
}

function stergeItemLivrare(idx) {
    _livrareItems.splice(idx, 1);
    _renderItemsLivrare();
}

function recalcTotalLivrare() {
    const total = _livrareItems.reduce((s, i) => s + (Number(i.cantitate)||0) * (Number(i.pret_unitar)||0), 0);
    const el = document.getElementById('liv-total-display');
    if (el) el.innerText = `Total: ${Math.round(total * 100) / 100} lei`;
}

async function salveazaLivrare() {
    const itemsValide = _livrareItems.filter(i => i.produs_id && Number(i.cantitate) > 0);
    if (!itemsValide.length) { showNotification('❌ Adaugă cel puțin un produs valid', 'error'); return; }
    const clientId = document.getElementById('liv-client-select')?.value || null;
    const data = document.getElementById('liv-data')?.value || new Date().toISOString().split('T')[0];
    const obs = document.getElementById('liv-obs')?.value?.trim() || null;
    const total = itemsValide.reduce((s, i) => s + i.cantitate * i.pret_unitar, 0);

    // Verifică stoc înainte de salvare
    for (const item of itemsValide) {
        const stocDisp = calcStocCurent(item.produs_id);
        const prod = (ZFlowStore.dateProduse || []).find(p => String(p.id) === String(item.produs_id));
        if (Number(item.cantitate) > stocDisp) {
            showNotification(`❌ Stoc insuficient pentru ${prod?.nume || 'produs'} (${stocDisp} disponibil)`, 'error');
            return;
        }
    }

    setLoader(true);
    try {
        await ZFlowDB.insertLivrare({ client_id: clientId || null, data, total, observatii: obs });
        for (const item of itemsValide) {
            await ZFlowDB.insertMiscare({
                produs_id: item.produs_id,
                tip: 'Iesire',
                cantitate: item.cantitate,
                pret_unitar: item.pret_unitar,
                data,
                referinta: `Livrare ${data}`,
                observatii: obs
            });
        }
        ZFlowStore.dateLivrari     = await ZFlowDB.fetchLivrari();
        ZFlowStore.dateMiscariStoc = await ZFlowDB.fetchMiscariStoc();
        inchideModalLivrare();
        calculeazaKPIDepozit();
        renderLivrariDepozit();
        showNotification('✅ Livrare salvată!', 'success');
    } catch(err) {
        showNotification('❌ Eroare: ' + err.message, 'error');
    } finally { setLoader(false); }
}

// ==========================================
// EXPORT CSV DEPOZIT — Task 8
// ==========================================
function exportProduseCSV() {
    const produse = ZFlowStore.dateProduse || [];
    if (!produse.length) { showNotification('Nu există produse de exportat', 'error'); return; }
    const headers = ['SKU', 'Nume', 'UM', 'Categorie', 'Pret Achizitie', 'Pret Vanzare', 'Stoc Min', 'Stoc Curent'];
    const rows = produse.map(p => [
        `"${p.sku||''}"`, `"${(p.nume||'').replace(/"/g,'""')}"`,
        `"${p.um||'buc'}"`, `"${p.categorie||''}"`,
        p.pret_achizitie||0, p.pret_vanzare||0, p.stoc_min||0,
        calcStocCurent(p.id)
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `produse_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showNotification('✅ Export produse finalizat', 'success');
}

function exportMiscariStocCSV() {
    const miscari = ZFlowStore.dateMiscariStoc || [];
    if (!miscari.length) { showNotification('Nu există mișcări de exportat', 'error'); return; }
    const headers = ['Data', 'Tip', 'Produs', 'SKU', 'Cantitate', 'Pret Unitar', 'Referinta', 'Observatii'];
    const rows = miscari.map(m => {
        const p = (ZFlowStore.dateProduse||[]).find(x => String(x.id) === String(m.produs_id));
        return [
            m.data||'', `"${m.tip||''}"`,
            `"${(p?.nume||'').replace(/"/g,'""')}"`, `"${p?.sku||''}"`,
            m.cantitate||0, m.pret_unitar||0,
            `"${m.referinta||''}"`, `"${(m.observatii||'').replace(/"/g,'""')}"`
        ];
    });
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miscari_stoc_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showNotification('✅ Export mișcări finalizat', 'success');
}

// ==========================================
// EXPORT GLOBAL
// ==========================================
window.calcStocCurent          = calcStocCurent;
window.calculeazaKPIDepozit    = calculeazaKPIDepozit;
window.renderDepozit           = renderDepozit;
window.schimbaViewDepozit      = schimbaViewDepozit;
window.renderProduse           = renderProduse;
window.renderMiscariStoc       = renderMiscariStoc;
window.renderReceptiiDepozit   = renderReceptiiDepozit;
window.renderLivrariDepozit    = renderLivrariDepozit;
window.deschideModalProdus     = deschideModalProdus;
window.inchideModalProdus      = inchideModalProdus;
window.salveazaProdus          = salveazaProdus;
window.stergeProdus            = stergeProdus;
window.deschideModalMiscare    = deschideModalMiscare;
window.inchideModalMiscare     = inchideModalMiscare;
window.salveazaMiscare         = salveazaMiscare;
window.initDepozit             = initDepozit;
window.importaProduse          = importaProduse;
window.initDepozitServer       = initDepozitServer;
window.syncDepozitServer       = syncDepozitServer;
// Task 1 — Recepții & Livrări modals
window.deschideModalReceptie   = deschideModalReceptie;
window.inchideModalReceptie    = inchideModalReceptie;
window.adaugaItemReceptie      = adaugaItemReceptie;
window.stergeItemReceptie      = stergeItemReceptie;
window.recalcTotalReceptie     = recalcTotalReceptie;
window.salveazaReceptie        = salveazaReceptie;
window.deschideModalLivrare    = deschideModalLivrare;
window.inchideModalLivrare     = inchideModalLivrare;
window.adaugaItemLivrare       = adaugaItemLivrare;
window.stergeItemLivrare       = stergeItemLivrare;
window.recalcTotalLivrare      = recalcTotalLivrare;
window.salveazaLivrare         = salveazaLivrare;
// Task 8 — Export
window.exportProduseCSV        = exportProduseCSV;
window.exportMiscariStocCSV    = exportMiscariStocCSV;

// Debounced version for search input
const renderProduseDebounced = (typeof debounce === 'function')
    ? debounce(renderProduse, 250)
    : renderProduse;
window.renderProduseDebounced = renderProduseDebounced;

// ==========================================
// INTEGRARE SERVER DEDICAT DEPOZIT (STUB — implementare viitoare)
// ==========================================
/**
 * Configurare server dedicat pentru sincronizarea datelor de depozit.
 *
 * Arhitectură planificată:
 *  1. Autentificare → POST {SERVER_URL}/api/auth  (Basic / API Key)
 *  2. Fetch stocuri de pe server → GET  {SERVER_URL}/api/stocuri
 *  3. Push stoc local → PUT  {SERVER_URL}/api/stocuri (sync bidirecțional)
 *  4. Upload mișcări → POST {SERVER_URL}/api/miscari
 *  5. Fetch recepții/livrări → GET {SERVER_URL}/api/receptii + /livrari
 *  6. Webhook opțional → server notifică app la modificări de stoc critic
 *
 * Pentru activare: setează window.DEPOZIT_SERVER_CONFIG = { serverUrl, apiKey, userId }
 *   înainte de încărcarea aplicației.
 *
 * Mecanisme de securitate recomandate:
 *  - HTTPS obligatoriu
 *  - Token JWT cu expirare 1h + refresh token
 *  - Rate limiting pe endpoint-uri critice
 *  - Log audit pentru orice modificare de stoc
 */
const DEPOZIT_SERVER_CONFIG = window.DEPOZIT_SERVER_CONFIG || {
    serverUrl: null,   // ex: 'https://depozit.firma-mea.ro/api'
    apiKey:    null,   // cheie API emisă de serverul dedicat
    userId:    null    // ID-ul utilizatorului curent (multi-tenant)
};

async function initDepozitServer() {
    if (!DEPOZIT_SERVER_CONFIG.serverUrl || !DEPOZIT_SERVER_CONFIG.apiKey) {
        console.info('[DepozitServer] Nu este configurat. Setați window.DEPOZIT_SERVER_CONFIG = { serverUrl, apiKey, userId } pentru activare.');
        return;
    }
    try {
        await syncDepozitServer();
        console.info('[DepozitServer] Sincronizare inițială completă.');
    } catch (err) {
        console.warn('[DepozitServer] Eroare inițializare (non-fatal):', err.message);
    }
}

async function syncDepozitServer() {
    if (!DEPOZIT_SERVER_CONFIG.serverUrl) return;

    // TODO: Implementare fetch stocuri de pe serverul dedicat
    // const resp = await fetch(`${DEPOZIT_SERVER_CONFIG.serverUrl}/stocuri`, {
    //     headers: {
    //         'Authorization': `Bearer ${DEPOZIT_SERVER_CONFIG.apiKey}`,
    //         'X-User-Id':     DEPOZIT_SERVER_CONFIG.userId || ''
    //     }
    // });
    // const { produse, miscari, receptii, livrari } = await resp.json();
    // ZFlowStore.dateProduse     = produse;
    // ZFlowStore.dateMiscariStoc = miscari;
    // ZFlowStore.dateReceptii    = receptii;
    // ZFlowStore.dateLivrari     = livrari;
    // calculeazaKPIDepozit();
    // renderDepozit();

    console.info('[DepozitServer] syncDepozitServer — stub, nu implementat.');
}

async function uploadMiscareServer(miscare) {
    if (!DEPOZIT_SERVER_CONFIG.serverUrl) return;

    // TODO: Trimitere mișcare de stoc la serverul dedicat
    // await fetch(`${DEPOZIT_SERVER_CONFIG.serverUrl}/miscari`, {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type':  'application/json',
    //         'Authorization': `Bearer ${DEPOZIT_SERVER_CONFIG.apiKey}`
    //     },
    //     body: JSON.stringify({ ...miscare, userId: DEPOZIT_SERVER_CONFIG.userId })
    // });

    console.info('[DepozitServer] uploadMiscareServer — stub, nu implementat.', miscare);
}
