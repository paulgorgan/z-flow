/**
 * Z-FLOW Enterprise v7.14
 * Module: Notifications - Notificări și Alerte
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowNotifications = {
    /**
     * Verifică permisiunea pentru notificări push
     * @returns {Promise<boolean>}
     */
    async checkPermission() {
        if (!('Notification' in window)) {
            console.log('Browser-ul nu suportă notificări');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    },

    /**
     * Trimite notificare push
     * @param {string} title - Titlul notificării
     * @param {Object} options - Opțiuni (body, icon, tag, etc.)
     */
    async send(title, options = {}) {
        const hasPermission = await this.checkPermission();
        if (!hasPermission) return;
        
        const defaults = {
            icon: 'icons/icon.svg',
            badge: 'icons/badge.svg',
            vibrate: [100, 50, 100],
            requireInteraction: false
        };
        
        const notifOptions = { ...defaults, ...options };
        
        // Folosește Service Worker dacă e disponibil
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, notifOptions);
        } else {
            new Notification(title, notifOptions);
        }
    },

    /**
     * Verifică facturile cu scadență apropiată și generează alerte
     * @returns {Object} - { restante: Array, inCurand: Array }
     */
    checkDueInvoices() {
        const facturi = window.ZFlowStore?.dateFacturiBI || [];
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        
        const inCurand = [];
        const restante = [];
        
        facturi.forEach(f => {
            if (f.status_plata === 'Incasat') return;
            
            const scadenta = new Date(f.data_scadenta);
            scadenta.setHours(0, 0, 0, 0);
            
            const diff = Math.ceil((scadenta - azi) / (1000 * 60 * 60 * 24));
            
            if (diff < 0) {
                restante.push({
                    ...f,
                    zileIntarziere: Math.abs(diff)
                });
            } else if (diff <= 7) {
                inCurand.push({
                    ...f,
                    zilePanaLaScadenta: diff
                });
            }
        });
        
        return { restante, inCurand };
    },

    /**
     * Generează și trimite notificări pentru scadențe
     */
    async notifyDueInvoices() {
        const { restante, inCurand } = this.checkDueInvoices();
        
        if (restante.length > 0) {
            let totalRestant = 0;
            restante.forEach(f => totalRestant += parseFloat(f.suma) || 0);
            
            await this.send('🔴 Facturi restante!', {
                body: `${restante.length} facturi depășite (${this.formatSuma(totalRestant)})`,
                tag: 'restante',
                requireInteraction: true
            });
        }
        
        if (inCurand.length > 0) {
            const maine = inCurand.filter(f => f.zilePanaLaScadenta <= 1);
            if (maine.length > 0) {
                await this.send('⏰ Scadență mâine!', {
                    body: `${maine.length} factur${maine.length > 1 ? 'i scad' : 'ă scade'} mâine`,
                    tag: 'scadenta-maine'
                });
            }
        }
        
        return { restante, inCurand };
    },

    /**
     * Actualizează badge-ul de notificări în UI
     * @param {number} count 
     */
    updateBadge(count) {
        const badge = document.getElementById('bell-badge');
        const bellIcon = document.getElementById('bell-icon');
        
        if (badge) {
            if (count > 0) {
                badge.innerText = count > 99 ? '99+' : count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        
        if (bellIcon && count > 0) {
            bellIcon.classList.add('animate-pulse', 'text-red-500');
        } else if (bellIcon) {
            bellIcon.classList.remove('animate-pulse', 'text-red-500');
        }
    },

    /**
     * Generează link WhatsApp pentru reminder
     * @param {Object} params - { telefon, numeClient, nrFactura, suma, dataScadenta }
     * @returns {string}
     */
    generateWhatsAppLink(params) {
        const { telefon, numeClient, nrFactura, suma, dataScadenta } = params;
        
        let phone = (telefon || '').replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = '40' + phone.substring(1);
        }
        
        const mesaj = `Bună ziua,\n\nVă reamintim că aveți de achitat factura nr. ${nrFactura} în valoare de ${this.formatSuma(suma)}, scadentă la ${dataScadenta}.\n\nVă mulțumim,\n${window.ZFlowUserProfile?.nume_firma || 'Z-FLOW'}`;
        
        return `https://wa.me/${phone}?text=${encodeURIComponent(mesaj)}`;
    },

    /**
     * Generează link mailto pentru reminder
     * @param {Object} params 
     * @returns {string}
     */
    generateEmailLink(params) {
        const { email, numeClient, nrFactura, suma, dataScadenta } = params;
        
        const subject = `Reminder: Factură ${nrFactura} - ${this.formatSuma(suma)}`;
        const body = `Bună ziua,\n\nVă reamintim că aveți de achitat factura nr. ${nrFactura} în valoare de ${this.formatSuma(suma)}, scadentă la ${dataScadenta}.\n\nVă mulțumim,\n${window.ZFlowUserProfile?.nume_firma || 'Z-FLOW'}`;
        
        return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },

    /**
     * Programează verificare periodică
     * @param {number} intervalMinute 
     */
    scheduleCheck(intervalMinute = 60) {
        // Verifică imediat
        this.notifyDueInvoices();
        
        // Și apoi periodic
        setInterval(() => {
            this.notifyDueInvoices();
        }, intervalMinute * 60 * 1000);
    },

    /**
     * Helper: Formatare sumă
     * @param {number} suma 
     * @returns {string}
     */
    formatSuma(suma) {
        return new Intl.NumberFormat('ro-RO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(suma || 0) + ' RON';
    }
};

// Export global
window.ZFlowNotifications = ZFlowNotifications;
