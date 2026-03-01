/**
 * Z-FLOW Enterprise v7.14
 * Supabase Service - Database Operations
 */

const URL_Z = "https://exrypxknksgrtrwnbtrl.supabase.co";
const KEY_Z = "sb_publishable_nKFEv_6AOyKBFp3f_AnZmw_MMZ9MXl5";

// Inițializăm clientul Supabase
const zf = supabase.createClient(URL_Z, KEY_Z);

/**
 * Încarcă toți clienții din baza de date
 */
async function fetchClienti() {
    const { data, error } = await zf
        .from("clienti")
        .select("*")
        .order("nume_firma");
    
    if (error) throw error;
    return data || [];
}

/**
 * Încarcă toate facturile din baza de date
 */
async function fetchFacturi() {
    const { data, error } = await zf
        .from("facturi")
        .select("*")
        .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
}

/**
 * Încarcă facturi cu paginare (lazy loading)
 * #6 TODO - Lazy loading facturi
 * @param {number} limit - Numărul de facturi de încărcat
 * @param {number} offset - Offset-ul de unde să înceapă
 * @param {string} clientId - Optional: filtrare după client
 * @returns {Promise<{data: Array, count: number}>}
 */
async function fetchFacturiPaginated(limit = 50, offset = 0, clientId = null) {
    let query = zf
        .from("facturi")
        .select("*", { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
    
    // Filtrare opțională după client
    if (clientId) {
        query = query.eq("client_id", clientId);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    return { data: data || [], count: count || 0 };
}

/**
 * Inserează o factură nouă
 */
async function insertFactura(payload) {
    const { error } = await zf.from("facturi").insert([payload]);
    if (error) throw error;
}

/**
 * Actualizează o factură existentă
 */
async function updateFactura(id, payload) {
    const { error } = await zf.from("facturi").update(payload).eq("id", id);
    if (error) throw error;
}

/**
 * Șterge o factură
 */
async function deleteFactura(id) {
    const { error } = await zf.from("facturi").delete().eq("id", id);
    if (error) throw error;
}

/**
 * Inserează un client nou
 */
async function insertClient(payload) {
    const { error } = await zf.from("clienti").insert([payload]);
    if (error) throw error;
}

/**
 * Actualizează un client existent
 */
async function updateClient(id, payload) {
    const { error } = await zf.from("clienti").update(payload).eq("id", id);
    if (error) throw error;
}

/**
 * Șterge un client
 */
async function deleteClient(id) {
    const { error } = await zf.from("clienti").delete().eq("id", id);
    if (error) throw error;
}

/**
 * Upload PDF factură în storage
 */
async function uploadFacturaPDF(file, numarFactura) {
    const fileName = `${Date.now()}_${numarFactura.replace(/\s+/g, "_")}.pdf`;
    
    const { data, error } = await zf.storage
        .from("facturi-pdf")
        .upload(fileName, file, { upsert: true });
    
    if (error) throw error;
    
    const { data: publicData } = zf.storage
        .from("facturi-pdf")
        .getPublicUrl(fileName);
    
    return publicData.publicUrl;
}

// ==========================================
// AUTENTIFICARE SUPABASE AUTH
// ==========================================

/**
 * Login cu email și parolă
 */
async function signIn(email, password) {
    const { data, error } = await zf.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) throw error;
    return data;
}

/**
 * Înregistrare utilizator nou
 */
async function signUp(email, password, metadata = {}) {
    const { data, error } = await zf.auth.signUp({
        email: email,
        password: password,
        options: {
            data: metadata
        }
    });
    
    if (error) throw error;
    return data;
}

/**
 * Deconectare
 */
async function signOut() {
    const { error } = await zf.auth.signOut();
    if (error) throw error;
}

/**
 * Obține sesiunea curentă
 */
async function getSession() {
    const { data: { session }, error } = await zf.auth.getSession();
    if (error) throw error;
    return session;
}

/**
 * Obține utilizatorul curent
 */
async function getCurrentUser() {
    const { data: { user }, error } = await zf.auth.getUser();
    if (error) throw error;
    return user;
}

/**
 * Ascultă schimbările de autentificare
 */
function onAuthStateChange(callback) {
    return zf.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

/**
 * Reset parolă
 */
async function resetPassword(email) {
    const { error } = await zf.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
    });
    if (error) throw error;
}

// Export pentru utilizare globală (fără module ES6 native în browser)
window.ZFlowDB = {
    zf,
    fetchClienti,
    fetchFacturi,
    fetchFacturiPaginated,
    insertFactura,
    updateFactura,
    deleteFactura,
    insertClient,
    updateClient,
    deleteClient,
    uploadFacturaPDF,
    // Auth functions
    signIn,
    signUp,
    signOut,
    getSession,
    getCurrentUser,
    onAuthStateChange,
    resetPassword
};
