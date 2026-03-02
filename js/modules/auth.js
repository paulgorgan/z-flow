/**
 * Z-FLOW Enterprise v7.14
 * Module: Auth - Autentificare și Rate Limiting
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowAuth = {
    // Rate limiting configurație
    rateLimitConfig: {
        maxAttempts: 5,
        lockoutDuration: 5 * 60 * 1000, // 5 minute în ms
        attempts: 0,
        lockedUntil: null
    },

    /**
     * Verifică dacă utilizatorul este blocat din cauza încercărilor eșuate
     * @returns {boolean}
     */
    isBlocked() {
        if (!this.rateLimitConfig.lockedUntil) return false;
        
        const now = Date.now();
        if (now >= this.rateLimitConfig.lockedUntil) {
            this.resetAttempts();
            return false;
        }
        return true;
    },

    /**
     * Returnează timpul rămas până la deblocare (în secunde)
     * @returns {number}
     */
    getLockoutRemaining() {
        if (!this.rateLimitConfig.lockedUntil) return 0;
        const remaining = Math.ceil((this.rateLimitConfig.lockedUntil - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
    },

    /**
     * Înregistrează o încercare de login eșuată
     */
    recordFailedAttempt() {
        this.rateLimitConfig.attempts++;
        console.log(`⚠️ Încercare eșuată: ${this.rateLimitConfig.attempts}/${this.rateLimitConfig.maxAttempts}`);
        
        if (this.rateLimitConfig.attempts >= this.rateLimitConfig.maxAttempts) {
            this.rateLimitConfig.lockedUntil = Date.now() + this.rateLimitConfig.lockoutDuration;
            const minutes = Math.ceil(this.rateLimitConfig.lockoutDuration / 60000);
            console.log(`🔒 Cont blocat pentru ${minutes} minute`);
        }
    },

    /**
     * Resetează contorul de încercări
     */
    resetAttempts() {
        this.rateLimitConfig.attempts = 0;
        this.rateLimitConfig.lockedUntil = null;
    },

    /**
     * Verifică sesiunea demo din localStorage
     * @returns {Object|null}
     */
    getDemoSession() {
        try {
            const demoSession = localStorage.getItem("zflow_demo_session");
            if (demoSession) {
                const parsed = JSON.parse(demoSession);
                const sessionAge = Date.now() - new Date(parsed.login_time).getTime();
                if (sessionAge < 24 * 60 * 60 * 1000) { // 24h valid
                    return parsed;
                } else {
                    localStorage.removeItem("zflow_demo_session");
                }
            }
        } catch (e) {
            console.warn("Demo session check error:", e);
        }
        return null;
    },

    /**
     * Salvează sesiunea demo
     * @param {string} user - Email utilizator
     * @param {string} role - Rol utilizator
     */
    saveDemoSession(user, role = 'user') {
        localStorage.setItem("zflow_demo_session", JSON.stringify({
            user: user,
            role: role,
            login_time: new Date().toISOString()
        }));
    },

    /**
     * Șterge sesiunea demo
     */
    clearDemoSession() {
        localStorage.removeItem("zflow_demo_session");
    },

    /**
     * Validează formatul email
     * @param {string} email 
     * @returns {boolean}
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Validează puterea parolei
     * @param {string} password 
     * @returns {Object} - { valid: boolean, message: string }
     */
    validatePassword(password) {
        if (!password || password.length < 6) {
            return { valid: false, message: "Parola trebuie să aibă cel puțin 6 caractere" };
        }
        return { valid: true, message: "" };
    }
};

// Export global
window.ZFlowAuth = ZFlowAuth;
