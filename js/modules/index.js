/**
 * Z-FLOW Enterprise v7.14
 * Module Index - Încarcă toate modulele într-o ordine corectă
 * 
 * ⚠️ ATENȚIE: Acest fișier este OPȚIONAL.
 * Aplicația funcționează perfect și fără aceste module.
 * Modulele sunt suplimentare și pot fi folosite gradual.
 * 
 * Pentru a folosi modulele, include acest script în index.html
 * DUPĂ app.js:
 * 
 * <script src="js/modules/index.js" type="module"></script>
 * 
 * SAU include fiecare modul individual:
 * <script src="js/modules/utils.js"></script>
 * <script src="js/modules/ui.js"></script>
 * etc.
 */

// Verifică dacă modulele sunt deja încărcate (evită dubluri)
if (typeof window.ZFlowModulesLoaded === 'undefined') {
    window.ZFlowModulesLoaded = true;
    
    console.log('🧩 Se încarcă modulele Z-FLOW...');
    
    // Lista modulelor în ordinea de încărcare
    const modules = [
        'utils',
        'auth',
        'ui',
        'clients',
        'suppliers',
        'invoices',
        'analytics',
        'export',
        'import',
        'notifications',
        'attachments',
        'mobile',
        'bulk',
        'anaf'
    ];
    
    // Funcție pentru încărcare dinamică
    async function loadModules() {
        const basePath = 'js/modules/';
        let loaded = 0;
        
        for (const mod of modules) {
            try {
                const script = document.createElement('script');
                script.src = `${basePath}${mod}.js`;
                script.async = false;
                document.head.appendChild(script);
                loaded++;
            } catch (e) {
                console.warn(`⚠️ Nu s-a putut încărca modulul ${mod}:`, e);
            }
        }
        
        console.log(`✅ ${loaded}/${modules.length} module Z-FLOW încărcate`);
    }
    
    // Încarcă la DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadModules);
    } else {
        loadModules();
    }
}

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
