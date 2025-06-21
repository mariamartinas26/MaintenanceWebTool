
let suppliers = [];
let currentUser = null;

function getCurrentUserRole() {
    try {
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            return userData.role;
        }
        return null;
    } catch (error) {
        return null;
    }
}

function getCurrentUserName() {
    try {
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            return `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
        }
        return null;
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

function navigateToPage(url) {
    window.location.href = url;
}


async function loadSuppliersFromAPI() {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch('/api/accountant/suppliers', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            suppliers = result.data;
            loadSuppliers();
        } else {
            throw new Error(result.message || 'Failed to load suppliers');
        }
    } catch (error) {
        showNotification('Error loading suppliers: ' + error.message, 'error');
    }
}

async function saveSupplierToAPI(supplierData) {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch('/api/accountant/suppliers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(supplierData)
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            await loadSuppliersFromAPI();
        } else {
            throw new Error(result.message || 'Failed to save supplier');
        }
    } catch (error) {
        showNotification('Error saving supplier: ' + error.message, 'error');
    }
}

async function exportSuppliersFromAPI() {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch('/api/accountant/suppliers/export', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        const result = await response.json();

        if (result.success) {
            const dataStr = JSON.stringify(result.data, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});

            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `suppliers_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } else {
            throw new Error(result.message || 'Failed to export suppliers');
        }
    } catch (error) {
        showNotification('Error exporting suppliers: ' + error.message, 'error');
    }
}

function createAccountantDashboard() {
    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) {
        return;
    }

    dashboard.innerHTML = `
        <div class="manager-container">
            <!-- Header Section -->
            <div class="manager-header">
                <div class="header-content">
                    <div class="header-title">
                        <button class="btn btn-secondary" onclick="logout()">Logout</button>
                        <h1>Accountant Dashboard</h1>
                    </div>
                </div>
            </div>

            <!-- Quick Actions Section -->
            <div class="requests-section">
                <div class="requests-grid">
                    <div class="request-card">
                        <div class="request-header">
                            <div class="request-info">
                                <h4>Suppliers</h4>
                                <div class="request-email">Manage suppliers</div>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="action-btn view-btn" onclick="showSuppliersSection()">View</button>
                            <button class="action-btn approve-btn" onclick="openSupplierModal()">Add New</button>
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
                        <button class="btn btn-secondary" onclick="exportSuppliersFromAPI()">Export</button>
                        <button class="btn btn-secondary" onclick="hideSuppliersSection()">Back</button>
                    </div>
                </div>
                <div id="suppliers-list" class="suppliers-list">
                </div>
            </div>

            <div id="import-export-section" style="display: none;">
                <div class="section-header">
                    <h2>Import/Export Data</h2>
                    <div class="section-actions">
                        <button class="btn btn-secondary" onclick="hideImportExportSection()">Back</button>
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

        <div id="supplierModal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="supplierModalTitle">Add Supplier</h2>
                    <span class="close-modal" onclick="closeSupplierModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="supplierForm">
                        <div class="form-group">
                            <label for="supplierName">Company Name *</label>
                            <input type="text" id="supplierName" name="name" required maxlength="100">
                        </div>

                        <div class="form-group">
                            <label for="contactPerson">Contact Person *</label>
                            <input type="text" id="contactPerson" name="contact_person" required maxlength="100">
                        </div>

                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" name="email" required maxlength="100">
                        </div>

                        <div class="form-group">
                            <label for="phone">Phone</label>
                            <input type="tel" id="phone" name="phone" maxlength="20">
                        </div>

                        <div class="form-group">
                            <label for="address">Address</label>
                            <textarea id="address" name="address" rows="3" maxlength="500"></textarea>
                        </div>

                        <div class="form-group">
                            <label for="deliveryTime">Delivery Time (days)</label>
                            <input type="number" id="deliveryTime" name="delivery_time" min="1" max="365" value="7">
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeSupplierModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function showSuppliersSection() {
    document.getElementById('suppliers-section').style.display = 'block';
    loadSuppliersFromAPI();
}

function hideSuppliersSection() {
    document.getElementById('suppliers-section').style.display = 'none';
}

function showImportExportSection() {
    document.getElementById('import-export-section').style.display = 'block';
}

function hideImportExportSection() {
    document.getElementById('import-export-section').style.display = 'none';
}

// Import functionality
async function processImport() {
    const dataType = document.getElementById('importDataType').value;
    const format = document.getElementById('importFormat').value;
    const fileInput = document.getElementById('importFile');

    if (!dataType || !format || !fileInput.files[0]) {
        showNotification('Please select data type, format, and file', 'error');
        return;
    }

    const file = fileInput.files[0];

    try {
        const fileContent = await readFile(file);

        const token = localStorage.getItem('token');
        const response = await fetch('/api/accountant/import', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                dataType: dataType,
                format: format,
                data: fileContent
            })
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        const result = await response.json();

        if (result.success) {
            document.getElementById('importDataType').value = '';
            document.getElementById('importFormat').value = '';
            document.getElementById('importFile').value = '';

            if (result.data.errors.length > 0) {
                showNotification(`Import completed with ${result.data.errors.length} errors. Check console for details.`, 'warning');
            }
        } else {
            throw new Error(result.message || 'Failed to import data');
        }
    } catch (error) {
        showNotification('Error importing data: ' + error.message, 'error');
    }
}

// Export functionality
async function processExport() {
    const dataType = document.getElementById('exportDataType').value;
    const format = document.getElementById('exportFormat').value;

    if (!dataType || !format) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/accountant/export?dataType=${dataType}&format=${format}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (format === 'json') {
            const result = await response.json();
            if (result.success) {
                // Download JSON file
                const dataStr = JSON.stringify(result.data, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${dataType}_export_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

            } else {
                throw new Error(result.message || 'Failed to export data');
            }
        } else {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${dataType}_export_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        // Reset form
        document.getElementById('exportDataType').value = '';
        document.getElementById('exportFormat').value = '';

    } catch (error) {
        showNotification('Error exporting data: ' + error.message, 'error');
    }
}

// Helper function to read file content
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function loadSuppliers() {
    const suppliersList = document.getElementById('suppliers-list');

    if (!suppliersList) {
        return;
    }

    if (suppliers.length === 0) {
        return;
    }

    suppliersList.innerHTML = suppliers.map(supplier => `
        <div class="supplier-item">
            <div class="supplier-info">
                <h3>${supplier.company_name || supplier.name}</h3>
                <p>Contact: ${supplier.contact_person}</p>
                <p>Phone: ${supplier.phone || 'N/A'}</p>
                <p>Email: ${supplier.email}</p>
                <p>Delivery: ${supplier.delivery_time_days || supplier.delivery_time || 7} days</p>
                <p>Specialization: ${supplier.specialization || 'General'}</p>
            </div>
        </div>
    `).join('');
}

function openSupplierModal() {
    const modal = document.getElementById('supplierModal');
    const title = document.getElementById('supplierModalTitle');
    const form = document.getElementById('supplierForm');

    if (!modal || !title || !form) {
        return;
    }

    title.textContent = 'Add Supplier';
    form.reset();

    modal.style.display = 'flex';
}

function closeSupplierModal() {
    const modal = document.getElementById('supplierModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function saveSupplier() {
    const formData = {
        name: document.getElementById('supplierName')?.value,
        contact_person: document.getElementById('contactPerson')?.value,
        phone: document.getElementById('phone')?.value,
        email: document.getElementById('email')?.value,
        address: document.getElementById('address')?.value,
        delivery_time: parseInt(document.getElementById('deliveryTime')?.value) || 7
    };

    // Validation
    if (!formData.name || !formData.contact_person || !formData.email) {
        showNotification('Please fill in all required fields (Name, Contact Person, Email)', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    saveSupplierToAPI(formData);
    closeSupplierModal();
}

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function handleAuthError() {
    showNotification('Session expired. Please login again.', 'error');
    setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }, 2000);
}

function checkAccountantAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        console.log('No token, redirecting to login');
        window.location.href = '/login';
        return false;
    }

    if (!['admin', 'manager', 'accountant'].includes(user.role)) {
        console.log('User not allowed on accountant dashboard:', user.role);

        switch(user.role) {
            case 'manager':
                window.location.href = '/manager/dashboard';
                break;
            case 'client':
                window.location.href = '/client/dashboard';
                break;
            default:
                window.location.href = '/login';
        }
        return false;
    }

    return true;
}

function initializeAccountantDashboard() {
    if (!checkAccountantAuth()) {
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = getCurrentUserName();
    const userNameElement = document.getElementById('user-name');
    currentUser = user;

    if (userNameElement) {
        if (userName) {
            const roleLabel = user.role === 'accountant' ? 'Accountant' :
                user.role === 'admin' ? 'Administrator' :
                    user.role === 'manager' ? 'Manager' : user.role;
            userNameElement.textContent = `${roleLabel}: ${userName}`;
        } else {
            userNameElement.textContent = `${user.role}: ${user.email || 'User'}`;
        }
    }

    createAccountantDashboard();

    // Setup form submission
    setTimeout(() => {
        const supplierForm = document.getElementById('supplierForm');
        if (supplierForm) {
            supplierForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveSupplier();
            });
        }
    }, 100);
}

document.addEventListener('DOMContentLoaded', function() {
    initializeAccountantDashboard();
});

if (typeof window !== 'undefined') {
    window.getCurrentUserRole = getCurrentUserRole;
    window.getCurrentUserName = getCurrentUserName;
    window.logout = logout;
    window.navigateToPage = navigateToPage;
    window.createAccountantDashboard = createAccountantDashboard;
    window.showSuppliersSection = showSuppliersSection;
    window.hideSuppliersSection = hideSuppliersSection;
    window.showImportExportSection = showImportExportSection;
    window.hideImportExportSection = hideImportExportSection;
    window.processImport = processImport;
    window.processExport = processExport;
    window.openSupplierModal = openSupplierModal;
    window.closeSupplierModal = closeSupplierModal;
    window.exportSuppliersFromAPI = exportSuppliersFromAPI;
}