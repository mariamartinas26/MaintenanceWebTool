class AccountantDashboard {
    constructor() {
        this.suppliers = [];
        this.token = localStorage.getItem('token');
    }

    init() {
        if (!this.checkAuth()) return;
        this.setupEventListeners();
        this.showMainDashboard();
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            this.bindEvents();
        });
        this.bindEvents();
    }

    bindEvents() {
        // Navigation buttons
        const logoutBtn = document.getElementById('logout-btn');
        const suppliersViewBtn = document.getElementById('suppliers-view-btn');
        const importExportBtn = document.getElementById('import-export-manage-btn');
        const suppliersBackBtn = document.getElementById('suppliers-back-btn');
        const importExportBackBtn = document.getElementById('import-export-back-btn');
        const importBtn = document.getElementById('import-btn');
        const exportBtn = document.getElementById('export-btn');

        if (logoutBtn) logoutBtn.onclick = () => this.logout();
        if (suppliersViewBtn) suppliersViewBtn.onclick = () => this.showSuppliersSection();
        if (importExportBtn) importExportBtn.onclick = () => this.showImportExportSection();
        if (suppliersBackBtn) suppliersBackBtn.onclick = () => this.hideSuppliersSection();
        if (importExportBackBtn) importExportBackBtn.onclick = () => this.hideImportExportSection();
        if (importBtn) importBtn.onclick = () => this.processImport();
        if (exportBtn) exportBtn.onclick = () => this.processExport();
    }

    logout() {
        localStorage.clear();
        window.location.href = '/homepage';
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (!token) {
            window.location.href = '/login';
            return false;
        }

        if (!['accountant'].includes(user.role)) {
            window.location.href = '/login';
            return false;
        }

        return true;
    }

    hideAllSections() {
        const mainDashboard = document.getElementById('main-dashboard');
        const suppliersSection = document.getElementById('suppliers-section');
        const importExportSection = document.getElementById('import-export-section');

        if (mainDashboard) mainDashboard.style.display = 'none';
        if (suppliersSection) suppliersSection.style.display = 'none';
        if (importExportSection) importExportSection.style.display = 'none';
    }

    showMainDashboard() {
        this.hideAllSections();
        const mainDashboard = document.getElementById('main-dashboard');
        if (mainDashboard) mainDashboard.style.display = 'block';
    }

    showSuppliersSection() {
        this.hideAllSections();
        const suppliersSection = document.getElementById('suppliers-section');
        if (suppliersSection) {
            suppliersSection.style.display = 'block';
            this.loadSuppliersFromAPI();
        }
    }

    hideSuppliersSection() {
        this.showMainDashboard();
    }

    showImportExportSection() {
        this.hideAllSections();
        const importExportSection = document.getElementById('import-export-section');
        if (importExportSection) {
            importExportSection.style.display = 'block';
        }
    }

    hideImportExportSection() {
        this.showMainDashboard();
    }

    async loadSuppliersFromAPI() {
        try {
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
                this.suppliers = result.data || [];
                this.renderSuppliers();
            } else {
                throw new Error(result.message || 'Failed to load suppliers');
            }
        } catch (error) {
            this.displayError('Failed to load suppliers');
        }
    }

    renderSuppliers() {
        const suppliersList = document.getElementById('suppliers-list');
        if (!suppliersList) return;

        if (this.suppliers.length === 0) {
            const noSuppliers = document.createElement('p');
            noSuppliers.textContent = 'No suppliers found.';
            noSuppliers.style.cssText = 'text-align: center; color: #666; padding: 20px;';
            suppliersList.appendChild(noSuppliers);
            return;
        }

        this.suppliers.forEach(supplier => {
            const supplierItem = this.createSupplierCard(supplier);
            suppliersList.appendChild(supplierItem);
        });
    }

    createSupplierCard(supplier) {
        const supplierItem = document.createElement('div');
        supplierItem.className = 'supplier-item';

        const supplierInfo = document.createElement('div');
        supplierInfo.className = 'supplier-info';

        // Company name
        const h3 = document.createElement('h3');
        h3.textContent = supplier.company_name;
        supplierInfo.appendChild(h3);

        // Contact person
        const contactP = document.createElement('p');
        contactP.textContent = `Contact: ${supplier.contact_person}`;
        supplierInfo.appendChild(contactP);

        // Phone
        const phoneP = document.createElement('p');
        phoneP.textContent = `Phone: ${supplier.phone }`;
        supplierInfo.appendChild(phoneP);

        // Email
        const emailP = document.createElement('p');
        emailP.textContent = `Email: ${supplier.email }`;
        supplierInfo.appendChild(emailP);

        // Delivery time
        const deliveryP = document.createElement('p');
        deliveryP.textContent = `Delivery: ${supplier.delivery_time_days } days`;
        supplierInfo.appendChild(deliveryP);

        // Address
        const addressP = document.createElement('p');
        addressP.textContent = `Address: ${supplier.address }`;
        supplierInfo.appendChild(addressP);

        supplierItem.appendChild(supplierInfo);
        return supplierItem;
    }

    async processImport() {
        const dataType = document.getElementById('importDataType')?.value;
        const format = document.getElementById('importFormat')?.value;
        const fileInput = document.getElementById('importFile');

        if (!dataType || !format || !fileInput?.files[0]) {
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
                    dataType: dataType,
                    format: format,
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

                const errors = result.data?.errors || [];
                const imported = result.data?.imported || 0;
                const failed = result.data?.failed || 0;

                if (errors.length > 0) {
                    alert(`Import completed!\nImported: ${imported}\nFailed: ${failed}`);
                } else {
                    alert('Import successful!');
                }
            } else {
                throw new Error(result.message || 'Failed to import data');
            }
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    }

    async processExport() {
        const dataType = document.getElementById('exportDataType')?.value;
        const format = document.getElementById('exportFormat')?.value;

        if (!dataType || !format) {
            alert('Please select data type and format');
            return;
        }

        try {
            const response = await fetch(`/api/accountant/export?dataType=${encodeURIComponent(dataType)}&format=${encodeURIComponent(format)}`, {
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
                    const dataStr = JSON.stringify(result.data, null, 2);
                    const dataBlob = new Blob([dataStr], {type: 'application/json'});
                    this.downloadBlob(dataBlob, `${dataType}_export_${this.getCurrentDate()}.json`);
                } else {
                    throw new Error(result.message || 'Failed to export data');
                }
            } else {
                const blob = await response.blob();
                this.downloadBlob(blob, `${dataType}_export_${this.getCurrentDate()}.${format}`);
            }

            // Reset form
            document.getElementById('exportDataType').value = '';
            document.getElementById('exportFormat').value = '';
        } catch (error) {
            alert('Export failed: ' + error.message);
        }
    }

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
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    displayError(message) {
        console.error(message);
        alert(message);
    }

    handleAuthError() {
        alert('Session expired. Please login again.');
        setTimeout(() => {
            localStorage.clear();
            window.location.href = '/login';
        }, 1000);
    }
}

const accountantDashboard = new AccountantDashboard();

accountantDashboard.init();