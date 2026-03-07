/**
 * Z-FLOW Enterprise v7.14
 * Module: Export - Generare PDF și Excel
 * 
 * Modul suplimentar - NU înlocuiește codul din app.js
 */

const ZFlowExport = {
    /**
     * Generează raport PDF din facturi
     * @param {Array} facturi - Lista de facturi
     * @param {Object} options - Opțiuni export
     * @returns {jsPDF}
     */
    generatePDF(facturi, options = {}) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        const firmaNume = options.firmaNume || window.ZFlowUserProfile?.nume_firma || 'Z-FLOW';
        const titlu = options.titlu || 'Raport Facturi';
        const dataRaport = new Date().toLocaleDateString('ro-RO');
        
        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(firmaNume, 14, 20);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(titlu, 14, 28);
        doc.setFontSize(9);
        doc.text(`Generat: ${dataRaport}`, 14, 34);
        
        // Statistici
        const totals = window.ZFlowInvoices?.calculeazaTotaluri(facturi) || {};
        doc.setFontSize(10);
        doc.text(`Total facturi: ${facturi.length}`, 14, 42);
        doc.text(`Valoare totală: ${this.formatSuma(totals.total)}`, 14, 48);
        doc.text(`Încasat/Plătit: ${this.formatSuma(totals.incasat)}`, 100, 42);
        doc.text(`Restant: ${this.formatSuma(totals.neincasat)}`, 100, 48);
        
        // Tabel
        const tableData = facturi.map(f => {
            const client = window.ZFlowClients?.findById(f.client_id);
            const furnizor = window.ZFlowSuppliers?.findById(f.furnizor_id);
            return [
                f.numar_factura || f.nr_factura || '-',
                client?.nume_firma || furnizor?.nume_firma || '-',
                this.formatData(f.data_emiterii || f.data_emitere),
                this.formatData(f.data_scadenta),
                this.formatSuma(f.valoare || f.suma),
                f.status_plata || 'Neincasat'
            ];
        });
        
        doc.autoTable({
            startY: 55,
            head: [['Nr. Factură', 'Client/Furnizor', 'Emitere', 'Scadență', 'Sumă', 'Status']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [30, 58, 138],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            columnStyles: {
                4: { halign: 'right' },
                5: { halign: 'center' }
            }
        });
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Pagina ${i} din ${pageCount}`, 190, 285, { align: 'right' });
            doc.text('Generat cu Z-FLOW Enterprise', 14, 285);
        }
        
        return doc;
    },

    /**
     * Salvează PDF generat
     * @param {Array} facturi 
     * @param {string} filename 
     */
    savePDF(facturi, filename = 'raport-facturi.pdf') {
        const doc = this.generatePDF(facturi);
        doc.save(filename);
    },

    /**
     * Generează fișier Excel din facturi
     * @param {Array} facturi 
     * @param {Object} options 
     */
    generateExcel(facturi, options = {}) {
        const XLSX = window.XLSX;
        if (!XLSX) {
            console.error('XLSX library not loaded');
            return null;
        }
        
        const filename = options.filename || 'raport-facturi.xlsx';
        const sheetName = options.sheetName || 'Facturi';
        
        const data = facturi.map(f => {
            const client = window.ZFlowClients?.findById(f.client_id);
            const furnizor = window.ZFlowSuppliers?.findById(f.furnizor_id);
            return {
                'Nr. Factură': f.numar_factura || f.nr_factura || '',
                'Client/Furnizor': client?.nume_firma || furnizor?.nume_firma || '',
                'CUI': client?.cui || furnizor?.cui || '',
                'Data Emitere': f.data_emiterii || f.data_emitere || '',
                'Data Scadență': f.data_scadenta || '',
                'Sumă': parseFloat(f.valoare || f.suma) || 0,
                'Status': f.status_plata || 'Neincasat',
                'Descriere': f.descriere || '',
                'Observații': f.observatii || ''
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        // Setări coloane
        ws['!cols'] = [
            { wch: 15 }, // Nr. Factură
            { wch: 30 }, // Client
            { wch: 12 }, // CUI
            { wch: 12 }, // Data Emitere
            { wch: 12 }, // Data Scadență
            { wch: 12 }, // Sumă
            { wch: 10 }, // Status
            { wch: 30 }, // Descriere
            { wch: 30 }  // Observații
        ];
        
        return { workbook: wb, filename };
    },

    /**
     * Salvează Excel generat
     * @param {Array} facturi 
     * @param {string} filename 
     */
    saveExcel(facturi, filename = 'raport-facturi.xlsx') {
        const result = this.generateExcel(facturi, { filename });
        if (!result || !window.XLSX) return;
        try {
            // Blob download — compatible cross-browser (incl. Safari)
            const wbout = window.XLSX.write(result.workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch(e) {
            console.error('[ZFlowExport] saveExcel error:', e);
            // Fallback la writeFile dacă Blob nu funcționează
            window.XLSX.writeFile(result.workbook, result.filename);
        }
    },

    /**
     * Export CSV simplu
     * @param {Array} facturi 
     * @param {string} filename 
     */
    saveCSV(facturi, filename = 'raport-facturi.csv') {
        const headers = ['Nr. Factură', 'Client', 'CUI', 'Data Emitere', 'Data Scadență', 'Sumă', 'Status'];
        
        let csv = headers.join(',') + '\n';
        
        facturi.forEach(f => {
            const client = window.ZFlowClients?.findById(f.client_id);
            const furnizor = window.ZFlowSuppliers?.findById(f.furnizor_id);
            const row = [
                `"${f.numar_factura || f.nr_factura || ''}"`,
                `"${(client?.nume_firma || furnizor?.nume_firma || '').replace(/"/g, '""')}"`,
                `"${client?.cui || furnizor?.cui || ''}"`,
                f.data_emiterii || f.data_emitere || '',
                f.data_scadenta || '',
                f.valoare || f.suma || 0,
                f.status_plata || 'Neincasat'
            ];
            csv += row.join(',') + '\n';
        });
        
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    },

    /**
     * Helper: Formatează suma
     * @param {number} suma 
     * @returns {string}
     */
    formatSuma(suma) {
        return new Intl.NumberFormat('ro-RO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(suma || 0) + ' RON';
    },

    /**
     * Helper: Formatează data
     * @param {string} dataStr 
     * @returns {string}
     */
    formatData(dataStr) {
        if (!dataStr) return '-';
        const d = new Date(dataStr);
        if (isNaN(d.getTime())) return dataStr;
        return d.toLocaleDateString('ro-RO');
    }
};

// Export global
window.ZFlowExport = ZFlowExport;

// ==========================================
// EXPORT CSV LOGISTIC — Task 8
// ==========================================
function exportComenziTransportCSV() {
    const comenzi = window.ZFlowStore?.dateComenziTransport || [];
    if (!comenzi.length) { if (typeof showNotification === 'function') showNotification('Nu există comenzi de exportat', 'error'); return; }
    const clienti  = window.ZFlowStore?.dateLocal || [];
    const soferi   = window.ZFlowStore?.dateSoferi || [];
    const vehicule = window.ZFlowStore?.dateVehicule || [];
    const headers  = ['Tracking', 'Ruta De', 'Ruta La', 'Client', 'Sofer', 'Vehicul', 'Data Plecare', 'Data Livrare', 'Status', 'Valoare', 'Observatii'];
    const rows = comenzi.map(c => {
        const cl  = clienti.find(x  => String(x.id)  === String(c.client_id));
        const sf  = soferi.find(x   => String(x.id)  === String(c.sofer_id));
        const vh  = vehicule.find(x => String(x.id)  === String(c.vehicul_id));
        return [
            `"${c.tracking_code||''}"`, `"${c.ruta_de||''}"`, `"${c.ruta_la||''}"`,
            `"${cl?.nume_firma||''}"`, `"${sf?.nume||''}"`, `"${vh?.nr_inmatriculare||''}"`,
            c.data_plecare||'', c.data_livrare||'',
            `"${c.status||''}"`, c.valoare||0, `"${(c.observatii||'').replace(/"/g,'""')}"`
        ];
    });
    const csv  = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `comenzi_transport_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    if (typeof showNotification === 'function') showNotification('Export comenzi finalizat', 'success');
}

function exportSoferiCSV() {
    const soferi = window.ZFlowStore?.dateSoferi || [];
    if (!soferi.length) { if (typeof showNotification === 'function') showNotification('Nu există șoferi de exportat', 'error'); return; }
    const headers = ['Nume', 'Telefon', 'Nr Permis', 'CNP', 'Email', 'Observatii'];
    const rows = soferi.map(s => [
        `"${(s.nume||'').replace(/"/g,'""')}"`, `"${s.telefon||''}"`,
        `"${s.nr_permis||''}"`, `"${s.cnp||''}"`,
        `"${s.email||''}"`, `"${(s.observatii||'').replace(/"/g,'""')}"`
    ]);
    const csv  = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `soferi_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    if (typeof showNotification === 'function') showNotification('Export șoferi finalizat', 'success');
}

function exportVehiculeCSV() {
    const vehicule = window.ZFlowStore?.dateVehicule || [];
    if (!vehicule.length) { if (typeof showNotification === 'function') showNotification('Nu există vehicule de exportat', 'error'); return; }
    const headers = ['Nr Inmatriculare', 'Marca', 'Model', 'Tip', 'An Fabricatie', 'Observatii'];
    const rows = vehicule.map(v => [
        `"${v.nr_inmatriculare||''}"`, `"${v.marca||''}"`, `"${v.model||''}"`,
        `"${v.tip||''}"`, v.an_fabricatie||'', `"${(v.observatii||'').replace(/"/g,'""')}"`
    ]);
    const csv  = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `vehicule_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    if (typeof showNotification === 'function') showNotification('Export vehicule finalizat', 'success');
}

window.exportComenziTransportCSV = exportComenziTransportCSV;
window.exportSoferiCSV           = exportSoferiCSV;
window.exportVehiculeCSV         = exportVehiculeCSV;
