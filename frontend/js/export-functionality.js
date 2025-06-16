// export-functionality.js
class DataExporter {
    constructor() {
        this.exportModal = document.getElementById('export-modal');
        this.exportLink = document.getElementById('export-link');
        this.startExportBtn = document.getElementById('start-export-btn');
        this.closeModalElements = document.querySelectorAll('.close-modal');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Open export modal
        this.exportLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.openExportModal();
        });

        // Close modal
        this.closeModalElements.forEach(element => {
            element.addEventListener('click', () => {
                this.closeExportModal();
            });
        });

        // Close modal on background click
        this.exportModal.addEventListener('click', (e) => {
            if (e.target === this.exportModal) {
                this.closeExportModal();
            }
        });

        // Start export
        this.startExportBtn.addEventListener('click', () => {
            this.handleExport();
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.exportModal.style.display === 'flex') {
                this.closeExportModal();
            }
        });
    }

    openExportModal() {
        this.exportModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeExportModal() {
        this.exportModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    getSelectedDataTypes() {
        const checkboxes = [
            { id: 'export-appointments', type: 'appointments' },
            { id: 'export-parts', type: 'parts' },
            { id: 'export-suppliers', type: 'suppliers' },
            { id: 'export-orders', type: 'orders' }
        ];

        return checkboxes
            .filter(checkbox => document.getElementById(checkbox.id).checked)
            .map(checkbox => checkbox.type);
    }

    getSelectedFormat() {
        const formatRadios = document.querySelectorAll('input[name="export-format"]');
        for (const radio of formatRadios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return 'csv';
    }

    async fetchData(dataType) {
        let endpoint;
        switch (dataType) {
            case 'appointments':
                endpoint = '/admin/api/export/appointments';
                break;
            case 'parts':
                endpoint = '/admin/api/export/parts';
                break;
            case 'suppliers':
                endpoint = '/admin/api/export/suppliers';
                break;
            case 'orders':
                endpoint = '/admin/api/export/orders';
                break;
            default:
                throw new Error(`Unknown data type: ${dataType}`);
        }

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch ${dataType}: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success === false) {
            throw new Error(result.message || `Failed to fetch ${dataType}`);
        }

        const data = result.data || result.appointments || result.parts || result.suppliers || result.orders || result;
        return Array.isArray(data) ? data : [];
    }

    async handleExport() {
        const selectedData = this.getSelectedDataTypes();
        const exportFormat = this.getSelectedFormat();

        if (selectedData.length === 0) {
            this.showNotification('Please select at least one data type to export.', 'error');
            return;
        }

        try {
            this.startExportBtn.disabled = true;
            this.startExportBtn.textContent = 'Exporting...';
            this.showProgress(true);

            if (selectedData.length > 1) {
                try {
                    const response = await fetch('/admin/api/export/all', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                        },
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                            const exportData = {};
                            selectedData.forEach(dataType => {
                                if (result.data[dataType]) {
                                    exportData[dataType] = result.data[dataType];
                                }
                            });

                            await this.processExport(exportData, exportFormat);
                            this.showNotification('Export completed successfully!', 'success');
                            this.closeExportModal();
                            return;
                        }
                    }
                } catch (error) {
                    console.log('Bulk export not available, using individual requests');
                }
            }

            // Individual data fetching
            const exportData = {};
            let completed = 0;

            for (const dataType of selectedData) {
                this.updateProgress((completed / selectedData.length) * 100, `Fetching ${dataType}...`);

                const data = await this.fetchData(dataType);
                exportData[dataType] = data;
                completed++;

                this.updateProgress((completed / selectedData.length) * 100, `Fetched ${data.length} ${dataType} records`);
            }

            // Process export
            this.updateProgress(100, 'Processing export...');
            await this.processExport(exportData, exportFormat);

            this.showNotification('Export completed successfully!', 'success');
            this.closeExportModal();

        } catch (error) {
            console.error('Export error:', error);
            this.showNotification(`Export failed: ${error.message}`, 'error');
        } finally {
            this.startExportBtn.disabled = false;
            this.startExportBtn.textContent = 'Start Export';
            this.showProgress(false);
        }
    }

    async processExport(exportData, exportFormat) {
        switch (exportFormat) {
            case 'csv':
                this.exportAsCSV(exportData);
                break;
            case 'json':
                this.exportAsJSON(exportData);
                break;
            case 'pdf':
                this.exportAsPDF(exportData);
                break;
        }
    }

    showProgress(show) {
        let progressDiv = document.getElementById('export-progress');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.id = 'export-progress';
            progressDiv.className = 'export-progress';
            progressDiv.innerHTML = `
                <div class="progress-text">Preparing export...</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-details"></div>
            `;

            const modalBody = document.querySelector('#export-modal .modal-body');
            const formActions = modalBody.querySelector('.form-actions');
            modalBody.insertBefore(progressDiv, formActions);
        }

        if (show) {
            progressDiv.classList.add('show');
            this.updateProgress(0, 'Starting export...');
        } else {
            progressDiv.classList.remove('show');
        }
    }

    updateProgress(percentage, message) {
        const progressDiv = document.getElementById('export-progress');
        if (progressDiv) {
            const progressFill = progressDiv.querySelector('.progress-fill');
            const progressText = progressDiv.querySelector('.progress-text');
            const progressDetails = progressDiv.querySelector('.progress-details');

            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressText) progressText.textContent = message;
            if (progressDetails) {
                progressDetails.textContent = `${Math.round(percentage)}% complete`;
            }
        }
    }

    exportAsCSV(exportData) {
        Object.keys(exportData).forEach(dataType => {
            const data = exportData[dataType];
            if (data.length === 0) return;

            const csv = this.convertToCSV(data);
            const filename = `${dataType}_${this.getDateString()}.csv`;
            this.downloadFile(csv, filename, 'text/csv');
        });
    }

    exportAsJSON(exportData) {
        Object.keys(exportData).forEach(dataType => {
            const data = exportData[dataType];
            const json = JSON.stringify(data, null, 2);
            const filename = `${dataType}_${this.getDateString()}.json`;
            this.downloadFile(json, filename, 'application/json');
        });
    }

    exportAsPDF(exportData) {
        const reportContent = this.generatePDFContent(exportData);
        const filename = `repair_queens_report_${this.getDateString()}.pdf`;
        this.generateHTMLReport(reportContent, filename);
    }

    convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');

        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                if (typeof value === 'string') {
                    return `"${value.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
                }
                return value !== null && value !== undefined ? value : '';
            }).join(',');
        });

        return [csvHeaders, ...csvRows].join('\n');
    }

    generatePDFContent(exportData) {
        let content = `
            <html>
            <head>
                <title>Repair Queens - Data Export Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #101c5a; text-align: center; }
                    h2 { color: #4ecdc4; border-bottom: 2px solid #4ecdc4; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f8f9fa; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .export-date { text-align: center; color: #6c757d; margin-bottom: 20px; }
                    .no-data { text-align: center; color: #6c757d; font-style: italic; }
                </style>
            </head>
            <body>
                <h1>Repair Queens - Data Export Report</h1>
                <div class="export-date">Generated on: ${new Date().toLocaleString()}</div>
        `;

        Object.keys(exportData).forEach(dataType => {
            const data = exportData[dataType];
            content += `<h2>${this.getDataTypeTitle(dataType)} (${data.length} records)</h2>`;

            if (data.length === 0) {
                content += '<p class="no-data">No data available</p>';
                return;
            }

            content += '<table>';

            // Headers
            const headers = Object.keys(data[0]);
            content += '<tr>';
            headers.forEach(header => {
                content += `<th>${this.formatHeaderName(header)}</th>`;
            });
            content += '</tr>';

            // Rows (limit to first 50 for PDF)
            const limitedData = data.slice(0, 50);
            limitedData.forEach(row => {
                content += '<tr>';
                headers.forEach(header => {
                    const value = row[header];
                    content += `<td>${value !== null && value !== undefined ? value : ''}</td>`;
                });
                content += '</tr>';
            });

            if (data.length > 50) {
                content += `<tr><td colspan="${headers.length}" style="text-align: center; font-style: italic;">... and ${data.length - 50} more records</td></tr>`;
            }

            content += '</table>';
        });

        content += '</body></html>';
        return content;
    }

    generateHTMLReport(content, filename) {
        const blob = new Blob([content], { type: 'text/html' });
        this.downloadFile(blob, filename.replace('.pdf', '.html'), 'text/html');
        this.showNotification('HTML report generated. Open the file and use browser\'s "Print to PDF" feature.', 'success');
    }

    downloadFile(content, filename, mimeType) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    getDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        return `${year}${month}${day}_${hours}${minutes}`;
    }

    getDataTypeTitle(dataType) {
        const titles = {
            appointments: 'Appointments',
            parts: 'Parts Inventory',
            suppliers: 'Suppliers',
            orders: 'Orders'
        };
        return titles[dataType] || dataType;
    }

    formatHeaderName(header) {
        return header
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} show`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DataExporter();
});