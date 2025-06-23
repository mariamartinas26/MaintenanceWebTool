class AccountantDashboard {
    constructor() {
        this.suppliers = [];
        this.currentUser = null;
        this.token = localStorage.getItem('token');
    }

    init() {
        if (!this.checkAuth()) return;
        this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        this.createDashboard();
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/homepage';
        }
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (!token) {
            window.location.href = '/login';
            return false;
        }

        if (!['accountant'].includes(user.role)) {
            return false;
        }

        return true;
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    sanitizeObject(obj) {
        if (obj === null || typeof obj !== 'object') {
            return typeof obj === 'string' ? this.sanitizeInput(obj) : obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = this.sanitizeInput(key);
            sanitized[sanitizedKey] = this.sanitizeObject(value);
        }

        return sanitized;
    }

    createSafeElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = this.sanitizeInput(className);
        }
        if (textContent) {
            element.textContent = String(textContent);
        }
        return element;
    }

    safeSetText(element, text) {
        if (element && text !== null && text !== undefined) {
            element.textContent = String(text);
        }
    }


    createDashboard() {
        const dashboard = document.getElementById('dashboard-content');
        if (!dashboard) return;

        while (dashboard.firstChild) {
            dashboard.removeChild(dashboard.firstChild);
        }

        const managerContainer = this.createSafeElement('div', 'manager-container');

        // Create header
        const managerHeader = this.createSafeElement('div', 'manager-header');
        const headerContent = this.createSafeElement('div', 'header-content');
        const headerTitle = this.createSafeElement('div', 'header-title');

        const logoutBtn = this.createSafeElement('button', 'btn btn-secondary', 'Logout');
        logoutBtn.onclick = () => this.logout();

        const h1 = this.createSafeElement('h1', '', 'Accountant Dashboard');

        headerTitle.appendChild(logoutBtn);
        headerTitle.appendChild(h1);
        headerContent.appendChild(headerTitle);
        managerHeader.appendChild(headerContent);

        // Create requests section
        const requestsSection = this.createSafeElement('div', 'requests-section');
        const requestsGrid = this.createSafeElement('div', 'requests-grid');

        // Suppliers card
        const suppliersCard = this.createSafeElement('div', 'request-card');
        const suppliersHeader = this.createSafeElement('div', 'request-header');
        const suppliersInfo = this.createSafeElement('div', 'request-info');
        const suppliersH4 = this.createSafeElement('h4', '', 'Suppliers');
        const suppliersEmail = this.createSafeElement('div', 'request-email', 'View and manage suppliers');

        suppliersInfo.appendChild(suppliersH4);
        suppliersInfo.appendChild(suppliersEmail);
        suppliersHeader.appendChild(suppliersInfo);

        const suppliersActions = this.createSafeElement('div', 'request-actions');
        const suppliersViewBtn = this.createSafeElement('button', 'action-btn view-btn', 'View');
        suppliersViewBtn.onclick = () => this.showSuppliersSection();
        suppliersActions.appendChild(suppliersViewBtn);

        suppliersCard.appendChild(suppliersHeader);
        suppliersCard.appendChild(suppliersActions);

        // Import/Export card
        const importExportCard = this.createSafeElement('div', 'request-card');
        const importExportHeader = this.createSafeElement('div', 'request-header');
        const importExportInfo = this.createSafeElement('div', 'request-info');
        const importExportH4 = this.createSafeElement('h4', '', 'Import/Export');
        const importExportEmail = this.createSafeElement('div', 'request-email', 'Import and export data');

        importExportInfo.appendChild(importExportH4);
        importExportInfo.appendChild(importExportEmail);
        importExportHeader.appendChild(importExportInfo);

        const importExportActions = this.createSafeElement('div', 'request-actions');
        const importExportManageBtn = this.createSafeElement('button', 'action-btn view-btn', 'Manage');
        importExportManageBtn.onclick = () => this.showImportExportSection();
        importExportActions.appendChild(importExportManageBtn);

        importExportCard.appendChild(importExportHeader);
        importExportCard.appendChild(importExportActions);

        requestsGrid.appendChild(suppliersCard);
        requestsGrid.appendChild(importExportCard);
        requestsSection.appendChild(requestsGrid);

        // Create suppliers section
        const suppliersSection = this.createSafeElement('div');
        suppliersSection.id = 'suppliers-section';
        suppliersSection.style.display = 'none';

        const suppliersSectionHeader = this.createSafeElement('div', 'section-header');
        const suppliersH2 = this.createSafeElement('h2', '', 'Suppliers');
        const suppliersSectionActions = this.createSafeElement('div', 'section-actions');
        const suppliersBackBtn = this.createSafeElement('button', 'btn btn-secondary', 'Back');
        suppliersBackBtn.onclick = () => this.hideSuppliersSection();

        suppliersSectionActions.appendChild(suppliersBackBtn);
        suppliersSectionHeader.appendChild(suppliersH2);
        suppliersSectionHeader.appendChild(suppliersSectionActions);

        const suppliersList = this.createSafeElement('div', 'suppliers-list');
        suppliersList.id = 'suppliers-list';

        suppliersSection.appendChild(suppliersSectionHeader);
        suppliersSection.appendChild(suppliersList);

        // Create import/export section
        const importExportSection = this.createSafeElement('div');
        importExportSection.id = 'import-export-section';
        importExportSection.style.display = 'none';

        const importExportSectionHeader = this.createSafeElement('div', 'section-header');
        const importExportH2 = this.createSafeElement('h2', '', 'Import/Export Data');
        const importExportSectionActions = this.createSafeElement('div', 'section-actions');
        const importExportBackBtn = this.createSafeElement('button', 'btn btn-secondary', 'Back');
        importExportBackBtn.onclick = () => this.hideImportExportSection();

        importExportSectionActions.appendChild(importExportBackBtn);
        importExportSectionHeader.appendChild(importExportH2);
        importExportSectionHeader.appendChild(importExportSectionActions);

        // Import section
        const importSectionDiv = this.createSafeElement('div', 'import-section');
        const importH3 = this.createSafeElement('h3', '', 'Import Data');
        const importForm = this.createSafeElement('div', 'import-form');

        // Import data type
        const importDataTypeGroup = this.createSafeElement('div', 'form-group');
        const importDataTypeLabel = this.createSafeElement('label', '', 'Data Type');
        importDataTypeLabel.setAttribute('for', 'importDataType');
        const importDataTypeSelect = document.createElement('select');
        importDataTypeSelect.id = 'importDataType';

        const importDataTypeOptions = [
            { value: '', text: 'Select data type' },
            { value: 'suppliers', text: 'Suppliers' },
            { value: 'parts', text: 'Parts' },
            { value: 'appointments', text: 'Appointments' }
        ];

        importDataTypeOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            this.safeSetText(optionElement, option.text);
            importDataTypeSelect.appendChild(optionElement);
        });

        importDataTypeGroup.appendChild(importDataTypeLabel);
        importDataTypeGroup.appendChild(importDataTypeSelect);

        // Import format
        const importFormatGroup = this.createSafeElement('div', 'form-group');
        const importFormatLabel = this.createSafeElement('label', '', 'Format');
        importFormatLabel.setAttribute('for', 'importFormat');
        const importFormatSelect = document.createElement('select');
        importFormatSelect.id = 'importFormat';

        const importFormatOptions = [
            { value: '', text: 'Select format' },
            { value: 'csv', text: 'CSV' },
            { value: 'json', text: 'JSON' }
        ];

        importFormatOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            this.safeSetText(optionElement, option.text);
            importFormatSelect.appendChild(optionElement);
        });

        importFormatGroup.appendChild(importFormatLabel);
        importFormatGroup.appendChild(importFormatSelect);

        // Import file
        const importFileGroup = this.createSafeElement('div', 'form-group');
        const importFileLabel = this.createSafeElement('label', '', 'File');
        importFileLabel.setAttribute('for', 'importFile');
        const importFileInput = document.createElement('input');
        importFileInput.type = 'file';
        importFileInput.id = 'importFile';
        importFileInput.accept = '.csv,.json';

        importFileGroup.appendChild(importFileLabel);
        importFileGroup.appendChild(importFileInput);

        // Import button
        const importButton = this.createSafeElement('button', 'btn btn-primary', 'Import Data');
        importButton.onclick = () => this.processImport();

        importForm.appendChild(importDataTypeGroup);
        importForm.appendChild(importFormatGroup);
        importForm.appendChild(importFileGroup);
        importForm.appendChild(importButton);

        importSectionDiv.appendChild(importH3);
        importSectionDiv.appendChild(importForm);

        // Export section
        const exportSectionDiv = this.createSafeElement('div', 'export-section');
        const exportH3 = this.createSafeElement('h3', '', 'Export Data');
        const exportForm = this.createSafeElement('div', 'export-form');

        // Export data type
        const exportDataTypeGroup = this.createSafeElement('div', 'form-group');
        const exportDataTypeLabel = this.createSafeElement('label', '', 'Data Type');
        exportDataTypeLabel.setAttribute('for', 'exportDataType');
        const exportDataTypeSelect = document.createElement('select');
        exportDataTypeSelect.id = 'exportDataType';

        const exportDataTypeOptions = [
            { value: '', text: 'Select data type' },
            { value: 'suppliers', text: 'Suppliers' },
            { value: 'parts', text: 'Parts' },
            { value: 'appointments', text: 'Appointments' }
        ];

        exportDataTypeOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            this.safeSetText(optionElement, option.text);
            exportDataTypeSelect.appendChild(optionElement);
        });

        exportDataTypeGroup.appendChild(exportDataTypeLabel);
        exportDataTypeGroup.appendChild(exportDataTypeSelect);

        // Export format
        const exportFormatGroup = this.createSafeElement('div', 'form-group');
        const exportFormatLabel = this.createSafeElement('label', '', 'Format');
        exportFormatLabel.setAttribute('for', 'exportFormat');
        const exportFormatSelect = document.createElement('select');
        exportFormatSelect.id = 'exportFormat';

        const exportFormatOptions = [
            { value: '', text: 'Select format' },
            { value: 'csv', text: 'CSV' },
            { value: 'json', text: 'JSON' },
            { value: 'pdf', text: 'PDF' }
        ];

        exportFormatOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            this.safeSetText(optionElement, option.text);
            exportFormatSelect.appendChild(optionElement);
        });

        exportFormatGroup.appendChild(exportFormatLabel);
        exportFormatGroup.appendChild(exportFormatSelect);

        // Export button
        const exportButton = this.createSafeElement('button', 'btn btn-primary', 'Export Data');
        exportButton.onclick = () => this.processExport();

        exportForm.appendChild(exportDataTypeGroup);
        exportForm.appendChild(exportFormatGroup);
        exportForm.appendChild(exportButton);

        exportSectionDiv.appendChild(exportH3);
        exportSectionDiv.appendChild(exportForm);

        importExportSection.appendChild(importExportSectionHeader);
        importExportSection.appendChild(importSectionDiv);
        importExportSection.appendChild(exportSectionDiv);

        // Append all sections to manager container
        managerContainer.appendChild(managerHeader);
        managerContainer.appendChild(requestsSection);
        managerContainer.appendChild(suppliersSection);
        managerContainer.appendChild(importExportSection);

        // Append to dashboard
        dashboard.appendChild(managerContainer);
    }

    hideAllSections() {
        document.getElementById('suppliers-section').style.display = 'none';
        document.getElementById('import-export-section').style.display = 'none';
    }

    showSuppliersSection() {
        this.hideAllSections();
        document.getElementById('suppliers-section').style.display = 'block';
        this.loadSuppliersFromAPI();
    }

    hideSuppliersSection() {
        document.getElementById('suppliers-section').style.display = 'none';
    }

    showImportExportSection() {
        this.hideAllSections();
        document.getElementById('import-export-section').style.display = 'block';
    }

    hideImportExportSection() {
        document.getElementById('import-export-section').style.display = 'none';
    }

    async loadSuppliersFromAPI() {
        const response = await fetch('/api/accountant/suppliers', {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            this.handleAuthError();
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            this.suppliers = result.data.map(supplier => this.sanitizeObject(supplier));
            this.loadSuppliers();
        } else {
            throw new Error(result.message || 'Failed to load suppliers');
        }
    }

    loadSuppliers() {
        const suppliersList = document.getElementById('suppliers-list');

        if (!suppliersList) return;

        // Clear existing content safely
        while (suppliersList.firstChild) {
            suppliersList.removeChild(suppliersList.firstChild);
        }

        if (this.suppliers.length === 0) {
            const noSuppliersP = this.createSafeElement('p', '', 'No suppliers found.');
            suppliersList.appendChild(noSuppliersP);
            return;
        }

        this.suppliers.forEach(supplier => {
            const supplierItem = this.createSafeElement('div', 'supplier-item');
            const supplierInfo = this.createSafeElement('div', 'supplier-info');

            const h3 = this.createSafeElement('h3', '', supplier.company_name || '');
            const contactP = this.createSafeElement('p', '', `Contact: ${supplier.contact_person || ''}`);
            const phoneP = this.createSafeElement('p', '', `Phone: ${supplier.phone || 'N/A'}`);
            const emailP = this.createSafeElement('p', '', `Email: ${supplier.email || ''}`);
            const deliveryP = this.createSafeElement('p', '', `Delivery: ${supplier.delivery_time_days || ''} days`);
            const addressP = this.createSafeElement('p', '', `Address: ${supplier.address || ''}`);

            supplierInfo.appendChild(h3);
            supplierInfo.appendChild(contactP);
            supplierInfo.appendChild(phoneP);
            supplierInfo.appendChild(emailP);
            supplierInfo.appendChild(deliveryP);
            supplierInfo.appendChild(addressP);

            supplierItem.appendChild(supplierInfo);
            suppliersList.appendChild(supplierItem);
        });
    }

    async processImport() {
        const dataType = document.getElementById('importDataType').value;
        const format = document.getElementById('importFormat').value;
        const fileInput = document.getElementById('importFile');

        if (!dataType || !format || !fileInput.files[0]) {
            alert('Please select data type, format and file');
            return;
        }

        try {
            const file = fileInput.files[0];
            const fileContent = await this.readFile(file);

            const response = await fetch('/api/accountant/import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataType: this.sanitizeInput(dataType),
                    format: this.sanitizeInput(format),
                    data: fileContent
                })
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            const result = await response.json();

            if (result.success) {
                // Reset form
                document.getElementById('importDataType').value = '';
                document.getElementById('importFormat').value = '';
                document.getElementById('importFile').value = '';

                const sanitizedResult = this.sanitizeObject(result);
                const errors = sanitizedResult.data?.errors || [];
                const imported = sanitizedResult.data?.imported || 0;
                const failed = sanitizedResult.data?.failed || 0;

                if (errors.length > 0) {
                    alert(`Import completed!\nImported: ${imported}\nFailed: ${failed}\nCheck console for error details.`);
                } else {
                    alert(`Import successful!`);
                }
            } else {
                throw new Error(result.message || 'Failed to import data');
            }
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    }

    async processExport() {
        const dataType = document.getElementById('exportDataType').value;
        const format = document.getElementById('exportFormat').value;

        if (!dataType || !format) {
            return;
        }

        try {
            const sanitizedDataType = this.sanitizeInput(dataType);
            const sanitizedFormat = this.sanitizeInput(format);

            const response = await fetch(`/api/accountant/export?dataType=${encodeURIComponent(sanitizedDataType)}&format=${encodeURIComponent(sanitizedFormat)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Export failed: ${response.status} - ${errorText}`);
            }

            if (format === 'json') {
                const result = await response.json();
                if (result.success) {
                    const sanitizedData = this.sanitizeObject(result.data);
                    const dataStr = JSON.stringify(sanitizedData, null, 2);
                    const dataBlob = new Blob([dataStr], {type: 'application/json'});
                    this.downloadBlob(dataBlob, `${sanitizedDataType}_export_${this.getCurrentDate()}.json`);
                } else {
                    throw new Error(result.message || 'Failed to export data');
                }
            } else {
                const blob = await response.blob();
                this.downloadBlob(blob, `${sanitizedDataType}_export_${this.getCurrentDate()}.${sanitizedFormat}`);
            }

            // Reset form
            document.getElementById('exportDataType').value = '';
            document.getElementById('exportFormat').value = '';
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    }

    // Helper methods
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.sanitizeInput(filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    handleAuthError() {
        setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }, 2000);
    }
}

const accountantDashboard = new AccountantDashboard();

document.addEventListener('DOMContentLoaded', function () {
    accountantDashboard.init();
});

if (typeof window !== 'undefined') {
    window.accountantDashboard = accountantDashboard;
}