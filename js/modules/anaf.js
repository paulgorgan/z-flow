/**
 * Z-FLOW Enterprise v7.14
 * Module: ANAF - Căutare date firmă la ANAF
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowANAF = {
    // Endpoint proxy (Supabase Edge Function sau alt proxy)
    proxyUrl: null,

    /**
     * Configurează URL-ul proxy pentru ANAF
     * @param {string} url 
     */
    setProxyUrl(url) {
        this.proxyUrl = url;
    },

    /**
     * Caută date firmă după CUI
     * @param {string} cui - CUI-ul firmei
     * @returns {Promise<Object|null>}
     */
    async cautaDupaCUI(cui) {
        const cuiCurat = cui?.toString().replace(/\D/g, '');
        
        if (!cuiCurat || cuiCurat.length < 2 || cuiCurat.length > 10) {
            throw new Error('CUI invalid');
        }
        
        try {
            // Încearcă prin proxy dacă e configurat
            if (this.proxyUrl) {
                return await this.cautaPrinProxy(cuiCurat);
            }
            
            // Fallback: API public (poate fi blocat de CORS)
            return await this.cautaDirectANAF(cuiCurat);
            
        } catch (e) {
            console.error('Eroare căutare ANAF:', e);
            throw e;
        }
    },

    /**
     * Căutare prin proxy server
     * @param {string} cui 
     * @returns {Promise<Object>}
     */
    async cautaPrinProxy(cui) {
        const response = await fetch(this.proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cui })
        });
        
        if (!response.ok) {
            throw new Error('Eroare la comunicarea cu proxy-ul ANAF');
        }
        
        const data = await response.json();
        return this.parseResponse(data);
    },

    /**
     * Căutare directă API ANAF (probabil blocată de CORS)
     * @param {string} cui 
     * @returns {Promise<Object>}
     */
    async cautaDirectANAF(cui) {
        const azi = new Date().toISOString().split('T')[0];
        
        const response = await fetch('https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ cui: parseInt(cui), data: azi }])
        });
        
        if (!response.ok) {
            throw new Error('Eroare la comunicarea cu ANAF');
        }
        
        const data = await response.json();
        return this.parseResponse(data);
    },

    /**
     * Parsează răspunsul ANAF
     * @param {Object} response 
     * @returns {Object|null}
     */
    parseResponse(response) {
        // Structura ANAF API
        const found = response?.found?.[0] || response?.data?.[0] || response;
        
        if (!found || found.error) {
            return null;
        }
        
        const adresa = found.adresa_domiciliu_fiscal || found.adresa || '';
        const parseAdresa = this.parseAdresa(adresa);
        
        return {
            cui: found.cui?.toString() || '',
            denumire: found.denumire || found.nume || '',
            adresa: adresa,
            oras: parseAdresa.localitate,
            judet: parseAdresa.judet,
            codPostal: parseAdresa.codPostal,
            nrRegCom: found.nrRegCom || found.numar_reg_com || '',
            telefon: found.telefon || '',
            platitorTVA: found.scpTVA === true,
            statusInactiv: found.statusInactivi === true,
            dataInregistrare: found.data_inregistrare || null,
            stare: found.stare_inregistrare || 'ACTIV'
        };
    },

    /**
     * Parsează adresa pentru extragere componente
     * @param {string} adresa 
     * @returns {Object}
     */
    parseAdresa(adresa) {
        if (!adresa) return { localitate: '', judet: '', codPostal: '' };
        
        let localitate = '', judet = '', codPostal = '';
        
        // Caută codul poștal (6 cifre)
        const codMatch = adresa.match(/\b(\d{6})\b/);
        if (codMatch) codPostal = codMatch[1];
        
        // Caută județul (JUD. sau JUDEȚUL)
        const judMatch = adresa.match(/JUD(?:EȚUL|\.)\s*([A-ZĂÂÎȘȚ]+)/i);
        if (judMatch) judet = judMatch[1].trim();
        
        // Caută localitatea (MUN., ORAȘ, COM., SAT)
        const locMatch = adresa.match(/(MUN\.|ORAȘ|COM\.|SAT)\s*([A-ZĂÂÎȘȚ\s-]+)/i);
        if (locMatch) localitate = locMatch[2].trim();
        
        // Fallback - ia prima parte până la virgulă
        if (!localitate) {
            const parts = adresa.split(',');
            if (parts.length > 1) {
                localitate = parts[parts.length - 2]?.trim() || parts[0]?.trim();
            }
        }
        
        return { localitate, judet, codPostal };
    },

    /**
     * Validează CUI românesc (algoritm oficial)
     * @param {string} cui 
     * @returns {boolean}
     */
    validareCUI(cui) {
        const cuiCurat = cui?.toString().replace(/\D/g, '');
        
        if (!cuiCurat || cuiCurat.length < 2 || cuiCurat.length > 10) {
            return false;
        }
        
        // Algoritm validare CUI
        const weights = [7, 5, 3, 2, 1, 7, 5, 3, 2];
        const cuiPadded = cuiCurat.padStart(10, '0');
        
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cuiPadded[i]) * weights[i];
        }
        
        let control = (sum * 10) % 11;
        if (control === 10) control = 0;
        
        return control === parseInt(cuiPadded[9]);
    },

    /**
     * Auto-completare form cu date de la ANAF
     * @param {string} cui 
     * @param {Object} formFields - Mapare câmpuri { numeField: elementId }
     */
    async autoComplete(cui, formFields) {
        try {
            const data = await this.cautaDupaCUI(cui);
            
            if (!data) {
                window.ZFlowUI?.showNotification('Firma nu a fost găsită la ANAF', 'warning');
                return null;
            }
            
            // Completează câmpurile
            const mapping = {
                denumire: ['nume_firma', 'denumire', 'nume'],
                adresa: ['adresa'],
                oras: ['oras', 'localitate'],
                judet: ['judet'],
                nrRegCom: ['nr_reg_com', 'nrRegCom']
            };
            
            Object.keys(mapping).forEach(dataKey => {
                const value = data[dataKey];
                if (!value) return;
                
                mapping[dataKey].forEach(fieldName => {
                    const elementId = formFields[fieldName];
                    const el = elementId ? document.getElementById(elementId) : document.querySelector(`[name="${fieldName}"]`);
                    if (el && !el.value) {
                        el.value = value;
                    }
                });
            });
            
            window.ZFlowUI?.showNotification(`Firma ${data.denumire} găsită!`, 'success');
            return data;
            
        } catch (e) {
            window.ZFlowUI?.showNotification('Eroare la căutarea în ANAF', 'error');
            return null;
        }
    }
};

// Export global
window.ZFlowANAF = ZFlowANAF;
