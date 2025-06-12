// Global variables
let allParts = [];
let filteredParts = [];
let currentView = 'grid';
let currentPage = 1;
let itemsPerPage = 12;
let selectedParts = new Set();
let deletePartId = null;
let updatePartId = null;
let searchTimeout = null;

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function checkAuthentication() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/admin/login';
        return false;
    }
    return true;
}

// Initialize page when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuthentication()) {
        return;
    }

    initializePage();
    setupEventListeners();
    loadParts();
    loadCategories();
    loadAdminInfo();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('clearSearch').addEventListener('click', clearSearch);

    // Filters
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('stockFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
    document.getElementById('sortOrder').addEventListener('change', applyFilters);

    // Stock update form
    document.getElementById('stockUpdateForm').addEventListener('submit', handleStockUpdate);

    // Modal close events
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideAllModals();
            }
        });
    });

    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideAllModals();
        }
    });

    // Navigation functionality
    setupNavigationListeners();
}

// Setup navigation listeners
function setupNavigationListeners() {
    const providersLink = document.getElementById('providers-link');
    if (providersLink) {
        providersLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/suppliers';
        });
    }

    const ordersLink = document.getElementById('orders-link');
    if (ordersLink) {
        ordersLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/suppliers#orders';
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            logout();
        });
    }
}

// Load admin info
async function loadAdminInfo() {
    try {
        const adminName = localStorage.getItem('adminName') || 'Admin';
        document.getElementById('admin-name').textContent = adminName;
    } catch (error) {
        document.getElementById('admin-name').textContent = 'Admin';
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('adminName');
        window.location.href = '/admin/login';
    }
}

// Initialize page settings
function initializePage() {
    // Load saved view preference
    const savedView = localStorage.getItem('partsView') || 'grid';
    setView(savedView);

    // Load saved items per page
    const savedItemsPerPage = localStorage.getItem('partsItemsPerPage');
    if (savedItemsPerPage) {
        itemsPerPage = parseInt(savedItemsPerPage);
    }

    // Set default stock filter to "in-stock"
    document.getElementById('stockFilter').value = 'in-stock';
}

// Load all parts
async function loadParts() {
    try {
        showLoading(true);

        const response = await fetch('/inventory/api/parts', {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            allParts = data.parts;
            applyFilters();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading parts:', error);
        showNotification('Error loading parts', 'error');
        displayEmptyState('Error loading parts. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Load categories for filter dropdown
async function loadCategories() {
    try {
        const response = await fetch('/inventory/api/parts/categories', {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            populateCategoryFilter(data.categories);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Populate category filter dropdown
function populateCategoryFilter(categories) {
    const select = document.getElementById('categoryFilter');

    // Clear existing options except "All Categories"
    select.innerHTML = '<option value="all">All Categories</option>';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

// Handle search input
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    const clearBtn = document.getElementById('clearSearch');

    // Show/hide clear button
    clearBtn.style.display = searchTerm ? 'block' : 'none';

    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
        applyFilters();
    }, 300);
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    applyFilters();
}

// Apply all filters and sorting
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const stockFilter = document.getElementById('stockFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    const sortOrder = document.getElementById('sortOrder').value;

    // Start with all parts
    filteredParts = [...allParts];

    // Apply search filter
    if (searchTerm) {
        filteredParts = filteredParts.filter(part =>
            part.name.toLowerCase().includes(searchTerm) ||
            (part.partNumber && part.partNumber.toLowerCase().includes(searchTerm)) ||
            (part.description && part.description.toLowerCase().includes(searchTerm)) ||
            part.category.toLowerCase().includes(searchTerm) ||
            (part.supplier.name && part.supplier.name.toLowerCase().includes(searchTerm))
        );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
        filteredParts = filteredParts.filter(part => part.category === categoryFilter);
    }

    // Apply stock filter (always filter, no "all" option)
    switch (stockFilter) {
        case 'in-stock':
            filteredParts = filteredParts.filter(part => part.stockQuantity > part.minimumStockLevel);
            break;
        case 'low-stock':
            filteredParts = filteredParts.filter(part => part.stockQuantity <= part.minimumStockLevel && part.stockQuantity > 0);
            break;
        case 'out-of-stock':
            filteredParts = filteredParts.filter(part => part.stockQuantity === 0);
            break;
    }

    // Apply sorting
    filteredParts.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];

        // Handle nested properties
        if (sortBy.includes('.')) {
            const keys = sortBy.split('.');
            aVal = keys.reduce((obj, key) => obj?.[key], a);
            bVal = keys.reduce((obj, key) => obj?.[key], b);
        }

        // Handle different data types
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        }

        if (aVal < bVal) return sortOrder === 'desc' ? 1 : -1;
        if (aVal > bVal) return sortOrder === 'desc' ? -1 : 1;
        return 0;
    });

    // Reset to first page
    currentPage = 1;

    // Update display
    updateResultsCount();
    displayParts();
    updatePagination();
}

// Update results count display
function updateResultsCount() {
    const count = filteredParts.length;
    const total = allParts.length;
    const countElement = document.getElementById('resultsCount');

    if (count === total) {
        countElement.textContent = `Showing all ${total} parts`;
    } else {
        countElement.textContent = `Showing ${count} of ${total} parts`;
    }
}

// Display parts based on current view and pagination
function displayParts() {
    const container = document.getElementById('partsContainer');

    if (filteredParts.length === 0) {
        displayEmptyState();
        return;
    }


    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredParts.slice(startIndex, endIndex);

    const html = pageItems.map(part => createPartCard(part)).join('');
    container.innerHTML = html;

    container.className = `parts-${currentView === 'grid' ? 'grid' : 'grid list-view'}`;
}

function createPartCard(part) {
    const stockStatus = getStockStatus(part);
    const stockClass = stockStatus.toLowerCase().replace(' ', '-');

    return `
        <div class="part-card ${stockClass}" data-part-id="${part.id}">
            <div class="part-card-header">
                <div class="part-title">
                    <h3>${escapeHtml(part.name)}</h3>
                    ${part.partNumber ? `<span class="part-number">${escapeHtml(part.partNumber)}</span>` : ''}
                </div>
                <div class="part-actions">
                    <button class="action-btn" onclick="showPartDetails(${part.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editPart(${part.id})" title="Edit Part">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn stock" onclick="showStockUpdateModal(${part.id})" title="Update Stock">
                        <i class="fas fa-warehouse"></i>
                    </button>
                    <button class="action-btn delete" onclick="showDeleteModal(${part.id})" title="Delete Part">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="part-details">
                <span class="part-category">${escapeHtml(part.category)}</span>
                ${part.description ? `<p class="part-description">${escapeHtml(part.description)}</p>` : ''}
            </div>
            
            <div class="part-footer">
                <div class="part-price">${formatCurrency(part.price)}</div>
                <div class="part-stock">
                    <div class="stock-info">
                        <span class="stock-current">${part.stockQuantity}</span> / 
                        <span class="stock-minimum">${part.minimumStockLevel}</span>
                    </div>
                    <span class="stock-status ${stockClass}">${stockStatus}</span>
                </div>
            </div>
        </div>
    `;
}


function getStockStatus(part) {
    if (part.stockQuantity === 0) {
        return 'Out of Stock';
    } else if (part.stockQuantity <= part.minimumStockLevel) {
        return 'Low Stock';
    } else {
        return 'In Stock';
    }
}


function displayEmptyState(message = null) {
    const container = document.getElementById('partsContainer');
    const defaultMessage = 'No parts match your current filters.';

    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-boxes"></i>
            <h3>No Parts Found</h3>
            <p>${message || defaultMessage}</p>
            <button class="btn-secondary" onclick="clearAllFilters()">
                <i class="fas fa-filter"></i> Clear All Filters
            </button>
        </div>
    `;

    document.getElementById('pagination').style.display = 'none';
}

function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('stockFilter').value = 'in-stock'; // Default to in-stock instead of 'all'
    document.getElementById('sortBy').value = 'name';
    document.getElementById('sortOrder').value = 'asc';
    document.getElementById('clearSearch').style.display = 'none';

    applyFilters();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredParts.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredParts.length / itemsPerPage);
    const newPage = currentPage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayParts();
        updatePagination();

        document.querySelector('.parts-section').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

function setView(view) {
    currentView = view;
    localStorage.setItem('partsView', view);

    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');

    displayParts();
}

async function showPartDetails(partId) {
    try {
        showLoading(true);

        const response = await fetch(`/inventory/api/parts/${partId}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            displayPartDetails(data.part);
            document.getElementById('partDetailsModal').style.display = 'flex';
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading part details:', error);
        showNotification('Error loading part details', 'error');
    } finally {
        showLoading(false);
    }
}

function displayPartDetails(part) {
    const stockStatus = getStockStatus(part);
    const content = document.getElementById('partDetailsContent');

    content.innerHTML = `
        <div class="part-details-grid">
            <div class="detail-section">
                <h4>Basic Information</h4>
                <div class="detail-row">
                    <label>Name:</label>
                    <span>${escapeHtml(part.name)}</span>
                </div>
                <div class="detail-row">
                    <label>Part Number:</label>
                    <span>${part.partNumber ? escapeHtml(part.partNumber) : 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <label>Category:</label>
                    <span>${escapeHtml(part.category)}</span>
                </div>
                <div class="detail-row">
                    <label>Description:</label>
                    <span>${part.description ? escapeHtml(part.description) : 'No description'}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Pricing & Stock</h4>
                <div class="detail-row">
                    <label>Price:</label>
                    <span class="price-value">${formatCurrency(part.price)}</span>
                </div>
                <div class="detail-row">
                    <label>Current Stock:</label>
                    <span class="stock-value ${stockStatus.toLowerCase().replace(' ', '-')}">${part.stockQuantity}</span>
                </div>
                <div class="detail-row">
                    <label>Minimum Level:</label>
                    <span>${part.minimumStockLevel}</span>
                </div>
                <div class="detail-row">
                    <label>Stock Status:</label>
                    <span class="stock-status ${stockStatus.toLowerCase().replace(' ', '-')}">${stockStatus}</span>
                </div>
            </div>
            
            ${part.supplier.name ? `
                <div class="detail-section">
                    <h4>Supplier Information</h4>
                    <div class="detail-row">
                        <label>Supplier:</label>
                        <span>${escapeHtml(part.supplier.name)}</span>
                    </div>
                    ${part.supplier.contact ? `
                        <div class="detail-row">
                            <label>Contact:</label>
                            <span>${escapeHtml(part.supplier.contact)}</span>
                        </div>
                    ` : ''}
                    ${part.supplier.phone ? `
                        <div class="detail-row">
                            <label>Phone:</label>
                            <span>${escapeHtml(part.supplier.phone)}</span>
                        </div>
                    ` : ''}
                    ${part.supplier.email ? `
                        <div class="detail-row">
                            <label>Email:</label>
                            <span>${escapeHtml(part.supplier.email)}</span>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4>Audit Information</h4>
                <div class="detail-row">
                    <label>Created:</label>
                    <span>${formatDate(part.createdAt)}</span>
                </div>
                <div class="detail-row">
                    <label>Last Updated:</label>
                    <span>${formatDate(part.updatedAt)}</span>
                </div>
            </div>
        </div>
        
        <div class="detail-actions">
            <button class="btn-secondary" onclick="hidePartDetailsModal()">Close</button>
            <button class="btn-primary" onclick="editPart(${part.id})">
                <i class="fas fa-edit"></i> Edit Part
            </button>
            <button class="btn-primary" onclick="showStockUpdateModal(${part.id})">
                <i class="fas fa-warehouse"></i> Update Stock
            </button>
        </div>
    `;
}

function editPart(partId) {
    window.location.href = `/inventory/parts/edit/${partId}`;
}

function showStockUpdateModal(partId) {
    const part = allParts.find(p => p.id === partId);
    if (!part) return;

    updatePartId = partId;

    document.getElementById('updatePartId').value = partId;
    document.getElementById('updatePartInfo').innerHTML = `
        <h4>${escapeHtml(part.name)}</h4>
        <p>Part Number: ${part.partNumber ? escapeHtml(part.partNumber) : 'N/A'}</p>
        <p>Current Stock: <strong>${part.stockQuantity}</strong></p>
        <p>Minimum Level: ${part.minimumStockLevel}</p>
    `;

    document.getElementById('stockUpdateForm').reset();
    document.getElementById('updatePartId').value = partId;

    document.getElementById('stockUpdateModal').style.display = 'flex';
}

async function handleStockUpdate(e) {
    e.preventDefault();

    const partId = document.getElementById('updatePartId').value;
    const operation = document.getElementById('stockOperation').value;
    const quantity = parseInt(document.getElementById('stockQuantity').value);
    const reason = document.getElementById('stockReason').value.trim();

    if (!quantity || quantity <= 0) {
        showNotification('Please enter a valid quantity', 'error');
        return;
    }

    try {
        showLoading(true);

        const response = await fetch(`/inventory/api/parts/${partId}/stock`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                quantity,
                operation,
                reason
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(data.message, 'success');
            hideStockUpdateModal();
            // Reload parts to reflect changes
            await loadParts();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Error updating stock:', error);
        showNotification('Error updating stock', 'error');
    } finally {
        showLoading(false);
    }
}


function showDeleteModal(partId) {
    const part = allParts.find(p => p.id === partId);
    if (!part) return;

    deletePartId = partId;

    document.getElementById('deletePartInfo').innerHTML = `
        <h4>${escapeHtml(part.name)}</h4>
        <p><strong>Part Number:</strong> ${part.partNumber ? escapeHtml(part.partNumber) : 'N/A'}</p>
        <p><strong>Category:</strong> ${escapeHtml(part.category)}</p>
        <p><strong>Current Stock:</strong> ${part.stockQuantity}</p>
        <p><strong>Price:</strong> ${formatCurrency(part.price)}</p>
    `;

    document.getElementById('deleteModal').style.display = 'flex';
}

// Confirm part deletion
async function confirmDelete() {
    if (!deletePartId) return;

    try {
        showLoading(true);

        const response = await fetch(`/inventory/api/parts/${deletePartId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showNotification(data.message, 'success');
            hideDeleteModal();
            // Reload parts to reflect changes
            await loadParts();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting part:', error);
        showNotification('Error deleting part', 'error');
    } finally {
        showLoading(false);
    }
}

// Modal management functions
function hidePartDetailsModal() {
    document.getElementById('partDetailsModal').style.display = 'none';
}

function hideStockUpdateModal() {
    document.getElementById('stockUpdateModal').style.display = 'none';
    updatePartId = null;
}

function hideDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    deletePartId = null;
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    updatePartId = null;
    deletePartId = null;
}

// Bulk operations
function togglePartSelection(partId) {
    if (selectedParts.has(partId)) {
        selectedParts.delete(partId);
    } else {
        selectedParts.add(partId);
    }

    updateBulkActionsVisibility();
}

function selectAllParts() {
    const visibleParts = filteredParts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    visibleParts.forEach(part => selectedParts.add(part.id));
    updateBulkActionsVisibility();
    updatePartSelections();
}

function deselectAllParts() {
    selectedParts.clear();
    updateBulkActionsVisibility();
    updatePartSelections();
}

function updateBulkActionsVisibility() {
    const bulkActions = document.getElementById('bulkActions');
    bulkActions.style.display = selectedParts.size > 0 ? 'flex' : 'none';
}

function updatePartSelections() {
    document.querySelectorAll('.part-checkbox').forEach(checkbox => {
        const partId = parseInt(checkbox.dataset.partId);
        checkbox.checked = selectedParts.has(partId);
    });
}

function exportSelected() {
    if (selectedParts.size === 0) {
        showNotification('Please select parts to export', 'warning');
        return;
    }

    const selectedPartsData = allParts.filter(part => selectedParts.has(part.id));
    const csvContent = generateCSV(selectedPartsData);
    downloadCSV(csvContent, 'selected_parts.csv');

    showNotification(`Exported ${selectedParts.size} parts`, 'success');
}

function deleteSelected() {
    if (selectedParts.size === 0) {
        showNotification('Please select parts to delete', 'warning');
        return;
    }

    if (confirm(`Are you sure you want to delete ${selectedParts.size} selected parts? This action cannot be undone.`)) {
        bulkDeleteParts();
    }
}

async function bulkDeleteParts() {
    const partsToDelete = Array.from(selectedParts);
    let successCount = 0;
    let errorCount = 0;

    showLoading(true);

    for (const partId of partsToDelete) {
        try {
            const response = await fetch(`/inventory/api/parts/${partId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                successCount++;
                selectedParts.delete(partId);
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
        }
    }

    showLoading(false);

    if (successCount > 0) {
        showNotification(`Successfully deleted ${successCount} parts`, 'success');
        await loadParts();
    }

    if (errorCount > 0) {
        showNotification(`Failed to delete ${errorCount} parts`, 'error');
    }

    updateBulkActionsVisibility();
}

// CSV export functions
function generateCSV(parts) {
    const headers = ['Name', 'Part Number', 'Category', 'Description', 'Price', 'Stock Quantity', 'Minimum Level', 'Supplier'];
    const rows = parts.map(part => [
        part.name,
        part.partNumber || '',
        part.category,
        part.description || '',
        part.price,
        part.stockQuantity,
        part.minimumStockLevel,
        part.supplier.name || ''
    ]);

    return [headers, ...rows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    if (!document.getElementById('notificationStyles')) {
        const styles = document.createElement('style');
        styles.id = 'notificationStyles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                min-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .notification-success { background: #28a745; }
            .notification-error { background: #dc3545; }
            .notification-warning { background: #ffc107; }
            .notification-info { background: #17a2b8; }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function refreshParts() {
    loadParts();
}

setInterval(refreshParts, 5 * 60 * 1000);


// Export current view to CSV
function exportCurrentView() {
    const visibleParts = filteredParts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const csvContent = generateCSV(visibleParts);
    downloadCSV(csvContent, 'parts_current_view.csv');

    showNotification(`Exported ${visibleParts.length} parts from current view`, 'success');
}

// Export all filtered parts
function exportAll() {
    const csvContent = generateCSV(filteredParts);
    downloadCSV(csvContent, 'parts_filtered.csv');

    showNotification(`Exported ${filteredParts.length} parts`, 'success');
}