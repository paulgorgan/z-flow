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
    if (!hasPermission('canEdit')) {
        showNotification("Nu ai permisiunea de a edita clienți", "error");
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
    };

    // Normalizare CUI: elimina prefix RO/ro și spații
    const cuiNorm = dateFirma.cui.toString().trim().replace(/^RO/i, '').trim();
    const cuiRegex = /^\d{2,10}$/;
    if (!dateFirma.nume_firma || !cuiNorm) return alert("Denumirea și CUI-ul sunt obligatorii!");
    if (!cuiRegex.test(cuiNorm)) return alert("CUI-ul invalid: doar cifre (2-10 caractere)");
    dateFirma.cui = cuiNorm; // salvează fără prefix RO
    if (typeof validareCUI === 'function' && !validareCUI(cuiNorm)) {
        if (!confirm("CUI-ul nu trece validarea cifrei de control ANAF. Continuați oricum?")) return;
    }
    if (dateFirma.iban && typeof validareIBAN === 'function' && !validareIBAN(dateFirma.iban.trim())) {
        showNotification('IBAN invalid (format sau cifră de control incorectă)', 'error'); return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (dateFirma.contact_email && !emailRegex.test(dateFirma.contact_email.trim())) {
        if (!confirm("Email nevalid. Continuați oricum?")) return;
    }

    // Verificare duplicat client (doar la inserare, nu la editare)
    if (!id) {
        const cuiNorm = (dateFirma.cui || '').toString().trim();
        const numeNorm = (dateFirma.nume_firma || '').toLowerCase().trim();
        const existent = ZFlowStore.dateLocal.find(c =>
            (cuiNorm && String(c.cui || '').trim() === cuiNorm) ||
            (numeNorm && (c.nume_firma || '').toLowerCase().trim() === numeNorm)
        );
        if (existent) {
            const continua = confirm(`Clientul "${existent.nume_firma}" (CUI: ${existent.cui || '—'}) există deja!\n\nApăsați OK pentru a adăuga oricum sau Anulați.`);
            if (!continua) return;
        }
    }

    setLoader(true);
    try {
        if (id) {
            await ZFlowDB.updateClient(id, dateFirma);
        } else {
            await ZFlowDB.insertClient(dateFirma);
        }

        inchideModal("modal-client");
        await init(false);
        if (id) arataDetalii(id);
    } catch (e) {
        console.error("Eroare Supabase:", e);
        alert("Eroare Schema: " + e.message);
    } finally {
        setLoader(false);
    }
}

/**
 * Salvează factură
 */
async function salveazaFacturaOrchestrator() {
    if (!hasPermission('canEdit')) {
        showNotification("Nu ai permisiunea de a edita facturi", "error");
        return;
    }
    const id = document.getElementById("in-fac-id").value;

    // Guard facturi importate din SAGA / ANAF
    if (id) {
        const fExist = ZFlowStore.dateFacturiBI.find(x => String(x.id) === String(id));
        if (fExist && (fExist.is_imported || fExist.id_descarcare_anaf)) {
            showNotification("Factura este importată din SAGA/ANAF și nu poate fi modificată din aplicație", "error", 5000);
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
    const fileInput = document.getElementById("in-fac-file");

    if (!cid || !nr || !val) return alert("Selectează clientul, seria și suma!");

    // Verificare duplicat factură client (doar la inserare, nu la editare)
    if (!id && nr) {
        const dupFac = ZFlowStore.dateFacturiBI.find(f =>
            String(f.client_id) === String(cid) &&
            String(f.numar_factura || '').trim().toLowerCase() === String(nr).trim().toLowerCase()
        );
        if (dupFac) {
            showNotification(`Factura "${nr}" există deja pentru acest client! Verificați numerotarea.`, 'warning', 6000);
            return;
        }
    }

    setLoader(true);
    try {
        // #23 - Upload toate fișierele pending
        let newUrls = [];
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
            await ZFlowDB.insertFactura(payload);
        }

        fileInput.value = "";
        pendingPDFFiles = []; // #23 - reset dupa salvare
        inchideModal("modal-factura");
        // Corelare Financiar <-> Depozit: ofera bon iesire dupa salvarea facturii client (doar pt. noi)
        if (!id) showCorrelationPrompt('livrare', { obs: nr ? 'Ref. factura ' + nr : '' });
        await init();
        if (cid) arataDetalii(cid);
    } catch (err) {
        console.error("Eroare salvare:", err);
        alert("Eroare: " + err.message);
    } finally {
        setLoader(false);
    }
}

/**
 * Toggle status plată factură
 */
async function toggleStatusPlata(id, currentStatus) {
    const f = ZFlowStore.dateFacturiBI.find((x) => String(x.id) === String(id));

    if (f && (f.is_imported || f.id_descarcare_anaf)) {
        return alert("SAGA factură - Nu poate fi modificată");
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
            alert(err.message);
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
        await ZFlowDB.deleteFactura(id);
        init();
        comutaVedereFin("firme");
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
        await ZFlowDB.deleteClient(id);
        init(false);
        comutaVedereFin("firme");
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
        return alert("Eroare: Adresa de email nu este validă!");
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
            alert("Factură nu a fost găsită!");
            return;
        }

        const w = window.open("", "Print");
        w.document.write("<h1>Z-FLOW Enterprise v7.14</h1>");
        w.document.write("<hr>");
        w.document.write("<h2>Factură #" + invoice.numar_factura + "</h2>");
        w.document.write("<p><strong>Client:</strong> " + client.nume_firma + "</p>");
        w.document.write("<p><strong>CUI:</strong> " + client.cui + "</p>");
        w.document.write("<p><strong>Data Emiterii:</strong> " + (invoice.data_emiterii || "-") + "</p>");
        w.document.write("<p><strong>Data Scadenței:</strong> " + (invoice.data_scadenta || "-") + "</p>");
        w.document.write("<p><strong>Status Plată:</strong> " + invoice.status_plata + "</p>");
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
        console.error("Eroare print:", err);
        alert("Eroare la print: " + err.message);
    }
}


// ==========================================
// EXPORTS — crud.js
// ==========================================
window.salveazaClient = salveazaClient;
window.salveazaFacturaOrchestrator = salveazaFacturaOrchestrator;
window.toggleStatusPlata = toggleStatusPlata;
window.stergeFactura = stergeFactura;
window.stergeFirma = stergeFirma;
window.showConfirmModal = showConfirmModal;
window.inchideModalConfirm = inchideModalConfirm;
window.deschideModalConfirm = showConfirmModal;
window.trimiteEmailDebitor = trimiteEmailDebitor;
window.trimiteWhatsAppReminder = trimiteWhatsAppReminder;
window.trimiteShareFactura = trimiteShareFactura;
window.printInvoice = printInvoice;
