/**
 * Z-FLOW Enterprise v7.14
 * Module: Utils - Funcții utilitare generale
 */

/**
 * Returnează data curentă a sistemului în format ISO (YYYY-MM-DD).
 * Respectă preferința utilizatorului zflow_pref_data_azi dacă este disponibilă.
 * @returns {string} Data în format ISO sau string gol dacă preferința e dezactivată
 */
function getCurrentISODate() {
    return typeof getDataImplicita === 'function'
        ? getDataImplicita()
        : new Date().toISOString().slice(0, 10);
}
window.getCurrentISODate = getCurrentISODate;

/**
 * Funcție utilHelper: debounce
 * @param {Function} func - Funcția de executat
 * @param {number} delay - Delay în ms
 * @returns {Function}
 */
function debounce(func, delay) {
    let _timer = null;  // timer per-funcție, nu global partajat
    return function (...args) {
        clearTimeout(_timer);
        _timer = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * @deprecated Folosiți versiunea din app.js care suportă T12:00:00 (fus orar corect)
 * și returnează anul cu 4 cifre. Această versiune returnează anul cu 2 cifre (ex: "26").
 * La runtime, versiunea din app.js suprascrie aceasta (app.js se încarcă după utils.js).
 */
/**
 * Formatează data în format ZZ/LL/AAAA
 * @param {string} dataString - Data în format ISO
 * @returns {string} Data formatată
 */
function formateazaDataZFlow(dataString) {
    if (!dataString) return "";
    const d = new Date(typeof dataString === 'string' && dataString.length === 10
        ? dataString + 'T12:00:00' : dataString);
    if (isNaN(d.getTime())) return dataString;
    const zi = String(d.getDate()).padStart(2, "0");
    const luna = String(d.getMonth() + 1).padStart(2, "0");
    const an = d.getFullYear(); // [BUG1-FIX] an complet 4 cifre; era: .slice(-2)
    // [DEPRECATED-GUARD] Dacă versiunea din app.js s-a încărcat deja, delegă spre ea
    if (window._formateazaDataZFlowV2) return window._formateazaDataZFlowV2(dataString);
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
        const anComplet = (() => { const cy = new Date().getFullYear() % 100; return an <= (cy + 10) ? 2000 + an : 1900 + an; })();
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
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback securizat cu crypto.getRandomValues
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    return [...arr].map((b, i) =>
        ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0')
    ).join('');
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
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Deep clone pentru obiecte
 * @param {Object} obj - Obiect de clonat
 * @returns {Object}
 */
function deepClone(obj) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
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
    throttle,
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    },
    pagineaza(lista, pageSize, currentPage) {
        if (pageSize === 0) return { items: lista, total: lista.length, totalPages: 1, currentPage: 1, hasNext: false, hasPrev: false, from: lista.length ? 1 : 0, to: lista.length };
        const total = lista.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(Math.max(1, currentPage), totalPages);
        const from = (page - 1) * pageSize;
        return {
            items: lista.slice(from, from + pageSize),
            total, totalPages, currentPage: page,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            from: from + 1,
            to: Math.min(from + pageSize, total)
        };
    }
};

// Export individual
window.validareCUI  = validareCUI;
window.validareIBAN = validareIBAN;
window.escapeHTML   = escapeHTML;
window.escapeHtml   = (str) => window.ZFlowUtils.escapeHtml(str);
window.pagineaza    = (l, ps, cp) => window.ZFlowUtils.pagineaza(l, ps, cp);

// Export individual pentru compatibilitate cu codul existent
window.debounce = debounce;
window.formateazaDataZFlow = formateazaDataZFlow;

// [NAMESPACE-NOTE] Exporturile individuale de mai sus sunt menținute pentru
// compatibilitate retroactivă. Cod nou ar trebui să folosească:
//   window.ZFlowUtils.escapeHtml()   în loc de window.escapeHTML / escapeHtml
//   window.ZFlowUtils.debounce()     în loc de window.debounce
//   window.ZFlowUtils.pagineaza()    în loc de window.pagineaza
// La un refactor major, înlocuiește apelurile și elimină exporturile individuale.
