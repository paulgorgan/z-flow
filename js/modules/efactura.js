/**
 * Z-FLOW Enterprise — Modul e-Factura ANAF
 * ==========================================
 * Generare XML UBL 2.1 conform specificatiei ANAF e-Factura v1.0.3
 * si trimitere/verificare prin Supabase Edge Function 'anaf-efactura'.
 *
 * API public:
 *   ZFlowEFactura.genereazaXML(factura, client, profil) -> string XML
 *   ZFlowEFactura.trimiteLaANAF(facturaId)              -> { success, uploadIndex, errors }
 *   ZFlowEFactura.verificaStatus(facturaId)             -> { status, mesaje }
 *   ZFlowEFactura.afiseazaBifaVerde(facturaId)          -> void
 *
 * Expus global ca: window.ZFlowEFactura
 */

// =========================================================
// CONSTANTE UBL 2.1 — namespace-uri oficiale ANAF
// =========================================================
const UBL_NAMESPACES = `xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 UBL-Invoice-2.1.xsd"`;

/** Tabela cote TVA valide conform ANAF */
const TVA_RATE_MAP = {
    0:  { categorie: 'Z', motiv: 'Zero rated' },
    5:  { categorie: 'S', motiv: null },
    9:  { categorie: 'S', motiv: null },
    19: { categorie: 'S', motiv: null },
};

/** Escapeaza entitati XML */
function _esc(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** Formateaza data la YYYY-MM-DD */
function _data(s) {
    if (!s) return new Date().toISOString().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
    return s;
}

/** Rotunjeste la 2 zecimale */
function _nr(v) { return (parseFloat(v) || 0).toFixed(2); }

// =========================================================
// GENERARE XML UBL 2.1
// =========================================================

/**
 * Genereaza un document XML UBL 2.1 conform ANAF e-Factura v1.0.3.
 *
 * @param {Object} factura - Obiect factura din ZFlowStore (campuri canonice)
 * @param {Object} client  - Obiect client din tabela clienti
 * @param {Object} profil  - Profilul firmei emitente (ZFlowStore.userProfile)
 * @returns {string} XML complet ca string UTF-8
 */
function genereazaXML(factura, client, profil) {
    if (!factura || !client || !profil) {
        throw new Error('[e-Factura] factura, client si profil sunt obligatorii');
    }

    const valoare      = parseFloat(factura.valoare || 0);
    const cotaTVA      = parseInt(factura.cota_tva != null ? factura.cota_tva : (factura.tva_procent != null ? factura.tva_procent : 19));
    const esteNeplatitor = factura.neplatitor_tva || profil.neplatitor_tva || false;

    // Calcule TVA
    let valFaraTVA, valTVA, valTotal;
    if (esteNeplatitor || cotaTVA === 0) {
        // Factura fara TVA sau cota 0
        valFaraTVA = valoare;
        valTVA     = 0;
        valTotal   = valoare;
    } else {
        // valoare din store = suma cu TVA inclus (conventia Z-FLOW)
        valFaraTVA = valoare / (1 + cotaTVA / 100);
        valTVA     = valoare - valFaraTVA;
        valTotal   = valoare;
    }

    const tvaInfo = esteNeplatitor
        ? { categorie: 'O', motiv: 'Not subject to VAT' }
        : (TVA_RATE_MAP[cotaTVA] || TVA_RATE_MAP[19]);

    // ID unic factura: numar_factura sau fallback UUID
    const idFactura = _esc(factura.numar_factura || factura.id || 'ZF-' + Date.now());

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice ${UBL_NAMESPACES}>

  <!-- ── Antet ─────────────────────────────────────────── -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.3</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${idFactura}</cbc:ID>
  <cbc:IssueDate>${_data(factura.data_emiterii)}</cbc:IssueDate>
  <cbc:DueDate>${_data(factura.data_scadenta || factura.data_emiterii)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${_esc(factura.referinta || idFactura)}</cbc:BuyerReference>

  <!-- ── Furnizor (emitent) ─────────────────────────────── -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${_esc(profil.nume_firma || 'Emitent')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${_esc(profil.adresa || '')}</cbc:StreetName>
        <cbc:CityName>${_esc(profil.oras || '')}</cbc:CityName>
        <cbc:PostalZone>${_esc(profil.cod_postal || '')}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO${_esc(String(profil.cui || '').replace(/^RO/i, ''))}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${_esc(profil.nume_firma || '')}</cbc:RegistrationName>
        <cbc:CompanyID>${_esc(String(profil.cui || '').replace(/^RO/i, ''))}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      ${profil.iban ? `<cac:FinancialAccount>
        <cbc:ID>${_esc(profil.iban)}</cbc:ID>
      </cac:FinancialAccount>` : ''}
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- ── Client (destinatar) ───────────────────────────── -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${_esc(client.nume_firma || client.nume || '')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${_esc(client.adresa || '')}</cbc:StreetName>
        <cbc:CityName>${_esc(client.oras || '')}</cbc:CityName>
        <cbc:PostalZone>${_esc(client.cod_postal || '')}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO${_esc(String(client.cui || '').replace(/^RO/i, ''))}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${_esc(client.nume_firma || '')}</cbc:RegistrationName>
        <cbc:CompanyID>${_esc(String(client.cui || '').replace(/^RO/i, ''))}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- ── Total TVA ─────────────────────────────────────── -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">${_nr(valTVA)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RON">${_nr(valFaraTVA)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RON">${_nr(valTVA)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${tvaInfo.categorie}</cbc:ID>
        <cbc:Percent>${esteNeplatitor ? '0' : cotaTVA}</cbc:Percent>
        ${tvaInfo.motiv ? `<cbc:TaxExemptionReason>${_esc(tvaInfo.motiv)}</cbc:TaxExemptionReason>` : ''}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- ── Total monetar ─────────────────────────────────── -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RON">${_nr(valFaraTVA)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RON">${_nr(valFaraTVA)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">${_nr(valTotal)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">${_nr(valTotal)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- ── Linie factura (1 linie = toata suma) ──────────── -->
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="RON">${_nr(valFaraTVA)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${_esc(factura.descriere || 'Servicii/Produse conform contract')}</cbc:Description>
      <cbc:Name>${_esc(factura.descriere || idFactura)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${tvaInfo.categorie}</cbc:ID>
        <cbc:Percent>${esteNeplatitor ? '0' : cotaTVA}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="RON">${_nr(valFaraTVA)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>

</Invoice>`;

    return xml;
}

// =========================================================
// TRIMITERE LA ANAF — prin Edge Function
// =========================================================

/**
 * Trimite o factura la SPV ANAF prin Edge Function 'anaf-efactura'.
 * Genereaza automat XML-ul UBL 2.1 din datele stocate local.
 *
 * @param {string} facturaId - ID-ul facturii din tabela `facturi`
 * @returns {Promise<{ success: boolean, uploadIndex: string, errors: Array, mock: boolean }>}
 */
async function trimiteLaANAF(facturaId) {
    if (!facturaId) throw new Error('[e-Factura] facturaId obligatoriu');

    setLoader(true);
    try {
        // Colecteaza datele necesare din store
        const factura = (ZFlowStore.dateFacturiBI || []).find(f => String(f.id) === String(facturaId))
                     || (ZFlowStore.dateFacturiPlatit || []).find(f => String(f.id) === String(facturaId));
        if (!factura) throw new Error('Factura negasita in store. Reimprospateaza datele.');

        const client = (ZFlowStore.dateLocal || []).find(c => String(c.id) === String(factura.client_id));
        if (!client) throw new Error('Clientul facturii negasit in store.');

        const profil = ZFlowStore.userProfile;
        if (!profil || !profil.cui) throw new Error('Profilul firmei nu are CUI completat. Mergi la Setari → Profil Firma.');

        // Generare XML
        const xml = genereazaXML(factura, client, profil);

        // Apel Edge Function
        const { data: { session } } = await ZFlowDB._supabase().auth.getSession();
        const resp = await fetch(
            'https://exrypxknksgrtrwnbtrl.supabase.co/functions/v1/anaf-efactura',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (session && session.access_token ? session.access_token : '')
                },
                body: JSON.stringify({ actiune: 'trimite', factura_id: facturaId, xml })
            }
        );
        const rezultat = await resp.json();

        if (rezultat.mock) {
            showNotification('Mod simulare ANAF — uploadIndex: ' + rezultat.uploadIndex, 'warning');
        } else if (rezultat.success) {
            showNotification('Factura trimisa la ANAF. Index: ' + rezultat.uploadIndex, 'success');
        } else {
            const erMsg = (rezultat.errors || []).map(function(e) { return e.errorMessage || String(e); }).join('; ');
            showNotification('ANAF: ' + erMsg, 'error');
        }

        // Refresh store local
        if (typeof ZFlowDB.fetchFacturi === 'function') {
            const refresh = await ZFlowDB.fetchFacturi();
            if (refresh && ZFlowStore) ZFlowStore.dateFacturiBI = refresh;
        }

        return rezultat;
    } catch (e) {
        showNotification('Eroare trimitere ANAF: ' + e.message, 'error');
        return { success: false, errors: [{ errorMessage: e.message }] };
    } finally {
        setLoader(false);
    }
}

// =========================================================
// VERIFICARE STATUS
// =========================================================

/**
 * Verifica statusul unui mesaj deja trimis la SPV ANAF.
 *
 * @param {string} facturaId - ID-ul facturii
 * @returns {Promise<{ status: string, mesaje: string[] }>}
 */
async function verificaStatus(facturaId) {
    const factura = (ZFlowStore.dateFacturiBI || []).find(f => String(f.id) === String(facturaId));
    if (!factura || !factura.anaf_upload_index) {
        showNotification('Factura nu a fost trimisa la ANAF sau uploadIndex lipsa', 'warning');
        return { status: 'necunoscut', mesaje: [] };
    }

    setLoader(true);
    try {
        const { data: { session } } = await ZFlowDB._supabase().auth.getSession();
        const resp = await fetch(
            'https://exrypxknksgrtrwnbtrl.supabase.co/functions/v1/anaf-efactura',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (session && session.access_token ? session.access_token : '')
                },
                body: JSON.stringify({
                    actiune: 'verifica',
                    factura_id: facturaId,
                    upload_index: factura.anaf_upload_index
                })
            }
        );
        const rezultat = await resp.json();

        if (rezultat.status === 'ok') {
            afiseazaBifaVerde(facturaId);
            showNotification('Factura acceptata de ANAF', 'success');
        } else if (rezultat.status === 'erori') {
            showNotification('ANAF erori: ' + (rezultat.mesaje || []).join('; '), 'error');
        } else {
            showNotification('ANAF proceseaza factura...', 'info');
        }

        return rezultat;
    } catch (e) {
        showNotification('Eroare verificare ANAF: ' + e.message, 'error');
        return { status: 'eroare', mesaje: [e.message] };
    } finally {
        setLoader(false);
    }
}

// =========================================================
// UI — BIFA VERDE
// =========================================================

/**
 * Afiseaza o bifa verde pe cardul facturii in UI.
 * Cauta elementul cu data-factura-id="<id>" si adauga badge-ul.
 *
 * @param {string} facturaId
 */
function afiseazaBifaVerde(facturaId) {
    const card = document.querySelector('[data-factura-id="' + CSS.escape(String(facturaId)) + '"]');
    if (!card) return;

    // Verifica daca exista deja bifa
    if (card.querySelector('.anaf-badge-ok')) return;

    const badge = document.createElement('span');
    badge.className = 'anaf-badge-ok inline-flex items-center gap-1 text-[8px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 ml-1';
    badge.title = 'Acceptat ANAF e-Factura';
    badge.textContent = '\u2713 e-Factura';
    const titlu = card.querySelector('.card-title, .nr-factura, [class*="font-black"]');
    if (titlu) titlu.appendChild(badge);
    else card.prepend(badge);
}

// =========================================================
// EXPORT
// =========================================================

/** @namespace ZFlowEFactura */
window.ZFlowEFactura = {
    genereazaXML,
    trimiteLaANAF,
    verificaStatus,
    afiseazaBifaVerde,
};

// Alias-uri directe
window.trimiteLaANAF       = trimiteLaANAF;
window.verificaStatusANAF  = verificaStatus;
