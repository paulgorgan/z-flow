/**
 * Z-FLOW Enterprise — Modul Logger
 * ==================================
 * Logger centralizat cu comportament adaptat mediului de execuție.
 *
 * Detectare mediu:
 *   - Development (localhost / 127.0.0.1 / *.local): afișează toate mesajele normale
 *   - Producție: suprimă debug/info, trimite errors către tabela Supabase `error_logs`
 *
 * API public:
 *   ZFlowLogger.debug(context, message, data?)
 *   ZFlowLogger.info(context, message, data?)
 *   ZFlowLogger.warn(context, message, data?)
 *   ZFlowLogger.error(context, message, data?)
 *
 * Expus global ca: window.ZFlowLogger
 */

// =========================================================
// Detecție mediu
// =========================================================

/**
 * Returnează true dacă aplicația rulează în mediu de development.
 * Criterii: localhost, 127.0.0.1, ::1 sau hostname care se termină în .local
 *
 * @returns {boolean}
 * @private
 */
function _isDevelopment() {
    const host = (typeof location !== 'undefined') ? location.hostname : '';
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.endsWith('.local')
    );
}

const _DEV = _isDevelopment();

// =========================================================
// Trimitere erori la Supabase (doar producție)
// =========================================================

/**
 * Trimite o eroare la tabela `error_logs` din Supabase.
 * Se execută asincron și nu aruncă excepții — erorile de logging nu trebuie
 * să întrerupă fluxul aplicației.
 *
 * Schema minimă așteptată pentru tabela `error_logs`:
 *   id (uuid, default gen_random_uuid()),
 *   created_at (timestamptz, default now()),
 *   context (text),
 *   message (text),
 *   data (jsonb, nullable),
 *   user_id (uuid, nullable),
 *   url (text, nullable)
 *
 * @param {string} context  - Numele modulului / funcției care a generat eroarea
 * @param {string} message  - Mesajul de eroare
 * @param {*}      [data]   - Date suplimentare (obiect, string, Error etc.)
 * @returns {void}
 * @private
 */
function _sendErrorToSupabase(context, message, data) {
    // ZFlowDB poate fi nedefinit în faza inițială de boot
    if (typeof ZFlowDB === 'undefined') return;

    // Serializăm `data` — Error objects nu sunt serializabile direct
    let serializedData = null;
    try {
        if (data instanceof Error) {
            serializedData = { name: data.name, message: data.message, stack: data.stack };
        } else if (data !== undefined && data !== null) {
            serializedData = JSON.parse(JSON.stringify(data)); // deep clone + verificare serializare
        }
    } catch (_) {
        serializedData = { raw: String(data) };
    }

    const payload = {
        context: String(context || ''),
        message: String(message || ''),
        data: serializedData,
        url: typeof location !== 'undefined' ? location.href : null,
        user_id: window.ZFlowStore?.userSession?.user?.id || null
    };

    // Insert asincron — nu blocăm fluxul curent
    Promise.resolve().then(async () => {
        try {
            // ZFlowDB.supabase expune clientul brut; alternativ folosim fetch direct dacă disponibil
            if (typeof ZFlowDB._rawClient === 'function') {
                const client = ZFlowDB._rawClient();
                if (client) {
                    await client.from('error_logs').insert([payload]);
                    return;
                }
            }
            // Fallback: dacă există window.zf (clientul brut definit în supabase.js)
            if (typeof window.zf !== 'undefined' && window.zf?.from) {
                await window.zf.from('error_logs').insert([payload]);
            }
        } catch (_) {
            // Logging failure silenced — nu putem loga recursiv
        }
    });
}

// =========================================================
// Formatare mesaj pentru consolă
// =========================================================

/**
 * Formatează un mesaj de log cu prefix standardizat.
 *
 * @param {string} level   - Nivelul: DEBUG | INFO | WARN | ERROR
 * @param {string} context - Modulul sau funcția sursă
 * @param {string} message - Mesajul uman-lizibil
 * @returns {string} Mesaj formatat cu timestamp și prefix
 * @private
 */
function _formatMessage(level, context, message) {
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    return `[Z-FLOW ${level}] [${ts}] [${context}] ${message}`;
}

// =========================================================
// API ZFlowLogger
// =========================================================

/**
 * @namespace ZFlowLogger
 * @description Logger centralizat Z-FLOW cu suport dev/prod.
 *
 * @example
 * ZFlowLogger.debug('init', 'Aplicația pornită', { version: '8.0' });
 * ZFlowLogger.info('auth', 'Utilizator autentificat');
 * ZFlowLogger.warn('fetch', 'Fetch lent detectat', { duration: 3200 });
 * ZFlowLogger.error('crud', 'Eroare salvare factură', err);
 */
const ZFlowLogger = {
    /**
     * Log nivel DEBUG — vizibil DOAR în development.
     * În producție mesajul este ignorat complet.
     *
     * @param {string} context  - Modulul sau funcția sursă
     * @param {string} message  - Mesajul de debug
     * @param {*}      [data]   - Date opționale suplimentare
     * @returns {void}
     */
    debug(context, message, data) {
        if (!_DEV) return;
        const msg = _formatMessage('DEBUG', context, message);
        data !== undefined
            ? console.log('%c' + msg, 'color:#6b7280', data)
            : console.log('%c' + msg, 'color:#6b7280');
    },

    /**
     * Log nivel INFO — vizibil DOAR în development.
     * În producție mesajul este ignorat complet.
     *
     * @param {string} context  - Modulul sau funcția sursă
     * @param {string} message  - Mesajul informativ
     * @param {*}      [data]   - Date opționale suplimentare
     * @returns {void}
     */
    info(context, message, data) {
        if (!_DEV) return;
        const msg = _formatMessage('INFO', context, message);
        data !== undefined
            ? console.info('%c' + msg, 'color:#2563eb', data)
            : console.info('%c' + msg, 'color:#2563eb');
    },

    /**
     * Log nivel WARN — vizibil în development.
     * În producție: afișat în consolă ca avertizare (util pentru monitoring DevTools).
     * NU este trimis la Supabase.
     *
     * @param {string} context  - Modulul sau funcția sursă
     * @param {string} message  - Mesajul de avertizare
     * @param {*}      [data]   - Date opționale suplimentare
     * @returns {void}
     */
    warn(context, message, data) {
        const msg = _formatMessage('WARN', context, message);
        data !== undefined
            ? console.warn(msg, data)
            : console.warn(msg);
    },

    /**
     * Log nivel ERROR — vizibil întotdeauna.
     * În development: afișat în consolă cu stack trace complet.
     * În producție: afișat în consolă ȘI trimis asincron la Supabase `error_logs`.
     *
     * @param {string} context  - Modulul sau funcția sursă (ex: 'crud', 'auth', 'financiar')
     * @param {string} message  - Descrierea erorii
     * @param {*}      [data]   - Detalii suplimentare (Error object, response, payload etc.)
     * @returns {void}
     */
    error(context, message, data) {
        const msg = _formatMessage('ERROR', context, message);
        data !== undefined
            ? console.error(msg, data)
            : console.error(msg);

        // Producție: trimite la Supabase pentru monitorizare centralizată
        if (!_DEV) {
            _sendErrorToSupabase(context, message, data);
        }
    },

    /**
     * Returnează true dacă aplicația rulează în modul development.
     * Util pentru cod condițional bazat pe mediu.
     *
     * @returns {boolean}
     */
    isDev() {
        return _DEV;
    }
};

// =========================================================
// Export global
// =========================================================
window.ZFlowLogger = ZFlowLogger;
