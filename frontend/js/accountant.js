let suppliers = [];

function getCurrentUser() {
    try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch (error) {
        return null;
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/homepage';
    }
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = getCurrentUser();

    if (!token || !user) {
        window.location.href = '/login';
        return false;
    }

    if (!['admin', 'manager', 'accountant'].includes(user.role)) {
        window.location.href = '/login';
        return false;
    }

    return true;
}

// Navigation functions
function hideAllSections() {
    document.getElementById('suppliers-section').style.display = 'none';
    document.getElementById('import-export-section').style.display = 'none';
}

function showSuppliersSection() {
    hideAllSections();
    document.getElementById('suppliers-section').style.display = 'block';
    loadSuppliersFromAPI();
}

function showImportExportSection() {
    hideAllSections();
    document.getElementById('import-export-section').style.display = 'block';
}

function goBack() {
    hideAllSections();
}

// API functions
async function apiCall(url, options = {}) {
    const token = localStorage.getItem('token');

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    const response = await fetch(url, {...defaultOptions, ...options});

    if (response.status === 401) {
        setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }, 2000);
        return null;
    }

    return response;
}

async function loadSuppliersFromAPI() {
    const response = await apiCall('/api/accountant/suppliers');
    if (!response || !response.ok) return;

    const result = await response.json();
    if (result.success) {
        suppliers = result.data;
        displaySuppliers();
    }
}

// Import/Export functions
async function processImport() {
    const dataType = document.getElementById('importDataType').value;
    const format = document.getElementById('importFormat').value;
    const fileInput = document.getElementById('importFile');

    if (!dataType || !format || !fileInput.files[0]) {
        return;
    }

    const fileContent = await readFile(fileInput.files[0]);

    const response = await apiCall('/api/accountant/import', {
        method: 'POST',
        body: JSON.stringify({
            dataType: dataType,
            format: format,
            data: fileContent
        })
    });

    if (!response || !response.ok) return;

    const result = await response.json();
    if (result.success) {
        showNotification(result.message, 'success');
        //clear form
        document.getElementById('importDataType').value = '';
        document.getElementById('importFormat').value = '';
        document.getElementById('importFile').value = '';
    }
}

async function processExport() {
    const dataType = document.getElementById('exportDataType').value;
    const format = document.getElementById('exportFormat').value;

    if (!dataType || !format) {
        return;
    }

    const response = await apiCall(`/api/accountant/export?dataType=${dataType}&format=${format}`);
    if (!response || !response.ok) return;

    if (format === 'json') {
        const result = await response.json();
        if (result.success) {
            downloadFile(JSON.stringify(result.data, null, 2), `${dataType}_export_${getDateString()}.json`, 'application/json');
        }
    } else {
        const blob = await response.blob();
        downloadBlob(blob, `${dataType}_export_${getDateString()}.${format}`);
    }

    //clear form
    document.getElementById('exportDataType').value = '';
    document.getElementById('exportFormat').value = '';
    showNotification('Export completed successfully', 'success');
}

// Display functions
function displaySuppliers() {
    const suppliersList = document.getElementById('suppliers-list');
    if (!suppliersList || suppliers.length === 0) return;

    suppliersList.innerHTML = suppliers.map(supplier => `
        <div class="supplier-item">
            <div class="supplier-info">
                <h3>${supplier.company_name || supplier.name}</h3>
                <p>Contact: ${supplier.contact_person}</p>
                <p>Email: ${supplier.email}</p>
                <p>Phone: ${supplier.phone || 'N/A'}</p>
                <p>Delivery: ${supplier.delivery_time_days || 7} days</p>
            </div>
        </div>
    `).join('');
}

function createDashboard() {
    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) return;

    dashboard.innerHTML = `
        <div class="manager-container">
            <div class="manager-header">
                <div class="header-content">
                    <div class="header-title">
                        <button class="btn btn-secondary" onclick="logout()">Logout</button>
                        <h1>Accountant Dashboard</h1>
                    </div>
                </div>
            </div>

            <div class="requests-section">
                <div class="requests-grid">
                    <div class="request-card">
                        <div class="request-header">
                            <div class="request-info">
                                <h4>Suppliers</h4>
                                <div class="request-email">View suppliers</div>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="action-btn view-btn" onclick="showSuppliersSection()">View</button>
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
                            <button class="action-btn view-btn" onclick="showImportExportSection()">Manage</button>
                        </div>
                    </div>   
                </div>
            </div>

            <div id="suppliers-section" style="display: none;">
                <div class="section-header">
                    <h2>Suppliers</h2>
                    <div class="section-actions">
                        <button class="btn btn-secondary" onclick="goBack()">Back</button>
                    </div>
                </div>
                <div id="suppliers-list" class="suppliers-list"></div>
            </div>

            <div id="import-export-section" style="display: none;">
                <div class="section-header">
                    <h2>Import/Export Data</h2>
                    <div class="section-actions">
                        <button class="btn btn-secondary" onclick="goBack()">Back</button>
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
                        
                        <button class="btn btn-primary" onclick="processImport()">Import Data</button>
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
                        
                        <button class="btn btn-primary" onclick="processExport()">Export Data</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Utility functions
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], {type: contentType});
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function getDateString() {
    return new Date().toISOString().split('T')[0];
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
}

// Initialize
function init() {
    if (!checkAuth()) return;
    createDashboard();
}

document.addEventListener('DOMContentLoaded', init);

window.logout = logout;
window.showSuppliersSection = showSuppliersSection;
window.showImportExportSection = showImportExportSection;
window.goBack = goBack;
window.processImport = processImport;
window.processExport = processExport;