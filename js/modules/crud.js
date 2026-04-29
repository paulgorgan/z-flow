// ==========================================
// OPERAȚIUNI CRUD
// ==========================================

/**
 * Logică UIT (pentru transporturi >10000)
 */
function logicUIT(v) {
    const uitBox = document.getElementById("uit-trigger-box");
    if (uitBox) uitBox.classList.toggle("hidden", Number(v) < 10000);
}

/**
 * Salvează client
 */
async function salveazaClient() {
    const _saveBtn = document.querySelector('[data-action="salveazaClient"]');
    if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, true);
    if (!hasPermission('canEdit')) {
        showNotification("Nu ai permisiunea de a edita clienți", "error");
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
        return;
    }
    const id = document.getElementById("in-client-id").value;

    const dateFirma = {
        nume_firma: document.getElementById("in-nume").value,
        cui: document.getElementById("in-cui").value,
        oras: document.getElementById("in-oras").value,
        adresa: document.getElementById("in-adresa").value,
        persoana_contact: document.getElementById("in-contact").value,
        telefon: document.getElementById("in-tel").value,
        contact_email: document.getElementById("in-email").value,
        iban: document.getElementById("in-iban").value,
        eticheta: document.getElementById("in-eticheta")?.value.trim() || null,
        categorie: document.getElementById("in-categorie")?.value.trim() || null,
    };

    // Normalizare CUI: elimina prefix RO/ro și spații
    const cuiNorm = dateFirma.cui.toString().trim().replace(/^RO/i, '').trim();
    const cuiRegex = /^\d{2,10}$/;
    if (!dateFirma.nume_firma || !cuiNorm) { showNotification('Denumirea și CUI-ul sunt obligatorii!', 'error'); if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false); return; }
    if (!cuiRegex.test(cuiNorm)) { showNotification('CUI-ul invalid: doar cifre (2-10 caractere)', 'error'); if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false); return; }
    dateFirma.cui = cuiNorm; // salvează fără prefix RO
    if (dateFirma.iban && typeof validareIBAN === 'function' && !validareIBAN(dateFirma.iban.trim())) {
        showNotification('IBAN invalid (format sau cifră de control incorectă)', 'error'); if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false); return;
    }

    // Salvare efectivă — apelată după toate confirmările opționale
    const _afterAllChecks = async () => {
        setLoader(true);
        try {
            if (id) {
                await ZFlowDB.updateClient(id, dateFirma);
            } else {
                await ZFlowDB.insertClient(dateFirma);
            }
            // [BUG-A2 FIX v75.37] Invalidează cache-ul "Client+Furnizor" după modificare CUI
            if (typeof _invalidateCuiCache === 'function') _invalidateCuiCache();
            inchideModal("modal-client");
            await init(false);
            if (id) arataDetalii(id);
        } catch (e) {
            ZFlowLogger.error('salveazaClient', e);
            showNotification('Eroare la salvare: ' + e.message, 'error');
        } finally {
            setLoader(false);
            if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(document.querySelector('[data-action="salveazaClient"]'), false);
        }
    };

    // Verificare duplicat client (doar la inserare, nu la editare)
    const _checkDuplicate = async () => {
        if (!id) {
            const numeNorm = (dateFirma.nume_firma || '').toLowerCase().trim();
            const existent = ZFlowStore.dateLocal.find(c =>
                (cuiNorm && String(c.cui || '').trim() === cuiNorm) ||
                (numeNorm && (c.nume_firma || '').toLowerCase().trim() === numeNorm)
            );
            if (existent) {
                showConfirmModal(`Clientul "${existent.nume_firma}" (CUI: ${existent.cui || '—'}) există deja!\n\nApăsați OK pentru a adăuga oricum sau Anulați.`, _afterAllChecks);
                return;
            }
        }
        await _afterAllChecks();
    };

    // Verificare email
    const _checkEmail = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (dateFirma.contact_email && !emailRegex.test(dateFirma.contact_email.trim())) {
            showConfirmModal('Email nevalid. Continuați oricum?', _checkDuplicate);
            return;
        }
        await _checkDuplicate();
    };

    // Verificare CUI
    if (typeof validareCUI === 'function' && !validareCUI(cuiNorm)) {
        showConfirmModal('CUI-ul nu trece validarea cifrei de control ANAF. Continuați oricum?', _checkEmail);
        return;
    }
    await _checkEmail();
}

/**
 * Salvează factură
 */
async function salveazaFacturaOrchestrator() {
    const _saveBtn = document.querySelector('[data-action="salveazaFacturaOrchestrator"]');
    if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, true);
    if (!hasPermission('canEdit')) {
        showNotification("Nu ai permisiunea de a edita facturi", "error");
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
        return;
    }
    const id = document.getElementById("in-fac-id").value;

    // Guard facturi importate din SAGA / ANAF
    if (id) {
        const fExist = ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(id));
        if (fExist && (fExist.is_imported || fExist.id_descarcare_anaf)) {
            showNotification("Factura este importată din SAGA/ANAF și nu poate fi modificată din aplicație", "error", 5000);
            if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
            return;
        }
    }
    const cid = document.getElementById("in-fac-client").value;
    const nr = document.getElementById("in-fac-nr").value;
    const val = document.getElementById("in-fac-val").value;
    const de = document.getElementById("in-fac-emisie").value;
    const ds = document.getElementById("in-fac-scad").value;
    const auto = document.getElementById("in-auto").value;
    const uit = document.getElementById("in-uit")?.value?.trim() || "";
    const note = document.getElementById("in-fac-note")?.value || "";
    const cotaTvaFac = parseInt(document.getElementById('in-fac-cota-tva')?.value ?? (window.ZFlowStore?.userProfile?.cota_tva_default ?? 21)); // [v75.0]
    const fileInput = document.getElementById("in-fac-file");

    if (!cid || !nr || !val) { showNotification('Selectează clientul, seria și suma!', 'error'); if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false); return; }

    // Verificare duplicat factură client (doar la inserare, nu la editare)
    if (!id && nr) {
        const dupFac = ZFlowStore.dateFacturiBI.find(f =>
            String(f.client_id) === String(cid) &&
            String(f.numar_factura || '').trim().toLowerCase() === String(nr).trim().toLowerCase()
        );
        if (dupFac) {
            showNotification(`Factura "${nr}" există deja pentru acest client! Verificați numerotarea.`, 'warning', 6000);
            if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
            return;
        }
    }

    let newUrls = []; // declarat înainte de try pentru a fi accesibil în catch (PDF orfane)
    setLoader(true);
    try {
        // #23 - Upload toate fișierele pending
        if (pendingPDFFiles.length > 0) {
            for (let i = 0; i < pendingPDFFiles.length; i++) {
                const uploadedUrl = await ZFlowDB.uploadFacturaPDF(pendingPDFFiles[i], nr, i);
                if (uploadedUrl) newUrls.push(uploadedUrl);
            }
        }

        const payload = {
            client_id: cid,
            numar_factura: nr,
            valoare: parseFloat(val),
            cota_tva: cotaTvaFac, // [v75.0]
            data_emiterii: de || new Date().toISOString().split("T")[0],
            data_scadenta: ds,
            numar_auto: auto,
            uit_code: uit || null,
            note: note.trim() || null,
        };

        // Salvează URL-urile: îmbină cele existente cu cele noi (#23)
        if (newUrls.length > 0) {
            const facExistenta = id ? ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(id)) : null;
            const existingUrls = facExistenta ? _getPDFUrls(facExistenta) : [];
            const allUrls = [...existingUrls, ...newUrls];
            payload.pdf_url = allUrls.length === 1 ? allUrls[0] : JSON.stringify(allUrls);
        }
        // Dacă 0 fișiere noi → nu atingem pdf_url existent (la editare rămâne intact)

        if (id) {
            await ZFlowDB.updateFactura(id, payload);
        } else {
            payload.status_plata = "Neincasat";
            await ZFlowDB.insertFactura(payload, true);
        }

        fileInput.value = "";
        pendingPDFFiles = []; // #23 - reset dupa salvare
        inchideModal("modal-factura");
        // Corelare Financiar <-> Depozit: ofera bon iesire dupa salvarea facturii client (doar pt. noi)
        if (!id) showCorrelationPrompt('livrare', { obs: nr ? 'Ref. factura ' + nr : '' });
        await init(false);
        if (cid) arataDetalii(cid);
    } catch (err) {
        if (newUrls.length > 0) ZFlowLogger.warn('salveazaFacturaOrchestrator', 'PDF orfane — fișiere urcate dar factura neînregistrată', newUrls);
        ZFlowLogger.error('salveazaFacturaOrchestrator', err);
        showNotification('Eroare la salvare: ' + err.message, 'error');
    } finally {
        setLoader(false);
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(document.querySelector('[data-action="salveazaFacturaOrchestrator"]'), false);
    }
}

/**
 * Toggle status plată factură
 */
async function toggleStatusPlata(id, currentStatus) {
    const f = ZFlowStore.dateFacturiBI.find((x) => String(x.id) === String(id));

    if (f && (f.is_imported || f.id_descarcare_anaf)) {
        return showNotification('Factură importată din SAGA/ANAF — nu poate fi modificată', 'warning');
    }

    const noulStatus = currentStatus === "Incasat" ? "Neincasat" : "Incasat";

    const doToggle = async () => {
        const updatePayload = {
            status_plata: noulStatus,
            data_plata: noulStatus === "Incasat" ? new Date().toISOString().split("T")[0] : null
        };
        setLoader(true);
        try {
            await ZFlowDB.updateFactura(id, updatePayload);
            await init();
            saveZFlowData();
            if (f) arataDetalii(f.client_id);
        } catch (err) {
            ZFlowLogger.error('toggleStatusPlata', err);
            showNotification(err.message, 'error');
        } finally {
            setLoader(false);
        }
    };

    if (noulStatus === "Incasat") {
        showConfirmModal(
            "Atenție: Această aplicație este un instrument de suport. Marcând factura ca ACHITATĂ, datele pot diferi față de programul de contabilitate (Saga sau alt soft). Continui?",
            doToggle
        );
    } else {
        await doToggle();
    }
}

// ==========================================
// MODAL CONFIRMARE STYLED
// ==========================================
let confirmCallback = null;

/**
 * Afișează modal de confirmare styled
 */
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("modal-confirm");
    const msgEl = document.getElementById("confirm-message");
    const btnConfirm = document.getElementById("btn-confirm-action");
    
    if (msgEl) msgEl.innerText = message;
    confirmCallback = onConfirm;
    
    // Reset și setează handler
    if (btnConfirm) {
        btnConfirm.onclick = async () => {
            if (navigator.vibrate) navigator.vibrate(50);
            if (confirmCallback) {
                await confirmCallback();
                confirmCallback = null;
            }
            inchideModalConfirm();
        };
    }
    
    if (modal) modal.classList.add("active");
}

/**
 * Închide modal confirmare
 */
function inchideModalConfirm() {
    const modal = document.getElementById("modal-confirm");
    if (modal) modal.classList.remove("active");
    confirmCallback = null;
}

/**
 * Șterge factură
 */
async function stergeFactura(id) {
    if (!hasPermission('canDelete')) {
        showNotification("Nu ai permisiunea de a șterge facturi", "error");
        return;
    }
    // Guard facturi importate din SAGA / ANAF
    const fExist = ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(id));
    if (fExist && (fExist.is_imported || fExist.id_descarcare_anaf)) {
        showNotification("Factura este importată din SAGA/ANAF și nu poate fi ștearsă din aplicație", "error", 5000);
        return;
    }
    showConfirmModal("Ștergi factura definitiv? Această acțiune nu poate fi anulată.", async () => {
        const _backupPtUndo = { ...(ZFlowStore.dateFacturiBI?.find(x => String(x.id) === String(id)) || {}) };
        await ZFlowDB.deleteFactura(id);
        init();
        comutaVedereFin("firme");
        if (typeof showNotificationWithUndo === 'function') showNotificationWithUndo('Factură ștearsă.', () => { if (_backupPtUndo.id) ZFlowDB.insertFactura(_backupPtUndo).then(() => init()).catch(() => {}); });
        else showNotification('Factură ștearsă', 'success');
        if (navigator.vibrate) navigator.vibrate([30, 15, 30]);
    });
}

/**
 * Șterge client
 */
async function stergeFirma(id) {
    if (!hasPermission('canDelete')) {
        showNotification("Nu ai permisiunea de a șterge clienți", "error");
        return;
    }
    showConfirmModal("Ștergi clientul definitiv? Toate facturile asociate vor fi orfane.", async () => {
        const _backupPtUndo = { ...(ZFlowStore.dateLocal?.find(x => String(x.id) === String(id)) || {}) };
        await ZFlowDB.deleteClient(id);
        // [BUG-A2 FIX v75.37] Invalidează cache-ul badge "Client+Furnizor" după ștergere client
        if (typeof _invalidateCuiCache === 'function') _invalidateCuiCache();
        init(false);
        comutaVedereFin("firme");
        if (typeof showNotificationWithUndo === 'function') showNotificationWithUndo('Client șters.', () => { if (_backupPtUndo.id) ZFlowDB.insertClient(_backupPtUndo).then(() => init(false)).catch(() => {}); });
        else showNotification('Client șters', 'success');
        if (navigator.vibrate) navigator.vibrate([30, 15, 30]);
    });
}


// ==========================================
// EMAIL & PRINT
// ==========================================

/**
 * Trimite email debitor
 */
function trimiteEmailDebitor(email, nr, suma) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || email === "undefined" || email === "null" || !emailRegex.test(email)) {
        showNotification('Adresa de email nu este validă!', 'error');
        return;
    }
    const subiect = encodeURIComponent(`Notificare plată factură nr. ${nr}`);
    const corp = encodeURIComponent(`Bună ziua,\n\nVă reamintim de plata facturii nr. ${nr} în valoare de ${suma} RON.\n\nVă mulțumim!`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subiect}&body=${corp}`, "_blank");
}

/**
 * Trimite reminder WhatsApp - generează link direct cu mesaj pre-definit
 * #30 TODO - WhatsApp notificări
 */
function trimiteWhatsAppReminder(telefon, numeClient, nrFactura, suma, dataScadenta) {
    // Validare număr telefon
    if (!telefon || telefon === "undefined" || telefon === "null" || telefon.trim() === "") {
        showNotification("Clientul nu are număr de telefon configurat", "warning");
        return;
    }
    
    // Curăță numărul de telefon (elimină spații, paranteze, liniițe)
    let telefonCurat = telefon.replace(/[\s\-\(\)\.]/g, "");
    
    // Adăugare prefix România dacă lipsește
    if (telefonCurat.startsWith("07")) {
        telefonCurat = "40" + telefonCurat.substring(1); // 07xx -> 407xx
    } else if (telefonCurat.startsWith("0")) {
        telefonCurat = "40" + telefonCurat.substring(1);
    } else if (!telefonCurat.startsWith("40") && !telefonCurat.startsWith("+")) {
        telefonCurat = "40" + telefonCurat;
    }
    
    // Elimină "+" dacă există (WhatsApp API nu are nevoie)
    telefonCurat = telefonCurat.replace("+", "");
    
    // Formatează data scadenței
    const dataFormatata = dataScadenta ? formateazaDataZFlow(dataScadenta) : "necunoscută";
    
    // Compune mesajul
    const mesaj = `Bună ziua,

Vă contactăm pentru factura nr. *${nrFactura}* în valoare de *${Number(suma).toLocaleString()} lei*.

Scadența: ${dataFormatata}

Vă rugăm să efectuați plata cât mai curând posibil.

Mulțumim!
_Z-FLOW Enterprise_`;
    
    const mesajEncodat = encodeURIComponent(mesaj);
    const whatsappUrl = `https://wa.me/${telefonCurat}?text=${mesajEncodat}`;
    
    // Deschide WhatsApp (web sau app nativ)
    window.open(whatsappUrl, "_blank");
    showNotification(`WhatsApp deschis pentru ${numeClient}`, "success");
}

/**
 * Partajează factura via Web Share API (nativ pe mobil)
 * Fallback: copiere în clipboard pe desktop
 * #36 - Share API nativ
 */
async function trimiteShareFactura(facturaId) {
    const fac = ZFlowStore.dateFacturiBI.find(f => String(f.id) === String(facturaId));
    if (!fac) return;
    const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(fac.client_id));
    const numeClient = client?.nume_firma || 'Client necunoscut';
    const dataScadFormatat = fac.data_scadenta ? formateazaDataZFlow(fac.data_scadenta) : 'N/A';
    const valoareFormatata = Number(fac.valoare).toLocaleString('ro-RO', { minimumFractionDigits: 2 });

    const shareText = `Factură nr. ${fac.numar_factura}\nClient: ${numeClient}\nValoare: ${valoareFormatata} lei\nScadență: ${dataScadFormatat}\nStatus: ${fac.status_plata === 'Incasat' ? '✅ Încasat' : '⏳ Neîncasat'}`;

    if (navigator.share) {
        try {
            const shareData = {
                title: `Z-FLOW · Factură ${fac.numar_factura}`,
                text: shareText,
            };
            const pdfUrls = _getPDFUrls(fac);
            if (pdfUrls.length > 0) shareData.url = pdfUrls[0];
            await navigator.share(shareData);
            if (navigator.vibrate) navigator.vibrate(30);
        } catch (err) {
            if (err.name !== 'AbortError') {
                showNotification('Eroare la partajare', 'error');
            }
        }
    } else {
        // Fallback clipboard pentru desktop
        try {
            await navigator.clipboard.writeText(shareText);
            showNotification('Detalii factură copiate în clipboard!', 'success');
        } catch (e) {
            showNotification('Partajarea nu este suportată pe acest dispozitiv.', 'warning');
        }
    }
}

/**
 * Print factură
 */
function printInvoice(id) {
    try {
        const invoice = ZFlowStore.dateFacturiBI.find(f => String(f.id) === String(id));
        const client = ZFlowStore.dateLocal.find(c => String(c.id) === String(invoice?.client_id));

        if (!invoice || !client) {
            showNotification('Factură nu a fost găsită!', 'error');
            return;
        }

        const w = window.open("", "Print");
        const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const buildVer = (typeof window.ZFLOW_BUILD !== 'undefined') ? window.ZFLOW_BUILD : '';
        w.document.write("<h1>Z-FLOW Enterprise " + esc(buildVer) + "</h1>");
        w.document.write("<hr>");
        w.document.write("<h2>Factură #" + esc(invoice.numar_factura) + "</h2>");
        w.document.write("<p><strong>Client:</strong> " + esc(client.nume_firma) + "</p>");
        w.document.write("<p><strong>CUI:</strong> " + esc(client.cui) + "</p>");
        w.document.write("<p><strong>Data Emiterii:</strong> " + esc(invoice.data_emiterii || "-") + "</p>");
        w.document.write("<p><strong>Data Scadenței:</strong> " + esc(invoice.data_scadenta || "-") + "</p>");
        w.document.write("<p><strong>Status Plată:</strong> " + esc(invoice.status_plata) + "</p>");
        w.document.write("<hr>");
        w.document.write("<table border='1' cellpadding='10' style='width:100%;'>");
        w.document.write("<tr><th>Descriere</th><th style='text-align:right;'>Valoare (RON)</th></tr>");
        w.document.write("<tr><td>Servicii prestate</td><td style='text-align:right;'>" + Number(invoice.valoare || 0).toLocaleString() + "</td></tr>");
        w.document.write("</table>");
        w.document.write("<hr>");
        w.document.write("<h3 style='text-align:right;'>Total: " + Number(invoice.valoare || 0).toLocaleString() + " RON</h3>");
        w.document.write("<p style='font-size:10px; color:#999;'>Document generat electronic din Z-FLOW Enterprise</p>");
        w.document.write("<p style='font-size:10px; color:#999;'>Data: " + new Date().toLocaleDateString() + "</p>");
        w.print();
        w.close();
    } catch (err) {
        ZFlowLogger.error('printInvoice', err);
        showNotification('Eroare la print: ' + err.message, 'error');
    }
}

/**
 * Salvează factură de plătit (furnizor)
 */
async function salveazaFacturaPlatit() {
    const _saveBtn = document.querySelector('[data-action="salveazaFacturaPlatit"]');
    if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, true);
    const id = document.getElementById("in-fp-id")?.value.trim();
    const furnizorId = document.getElementById("in-fp-furnizor")?.value.trim() ||
                       document.getElementById("in-fp-furnizor-id")?.value.trim();
    const val = parseFloat(document.getElementById("in-fp-val")?.value) || 0;

    if (!furnizorId) { showNotification("Selectează furnizorul", "error"); if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false); return; }
    if (val <= 0) { showNotification("Completează valoarea facturii", "error"); if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false); return; }

    const nrFurnizor = document.getElementById("in-fp-nr")?.value.trim() || null;
    const cotaTvaFp = parseInt(document.getElementById('in-fp-cota-tva')?.value ?? (window.ZFlowStore?.userProfile?.cota_tva_default ?? 21)); // [v75.0]
    if (!id && nrFurnizor) {
        const dupFP = ZFlowStore.dateFacturiPlatit.find(f =>
            String(f.furnizor_id) === String(furnizorId) &&
            String(f.numar_factura || '').trim().toLowerCase() === String(nrFurnizor).trim().toLowerCase()
        );
        if (dupFP) {
            showNotification(`Factura "${escapeHtml(nrFurnizor)}" există deja pentru acest furnizor!`, 'warning', 6000);
            if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(_saveBtn, false);
            return;
        }
    }

    setLoader(true);
    try {
        const payload = {
            furnizor_id: furnizorId,
            numar_factura: nrFurnizor,
            valoare: val,
            cota_tva: cotaTvaFp, // [v75.0]
            data_emiterii: document.getElementById("in-fp-emisie")?.value || null,
            data_scadenta: document.getElementById("in-fp-scad")?.value || null,
            note: document.getElementById("in-fp-note")?.value.trim() || null,
            status_plata: id
                ? ((ZFlowStore.dateFacturiPlatit || []).find(f => String(f.id) === String(id))?.status_plata || 'Neplatit')
                : 'Neplatit',
            updated_at: new Date().toISOString()
        };

        if (id) {
            await ZFlowDB.updateFacturaPlatit(id, payload);
            const fpIdx = (ZFlowStore.dateFacturiPlatit || []).findIndex(f => String(f.id) === String(id));
            if (fpIdx !== -1) ZFlowStore.dateFacturiPlatit[fpIdx] = { ...ZFlowStore.dateFacturiPlatit[fpIdx], ...payload };
            showNotification("Factură actualizată!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        } else {
            const newId = await ZFlowDB.insertFacturaPlatit(payload);
            ZFlowStore.dateFacturiPlatit = [
                { ...payload, id: newId || ('tmp_' + Date.now()), created_at: new Date().toISOString() },
                ...(ZFlowStore.dateFacturiPlatit || [])
            ];
            showNotification("Factură adăugată!", "success");
            if (typeof ZFlowMobile !== 'undefined') ZFlowMobile.vibrate(30);
        }

        inchideModal("modal-factura-platit");
        if (!id) showCorrelationPrompt('intrare', { obs: payload.numar_factura ? 'Ref. factura ' + payload.numar_factura : '' });
        if (typeof _recomputeFurnizoriData === 'function') _recomputeFurnizoriData();
        if (typeof renderFurnizoriThrottled === 'function') renderFurnizoriThrottled();
        if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
        if (typeof invalidateCashflowCache === 'function') invalidateCashflowCache();
        if (typeof incarcaDashboard === 'function') incarcaDashboard();
        if (ZFlowStore.selectedFurnizorId && typeof arataDetaliiFurnizor === 'function') arataDetaliiFurnizor(ZFlowStore.selectedFurnizorId);
    } catch (err) {
        ZFlowLogger.error("crud", "salveazaFacturaPlatit eșuat", err);
        showNotification("Eroare: " + err.message, "error");
    } finally {
        setLoader(false);
        if (typeof ZFlowUI !== 'undefined') ZFlowUI.setButtonLoading(document.querySelector('[data-action="salveazaFacturaPlatit"]'), false);
    }
}

/**
 * Șterge factură de plătit
 */
async function stergeFacturaPlatit(id) {
    if (!id) {
        id = document.getElementById("in-fp-id")?.value;
        if (!id) return;
    }
    const _facImportCheck = (ZFlowStore.dateFacturiPlatit || []).find(f => String(f.id) === String(id));
    if (_facImportCheck && _facImportCheck.is_imported) {
        showNotification("Factura este importată din SAGA/ANAF și nu poate fi ștearsă din aplicație", "warning");
        return;
    }
    if (!hasPermission('canDelete')) {
        showNotification("Nu ai permisiunea de a șterge facturi", "error");
        return;
    }
    showConfirmModal("Ștergi această factură de plătit?", async () => {
        setLoader(true);
        try {
            await ZFlowDB.deleteFacturaPlatit(id);
            inchideModal("modal-factura-platit");
            ZFlowStore.dateFacturiPlatit = (ZFlowStore.dateFacturiPlatit || []).filter(f => String(f.id) !== String(id));
            if (typeof _recomputeFurnizoriData === 'function') _recomputeFurnizoriData();
            if (typeof renderFurnizoriThrottled === 'function') renderFurnizoriThrottled();
            if (typeof updateFurnizoriKPI === 'function') updateFurnizoriKPI();
            if (typeof invalidateCashflowCache === 'function') invalidateCashflowCache();
            if (typeof incarcaDashboard === 'function') incarcaDashboard();
            if (ZFlowStore.selectedFurnizorId && typeof arataDetaliiFurnizor === 'function') arataDetaliiFurnizor(ZFlowStore.selectedFurnizorId);
            showNotification("Factură ștearsă!", "success");
            if (navigator.vibrate) navigator.vibrate([30, 15, 30]);
        } catch (err) {
            ZFlowLogger.error("crud", "stergeFacturaPlatit eșuat", err);
            showNotification("Eroare: " + err.message, "error");
        } finally {
            setLoader(false);
        }
    });
}


// ==========================================
// EXPORTS — crud.js
// ==========================================
window.salveazaClient = salveazaClient;
window.salveazaFacturaOrchestrator = salveazaFacturaOrchestrator;
window.toggleStatusPlata = toggleStatusPlata;
window.stergeFactura = stergeFactura;
window.stergeFirma = stergeFirma;
window.salveazaFacturaPlatit = salveazaFacturaPlatit;
window.stergeFacturaPlatit = stergeFacturaPlatit;
window.showConfirmModal = showConfirmModal;
window.inchideModalConfirm = inchideModalConfirm;
window.deschideModalConfirm = showConfirmModal;
window.trimiteEmailDebitor = trimiteEmailDebitor;
window.trimiteWhatsAppReminder = trimiteWhatsAppReminder;
window.trimiteShareFactura = trimiteShareFactura;
window.printInvoice = printInvoice;
