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

        //daca nu am token redirectez la login
        if (!token) {
            window.location.href = '/login';
            return false;
        }

        if (!['accountant'].includes(user.role)) {
            return false;
        }

        return true;
    }

    createDashboard() {
        const dashboard = document.getElementById('dashboard-content');
        if (!dashboard) return;

        dashboard.innerHTML = `
            <div class="manager-container">
                <!-- Header-->
                <div class="manager-header">
                    <div class="header-content">
                        <div class="header-title">
                            <button class="btn btn-secondary" onclick="accountantDashboard.logout()">Logout</button>
                            <h1>Accountant Dashboard</h1>
                        </div>
                    </div>
                </div>

                <!--actions section -->
                <div class="requests-section">
                    <div class="requests-grid">
                        <div class="request-card">
                            <div class="request-header">
                                <div class="request-info">
                                    <h4>Suppliers</h4>
                                    <div class="request-email">View and manage suppliers</div>
                                </div>
                            </div>
                            <div class="request-actions">
                                <button class="action-btn view-btn" onclick="accountantDashboard.showSuppliersSection()">View</button>
                            </div>
                        </div>

                        <div class="request-card">
                            <div class="request-header">
                                <div class="request-info">
                                    <h4>Import/Export</h4>
                                    <div class="request-email">Import and export data</div>
                                </div>
                            </div>
                            <div class="request-actions">
                                <button class="action-btn view-btn" onclick="accountantDashboard.showImportExportSection()">Manage</button>
                            </div>
                        </div>   
                    </div>
                </div>

                <div id="suppliers-section" style="display: none;">
                    <div class="section-header">
                        <h2>Suppliers</h2>
                        <div class="section-actions">
                            <button class="btn btn-secondary" onclick="accountantDashboard.hideSuppliersSection()">Back</button>
                        </div>
                    </div>
                    <div id="suppliers-list" class="suppliers-list">
                    </div>
                </div>

                <div id="import-export-section" style="display: none;">
                    <div class="section-header">
                        <h2>Import/Export Data</h2>
                        <div class="section-actions">
                            <button class="btn btn-secondary" onclick="accountantDashboard.hideImportExportSection()">Back</button>
                        </div>
                    </div>
                    
                    <div class="import-section">
                        <h3>Import Data</h3>
                        <div class="import-form">
                            <div class="form-group">
                                <label for="importDataType">Data Type</label>
                                <select id="importDataType">
                                    <option value="">Select data type</option>
                                    <option value="suppliers">Suppliers</option>
                                    <option value="parts">Parts</option>
                                    <option value="appointments">Appointments</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="importFormat">Format</label>
                                <select id="importFormat">
                                    <option value="">Select format</option>
                                    <option value="csv">CSV</option>
                                    <option value="json">JSON</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="importFile">File</label>
                                <input type="file" id="importFile" accept=".csv,.json">
                            </div>
                            
                            <button class="btn btn-primary" onclick="accountantDashboard.processImport()">Import Data</button>
                        </div>
                    </div>
                    
                    <div class="export-section">
                        <h3>Export Data</h3>
                        <div class="export-form">
                            <div class="form-group">
                                <label for="exportDataType">Data Type</label>
                                <select id="exportDataType">
                                    <option value="">Select data type</option>
                                    <option value="suppliers">Suppliers</option>
                                    <option value="parts">Parts</option>
                                    <option value="appointments">Appointments</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="exportFormat">Format</label>
                                <select id="exportFormat">
                                    <option value="">Select format</option>
                                    <option value="csv">CSV</option>
                                    <option value="json">JSON</option>
                                    <option value="pdf">PDF</option>
                                </select>
                            </div>
                            
                            <button class="btn btn-primary" onclick="accountantDashboard.processExport()">Export Data</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
            this.suppliers = result.data;
            this.loadSuppliers();
        } else {
            throw new Error(result.message || 'Failed to load suppliers');
        }
    }

    loadSuppliers() {
        const suppliersList = document.getElementById('suppliers-list');

        if (!suppliersList) return;

        if (this.suppliers.length === 0) {
            suppliersList.innerHTML = '<p>No suppliers found.</p>';
            return;
        }

        suppliersList.innerHTML = this.suppliers.map(supplier => `
            <div class="supplier-item">
                <div class="supplier-info">
                    <h3>${supplier.company_name}</h3>
                    <p>Contact: ${supplier.contact_person}</p>
                    <p>Phone: ${supplier.phone || 'N/A'}</p>
                    <p>Email: ${supplier.email}</p>
                    <p>Delivery: ${supplier.delivery_time_days} days</p>
                    <p>Address: ${supplier.address}</p>
                </div>
            </div>
        `).join('');
    }

    //metoda procesare import
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

                // Safe check for errors
                const errors = result.data?.errors || [];
                const imported = result.data?.imported || 0;
                const failed = result.data?.failed || 0;

                if (errors.length > 0) {
                    alert(`Import completed!\nImported: ${imported}\nFailed: ${failed}\nCheck console for error details.`);
                } else {
                    alert(`Import successful!\n`);
                }
            } else {
                throw new Error(result.message || 'Failed to import data');
            }
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    }

    //procesare export
    async processExport() {
        const dataType = document.getElementById('exportDataType').value;
        const format = document.getElementById('exportFormat').value;

        if (!dataType || !format) {
            return;
        }

        try {
            const response = await fetch(`/api/accountant/export?dataType=${dataType}&format=${format}`, {
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
        link.download = filename;
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