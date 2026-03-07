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
                <div class="flex gap-1 mt-1">
                  <button onclick="event.stopPropagation(); deschideModalComandaTransport('${c.id}')" title="Editează comandă"
                      class="w-7 h-7 flex items-center justify-center rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-500 transition-all border border-blue-100 hover:border-blue-600" data-permission="edit">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                  </button>

                  <button onclick="event.stopPropagation(); stergeComandaTransport('${c.id}')" title="Șterge comandă"
                      class="w-7 h-7 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-600 hover:text-white text-red-400 transition-all border border-red-100 hover:border-red-600" data-permission="delete">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
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
    const q = (ZFlowStore.soferiQuery || '').toLowerCase().trim();
    const all = (ZFlowStore.dateSoferi || []).filter(s =>
        !q || (s.nume||'').toLowerCase().includes(q) || (s.telefon||'').includes(q)
    );
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
    const q = (ZFlowStore.vehiculeQuery || '').toLowerCase().trim();
    const all = (ZFlowStore.dateVehicule || []).filter(v =>
        !q || (v.nr_inmatriculare||'').toLowerCase().includes(q) ||
              (v.marca||'').toLowerCase().includes(q) ||
              (v.model||'').toLowerCase().includes(q)
    );
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
          <button onclick="trackeazaVehicul('${v.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-green-50 text-green-600 transition-all" title="Urmărire GPS pe hartă">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
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

    ['ct-ruta-de','ct-ruta-la','ct-data-plecare','ct-data-livrare','ct-tracking','ct-valoare','ct-km','ct-obs'].forEach(el => { const e = f(el); if (e) e.value = ''; });
    if (f('ct-status')) f('ct-status').value = 'Planificat';
    // Default dată azi pentru comenzi noi (suprascrisa la editare)
    const _aziCT = typeof getDataImplicita === 'function' ? getDataImplicita() : new Date().toISOString().split('T')[0];
    if (f('ct-data-plecare')) f('ct-data-plecare').value = _aziCT;
    if (f('ct-data-livrare')) f('ct-data-livrare').value = _aziCT;

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
            if (f('ct-km'))            f('ct-km').value            = c.numar_km || '';
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
    if (!rutaDe || !rutaLa) { showNotification('Completează ruta (plecare și destinație)', 'error'); return; }

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
            tracking_code: fv('ct-tracking') || (
                `ZF-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`
            ),
            numar_km:      Number(fv('ct-km')) || 0,
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
        showNotification('Comandă salvată!', 'success');
    } catch (err) {
        showNotification('Eroare: ' + err.message, 'error');
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
        showNotification('Comandă ștearsă', 'success');
    } catch (err) {
        showNotification('Eroare: ' + err.message, 'error');
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
    if (!name) { showNotification('Completează numele șoferului', 'error'); return; }
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
        showNotification('Șofer salvat!', 'success');
    } catch (err) { showNotification('Eroare: '+err.message,'error'); } finally { setLoader(false); }
}

async function stergeSofer(id) {
    if (!confirm('Ștergi șoferul?')) return;
    setLoader(true);
    try {
        await ZFlowDB.deleteSofer(id);
        ZFlowStore.dateSoferi = ZFlowStore.dateSoferi.filter(x=>String(x.id)!==String(id));
        calculeazaKPILogistic(); renderSoferi();
        showNotification('Șofer șters','success');
    } catch (err) { showNotification('Eroare: '+err.message,'error'); } finally { setLoader(false); }
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
    ['vehicul-nr','vehicul-marca','vehicul-model','vehicul-tip','vehicul-gps-lat','vehicul-gps-lng'].forEach(el => { const e = f(el); if (e) e.value = ''; });
    if (id) {
        const v = (ZFlowStore.dateVehicule||[]).find(x=>String(x.id)===String(id));
        if (v) {
            if (f('vehicul-nr'))      f('vehicul-nr').value      = v.nr_inmatriculare || '';
            if (f('vehicul-marca'))   f('vehicul-marca').value   = v.marca || '';
            if (f('vehicul-model'))   f('vehicul-model').value   = v.model || '';
            if (f('vehicul-tip'))     f('vehicul-tip').value     = v.tip || 'Camion';
            if (f('vehicul-gps-lat')) f('vehicul-gps-lat').value = v.gps_lat != null ? v.gps_lat : '';
            if (f('vehicul-gps-lng')) f('vehicul-gps-lng').value = v.gps_lng != null ? v.gps_lng : '';
        }
    }
    modal.classList.add('active');
}

function inchideModalVehicul() { const m = document.getElementById('modal-vehicul'); if (m) m.classList.remove('active'); }

async function salveazaVehicul() {
    const fv = el => document.getElementById(el)?.value?.trim() || '';
    const id = document.getElementById('vehicul-id-hidden')?.value;
    const nr = fv('vehicul-nr');
    if (!nr) { showNotification('Completează nr. de înmatriculare', 'error'); return; }
    setLoader(true);
    try {
        const latVal = document.getElementById('vehicul-gps-lat')?.value;
        const lngVal = document.getElementById('vehicul-gps-lng')?.value;
        const payload = {
            nr_inmatriculare: nr,
            marca: fv('vehicul-marca')||null,
            model: fv('vehicul-model')||null,
            tip: fv('vehicul-tip')||'Camion',
            gps_lat: latVal !== '' ? parseFloat(latVal) : null,
            gps_lng: lngVal !== '' ? parseFloat(lngVal) : null
        };
        // When editing, don't remove existing GPS coords unless user explicitly cleared them
        if (id) {
            const existing = (ZFlowStore.dateVehicule||[]).find(x=>String(x.id)===String(id));
            if (existing) {
                if (latVal === '' && existing.gps_lat != null) payload.gps_lat = existing.gps_lat;
                if (lngVal === '' && existing.gps_lng != null) payload.gps_lng = existing.gps_lng;
            }
        }
        if (id) {
            await ZFlowDB.updateVehicul(id, payload);
            const arr = ZFlowStore.dateVehicule; const i = arr.findIndex(x=>String(x.id)===String(id)); if(i!==-1) arr[i]={...arr[i],...payload};
        } else {
            await ZFlowDB.insertVehicul(payload);
            ZFlowStore.dateVehicule = await ZFlowDB.fetchVehicule();
        }
        inchideModalVehicul(); calculeazaKPILogistic(); renderVehicule();
        showNotification('Vehicul salvat!', 'success');
    } catch (err) { showNotification('Eroare: '+err.message,'error'); } finally { setLoader(false); }
}

async function stergeVehicul(id) {
    if (!confirm('Ștergi vehiculul?')) return;
    setLoader(true);
    try {
        await ZFlowDB.deleteVehicul(id);
        ZFlowStore.dateVehicule = ZFlowStore.dateVehicule.filter(x=>String(x.id)!==String(id));
        calculeazaKPILogistic(); renderVehicule();
        showNotification('Vehicul șters','success');
    } catch (err) { showNotification('Eroare: '+err.message,'error'); } finally { setLoader(false); }
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
function filtreazaSoferi(q) {
    ZFlowStore.soferiQuery = q || '';
    ZFlowStore.soferiCurrentPage = 1;
    renderSoferi();
}
function filtreazaVehicule(q) {
    ZFlowStore.vehiculeQuery = q || '';
    ZFlowStore.vehiculeCurrentPage = 1;
    renderVehicule();
}
window.calculeazaKPILogistic          = calculeazaKPILogistic;
window.renderLogistic                 = renderLogistic;
window.schimbaViewLogistic            = schimbaViewLogistic;

/**
 * Afișează ruta unei comenzi de transport pe hartă GPS.
 * Comută automat la tab-ul Vehicule și centrează harta.
 */
function afiseazaRutaComandaPeHarta(id) {
    const c = (window.ZFlowStore?.dateComenziTransport || []).find(x => String(x.id) === String(id));
    if (!c) return;
    // Comută la tab-ul Vehicule care conține harta
    schimbaViewLogistic('vehicule', true);
    setTimeout(() => {
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Re-render markere și adaugă popup pentru rută
        if (typeof actualizaMarkerePeHarta === 'function') actualizaMarkerePeHarta();
        setTimeout(() => {
            if (!window.ZFlowStore?.map) return;
            // Marker special pentru această rută
            const statusCul = { 'Planificat': '#3b82f6', 'In curs': '#f59e0b', 'Livrat': '#10b981', 'Anulat': '#ef4444' };
            const col = statusCul[c.status] || '#64748b';
            const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
            const rutaDe = esc(c.ruta_de || '');
            const rutaLa = esc(c.ruta_la || '');
            const statusEsc = esc(c.status || '');
            const icon = window.L?.divIcon({
                html: `<div style="background:${col};color:#fff;padding:4px 10px;border-radius:10px;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white">${rutaDe} → ${rutaLa}</div>`,
                className: ''
            });
            // Poziție centrală România cu mic offset aleatoriu
            const lat = 45.9432 + (Math.random() - 0.5) * 0.5;
            const lng = 24.9668 + (Math.random() - 0.5) * 0.5;
            const m = window.L?.marker([lat, lng], { icon })
                .addTo(ZFlowStore.map)
                .bindPopup(`<b>${rutaDe} → ${rutaLa}</b><br>Status: ${statusEsc}${c.numar_km ? '<br>Km: ' + Number(c.numar_km) : ''}${c.tracking_code ? '<br>Tracking: ' + esc(c.tracking_code) : ''}`)
                .openPopup();
            if (m && ZFlowStore._gpsMarcatori) ZFlowStore._gpsMarcatori.push(m);
            ZFlowStore.map.setView([lat, lng], 10);
        }, 500);
    }, 350);
}
window.afiseazaRutaComandaPeHarta = afiseazaRutaComandaPeHarta;
window.renderComenziTransport         = renderComenziTransport;
window.renderSoferi                   = renderSoferi;
window.renderVehicule                 = renderVehicule;
window.filtreazaSoferi                = filtreazaSoferi;
window.filtreazaVehicule              = filtreazaVehicule;
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
window.importaComenziTransport        = importaComenziCSV;  // alias pentru butonul din HTML — folosește funcția completă
window.syncSafefleetVehicule          = syncSafefleetVehicule;

/**
 * Deschide harta GPS și centrează pe vehiculul selectat.
 * Comută automat pe view Comenzi (unde se află harta),
 * reinițializează markere și deschide popup-ul vehiculului.
 * @param {string} vehiculId
 */
function trackeazaVehicul(vehiculId) {
    // Comutăm pe view Vehicule (în care este afișată harta)
    schimbaViewLogistic('vehicule', true);
    // Inițializăm / actualizăm harta
    if (typeof window.initMap === 'function') window.initMap();
    // Scrolām la hartă
    setTimeout(() => {
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Centrăm pe vehicul după ce markerele sunt plasate
        setTimeout(() => {
            const marcatori = ZFlowStore._gpsMarcatori || [];
            const vehicule  = ZFlowStore.dateVehicule   || [];
            const idx = vehicule.findIndex(v => String(v.id) === String(vehiculId));
            if (idx >= 0 && marcatori[idx]) {
                marcatori[idx].openPopup();
                ZFlowStore.map?.panTo(marcatori[idx].getLatLng());
            }
        }, 400);
    }, 350);
}
window.trackeazaVehicul = trackeazaVehicul;

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
// Notă: Funcția activă este importaComenziCSV (definită mai jos).
// Aceasta are suport complet pentru numar_km, vehicul_id și date flexibile.
// ==========================================
// IMPORT CSV ȘOFERI (Task 4)
// ==========================================
async function importaSoferiCSV() {
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
            const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
            const get = (row, col) => { const i = headers.indexOf(col); return i >= 0 ? (row[i]||'').trim().replace(/^"|"$/g, '') : ''; };
            const existente = ZFlowStore.dateSoferi || [];
            let importate = 0, sarite = 0, erori = 0;
            for (const line of lines.slice(1)) {
                const row = line.split(delim);
                const nume = get(row, 'nume');
                if (!nume) { sarite++; continue; }
                if (existente.some(s => s.nume === nume && s.telefon === get(row, 'telefon'))) { sarite++; continue; }
                try {
                    await ZFlowDB.insertSofer({
                        nume,
                        telefon:    get(row, 'telefon') || null,
                        nr_permis:  get(row, 'nr_permis') || null,
                        cnp:        get(row, 'cnp') || null,
                        email:      get(row, 'email') || null,
                        observatii: get(row, 'observatii') || null,
                    });
                    importate++;
                } catch(err) { console.warn('[ImportSoferi]', err.message); erori++; }
            }
            ZFlowStore.dateSoferi = await ZFlowDB.fetchSoferi().catch(() => ZFlowStore.dateSoferi);
            renderSoferi();
            alert(`Import śoferi: ${importate} importați, ${sarite} săriți, ${erori} erori.`);
            resolve();
        };
        input.click();
    });
}
window.importaSoferiCSV = importaSoferiCSV;

// ==========================================
// IMPORT CSV VEHICULE (Task 4)
// ==========================================
async function importaVehiculeCSV() {
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
            const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
            const get = (row, col) => { const i = headers.indexOf(col); return i >= 0 ? (row[i]||'').trim().replace(/^"|"$/g, '') : ''; };
            const existente = ZFlowStore.dateVehicule || [];
            let importate = 0, sarite = 0, erori = 0;
            for (const line of lines.slice(1)) {
                const row = line.split(delim);
                const nr = get(row, 'nr_inmatriculare');
                if (!nr) { sarite++; continue; }
                if (existente.some(v => v.nr_inmatriculare === nr)) { sarite++; continue; }
                try {
                    await ZFlowDB.insertVehicul({
                        nr_inmatriculare: nr,
                        marca:            get(row, 'marca') || null,
                        model:            get(row, 'model') || null,
                        tip:              get(row, 'tip') || 'Camion',
                        an_fabricatie:    Number(get(row, 'an_fabricatie')) || null,
                        observatii:       get(row, 'observatii') || null,
                    });
                    importate++;
                } catch(err) { console.warn('[ImportVehicule]', err.message); erori++; }
            }
            ZFlowStore.dateVehicule = await ZFlowDB.fetchVehicule().catch(() => ZFlowStore.dateVehicule);
            renderVehicule();
            alert(`Import vehicule: ${importate} importate, ${sarite} sărite, ${erori} erori.`);
            resolve();
        };
        input.click();
    });
}
window.importaVehiculeCSV = importaVehiculeCSV;

// ==========================================
// IMPORT CSV COMENZI TRANSPORT
// ==========================================
async function importaComenziCSV() {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.csv,text/csv';
        input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return resolve();
            const rawText = await file.text();
            const text = rawText.replace(/^\uFEFF/, '');
            const lines = text.split('\n').map(l => l.trim().replace(/\r$/, '')).filter(Boolean);
            if (lines.length < 2) { alert('CSV gol sau f\u0103r\u0103 date'); return resolve(); }
            const delim = lines[0].includes(';') ? ';' : ',';
            const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));
            const get = (row, ...cols) => {
                for (const col of cols) {
                    const i = headers.indexOf(col.toLowerCase());
                    if (i >= 0 && row[i]) return row[i].trim().replace(/^"|"$/g, '');
                }
                return '';
            };
            await ZFlowDB.fetchComenziTransport().then(c => { ZFlowStore.dateComenziTransport = c; }).catch(() => {});
            const existente = ZFlowStore.dateComenziTransport || [];
            let importate = 0, sarite = 0, erori = 0;
            for (const line of lines.slice(1)) {
                const row = line.split(delim);
                const tracking = get(row, 'tracking_code', 'cod_tracking', 'numar_comanda', 'nr_comanda');
                // Skip dacă tracking code identic deja exist\u0103
                if (tracking && existente.some(c => c.tracking_code === tracking)) { sarite++; continue; }
                const parsaData = str => {
                    if (!str) return null;
                    const m = str.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
                    if (m) { let y = parseInt(m[3]); if (y < 100) y += 2000; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
                    if (str.match(/\d{4}-\d{2}-\d{2}/)) return str.split('T')[0];
                    return null;
                };
                const payload = {
                    tracking_code:  tracking || null,
                    ruta_de:        get(row, 'ruta_de', 'plecare', 'origine', 'de_la') || '',
                    ruta_la:        get(row, 'ruta_la', 'destinatie', 'dest', 'la') || '',
                    data_plecare:   parsaData(get(row, 'data_plecare', 'data_start', 'data')) || null,
                    data_livrare:   parsaData(get(row, 'data_livrare', 'data_sosire', 'data_end')) || null,
                    status:         get(row, 'status') || 'Planificat',
                    numar_km:       parseFloat((get(row, 'numar_km', 'km', 'distanta_km', 'km_parcursi') || '0').replace(',', '.')) || 0,
                    valoare:        parseFloat((get(row, 'valoare', 'pret', 'tarif') || '0').replace(',', '.')) || null,
                    observatii:     get(row, 'observatii', 'obs', 'note', 'descriere') || null,
                };
                try {
                    await ZFlowDB.insertComandaTransport(payload);
                    importate++;
                } catch(err) { console.warn('[ImportComenzi]', err.message); erori++; }
            }
            ZFlowStore.dateComenziTransport = await ZFlowDB.fetchComenziTransport().catch(() => ZFlowStore.dateComenziTransport || []);
            renderComenziTransport();
            calculeazaKPILogistic();
            const msg = `Import comenzi: ${importate} importate, ${sarite} s\u0103rite, ${erori ? erori + ' erori' : 'f\u0103r\u0103 erori'}.`;
            (typeof showNotification === 'function' ? showNotification : alert)(msg, importate > 0 ? 'success' : 'warning');
            resolve();
        };
        input.click();
    });
}
window.importaComenziCSV = importaComenziCSV;