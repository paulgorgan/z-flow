/**
 * Z-FLOW Enterprise v7.14
 * Module: Utils - Funcții utilitare generale
 */

// Timer debounce pentru căutări
let debounceSearchTimer = null;

/**
 * Funcție utilHelper: debounce
 * @param {Function} func - Funcția de executat
 * @param {number} delay - Delay în ms
 * @returns {Function}
 */
function debounce(func, delay) {
    return function (...args) {
        clearTimeout(debounceSearchTimer);
        debounceSearchTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Formatează data în format ZZ/LL/AA
 * @param {string} dataString - Data în format ISO
 * @returns {string} Data formatată
 */
function formateazaDataZFlow(dataString) {
    if (!dataString) return "";
    const d = new Date(dataString);
    if (isNaN(d.getTime())) return dataString;
    const zi = String(d.getDate()).padStart(2, "0");
    const luna = String(d.getMonth() + 1).padStart(2, "0");
    const an = String(d.getFullYear()).slice(-2);
    return `${zi}/${luna}/${an}`;
}

/**
 * Formatează data completă pentru afișare (data, lună text, an complet)
 * @param {Date} date - Obiect Date
 * @returns {string}
 */
function formateazaDataComplet(date) {
    const zile = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
    const luni = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", 
                  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
    
    return `${zile[date.getDay()]}, ${date.getDate()} ${luni[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Parsează data din format ZZ/LL/AA sau ISO
 * @param {string} dateStr - String data
 * @returns {Date|null}
 */
function parseDataZFlow(dateStr) {
    if (!dateStr) return null;
    
    // Format ISO
    if (dateStr.includes('-')) {
        return new Date(dateStr);
    }
    
    // Format ZZ/LL/AA
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const zi = parseInt(parts[0], 10);
        const luna = parseInt(parts[1], 10) - 1;
        const an = parseInt(parts[2], 10);
        const anComplet = an < 50 ? 2000 + an : 1900 + an;
        return new Date(anComplet, luna, zi);
    }
    
    return null;
}

/**
 * Formatează sumă în RON
 * @param {number} suma - Suma de formatat
 * @param {boolean} includeSymbol - Include simbolul RON
 * @returns {string}
 */
function formateazaSuma(suma, includeSymbol = true) {
    const formatted = new Intl.NumberFormat('ro-RO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(suma || 0);
    
    return includeSymbol ? `${formatted} RON` : formatted;
}

/**
 * Calculează diferența în zile între două date
 * @param {Date} data1 
 * @param {Date} data2 
 * @returns {number}
 */
function diferentaZile(data1, data2) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const utc1 = Date.UTC(data1.getFullYear(), data1.getMonth(), data1.getDate());
    const utc2 = Date.UTC(data2.getFullYear(), data2.getMonth(), data2.getDate());
    return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

/**
 * Generează UUID v4
 * @returns {string}
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Extrage inițialele dintr-un nume
 * @param {string} nume - Nume complet
 * @param {number} maxChars - Număr maxim caractere
 * @returns {string}
 */
function getInitiale(nume, maxChars = 2) {
    if (!nume) return '?';
    const words = nume.trim().split(/\s+/);
    return words
        .slice(0, maxChars)
        .map(w => w.charAt(0).toUpperCase())
        .join('');
}

/**
 * Validează CUI românesc cu cifră de control (algoritm ANAF)
 * @param {string} cui - CUI de validat (cu sau fără prefix RO)
 * @returns {boolean}
 */
function validareCUI(cui) {
    if (!cui) return false;
    const cuiCurat = cui.toString().toUpperCase().replace(/^RO/i, '').replace(/\D/g, '');
    if (cuiCurat.length < 2 || cuiCurat.length > 10) return false;
    const cheie = [7, 5, 3, 2, 1, 7, 5, 3, 2];
    const cifre = cuiCurat.split('').map(Number);
    const cifraCrtl = cifre[cifre.length - 1];
    const cifreCalc = cifre.slice(0, -1);
    const offset = cheie.length - cifreCalc.length;
    const suma = cifreCalc.reduce((acc, d, i) => acc + d * cheie[offset + i], 0);
    const calculat = (suma * 10) % 11 === 10 ? 0 : (suma * 10) % 11;
    return calculat === cifraCrtl;
}

/**
 * Validează IBAN românesc (ISO 7064 MOD 97-10)
 * @param {string} iban - IBAN de validat
 * @returns {boolean}
 */
function validareIBAN(iban) {
    if (!iban) return false;
    const ibanCurat = iban.toString().toUpperCase().replace(/\s/g, '');
    // Format RO: RO + 2 check digits + 4 litere bancă + 16 alfanumerice = 24 caractere
    if (!/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(ibanCurat)) return false;
    // Mută primele 4 caractere la sfârșit
    const rearanjat = ibanCurat.slice(4) + ibanCurat.slice(0, 4);
    // Înlocuiește literele cu cifre (A=10 … Z=35)
    const numeric = rearanjat.replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());
    // Calculează mod 97 (pe grupe de 9 cifre)
    let rest = 0;
    for (const digit of numeric) rest = (rest * 10 + parseInt(digit)) % 97;
    return rest === 1;
}

/**
 * Sanitizează string pentru afișare HTML
 * @param {string} str - String de sanitizat
 * @returns {string}
 */
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Deep clone pentru obiecte
 * @param {Object} obj - Obiect de clonat
 * @returns {Object}
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Verifică dacă un obiect este gol
 * @param {Object} obj 
 * @returns {boolean}
 */
function isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
}

/**
 * Throttle function
 * @param {Function} func 
 * @param {number} limit - Limit în ms
 * @returns {Function}
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export global pentru compatibilitate
window.ZFlowUtils = {
    debounce,
    formateazaDataZFlow,
    formateazaDataComplet,
    parseDataZFlow,
    formateazaSuma,
    diferentaZile,
    generateUUID,
    getInitiale,
    validareCUI,
    validareIBAN,
    escapeHTML,
    deepClone,
    isEmpty,
    throttle
};

// Export individual
window.validareCUI  = validareCUI;
window.validareIBAN = validareIBAN;

// Export individual pentru compatibilitate cu codul existent
window.debounce = debounce;
window.formateazaDataZFlow = formateazaDataZFlow;
