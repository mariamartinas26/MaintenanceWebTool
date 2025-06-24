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

    //pagina principala
    showMainDashboard() {
        this.hideAllSections();
        const mainDashboard = document.getElementById('main-dashboard');
        if (mainDashboard) mainDashboard.style.display = 'block';
    }

    //lista de furnizori
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

    //sectiunea import/export
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
            //trimitem request GET la endpointul pt suppliers
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
                this.displaySuppliers();
            } else {
                throw new Error(result.message || 'Failed to load suppliers');
            }
        } catch (error) {
            this.displayError('Failed to load suppliers');
        }
    }

    //afisam lista de suppliers
    displaySuppliers() {
        const suppliersList = document.getElementById('suppliers-list');

        if (this.suppliers.length === 0) {
            const noSuppliers = document.createElement('p');
            noSuppliers.textContent = 'No suppliers found.';
            noSuppliers.style.cssText = 'text-align: center; color: #666; padding: 20px;';
            suppliersList.appendChild(noSuppliers);
            return;
        }

        //creez cate un card pt fiecare furnizor
        this.suppliers.forEach(supplier => {
            const supplierItem = this.createSupplierCard(supplier);
            suppliersList.appendChild(supplierItem);
        });
    }

    createSupplierCard(supplier) {
        const supplierItem = document.createElement('div');
        supplierItem.className = 'supplier-item'; //pt css

        const supplierInfo = document.createElement('div');
        supplierInfo.className = 'supplier-info';

        //name
        const h3 = document.createElement('h3');
        h3.textContent = supplier.company_name;
        supplierInfo.appendChild(h3);

        //contact person
        const contactP = document.createElement('p');
        contactP.textContent = `Contact: ${supplier.contact_person}`;
        supplierInfo.appendChild(contactP);

        //phone
        const phoneP = document.createElement('p');
        phoneP.textContent = `Phone: ${supplier.phone}`;
        supplierInfo.appendChild(phoneP);

        //email
        const emailP = document.createElement('p');
        emailP.textContent = `Email: ${supplier.email}`;
        supplierInfo.appendChild(emailP);

        //delivery time
        const deliveryP = document.createElement('p');
        deliveryP.textContent = `Delivery: ${supplier.delivery_time_days} days`;
        supplierInfo.appendChild(deliveryP);

        //adress
        const addressP = document.createElement('p');
        addressP.textContent = `Address: ${supplier.address}`;
        supplierInfo.appendChild(addressP);

        supplierItem.appendChild(supplierInfo);
        return supplierItem;
    }

    async processImport() {
        //colectam datele din interfata
        const dataType = document.getElementById('importDataType')?.value; //suppliers,parts,appointments
        const format = document.getElementById('importFormat')?.value; //csv,json
        const fileInput = document.getElementById('importFile'); //fisierul pe care vrem sa il importam

        if (!dataType || !format || !fileInput?.files[0]) {
            alert('Please select data type, format and file');
            return;
        }

        try {
            const file = fileInput.files[0];
            const fileContent = await this.readFile(file);

            //procesare continut fisier
            let data;
            if (format === 'json') {
                //parseaza json in obiect
                data = JSON.parse(fileContent);
            } else {
                //trimitem continutul ca string, parsarea csv se face in backend
                data = fileContent;
            }
            //trimitem request la backend
            const response = await fetch('/api/accountant/import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ //convertesc din obiect in string
                    dataType: dataType,
                    format: format,
                    data: data
                })
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            const result = await response.json();

            if (result.success) {
                //resetez formularul
                document.getElementById('importDataType').value = '';
                document.getElementById('importFormat').value = '';
                document.getElementById('importFile').value = '';

                alert(`Import successful!`);
            } else {
                throw new Error(result.message || 'Failed to import data');
            }
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    }

    async processExport() {
        const dataType = document.getElementById('exportDataType')?.value; //suppliers,parts,appointments
        const format = document.getElementById('exportFormat')?.value;//json,csv,pdf

        if (!dataType || !format) {
            alert('Please select data type and format');
            return;
        }

        //facem request la backend
        try {
            const response = await fetch('/api/accountant/export', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dataType: dataType, //ce exportam
                    format: format //in ce format
                })
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (!response.ok) {
                throw new Error(`Export failed`);
            }
            //procesare raspuns
            const blob = await response.blob();
            const filename = `${dataType}_export_${this.getCurrentDate()}.${format}`;
            this.downloadBlob(blob, filename);

            //resetare formular
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