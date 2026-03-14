/**
 * Z-FLOW Enterprise v7.14
 * Module: Mobile - Handlers pentru dispozitive mobile
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowMobile = {
    // Configurație swipe
    swipeConfig: {
        threshold: 50,      // Pixeli minimi pentru swipe
        maxTime: 300,       // Timp maxim pentru swipe (ms)
        allowedTime: 500
    },

    /**
     * Inițializează swipe handler pe un container
     * @param {string} selector - Selector CSS pentru container
     */
    initSwipe(selector) {
        const container = document.querySelector(selector);
        if (!container) return;
        
        let startX, startY, startTime;
        
        container.addEventListener('touchstart', (e) => {
            const touch = e.changedTouches[0];
            startX = touch.pageX;
            startY = touch.pageY;
            startTime = new Date().getTime();
        }, { passive: true });
        
        container.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const distX = touch.pageX - startX;
            const distY = touch.pageY - startY;
            const elapsedTime = new Date().getTime() - startTime;
            
            // Verifică dacă e swipe valid
            if (elapsedTime <= this.swipeConfig.allowedTime) {
                if (Math.abs(distX) >= this.swipeConfig.threshold && Math.abs(distY) < 100) {
                    const card = e.target.closest('.swipeable-card');
                    if (card) {
                        this.handleSwipe(card, distX > 0 ? 'right' : 'left');
                    }
                }
            }
        }, { passive: true });
    },

    /**
     * Gestionează acțiunea de swipe pe card
     * @param {HTMLElement} card 
     * @param {string} direction - left | right
     */
    handleSwipe(card, direction) {
        // Resetează alte carduri
        document.querySelectorAll('.swipeable-card.swiped-left, .swipeable-card.swiped-right')
            .forEach(c => {
                if (c !== card) {
                    c.classList.remove('swiped-left', 'swiped-right');
                    const content = c.querySelector('.swipe-content');
                    if (content) content.style.transform = '';
                }
            });
        
        // Toggle pe cardul curent
        card.classList.toggle(`swiped-${direction}`);
        
        const content = card.querySelector('.swipe-content');
        if (content) {
            content.style.transition = 'transform 0.3s ease';
            if (card.classList.contains(`swiped-${direction}`)) {
                content.style.transform = `translateX(${direction === 'left' ? '-80px' : '80px'})`;
            } else {
                content.style.transform = '';
            }
        }
    },

    /**
     * Resetează toate cardurile swipe
     */
    resetAllSwipes() {
        document.querySelectorAll('.swipeable-card.swiped-left, .swipeable-card.swiped-right')
            .forEach(card => {
                card.classList.remove('swiped-left', 'swiped-right');
                const content = card.querySelector('.swipe-content');
                if (content) {
                    content.style.transition = 'transform 0.3s ease';
                    content.style.transform = '';
                }
            });
    },

    /**
     * Detectează dacă e dispozitiv mobil
     * @returns {boolean}
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth <= 768;
    },

    /**
     * Detectează dacă e iOS
     * @returns {boolean}
     */
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },

    /**
     * Detectează dacă e Android
     * @returns {boolean}
     */
    isAndroid() {
        return /Android/i.test(navigator.userAgent);
    },

    /**
     * Fix pentru viewport pe iOS când apare tastatura
     */
    setupKeyboardFix() {
        if (!this.isIOS()) return;
        
        const inputs = document.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                // Scroll la input după un delay mic
                setTimeout(() => {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });
    },

    /**
     * Inițializează PWA back button handler
     */
    setupBackButton() {
        // Back button handler gestionat centralizat în app.js (PWA Back Button Handler)
        // Acest stub rămâne pentru compatibilitate — nu adaugă listener duplicate
    },

    /**
     * Inițializează offline/online handlers
     */
    setupOfflineHandler() {
        const banner = document.getElementById('offline-banner');
        
        const setOffline = (isOffline) => {
            if (!banner) return;
            
            if (isOffline) {
                banner.classList.remove('hidden');
                document.querySelector('header')?.classList.add('mt-8');
                window.ZFlowUI?.showNotification('Fără conexiune la internet', 'error', 5000);
            } else {
                banner.classList.add('hidden');
                document.querySelector('header')?.classList.remove('mt-8');
                window.ZFlowUI?.showNotification('Conexiune restaurată!', 'success', 3000);
            }
        };
        
        if (!navigator.onLine) setOffline(true);
        window.addEventListener('offline', () => setOffline(true));
        window.addEventListener('online', () => setOffline(false));
    },

    /**
     * Haptic feedback (vibrație)
     * @param {number} duration - Durată în ms
     */
    vibrate(duration = 50) {
        if ('vibrate' in navigator) {
            navigator.vibrate(duration);
        }
    },

    /**
     * Blocheză orientația ecranului în Portrait (Screen Orientation API)
     */
    lockOrientationPortrait() {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('portrait-primary').catch(() => {});
        }
    },

    /**
     * Inițializează toate funcționalitățile mobile
     */
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._init());
        } else {
            this._init();
        }
    },

    _init() {
        this.lockOrientationPortrait();
        this.setupKeyboardFix();
        this.setupBackButton();
        this.setupOfflineHandler();
        
        // Swipe pe facturi dezactivat — acțiunile sunt în butoanele cardului
        // this.initSwipe('#lista-facturi-content');
        this.initSwipe('#rezultat-analiza');
        
        ZFlowLogger.debug('mobile', '📱 ZFlowMobile initialized');
    }
};

// Export global
window.ZFlowMobile = ZFlowMobile;
