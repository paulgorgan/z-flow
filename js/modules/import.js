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

        // Helper: caută prima cheie existentă în row (case-insensitive + trim + strip BOM)
        const _col = (row, ...keys) => {
            const rowLower = {};
            for (const k of Object.keys(row)) rowLower[k.trim().replace(/^\uFEFF/, '').toLowerCase()] = row[k];
            for (const k of keys) {
                const val = rowLower[k.trim().toLowerCase()];
                if (val !== undefined && String(val).trim() !== '') return String(val).trim();
            }
            return '';
        };

        sagaData.forEach((row, index) => {
            try {
                // Mapare coloane SAGA — acoperă variantele comune de headere
                const cuiClient = _col(row,
                    'CUI', 'CUI Client', 'CUI CLIENT', 'COD FISCAL', 'Cod fiscal', 'Cod Fiscal',
                    'COD FISCAL CLIENT', 'CUI/CNP', 'COD', 'Cod', 'CODFISCAL',
                    'SIMBOL CONT', 'Simbol cont', 'SIMBOL');
                const numeClient = _col(row,
                    'DENUMIRE', 'Denumire', 'Denumire Client', 'DENUMIRE CLIENT', 'NUME', 'Nume',
                    'PARTENER', 'Partener', 'FIRMA', 'Firma', 'BENEFICIAR', 'Beneficiar',
                    'CLIENT', 'Client', 'FURNIZOR', 'Furnizor',
                    'DEN. CONT', 'Den. cont', 'DENUMIRE CONT', 'Denumire cont', 'CONT',
                    'EXPLICATII', 'Explicatii', 'EXPLICAȚII', 'Explicații');
                const nrFactura = _col(row,
                    'NR. FACTURA', 'Nr. factura', 'NR FACTURA', 'NUMAR', 'Nr. document',
                    'NR. DOC', 'NR DOC', 'NR.DOC', 'Nr doc', 'NR. DOCUMENT', 'DOCUMENT',
                    'Serie si numar', 'SERIE NR', 'SERIE SI NUMAR', 'NR_FACTURA',
                    'NR. DOC.', 'Nr. doc.', 'NUMAR DOC', 'Numar doc');
                const dataEmitere = this.parseDataSAGA(_col(row,
                    'DATA EMITERE', 'Data emitere', 'DATA', 'Data', 'DATA DOC', 'Data doc',
                    'DATA DOCUMENT', 'Data document', 'DATA FACTURA', 'Data factura',
                    'DATA DOC.', 'Data doc.', 'DAT'));
                const dataScadenta = this.parseDataSAGA(_col(row,
                    'DATA SCADENTA', 'Data scadenta', 'SCADENTA', 'Scadenta', 'DATA SCAD.',
                    'Data scad', 'TERMEN PLATA', 'Termen plata', 'SCAD.', 'Scad.'));
                // SAGA poate exporta sume în coloane separate: RULAJ D (debit), RULAJ C (credit), SOLD
                const sumaRaw = _col(row,
                    'VALOARE', 'Valoare', 'SUMA', 'Suma', 'TOTAL', 'Total',
                    'SUMA FACTURA', 'Suma factura', 'RULAJ', 'Rulaj',
                    'SUMA DOC', 'Suma doc', 'VALOARE FACTURA', 'TOTAL FACTURA',
                    'RULAJ D', 'Rulaj D', 'RULAJ DEBIT', 'Rulaj debit',
                    'SOLD FINAL D', 'Sold final D', 'SOLD D', 'Sold D',
                    'SOLD INITIAL D', 'DEBIT', 'Debit');
                const suma = this.parseSumaSAGA(sumaRaw);
                
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
                        status_plata: 'Neincasat',
                        sursa: 'SAGA',
                        descriere: row['DESCRIERE'] || row['Descriere'] || ''
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
