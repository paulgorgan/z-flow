/**
 * Z-FLOW Enterprise v7.14
 * Modul Logistic — Comenzi Transport, Șoferi, Vehicule, Tracking
 */

// ==========================================
// KPI & RENDER PRINCIPAL
// ==========================================

function calculeazaKPILogistic() {
    const comenzi  = ZFlowStore.dateComenziTransport || [];
    const soferi   = ZFlowStore.dateSoferi   || [];
    const vehicule = ZFlowStore.dateVehicule || [];
    const active   = comenzi.filter(c => c.status === 'In curs' || c.status === 'Planificat').length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    set('logistic-kpi-comenzi',  active);
    set('logistic-kpi-soferi',   soferi.length);
    set('logistic-kpi-vehicule', vehicule.length);
}

function renderLogistic() {
    calculeazaKPILogistic();
    schimbaViewLogistic(ZFlowStore.logisticView || 'comenzi', false);
}

function schimbaViewLogistic(view, updateStore = true) {
    if (updateStore) ZFlowStore.logisticView = view;
    ['comenzi', 'soferi', 'vehicule'].forEach(v => {
        const el = document.getElementById('logistic-view-' + v);
        if (el) el.classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.logistic-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'comenzi')  renderComenziTransport();
    else if (view === 'soferi')    renderSoferi();
    else if (view === 'vehicule')  renderVehicule();
}

// ==========================================
// COMENZI TRANSPORT
// ==========================================

function renderComenziTransport() {
    const container = document.getElementById('logistic-comenzi-list');
    if (!container) return;
    const q = (document.getElementById('logistic-search')?.value || '').toLowerCase();
    const all = (ZFlowStore.dateComenziTransport || [])
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .filter(c => !q || (c.ruta_de||'').toLowerCase().includes(q) || (c.ruta_la||'').toLowerCase().includes(q) || (c.tracking_code||'').toLowerCase().includes(q));
    ZFlowStore._comenziFiltrate = all;
    const ps  = ZFlowStore.comenziPageSize ?? 10;
    const pg  = ZFlowStore.comenziCurrentPage || 1;
    const tp  = ps === 0 ? 1 : Math.ceil(all.length / ps);
    if (pg > tp) ZFlowStore.comenziCurrentPage = 1;
    const s0  = ps === 0 ? 0 : ((ZFlowStore.comenziCurrentPage||1) - 1) * ps;
    const list = ps === 0 ? all : all.slice(s0, s0 + ps);
    const pgEl = document.getElementById('comenzi-pagination');

    if (!all.length) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h14l2-1V9a1 1 0 00-1-1h-5l-2-2h-3"/>
          </svg>
          <p class="text-sm font-bold">Nicio comandă de transport</p>
          <p class="text-xs mt-1 opacity-70">Adaugă prima comandă pentru a gestiona livrările</p>
        </div>`;
        if (pgEl) pgEl.innerHTML = '';
        return;
    }

    const statusCls = { 'Planificat': 'bg-blue-100 text-blue-700', 'In curs': 'bg-amber-100 text-amber-700', 'Livrat': 'bg-emerald-100 text-emerald-700', 'Anulat': 'bg-red-100 text-red-700' };
    container.innerHTML = list.map(c => {
        try {
            const cl    = (ZFlowStore.dateLocal || []).find(x => String(x.id) === String(c.client_id));
            const sofer = (ZFlowStore.dateSoferi || []).find(x => String(x.id) === String(c.sofer_id));
            const veh   = (ZFlowStore.dateVehicule || []).find(x => String(x.id) === String(c.vehicul_id));
            const stCls = statusCls[c.status] || 'bg-slate-100 text-slate-600';
            return `<div class="flex items-start gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="deschideModalComandaTransport('${c.id}')">
              <div class="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h14l2-1V9a1 1 0 00-1-1h-5l-2-2h-3"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-black text-slate-800 truncate">${c.ruta_de || '—'} → ${c.ruta_la || '—'}</p>
                <p class="text-xs text-slate-400 truncate">${cl?.nume_firma || 'Fără client'} &middot; ${sofer?.nume || 'Fără șofer'} &middot; ${veh?.nr_inmatriculare || 'Fără vehicul'}</p>
                ${c.tracking_code ? `<p class="text-[10px] font-mono text-blue-500 mt-0.5">${c.tracking_code}</p>` : ''}
              </div>
              <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span class="text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${stCls}">${c.status || 'Draft'}</span>
                <span class="text-[10px] text-slate-400">${c.data_plecare ? new Date(c.data_plecare).toLocaleDateString('ro-RO') : '—'}</span>
              </div>
            </div>`;
        } catch (itemErr) {
            console.warn('[Logistic] renderComenziTransport item error:', itemErr);
            return `<div class="text-xs text-red-400 px-4 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare comandă</div>`;
        }
    }).join('');
    if (pgEl && typeof window._paginareHTML === 'function') {
        pgEl.innerHTML = all.length > 5 ? window._paginareHTML(all.length, ps, ZFlowStore.comenziCurrentPage||1, 'comenzi') : '';
    }
}

// ==========================================
// ȘOFERI
// ==========================================

function renderSoferi() {
    const container = document.getElementById('logistic-soferi-list');
    if (!container) return;
    const all = ZFlowStore.dateSoferi || [];
    ZFlowStore._soferiFiltrati = all;
    const ps  = ZFlowStore.soferiPageSize ?? 10;
    const pg  = ZFlowStore.soferiCurrentPage || 1;
    const tp  = ps === 0 ? 1 : Math.ceil(all.length / ps);
    if (pg > tp) ZFlowStore.soferiCurrentPage = 1;
    const s0  = ps === 0 ? 0 : ((ZFlowStore.soferiCurrentPage||1) - 1) * ps;
    const list = ps === 0 ? all : all.slice(s0, s0 + ps);
    const pgEl = document.getElementById('soferi-pagination');

    if (!all.length) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm font-bold">Niciun șofer înregistrat</div>`;
        if (pgEl) pgEl.innerHTML = '';
        return;
    }
    container.innerHTML = list.map(s => {
        try {
            return `
      <div class="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
        <div class="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <span class="text-purple-700 font-black text-base">${(s.nume||'?').charAt(0).toUpperCase()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-black text-slate-800 truncate">${s.nume || '—'}</p>
          <p class="text-xs text-slate-400">${s.telefon || '—'} &middot; Permis: ${s.nr_permis || '—'}</p>
        </div>
        <div class="flex gap-1.5">
          <button onclick="deschideModalSofer('${s.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-blue-50 text-blue-500 transition-all" data-permission="edit">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="stergeSofer('${s.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400 transition-all" data-permission="delete">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>`;
        } catch (itemErr) {
            console.warn('[Logistic] renderSoferi item error:', itemErr);
            return `<div class="text-xs text-red-400 px-4 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare șofer</div>`;
        }
    }).join('');
    if (pgEl && typeof window._paginareHTML === 'function') {
        pgEl.innerHTML = all.length > 5 ? window._paginareHTML(all.length, ps, ZFlowStore.soferiCurrentPage||1, 'soferi') : '';
    }
}

// ==========================================
// VEHICULE
// ==========================================

function renderVehicule() {
    const container = document.getElementById('logistic-vehicule-list');
    if (!container) return;
    const all = ZFlowStore.dateVehicule || [];
    ZFlowStore._vehiculeFiltrate = all;
    const ps  = ZFlowStore.vehiculePageSize ?? 10;
    const pg  = ZFlowStore.vehiculeCurrentPage || 1;
    const tp  = ps === 0 ? 1 : Math.ceil(all.length / ps);
    if (pg > tp) ZFlowStore.vehiculeCurrentPage = 1;
    const s0  = ps === 0 ? 0 : ((ZFlowStore.vehiculeCurrentPage||1) - 1) * ps;
    const list = ps === 0 ? all : all.slice(s0, s0 + ps);
    const pgEl = document.getElementById('vehicule-pagination');

    if (!all.length) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm font-bold">Niciun vehicul înregistrat</div>`;
        if (pgEl) pgEl.innerHTML = '';
        return;
    }
    container.innerHTML = list.map(v => {
        try {
            return `
      <div class="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
        <div class="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h14l2-1V9a1 1 0 00-1-1h-5l-2-2h-3"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-black text-slate-800 font-mono">${v.nr_inmatriculare || '—'}</p>
          <p class="text-xs text-slate-400">${v.marca||''} ${v.model||''} &middot; ${v.tip || 'Autovehicul'}</p>
        </div>
        <div class="flex gap-1.5">
          <button onclick="deschideModalVehicul('${v.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-blue-50 text-blue-500 transition-all" data-permission="edit">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="stergeVehicul('${v.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400 transition-all" data-permission="delete">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>`;
        } catch (itemErr) {
            console.warn('[Logistic] renderVehicule item error:', itemErr);
            return `<div class="text-xs text-red-400 px-4 py-2 bg-red-50 rounded-xl mb-1">Eroare afișare vehicul</div>`;
        }
    }).join('');
    if (pgEl && typeof window._paginareHTML === 'function') {
        pgEl.innerHTML = all.length > 5 ? window._paginareHTML(all.length, ps, ZFlowStore.vehiculeCurrentPage||1, 'vehicule') : '';
    }
}

// ==========================================
// MODAL COMANDĂ TRANSPORT
// ==========================================

function deschideModalComandaTransport(id, opts) {
    const modal = document.getElementById('modal-comanda-transport');
    if (!modal) return;
    const f = el => document.getElementById(el);
    if (f('ct-modal-title')) f('ct-modal-title').innerText = id ? 'Editează Comandă' : 'Comandă Nouă';
    if (f('ct-id-hidden'))   f('ct-id-hidden').value = id || '';

    // Populează dropdown-uri
    const clSel = f('ct-client-select');
    if (clSel) clSel.innerHTML = '<option value="">— Client —</option>' + (ZFlowStore.dateLocal||[]).map(c => `<option value="${c.id}">${c.nume_firma}</option>`).join('');
    const sfSel = f('ct-sofer-select');
    if (sfSel) sfSel.innerHTML = '<option value="">— Șofer —</option>' + (ZFlowStore.dateSoferi||[]).map(s => `<option value="${s.id}">${s.nume}</option>`).join('');
    const vhSel = f('ct-vehicul-select');
    if (vhSel) vhSel.innerHTML = '<option value="">— Vehicul —</option>' + (ZFlowStore.dateVehicule||[]).map(v => `<option value="${v.id}">${v.nr_inmatriculare} ${v.marca||''} ${v.model||''}</option>`).join('');

    ['ct-ruta-de','ct-ruta-la','ct-data-plecare','ct-data-livrare','ct-tracking','ct-valoare','ct-obs'].forEach(el => { const e = f(el); if (e) e.value = ''; });
    if (f('ct-status')) f('ct-status').value = 'Planificat';

    if (id) {
        const c = (ZFlowStore.dateComenziTransport||[]).find(x => String(x.id) === String(id));
        if (c) {
            if (clSel)            clSel.value               = c.client_id || '';
            if (sfSel)            sfSel.value               = c.sofer_id || '';
            if (vhSel)            vhSel.value               = c.vehicul_id || '';
            if (f('ct-ruta-de'))       f('ct-ruta-de').value      = c.ruta_de || '';
            if (f('ct-ruta-la'))       f('ct-ruta-la').value      = c.ruta_la || '';
            if (f('ct-data-plecare'))  f('ct-data-plecare').value = c.data_plecare || '';
            if (f('ct-data-livrare')) f('ct-data-livrare').value  = c.data_livrare || '';
            if (f('ct-status'))        f('ct-status').value       = c.status || 'Planificat';
            if (f('ct-tracking'))      f('ct-tracking').value     = c.tracking_code || '';
            if (f('ct-valoare'))       f('ct-valoare').value      = c.valoare || '';
            if (f('ct-obs'))           f('ct-obs').value          = c.observatii || '';
        }
    }
    // Pre-populare din corelarea cu modulul financiar
    if (!id && opts) {
        if (opts.obs && f('ct-obs')) f('ct-obs').value = opts.obs;
    }
    modal.classList.add('active');
}

function inchideModalComandaTransport() {
    const m = document.getElementById('modal-comanda-transport'); if (m) m.classList.remove('active');
}

async function salveazaComandaTransport() {
    const fv = el => document.getElementById(el)?.value?.trim() || '';
    const id = document.getElementById('ct-id-hidden')?.value;
    const rutaDe = fv('ct-ruta-de'), rutaLa = fv('ct-ruta-la');
    if (!rutaDe || !rutaLa) { showNotification('❌ Completează ruta (plecare și destinație)', 'error'); return; }

    setLoader(true);
    try {
        const payload = {
            client_id:     document.getElementById('ct-client-select')?.value || null,
            sofer_id:      document.getElementById('ct-sofer-select')?.value || null,
            vehicul_id:    document.getElementById('ct-vehicul-select')?.value || null,
            ruta_de:       rutaDe,
            ruta_la:       rutaLa,
            data_plecare:  fv('ct-data-plecare') || null,
            data_livrare:  fv('ct-data-livrare') || null,
            status:        document.getElementById('ct-status')?.value || 'Planificat',
            tracking_code: fv('ct-tracking') || null,
            valoare:       Number(fv('ct-valoare')) || 0,
            observatii:    fv('ct-obs') || null
        };
        if (id) {
            await ZFlowDB.updateComandaTransport(id, payload);
            const arr = ZFlowStore.dateComenziTransport;
            const i = arr.findIndex(x => String(x.id) === String(id));
            if (i !== -1) arr[i] = { ...arr[i], ...payload };
        } else {
            await ZFlowDB.insertComandaTransport(payload);
            ZFlowStore.dateComenziTransport = await ZFlowDB.fetchComenziTransport();
        }
        inchideModalComandaTransport();
        calculeazaKPILogistic();
        renderComenziTransport();
        showNotification('✅ Comandă salvată!', 'success');
    } catch (err) {
        showNotification('❌ Eroare: ' + err.message, 'error');
    } finally { setLoader(false); }
}

async function stergeComandaTransport(id) {
    if (!confirm('Ștergi comanda de transport?')) return;
    setLoader(true);
    try {
        await ZFlowDB.deleteComandaTransport(id);
        ZFlowStore.dateComenziTransport = ZFlowStore.dateComenziTransport.filter(x => String(x.id) !== String(id));
        calculeazaKPILogistic();
        renderComenziTransport();
        showNotification('✅ Comandă ștearsă', 'success');
    } catch (err) {
        showNotification('❌ Eroare: ' + err.message, 'error');
    } finally { setLoader(false); }
}

// ==========================================
// MODAL ȘOFER
// ==========================================

function deschideModalSofer(id) {
    const modal = document.getElementById('modal-sofer');
    if (!modal) return;
    const f = el => document.getElementById(el);
    if (f('sofer-modal-title')) f('sofer-modal-title').innerText = id ? 'Editează Șofer' : 'Șofer Nou';
    if (f('sofer-id-hidden'))   f('sofer-id-hidden').value = id || '';
    ['sofer-name','sofer-tel','sofer-permis','sofer-cnp'].forEach(el => { const e = f(el); if (e) e.value = ''; });
    if (id) {
        const s = (ZFlowStore.dateSoferi||[]).find(x => String(x.id) === String(id));
        if (s) {
            if (f('sofer-name'))   f('sofer-name').value   = s.nume || '';
            if (f('sofer-tel'))    f('sofer-tel').value    = s.telefon || '';
            if (f('sofer-permis')) f('sofer-permis').value = s.nr_permis || '';
            if (f('sofer-cnp'))    f('sofer-cnp').value    = s.cnp || '';
        }
    }
    modal.classList.add('active');
}

function inchideModalSofer() { const m = document.getElementById('modal-sofer'); if (m) m.classList.remove('active'); }

async function salveazaSofer() {
    const fv = el => document.getElementById(el)?.value?.trim() || '';
    const id = document.getElementById('sofer-id-hidden')?.value;
    const name = fv('sofer-name');
    if (!name) { showNotification('❌ Completează numele șoferului', 'error'); return; }
    setLoader(true);
    try {
        const payload = { nume: name, telefon: fv('sofer-tel')||null, nr_permis: fv('sofer-permis')||null, cnp: fv('sofer-cnp')||null };
        if (id) {
            await ZFlowDB.updateSofer(id, payload);
            const arr = ZFlowStore.dateSoferi; const i = arr.findIndex(x=>String(x.id)===String(id)); if(i!==-1) arr[i]={...arr[i],...payload};
        } else {
            await ZFlowDB.insertSofer(payload);
            ZFlowStore.dateSoferi = await ZFlowDB.fetchSoferi();
        }
        inchideModalSofer(); calculeazaKPILogistic(); renderSoferi();
        showNotification('✅ Șofer salvat!', 'success');
    } catch (err) { showNotification('❌ Eroare: '+err.message,'error'); } finally { setLoader(false); }
}

async function stergeSofer(id) {
    if (!confirm('Ștergi șoferul?')) return;
    setLoader(true);
    try {
        await ZFlowDB.deleteSofer(id);
        ZFlowStore.dateSoferi = ZFlowStore.dateSoferi.filter(x=>String(x.id)!==String(id));
        calculeazaKPILogistic(); renderSoferi();
        showNotification('✅ Șofer șters','success');
    } catch (err) { showNotification('❌ Eroare: '+err.message,'error'); } finally { setLoader(false); }
}

// ==========================================
// MODAL VEHICUL
// ==========================================

function deschideModalVehicul(id) {
    const modal = document.getElementById('modal-vehicul');
    if (!modal) return;
    const f = el => document.getElementById(el);
    if (f('vehicul-modal-title')) f('vehicul-modal-title').innerText = id ? 'Editează Vehicul' : 'Vehicul Nou';
    if (f('vehicul-id-hidden'))   f('vehicul-id-hidden').value = id || '';
    ['vehicul-nr','vehicul-marca','vehicul-model','vehicul-tip'].forEach(el => { const e = f(el); if (e) e.value = ''; });
    if (id) {
        const v = (ZFlowStore.dateVehicule||[]).find(x=>String(x.id)===String(id));
        if (v) {
            if (f('vehicul-nr'))    f('vehicul-nr').value    = v.nr_inmatriculare || '';
            if (f('vehicul-marca')) f('vehicul-marca').value = v.marca || '';
            if (f('vehicul-model')) f('vehicul-model').value = v.model || '';
            if (f('vehicul-tip'))   f('vehicul-tip').value   = v.tip || 'Camion';
        }
    }
    modal.classList.add('active');
}

function inchideModalVehicul() { const m = document.getElementById('modal-vehicul'); if (m) m.classList.remove('active'); }

async function salveazaVehicul() {
    const fv = el => document.getElementById(el)?.value?.trim() || '';
    const id = document.getElementById('vehicul-id-hidden')?.value;
    const nr = fv('vehicul-nr');
    if (!nr) { showNotification('❌ Completează nr. de înmatriculare', 'error'); return; }
    setLoader(true);
    try {
        const payload = { nr_inmatriculare: nr, marca: fv('vehicul-marca')||null, model: fv('vehicul-model')||null, tip: fv('vehicul-tip')||'Camion' };
        if (id) {
            await ZFlowDB.updateVehicul(id, payload);
            const arr = ZFlowStore.dateVehicule; const i = arr.findIndex(x=>String(x.id)===String(id)); if(i!==-1) arr[i]={...arr[i],...payload};
        } else {
            await ZFlowDB.insertVehicul(payload);
            ZFlowStore.dateVehicule = await ZFlowDB.fetchVehicule();
        }
        inchideModalVehicul(); calculeazaKPILogistic(); renderVehicule();
        showNotification('✅ Vehicul salvat!', 'success');
    } catch (err) { showNotification('❌ Eroare: '+err.message,'error'); } finally { setLoader(false); }
}

async function stergeVehicul(id) {
    if (!confirm('Ștergi vehiculul?')) return;
    setLoader(true);
    try {
        await ZFlowDB.deleteVehicul(id);
        ZFlowStore.dateVehicule = ZFlowStore.dateVehicule.filter(x=>String(x.id)!==String(id));
        calculeazaKPILogistic(); renderVehicule();
        showNotification('✅ Vehicul șters','success');
    } catch (err) { showNotification('❌ Eroare: '+err.message,'error'); } finally { setLoader(false); }
}

// ==========================================
// INIȚIALIZARE DATE LOGISTIC
// ==========================================

async function initLogistic() {
    try {
        const [soferi, vehicule, comenzi] = await Promise.all([
            ZFlowDB.fetchSoferi(),
            ZFlowDB.fetchVehicule(),
            ZFlowDB.fetchComenziTransport()
        ]);
        ZFlowStore.dateSoferi             = soferi;
        ZFlowStore.dateVehicule           = vehicule;
        ZFlowStore.dateComenziTransport   = comenzi;
        console.log(`🚛 Logistic: ${soferi.length} șoferi, ${vehicule.length} vehicule, ${comenzi.length} comenzi`);
    } catch (err) {
        console.warn('[Logistic] Eroare inițializare (non-fatal):', err.message);
        ZFlowStore.dateSoferi           = ZFlowStore.dateSoferi           || [];
        ZFlowStore.dateVehicule         = ZFlowStore.dateVehicule         || [];
        ZFlowStore.dateComenziTransport = ZFlowStore.dateComenziTransport || [];
    }
}

// ==========================================
// EXPORT GLOBAL
// ==========================================
window.calculeazaKPILogistic          = calculeazaKPILogistic;
window.renderLogistic                 = renderLogistic;
window.schimbaViewLogistic            = schimbaViewLogistic;
window.renderComenziTransport         = renderComenziTransport;
window.renderSoferi                   = renderSoferi;
window.renderVehicule                 = renderVehicule;
window.deschideModalComandaTransport  = deschideModalComandaTransport;
window.inchideModalComandaTransport   = inchideModalComandaTransport;
window.salveazaComandaTransport       = salveazaComandaTransport;
window.stergeComandaTransport         = stergeComandaTransport;
window.deschideModalSofer             = deschideModalSofer;
window.inchideModalSofer              = inchideModalSofer;
window.salveazaSofer                  = salveazaSofer;
window.stergeSofer                    = stergeSofer;
window.deschideModalVehicul           = deschideModalVehicul;
window.inchideModalVehicul            = inchideModalVehicul;
window.salveazaVehicul                = salveazaVehicul;
window.stergeVehicul                  = stergeVehicul;
window.initLogistic                   = initLogistic;
window.initSafefleet                  = initSafefleet;
window.syncSafefleetVehicule          = syncSafefleetVehicule;

// Debounced versions for search inputs
const renderComenziTransportDebounced = (typeof debounce === 'function')
    ? debounce(renderComenziTransport, 250)
    : renderComenziTransport;
window.renderComenziTransportDebounced = renderComenziTransportDebounced;

// ==========================================
// INTEGRARE SAFEFLEET (STUB — implementare viitoare)
// ==========================================
/**
 * Configurare integrare Safefleet / GPS Tracking
 *
 * Arhitectură planificată:
 *  1. Autentificare cu API Key Safefleet → endpoint: POST {SAFEFLEET_URL}/auth/token
 *  2. Sincronizare vehicule → GET {SAFEFLEET_URL}/vehicles → mapare la ZFlowStore.dateVehicule
 *  3. Tracking live → WebSocket / polling GET {SAFEFLEET_URL}/tracking/{vehicleId}
 *  4. Afișare pe hartă Leaflet (initMap) din tab Logistic
 *
 * Pentru activare: setează window.SAFEFLEET_CONFIG = { apiUrl, apiKey }
 *   înainte de încărcarea aplicației.
 */
const SAFEFLEET_CONFIG = window.SAFEFLEET_CONFIG || { apiUrl: null, apiKey: null };

async function initSafefleet() {
    if (!SAFEFLEET_CONFIG.apiUrl || !SAFEFLEET_CONFIG.apiKey) {
        console.info('[Safefleet] Nu este configurat. Setați window.SAFEFLEET_CONFIG = { apiUrl, apiKey } pentru activare.');
        return;
    }
    try {
        await syncSafefleetVehicule();
        console.info('[Safefleet] Sincronizare vehicule completă.');
    } catch (err) {
        console.warn('[Safefleet] Eroare inițializare (non-fatal):', err.message);
    }
}

async function syncSafefleetVehicule() {
    if (!SAFEFLEET_CONFIG.apiUrl) return;
    // TODO: Implementare fetch API Safefleet
    // const resp = await fetch(`${SAFEFLEET_CONFIG.apiUrl}/vehicles`, {
    //     headers: { 'Authorization': `Bearer ${SAFEFLEET_CONFIG.apiKey}` }
    // });
    // const data = await resp.json();
    // ZFlowStore.dateVehicule = data.vehicles.map(v => ({ ...v, _safefleet: true }));
    // renderVehicule();
    console.info('[Safefleet] syncSafefleetVehicule — stub, nu implementat.');
}

// ==========================================
// IMPORT COMENZI TRANSPORT (CSV extern)
// ==========================================
async function importaComenziTransport() {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.csv,text/csv';
        input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return resolve();
            const text = await file.text();
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 2) { alert('CSV gol sau fără date'); return resolve(); }
            const delim = lines[0].includes(';') ? ';' : ',';
            const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/^"(.*)"$/, '$1'));
            const get = (row, col) => { const i = headers.indexOf(col); return i >= 0 ? (row[i]||'').trim().replace(/^"(.*)"$/, '$1') : ''; };
            const existente = ZFlowStore.dateComenziTransport || [];
            let importate = 0, sarite = 0, erori = 0;
            for (const line of lines.slice(1)) {
                const row = line.split(delim);
                const tracking  = get(row, 'tracking_code');
                const ruta_de   = get(row, 'ruta_de');
                const ruta_la   = get(row, 'ruta_la');
                const data_plic = get(row, 'data_plecare');
                const isDup = tracking
                    ? existente.some(c => c.tracking_code === tracking)
                    : existente.some(c => c.ruta_de === ruta_de && c.ruta_la === ruta_la && c.data_plecare === data_plic);
                if (isDup) { sarite++; continue; }
                try {
                    await ZFlowDB.insertComanda({
                        ruta_de, ruta_la,
                        data_plecare:  data_plic || null,
                        data_livrare:  get(row, 'data_livrare') || null,
                        tracking_code: tracking || null,
                        valoare:       Number(get(row, 'valoare')) || null,
                        status:        get(row, 'status') || 'Planificat',
                        observatii:    get(row, 'observatii') || null,
                    });
                    importate++;
                } catch (err) {
                    console.warn('[ImportComenzi] rând eroare:', err.message); erori++;
                }
            }
            ZFlowStore.dateComenziTransport = await ZFlowDB.fetchComenzi().catch(() => ZFlowStore.dateComenziTransport);
            renderComenziTransport();
            alert(`Import finalizat: ${importate} importate, ${sarite} sărite (duplicate), ${erori} erori.`);
            resolve();
        };
        input.click();
    });
}
window.importaComenziTransport = importaComenziTransport;
