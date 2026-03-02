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
        const delimiter = options.delimiter || ',';
        const hasHeader = options.hasHeader !== false;
        
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];
        
        const headers = hasHeader 
            ? this.parseCSVLine(lines[0], delimiter)
            : [];
        
        const startIndex = hasHeader ? 1 : 0;
        const data = [];
        
        for (let i = startIndex; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i], delimiter);
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
        
        sagaData.forEach((row, index) => {
            try {
                // Mapare coloane SAGA
                const cuiClient = row['CUI'] || row['CUI Client'] || row['COD FISCAL'] || '';
                const numeClient = row['DENUMIRE'] || row['Denumire Client'] || row['NUME'] || '';
                const nrFactura = row['NR. FACTURA'] || row['Nr. factura'] || row['NUMAR'] || '';
                const dataEmitere = this.parseDataSAGA(row['DATA EMITERE'] || row['Data emitere'] || row['DATA']);
                const dataScadenta = this.parseDataSAGA(row['DATA SCADENTA'] || row['Data scadenta'] || row['SCADENTA']);
                const suma = this.parseSumaSAGA(row['VALOARE'] || row['Valoare'] || row['SUMA'] || row['TOTAL']);
                
                if (!numeClient && !cuiClient) {
                    errors.push(`Rândul ${index + 1}: Lipsă client`);
                    return;
                }
                
                // Crează sau găsește client
                const clientKey = cuiClient || numeClient;
                if (!clientMap.has(clientKey)) {
                    const client = {
                        _tempId: `temp_${Date.now()}_${index}`,
                        nume_firma: numeClient,
                        cui: cuiClient,
                        adresa: row['ADRESA'] || row['Adresa'] || '',
                        oras: row['LOCALITATE'] || row['Oras'] || '',
                        judet: row['JUDET'] || row['Judet'] || ''
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
        
        // Elimină caractere non-numerice (dar păstrează virgulă și punct)
        let cleaned = sumaStr.toString()
            .replace(/[^\d.,\-]/g, '')
            .replace(',', '.');
        
        // Dacă sunt mai multe puncte, elimină-le pe toate în afară de ultimul
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
        }
        
        return parseFloat(cleaned) || 0;
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
        const firstLine = csvText.split('\n')[0] || '';
        const delimiters = [',', ';', '\t', '|'];
        let maxCount = 0;
        let detected = ',';
        
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
