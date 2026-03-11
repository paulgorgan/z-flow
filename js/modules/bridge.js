/**
 * Z-FLOW Enterprise — Modul Bridge Import/Export
 * ================================================
 * Export XML pentru SAGA, WinMentor, SmartBill.
 * Import XML din SAGA (parsing intrari contabile).
 *
 * Expus global ca: window.ZFlowBridge
 */

// ── Re-exporta functiile existente din features.js ───────
// exportBridgeXML si _escXML sunt deja definite in features.js
// Acest modul adauga IMPORTUL din SAGA XML

/**
 * Parseaza un fisier XML exportat din SAGA si returneaza
 * array de facturi normalizate in formatul canonic Z-FLOW.
 *
 * @param {File} file - Fisierul XML selectat de utilizator
 * @returns {Promise<Array<{numar_factura, valoare, data_emiterii, data_scadenta, descriere, client_cui}>>}
 */
async function importDinSAGAXML(file) {
    if (!file || !file.name.endsWith('.xml')) {
        throw new Error('Selecteaza un fisier XML exportat din SAGA');
    }

    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('XML invalid: ' + parseError.textContent.slice(0, 100));

    // Suport pentru ambele formate: ZFlowExport si SAGA nativ
    const isZFlow = doc.querySelector('ZFlowExport') !== null;
    const isSAGA  = doc.querySelector('jurnal, Jurnal, factura, Factura') !== null;

    if (!isZFlow && !isSAGA) {
        throw new Error('Format XML nerecunoscut. Suportat: ZFlow Export sau SAGA XML.');
    }

    const facturi = [];

    if (isZFlow) {
        // Format ZFlow export propriu
        doc.querySelectorAll('FacturiIncasare Factura, FacturiPlata Factura').forEach(function(node) {
            var get = function(tag) {
                var el = node.querySelector(tag);
                return el ? (el.textContent || '').trim() : '';
            };
            facturi.push({
                numar_factura: get('NrFactura'),
                valoare:       parseFloat(get('Suma')) || 0,
                data_emiterii: get('DataEmitere'),
                data_scadenta: get('DataScadenta'),
                descriere:     get('Descriere'),
                client_cui:    get('Client CUI') || get('Furnizor CUI'),
                client_nume:   get('Client Denumire') || get('Furnizor Denumire'),
                uit:           get('UIT'),
            });
        });
    } else {
        // Format SAGA — campuri specifice SAGA Accounting
        var nodes = doc.querySelectorAll('factura, Factura, document, Document');
        nodes.forEach(function(node) {
            var get = function() {
                for (var i = 0; i < arguments.length; i++) {
                    var el = node.querySelector(arguments[i]);
                    if (el) {
                        var val = (el.textContent || '').trim();
                        if (val) return val;
                    }
                }
                return '';
            };
            var valBruta = parseFloat(get('total', 'valoare_totala', 'suma_totala')) || 0;
            var tva = parseFloat(get('tva', 'valoare_tva')) || 0;
            facturi.push({
                numar_factura: get('nrdoc', 'nr_document', 'numar'),
                valoare:       valBruta || (parseFloat(get('valoare', 'suma')) + tva),
                data_emiterii: get('data', 'data_document', 'data_emitere'),
                data_scadenta: get('data_scadenta', 'scadenta', 'data_plata'),
                descriere:     get('descriere', 'denumire', 'explicatie'),
                client_cui:    get('cui_partener', 'cui', 'cod_fiscal'),
                client_nume:   get('partener', 'denumire_partener', 'client'),
            });
        });
    }

    return facturi.filter(function(f) { return f.numar_factura || f.valoare; });
}

/**
 * Deschide dialogul de import SAGA XML si proceseaza fisierul selectat.
 * Afiseaza un preview al facturilor inainte de import definitiv.
 */
function deschideImportBridgeXML() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        setLoader(true);
        try {
            var facturi = await importDinSAGAXML(file);
            if (!facturi.length) {
                showNotification('Nu au fost gasite facturi in fisierul XML', 'warning');
                return;
            }
            var preview = facturi.slice(0, 3).map(function(f) {
                return f.numar_factura + ' — ' + f.valoare + ' RON (' + f.data_emiterii + ')';
            }).join('\n');
            var total = facturi.length;
            showNotification(
                total + ' facturi gasite in XML. Primele 3:\n' + preview + '\n\nFoloseste consolele de import pentru a le procesa.',
                'info',
                6000
            );
            // Stocheaza temporar in store pentru procesare ulterioara
            window._bridgeImportQueue = facturi;
            if (window.ZFlowLogger && typeof ZFlowLogger.info === 'function') {
                ZFlowLogger.info('Bridge', 'Import XML: ' + total + ' facturi din ' + file.name);
            }
        } catch (err) {
            showNotification('Eroare import XML: ' + err.message, 'error');
            if (window.ZFlowLogger && typeof ZFlowLogger.error === 'function') {
                ZFlowLogger.error('Bridge', 'importDinSAGAXML failed', err);
            }
        } finally {
            setLoader(false);
        }
    };
    input.click();
}

/** @namespace ZFlowBridge */
window.ZFlowBridge = {
    importDinSAGAXML,
    deschideImportBridgeXML,
    exportBridgeXML: typeof exportBridgeXML === 'function' ? exportBridgeXML : null,
};

window.deschideImportBridgeXML = deschideImportBridgeXML;
