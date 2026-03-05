/**
 * Z-FLOW Enterprise v7.14
 * Module: Import - Import date din SAGA și alte surse
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowImport = {
    /**
     * Parsează fișier CSV
     * @param {string} csvText - Conținutul CSV
     * @param {Object} options - Opțiuni de parsare
     * @returns {Array}
     */
    parseCSV(csvText, options = {}) {
        const delimiter = options.delimiter || ';';
        const hasHeader = options.hasHeader !== false;
        
        // Strip UTF-8 BOM (0xEF 0xBB 0xBF) — fișiere exportate din Windows/SAGA
        const cleanText = csvText.replace(/^\uFEFF/, '');
        const lines = cleanText.trim().split('\n');
        if (lines.length === 0) return [];
        
        // Trim \r din fiecare linie (Windows CRLF)
        const trimmedLines = lines.map(l => l.replace(/\r$/, ''));
        
        const headers = hasHeader 
            ? this.parseCSVLine(trimmedLines[0], delimiter)
            : [];
        
        const startIndex = hasHeader ? 1 : 0;
        const data = [];
        
        for (let i = startIndex; i < trimmedLines.length; i++) {
            const values = this.parseCSVLine(trimmedLines[i], delimiter);
            if (values.length === 0 || values.every(v => !v.trim())) continue;
            
            if (hasHeader) {
                const obj = {};
                headers.forEach((h, idx) => {
                    obj[h.trim()] = values[idx]?.trim() || '';
                });
                data.push(obj);
            } else {
                data.push(values);
            }
        }
        
        return data;
    },

    /**
     * Parsează o linie CSV (gestionează ghilimele)
     * @param {string} line 
     * @param {string} delimiter 
     * @returns {Array}
     */
    parseCSVLine(line, delimiter = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result;
    },

    /**
     * Mapează date SAGA la formatul Z-FLOW
     * @param {Array} sagaData - Date parsate din SAGA
     * @returns {Object} - { clienti: Array, facturi: Array, errors: Array }
     */
    mapSAGAData(sagaData) {
        const clienti = [];
        const facturi = [];
        const errors = [];
        const clientMap = new Map();

        // Diagnosticare headere — afișat o singură dată
        if (sagaData.length > 0) {
            console.log('[Import] Headere detectate în CSV:', Object.keys(sagaData[0]));
        }

        // Helper: caută prima cheie existentă în row (case-insensitive + trim + strip BOM + underscore↔space)
        const _col = (row, ...keys) => {
            // Normalizare: lowercase, trim BOM, spații multiple → 1 spațiu
            const norm = s => s.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
            const rowNorm = {};
            for (const k of Object.keys(row)) rowNorm[norm(k)] = row[k];
            for (const k of keys) {
                const val = rowNorm[norm(k)];
                if (val !== undefined && String(val).trim() !== '') return String(val).trim();
            }
            return '';
        };

        sagaData.forEach((row, index) => {
            try {
                // Mapare coloane SAGA — acoperă variantele comune de headere
                const cuiClient = _col(row,
                    // variante standard SAGA + snake_case Z-FLOW
                    'CUI', 'cui', 'CUI Client', 'CUI CLIENT',
                    'furnizor_cui', 'FURNIZOR CUI', 'client_cui', 'CLIENT CUI',
                    'cui_furnizor', 'CUI FURNIZOR', 'cui_client', 'CUI CLIENT',
                    'COD FISCAL', 'cod_fiscal', 'Cod fiscal', 'Cod Fiscal',
                    'COD FISCAL CLIENT', 'CUI/CNP', 'cui_cnp',
                    'COD', 'Cod', 'CODFISCAL', 'codfiscal',
                    'SIMBOL CONT', 'simbol_cont', 'Simbol cont', 'SIMBOL', 'simbol');
                const numeClient = _col(row,
                    // variante standard SAGA + snake_case Z-FLOW
                    'DENUMIRE', 'denumire', 'Denumire', 'Denumire Client', 'DENUMIRE CLIENT', 'denumire_client',
                    'NUME FIRMA', 'nume_firma', 'Nume firma',
                    'NUME', 'nume', 'Nume',
                    'PARTENER', 'partener', 'Partener',
                    'FIRMA', 'firma', 'Firma',
                    'BENEFICIAR', 'beneficiar', 'Beneficiar',
                    'CLIENT', 'client', 'Client',
                    'FURNIZOR', 'furnizor', 'Furnizor',
                    'DEN. CONT', 'den_cont', 'Den. cont', 'DENUMIRE CONT', 'denumire_cont', 'Denumire cont', 'CONT', 'cont',
                    'EXPLICATII', 'explicatii', 'Explicatii', 'EXPLICAȚII', 'Explicații', 'explicatii');
                const nrFactura = _col(row,
                    // variante standard SAGA + snake_case Z-FLOW
                    'NR. FACTURA', 'nr_factura', 'numar_factura', 'NUMAR FACTURA',
                    'Nr. factura', 'NR FACTURA', 'NUMAR', 'numar', 'Nr. document',
                    'NR. DOC', 'nr_doc', 'NR DOC', 'NR.DOC', 'Nr doc',
                    'NR. DOCUMENT', 'nr_document', 'DOCUMENT', 'document',
                    'Serie si numar', 'serie_si_numar', 'SERIE NR', 'SERIE SI NUMAR', 'NR_FACTURA',
                    'NR. DOC.', 'Nr. doc.', 'NUMAR DOC', 'Numar doc',
                    'factura_numar', 'invoice_number', 'invoice_no');
                const dataEmitere = this.parseDataSAGA(_col(row,
                    'DATA EMITERE', 'data_emiterii', 'data_emitere', 'DATA EMITERII',
                    'Data emitere', 'DATA', 'data', 'Data',
                    'DATA DOC', 'data_doc', 'Data doc',
                    'DATA DOCUMENT', 'data_document', 'Data document',
                    'DATA FACTURA', 'data_factura', 'Data factura',
                    'DATA DOC.', 'Data doc.', 'DAT', 'dat'));
                const dataScadenta = this.parseDataSAGA(_col(row,
                    'DATA SCADENTA', 'data_scadenta', 'DATA SCADENŢĂ', 'Data scadenta',
                    'SCADENTA', 'scadenta', 'Scadenta',
                    'DATA SCAD.', 'data_scad', 'Data scad',
                    'TERMEN PLATA', 'termen_plata', 'Termen plata',
                    'SCAD.', 'scad', 'Scad.'));
                // SAGA poate exporta sume în coloane separate: RULAJ D (debit), RULAJ C (credit), SOLD
                const sumaRaw = _col(row,
                    'VALOARE', 'valoare', 'Valoare',
                    'SUMA', 'suma', 'Suma',
                    'TOTAL', 'total', 'Total',
                    'SUMA FACTURA', 'suma_factura', 'Suma factura',
                    'RULAJ', 'rulaj', 'Rulaj',
                    'SUMA DOC', 'suma_doc', 'Suma doc',
                    'VALOARE FACTURA', 'valoare_factura', 'TOTAL FACTURA', 'total_factura',
                    'RULAJ D', 'rulaj_d', 'Rulaj D', 'RULAJ DEBIT', 'rulaj_debit', 'Rulaj debit',
                    'SOLD FINAL D', 'sold_final_d', 'Sold final D',
                    'SOLD D', 'sold_d', 'Sold D',
                    'SOLD INITIAL D', 'sold_initial_d',
                    'DEBIT', 'debit', 'Debit');
                const suma = this.parseSumaSAGA(sumaRaw);

                // Status plată opțional în CSV (SAGA poate conține sold zero = achitat)
                const statusRaw = _col(row,
                    'STATUS', 'status', 'STATUS PLATA', 'status_plata', 'STATUS PLATĂ',
                    'ACHITAT', 'achitat', 'INCASAT', 'incasat', 'PLATIT', 'platit').toLowerCase().trim();
                let statusPlata = 'Neincasat'; // default pentru clienți (furnizori: Neplatit—detectat în app.js)
                // Verificare exactă pentru a evita false positive pe "Neincasat", "Neplatit"
                const isPaid = statusRaw === 'incasat' || statusRaw === 'platit' || statusRaw === 'achitat'
                             || statusRaw === 'da' || statusRaw === 'yes' || statusRaw === '1'
                             || statusRaw === 'paid' || statusRaw === 'p';
                if (isPaid) {
                    statusPlata = 'Incasat'; // normalizat la inserare: furnizori → 'Platit' în app.js
                }
                
                if (!numeClient && !cuiClient) {
                    errors.push(`Rândul ${index + 1}: Lipsă client`);
                    return;
                }
                
                // Crează sau găsește client
                const clientKey = (cuiClient || numeClient).trim();
                if (!clientMap.has(clientKey)) {
                    const client = {
                        _tempId: `temp_${Date.now()}_${index}`,
                        nume_firma: numeClient,
                        cui: cuiClient,
                        adresa: _col(row, 'ADRESA', 'Adresa', 'ADRESA CLIENT', 'Adresa client', 'STRADA', 'Strada'),
                        oras: _col(row, 'LOCALITATE', 'Localitate', 'ORAS', 'Oras', 'MUNICIPIU', 'Municipiu', 'LOC.', 'Loc.'),
                        judet: _col(row, 'JUDET', 'Judet', 'JUD', 'Jud', 'JUD.', 'Jud.')
                    };
                    clientMap.set(clientKey, client);
                    clienti.push(client);
                }
                
                // Crează factură
                if (nrFactura || suma) {
                    const factura = {
                        _tempClientKey: clientKey,
                        nr_factura: nrFactura,
                        data_emitere: dataEmitere,
                        data_scadenta: dataScadenta,
                        suma: suma,
                        status_plata: statusPlata,   // din CSV sau 'Neincasat' implicit
                        sursa: 'SAGA',
                        descriere: _col(row, 'DESCRIERE', 'Descriere', 'descriere', 'observatii', 'OBSERVATII', 'Observatii', 'NOTE', 'note', 'Note', 'obs', 'OBS')
                    };
                    facturi.push(factura);
                }
                
            } catch (e) {
                errors.push(`Rândul ${index + 1}: ${e.message}`);
            }
        });
        
        return { clienti, facturi, clientMap, errors };
    },

    /**
     * Parsează data din format SAGA
     * @param {string} dateStr 
     * @returns {string|null} - Format ISO
     */
    parseDataSAGA(dateStr) {
        if (!dateStr) return null;
        
        // Format DD.MM.YYYY sau DD/MM/YYYY
        const match = dateStr.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
        if (match) {
            const zi = match[1].padStart(2, '0');
            const luna = match[2].padStart(2, '0');
            let an = match[3];
            if (an.length === 2) an = '20' + an;
            return `${an}-${luna}-${zi}`;
        }
        
        // Format ISO
        if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
            return dateStr.split('T')[0];
        }
        
        return null;
    },

    /**
     * Parsează suma din format SAGA
     * @param {string|number} sumaStr 
     * @returns {number}
     */
    parseSumaSAGA(sumaStr) {
        if (typeof sumaStr === 'number') return sumaStr;
        if (!sumaStr) return 0;
        
        let s = sumaStr.toString().trim();
        // Elimină simboluri monedă, spații, caracterul \u2013 (minus special)
        s = s.replace(/[^\d.,\-]/g, '');
        if (!s) return 0;
        
        const hasComma = s.includes(',');
        const hasDot = s.includes('.');
        
        if (hasComma && hasDot) {
            // Determină care e separatorul zecimal (ultimul simbol)
            const lastComma = s.lastIndexOf(',');
            const lastDot = s.lastIndexOf('.');
            if (lastComma > lastDot) {
                // Format românesc: 1.500,00 — punct = mii, virgulă = zecimal
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                // Format englezesc: 1,500.00 — virgulă = mii, punct = zecimal
                s = s.replace(/,/g, '');
            }
        } else if (hasComma) {
            // Singură virgulă — separator zecimal românesc: 1500,00
            s = s.replace(',', '.');
        }
        // Altfel doar punct — deja format englezesc/ISO
        
        return parseFloat(s) || 0;
    },

    /**
     * Validează date pentru import
     * @param {Object} importData - { clienti, facturi }
     * @returns {Object} - { valid: boolean, errors: Array, warnings: Array }
     */
    validate(importData) {
        const errors = [];
        const warnings = [];
        
        // Validare clienți
        importData.clienti?.forEach((c, i) => {
            if (!c.nume_firma?.trim()) {
                errors.push(`Client ${i + 1}: Lipsește numele firmei`);
            }
        });
        
        // Validare facturi
        importData.facturi?.forEach((f, i) => {
            if (!f.nr_factura) {
                warnings.push(`Factură ${i + 1}: Lipsește numărul facturii`);
            }
            if (!f.suma || f.suma <= 0) {
                warnings.push(`Factură ${i + 1}: Suma invalidă sau zero`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            summary: {
                clienti: importData.clienti?.length || 0,
                facturi: importData.facturi?.length || 0
            }
        };
    },

    /**
     * Citește fișier și parsează
     * @param {File} file 
     * @returns {Promise<string>}
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Eroare la citirea fișierului'));
            reader.readAsText(file, 'UTF-8');
        });
    },

    /**
     * Detectează delimitatorul CSV
     * @param {string} csvText 
     * @returns {string}
     */
    detectDelimiter(csvText) {
        // Strip BOM înainte de detectare
        const clean = csvText.replace(/^\uFEFF/, '');
        const firstLine = clean.split('\n')[0] || '';
        // Testăm ';' primul — SAGA exportă cu semicolon
        const delimiters = [';', ',', '\t', '|'];
        let maxCount = 0;
        let detected = ';';
        
        delimiters.forEach(d => {
            const count = (firstLine.match(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                detected = d;
            }
        });
        
        return detected;
    }
};

// Export global
window.ZFlowImport = ZFlowImport;
