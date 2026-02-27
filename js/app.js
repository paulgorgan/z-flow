/**
 * Z-FLOW Enterprise v7.14
 * App Principal - Vue 3 CDN
 */

// Timer debounce pentru căutări
let debounceSearchTimer = null;

/**
 * Funcție utilHelper: debounce
 */
function debounce(func, delay) {
    return function (...args) {
        clearTimeout(debounceSearchTimer);
        debounceSearchTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Formatează data în format ZZ/LL/AA
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
 * Setează loader global
 */
function setLoader(v) {
    const loader = document.getElementById("loader-global");
    if (loader) loader.classList.toggle("hidden", !v);
    ZFlowStore.isLoading = v;
}

/**
 * Afișează notificare toast
 */
function showNotification(message, type = "info", duration = 3500) {
    const id = "notify-" + Date.now();
    const colors = {
        success: "bg-emerald-500",
        error: "bg-red-500",
        warning: "bg-yellow-500",
        info: "bg-blue-500"
    };
    const notif = document.createElement("div");
    notif.id = id;
    notif.className = `fixed top-4 right-4 ${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg z-[1000] animate-pulse text-sm font-medium`;
    notif.innerText = message;
    document.body.appendChild(notif);
    setTimeout(() => notif?.remove(), duration);
}

/**
 * Afișează mesaj "niciun rezultat"
 */
function showEmptyState(container, title = "Niciun rezultat", text = "Nicio dată disponibilă în perioada selectată") {
    container.innerHTML = `<div class="text-center py-10 text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto opacity-30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p class="font-bold text-sm uppercase tracking-wider">${title}</p>
        <p class="text-xs mt-2 opacity-60">${text}</p>
    </div>`;
}

/**
 * Skeleton Loader pentru încărcare
 */
function showSkeletonLoader(container, count = 5) {
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement("div");
        skeletonCard.className = "bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 mb-3 animate-pulse";
        skeletonCard.innerHTML = `
            <div class="skeleton-loader h-6 w-3/4 mb-4" style="border-radius: 6px;"></div>
            <div class="skeleton-loader h-4 w-1/2 mb-3" style="border-radius: 4px;"></div>
            <div class="flex justify-between">
                <div class="skeleton-loader h-5 w-1/3" style="border-radius: 6px;"></div>
                <div class="skeleton-loader h-5 w-1/4" style="border-radius: 6px;"></div>
            </div>
        `;
        container.appendChild(skeletonCard);
    }
}

/**
 * Auto-label pentru accessibility
 */
function setAriaLabels() {
    document.querySelectorAll("button").forEach(btn => {
        if (!btn.getAttribute("aria-label") && btn.innerText) {
            btn.setAttribute("aria-label", btn.innerText.trim());
        }
    });
    document.querySelectorAll("input[placeholder]").forEach(inp => {
        if (!inp.getAttribute("aria-label") && inp.placeholder) {
            inp.setAttribute("aria-label", inp.placeholder);
        }
    });
}

// ==========================================
// FUNCȚII DE INIȚIALIZARE
// ==========================================

/**
 * Funcție principală de inițializare
 */
async function init() {
    // Verificare autentificare obligatorie (async)
    const isAuthenticated = await checkSession();
    
    if (!isAuthenticated) {
        document.getElementById("modal-auth").classList.add("active");
        
        // Ascunde interfața
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = 'none';
        if (header) header.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabMenu) fabMenu.style.display = 'none';
        
        setLoader(false);
        return; // Blochează încărcarea datelor fără autentificare
    }
    
    console.log("🚀 Start Sincronizare Z-Flow...");
    setLoader(true);

    const listaContainer = document.getElementById("lista-firme-global");
    if (listaContainer) {
        showSkeletonLoader(listaContainer, 8);
    }

    try {
        // Fetch clienți și facturi
        const cl = await ZFlowDB.fetchClienti();
        console.log("✅ Clienți descărcați:", cl.length);

        const fc = await ZFlowDB.fetchFacturi();
        console.log("✅ Facturi descărcate:", fc.length);

        ZFlowStore.dateFacturiBI = fc || [];

        const azi = new Date();
        azi.setHours(0, 0, 0, 0);

        // Procesăm datele locale
        ZFlowStore.dateLocal = (cl || []).map((c) => {
            const fcs = ZFlowStore.dateFacturiBI.filter((f) => String(f.client_id) === String(c.id));
            const sold = fcs
                .filter((f) => f.status_plata !== "Incasat")
                .reduce((sum, f) => sum + (Number(f.valoare) || 0), 0);
            const sumaScadenta = fcs.reduce((acc, fac) => {
                if (fac.status_plata !== "Incasat" && fac.data_scadenta) {
                    const dScad = new Date(fac.data_scadenta);
                    dScad.setHours(0, 0, 0, 0);
                    if (dScad < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);
            return {
                ...c,
                facturi: fcs,
                sold: sold,
                sumaScadenta: sumaScadenta,
            };
        });

        console.log("📊 Date procesate local:", ZFlowStore.dateLocal.length);

        renderMain();
        updateDashboardKPI();
        populeazaBridgeUI();
        if (document.getElementById("map")) renderTransportTab();
        saveZFlowData();

    } catch (err) {
        console.error("❌ EROARE:", err);
        showNotification("Eroare la încărcare: " + err.message, "error");
    } finally {
        setLoader(false);
    }

    comutaVedereFin("firme");
    updateDateLabels();
    updateSyncStatus();
    setAriaLabels();
}

/**
 * Actualizează statusul sincronizării
 */
function updateSyncStatus() {
    const ultimaSincronizare = new Date();
    const sapteZileInMs = 7 * 24 * 60 * 60 * 1000;
    const acum = new Date();
    const punctStatus = document.querySelector(".bg-blue-900 .w-1\\.5.h-1\\.5");
    const textStatus = document.querySelector(".bg-blue-900 .text-blue-100");

    if (acum - ultimaSincronizare > sapteZileInMs) {
        if (punctStatus) punctStatus.classList.replace("bg-emerald-500", "bg-red-500");
        if (textStatus) textStatus.innerText = "Sincronizare SAGA: Necesară (peste 7 zile)";
    } else {
        if (punctStatus) punctStatus.classList.replace("bg-red-500", "bg-emerald-500");
        if (textStatus) textStatus.innerText = "Sincronizat SAGA: Recent (sub 7 zile)";
    }
}

/**
 * Actualizează mini-dashboard KPI
 */
function updateDashboardKPI() {
    const facturi = ZFlowStore.dateFacturiBI || [];
    const clienti = ZFlowStore.dateLocal || [];
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);
    
    // Luna curentă
    const lunaCurenta = azi.getMonth();
    const anulCurent = azi.getFullYear();
    
    let totalIncasat = 0;
    let totalRestante = 0; // Doar facturile DEPĂȘITE (scadență < azi)
    let totalLunaAceasta = 0;
    
    facturi.forEach(f => {
        const valoare = Number(f.valoare) || 0;
        
        // Încasat total
        if (f.status_plata === "Incasat") {
            totalIncasat += valoare;
        } else {
            // Restante = neîncasate cu scadență DEPĂȘITĂ
            if (f.data_scadenta) {
                const dataScadenta = new Date(f.data_scadenta);
                dataScadenta.setHours(0, 0, 0, 0);
                if (dataScadenta < azi) {
                    totalRestante += valoare;
                }
            }
        }
        
        // Facturat luna aceasta (după data emiterii)
        if (f.data_emiterii) {
            const dataEmitere = new Date(f.data_emiterii);
            if (dataEmitere.getMonth() === lunaCurenta && dataEmitere.getFullYear() === anulCurent) {
                totalLunaAceasta += valoare;
            }
        }
    });
    
    // Format scurt pentru numere mari
    const formatScurt = (val) => {
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return Math.round(val).toString();
    };
    
    // Update UI
    const kpiIncasat = document.getElementById("kpi-incasat");
    const kpiRestante = document.getElementById("kpi-restante");
    const kpiClienti = document.getElementById("kpi-clienti");
    const kpiLuna = document.getElementById("kpi-luna");
    
    if (kpiIncasat) kpiIncasat.innerText = formatScurt(totalIncasat);
    if (kpiRestante) kpiRestante.innerText = formatScurt(totalRestante);
    if (kpiClienti) kpiClienti.innerText = clienti.length.toString();
    if (kpiLuna) kpiLuna.innerText = formatScurt(totalLunaAceasta);
}

/**
 * Verifică autentificarea și inițializează (Supabase Auth + Demo fallback)
 */
async function verificaAuth() {
    const email = document.getElementById("auth-username").value.trim();
    const pass = document.getElementById("auth-password").value;

    if (!email || !pass) {
        showNotification("❌ Completează email și parola", "error");
        return;
    }

    setLoader(true);
    
    // FALLBACK: Credențiale demo (admin/1234 sau user/pass)
    if ((email === "admin" && pass === "1234") || (email === "user" && pass === "pass")) {
        const role = (email === "admin") ? 'admin' : 'user';
        ZFlowStore.userSession = { user: { email: email }, isDemo: true };
        saveDemoSession(email, role); // Salvează sesiunea demo cu rol
        setUserRole(role); // Setează permisiunile
        document.getElementById("modal-auth").classList.remove("active");
        
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';
        
        showNotification(`✅ Bun venit, ${email}! (${role === 'admin' ? 'Admin' : 'User'})`, "success");
        setLoader(false);
        init();
        return;
    }
    
    try {
        // Încearcă autentificare Supabase
        const { session, user } = await ZFlowDB.signIn(email, pass);
        
        ZFlowStore.userSession = session;
        document.getElementById("modal-auth").classList.remove("active");
        
        // Afișează interfața după autentificare reușită
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';
        
        showNotification(`✅ Bun venit, ${user.email}!`, "success");
        init();
    } catch (error) {
        console.error("Auth error:", error);
        
        // Mesaje de eroare prietenoase
        let errorMsg = "❌ Eroare la autentificare";
        if (error.message.includes("Invalid login")) {
            errorMsg = "❌ Email sau parolă incorectă";
        } else if (error.message.includes("Email not confirmed")) {
            errorMsg = "⚠️ Confirmă email-ul înainte de autentificare";
        } else if (error.message.includes("Too many requests")) {
            errorMsg = "⚠️ Prea multe încercări. Așteaptă puțin.";
        }
        
        showNotification(errorMsg, "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Deconectare utilizator (Supabase Auth + Demo)
 */
async function logout() {
    setLoader(true);
    
    try {
        // Șterge sesiunea demo dacă există
        localStorage.removeItem("zflow_demo_session");
        
        // Încearcă deconectare Supabase (dacă nu e sesiune demo)
        if (ZFlowStore.userSession && !ZFlowStore.userSession.isDemo) {
            await ZFlowDB.signOut();
        }
        
        ZFlowStore.userSession = null;
        
        // Ascunde interfața
        const mainContent = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabMenu = document.getElementById('fab-menu');
        
        if (mainContent) mainContent.style.display = 'none';
        if (header) header.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabMenu) fabMenu.style.display = 'none';
        
        // Curăță câmpurile de autentificare
        document.getElementById("auth-username").value = '';
        document.getElementById("auth-password").value = '';
        
        // Afișează modalul de autentificare
        document.getElementById("modal-auth").classList.add("active");
        
        showNotification("👋 Deconectat cu succes!", "info");
    } catch (error) {
        console.error("Logout error:", error);
        showNotification("❌ Eroare la deconectare", "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Deschide modalul de înregistrare
 */
function deschideModalInregistrare() {
    document.getElementById("modal-auth").classList.remove("active");
    document.getElementById("modal-register").classList.add("active");
}

/**
 * Deschide modalul de reset parolă
 */
function deschideModalResetParola() {
    document.getElementById("modal-auth").classList.remove("active");
    document.getElementById("modal-reset-password").classList.add("active");
}

/**
 * Înregistrare utilizator nou
 */
async function inregistrareUtilizator() {
    const email = document.getElementById("reg-email").value.trim();
    const pass = document.getElementById("reg-password").value;
    const passConfirm = document.getElementById("reg-password-confirm").value;
    const nume = document.getElementById("reg-nume").value.trim();
    
    // Validări
    if (!email || !pass) {
        showNotification("❌ Completează toate câmpurile obligatorii", "error");
        return;
    }
    
    if (pass !== passConfirm) {
        showNotification("❌ Parolele nu coincid", "error");
        return;
    }
    
    if (pass.length < 6) {
        showNotification("❌ Parola trebuie să aibă minim 6 caractere", "error");
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification("❌ Email invalid", "error");
        return;
    }
    
    setLoader(true);
    
    try {
        await ZFlowDB.signUp(email, pass, { nume: nume });
        
        document.getElementById("modal-register").classList.remove("active");
        document.getElementById("modal-auth").classList.add("active");
        
        // Curăță câmpurile
        document.getElementById("reg-email").value = '';
        document.getElementById("reg-password").value = '';
        document.getElementById("reg-password-confirm").value = '';
        document.getElementById("reg-nume").value = '';
        
        showNotification("✅ Cont creat! Verifică-ți email-ul pentru confirmare.", "success");
    } catch (error) {
        console.error("Register error:", error);
        
        let errorMsg = "❌ Eroare la înregistrare";
        if (error.message.includes("already registered")) {
            errorMsg = "❌ Acest email este deja înregistrat";
        }
        
        showNotification(errorMsg, "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Trimite email pentru reset parolă
 */
async function trimiteResetParola() {
    const email = document.getElementById("reset-email").value.trim();
    
    if (!email) {
        showNotification("❌ Introdu adresa de email", "error");
        return;
    }
    
    setLoader(true);
    
    try {
        await ZFlowDB.resetPassword(email);
        
        document.getElementById("modal-reset-password").classList.remove("active");
        document.getElementById("modal-auth").classList.add("active");
        
        document.getElementById("reset-email").value = '';
        
        showNotification("✅ Email trimis! Verifică-ți căsuța.", "success");
    } catch (error) {
        console.error("Reset password error:", error);
        showNotification("❌ Eroare la trimiterea email-ului", "error");
    } finally {
        setLoader(false);
    }
}

/**
 * Închide modalul de înregistrare și revine la login
 */
function inchideModalRegister() {
    document.getElementById("modal-register").classList.remove("active");
    document.getElementById("modal-auth").classList.add("active");
}

/**
 * Închide modalul de reset parolă și revine la login
 */
function inchideModalResetPassword() {
    document.getElementById("modal-reset-password").classList.remove("active");
    document.getElementById("modal-auth").classList.add("active");
}

/**
 * Update date labels pentru filtre perioadă
 */
function updateDateLabels() {
    ["data-start", "data-end"].forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener("change", function () {
                const labelId = id === "data-start" ? "label-start" : "label-end";
                const prefix = id === "data-start" ? "DE LA: " : "PÂNĂ LA: ";
                const labelEl = document.getElementById(labelId);
                if (this.value && labelEl) {
                    labelEl.innerText = prefix + formateazaDataZFlow(this.value);
                    labelEl.parentElement.classList.add("border-blue-200");
                    genereazaBI();
                }
            });
        }
    });
}

// ==========================================
// NAVIGARE UI
// ==========================================

/**
 * Schimbă tab-ul principal
 */
function schimbaTab(id, btn) {
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.querySelectorAll(".nav-item").forEach((l) => l.classList.remove("active"));
    if (btn) btn.classList.add("active");

    document.getElementById("nav-btn-actions").style.display = id === "financiar" ? "flex" : "none";

    if (id === "logistic") initMap();
    if (id === "depozit") initScanner();

    const btnActions = document.getElementById("nav-btn-actions");
    if (btnActions) {
        const esteInDetalii = !document.getElementById("view-detalii").classList.contains("hidden");
        btnActions.style.display = id === "financiar" && !esteInDetalii ? "flex" : "none";
    }

    ZFlowStore.currentTab = id;
}

/**
 * Comută vederea financiară
 */
function comutaVedereFin(v) {
    ["view-firme", "view-analiza", "view-detalii"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add("hidden");
            el.style.display = "";
        }
    });

    const vedereActiva = document.getElementById("view-" + v);
    if (vedereActiva) {
        vedereActiva.classList.remove("hidden");
    }

    // Logică buton acțiuni - disponibil doar în categoria Clienți
    const btnActions = document.getElementById("nav-btn-actions");
    if (btnActions) {
        if (v === "detalii") {
            btnActions.style.display = "flex";
            btnActions.querySelector("span").innerText = "DOC NOU";
            btnActions.setAttribute("onclick", "deschideModalDirectFactura()");
            btnActions.classList.add("text-blue-600", "animate-pulse");
        } else if (v === "firme") {
            btnActions.style.display = "flex";
            btnActions.querySelector("span").innerText = "ACȚIUNI";
            btnActions.setAttribute("onclick", "toggleFAB()");
            btnActions.classList.remove("text-blue-600", "animate-pulse");
        } else {
            // Ascunde butonul în Analiză și alte vederi
            btnActions.style.display = "none";
        }
    }

    // Update vizual butoane Pill
    document.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
    if (v !== "detalii") {
        const btnActiv = document.getElementById("btn-" + v);
        if (btnActiv) btnActiv.classList.add("active");
    }

    if (v === "analiza") genereazaBI();
    else if (v === "firme") renderMain();

    ZFlowStore.currentView = v;
}

/**
 * Toggle FAB Menu
 */
function toggleFAB() {
    document.getElementById("fab-menu").classList.toggle("active");
}

// ==========================================
// RENDER CLIENȚI
// ==========================================

/**
 * Renderizează lista principală de clienți
 */
function renderMain(lista = null) {
    const container = document.getElementById("lista-firme-global");
    let sursa = lista || ZFlowStore.dateLocal;
    if (!container) return;

    if (sursa.length === 0) {
        showEmptyState(container, "Niciun client", "Niciun client adăugat în sistem");
        return;
    }

    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Sortare: Facturile depășite primele
    sursa.sort((a, b) => {
        const aRestant = (a.facturi || []).some(
            (f) =>
                f.status_plata !== "Incasat" &&
                f.data_scadenta &&
                new Date(f.data_scadenta).setHours(0, 0, 0, 0) < azi
        );
        const bRestant = (b.facturi || []).some(
            (f) =>
                f.status_plata !== "Incasat" &&
                f.data_scadenta &&
                new Date(f.data_scadenta).setHours(0, 0, 0, 0) < azi
        );
        return bRestant - aRestant;
    });

    container.innerHTML = sursa
        .map((f) => {
            const sumaScadenta = (f.facturi || []).reduce((acc, fac) => {
                if (fac.status_plata !== "Incasat" && fac.data_scadenta) {
                    const dScad = new Date(fac.data_scadenta);
                    dScad.setHours(0, 0, 0, 0);
                    if (dScad < azi) return acc + (Number(fac.valoare) || 0);
                }
                return acc;
            }, 0);

            const areRestante = sumaScadenta > 0;

            return `
<div onclick="arataDetalii('${f.id}')" class="card-flow group flex flex-col p-5 mb-3 transition-all cursor-pointer relative overflow-hidden bg-white border border-slate-100 hover:border-blue-200 hover:shadow-lg active:scale-[0.98]">
    ${areRestante ? `<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.3)]"></div>` : ""}
    <div class="flex justify-between items-start w-full">
        <div class="max-w-[60%]">
            <h4 class="font-extrabold text-slate-800 text-[15px] leading-tight truncate tracking-tight">${f.nume_firma || f.cui}</h4>
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="w-2 h-2 rounded-full ${areRestante ? "bg-red-400" : "bg-emerald-400"}"></span>
                <p class="text-[10px] font-semibold text-slate-400">${f.oras || "Zalău"}</p>
            </div>
        </div>
        <div class="text-right flex flex-col items-end">
            <p class="text-blue-900 font-black text-[20px] leading-none tracking-tighter">${Math.round(f.sold).toLocaleString()} <span class="text-[11px] font-bold">lei</span></p>
            <p class="text-[9px] font-semibold text-slate-400 mt-1">Sold total</p>
        </div>
    </div>
    ${areRestante ? `
    <div class="mt-3 py-2.5 px-3 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <p class="text-[9px] font-bold text-red-500 uppercase">Scadență depășită</p>
        </div>
        <p class="text-red-600 font-black text-[13px] leading-none">${Math.round(sumaScadenta).toLocaleString()} lei</p>
    </div>` : ""}
    <div class="flex gap-3 mt-4">
        <button onclick="event.stopPropagation(); arataDetalii('${f.id}')"
                class="flex-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 border border-blue-100 hover:border-blue-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            Facturi
        </button>
        <button onclick="event.stopPropagation(); deschideModal('modal-client', '${f.id}')"
                class="flex-1 bg-slate-50 hover:bg-slate-700 hover:text-white text-slate-600 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Profil
        </button>
    </div>
</div>`;
        })
        .join("");

    // Update Total Portofoliu
    const totalPort = ZFlowStore.dateLocal.reduce((acc, f) => acc + (Number(f.sold) || 0), 0);
    const totalEl = document.getElementById("total-general");
    if (totalEl) totalEl.innerText = `${Math.round(totalPort).toLocaleString()} lei`;
}

// Debounce pentru căutarea clienți
const filtreazaListaFirmeDebounced = debounce(function () {
    const q = document.getElementById("search-firme").value.toLowerCase();
    renderMain(
        ZFlowStore.dateLocal.filter(
            (f) =>
                (f.nume_firma || "").toLowerCase().includes(q) ||
                f.cui.includes(q)
        )
    );
}, 300);

function filtreazaListaFirme() {
    filtreazaListaFirmeDebounced();
}

// ==========================================
// DETALII CLIENT & FACTURI
// ==========================================

/**
 * Arată detaliile unui client
 */
function arataDetalii(id) {
    const f = ZFlowStore.dateLocal.find((x) => String(x.id) === String(id));
    if (!f) return;

    const inputIdClient = document.getElementById("in-client-id");
    if (inputIdClient) inputIdClient.value = id;

    ZFlowStore.selectedClientId = id;
    comutaVedereFin("detalii");

    document.getElementById("btn-edit-client-active").onclick = () => deschideModal("modal-client", f.id);

    // Header Profil cu ALERTA pentru Scadență
    const sumaScadenta = f.sumaScadenta || 0;
    const areScadenta = sumaScadenta > 0;
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    document.getElementById("card-detaliu").innerHTML = `
        <h2 class="text-2xl font-black uppercase tracking-tight leading-tight">${f.nume_firma || f.cui}</h2>
        <p class="text-[11px] opacity-70 uppercase mt-1 font-bold tracking-widest text-blue-200">CUI: ${f.cui}</p>
        <div class="mt-4">
            <p class="text-[9px] font-bold opacity-50 uppercase tracking-widest">Sold de Încasat</p>
            <p class="text-3xl font-black text-white tracking-tighter">${Math.round(f.sold).toLocaleString()} lei</p>
        </div>
        ${areScadenta ? `
        <div class="mt-6 py-3 px-4 bg-red-500/20 rounded-2xl border border-red-400/50 flex justify-between items-center animate-pulse">
            <p class="text-[8px] font-black text-red-300 uppercase tracking-widest">⚠️ Facturi Depășite</p>
            <p class="text-red-200 font-black text-[14px] leading-none">${Math.round(sumaScadenta).toLocaleString()} lei</p>
        </div>` : ''}
    `;

    const containerFacturi = document.getElementById("lista-facturi-detaliu");

    // Sortare Facturi
    const facturiSortate = [...f.facturi].sort((a, b) => {
        const aScad = a.data_scadenta ? new Date(a.data_scadenta).setHours(0, 0, 0, 0) : null;
        const bScad = b.data_scadenta ? new Date(b.data_scadenta).setHours(0, 0, 0, 0) : null;
        const aDepas = a.status_plata !== "Incasat" && aScad && aScad < azi ? 1 : 0;
        const bDepas = b.status_plata !== "Incasat" && bScad && bScad < azi ? 1 : 0;

        const aPriority = aDepas ? 3 : (a.status_plata !== "Incasat" ? 2 : 1);
        const bPriority = bDepas ? 3 : (b.status_plata !== "Incasat" ? 2 : 1);

        if (aPriority !== bPriority) return bPriority - aPriority;
        if (aScad && bScad && (aDepas || bDepas)) return aScad - bScad;
        if (aScad && bScad) return aScad - bScad;
        return 0;
    });

    // Generare HTML Facturi
    const htmlFacturi = facturiSortate.map((fac) => {
        const isIncasat = fac.status_plata === "Incasat";
        const dScad = fac.data_scadenta ? new Date(fac.data_scadenta) : null;
        if (dScad) dScad.setHours(0, 0, 0, 0);
        const esteScadenta = !isIncasat && dScad && dScad < azi;

        const uitHtml = fac.numar_auto ? `
            <div onclick="event.stopPropagation(); schimbaTab('logistic', document.querySelectorAll('.nav-item')[1])"
                 class="flex items-center justify-center gap-2 bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl cursor-pointer hover:bg-blue-600 group transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-blue-900 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" />
                </svg>
                <span class="text-[10px] font-black text-blue-900 group-hover:text-white uppercase">${fac.numar_auto}</span>
            </div>` : `
            <div class="flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 px-3 py-2 rounded-xl opacity-40">
                <span class="text-[9px] font-bold text-slate-400 uppercase italic">FĂRĂ TRP</span>
            </div>`;

        return `
        <div class="card-factura-client card-flow flex flex-col gap-3 p-4 mb-3 bg-white border border-slate-100 rounded-2xl shadow-sm" data-nr="${fac.numar_factura}">
            <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center gap-2 bg-slate-50 border border-slate-100 px-2 py-2 rounded-xl">
                    <span class="flex h-2 w-2 relative">
                        <span class="relative inline-flex rounded-full h-2 w-2 ${fac.status_anaf === 'validated' ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
                    </span>
                    <span class="text-[9px] font-black uppercase tracking-tighter ${fac.status_anaf === 'validated' ? 'text-emerald-700' : 'text-amber-700'}">
                        ${fac.status_anaf === 'validated' ? 'SPV VALIDAT' : 'SPV AȘTEPTARE'}
                    </span>
                </div>
                ${uitHtml}
            </div>

            <div class="flex justify-between items-center py-1">
                <div>
                    <h4 class="font-black text-slate-800 text-[15px]">#${fac.numar_factura || 'N/A'}</h4>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">Emis: ${formateazaDataZFlow(fac.data_emiterii)}</p>
                </div>
                <div class="text-right">
                    <p class="font-black ${esteScadenta ? 'text-red-600 animate-pulse' : 'text-blue-900'} text-[18px] leading-none tracking-tighter">
                        ${Number(fac.valoare || 0).toLocaleString()} lei
                    </p>
                    <p class="text-[9px] font-black text-slate-300 uppercase mt-1">Scadență: ${formateazaDataZFlow(fac.data_scadenta)}</p>
                </div>
            </div>

            <div class="flex gap-2 mt-1">
                <button onclick="toggleStatusPlata('${fac.id}', '${fac.status_plata}')"
                        class="flex-[2.5] md:flex-1 ${isIncasat ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-900 text-white'} h-11 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                    ${isIncasat ? 'ACHITAT' : 'ÎNCASARE'}
                </button>
                <button onclick="deschideModal('modal-factura', '${fac.id}')"
                        class="w-11 h-11 shrink-0 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center border border-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onclick="event.stopPropagation(); printInvoice('${fac.id}')"
                        class="w-11 h-11 shrink-0 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center border border-slate-100 hover:bg-blue-50 hover:text-blue-900 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                ${fac.pdf_url ? `
                    <a href="${fac.pdf_url}" target="_blank" class="w-11 h-11 shrink-0 bg-slate-800 text-white flex items-center justify-center rounded-xl shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /></svg>
                    </a>` : `
                    <button onclick="deschideModal('modal-factura', '${fac.id}')" class="w-11 h-11 shrink-0 bg-white text-slate-300 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-100">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                    </button>`}
                <button onclick="event.stopPropagation(); trimiteEmailDebitor('${f.contact_email}', '${fac.numar_factura}', '${fac.valoare}')"
                        class="w-11 h-11 shrink-0 ${esteScadenta ? 'bg-red-600 text-white animate-pulse' : 'bg-indigo-50 text-indigo-400'} rounded-xl flex items-center justify-center transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0l-9.75 6.75-9.75-6.75m19.5 0l-9.75-6.75" /></svg>
                </button>
                <button onclick="stergeFactura('${fac.id}')"
                        class="w-11 h-11 shrink-0 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>`;
    }).join("");

    // Bară de Căutare Sticky & Rezultate
    containerFacturi.innerHTML = `
        <div class="sticky top-0 bg-[#f1f5f9]/95 backdrop-filter backdrop-blur-md z-30 pb-4 pt-2">
            <div class="relative">
                <input type="text" id="search-facturi-detaliu" oninput="filtreazaFacturiInDetalii()" placeholder="Caută nr. factură..." class="w-full h-12 pl-12 bg-white rounded-2xl border border-slate-200 text-[13px] font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                <div class="absolute left-4 top-3.5 text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>
        </div>
        <div id="lista-facturi-content" class="flex flex-col gap-3">${htmlFacturi}</div>`;
}

/**
 * Filtrează facturile în detalii
 */
function filtreazaFacturiInDetalii() {
    const input = document.getElementById("search-facturi-detaliu");
    if (!input) return;

    const termen = input.value.toLowerCase().trim();
    const carduri = document.querySelectorAll("#lista-facturi-content .card-factura-client");

    carduri.forEach(card => {
        const nrFactura = card.getAttribute("data-nr") ? card.getAttribute("data-nr").toLowerCase() : "";

        if (nrFactura.includes(termen)) {
            card.style.setProperty("display", "flex", "important");
        } else {
            card.style.setProperty("display", "none", "important");
        }
    });
}

// ==========================================
// ANALIZĂ BI
// ==========================================

/**
 * Populează UI-ul pentru analiză BI
 */
function populeazaBridgeUI() {
    // Dropdown factură
    const selectClient = document.getElementById("in-fac-client");
    if (selectClient) {
        selectClient.innerHTML =
            '<option value="">Alege Clientul...</option>' +
            ZFlowStore.dateLocal.map((f) => `<option value="${f.id}">${f.nume_firma || f.cui}</option>`).join("");
    }

    // Checkbox-uri pentru analiză
    const containerBI = document.getElementById("container-bi-checks");
    if (containerBI) {
        containerBI.innerHTML = ZFlowStore.dateLocal
            .map((f) => `
                <label class="flex justify-between items-center p-4 bg-slate-50 rounded-xl mb-1 text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                    <span>${f.nume_firma || f.cui}</span>
                    <input type="checkbox" value="${f.id}" checked
                           onchange="genereazaBI()"
                           class="w-5 h-5 accent-blue-900 bi-checkbox">
                </label>
            `)
            .join("");
    }

    genereazaBI();
}

/**
 * Toggle toate firmele în BI
 */
function toggleFirmeBI(status) {
    document.querySelectorAll("#container-bi-checks input").forEach((c) => (c.checked = status));
    genereazaBI();
}

/**
 * Recalculează analiza instant
 */
function updateAnalizaInstant() {
    if (!document.getElementById("view-analiza") || document.getElementById("view-analiza").classList.contains("hidden")) return;
    genereazaBI();
}

/**
 * Generează raportul BI
 */
function genereazaBI() {
    const startVal = document.getElementById("data-start")?.value;
    const endVal = document.getElementById("data-end")?.value;
    const q = document.getElementById("search-bi")?.value.toLowerCase();
    const container = document.getElementById("rezultat-analiza");
    const sumaDisplay = document.getElementById("suma-selectata-bi");
    if (!container) return;

    const ids = Array.from(document.querySelectorAll("#container-bi-checks input:checked")).map((i) => String(i.value));
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);

    // Convertim datele de filtru în obiecte Date pentru comparație corectă
    const startDate = startVal ? new Date(startVal) : null;
    const endDate = endVal ? new Date(endVal) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    // Debug log
    console.log("🔍 Filtrare BI - Start:", startVal, "End:", endVal, "Clienți selectați:", ids.length, "Total facturi:", ZFlowStore.dateFacturiBI.length);
    
    // Log primele 3 facturi pentru debug
    if (ZFlowStore.dateFacturiBI.length > 0) {
        console.log("📋 Sample facturi (primele 3):");
        ZFlowStore.dateFacturiBI.slice(0, 3).forEach((f, i) => {
            console.log(`  ${i+1}. data_emiterii: "${f.data_emiterii}", created_at: "${f.created_at}", nr: ${f.numar_factura}`);
        });
    }

    const filtrate = ZFlowStore.dateFacturiBI.filter((f) => {
        // Folosim data_emiterii pentru filtrare, cu fallback la created_at
        const dataFactura = f.data_emiterii || f.created_at || "";
        
        // Parsăm data - suportăm mai multe formate
        let facturaDate = null;
        if (dataFactura) {
            // Verificăm dacă e în format DD/MM/YY sau DD/MM/YYYY
            if (dataFactura.includes("/")) {
                const parts = dataFactura.split("/");
                if (parts.length === 3) {
                    let year = parseInt(parts[2]);
                    if (year < 100) year += 2000; // 26 -> 2026
                    facturaDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            } else {
                // Format ISO sau similar
                facturaDate = new Date(dataFactura);
            }
            if (facturaDate) facturaDate.setHours(12, 0, 0, 0);
        }
        
        // Verificăm dacă data e validă
        const dateValid = facturaDate && !isNaN(facturaDate.getTime());
        
        // Match pe interval de date
        let matchData = true;
        if (startDate && dateValid) {
            matchData = matchData && facturaDate >= startDate;
        }
        if (endDate && dateValid) {
            matchData = matchData && facturaDate <= endDate;
        }
        
        const matchStatus = ZFlowStore.filtruStatusBI === "toate" || f.status_plata === ZFlowStore.filtruStatusBI;
        const client = ZFlowStore.dateLocal.find((c) => String(c.id) === String(f.client_id));
        const numeClient = (client?.nume_firma || "").toLowerCase();
        const nrFactura = (f.numar_factura || "").toLowerCase();
        const matchSearch = !q || numeClient.includes(q) || nrFactura.includes(q);
        return matchData && ids.includes(String(f.client_id)) && matchStatus && matchSearch;
    });

    console.log("✅ Facturi filtrate:", filtrate.length);

    // Sortare
    filtrate.sort((a, b) => {
        const aScad = a.data_scadenta ? new Date(a.data_scadenta).setHours(0, 0, 0, 0) : null;
        const bScad = b.data_scadenta ? new Date(b.data_scadenta).setHours(0, 0, 0, 0) : null;
        const aDepas = a.status_plata !== "Incasat" && aScad && aScad < azi ? 1 : 0;
        const bDepas = b.status_plata !== "Incasat" && bScad && bScad < azi ? 1 : 0;

        const aPriority = aDepas ? 3 : (a.status_plata !== "Incasat" ? 2 : 1);
        const bPriority = bDepas ? 3 : (b.status_plata !== "Incasat" ? 2 : 1);

        if (aPriority !== bPriority) return bPriority - aPriority;
        if (aScad && bScad && (aDepas || bDepas)) return aScad - bScad;
        if (aScad && bScad) return aScad - bScad;
        return 0;
    });

    const total = filtrate.reduce((acc, f) => acc + (Number(f.valoare) || 0), 0);
    if (sumaDisplay) sumaDisplay.innerText = `${Math.round(total).toLocaleString()} lei`;

    // Paginare
    const totalPages = Math.ceil(filtrate.length / ZFlowStore.biPageSize) || 1;
    if (ZFlowStore.biCurrentPage > totalPages) ZFlowStore.biCurrentPage = totalPages;
    const pageInfo = document.getElementById("bi-page-info");
    if (pageInfo) pageInfo.innerText = `Pagina ${ZFlowStore.biCurrentPage} din ${totalPages} (${filtrate.length} facturi)`;

    if (filtrate.length === 0) {
        showEmptyState(container, "Niciun rezultat", "Nicio factură găsită în perioada selectată");
        return;
    }

    const startIdx = (ZFlowStore.biCurrentPage - 1) * ZFlowStore.biPageSize;
    const endIdx = startIdx + ZFlowStore.biPageSize;
    const paginatedData = filtrate.slice(startIdx, endIdx);

    container.innerHTML = paginatedData.map((f) => {
        const client = ZFlowStore.dateLocal.find((c) => String(c.id) === String(f.client_id));
        const isIncasat = f.status_plata === "Incasat";
        return `<div class="card-flow flex items-center justify-between min-h-[65px] mb-2 ${isIncasat ? 'bg-white' : 'bg-red-50/40 border-red-100'}" data-client-id="${f.client_id}">
            <div class="flex items-center gap-3"><span class="status-dot ${isIncasat ? 'bg-incasat' : 'bg-neincasat'}"></span>
            <div><div class="flex items-center gap-2"><p class="text-[11px] font-black text-slate-800 uppercase truncate">${client?.nume_firma || "Client"}</p>
            ${f.pdf_url ? `<a href="${f.pdf_url}" target="_blank" class="text-blue-600"><svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/></svg></a>` : ''}</div>
            <p class="text-[8px] font-bold text-slate-400 uppercase">#${f.numar_factura} | E: ${formateazaDataZFlow(f.data_emiterii)}</p></div></div>
            <div class="text-right"><b class="text-xs ${isIncasat ? 'text-blue-900' : 'text-red-600'}">${Number(f.valoare).toLocaleString()} lei</b>
            <p class="text-[7px] font-bold text-slate-300 uppercase">S: ${f.data_scadenta ? formateazaDataZFlow(f.data_scadenta) : "-"}</p></div></div>`;
    }).join("");
}

/**
 * Paginare BI
 */
function biNextPage() {
    ZFlowStore.biCurrentPage++;
    genereazaBI();
}

function biPrevPage() {
    if (ZFlowStore.biCurrentPage > 1) {
        ZFlowStore.biCurrentPage--;
        genereazaBI();
    }
}

/**
 * Setează filtrul de status BI
 */
function setFiltruStatusBI(status, btn) {
    ZFlowStore.filtruStatusBI = status;
    ZFlowStore.biCurrentPage = 1;

    document.querySelectorAll(".bi-status-btn").forEach((b) => {
        b.classList.remove("bg-white", "text-blue-900", "shadow-sm", "text-red-600", "text-emerald-600");
        b.classList.add("text-slate-500");
    });

    btn.classList.remove("text-slate-500");
    btn.classList.add("bg-white", "shadow-sm");
    if (status === "Neincasat") btn.classList.add("text-red-600");
    else if (status === "Incasat") btn.classList.add("text-emerald-600");
    else btn.classList.add("text-blue-900");

    updateAnalizaInstant();
}

// Debounce pentru căutare BI
const filtreazaFirmeInBIDebounced = debounce(function () {
    const q = document.getElementById("search-bi").value.toLowerCase().trim();
    const rows = document.querySelectorAll("#rezultat-analiza .card-flow");
    const checkboxes = document.querySelectorAll("#container-bi-checks input");

    if (q.length > 0) {
        checkboxes.forEach((cb) => (cb.checked = false));

        rows.forEach((row) => {
            const numeClient = row.querySelector("p.font-black, h4")?.innerText.toLowerCase() || "";
            const infoFactura = row.querySelector("p.text-slate-400")?.innerText.toLowerCase() || "";
            const match = numeClient.includes(q) || infoFactura.includes(q);

            if (match) {
                row.style.display = "flex";
                row.classList.remove("is-hidden-by-search");
                const clientId = row.getAttribute("data-client-id");
                if (clientId) {
                    const cb = document.querySelector(`#container-bi-checks input[value="${clientId}"]`);
                    if (cb) cb.checked = true;
                }
            } else {
                row.style.display = "none";
                row.classList.add("is-hidden-by-search");
            }
        });
    } else {
        rows.forEach((row) => {
            row.style.display = "flex";
            row.classList.remove("is-hidden-by-search");
        });
        toggleFirmeBI(true);
    }

    actualizeazaSumaVizibilaBI();
}, 300);

function filtreazaFirmeInBI() {
    if (filtreazaFirmeInBIDebounced) filtreazaFirmeInBIDebounced();
}

function actualizeazaSumaVizibilaBI() {
    let total = 0;
    const visibleCards = document.querySelectorAll("#rezultat-analiza .card-flow:not(.is-hidden-by-search)");

    visibleCards.forEach((row) => {
        const sumaText = row.querySelector("b")?.innerText.replace(/[^0-9.]/g, "") || "0";
        total += parseFloat(sumaText);
    });

    const display = document.getElementById("suma-selectata-bi");
    if (display) {
        display.innerText = `${Math.round(total).toLocaleString()} lei`;
    }
}

// ==========================================
// MODALE
// ==========================================

/**
 * Deschide un modal
 */
function deschideModal(id, targetId = null) {
    const fabMenu = document.getElementById("fab-menu");
    if (fabMenu && fabMenu.classList.contains("active")) {
        toggleFAB();
    }

    if (id === "modal-client") {
        const title = document.getElementById("modal-client-title");
        if (targetId) {
            const f = ZFlowStore.dateLocal.find((x) => String(x.id) === String(targetId));
            if (f) {
                title.innerText = "Editează Profil Client";
                document.getElementById("in-client-id").value = f.id;
                document.getElementById("in-cui").value = f.cui || "";
                document.getElementById("in-nume").value = f.nume_firma || "";
                document.getElementById("in-adresa").value = f.adresa || "";
                document.getElementById("in-tel").value = f.telefon || "";
                document.getElementById("in-email").value = f.contact_email || "";
                document.getElementById("in-iban").value = f.iban || "";
                document.getElementById("in-oras").value = f.oras || "";
            }
        } else {
            title.innerText = "Client Bridge Nou";
            document.getElementById("in-client-id").value = "";
            document.querySelectorAll("#modal-client input:not([type='hidden'])").forEach((i) => (i.value = ""));
        }
    }

    if (id === "modal-factura") {
        populeazaBridgeUI();

        const title = document.getElementById("modal-factura-title");
        const anafBox = document.getElementById("anaf-info-box");
        const anafBadge = document.getElementById("anaf-status-badge");
        const anafId = document.getElementById("anaf-id-display");
        const dispEmisie = document.getElementById("display-emisie");
        const dispScadenta = document.getElementById("display-scadenta");

        const sincronizeazaDateVizual = () => {
            const dataEmisie = document.getElementById("in-fac-emisie").value;
            const dataScadenta = document.getElementById("in-fac-scad").value;
            dispEmisie.innerText = dataEmisie ? formateazaDataZFlow(dataEmisie) : "Alege data";
            dispScadenta.innerText = dataScadenta ? formateazaDataZFlow(dataScadenta) : "Alege data";
        };

        document.getElementById("in-fac-emisie").onchange = sincronizeazaDateVizual;
        document.getElementById("in-fac-scad").onchange = sincronizeazaDateVizual;

        if (targetId) {
            const fc = ZFlowStore.dateFacturiBI.find((x) => String(x.id) === String(targetId));
            if (fc) {
                title.innerText = "Editează Factura " + (fc.numar_factura || "");
                document.getElementById("in-fac-id").value = fc.id;
                document.getElementById("in-fac-client").value = fc.client_id;
                document.getElementById("in-fac-nr").value = fc.numar_factura;
                document.getElementById("in-fac-val").value = fc.valoare;
                document.getElementById("in-fac-emisie").value = fc.data_emiterii;
                document.getElementById("in-fac-scad").value = fc.data_scadenta;
                document.getElementById("in-auto").value = fc.numar_auto || "";
                sincronizeazaDateVizual();

                if (anafBox) {
                    anafBox.classList.remove("hidden");
                    if (fc.status_anaf === "validated") {
                        anafBadge.innerText = "VALIDAT";
                        anafBadge.className = "text-[9px] font-extrabold uppercase p-1 rounded bg-green-50 text-green-600 px-2";
                    } else if (fc.status_anaf === "error") {
                        anafBadge.innerText = "EROARE";
                        anafBadge.className = "text-[9px] font-extrabold uppercase p-1 rounded bg-red-50 text-red-600 px-2";
                    } else {
                        anafBadge.innerText = "ÎN AȘTEPTARE";
                        anafBadge.className = "text-[9px] font-extrabold uppercase p-1 rounded bg-slate-100 text-slate-400 px-2";
                    }
                    anafId.innerText = fc.id_descarcare_anaf ? "ID: " + fc.id_descarcare_anaf : "";
                }
                logicUIT(fc.valoare);
            }
        } else {
            title.innerText = "Factură Nouă";
            document.getElementById("in-fac-id").value = "";
            document.getElementById("in-fac-client").value = "";
            document.querySelectorAll("#modal-factura input:not([type='hidden'])").forEach((i) => (i.value = ""));
            document.getElementById("in-fac-emisie").value = new Date().toISOString().split("T")[0];
            sincronizeazaDateVizual();
            if (anafBox) anafBox.classList.add("hidden");
            logicUIT(0);
        }
    }

    const modalElement = document.getElementById(id);
    if (modalElement) {
        setTimeout(() => modalElement.classList.add("active"), 50);
    }
}

/**
 * Închide un modal
 */
function inchideModal(id) {
    document.getElementById(id).classList.remove("active");
}

/**
 * Deschide modal factură direct pentru clientul curent
 */
function deschideModalDirectFactura() {
    const idClientCurent = document.getElementById("in-client-id").value;

    if (idClientCurent) {
        deschideModal("modal-factura");
        setTimeout(() => {
            const selectClient = document.getElementById("in-fac-client");
            if (selectClient) {
                selectClient.value = idClientCurent;
                selectClient.dispatchEvent(new Event("change"));
            }
        }, 100);
    } else {
        alert("Eroare: Nu am putut identifica clientul pentru această factură.");
    }
}

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
        showNotification("⛔ Nu ai permisiunea de a edita clienți", "error");
        return;
    }
    const id = document.getElementById("in-client-id").value;

    const dateFirma = {
        nume_firma: document.getElementById("in-nume").value,
        cui: document.getElementById("in-cui").value,
        oras: document.getElementById("in-oras").value,
        adresa: document.getElementById("in-adresa").value,
        telefon: document.getElementById("in-tel").value,
        contact_email: document.getElementById("in-email").value,
        iban: document.getElementById("in-iban").value,
    };

    const cuiRegex = /^\d{1,10}$/;
    if (!dateFirma.nume_firma || !dateFirma.cui) return alert("Denumirea și CUI-ul sunt obligatorii!");
    if (!cuiRegex.test(dateFirma.cui.toString().trim())) return alert("❌ CUI-ul invalid: doar cifre (2-10 caractere)");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (dateFirma.contact_email && !emailRegex.test(dateFirma.contact_email.trim())) {
        if (!confirm("⚠️ Email nevalid. Continuați oricum?")) return;
    }

    setLoader(true);
    try {
        if (id) {
            await ZFlowDB.updateClient(id, dateFirma);
        } else {
            await ZFlowDB.insertClient(dateFirma);
        }

        inchideModal("modal-client");
        await init();
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
        showNotification("⛔ Nu ai permisiunea de a edita facturi", "error");
        return;
    }
    const id = document.getElementById("in-fac-id").value;
    const cid = document.getElementById("in-fac-client").value;
    const nr = document.getElementById("in-fac-nr").value;
    const val = document.getElementById("in-fac-val").value;
    const de = document.getElementById("in-fac-emisie").value;
    const ds = document.getElementById("in-fac-scad").value;
    const auto = document.getElementById("in-auto").value;
    const fileInput = document.getElementById("in-fac-file");
    const file = fileInput.files[0];

    if (!cid || !nr || !val) return alert("Selectează clientul, seria și suma!");

    setLoader(true);
    try {
        let url = null;

        if (file) {
            url = await ZFlowDB.uploadFacturaPDF(file, nr);
        }

        const payload = {
            client_id: cid,
            numar_factura: nr,
            valoare: parseFloat(val),
            data_emiterii: de || new Date().toISOString().split("T")[0],
            data_scadenta: ds,
            numar_auto: auto,
        };

        if (url) payload.pdf_url = url;

        if (id) {
            await ZFlowDB.updateFactura(id, payload);
        } else {
            payload.status_plata = "Neincasat";
            await ZFlowDB.insertFactura(payload);
        }

        fileInput.value = "";
        inchideModal("modal-factura");
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
        return alert("⚠️ SAGA factură - Nu poate fi modificată");
    }

    const noulStatus = currentStatus === "Incasat" ? "Neincasat" : "Incasat";
    setLoader(true);
    try {
        await ZFlowDB.updateFactura(id, { status_plata: noulStatus });
        await init();
        saveZFlowData();
        if (f) arataDetalii(f.client_id);
    } catch (err) {
        alert(err.message);
    } finally {
        setLoader(false);
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
        showNotification("⛔ Nu ai permisiunea de a șterge facturi", "error");
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
        showNotification("⛔ Nu ai permisiunea de a șterge clienți", "error");
        return;
    }
    showConfirmModal("Ștergi clientul definitiv? Toate facturile asociate vor fi orfane.", async () => {
        await ZFlowDB.deleteClient(id);
        init();
        comutaVedereFin("firme");
    });
}

// ==========================================
// IMPORT / EXPORT
// ==========================================

/**
 * Import date din CSV (SAGA)
 */
async function importaDateSaga() {
    console.log("🔄 importaDateSaga() apelat");
    console.log("🔐 Permisiune canImport:", hasPermission('canImport'));
    console.log("🔐 Rol curent:", ZFlowStore.userRole);
    
    if (!hasPermission('canImport')) {
        showNotification("⛔ Nu ai permisiunea de a importa date", "error");
        return;
    }
    
    console.log("📂 Se deschide dialog selectare fișier...");
    
    let fileInput = document.getElementById("import-saga-file");
    if (!fileInput) {
        console.log("📂 Creez input file nou");
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "import-saga-file";
        fileInput.accept = ".csv,.xlsx";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        fileInput.addEventListener("change", async function (e) {
            console.log("📂 Fișier selectat:", e.target.files[0]?.name);
            const file = e.target.files[0];
            if (!file) return;

            setLoader(true);
            try {
                const text = await file.text();
                const linii = text.split("\n").filter(l => l.trim());
                
                console.log("📂 Import CSV - Total linii:", linii.length);
                console.log("📂 Prima linie (header):", linii[0]);
                console.log("📂 Clienți disponibili:", ZFlowStore.dateLocal.length);
                console.log("📂 CUI-uri clienți:", ZFlowStore.dateLocal.map(c => c.cui));

                let importate = 0;
                let erori = [];
                
                for (let i = 1; i < linii.length; i++) {
                    const linie = linii[i].trim();
                    if (!linie) continue;
                    
                    const cols = linie.split(/[,;]/);
                    if (cols.length < 3) {
                        console.warn(`Linia ${i} - coloane insuficiente:`, cols);
                        continue;
                    }

                    const cui = cols[0]?.trim().replace(/"/g, "");
                    const nrFactura = cols[1]?.trim().replace(/"/g, "");
                    const valoare = parseFloat(cols[2]?.trim().replace(/"/g, "").replace(",", ".")) || 0;
                    const dataEmiterii = cols[3]?.trim().replace(/"/g, "") || new Date().toISOString().split("T")[0];
                    const dataScadenta = cols[4]?.trim().replace(/"/g, "") || null;

                    // Căutare client cu logging - caută după CUI sau nume_firma
                    const client = ZFlowStore.dateLocal.find(c => {
                        const cuiClient = String(c.cui || "").trim().toLowerCase();
                        const numeClient = String(c.nume_firma || "").trim().toLowerCase();
                        const cuiCSV = String(cui).trim().toLowerCase();
                        return cuiClient === cuiCSV || numeClient === cuiCSV;
                    });
                    
                    if (!client) {
                        console.warn(`Linia ${i} - Client negăsit pentru CUI/Nume: "${cui}"`);
                        erori.push(`CUI/Nume ${cui} negăsit`);
                        continue;
                    }

                    // Verifică dacă factura există deja (evită duplicate)
                    const facturaExistenta = ZFlowStore.dateFacturiBI.find(f => 
                        String(f.client_id) === String(client.id) && 
                        String(f.numar_factura).trim().toLowerCase() === String(nrFactura).trim().toLowerCase()
                    );
                    
                    if (facturaExistenta) {
                        console.warn(`⚠️ Factură duplicat ignorată: ${nrFactura} pentru ${client.nume_firma}`);
                        erori.push(`Duplicat: ${nrFactura}`);
                        continue;
                    }

                    try {
                        await ZFlowDB.insertFactura({
                            client_id: client.id,
                            numar_factura: nrFactura,
                            valoare: valoare,
                            data_emiterii: dataEmiterii,
                            data_scadenta: dataScadenta,
                            status_plata: "Neincasat"
                        });
                        importate++;
                        console.log(`✓ Factură ${nrFactura} importată pentru ${client.nume_firma}`);
                    } catch (insertErr) {
                        console.error(`Eroare inserare factură ${nrFactura}:`, insertErr);
                        erori.push(`Eroare inserare ${nrFactura}`);
                    }
                }

                localStorage.setItem("lastSagaSync", new Date().toISOString());
                
                let mesaj = `✅ Import: ${importate} facturi noi`;
                if (erori.filter(e => e.startsWith('Duplicat')).length > 0) {
                    mesaj += ` (${erori.filter(e => e.startsWith('Duplicat')).length} duplicate ignorate)`;
                }
                
                if (importate > 0) {
                    showNotification(mesaj, "success");
                    await init();
                } else if (erori.length > 0) {
                    const duplicates = erori.filter(e => e.startsWith('Duplicat')).length;
                    if (duplicates === erori.length) {
                        showNotification(`⚠️ Toate facturile există deja (${duplicates} duplicate)`, "warning");
                    } else {
                        showNotification(`⚠️ 0 facturi importate. Verifică consola (F12)`, "warning");
                    }
                    console.error("Erori import:", erori);
                } else {
                    showNotification(`⚠️ Fișierul nu conține date valide`, "warning");
                }
            } catch (err) {
                console.error("Eroare import CSV:", err);
                showNotification("❌ Eroare import: " + err.message, "error");
            } finally {
                setLoader(false);
                fileInput.value = "";
            }
        });
    } else {
        console.log("📂 Input file existent reutilizat");
    }

    console.log("📂 Apel fileInput.click()...");
    fileInput.click();
}

/**
 * Export PDF
 */
function exportaPDF() {
    const cards = document.querySelectorAll("#rezultat-analiza .card-flow:not(.is-hidden-by-search)");

    const curataText = (text) => {
        if (!text) return "";
        return text.toString()
            .replace(/ș/g, "s").replace(/Ș/g, "S")
            .replace(/ț/g, "t").replace(/Ț/g, "T")
            .replace(/ă/g, "a").replace(/Ă/g, "A")
            .replace(/î/g, "i").replace(/Î/g, "I")
            .replace(/â/g, "a").replace(/Â/g, "A");
    };

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const sumaTotala = document.getElementById("suma-selectata-bi")?.innerText || "0 lei";
    const pStart = document.getElementById("label-start")?.innerText || "--";
    const pEnd = document.getElementById("label-end")?.innerText || "--";

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text(curataText("RAPORT ANALIZA FINANCIARA"), 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(curataText(`Perioada auditata: ${pStart} - ${pEnd}`), 14, 28);
    doc.setFontSize(13);
    doc.text(curataText(`TOTAL GENERAL: ${sumaTotala}`), 14, 38);

    const rows = [];
    cards.forEach((item) => {
        const numeClient = item.querySelector("h4")?.innerText || item.querySelector(".font-black")?.innerText || "Client";
        const infoStanga = item.querySelector("p.text-slate-400, .text-\\[10px\\]")?.innerText || "";

        let docNr = "--", dataEmis = "--";
        if (infoStanga.includes("|")) {
            const parti = infoStanga.split("|");
            docNr = parti[0].trim();
            dataEmis = parti[1].replace("E:", "").trim();
        }

        const elementeCard = Array.from(item.querySelectorAll("p, span, b"));
        const scadentaFinala = (elementeCard.find((el) => el.innerText.includes("S:"))?.innerText || "").replace("S:", "").trim() || "--";
        const sumaFinala = elementeCard.find((el) => el.innerText.includes("lei"))?.innerText || "0 lei";

        const esteIncasat = item.querySelector(".status-dot")?.classList.contains("bg-incasat");
        const statusText = esteIncasat ? "INCASAT" : "NEINCASAT";

        rows.push([
            curataText(numeClient),
            curataText(docNr),
            curataText(dataEmis),
            curataText(scadentaFinala),
            curataText(sumaFinala),
            curataText(statusText),
        ]);
    });

    doc.autoTable({
        startY: 45,
        head: [[curataText("CLIENT"), curataText("DOCUMENT"), curataText("EMIS LA"), curataText("SCADENTA"), curataText("SUMA"), curataText("STATUS")]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [30, 58, 138], fontSize: 8, halign: "center" },
        styles: { fontSize: 7, cellPadding: 2, halign: "center" },
        columnStyles: {
            0: { cellWidth: 40, halign: "center" },
            1: { cellWidth: 30, halign: "center" },
            2: { cellWidth: 22, halign: "center" },
            3: { cellWidth: 22, halign: "center" },
            4: { cellWidth: 30, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 25, halign: "center", fontStyle: "bold" },
        },
        didParseCell: function (data) {
            if (data.section === "body" && data.column.index === 5) {
                if (data.cell.raw === "INCASAT") {
                    data.cell.styles.textColor = [16, 185, 129];
                } else {
                    data.cell.styles.textColor = [239, 68, 68];
                }
            }
        },
    });

    doc.save(`Analiza_ZFlow_${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Reset filtre după export
    resetFiltreBIExport();
}

/**
 * Resetează filtrele BI după export
 */
function resetFiltreBIExport() {
    // Reset date picker-uri
    const dataStart = document.getElementById("data-start");
    const dataEnd = document.getElementById("data-end");
    const labelStart = document.getElementById("label-start");
    const labelEnd = document.getElementById("label-end");
    
    if (dataStart) {
        dataStart.value = "";
        if (labelStart) {
            labelStart.innerText = "De la: --";
            labelStart.parentElement?.classList.remove("border-blue-200");
        }
    }
    if (dataEnd) {
        dataEnd.value = "";
        if (labelEnd) {
            labelEnd.innerText = "Până la: --";
            labelEnd.parentElement?.classList.remove("border-blue-200");
        }
    }
    
    // Regenerează BI fără filtre de date
    genereazaBI();
}

/**
 * Export Excel
 */
function exportaExcel() {
    const s = document.getElementById("data-start")?.value;
    const e = document.getElementById("data-end")?.value;
    const ids = Array.from(document.querySelectorAll("#container-bi-checks input:checked")).map((i) => String(i.value));

    const facturiFiltrate = ZFlowStore.dateFacturiBI.filter((f) => {
        const df = f.created_at.split("T")[0];
        const matchData = (!s || df >= s) && (!e || df <= e);
        const matchStatus = ZFlowStore.filtruStatusBI === "toate" || f.status_plata === ZFlowStore.filtruStatusBI;
        return ids.includes(String(f.client_id)) && matchData && matchStatus;
    });

    const headers = ["Client", "Factură", "Valoare", "Status", "Scadență"];
    const rows = facturiFiltrate.map((f) => {
        const c = ZFlowStore.dateLocal.find((cl) => String(cl.id) === String(f.client_id));
        return [c?.nume_firma || "", f.numar_factura, f.valoare, f.status_plata, formateazaDataZFlow(f.data_scadenta)];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturi");
    XLSX.writeFile(wb, `facturi_${new Date().toISOString().slice(0, 10)}.xlsx`);
    saveZFlowData();
    
    // Reset filtre după export
    resetFiltreBIExport();
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
        return alert("⚠️ Eroare: Adresa de email nu este validă!");
    }
    const subiect = encodeURIComponent(`Notificare plată factură nr. ${nr}`);
    const corp = encodeURIComponent(`Bună ziua,\n\nVă reamintim de plata facturii nr. ${nr} în valoare de ${suma} RON.\n\nVă mulțumim!`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subiect}&body=${corp}`, "_blank");
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
// CĂUTARE CUI ANAF
// ==========================================

async function autoCautareCUI() {
    const cuiRaw = document.getElementById("in-cui").value;
    const cui = cuiRaw.replace(/\D/g, "");

    if (!cui || cui.length < 2) return alert("Introdu un CUI valid (doar cifrele)!");

    setLoader(true);
    try {
        const proxyUrl = "https://api.allorigins.win/raw?url=" +
            encodeURIComponent("https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva");

        const dataAzi = new Date().toISOString().split("T")[0];

        const response = await fetch(proxyUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify([{ cui: parseInt(cui), data: dataAzi }]),
        });

        if (!response.ok) throw new Error("Serverul ANAF a respins cererea.");

        const res = await response.json();

        if (res.found && res.found.length > 0 && res.found[0].date_generale) {
            const d = res.found[0];
            document.getElementById("in-nume").value = d.date_generale.denumire || "";
            const adresaCompleta = d.adresa_domiciliu_fiscal.adresa || "";
            document.getElementById("in-adresa").value = adresaCompleta;
            document.getElementById("in-oras").value = d.adresa_domiciliu_fiscal.localitate || "";
            console.log("Date primite de la ANAF:", d);
        } else {
            alert("CUI-ul " + cui + " nu a fost găsit în baza de date ANAF.");
        }
    } catch (e) {
        console.error("Eroare ANAF:", e);
        alert("Eroare: " + e.message);
    } finally {
        setLoader(false);
    }
}

// ==========================================
// TRANSPORTURI & MAP
// ==========================================

function renderTransportTab() {
    const container = document.getElementById("lista-transporturi");
    const trans = [];
    ZFlowStore.dateLocal.forEach((c) =>
        c.facturi.forEach((f) => {
            if (f.numar_auto) trans.push({ ...f, firma: c.nume_firma });
        })
    );
    container.innerHTML = trans
        .map((t) =>
            `<div class="card-flow flex justify-between items-center animate-pop">
                <div>
                    <p class="text-[11px] font-extrabold text-slate-800 uppercase">${t.firma}</p>
                    <p class="text-[9px] font-bold text-blue-600 mt-1 uppercase">🚚 Camion: ${t.numar_auto}</p>
                </div>
                <span class="text-[8px] font-extrabold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-700">WAIT UIT</span>
            </div>`
        )
        .join("");
}

function initMap() {
    if (!ZFlowStore.map) {
        ZFlowStore.map = L.map("map", { zoomControl: false }).setView([47.18, 23.05], 13);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(ZFlowStore.map);
    }
    setTimeout(() => ZFlowStore.map.invalidateSize(), 400);
}

function initScanner() {
    if (!ZFlowStore.scanner) {
        ZFlowStore.scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
        ZFlowStore.scanner.render((t) => (document.getElementById("barcode-value").innerText = t));
    }
}

// ==========================================
// MOBILE KEYBOARD FIX
// ==========================================

function setupMobileKeyboardFix() {
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', () => {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                setTimeout(() => activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
        });
    }

    document.querySelectorAll('.sheet-content input, .sheet-content textarea').forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        });
    });
}

/**
 * Setup Enter key pentru autentificare
 */
function setupAuthEnterKey() {
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verificaAuth();
        }
    };
    
    if (authUsername) authUsername.addEventListener('keypress', handleEnter);
    if (authPassword) authPassword.addEventListener('keypress', handleEnter);
}

// ==========================================
// INIȚIALIZARE LA ÎNCĂRCARE
// ==========================================

window.onload = async () => {
    try {
        loadTheme();
    } catch (e) {
        console.warn("Theme load failed");
    }

    // Ascunde conținutul principal până la autentificare
    const mainContent = document.querySelector('main');
    const header = document.querySelector('header');
    const bottomNav = document.querySelector('.bottom-nav');
    const fabMenu = document.getElementById('fab-menu');
    
    // Verifică sesiunea Supabase (async)
    const isAuthenticated = await checkSession();
    
    if (!isAuthenticated) {
        // Blochează accesul la interfață
        if (mainContent) mainContent.style.display = 'none';
        if (header) header.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabMenu) fabMenu.style.display = 'none';
        
        document.getElementById("modal-auth").classList.add("active");
    } else {
        // Afișează interfața și inițializează
        if (mainContent) mainContent.style.display = '';
        if (header) header.style.display = '';
        if (bottomNav) bottomNav.style.display = '';
        if (fabMenu) fabMenu.style.display = '';
        
        if (typeof init === 'function') {
            init();
        }
    }

    setupMobileKeyboardFix();
    setupAuthEnterKey();
    
    // Ascultă schimbările de autentificare Supabase
    ZFlowDB.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_OUT') {
            logout();
        }
    });
};

// Export global pentru toate funcțiile
window.init = init;
window.verificaAuth = verificaAuth;
window.logout = logout;
window.deschideModalInregistrare = deschideModalInregistrare;
window.deschideModalResetParola = deschideModalResetParola;
window.inregistrareUtilizator = inregistrareUtilizator;
window.trimiteResetParola = trimiteResetParola;
window.inchideModalRegister = inchideModalRegister;
window.inchideModalResetPassword = inchideModalResetPassword;
window.schimbaTab = schimbaTab;
window.comutaVedereFin = comutaVedereFin;
window.toggleFAB = toggleFAB;
window.renderMain = renderMain;
window.filtreazaListaFirme = filtreazaListaFirme;
window.arataDetalii = arataDetalii;
window.filtreazaFacturiInDetalii = filtreazaFacturiInDetalii;
window.populeazaBridgeUI = populeazaBridgeUI;
window.toggleFirmeBI = toggleFirmeBI;
window.genereazaBI = genereazaBI;
window.biNextPage = biNextPage;
window.biPrevPage = biPrevPage;
window.setFiltruStatusBI = setFiltruStatusBI;
window.filtreazaFirmeInBI = filtreazaFirmeInBI;
window.deschideModal = deschideModal;
window.inchideModal = inchideModal;
window.deschideModalDirectFactura = deschideModalDirectFactura;
window.logicUIT = logicUIT;
window.salveazaClient = salveazaClient;
window.salveazaFacturaOrchestrator = salveazaFacturaOrchestrator;
window.toggleStatusPlata = toggleStatusPlata;
window.stergeFactura = stergeFactura;
window.stergeFirma = stergeFirma;
window.showConfirmModal = showConfirmModal;
window.inchideModalConfirm = inchideModalConfirm;
window.importaDateSaga = importaDateSaga;
window.exportaPDF = exportaPDF;
window.exportaExcel = exportaExcel;
window.trimiteEmailDebitor = trimiteEmailDebitor;
window.printInvoice = printInvoice;
window.autoCautareCUI = autoCautareCUI;
window.renderTransportTab = renderTransportTab;
window.initMap = initMap;
window.initScanner = initScanner;
window.setLoader = setLoader;
window.showNotification = showNotification;
window.formateazaDataZFlow = formateazaDataZFlow;
