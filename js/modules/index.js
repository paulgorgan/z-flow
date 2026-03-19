/**
 * Z-FLOW Enterprise v8.0
 * Module Index — Handler delegat pentru acțiunile UI din index.html
 *
 * Înlocuiește cele 159 atribute onclick= inline cu un singur listener delegat
 * pe `document`. Fiecare element interactiv primește:
 *   data-action="numeActiune"          — numele funcției sau acțiunii
 *   data-arg="valoare"                 — argument unic (opțional)
 *   data-arg0="val0" data-arg1="val1"  — două argumente (opțional)
 *   data-target="idElement"            — id DOM țintă (pentru picker etc.)
 *
 * Funcțiile globale (window.*) sunt apelate direct cu argumentele extrase.
 * Acțiunile complexe (cu referințe DOM, efecte compuse) sunt definite în
 * obiectul `SPECIALS` de mai jos.
 *
 * Backdropul #fab-menu (click în afara sheet-content închide FAB):
 *   Gestionat printr-un listener dedicat adăugat la DOMContentLoaded.
 */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Ajutor: parsează valoarea unui atribut data-* în tipul nativ corespunzător
  // -------------------------------------------------------------------------

  /**
   * Convertește un șir provenit dintr-un atribut data-* în boolean sau string.
   * @param {string|undefined} v - valoarea brută a atributului
   * @returns {boolean|string|undefined}
   */
  function parseArg(v) {
    if (v === undefined || v === null) return undefined;
    if (v === 'true')  return true;
    if (v === 'false') return false;
    return v;
  }

  // -------------------------------------------------------------------------
  // Acțiuni speciale — logică complexă sau cu referințe DOM directe
  // -------------------------------------------------------------------------

  /** @type {Object.<string, function(Element): void>} */
  const SPECIALS = {
    /** Navighează la tab-ul Home și marchează butonul nav corespunzător. */
    navHome: function () {
      if (typeof schimbaTab === 'function')
        schimbaTab('home', document.getElementById('nav-btn-home'));
    },

    /** Navighează la tab-ul Financiar. */
    navFinanciar: function () {
      if (typeof schimbaTab === 'function')
        schimbaTab('financiar', document.getElementById('nav-btn-fin'));
    },

    /** Navighează la tab-ul Logistic și randează lista comenzilor. */
    navLogistic: function (btn) {
      if (typeof schimbaTab === 'function') schimbaTab('logistic', btn);
      if (typeof renderLogistic === 'function') renderLogistic();
    },

    /** Navighează la tab-ul Depozit și randează produsele. */
    navDepozit: function (btn) {
      if (typeof schimbaTab === 'function') schimbaTab('depozit', btn);
      if (typeof renderDepozit === 'function') renderDepozit();
    },

    /** Deschide modalul de editare pentru clientul curent selectat. */
    deschideModalClientSelectat: function () {
      if (typeof deschideModal === 'function')
        deschideModal('modal-client', window.ZFlowStore && window.ZFlowStore.selectedClientId);
    },

    /** Deschide modalul de editare pentru furnizorul curent selectat. */
    deschideModalFurnizorSelectat: function () {
      if (typeof deschideModalFurnizor === 'function')
        deschideModalFurnizor(window.ZFlowStore && window.ZFlowStore.selectedFurnizorId);
    },

    /** Import Smart Unificat — detectează automat tipul fișierului (CSV/XLSX/XML).
     *  Distribuie automat: clienți | furnizori | contribuții.
     *  Înlocuiește cele 3 butoane separate de import. */
    importSmartUnificat: function () {
      if (typeof toggleFAB === 'function') toggleFAB();
      if (typeof importSmartUnificat === 'function') importSmartUnificat();
    },

    /** Importă facturi clienți SAGA și închide meniul FAB. (păstrat pentru compatibilitate) */
    importaClientiSaga: function () {
      if (typeof importaDateSaga === 'function') importaDateSaga('clienti');
      if (typeof toggleFAB === 'function') toggleFAB();
    },

    /** Importă facturi furnizori SAGA și închide meniul FAB. (păstrat pentru compatibilitate) */
    importaFurnizoriSaga: function () {
      if (typeof importaDateSaga === 'function') importaDateSaga('furnizori');
      if (typeof toggleFAB === 'function') toggleFAB();
    },

    /** Deschide formularul de firmă nouă și închide meniul FAB. */
    deschideFirmaNouSaga: function () {
      if (typeof deschideFirmaNou === 'function') deschideFirmaNou();
      if (typeof toggleFAB === 'function') toggleFAB();
    },

    /** Deschide formularul de factură nouă și închide meniul FAB. */
    deschideFacturaNouSaga: function () {
      if (typeof deschideFacturaNou === 'function') deschideFacturaNou();
      if (typeof toggleFAB === 'function') toggleFAB();
    },

    /** Verifică statutul e-Factura ANAF pentru CUI-ul din câmpul #in-cui. */
    verificaEFacturaCUI: function () {
      const el = document.getElementById('in-cui');
      if (el && typeof verificaEFactura === 'function') verificaEFactura(el.value);
    },

    /** Șterge factura de plătit curent editată (id citit din input #in-fp-id). */
    stergeFacturaPlatitActiva: function () {
      const el = document.getElementById('in-fp-id');
      if (el && typeof stergeFacturaPlatit === 'function') stergeFacturaPlatit(el.value);
    },

    /** Deschide modalul de adăugare/editare contribuție buget stat. */
    deschideModalContributie: function (btn) {
      const id = btn.dataset.arg || null;
      if (typeof deschideModalContributie === 'function') deschideModalContributie(id);
    },

    /** Salvează contribuția din modal. */
    salveazaContributie: function () {
      if (typeof salveazaContributie === 'function') salveazaContributie();
    },

    /** Șterge contribuția activă (id citit din #ctb-id). */
    stergeContributie: function () {
      if (typeof stergeContributie === 'function') stergeContributie();
    },

    /** Verifică statutul e-Factura ANAF pentru CUI-ul din câmpul #in-furn-cui. */
    verificaEFacturaFurnizor: function () {
      const el = document.getElementById('in-furn-cui');
      if (el && typeof verificaEFactura === 'function') verificaEFactura(el.value);
    },

    /**
     * Extinde/colapsează lista multi-firmă din panoul profilului firmei.
     * @param {Element} btn - butonul apăsat (conține elementul .pf-arrow)
     */
    toggleFirmeMulti: function (btn) {
      const c = document.getElementById('pf-firme-content');
      if (!c) return;
      c.classList.toggle('hidden');
      const arrow = btn.querySelector('.pf-arrow');
      if (arrow) {
          const isHidden = c.classList.contains('hidden');
          arrow.innerHTML = `<svg class="w-4 h-4 transition-transform duration-200 ${isHidden ? '' : 'rotate-180'}" 
              fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
          </svg>`;
      }
      if (!c.classList.contains('hidden') && window.ZFlowMultiFirma)
        ZFlowMultiFirma.renderPanel('pf-firme-content');
    },

    /** Copiază token-ul admin afișat în clipboard. */
    copieTokenAdmin: function () {
      const el = document.getElementById('admin-token-output');
      const text = el ? el.textContent : '';
      navigator.clipboard.writeText(text).then(function () {
        if (typeof showNotification === 'function') showNotification('Copiat!', 'success');
      });
    },

    /**
     * Expandează / colapsează elementul imediat următor din DOM.
     * @param {Element} btn - butonul apăsat
     */
    expandNext: function (btn) {
      if (btn.nextElementSibling) btn.nextElementSibling.classList.toggle('hidden');
    },

    /** Ascunde panoul de extindere abonament din dashboard-ul admin. */
    ascundeAdminExtend: function () {
      const el = document.getElementById('admin-extend-panel');
      if (el) el.classList.add('hidden');
    },

    /** Ascunde panoul de notificare rapidă din dashboard-ul admin. */
    ascundeAdminNotif: function () {
      const el = document.getElementById('admin-notif-panel');
      if (el) el.classList.add('hidden');
    },

    /** Ascunde panoul de ștergere permanentă din dashboard-ul admin. */
    ascundeAdminDelete: function () {
      const el = document.getElementById('admin-delete-panel');
      if (el) el.classList.add('hidden');
    },

    /** Închide modalul de schimbare cont utilizator. */
    inchideModalSchimbaCont: function () {
      const el = document.getElementById('modal-schimba-cont');
      if (el) el.classList.remove('active');
    },

    /** Închide modalul Multi-Firmă. */
    inchideModalMultifirma: function () {
      const el = document.getElementById('modal-multifirma');
      if (el) el.classList.remove('active');
    },

    /**
     * Deschide picker-ul nativ al input-ului copil al elementului curent.
     * @param {Element} btn - containerul care conține un <input type="date">
     */
    showNestedPicker: function (btn) {
      const input = btn.querySelector('input');
      if (input && typeof input.showPicker === 'function') input.showPicker();
    },

    /**
     * Deschide picker-ul nativ al elementului referit prin data-target.
     * @param {Element} btn - elementul cu atributul data-target="idElement"
     */
    showPickerFor: function (btn) {
      const targetId = btn.dataset.target;
      if (!targetId) return;
      const el = document.getElementById(targetId);
      if (el && typeof el.showPicker === 'function') el.showPicker();
    },

    /**
     * Elementul însuși (de obicei un <input type="date">) deschide picker-ul.
     * @param {Element} btn - input-ul cu data-action="showSelfPicker"
     */
    showSelfPicker: function (btn) {
      if (typeof btn.showPicker === 'function') btn.showPicker();
    },

    /** Randează panoul de configurare SafeFleet / Nexus GPS. */
    safefleetRenderPanel: function () {
      if (window.ZFlowSafeFleet && typeof ZFlowSafeFleet.renderPanel === 'function')
        ZFlowSafeFleet.renderPanel();
    },

    /**
     * Aplică filtrul de status BI — pasează butonul apăsat ca al doilea argument
     * pentru ca funcția să poată actualiza starea vizuală a butoanelor.
     * @param {Element} btn - butonul de filtru apăsat
     */
    setFiltruStatusBI: function (btn) {
      const arg0 = parseArg(btn.dataset.arg !== undefined ? btn.dataset.arg : btn.dataset.arg0);
      if (typeof window.setFiltruStatusBI === 'function')
        window.setFiltruStatusBI(arg0, btn);
    },
  };

  // -------------------------------------------------------------------------
  // Listener delegat principal (faza de bubbling)
  // -------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    // Acțiuni speciale cu logică proprie
    if (Object.prototype.hasOwnProperty.call(SPECIALS, action)) {
      SPECIALS[action](btn);
      return;
    }

    // Acțiuni simple: argumente opționale extrase din data-arg / data-arg0 / data-arg1
    const raw0 = btn.dataset.arg !== undefined ? btn.dataset.arg : btn.dataset.arg0;
    const raw1 = btn.dataset.arg1;
    const args = [];
    if (raw0 !== undefined) args.push(parseArg(raw0));
    if (raw1 !== undefined) args.push(parseArg(raw1));

    const fn = window[action];
    if (typeof fn === 'function') fn.apply(null, args);
  });

  // -------------------------------------------------------------------------
  // Backdrop #fab-menu: click în afara .sheet-content închide meniul FAB
  // -------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    const fabMenu = document.getElementById('fab-menu');
    if (!fabMenu) return;
    fabMenu.addEventListener('click', function (e) {
      if (!e.target.closest('.sheet-content') && typeof toggleFAB === 'function')
        toggleFAB();
    });
  });

}());

/**
 * DOCUMENTAȚIE UTILIZARE MODULE
 * =============================
 * 
 * 1. ZFlowUtils - Funcții utilitare
 *    - ZFlowUtils.formateazaDataZFlow('2026-03-02') → '02/03/26'
 *    - ZFlowUtils.formateazaSuma(1500.50) → '1.500,50 RON'
 *    - ZFlowUtils.debounce(func, 300)
 * 
 * 2. ZFlowAuth - Autentificare
 *    - ZFlowAuth.isBlocked() → boolean
 *    - ZFlowAuth.recordFailedAttempt()
 *    - ZFlowAuth.validateEmail('test@email.com')
 * 
 * 3. ZFlowUI - Componente UI
 *    - ZFlowUI.showNotification('Mesaj', 'success')
 *    - ZFlowUI.setLoader(true/false)
 *    - ZFlowUI.showEmptyState(container, 'Titlu', 'Text', 'invoices')
 * 
 * 4. ZFlowClients - Gestiune clienți
 *    - ZFlowClients.getAll()
 *    - ZFlowClients.findById(id)
 *    - ZFlowClients.search('termen')
 *    - ZFlowClients.calculeazaTotaluri(client)
 * 
 * 5. ZFlowSuppliers - Gestiune furnizori
 *    - ZFlowSuppliers.getAll()
 *    - ZFlowSuppliers.findById(id)
 *    - ZFlowSuppliers.populateSelect('select-id')
 * 
 * 6. ZFlowInvoices - Gestiune facturi
 *    - ZFlowInvoices.getAllReceivable()
 *    - ZFlowInvoices.getOverdue()
 *    - ZFlowInvoices.filterByStatus(facturi, 'Neincasat')
 *    - ZFlowInvoices.calculeazaTotaluri(facturi)
 * 
 * 7. ZFlowAnalytics - Dashboard și BI
 *    - ZFlowAnalytics.getKPIs()
 *    - ZFlowAnalytics.getCashflowData(6) // ultimele 6 luni
 *    - ZFlowAnalytics.getTopClients(5)
 *    - ZFlowAnalytics.getCollectionRate()
 * 
 * 8. ZFlowExport - Export PDF/Excel
 *    - ZFlowExport.savePDF(facturi, 'raport.pdf')
 *    - ZFlowExport.saveExcel(facturi, 'raport.xlsx')
 *    - ZFlowExport.saveCSV(facturi, 'raport.csv')
 * 
 * 9. ZFlowImport - Import SAGA
 *    - ZFlowImport.parseCSV(text, { hasHeader: true })
 *    - ZFlowImport.mapSAGAData(parsedData)
 *    - ZFlowImport.validate(importData)
 * 
 * 10. ZFlowNotifications - Notificări
 *     - ZFlowNotifications.send('Titlu', { body: 'Mesaj' })
 *     - ZFlowNotifications.checkDueInvoices()
 *     - ZFlowNotifications.generateWhatsAppLink(params)
 * 
 * 11. ZFlowAttachments - Atașamente PDF
 *     - ZFlowAttachments.addPending(file)
 *     - ZFlowAttachments.uploadPending(facturaId)
 *     - ZFlowAttachments.initDragDrop('dropzone-id', 'list-id')
 * 
 * 12. ZFlowMobile - Mobile handlers
 *     - ZFlowMobile.isMobile()
 *     - ZFlowMobile.initSwipe('#container')
 *     - ZFlowMobile.vibrate(50)
 *     - ZFlowMobile.init() // inițializează tot
 * 
 * 13. ZFlowBulk - Acțiuni în masă
 *     - ZFlowBulk.toggle() // activează modul
 *     - ZFlowBulk.toggleSelect(facturaId)
 *     - ZFlowBulk.markAsPaid() // marchează selecția ca plătită
 *     - ZFlowBulk.exportPDF()
 * 
 * 14. ZFlowANAF - Căutare ANAF
 *     - ZFlowANAF.cautaDupaCUI('12345678')
 *     - ZFlowANAF.validareCUI('12345678')
 *     - ZFlowANAF.autoComplete(cui, { denumire: 'input-id' })
 */
