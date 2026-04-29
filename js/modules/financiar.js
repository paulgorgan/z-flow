// ==========================================
// RENDER CLIENȚI
// ==========================================

// [PERF-FIX] FIX 4 — throttle render via requestAnimationFrame
// Evită render-uri redundante cauzate de event-uri rapide (Realtime, CRUD)
const _renderThrottle = { main: false, furnizori: false, facturi: false };

// ── Helpers sortare după scadența cea mai apropiată de azi ────────────────────
/** Parsare sigură dată în financiar.js (ISO YYYY-MM-DD și DD/MM/YY) */
function _parseDateFin(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s + (s.length === 10 ? 'T12:00:00' : ''));
        return isNaN(d) ? null : d;
    }
    if (s.includes('/')) {
        const p = s.split('/');
        if (p.length === 3) {
            let y = parseInt(p[2], 10); if (y < 100) y += 2000;
            const d = new Date(y, parseInt(p[1], 10) - 1, parseInt(p[0], 10), 12);
            return isNaN(d) ? null : d;
        }
    }
    return null;
}
/** Distanța în zile față de azi (absolut) */
function _dueDistanceFin(s, azi) {
    const d = _parseDateFin(s);
    if (!d) return 9999;
    d.setHours(0, 0, 0, 0);
    return Math.abs(d - azi) / 86400000;
}
/** Scadența deschisă cu distanța minimă față de azi pentru o entitate */
function _closestOpenDueForEntity(facturi, paidStatus, azi) {
    let minDist = Infinity;
    for (const f of (facturi || [])) {
        if (f.status_plata === paidStatus) continue;
        const dist = _dueDistanceFin(f.data_scadenta, azi);
        if (dist < minDist) minDist = dist;
    }
    return minDist;
}
/** Comparator: facturi neachitate cu scadența cea mai apropiată de azi prime; achitate ultimele */
function _sortFacturiDueClosestFin(a, b, azi, paidStatus) {
    const aPlata = a.status_plata === paidStatus;
    const bPlata = b.status_plata === paidStatus;
    if (aPlata && !bPlata) return 1;
    if (!aPlata && bPlata) return -1;
    return _dueDistanceFin(a.data_scadenta, azi) - _dueDistanceFin(b.data_scadenta, azi);
}


/**
 * [BUG2-FIX] Returnează true dacă CUI-ul apare atât în clienți cât și în furnizori.
 * Folosit pentru badge-ul "Client + Furnizor" din lista principală.
 * @param {string} cui
 * @returns {boolean}
 */
let _cuiSetCache = null;
function _invalidateCuiCache() { _cuiSetCache = null; }
function esteSiClientSiFurnizor(cui) {
    if (!cui) return false;
    if (!_cuiSetCache) {
        _cuiSetCache = {
            clienti:  new Set((window.ZFlowStore?.dateLocal   || []).map(c => String(c.cui  || '').trim().toUpperCase().replace(/^RO/i, ''))),
            furnizori: new Set((window.ZFlowStore?.dateFurnizori || []).map(f => String(f.cui || '').trim().toUpperCase().replace(/^RO/i, '')))
        };
    }
    const cuiNorm = String(cui).trim().toUpperCase().replace(/^RO/i, '');
    return _cuiSetCache.clienti.has(cuiNorm) && _cuiSetCache.furnizori.has(cuiNorm);
}
window.esteSiClientSiFurnizor = esteSiClientSiFurnizor;
window._invalidateCuiCache = _invalidateCuiCache;

function renderMainThrottled() {
    if (_renderThrottle.main) return; // render deja programat pentru acest frame
    _renderThrottle.main = true;
    requestAnimationFrame(() => { renderMain(); _renderThrottle.main = false; });
}

function renderFurnizoriThrottled() {
    if (_renderThrottle.furnizori) return; // render deja programat pentru acest frame
    _renderThrottle.furnizori = true;
    requestAnimationFrame(() => { renderFurnizori(); _renderThrottle.furnizori = false; });
}

// [QUALITY-FIX] FIX 6 — recompilează dateFurnizori din store curent fără fetch din DB
// Folosit după operații optimiste CRUD pe furnizori și facturi_platit
function _recomputeFurnizoriData() {
    const azi = new Date(); azi.setHours(0, 0, 0, 0);
    const limite5Zile = new Date(azi); limite5Zile.setDate(limite5Zile.getDate() + 5);
    ZFlowStore.dateFurnizori = (ZFlowStore.dateFurnizori || []).map(furn => { // [RISK-FIX 2]
        const fps = (ZFlowStore.dateFacturiPlatit || []).filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
        const sold = fps.filter(fp2 => fp2.status_plata !== "Platit").reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
        const sumaScadenta = fps.reduce((acc, fac) => {
            if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                if (d < azi) return acc + (Number(fac.valoare) || 0);
            }
            return acc;
        }, 0);
        const sumaIminent5Zile = fps.reduce((acc, fac) => {
            if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                if (d >= azi && d <= limite5Zile) return acc + (Number(fac.valoare) || 0);
            }
            return acc;
        }, 0);
        return { ...furn, facturi: fps, sold, sumaScadenta, sumaIminent5Zile };
    });
}

function _highlightTerm(text, term) {
    if (!term || !text) return typeof escapeHtml === 'function' ? escapeHtml(String(text || '')) : String(text || '');
    const safe = typeof escapeHtml === 'function' ? escapeHtml(String(text)) : String(text);
    const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(
        new RegExp('(' + safeTerm + ')', 'gi'),
        '<mark style="background:#fef08a;color:#713f12;border-radius:2px;padding:0 1px">$1</mark>'
    );
}

/**
 * Renderizează lista principală de clienți
 */
function renderMain(lista = null) {
    // [PERF-FIX] FIX 5 — referință DOM cached; fallback la getElementById dacă cache nu e populat
    const container = window._DOM?.listaFirme || document.getElementById("lista-firme-global");
    let sursa = [...(lista || ZFlowStore.dateLocal)];
    if (!container) return;

    if (sursa.length === 0) {
        showEmptyState(container, "Niciun client", "Adaugă clienți pentru a-ți gestiona facturile și încasările", "clients");
        _renderClientiPagination(0);
        return;
    }

    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Sortare: [UX5] respectă ZFlowStore.sortareClienti
    const _sortMode = ZFlowStore.sortareClienti || 'scadenta';
    if (_sortMode === 'alfa') {
        sursa.sort((a, b) => (a.nume_firma || a.cui || '').localeCompare(b.nume_firma || b.cui || '', 'ro'));
    } else if (_sortMode === 'sold') {
        sursa.sort((a, b) => (b.sold || 0) - (a.sold || 0));
    } else {
        // Default: scadenta — entitățile cu scadența cea mai apropiată de azi primele
    sursa.sort((a, b) => {
        const distA = _closestOpenDueForEntity(a.facturi, 'Incasat', azi);
        const distB = _closestOpenDueForEntity(b.facturi, 'Incasat', azi);
        // Ambii fără scadențe deschise → sortare după sold desc
        if (distA === Infinity && distB === Infinity) return (b.sold || 0) - (a.sold || 0);
        if (distA !== distB) return distA - distB;
        // Secundar: sold restant descrescător
        const aScad = (a.facturi || []).reduce((acc, f) => {
            if (f.status_plata !== 'Incasat' && f.data_scadenta) {
                const d = new Date(f.data_scadenta); d.setHours(0,0,0,0);
                if (d < azi) acc += Number(f.valoare) || 0;
            }
            return acc;
        }, 0);
        const bScad = (b.facturi || []).reduce((acc, f) => {
            if (f.status_plata !== 'Incasat' && f.data_scadenta) {
                const d = new Date(f.data_scadenta); d.setHours(0,0,0,0);
                if (d < azi) acc += Number(f.valoare) || 0;
            }
            return acc;
        }, 0);
        if (bScad !== aScad) return bScad - aScad;
        return (b.sold || 0) - (a.sold || 0);
    });
    }

    // Filtrare după categorie
    const filtruCat = (ZFlowStore.filtruCategorieClienti || '').trim().toLowerCase();
    if (filtruCat) {
        sursa = sursa.filter(c => (c.categorie || '').toLowerCase().includes(filtruCat));
    }

    // Paginare clienți
    ZFlowStore._clientiFiltrati = sursa;
    const pagC = pagineaza(sursa, ZFlowStore.clientiPageSize, ZFlowStore.clientiCurrentPage);
    ZFlowStore.clientiCurrentPage = pagC.currentPage;
    const paginatC = pagC.items;

    container.innerHTML = paginatC
        .map((f) => {
            const _esc = typeof escapeHTML === 'function' ? escapeHTML : (s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
            const sumaScadenta = (f.facturi || []).reduce((acc, fac) => {
                if (fac.status_plata !== "Incasat" && fac.data_scadenta) {
                    const dScad = new Date(fac.data_scadenta);
                    dScad.setHours(0, 0, 0, 0);
                    if (dScad < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);

            const areRestante = sumaScadenta > 0;
            const limite5Zile = new Date(azi); limite5Zile.setDate(limite5Zile.getDate() + 5);
            const sumaIminent5Zile = (f.facturi || []).reduce((acc, fac) => {
                if (fac.status_plata !== "Incasat" && fac.data_scadenta) {
                    const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                    if (d >= azi && d <= limite5Zile) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            const areIminent = sumaIminent5Zile > 0;

            return `
<div onclick="arataDetalii('${f.id}')" class="card-flow group flex flex-col p-5 mb-3 transition-all cursor-pointer relative overflow-hidden bg-white border border-slate-100 hover:border-blue-200 hover:shadow-lg active:scale-[0.98]">
    ${areRestante ? `<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.3)]"></div>` : areIminent ? `<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400 shadow-[2px_0_10px_rgba(251,191,36,0.3)]"></div>` : ""}
    <div class="flex-1 flex flex-col">
    <div class="flex justify-between items-start w-full">
        <div class="max-w-[60%]">
            <h4 class="text-[15px] font-black text-slate-800 leading-tight truncate">${_highlightTerm(f.nume_firma || f.cui, document.getElementById('search-firme')?.value?.trim())}</h4>
            <div class="flex flex-wrap gap-1 mt-0.5">
            ${esteSiClientSiFurnizor(f.cui) ? '<span class="inline-block text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">Client + Furnizor</span>' : ''}
            ${f.eticheta ? `<span class="inline-block text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">${_esc(f.eticheta)}</span>` : ''}
            ${f.categorie ? `<span class="inline-block text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">${_esc(f.categorie)}</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="w-2 h-2 rounded-full ${areRestante ? "bg-red-400" : areIminent ? "bg-amber-400" : "bg-emerald-400"}" title="${areRestante ? 'Scadențe depășite' : areIminent ? 'Scadențe în 5 zile' : 'Toate încasate'}"></span>
                <p class="text-[10px] font-semibold text-slate-400">${_esc(f.oras || "—")}</p>
            </div>
        </div>
        <div class="text-right flex flex-col items-end">
            <p class="text-blue-900 font-black text-[22px] leading-none tracking-tighter">${Math.round(f.sold).toLocaleString()} <span class="text-[11px] font-bold">lei</span></p>
            <p class="text-[9px] font-semibold text-slate-400 mt-1">De încasat</p>
        </div>
    </div>
    ${areRestante ? `
    <div class="mt-3 py-2.5 px-3 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <p class="text-[9px] font-bold text-red-500 uppercase">Scadență depășită</p>
        </div>
        <p class="text-red-600 font-black text-[13px] leading-none">${Math.round(sumaScadenta).toLocaleString()} lei</p>
    </div>` : areIminent ? `
    <div class="mt-3 py-2.5 px-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <p class="text-[9px] font-bold text-amber-600 uppercase alerta-scadenta-pulse">Scadent în 5 zile</p>
        </div>
        <p class="text-amber-600 font-black text-[13px] leading-none">${Math.round(sumaIminent5Zile).toLocaleString()} lei</p>
    </div>` : ""}
    </div>
    <div class="flex gap-2 pt-4 mt-3">
        <button onclick="event.stopPropagation(); arataDetalii('${f.id}')"
                class="flex-1 h-10 min-w-0 whitespace-nowrap rounded-xl text-[10px] font-bold uppercase bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 transition-all flex items-center justify-center gap-1.5 border border-blue-100 hover:border-blue-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            Facturi
        </button>
        <button onclick="event.stopPropagation(); deschideModal('modal-client', '${f.id}')"
                class="flex-1 h-10 min-w-0 whitespace-nowrap rounded-xl text-[10px] font-bold uppercase bg-slate-50 hover:bg-slate-700 hover:text-white text-slate-600 transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-700">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Profil
        </button>
        <button onclick="event.stopPropagation(); stergeFirma('${f.id}')" title="Șterge client"
                class="h-10 w-10 flex-shrink-0 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white text-red-400 transition-all flex items-center justify-center border border-red-100 hover:border-red-600" data-permission="delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
    </div>
</div>`;
        })
        .join("");

    _renderClientiPagination(sursa.length);

    // Notificare scadențe restante afișată deasupra listei
    const alertaFin = document.getElementById("fin-alerte-clienti");
    if (alertaFin) {
        const clientiRestanti = sursa.filter(f =>
            (f.facturi || []).some(fac =>
                fac.status_plata !== "Incasat" &&
                fac.data_scadenta &&
                new Date(fac.data_scadenta).setHours(0, 0, 0, 0) < azi
            )
        );
        if (clientiRestanti.length > 0) {
            const totalRestant = clientiRestanti.reduce((sum, f) =>
                sum + (f.facturi || []).reduce((acc, fac) => {
                    if (fac.status_plata !== "Incasat" && fac.data_scadenta) {
                        const d = new Date(fac.data_scadenta); d.setHours(0, 0, 0, 0);
                        if (d < azi) acc += Number(fac.valoare) || 0;
                    }
                    return acc;
                }, 0)
            , 0);
            alertaFin.classList.remove("hidden");
            alertaFin.innerHTML = `
<div class="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-1 alerta-scadenta-pulse">
    <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        <p class="text-[11px] font-bold text-red-700">${clientiRestanti.length} client${clientiRestanti.length > 1 ? "i cu" : " cu"} scadențe depășite</p>
    </div>
    <p class="text-[13px] font-black text-red-600 leading-none">${Math.round(totalRestant).toLocaleString()} lei</p>
</div>`;
        } else {
            alertaFin.classList.add("hidden");
            alertaFin.innerHTML = "";
        }
    }

    // Update Total Portofoliu
    const totalPort = ZFlowStore.dateLocal.reduce((acc, f) => acc + (Number(f.sold) || 0), 0);
    const totalEl = document.getElementById("total-general");
    if (totalEl) totalEl.innerText = `${Math.round(totalPort).toLocaleString()} lei`;
    if (typeof initInfiniteScrollClienti === 'function') requestAnimationFrame(initInfiniteScrollClienti);
}

// Debounce pentru căutarea clienți
const filtreazaListaFirmeDebounced = debounce(function () {
    const q = document.getElementById("search-firme").value.toLowerCase().trim();
    const filtrate = ZFlowStore.dateLocal.filter(
        (f) =>
            (f.nume_firma || "").toLowerCase().includes(q) ||
            String(f.cui || "").includes(q) ||
            (f.categorie || "").toLowerCase().includes(q)
    );
    
    // Dacă există căutare activă și nu s-a găsit nimic, afișăm empty state de tip search
    if (q && filtrate.length === 0) {
        const container = document.getElementById("lista-firme-global");
        if (container) {
            showEmptyState(container, "Niciun rezultat", `Nu am găsit clienți pentru „${(typeof escapeHTML==='function'?escapeHTML:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'))(q)}”. Verifică termenul de căutare.`, "search");
        }
        return;
    }
    
    ZFlowStore.clientiCurrentPage = 1;
    renderMain(filtrate);
}, 300);

// ==========================================
// RENDER FURNIZORI
// ==========================================


function renderFurnizori(lista) {
    // [PERF-FIX] FIX 5 — referință DOM cached; fallback la getElementById dacă cache nu e populat
    const container = window._DOM?.listaFurnizori || document.getElementById("lista-furnizori-global");
    let sursa = [...(lista || ZFlowStore.dateFurnizori)];
    if (!container) return;

    if (sursa.length === 0) {
        showEmptyState(container, "Niciun furnizor", "Adaugă furnizori pentru a gestiona facturile de plătit", "clients");
        _renderFurnizoriPagination(0);
        return;
    }

    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Îmbogățim fiecare furnizor cu facturile lui dacă lipsesc
    sursa.forEach(f => {
        if (!f.facturi || f.facturi.length === 0) {
            f.facturi = (ZFlowStore.dateFacturiPlatit || []).filter(fp =>
                String(fp.furnizor_id) === String(f.id)
            );
        }
        if (f.sumaScadenta === undefined) {
            f.sumaScadenta = (f.facturi || []).reduce((acc, fp) => {
                if (fp.status_plata !== 'Platit' && fp.data_scadenta) {
                    const d = new Date(fp.data_scadenta); d.setHours(0,0,0,0);
                    if (d < azi) return acc + (Number(fp.valoare) || 0);
                }
                return acc;
            }, 0);
        }
    });

    // Sortare: entitățile cu scadența cea mai apropiată de azi primele
    sursa.sort((a, b) => {
        const distA = _closestOpenDueForEntity(a.facturi, 'Platit', azi);
        const distB = _closestOpenDueForEntity(b.facturi, 'Platit', azi);
        // Ambii fără scadențe deschise → sortare după sold desc
        if (distA === Infinity && distB === Infinity) return (b.sold || 0) - (a.sold || 0);
        if (distA !== distB) return distA - distB;
        // Secundar: sumaScadenta descrescătoare
        if ((b.sumaScadenta || 0) !== (a.sumaScadenta || 0)) return (b.sumaScadenta || 0) - (a.sumaScadenta || 0);
        return (b.sold || 0) - (a.sold || 0);
    });

    // Filtrare după categorie
    const filtruCatF = (ZFlowStore.filtruCategorieFurnizori || '').trim().toLowerCase();
    if (filtruCatF) {
        sursa = sursa.filter(f => (f.categorie || '').toLowerCase().includes(filtruCatF));
    }

    // Paginare furnizori
    ZFlowStore._furnizoriFiltrati = sursa;
    const pagF = pagineaza(sursa, ZFlowStore.furnizoriPageSize, ZFlowStore.furnizoriCurrentPage);
    ZFlowStore.furnizoriCurrentPage = pagF.currentPage;
    const paginatF = pagF.items;

    container.innerHTML = paginatF.map((f) => {
        const _esc = typeof escapeHTML === 'function' ? escapeHTML : (s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
        const areRestante = f.sumaScadenta > 0;
        const areIminent = (f.sumaIminent5Zile || 0) > 0;
        return `
<div onclick="arataDetaliiFurnizor('${f.id}')" class="card-flow group flex flex-col p-5 mb-3 transition-all cursor-pointer relative overflow-hidden bg-white border border-slate-100 hover:border-red-200 hover:shadow-lg active:scale-[0.98]">
    ${areRestante ? `<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.3)]"></div>` : areIminent ? `<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400 shadow-[2px_0_10px_rgba(251,191,36,0.3)]"></div>` : ""}
    <div class="flex-1 flex flex-col">
    <div class="flex justify-between items-start w-full">
        <div class="max-w-[60%]">
            <h4 class="text-[15px] font-black text-slate-800 leading-tight truncate">${_highlightTerm(f.nume_firma || f.cui, document.getElementById('search-furnizori')?.value?.trim())}</h4>
            <div class="flex flex-wrap gap-1 mt-0.5">
            ${esteSiClientSiFurnizor(f.cui) ? '<span class="inline-block text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">Client + Furnizor</span>' : ''}
            ${f.eticheta ? `<span class="inline-block text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">${_esc(f.eticheta)}</span>` : ''}
            ${f.categorie ? `<span class="inline-block text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">${_esc(f.categorie)}</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="w-2 h-2 rounded-full ${areRestante ? "bg-red-400" : areIminent ? "bg-amber-400" : "bg-emerald-400"}" title="${areRestante ? 'Scadențe depășite' : areIminent ? 'Scadențe în 5 zile' : 'Toate plătite'}"></span>
                <p class="text-[10px] font-semibold text-slate-400">${_esc(f.oras || "—")}</p>
            </div>
        </div>
        <div class="text-right flex flex-col items-end">
            <p class="text-red-700 font-black text-[22px] leading-none tracking-tighter">${Math.round(f.sold).toLocaleString()} <span class="text-[11px] font-bold">lei</span></p>
            <p class="text-[9px] font-semibold text-slate-400 mt-1">De plătit</p>
        </div>
    </div>
    ${areRestante ? `
    <div class="mt-3 py-2.5 px-3 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <p class="text-[9px] font-bold text-red-500 uppercase">Scadență depășită</p>
        </div>
        <p class="text-red-600 font-black text-[13px] leading-none">${Math.round(f.sumaScadenta).toLocaleString()} lei</p>
    </div>` : areIminent ? `
    <div class="mt-3 py-2.5 px-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <p class="text-[9px] font-bold text-amber-600 uppercase alerta-scadenta-pulse">Scadent în 5 zile</p>
        </div>
        <p class="text-amber-600 font-black text-[13px] leading-none">${Math.round(f.sumaIminent5Zile || 0).toLocaleString()} lei</p>
    </div>` : ""}
    </div>
    <div class="flex gap-2 pt-4 mt-3">
        <button onclick="event.stopPropagation(); arataDetaliiFurnizor('${f.id}')"
                class="flex-1 h-10 min-w-0 whitespace-nowrap rounded-xl text-[10px] font-bold uppercase bg-red-50 hover:bg-red-700 hover:text-white text-red-700 transition-all flex items-center justify-center gap-1.5 border border-red-100 hover:border-red-700">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            Facturi
        </button>
        <button onclick="event.stopPropagation(); deschideModalFurnizor('${f.id}')"
                class="flex-1 h-10 min-w-0 whitespace-nowrap rounded-xl text-[10px] font-bold uppercase bg-slate-50 hover:bg-slate-700 hover:text-white text-slate-600 transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-700">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Profil
        </button>
        <button onclick="event.stopPropagation(); stergeFurnizorDirect('${f.id}')" title="Șterge furnizor"
                class="h-10 w-10 flex-shrink-0 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white text-red-400 transition-all flex items-center justify-center border border-red-100 hover:border-red-600" data-permission="delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
    </div>
</div>`;
    }).join("");

    // total-general-platit este actualizat de updateFurnizoriKPI (include și contribuțiile neachitate)
    _renderFurnizoriPagination(sursa.length);
    if (typeof initInfiniteScrollFurnizori === 'function') requestAnimationFrame(initInfiniteScrollFurnizori);

    // Notificare scadențe restante afișată deasupra listei furnizori
    const alertaFinF = document.getElementById("fin-alerte-furnizori");
    if (alertaFinF) {
        const furnizoriRestanti = sursa.filter(f => f.sumaScadenta > 0);
        if (furnizoriRestanti.length > 0) {
            const totalRestant = furnizoriRestanti.reduce((sum, f) => sum + (f.sumaScadenta || 0), 0);
            alertaFinF.classList.remove("hidden");
            alertaFinF.innerHTML = `
<div class="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-1 alerta-scadenta-pulse">
    <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        <p class="text-[11px] font-bold text-red-700">${furnizoriRestanti.length} furnizor${furnizoriRestanti.length > 1 ? "i cu" : " cu"} scadențe depășite</p>
    </div>
    <p class="text-[13px] font-black text-red-600 leading-none">${Math.round(totalRestant).toLocaleString()} lei</p>
</div>`;
        } else {
            alertaFinF.classList.add("hidden");
            alertaFinF.innerHTML = "";
        }
    }

    // Sync KPI restante/plătit
    updateFurnizoriKPI();
}

/**
 * Debounce căutare furnizori
 */
const filtreazaListaFurnizoriDebounced = debounce(function () {
    const q = document.getElementById("search-furnizori")?.value.toLowerCase().trim() || "";
    const filtrate = ZFlowStore.dateFurnizori.filter(
        (f) =>
            (f.nume_firma || "").toLowerCase().includes(q) ||
            String(f.cui || "").includes(q) ||
            (f.categorie || "").toLowerCase().includes(q)
    );
    if (q && filtrate.length === 0) {
        const container = document.getElementById("lista-furnizori-global");
        if (container) showEmptyState(container, "Niciun rezultat", `Nu am găsit furnizori pentru „${(typeof escapeHTML==='function'?escapeHTML:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'))(q)}”.`, "search");
        return;
    }
    ZFlowStore.furnizoriCurrentPage = 1;
    renderFurnizori(filtrate);
}, 300);

function filtreazaListaFurnizori() {
    filtreazaListaFurnizoriDebounced();
}

/**
 * Arată detalii furnizor (view-detalii-furnizor)
 */
function arataDetaliiFurnizor(id) {
    const furnizor = ZFlowStore.dateFurnizori.find((f) => String(f.id) === String(id));
    if (!furnizor) return;

    ZFlowStore.selectedFurnizorId = id;

    const cardEl = document.getElementById("card-detaliu-furnizor");
    if (cardEl) {
        const _esc = typeof escapeHTML === 'function' ? escapeHTML : (s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
        const sumaScadenta = furnizor.sumaScadenta || 0;
        cardEl.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h2 class="text-2xl font-extrabold leading-tight">${_esc(furnizor.nume_firma || furnizor.cui)}</h2>
                    <div class="flex items-center gap-2 mt-1"><p class="text-red-200 text-sm">CUI: ${_esc(furnizor.cui || "—")}</p>${furnizor.cui ? `<button onclick="navigator.clipboard.writeText('${_esc(furnizor.cui)}').then(()=>showNotification('CUI copiat','success',1500))" class="text-red-300 hover:text-white transition-colors flex-shrink-0" title="Copiază CUI"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>` : ''}</div>
                </div>
                <span class="text-3xl font-black text-white/80">${Math.round(furnizor.sold || 0).toLocaleString()} lei</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
                ${furnizor.oras ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Oraș</p><p class="font-semibold">${_esc(furnizor.oras)}</p></div>` : ""}
                ${furnizor.telefon ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Telefon</p><a href="tel:${_esc(furnizor.telefon)}" class="font-semibold hover:text-white transition-colors">${_esc(furnizor.telefon)}</a></div>` : ""}
                ${furnizor.persoana_contact ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Contact</p><p class="font-semibold">${_esc(furnizor.persoana_contact)}</p></div>` : ""}
                ${furnizor.contact_email ? `<div><p class="text-red-300 text-[9px] uppercase font-bold">Email</p><a href="mailto:${_esc(furnizor.contact_email)}" class="font-semibold truncate hover:text-white transition-colors">${_esc(furnizor.contact_email)}</a></div>` : ""}
                ${furnizor.iban ? `<div class="col-span-2"><p class="text-red-300 text-[9px] uppercase font-bold">IBAN</p><div class="flex items-center gap-2"><p class="font-semibold font-mono text-xs flex-1">${_esc(furnizor.iban)}</p><button onclick="navigator.clipboard.writeText('${_esc(furnizor.iban)}').then(()=>showNotification('IBAN copiat','success',1500))" class="text-red-300 hover:text-white transition-colors flex-shrink-0" title="Copiaz\u0103 IBAN"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button></div></div>` : ""}
            </div>
            ${sumaScadenta > 0 ? `
            <div class="mt-4 py-3 px-4 bg-red-500/20 rounded-2xl border border-red-400/50 flex justify-between items-center alerta-scadenta-pulse">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                    <p class="text-[8px] font-black text-red-300 uppercase tracking-widest">Facturi Depășite</p>
                </div>
                <p class="text-red-200 font-black text-[14px] leading-none">${Math.round(sumaScadenta).toLocaleString()} lei</p>
            </div>` : ""}`;
    }

    // Secțiunea Istoric Plăți Furnizor
    const istoricPlatiContainer = document.getElementById("istoric-plati-furnizor");
    if (istoricPlatiContainer && furnizor.facturi && furnizor.facturi.length > 0) {
        const facturiPlatite = furnizor.facturi.filter(fac => fac.status_plata === "Platit");
        const facturiNeplatite = furnizor.facturi.filter(fac => fac.status_plata !== "Platit");
        const totalPlatit = facturiPlatite.reduce((sum, fac) => sum + Number(fac.valoare || 0), 0);
        const totalNeplatit = facturiNeplatite.reduce((sum, fac) => sum + Number(fac.valoare || 0), 0);
        const rataPlata = furnizor.facturi.length > 0 ? Math.round((facturiPlatite.length / furnizor.facturi.length) * 100) : 0;

        const ultimelePlati = facturiPlatite
            .filter(fac => fac.data_plata)
            .sort((a, b) => new Date(b.data_plata) - new Date(a.data_plata))
            .slice(0, 5);

        const _esc = typeof escapeHTML === 'function' ? escapeHTML : (s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
        const timelineHtml = ultimelePlati.length > 0 ? ultimelePlati.map(fac => `
            <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-slate-700 truncate">#${_esc(fac.numar_factura)}</p>
                    <p class="text-[9px] text-slate-400">${formateazaDataZFlow(fac.data_plata)}</p>
                </div>
                <p class="text-[12px] font-black text-emerald-600">${Number(fac.valoare || 0).toLocaleString()} lei</p>
            </div>
        `).join('') : `
            <div class="text-center py-4">
                <p class="text-[10px] text-slate-400 italic">Nu există plăți înregistrate cu dată</p>
            </div>
        `;

        istoricPlatiContainer.innerHTML = `
            <div class="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <div class="flex items-center gap-2 mb-4">
                    <svg class="w-4 h-4 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <h4 class="text-[11px] font-black text-slate-800 uppercase tracking-wider">Istoric Plăți</h4>
                </div>
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <div class="bg-emerald-50 rounded-xl p-3 text-center">
                        <p class="text-[18px] font-black text-emerald-600">${rataPlata}%</p>
                        <p class="text-[8px] font-bold text-emerald-700 uppercase">Rată plată</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-3 text-center">
                        <p class="text-[14px] font-black text-slate-700">${facturiPlatite.length}</p>
                        <p class="text-[8px] font-bold text-slate-500 uppercase">Achitate</p>
                    </div>
                    <div class="bg-amber-50 rounded-xl p-3 text-center">
                        <p class="text-[14px] font-black text-amber-600">${facturiNeplatite.length}</p>
                        <p class="text-[8px] font-bold text-amber-700 uppercase">În așteptare</p>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="flex justify-between text-[9px] font-bold mb-1">
                        <span class="text-emerald-600">${totalPlatit.toLocaleString()} lei plătit</span>
                        <span class="text-slate-400">${totalNeplatit.toLocaleString()} lei restant</span>
                    </div>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style="width: ${rataPlata}%"></div>
                    </div>
                </div>
                <div class="border-t border-slate-100 pt-3">
                    <p class="text-[9px] font-bold text-slate-400 uppercase mb-2">Ultimele Plăți</p>
                    ${timelineHtml}
                </div>
            </div>
        `;
        istoricPlatiContainer.classList.remove('hidden');
    } else if (istoricPlatiContainer) {
        istoricPlatiContainer.classList.add('hidden');
    }

    const listaEl = document.getElementById("lista-facturi-platit-detaliu");
    if (listaEl) {
        const toateFacturi = furnizor.facturi || [];
        const azi = new Date(); azi.setHours(0, 0, 0, 0);
        if (toateFacturi.length === 0) {
            showEmptyState(listaEl, "Nicio factură", "Adaugă prima factură de plătit pentru acest furnizor", "period");
        } else {
            const perPage = ZFlowStore.furnizoriFacturiPerPage || 20;
            // Sortare: scadența cea mai apropiată de azi prima; plătite ultimele
            const sorted = [...toateFacturi].sort((a, b) => _sortFacturiDueClosestFin(a, b, azi, 'Platit'));
            const facturi = perPage === 0 ? sorted : sorted.slice(0, perPage);
            listaEl.innerHTML = `
            <div class="sticky top-0 bg-[#f1f5f9]/95 backdrop-filter backdrop-blur-md z-30 pb-3 pt-2 mb-2">
                <div class="relative">
                    <input type="text" id="search-facturi-furnizor-detaliu"
                           oninput="filtreazaFacturiFurnizorInDetalii()"
                           placeholder="Caută nr. factură sau serie..."
                           class="w-full h-12 pl-12 bg-white rounded-2xl border border-slate-200 text-[13px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-red-100 transition-all" />
                    <div class="absolute left-4 top-3.5 text-slate-300">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2 px-1 mb-2">
                <span class="text-[9px] font-bold text-slate-400 uppercase">Afișare</span>
                <select onchange="furnizoriFacturiSetPerPage(this.value)"
                        class="text-[10px] font-black text-slate-700 bg-slate-100 border-none rounded-lg px-2 py-1.5 cursor-pointer outline-none hover:bg-slate-200 transition-all">
                    <option value="10" ${perPage===10?'selected':''}>10</option>
                    <option value="20" ${perPage===20||!ZFlowStore.furnizoriFacturiPerPage?'selected':''}>20</option>
                    <option value="50" ${perPage===50?'selected':''}>50</option>
                    <option value="0" ${perPage===0?'selected':''}>Toate</option>
                </select>
                <span class="text-[9px] font-semibold text-slate-400">din ${toateFacturi.length} facturi</span>
            </div>` + facturi.map((fac) => {
                const isPlatit = fac.status_plata === "Platit";
                const isDepasit = !isPlatit && fac.data_scadenta && new Date(fac.data_scadenta).setHours(0,0,0,0) < azi;
                const isIminent = !isPlatit && !isDepasit && fac.data_scadenta && (() => { const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0); return d >= azi && d <= new Date(+azi + 5*86400000); })();
                const isImported = fac.is_imported === true || fac.is_imported === 1;
                const spvClass = isImported ? 'bg-slate-50 border-slate-100' : (isPlatit ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200');
                const spvDotClass = isImported ? 'bg-slate-400' : (isPlatit ? 'bg-emerald-500' : 'bg-amber-500');
                const spvTextClass = isImported ? 'text-slate-500' : (isPlatit ? 'text-emerald-700' : 'text-amber-700');
                const spvLabel = isImported ? 'SPV IMPORTAT' : (isPlatit ? 'SPV VERIFICAT' : 'SPV AȘTEPTARE');
                const toggleBtn = isImported
                    ? `<button disabled title="Factură SAGA — status blocat"
                            class="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
                       </button>`
                    : `<button onclick="event.stopPropagation(); toggleStatusPlatit('${fac.id}', '${fac.status_plata}')"
                            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isPlatit ? "bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-600"}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                       </button>`;
                return `
<div class="card-flow flex flex-col gap-2 p-3 mb-2 ${isPlatit ? "bg-white" : "bg-red-50/40 border-red-100"}" data-nr="${_esc(fac.numar_factura || '')}" data-serie="${_esc(fac.serie || '')}">
    <div class="flex items-center gap-2 ${spvClass} border px-2 py-2 rounded-xl">
        <span class="flex h-2 w-2 relative">
            <span class="relative inline-flex rounded-full h-2 w-2 ${spvDotClass}"></span>
        </span>
        <span class="text-[9px] font-black uppercase tracking-tighter ${spvTextClass}">${spvLabel}</span>
    </div>
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
            <span class="w-2 h-2 rounded-full flex-shrink-0 ${isPlatit ? "bg-emerald-400" : isDepasit ? "bg-red-500" : "bg-amber-400"}"></span>
            <div>
                <p class="text-[11px] font-black text-slate-800 uppercase">${fac.serie ? escapeHtml(fac.serie) + ' ' : ''}#${fac.numar_factura || "—"}${isImported ? ' <span class="text-[8px] font-bold text-slate-300 normal-case">SAGA</span>' : ''}</p>
                <p class="text-[8px] font-bold text-slate-400 uppercase">Emis: ${formateazaDataZFlow(fac.data_emiterii)}</p>
                <p class="text-[8px] font-bold ${isDepasit ? 'text-red-400' : isIminent ? 'text-amber-400' : 'text-slate-400'} uppercase">Scad: ${fac.data_scadenta ? formateazaDataZFlow(fac.data_scadenta) : "—"}</p>
                ${isDepasit ? '<span class="inline-block mt-0.5 bg-red-100 text-red-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase alerta-scadenta-pulse">⚠ DEPĂȘIT</span>' : isIminent ? '<span class="inline-block mt-0.5 bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase alerta-scadenta-pulse">⚡ IMINENT</span>' : ''}
            </div>
        </div>
        <div class="flex items-center gap-3">
            <div class="text-right">
                <b class="text-xs ${isPlatit ? "text-blue-900" : isDepasit ? "text-red-600" : "text-amber-600"}">${Number(fac.valoare || 0).toLocaleString()} lei</b>
                <p class="text-[7px] font-black uppercase ${isPlatit ? 'text-emerald-600' : isDepasit ? 'text-red-500' : 'text-amber-500'}">${isPlatit ? 'ACHITAT' : isDepasit ? 'RESTANT' : 'NEACHITAT'}</p>
            </div>
            <div class="flex flex-col gap-1">
                ${toggleBtn}
                <button onclick="event.stopPropagation(); deschideModalFacturaPlatit('${id}', '${fac.id}')"
                        class="w-8 h-8 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-lg flex items-center justify-center transition-all">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                </button>
            </div>
        </div>
    </div>
</div>`;
            }).join("");
        }
    }

    comutaVedereFin("detalii-furnizor");
}

/**
 * Toggle status plătit/neplătit pentru o factură de plătit
 */
async function toggleStatusPlatit(id, statusCurent) {
    const fp = ZFlowStore.dateFacturiPlatit?.find(f => String(f.id) === String(id));
    if (fp && fp.is_imported) {
        showNotification('Facturi SAGA — statusul nu poate fi modificat', 'warning');
        return;
    }
    const nouStatus = statusCurent === "Platit" ? "Neplatit" : "Platit";
    try {
        const payload = {
            status_plata: nouStatus,
            data_plata: nouStatus === "Platit" ? new Date().toISOString().split("T")[0] : null
        };
        await ZFlowDB.updateFacturaPlatit(id, payload);
        // Actualizează local
        const fp = ZFlowStore.dateFacturiPlatit.find(f => String(f.id) === String(id));
        if (fp) { fp.status_plata = nouStatus; fp.data_plata = payload.data_plata; }
        // Recalculeaza dateFurnizori
        const azi = new Date(); azi.setHours(0, 0, 0, 0);
        const limite5Zile = new Date(azi); limite5Zile.setDate(limite5Zile.getDate() + 5);
        ZFlowStore.dateFurnizori = ZFlowStore.dateFurnizori.map(furn => {
            const fps = ZFlowStore.dateFacturiPlatit.filter(fp2 => String(fp2.furnizor_id) === String(furn.id));
            const sold = fps.filter(fp2 => fp2.status_plata !== "Platit").reduce((s, fp2) => s + (Number(fp2.valoare) || 0), 0);
            const sumaScadenta = fps.reduce((acc, fac) => {
                if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                    const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0);
                    if (d < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            const sumaIminent5Zile = fps.reduce((acc, fac) => {
                if (fac.status_plata !== "Platit" && fac.data_scadenta) {
                    const d = new Date(fac.data_scadenta); d.setHours(0,0,0,0);
                    if (d >= azi && d <= limite5Zile) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            return { ...furn, facturi: fps, sold, sumaScadenta, sumaIminent5Zile };
        });
        updateFurnizoriKPI();
        invalidateCashflowCache();
        incarcaDashboard(); // Actualizează chart Home
        if (ZFlowStore.selectedFurnizorId) arataDetaliiFurnizor(ZFlowStore.selectedFurnizorId);
        showNotification(nouStatus === "Platit" ? "Marcat ca Plătit" : "Marcat ca Neplătit", "success");
    } catch (err) {
        showNotification("Eroare: " + err.message, "error");
    }
}

/**
 * Actualizează KPI-urile din view-furnizori
 */
function updateFurnizoriKPI() {
    const facturi = ZFlowStore.dateFacturiPlatit || [];
    const furnizori = ZFlowStore.dateFurnizori || [];
    const azi = new Date(); azi.setHours(0, 0, 0, 0);
    const lunaCurenta = azi.getMonth();
    const anulCurent = azi.getFullYear();

    let totalPlatit = 0, totalRestante = 0, totalLuna = 0;
    facturi.forEach(f => {
        const val = Number(f.valoare) || 0;
        if (f.status_plata === "Platit") {
            totalPlatit += val;
        } else {
            // Neplătit = TOATE facturile neachitate (sincronizat cu cardul "PLĂȚI DE EFECTUAT")
            totalRestante += val;
        }
        if (f.data_emiterii) {
            const d = new Date(f.data_emiterii);
            if (d.getMonth() === lunaCurenta && d.getFullYear() === anulCurent) totalLuna += val;
        }
    });

    // Contribuții buget de stat — neachitate, evidențiate separat în cardul roșu
    const totalContributiiNeachitate = (ZFlowStore.dateContributii || [])
        .filter(c => !c.achitat)
        .reduce((sum, c) => sum + (Number(c.suma) || 0), 0);

    const fmt = (v) => v >= 1000000 ? (v/1000000).toFixed(1)+"M" : v >= 1000 ? (v/1000).toFixed(0)+"k" : Math.round(v).toString();
    const fmtLei = (v) => `${Math.round(v).toLocaleString()} lei`;

    const kpiPlatit = document.getElementById("kpi-platit");
    const kpiRest = document.getElementById("kpi-restante-furnizori");
    const kpiFurn = document.getElementById("kpi-furnizori");
    const kpiLuna = document.getElementById("kpi-luna-furnizori");
    if (kpiPlatit) kpiPlatit.innerText = fmt(totalPlatit);
    if (kpiRest) kpiRest.innerText = fmt(totalRestante);
    if (kpiFurn) kpiFurn.innerText = furnizori.length.toString();
    if (kpiLuna) kpiLuna.innerText = fmt(totalLuna);

    // Actualizează total general (facturi + contribuții neachitate)
    const totalEl = document.getElementById("total-general-platit");
    if (totalEl) totalEl.innerText = `${Math.round(totalRestante + totalContributiiNeachitate).toLocaleString()} lei`;

    // Evidențiază contribuțiile în cardul roșu
    const cardCtb = document.getElementById("card-contributii-total");
    const kpiCtb = document.getElementById("kpi-contributii-total");
    if (cardCtb && kpiCtb) {
        if (totalContributiiNeachitate > 0) {
            cardCtb.classList.remove("hidden");
            kpiCtb.innerText = fmtLei(totalContributiiNeachitate);
        } else {
            cardCtb.classList.add("hidden");
        }
    }
}

/**
 * Deschide modal furnizor (nou sau editare)
 */
function deschideModalFurnizor(id) {
    const modal = document.getElementById("modal-furnizor");
    if (!modal) return;
    const btnSterge = document.getElementById("btn-sterge-furnizor");
    const title = document.getElementById("modal-furnizor-title");

    document.getElementById("in-furn-id").value = "";
    ["in-furn-cui","in-furn-nume","in-furn-adresa","in-furn-contact","in-furn-tel","in-furn-email","in-furn-iban","in-furn-oras","in-furn-note","in-furn-eticheta","in-furn-categorie"].forEach(el => {
        const inp = document.getElementById(el);
        if (inp) inp.value = "";
    });

    if (id) {
        const f = ZFlowStore.dateFurnizori.find(f => String(f.id) === String(id));
        if (f) {
            document.getElementById("in-furn-id").value = f.id;
            document.getElementById("in-furn-cui").value = f.cui || "";
            document.getElementById("in-furn-nume").value = f.nume_firma || "";
            document.getElementById("in-furn-adresa").value = f.adresa || "";
            const contactEl = document.getElementById("in-furn-contact");
            if (contactEl) contactEl.value = f.persoana_contact || "";
            document.getElementById("in-furn-tel").value = f.telefon || "";
            document.getElementById("in-furn-email").value = f.contact_email || "";
            document.getElementById("in-furn-iban").value = f.iban || "";
            document.getElementById("in-furn-oras").value = f.oras || "";
            document.getElementById("in-furn-note").value = f.note || "";
            const etichetaFurnEl = document.getElementById("in-furn-eticheta");
            if (etichetaFurnEl) etichetaFurnEl.value = f.eticheta || "";
            const categorieFurnEl = document.getElementById("in-furn-categorie");
            if (categorieFurnEl) categorieFurnEl.value = f.categorie || "";
        }
        if (title) title.innerText = "Editare Furnizor";
        if (btnSterge) btnSterge.classList.remove("hidden");
    } else {
        if (title) title.innerText = "Furnizor Nou";
        if (btnSterge) btnSterge.classList.add("hidden");
    }

    modal.classList.add("active");
}

async function _doSalveazaFurnizor(id, numeFirma, cui, ibanFurn) {
    const _saveBtn = document.querySelector('[data-action="salveazaFurnizor"]');
    const payload = {
        cui: cui || null,
        nume_firma: numeFirma || null,
        adresa: document.getElementById("in-furn-adresa")?.value.trim() || null,
        persoana_contact: document.getElementById("in-furn-contact")?.value.trim() || null,
        telefon: document.getElementById("in-furn-tel")?.value.trim() || null,
        contact_email: document.getElementById("in-furn-email")?.value.trim() || null,
        iban: document.getElementById("in-furn-iban")?.value.trim() || null,
        oras: document.getElementById("in-furn-oras")?.value.trim() || null,
        note: document.getElementById("in-furn-note")?.value.trim() || null,
        eticheta: document.getElementById("in-furn-eticheta")?.value.trim() || null,
        categorie: document.getElementById("in-furn-categorie")?.value.trim() || null,
        updated_at: new Date().toISOString()
    };
    setLoader(true);
    try {
        if (id) {
            await ZFlowDB.updateFurnizor(id, payload);
            const fIdx = ZFlowStore.dateFurnizori.findIndex(f => String(f.id) === String(id));
            if (fIdx !== -1) ZFlowStore.dateFurnizori[fIdx] = { ...ZFlowStore.dateFurnizori[fIdx], ...payload };
            showNotification("Furnizor actualizat!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        } else {
            const newId = await ZFlowDB.insertFurnizor(payload);
            ZFlowStore.dateFurnizori = [
                { ...payload, id: newId, facturi: [], sold: 0, sumaScadenta: 0, created_at: new Date().toISOString() },
                ...ZFlowStore.dateFurnizori
            ];
            showNotification("Furnizor adăugat!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        }
        // [BUG-A2 FIX] Invalidează cache-ul badge "Client+Furnizor" după salvare furnizor
        if (typeof _invalidateCuiCache === 'function') _invalidateCuiCache();
        inchideModal("modal-furnizor");
        renderFurnizoriThrottled();
        updateFurnizoriKPI();
        invalidateCashflowCache();
        incarcaDashboard();
        if (id && ZFlowStore.selectedFurnizorId === id) arataDetaliiFurnizor(id);
    } catch (err) {
        showNotification("Eroare: " + err.message, "error");
    } finally {
        setLoader(false);
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
    }
}

/**
 * Salvează furnizor (insert sau update)
 */
async function salveazaFurnizor() {
    const _saveBtn = document.querySelector('[data-action="salveazaFurnizor"]');
    if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, true);
    const id = document.getElementById("in-furn-id")?.value.trim();
    const numeFirma = document.getElementById("in-furn-nume")?.value.trim();
    const cui = document.getElementById("in-furn-cui")?.value.trim();

    if (!numeFirma && !cui) {
        showNotification("Completează cel puțin CUI-ul sau denumirea firmei", "error");
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
        return;
    }

    // Validare CUI + IBAN
    if (cui && typeof validareCUI === 'function' && !validareCUI(cui)) {
        if (typeof showConfirmModal === 'function') {
            showConfirmModal("CUI-ul furnizorului nu trece validarea cifrei de control ANAF. Continuați oricum?", async () => {
                await _doSalveazaFurnizor(id, numeFirma, cui, null);
            });
            if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
            return;
        }
    }
    const ibanFurn = document.getElementById("in-furn-iban")?.value.trim();
    if (ibanFurn && typeof validareIBAN === 'function' && !validareIBAN(ibanFurn)) {
        showNotification('IBAN furnizor invalid (format sau cifră de control incorectă)', 'error');
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
        return;
    }

    // Verificare duplicat furnizor (doar la inserare, nu la editare)
    if (!id) {
        const cuiNormF = (cui || '').toString().trim();
        const numeNormF = (numeFirma || '').toLowerCase().trim();
        const existentF = ZFlowStore.dateFurnizori.find(f =>
            (cuiNormF && String(f.cui || '').trim() === cuiNormF) ||
            (numeNormF && (f.nume_firma || '').toLowerCase().trim() === numeNormF)
        );
        if (existentF) {
            if (typeof showConfirmModal === 'function') {
                showConfirmModal(`Furnizorul "${existentF.nume_firma}" (CUI: ${existentF.cui || '—'}) există deja! Adaugi oricum?`, async () => {
                    await _doSalveazaFurnizor(id, numeFirma, cui, ibanFurn);
                });
                if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
                return;
            }
        }
    }

    setLoader(true);
    try {
        const payload = {
            cui: cui || null,
            nume_firma: numeFirma || null,
            adresa: document.getElementById("in-furn-adresa")?.value.trim() || null,
            persoana_contact: document.getElementById("in-furn-contact")?.value.trim() || null,
            telefon: document.getElementById("in-furn-tel")?.value.trim() || null,
            contact_email: document.getElementById("in-furn-email")?.value.trim() || null,
            iban: document.getElementById("in-furn-iban")?.value.trim() || null,
            oras: document.getElementById("in-furn-oras")?.value.trim() || null,
            note: document.getElementById("in-furn-note")?.value.trim() || null,
            eticheta: document.getElementById("in-furn-eticheta")?.value.trim() || null,
            categorie: document.getElementById("in-furn-categorie")?.value.trim() || null,
            updated_at: new Date().toISOString()
        };

        if (id) {
            await ZFlowDB.updateFurnizor(id, payload);
            // [QUALITY-FIX] FIX 6 — actualizare optimistă în store, fără re-fetch din DB
            const fIdx = ZFlowStore.dateFurnizori.findIndex(f => String(f.id) === String(id));
            if (fIdx !== -1) ZFlowStore.dateFurnizori[fIdx] = { ...ZFlowStore.dateFurnizori[fIdx], ...payload };
            showNotification("Furnizor actualizat!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        } else {
            const newId = await ZFlowDB.insertFurnizor(payload);
            // [QUALITY-FIX] FIX 6 — insert optimist în store, fără re-fetch din DB
            ZFlowStore.dateFurnizori = [
                { ...payload, id: newId, facturi: [], sold: 0, sumaScadenta: 0, created_at: new Date().toISOString() },
                ...ZFlowStore.dateFurnizori
            ];
            showNotification("Furnizor adăugat!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        }

        // [BUG-A2 FIX] Invalidează cache-ul badge "Client+Furnizor" după salvare furnizor
        if (typeof _invalidateCuiCache === 'function') _invalidateCuiCache();
        inchideModal("modal-furnizor");
        renderFurnizoriThrottled();
        updateFurnizoriKPI();
        invalidateCashflowCache();
        incarcaDashboard(); // Actualizează chart Home după modificare furnizor
        if (id && ZFlowStore.selectedFurnizorId === id) arataDetaliiFurnizor(id);
    } catch (err) {
        showNotification("Eroare: " + err.message, "error");
    } finally {
        setLoader(false);
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(document.querySelector('[data-action="salveazaFurnizor"]'), false);
    }
}

/**
 * Șterge furnizor din modal
 */
function stergeFurnizorModal() {
    const id = document.getElementById("in-furn-id")?.value;
    if (!id) return;
    showConfirmModal(
        "Ștergi furnizorul? Toate facturile asociate vor fi șterse.",
        async () => {
            setLoader(true);
            try {
                const _backupPtUndo = { ...(ZFlowStore.dateFurnizori.find(f => String(f.id) === String(id)) || {}) };
                await ZFlowDB.deleteFurnizor(id);
                inchideModal("modal-furnizor");
                // [BUG-A2 FIX v75.37] Invalidează cache-ul badge "Client+Furnizor" după ștergere furnizor
                if (typeof _invalidateCuiCache === 'function') _invalidateCuiCache();
                // [QUALITY-FIX] FIX 6 — ștergere optimistă din store, fără re-fetch din DB
                ZFlowStore.dateFurnizori = ZFlowStore.dateFurnizori.filter(f => String(f.id) !== String(id));
                ZFlowStore.dateFacturiPlatit = (ZFlowStore.dateFacturiPlatit || []).filter(fp2 => String(fp2.furnizor_id) !== String(id));
                comutaVedereFin("furnizori");
                renderFurnizoriThrottled();
                updateFurnizoriKPI();
                invalidateCashflowCache();
                incarcaDashboard(); // Actualizează chart Home
                if (typeof showNotificationWithUndo === 'function') showNotificationWithUndo('Furnizor șters. Poți anula în 5 secunde.', () => { if (_backupPtUndo.id) ZFlowDB.insertFurnizor(_backupPtUndo).then(() => { ZFlowStore.dateFurnizori.push(_backupPtUndo); renderFurnizoriThrottled(); updateFurnizoriKPI(); }).catch(() => {}); });
                else showNotification("Furnizor șters!", "success");
                if (navigator.vibrate) navigator.vibrate([30, 15, 30]);
            } catch (err) {
                showNotification("Eroare: " + err.message, "error");
            } finally {
                setLoader(false);
            }
        }
    );
}

/**
 * Șterge furnizor direct din lista (fără a deschide profilul)
 */
function stergeFurnizorDirect(id) {
    if (!hasPermission('canDelete')) { showNotification('Nu ai permisiunea de a șterge furnizori', 'error'); return; }
    showConfirmModal("Ștergi furnizorul? Toate facturile asociate vor fi șterse.", async () => {
        setLoader(true);
        try {
            const _backupPtUndo = { ...(ZFlowStore.dateFurnizori.find(f => String(f.id) === String(id)) || {}) };
            await ZFlowDB.deleteFurnizor(id);
            // [BUG-A2 FIX v75.37] Invalidează cache-ul badge "Client+Furnizor" după ștergere furnizor
            if (typeof _invalidateCuiCache === 'function') _invalidateCuiCache();
            // [QUALITY-FIX] FIX 6 — ștergere optimistă din store, fără re-fetch din DB
            ZFlowStore.dateFurnizori = ZFlowStore.dateFurnizori.filter(f => String(f.id) !== String(id));
            ZFlowStore.dateFacturiPlatit = (ZFlowStore.dateFacturiPlatit || []).filter(fp2 => String(fp2.furnizor_id) !== String(id));
            renderFurnizoriThrottled();
            updateFurnizoriKPI();
            invalidateCashflowCache();
            incarcaDashboard(); // Actualizează chart Home
            if (typeof showNotificationWithUndo === 'function') showNotificationWithUndo('Furnizor șters. Poți anula în 5 secunde.', () => { if (_backupPtUndo.id) ZFlowDB.insertFurnizor(_backupPtUndo).then(() => { ZFlowStore.dateFurnizori.push(_backupPtUndo); renderFurnizoriThrottled(); updateFurnizoriKPI(); }).catch(() => {}); });
            else showNotification('Furnizor șters!', 'success');
            if (navigator.vibrate) navigator.vibrate([30, 15, 30]);
        } catch (err) { showNotification('Eroare: ' + err.message, 'error'); }
        finally { setLoader(false); }
    });
}

/**
 * Populează select-ul de furnizori în modal-factura-platit
 */
function populeazaSelectFurnizori(selectedId) {
    const sel = document.getElementById("in-fp-furnizor");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Alege furnizorul —</option>` +
        ZFlowStore.dateFurnizori.map(f =>
            `<option value="${f.id}" ${String(f.id) === String(selectedId) ? "selected" : ""}>${f.nume_firma || f.cui}</option>`
        ).join("");
}

// ==========================================
// ADAUGĂ FIRMĂ (Client / Furnizor / Ambele)
// ==========================================

/**
 * Deschide modalul unificat pentru firmă nouă
 */
function deschideFirmaNou() {
    ["fn-cui","fn-nume","fn-adresa","fn-contact","fn-tel","fn-email","fn-iban","fn-oras","fn-note","fn-eticheta","fn-categorie"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    selectTipFirmaNou("client");
    document.getElementById("modal-firma-nou").classList.add("active");
}

/**
 * Selectează/schimbă tipul de firmă în modal-firma-nou
 */
function selectTipFirmaNou(tip) {
    document.querySelectorAll(".fn-tip-btn").forEach(btn => {
        const isActive = btn.dataset.tip === tip;
        btn.classList.toggle("bg-blue-900", isActive);
        btn.classList.toggle("text-white", isActive);
        btn.classList.toggle("shadow", isActive);
        btn.classList.toggle("text-slate-500", !isActive);
    });
}

/**
 * Lookup ANAF pentru câmpurile din modal-firma-nou
 */
async function autoCautareCUIFirmaNou() {
    const cuiRaw = document.getElementById("fn-cui").value;
    const cui = cuiRaw.replace(/\D/g, "");
    if (!cui || cui.length < 2) return showNotification("Introdu un CUI valid (doar cifrele)!", "warning");

    const anafUrl = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva";
    const dataAzi = new Date().toISOString().split("T")[0];
    const body = JSON.stringify([{ cui: parseInt(cui), data: dataAzi }]);
    const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

    const aplicaDate = (d) => {
        document.getElementById("fn-nume").value   = d.date_generale?.denumire || "";
        document.getElementById("fn-adresa").value = d.adresa_domiciliu_fiscal?.adresa || "";
        document.getElementById("fn-oras").value   = d.adresa_domiciliu_fiscal?.localitate || "";
    };

    setLoader(true);

    const edgeFnUrl_fn = `${URL_Z}/functions/v1/anaf-proxy`;
    try {
        const r = await fetch(edgeFnUrl_fn, { method: "POST", headers: { ...jsonHeaders, "Authorization": `Bearer ${KEY_Z}` }, body, signal: AbortSignal.timeout(8000) });
        if (r.ok) {
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); setLoader(false); return; }
        }
    } catch (_) {}

    const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(anafUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(anafUrl)}`,
    ];
    for (const proxyUrl of proxies) {
        try {
            const r = await fetch(proxyUrl, { method: "POST", headers: jsonHeaders, body, signal: AbortSignal.timeout(8000) });
            if (!r.ok) continue;
            const res = await r.json();
            if (res.found?.[0]?.date_generale) { aplicaDate(res.found[0]); setLoader(false); return; }
            else { showNotification(`CUI-ul ${cui} nu a fost găsit în baza ANAF.`, "warning"); setLoader(false); return; }
        } catch (_) {}
    }
    showNotification("Nu s-a putut contacta ANAF. Completează manual.", "warning");
    setLoader(false);
}

/**
 * Salvează firma nouă (Client / Furnizor / Ambele)
 */
async function salveazaFirmaNou() {
    const _saveBtn = document.querySelector('[data-action="salveazaFirmaNou"]');
    if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, true);
    const tipActiv = document.querySelector(".fn-tip-btn.bg-blue-900")?.dataset.tip || "client";
    const cui = document.getElementById("fn-cui").value.trim();
    const numeFirma = document.getElementById("fn-nume").value.trim();

    if (!cui || !numeFirma) {
        showNotification("CUI-ul și Denumirea sunt obligatorii!", "error");
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
        return;
    }

    const payloadBase = {
        cui,
        nume_firma: numeFirma,
        adresa: document.getElementById("fn-adresa").value.trim() || null,
        persoana_contact: document.getElementById("fn-contact").value.trim() || null,
        telefon: document.getElementById("fn-tel").value.trim() || null,
        contact_email: document.getElementById("fn-email").value.trim() || null,
        iban: document.getElementById("fn-iban").value.trim() || null,
        oras: document.getElementById("fn-oras").value.trim() || null,
        eticheta: document.getElementById("fn-eticheta")?.value.trim() || null,
        categorie: document.getElementById("fn-categorie")?.value.trim() || null,
    };
    // tabelul 'clienti' NU are coloana 'note' — doar 'furnizori' o are
    const payloadClient   = { ...payloadBase };
    const payloadFurnizor = { ...payloadBase, note: document.getElementById("fn-note")?.value.trim() || null };

    setLoader(true);
    try {
        if (tipActiv === "client" || tipActiv === "ambele") {
            await ZFlowDB.insertClient(payloadClient);
        }
        if (tipActiv === "furnizor" || tipActiv === "ambele") {
            await ZFlowDB.insertFurnizor(payloadFurnizor);
        }
        inchideModal("modal-firma-nou");
        const label = tipActiv === "ambele" ? "Client + Furnizor adăugat!" : tipActiv === "client" ? "Client adăugat!" : "Furnizor adăugat!";
        showNotification("" + label, "success");
        // [BUG-A2 FIX] Invalidează cache-ul badge "Client+Furnizor" înainte de re-render
        if (typeof _invalidateCuiCache === 'function') _invalidateCuiCache();
        await init(false);
    } catch (e) {
        showNotification("Eroare: " + e.message, "error");
    } finally {
        setLoader(false);
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(document.querySelector('[data-action="salveazaFirmaNou"]'), false);
    }
}

// ==========================================
// ADAUGĂ FACTURĂ (De Încasat / De Plătit)
// ==========================================

/**
 * Deschide modalul unificat pentru factură nouă
 */
function deschideFacturaNou() {
    // Reset câmpuri
    ["fn-fac-nr","fn-fac-val","fn-fac-note"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
    });
    const _aziFactura = getDataImplicita();
    const _aziFacturaDisplay = _aziFactura && typeof formateazaDataZFlow === 'function' ? formateazaDataZFlow(_aziFactura) : (_aziFactura || 'Alege data');
    ["fn-fac-emisie","fn-fac-scad"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = _aziFactura;
    });
    document.getElementById("display-fn-fac-emisie").innerText = _aziFacturaDisplay;
    document.getElementById("display-fn-fac-scad").innerText = _aziFacturaDisplay;

    // Populează selecturi
    const selClient = document.getElementById("fn-fac-client");
    if (selClient) {
        selClient.innerHTML = `<option value="">— Alege clientul —</option>` +
            ZFlowStore.dateLocal.map(c => `<option value="${c.id}">${c.nume_firma || c.cui}</option>`).join("");
    }
    const selFurnizor = document.getElementById("fn-fac-furnizor");
    if (selFurnizor) {
        selFurnizor.innerHTML = `<option value="">— Alege furnizorul —</option>` +
            ZFlowStore.dateFurnizori.map(f => `<option value="${f.id}">${f.nume_firma || f.cui}</option>`).join("");
    }

    comutaTipFacturaNou("incasat");
    // [P0-B v74.7] Cota TVA implicită: 21% dacă plătitor, 0% dacă neplătitor
    const _cotaSel = document.getElementById('fn-fac-cota-tva');
    // [v74.8] Cotă implicită din profil (cota_tva_default) sau fallback 21% pentru plătitori
    if (_cotaSel) _cotaSel.value = (window.ZFlowStore?.userProfile?.platitor_tva)
        ? String(window.ZFlowStore?.userProfile?.cota_tva_default ?? 21)
        : '0';
    document.getElementById("modal-factura-nou").classList.add("active");
}

/**
 * Comută tipul de factură în modal-factura-nou
 */
function comutaTipFacturaNou(tip) {
    document.querySelectorAll(".fn-fac-tip-btn").forEach(btn => {
        const isActive = btn.dataset.tip === tip;
        btn.classList.toggle("bg-blue-900", isActive);
        btn.classList.toggle("text-white", isActive);
        btn.classList.toggle("shadow", isActive);
        btn.classList.toggle("text-slate-500", !isActive);
    });
    document.getElementById("fn-fac-client-wrap").classList.toggle("hidden", tip !== "incasat");
    document.getElementById("fn-fac-furnizor-wrap").classList.toggle("hidden", tip !== "platit");
}

/**
 * Salvează factura nouă (de încasat sau de plătit)
 */
async function salveazaFacturaNou() {
    const _saveBtn = document.querySelector('[data-action="salveazaFacturaNou"]');
    if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, true);
    const tip = document.querySelector(".fn-fac-tip-btn.bg-blue-900")?.dataset.tip || "incasat";
    const nr = document.getElementById("fn-fac-nr").value.trim();
    const val = parseFloat(document.getElementById("fn-fac-val").value);
    const emisie = document.getElementById("fn-fac-emisie").value || null;
    const scad = document.getElementById("fn-fac-scad").value || null;
    const note = document.getElementById("fn-fac-note").value.trim() || null;

    const cotaTva = parseInt(document.getElementById('fn-fac-cota-tva')?.value ?? 21); // [P0-B v74.7]
    if (!val || isNaN(val)) {
        showNotification("Valoarea este obligatorie!", "error");
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
        return;
    }

    setLoader(true);
    try {
        if (tip === "incasat") {
            const clientId = document.getElementById("fn-fac-client").value;
            if (!clientId) { showNotification("Selectează un client!", "error"); setLoader(false); return; }
            await ZFlowDB.insertFactura({
                client_id: clientId,
                numar_factura: nr || null, // [QUALITY-FIX] FIX 7 — eliminat alias deprecat nr_factura
                valoare: val,
                cota_tva: cotaTva,         // [P0-B v74.7]
                data_emiterii: emisie,     // [QUALITY-FIX] FIX 7 — eliminat alias deprecat data_emitere
                data_scadenta: scad,
                note,
                status_plata: "Neincasat",
                updated_at: new Date().toISOString()
            });
            showNotification("Factură de încasat adăugată!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        } else {
            const furnizorId = document.getElementById("fn-fac-furnizor").value;
            if (!furnizorId) { showNotification("Selectează un furnizor!", "error"); setLoader(false); return; }
            await ZFlowDB.insertFacturaPlatit({
                furnizor_id: furnizorId,
                numar_factura: nr || null, // [QUALITY-FIX] FIX 7 — eliminat alias deprecat nr_factura
                valoare: val,
                cota_tva: cotaTva,         // [P0-B v74.7]
                data_emiterii: emisie,     // [QUALITY-FIX] FIX 7 — eliminat alias deprecat data_emitere
                data_scadenta: scad,
                note,
                status_plata: "Neplatit",
                updated_at: new Date().toISOString()
            });
            showNotification("Factură de plătit adăugată!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        }
        inchideModal("modal-factura-nou");
        await init(false);
    } catch (e) {
        showNotification("Eroare: " + e.message, "error");
    } finally {
        setLoader(false);
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(document.querySelector('[data-action="salveazaFacturaNou"]'), false);
    }
}

// ==========================================
// [FEAT 1.3] ALERTE CONTRIBUȚII RESTANTE
// ==========================================

/**
 * Randează blocul de contribuții restante în #alerte-contributii-container.
 * Returnează numărul de contribuții restante (folosit pentru badge nav).
 * @returns {number} count contribuții neachitate scadente
 */
function renderAlerteContributii() {
    const container = document.getElementById('alerte-contributii-container');
    const contributii = window.ZFlowStore?.dateContributii || [];
    const azi = new Date(); azi.setHours(0, 0, 0, 0);

    const restante = contributii.filter(c => {
        if (c.achitat === true || c.achitat === 'da' || c.achitat === 1) return false;
        if (!c.data_scadenta && !c.luna) return false;
        // Calculăm scadența: dacă e câmp explicit, folosim; altfel luna + zi 25
        let scad;
        if (c.data_scadenta) {
            scad = new Date(c.data_scadenta.length === 10 ? c.data_scadenta + 'T12:00:00' : c.data_scadenta);
        } else if (c.luna) {
            // luna format "AAAA-LL" → scadenta e pe 25 ale lunii următoare
            const [an, luna] = String(c.luna).split('-').map(Number);
            scad = new Date(luna === 12 ? an + 1 : an, luna === 12 ? 0 : luna, 25);
        }
        return scad && scad < azi;
    });

    if (!container) {
        ZFlowLogger.warn('financiar', '[renderAlerteContributii] Container #alerte-contributii-container lipsă din DOM');
        return restante.length;
    }

    if (restante.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return 0;
    }

    // Grupare pe tip
    const peType = {};
    restante.forEach(c => {
        const tip = (c.tip || 'Altele').toUpperCase();
        if (!peType[tip]) peType[tip] = { suma: 0, count: 0 };
        peType[tip].suma += Number(c.suma || 0);
        peType[tip].count++;
    });

    const rânduri = Object.entries(peType).map(([tip, { suma, count }]) =>
        `<div class="flex justify-between items-center py-1 border-b border-red-100 last:border-0">
            <span class="text-xs font-semibold text-red-700">${tip}</span>
            <span class="text-xs text-red-600">${count} pos. · ${suma.toLocaleString('ro-RO')} RON</span>
        </div>`
    ).join('');

    container.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-xl p-3 mt-2">
            <div class="flex items-center gap-2 mb-2">
                <span class="text-red-600 font-black text-xs uppercase tracking-wide">⚠ Contribuții restante (${restante.length})</span>
            </div>
            ${rânduri}
        </div>`;
    container.classList.remove('hidden');
    return restante.length;
}
window.renderAlerteContributii = renderAlerteContributii;

// ==========================================
// [FEAT 2.1] FILTRARE FACTURI REALTIME
// ==========================================

/**
 * Filtrează facturile din ZFlowStore și apelează renderMain cu rezultatul filtrat.
 * @param {Object} query
 * @param {string} [query.text]       - Caută în nr_factura, client name
 * @param {string} [query.status]     - 'Incasat'|'Neincasat'|'Incasat Partial'|''
 * @param {string} [query.dateFrom]   - ISO date string inclusiv
 * @param {string} [query.dateTo]     - ISO date string inclusiv
 * @param {number} [query.sumaMin]    - Suma minimă
 * @param {number} [query.sumaMax]    - Suma maximă
 * @returns {Array} lista filtrată
 */
function filtreazaFacturiRealtime(query = {}) {
    const clienti = window.ZFlowStore?.dateLocal || [];
    const toateFacturile = window.ZFlowStore?.dateFacturiBI || [];
    const text = (query.text || '').toLowerCase().trim();
    const status = (query.status || '').trim();
    const dateFrom = query.dateFrom ? new Date(query.dateFrom + 'T00:00:00') : null;
    const dateTo   = query.dateTo   ? new Date(query.dateTo + 'T23:59:59') : null;
    const sumaMin  = query.sumaMin != null ? Number(query.sumaMin) : null;
    const sumaMax  = query.sumaMax != null ? Number(query.sumaMax) : null;

    // Construim un index rapid CUI → nrFacturi per client pentru sumar
    const clientById = {};
    clienti.forEach(c => { clientById[String(c.id)] = c; });

    // Filtrăm pe clienți care au cel puțin o factură corespunzătoare
    const filtrate = clienti.filter(client => {
        if (!text && !status && !dateFrom && !dateTo && sumaMin == null && sumaMax == null) return true;
        const facturiClient = toateFacturile.filter(f => String(f.client_id) === String(client.id));
        return facturiClient.some(f => {
            if (text) {
                const nr = (f.numar_factura || f.nr_factura || '').toLowerCase();
                const nume = (client.nume_firma || '').toLowerCase();
                if (!nr.includes(text) && !nume.includes(text)) return false;
            }
            if (status && f.status_plata !== status) return false;
            if (dateFrom || dateTo) {
                const d = f.data_emiterii || f.data_emitere;
                if (!d) return false;
                const dObj = new Date(d.length === 10 ? d + 'T12:00:00' : d);
                if (dateFrom && dObj < dateFrom) return false;
                if (dateTo   && dObj > dateTo)   return false;
            }
            if (sumaMin != null || sumaMax != null) {
                const v = Number(f.valoare || f.suma || 0);
                if (sumaMin != null && v < sumaMin) return false;
                if (sumaMax != null && v > sumaMax) return false;
            }
            return true;
        });
    });

    // Actualizează contorul dacă elementul există
    const counter = document.getElementById('facturi-count-display');
    if (counter) {
        const total = clienti.length;
        counter.textContent = filtrate.length < total
            ? `${filtrate.length} clienți găsiți din ${total} total`
            : `${total} clienți`;
    }

    if (typeof renderMain === 'function') renderMain(filtrate);
    return filtrate;
}
window.filtreazaFacturiRealtime = filtreazaFacturiRealtime;

// ==========================================
// EXPORTS — financiar.js
// ==========================================
window.renderMainThrottled = renderMainThrottled;
window.renderFurnizoriThrottled = renderFurnizoriThrottled;
window._recomputeFurnizoriData = _recomputeFurnizoriData;
window.renderMain = renderMain;
// filtreazaListaFirme este definită în app.js și se setează pe window acolo
// arataDetalii este definită în app.js și se setează pe window acolo (forward reference eliminată)
window.renderFurnizori = renderFurnizori;
window.filtreazaListaFurnizori = filtreazaListaFurnizori;
window.arataDetaliiFurnizor = arataDetaliiFurnizor;

// ==========================================
// NAMESPACE ZFlowFinanciar
// ==========================================

/**
 * @namespace ZFlowFinanciar
 * @description API public pentru modulul financiar Z-FLOW.
 * Expune funcțiile de render și utilitarele pentru clienți și furnizori.
 *
 * Funcțiile existente pe `window.*` sunt păstrate pentru compatibilitate
 * cu codul legacy din app.js și supabase.js.
 *
 * @example
 * // Randare listă clienți
 * ZFlowFinanciar.renderMain();
 *
 * // Randare listă furnizori cu filtru
 * ZFlowFinanciar.renderFurnizori(ZFlowStore._furnizoriFiltrati);
 */
window.ZFlowFinanciar = {
    /**
     * Randează lista principală de clienți în DOM.
     * Aplică paginare și sortare după restanțe.
     *
     * @param {Array|null} [lista=null] - Lista filtrată de clienți sau null pentru toate
     * @returns {void}
     */
    renderMain,

    /**
     * Randează lista de furnizori în DOM.
     * Aplică paginare și sortare după restanțe.
     *
     * @param {Array|null} [lista] - Lista filtrată de furnizori sau undefined pentru toate
     * @returns {void}
     */
    renderFurnizori,

    /**
     * Versiune throttled a renderMain — evită render-uri redundante în același frame.
     * @returns {void}
     */
    renderMainThrottled,

    /**
     * Versiune throttled a renderFurnizori — evită render-uri redundante în același frame.
     * @returns {void}
     */
    renderFurnizoriThrottled,

    /**
     * Recompilează dateFurnizori din store-ul curent fără fetch din DB.
     * Folosit după operații optimiste CRUD pe furnizori și facturi_platit.
     * @returns {void}
     */
    recomputeFurnizoriData: _recomputeFurnizoriData
};

window.toggleStatusPlatit        = toggleStatusPlatit;
window.updateFurnizoriKPI        = updateFurnizoriKPI;
window.deschideModalFurnizor     = deschideModalFurnizor;
window.salveazaFurnizor          = salveazaFurnizor;
window.stergeFurnizorModal       = stergeFurnizorModal;
window.stergeFurnizorDirect      = stergeFurnizorDirect;
window.populeazaSelectFurnizori  = populeazaSelectFurnizori;
window.deschideFirmaNou          = deschideFirmaNou;
window.selectTipFirmaNou         = selectTipFirmaNou;
window.autoCautareCUIFirmaNou    = autoCautareCUIFirmaNou;
window.salveazaFirmaNou          = salveazaFirmaNou;
window.deschideFacturaNou        = deschideFacturaNou;
window.comutaTipFacturaNou       = comutaTipFacturaNou;
window.salveazaFacturaNou        = salveazaFacturaNou;

// [UX5] Sortare manuală listă clienți
function setSortareClienti(tip) {
    ZFlowStore.sortareClienti = tip;
    document.querySelectorAll('.sort-btn-clienti').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-100', 'text-blue-700');
        btn.classList.add('bg-slate-100', 'text-slate-500');
    });
    const activeMap = { scadenta: 0, sold: 1, alfa: 2 };
    const btns = document.querySelectorAll('.sort-btn-clienti');
    const idx = activeMap[tip] ?? 0;
    if (btns[idx]) {
        btns[idx].classList.add('active', 'bg-blue-100', 'text-blue-700');
        btns[idx].classList.remove('bg-slate-100', 'text-slate-500');
    }
    if (typeof renderMainThrottled === 'function') renderMainThrottled();
}
window.setSortareClienti = setSortareClienti;
