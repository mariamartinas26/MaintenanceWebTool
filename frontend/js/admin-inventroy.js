class InventoryManager {
    constructor() {
        this.parts = [];
        this.suppliers = [];
        this.currentFilters = {
            search: '',
            category: 'all',
            stock: 'all',
            sort: 'name-asc'
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
        this.setupModals();
    }

    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.querySelector('.search-btn');

        searchInput.addEventListener('input', this.debounce(() => {
            this.currentFilters.search = searchInput.value;
            this.filterAndRenderParts();
        }, 300));

        searchBtn.addEventListener('click', () => {
            this.currentFilters.search = searchInput.value;
            this.filterAndRenderParts();
        });

        // Filter functionality
        const categoryFilter = document.getElementById('category-filter');
        const stockFilter = document.getElementById('stock-filter');
        const sortFilter = document.getElementById('sort-filter');

        categoryFilter.addEventListener('change', () => {
            this.currentFilters.category = categoryFilter.value;
            this.filterAndRenderParts();
        });

        stockFilter.addEventListener('change', () => {
            this.currentFilters.stock = stockFilter.value;
            this.filterAndRenderParts();
        });

        sortFilter.addEventListener('change', () => {
            this.currentFilters.sort = sortFilter.value;
            this.filterAndRenderParts();
        });

        // Add part button
        const addPartBtn = document.getElementById('add-part-btn');
        addPartBtn.addEventListener('click', () => {
            this.openPartModal();
        });

        // Logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    }

    setupModals() {
        // Close modal events
        const closeModalBtns = document.querySelectorAll('.close-modal');
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', this.closeModal.bind(this));
        });

        // Close modal when clicking outside
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        });

        // Cancel buttons
        const cancelPartBtn = document.getElementById('cancel-part-btn');
        const cancelStockBtn = document.getElementById('cancel-stock-btn');

        cancelPartBtn.addEventListener('click', this.closeModal.bind(this));
        cancelStockBtn.addEventListener('click', this.closeModal.bind(this));

        // Form submissions
        const partForm = document.getElementById('part-form');
        const stockForm = document.getElementById('stock-form');

        partForm.addEventListener('submit', this.handlePartSubmit.bind(this));
        stockForm.addEventListener('submit', this.handleStockAdjustment.bind(this));

        // Adjustment type change
        const adjustmentType = document.getElementById('adjustment-type');
        adjustmentType.addEventListener('change', this.handleAdjustmentTypeChange.bind(this));
    }

    async loadData() {
        try {
            this.showLoading();
            await Promise.all([
                this.loadParts(),
                this.loadSuppliers()
            ]);
            this.updateStats();
            this.updateCategoryFilter();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Error loading data. Please refresh the page.');
        } finally {
            this.hideLoading();
        }
    }

    async loadParts() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                this.handleAuthError();
                return;
            }

            const response = await fetch('/admin/api/parts', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (data.success) {
                this.parts = data.parts;
                this.filterAndRenderParts();
            } else {
                this.showError('Error loading parts: ' + data.message);
            }
        } catch (error) {
            console.error('Error loading parts:', error);
            this.showError('Connection error. Please try again.');
        }
    }

    async loadSuppliers() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/admin/api/suppliers', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.suppliers = data.suppliers;
                this.populateSupplierSelect();
            }
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    }

    filterAndRenderParts() {
        let filteredParts = [...this.parts];

        // Apply search filter
        if (this.currentFilters.search) {
            const searchTerm = this.currentFilters.search.toLowerCase();
            filteredParts = filteredParts.filter(part =>
                part.name.toLowerCase().includes(searchTerm) ||
                part.part_number?.toLowerCase().includes(searchTerm) ||
                part.category?.toLowerCase().includes(searchTerm) ||
                part.description?.toLowerCase().includes(searchTerm)
            );
        }

        // Apply category filter
        if (this.currentFilters.category !== 'all') {
            filteredParts = filteredParts.filter(part =>
                part.category === this.currentFilters.category
            );
        }

        // Apply stock filter
        if (this.currentFilters.stock !== 'all') {
            filteredParts = filteredParts.filter(part => {
                const stockLevel = this.getStockLevel(part);
                return stockLevel === this.currentFilters.stock;
            });
        }

        // Apply sorting
        filteredParts.sort((a, b) => {
            switch (this.currentFilters.sort) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'stock-asc':
                    return a.stock_quantity - b.stock_quantity;
                case 'stock-desc':
                    return b.stock_quantity - a.stock_quantity;
                case 'price-asc':
                    return parseFloat(a.price) - parseFloat(b.price);
                case 'price-desc':
                    return parseFloat(b.price) - parseFloat(a.price);
                default:
                    return 0;
            }
        });

        this.renderParts(filteredParts);
    }

    renderParts(parts) {
        const tbody = document.getElementById('inventory-tbody');

        if (parts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <h3>No parts found</h3>
                        <p>Try adjusting your search or filter criteria</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = parts.map(part => this.createPartRow(part)).join('');
        this.bindRowEvents();
    }

    createPartRow(part) {
        const stockLevel = this.getStockLevel(part);
        const supplier = this.suppliers.find(s => s.id === part.supplier_id);

        return `
            <tr data-id="${part.id}" class="part-row">
                <td>
                    <div class="part-name">${part.name}</div>
                    ${part.description ? `<div class="part-description">${part.description.substring(0, 50)}${part.description.length > 50 ? '...' : ''}</div>` : ''}
                </td>
                <td>${part.part_number || '-'}</td>
                <td>${part.category || '-'}</td>
                <td>
                    <span class="stock-quantity ${stockLevel === 'out-of-stock' ? 'out' : stockLevel === 'low-stock' ? 'low' : ''}">
                        ${part.stock_quantity}
                    </span>
                </td>
                <td>${part.minimum_stock_level}</td>
                <td>${parseFloat(part.price).toFixed(2)} RON</td>
                <td>${supplier ? supplier.company_name : '-'}</td>
                <td>
                    <span class="stock-status ${stockLevel}">
                        ${this.getStockStatusText(stockLevel)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" data-action="view" data-id="${part.id}">
                            👁️ View
                        </button>
                        <button class="action-btn edit" data-action="edit" data-id="${part.id}">
                            ✏️ Edit
                        </button>
                        <button class="action-btn stock" data-action="stock" data-id="${part.id}">
                            📊 Stock
                        </button>
                        <button class="action-btn delete" data-action="delete" data-id="${part.id}">
                            🗑️ Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    bindRowEvents() {
        const actionButtons = document.querySelectorAll('.action-btn');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const partId = e.target.dataset.id;
                this.handleAction(action, partId);
            });
        });
    }

    async handleAction(action, partId) {
        const part = this.parts.find(p => p.id == partId);
        if (!part) return;

        switch (action) {
            case 'view':
                this.viewPartDetails(part);
                break;
            case 'edit':
                this.editPart(part);
                break;
            case 'stock':
                this.adjustStock(part);
                break;
            case 'delete':
                this.deletePart(part);
                break;
        }
    }

    viewPartDetails(part) {
        const supplier = this.suppliers.find(s => s.id === part.supplier_id);
        const stockLevel = this.getStockLevel(part);

        const detailsContainer = document.getElementById('part-details');
        detailsContainer.innerHTML = `
            <div class="detail-section">
                <h3>📦 Basic Information</h3>
                <div class="detail-item">
                    <div class="detail-label">Part Name:</div>
                    <div class="detail-value">${part.name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Part Number:</div>
                    <div class="detail-value">${part.part_number || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Category:</div>
                    <div class="detail-value">${part.category || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Description:</div>
                    <div class="detail-value">${part.description || 'No description'}</div>
                </div>
            </div>

            <div class="detail-section">
                <h3>💰 Pricing & Stock</h3>
                <div class="detail-item">
                    <div class="detail-label">Price:</div>
                    <div class="detail-value">${parseFloat(part.price).toFixed(2)} RON</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Current Stock:</div>
                    <div class="detail-value">
                        <span class="stock-quantity ${stockLevel === 'out-of-stock' ? 'out' : stockLevel === 'low-stock' ? 'low' : ''}">
                            ${part.stock_quantity}
                        </span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Minimum Level:</div>
                    <div class="detail-value">${part.minimum_stock_level}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Stock Status:</div>
                    <div class="detail-value">
                        <span class="stock-status ${stockLevel}">
                            ${this.getStockStatusText(stockLevel)}
                        </span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>🏢 Supplier Information</h3>
                <div class="detail-item">
                    <div class="detail-label">Supplier:</div>
                    <div class="detail-value">${supplier ? supplier.company_name : 'No supplier assigned'}</div>
                </div>
                ${supplier ? `
                    <div class="detail-item">
                        <div class="detail-label">Contact Person:</div>
                        <div class="detail-value">${supplier.contact_person || 'Not specified'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${supplier.email || 'Not specified'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Phone:</div>
                        <div class="detail-value">${supplier.phone || 'Not specified'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Delivery Time:</div>
                        <div class="detail-value">${supplier.delivery_time_days || 7} days</div>
                    </div>
                ` : ''}
            </div>

            <div class="detail-section">
                <h3>📅 Timeline</h3>
                <div class="detail-item">
                    <div class="detail-label">Created:</div>
                    <div class="detail-value">${new Date(part.created_at).toLocaleDateString()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${new Date(part.updated_at).toLocaleDateString()}</div>
                </div>
            </div>
        `;

        this.openModal('details-modal');
    }

    editPart(part) {
        document.getElementById('modal-title').textContent = 'Edit Part';
        document.getElementById('part-id').value = part.id;
        document.getElementById('part-name').value = part.name;
        document.getElementById('part-number').value = part.part_number || '';
        document.getElementById('part-description').value = part.description || '';
        document.getElementById('part-category').value = part.category || '';
        document.getElementById('part-supplier').value = part.supplier_id || '';
        document.getElementById('part-price').value = parseFloat(part.price).toFixed(2);
        document.getElementById('part-stock').value = part.stock_quantity;
        document.getElementById('part-min-stock').value = part.minimum_stock_level;

        this.openModal('part-modal');
    }

    adjustStock(part) {
        document.getElementById('stock-part-id').value = part.id;
        document.getElementById('current-stock').value = part.stock_quantity;
        document.getElementById('adjustment-type').value = '';
        document.getElementById('adjustment-quantity').value = '';
        document.getElementById('adjustment-reason').value = '';
        document.getElementById('adjustment-notes').value = '';

        this.openModal('stock-modal');
    }

    async deletePart(part) {
        if (!confirm(`Are you sure you want to delete "${part.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/admin/api/parts/${part.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (data.success) {
                this.showSuccess('Part deleted successfully');
                this.loadParts();
            } else {
                this.showError('Error deleting part: ' + data.message);
            }
        } catch (error) {
            console.error('Error deleting part:', error);
            this.showError('Connection error. Please try again.');
        }
    }

    openPartModal(part = null) {
        if (part) {
            this.editPart(part);
        } else {
            document.getElementById('modal-title').textContent = 'Add New Part';
            document.getElementById('part-form').reset();
            document.getElementById('part-id').value = '';
            document.getElementById('part-min-stock').value = '5';
            this.openModal('part-modal');
        }
    }

    async handlePartSubmit(e) {
        e.preventDefault();

        try {
            const formData = new FormData(e.target);
            const partId = document.getElementById('part-id').value;

            const partData = {
                name: document.getElementById('part-name').value,
                part_number: document.getElementById('part-number').value || null,
                description: document.getElementById('part-description').value || null,
                category: document.getElementById('part-category').value || null,
                supplier_id: document.getElementById('part-supplier').value || null,
                price: parseFloat(document.getElementById('part-price').value),
                stock_quantity: parseInt(document.getElementById('part-stock').value),
                minimum_stock_level: parseInt(document.getElementById('part-min-stock').value)
            };

            const token = localStorage.getItem('token');
            const url = partId ? `/admin/api/parts/${partId}` : '/admin/api/parts';
            const method = partId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(partData)
            });

            const data = await response.json();

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (data.success) {
                this.showSuccess(partId ? 'Part updated successfully' : 'Part added successfully');
                this.closeModal();
                this.loadParts();
            } else {
                this.showError('Error saving part: ' + data.message);
            }
        } catch (error) {
            console.error('Error saving part:', error);
            this.showError('Connection error. Please try again.');
        }
    }

    handleAdjustmentTypeChange(e) {
        const adjustmentType = e.target.value;
        const quantityInput = document.getElementById('adjustment-quantity');
        const currentStock = parseInt(document.getElementById('current-stock').value);

        quantityInput.placeholder = '';
        quantityInput.max = '';

        switch (adjustmentType) {
            case 'add':
                quantityInput.placeholder = 'Quantity to add';
                break;
            case 'remove':
                quantityInput.placeholder = 'Quantity to remove';
                quantityInput.max = currentStock;
                break;
            case 'set':
                quantityInput.placeholder = 'New stock level';
                break;
        }
    }

    async handleStockAdjustment(e) {
        e.preventDefault();

        try {
            const partId = document.getElementById('stock-part-id').value;
            const adjustmentType = document.getElementById('adjustment-type').value;
            const quantity = parseInt(document.getElementById('adjustment-quantity').value);
            const reason = document.getElementById('adjustment-reason').value;
            const notes = document.getElementById('adjustment-notes').value;

            const adjustmentData = {
                adjustment_type: adjustmentType,
                quantity: quantity,
                reason: reason,
                notes: notes
            };

            const token = localStorage.getItem('token');
            const response = await fetch(`/admin/api/parts/${partId}/adjust-stock`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(adjustmentData)
            });

            const data = await response.json();

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (data.success) {
                this.showSuccess('Stock adjusted successfully');
                this.closeModal();
                this.loadParts();
            } else {
                this.showError('Error adjusting stock: ' + data.message);
            }
        } catch (error) {
            console.error('Error adjusting stock:', error);
            this.showError('Connection error. Please try again.');
        }
    }

    getStockLevel(part) {
        if (part.stock_quantity === 0) {
            return 'out-of-stock';
        } else if (part.stock_quantity <= part.minimum_stock_level) {
            return 'low-stock';
        } else {
            return 'in-stock';
        }
    }

    getStockStatusText(level) {
        const texts = {
            'in-stock': 'In Stock',
            'low-stock': 'Low Stock',
            'out-of-stock': 'Out of Stock'
        };
        return texts[level] || level;
    }

    updateStats() {
        const totalParts = this.parts.length;
        const lowStockParts = this.parts.filter(part => this.getStockLevel(part) === 'low-stock').length;
        const outOfStockParts = this.parts.filter(part => this.getStockLevel(part) === 'out-of-stock').length;
        const totalValue = this.parts.reduce((sum, part) => sum + (parseFloat(part.price) * part.stock_quantity), 0);
        const categories = [...new Set(this.parts.map(part => part.category).filter(Boolean))].length;

        document.getElementById('total-parts').textContent = totalParts;
        document.getElementById('low-stock-parts').textContent = lowStockParts + outOfStockParts;
        document.getElementById('inventory-value').textContent = totalValue.toFixed(2) + ' RON';
        document.getElementById('total-categories').textContent = categories;
        document.getElementById('low-stock-count').textContent = lowStockParts + outOfStockParts;
    }

    updateCategoryFilter() {
        const categoryFilter = document.getElementById('category-filter');
        const categories = [...new Set(this.parts.map(part => part.category).filter(Boolean))];

        // Clear existing options except "All Categories"
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';

        categories.sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }

    populateSupplierSelect() {
        const supplierSelect = document.getElementById('part-supplier');
        supplierSelect.innerHTML = '<option value="">Select Supplier</option>';

        this.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.company_name;
            supplierSelect.appendChild(option);
        });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    showLoading() {
        const tbody = document.getElementById('inventory-tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="loading-row">
                    <div class="loading-spinner-small"></div>
                    Loading parts...
                </td>
            </tr>
        `;
    }

    hideLoading() {
        // Loading will be hidden when parts are rendered
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideNotification(notification);
        }, 5000);

        // Close button event
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
    }

    hideNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    handleLogout() {
        if (confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }

    handleAuthError() {
        this.showError('Session expired. Redirecting to login...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize inventory manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InventoryManager();
});

// Add notification styles to the page
const notificationStyles = `
<style>
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 1000;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.notification.show {
    transform: translateX(0);
}

.notification-error {
    background-color: #dc3545;
}

.notification-success {
    background-color: #28a745;
}

.notification-info {
    background-color: #17a2b8;
}

.notification-close {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    margin-left: 10px;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

@media (max-width: 576px) {
    .notification {
        right: 10px;
        left: 10px;
        max-width: none;
        transform: translateY(-100%);
    }
    
    .notification.show {
        transform: translateY(0);
    }
}
</style>
`;

// Inject styles into the page
document.head.insertAdjacentHTML('beforeend', notificationStyles);