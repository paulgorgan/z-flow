/**
 * Z-FLOW Enterprise v7.14
 * Module: Attachments - Gestiune atașamente PDF
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowAttachments = {
    // Fișiere pending pentru upload
    pendingFiles: [],
    
    // Configurație
    config: {
        maxFileSize: 10 * 1024 * 1024, // 10 MB
        allowedTypes: ['application/pdf'],
        maxFiles: 5
    },

    /**
     * Validează un fișier pentru upload
     * @param {File} file 
     * @returns {Object} - { valid: boolean, error: string }
     */
    validateFile(file) {
        if (!file) {
            return { valid: false, error: 'Niciun fișier selectat' };
        }
        
        if (!this.config.allowedTypes.includes(file.type)) {
            return { valid: false, error: 'Doar fișiere PDF sunt permise' };
        }
        
        if (file.size > this.config.maxFileSize) {
            const maxMB = this.config.maxFileSize / (1024 * 1024);
            return { valid: false, error: `Fișierul depășește ${maxMB} MB` };
        }
        
        return { valid: true, error: null };
    },

    /**
     * Adaugă fișier la lista pending
     * @param {File} file 
     * @returns {Object} - { success: boolean, error: string }
     */
    addPending(file) {
        const validation = this.validateFile(file);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }
        
        if (this.pendingFiles.length >= this.config.maxFiles) {
            return { success: false, error: `Maxim ${this.config.maxFiles} fișiere` };
        }
        
        // Verifică duplicat
        const exists = this.pendingFiles.some(f => 
            f.name === file.name && f.size === file.size
        );
        
        if (exists) {
            return { success: false, error: 'Fișierul există deja' };
        }
        
        this.pendingFiles.push(file);
        return { success: true, error: null };
    },

    /**
     * Elimină fișier din lista pending
     * @param {number} index 
     */
    removePending(index) {
        if (index >= 0 && index < this.pendingFiles.length) {
            this.pendingFiles.splice(index, 1);
        }
    },

    /**
     * Golește lista pending
     */
    clearPending() {
        this.pendingFiles = [];
    },

    /**
     * Obține lista pending
     * @returns {Array}
     */
    getPending() {
        return this.pendingFiles;
    },

    /**
     * Upload fișiere la Supabase Storage
     * @param {string} facturaId - ID-ul facturii
     * @returns {Promise<Array>} - Array de URL-uri
     */
    async uploadPending(facturaId) {
        if (this.pendingFiles.length === 0) {
            return [];
        }
        
        const urls = [];
        const zf = window.zf; // Supabase client
        
        if (!zf) {
            throw new Error('Supabase client nu este disponibil');
        }
        
        for (const file of this.pendingFiles) {
            try {
                const timestamp = Date.now();
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const filePath = `facturi/${facturaId}/${timestamp}_${safeName}`;
                
                const { data, error } = await zf.storage
                    .from('attachments')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Obține URL public
                const { data: urlData } = zf.storage
                    .from('attachments')
                    .getPublicUrl(filePath);
                
                if (urlData?.publicUrl) {
                    urls.push(urlData.publicUrl);
                }
                
            } catch (e) {
                console.error(`Eroare upload ${file.name}:`, e);
            }
        }
        
        this.clearPending();
        return urls;
    },

    /**
     * Șterge atașament din storage
     * @param {string} url - URL-ul complet sau path-ul
     * @returns {Promise<boolean>}
     */
    async deleteAttachment(url) {
        const zf = window.zf;
        if (!zf) return false;
        
        try {
            // Extrage path-ul din URL
            const match = url.match(/attachments\/(.+)$/);
            if (!match) return false;
            
            const filePath = decodeURIComponent(match[1]);
            
            const { error } = await zf.storage
                .from('attachments')
                .remove([filePath]);
            
            return !error;
        } catch (e) {
            console.error('Eroare la ștergere atașament:', e);
            return false;
        }
    },

    /**
     * Parsează URL-urile PDF din câmpul pdf_url al facturii
     * @param {Object} factura 
     * @returns {Array}
     */
    getUrls(factura) {
        if (!factura?.pdf_url) return [];
        
        try {
            // Verifică dacă e JSON array
            if (factura.pdf_url.startsWith('[')) {
                return JSON.parse(factura.pdf_url);
            }
            // Sau URL simplu
            return [factura.pdf_url];
        } catch (e) {
            return factura.pdf_url ? [factura.pdf_url] : [];
        }
    },

    /**
     * Setează URL-urile în formatul corect pentru salvare
     * @param {Array} urls 
     * @returns {string|null}
     */
    prepareForSave(urls) {
        if (!urls || urls.length === 0) return null;
        if (urls.length === 1) return urls[0];
        return JSON.stringify(urls);
    },

    /**
     * Renderizează lista de fișiere pending în UI
     * @param {string} containerId - ID-ul containerului
     */
    renderPendingList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (this.pendingFiles.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<div class="space-y-2 mt-3">';
        this.pendingFiles.forEach((file, idx) => {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            html += `
                <div class="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                        </svg>
                        <span class="text-xs font-medium text-slate-700 truncate">${file.name}</span>
                        <span class="text-[10px] text-slate-400">${sizeMB} MB</span>
                    </div>
                    <button onclick="ZFlowAttachments.removePending(${idx}); ZFlowAttachments.renderPendingList('${containerId}')" 
                            class="text-red-400 hover:text-red-600 p-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>`;
        });
        html += '</div>';
        
        container.innerHTML = html;
    },

    /**
     * Inițializează drag & drop pe un element
     * @param {string} dropZoneId - ID-ul zonei de drop
     * @param {string} listContainerId - ID-ul containerului pentru lista fișiere
     */
    initDragDrop(dropZoneId, listContainerId) {
        const dropZone = document.getElementById(dropZoneId);
        if (!dropZone) return;
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-500', 'bg-blue-50');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500', 'bg-blue-50');
            
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => {
                const result = this.addPending(file);
                if (!result.success) {
                    window.ZFlowUI?.showNotification(result.error, 'error');
                }
            });
            
            this.renderPendingList(listContainerId);
        });
    }
};

// Export global
window.ZFlowAttachments = ZFlowAttachments;
