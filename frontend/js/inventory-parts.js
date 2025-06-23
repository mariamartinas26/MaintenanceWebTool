class PartsManager {
    constructor() {
        this.allParts = [];
        this.filteredParts = [];
        this.selectedParts = new Set();
        this.SecurityUtils = window.SecurityUtils;

        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            if (!this.checkAuthentication()) {
                return;
            }

            this.initializePage();
            this.setupEventListeners();
            this.loadParts();
            this.loadAdminInfo();
            this.highlightCurrentPage();
            this.startAutoRefresh();
        });
    }

    getAuthHeaders() {
        const token = localStorage.getItem('token');
        if (!this.SecurityUtils.validateToken(token)) {
            window.location.href = '/admin/login';
            return null;
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.SecurityUtils.sanitizeInput(token)}`
        };
    }

    checkAuthentication() {
        const token = localStorage.getItem('token');
        if (!this.SecurityUtils.validateToken(token)) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    setupEventListeners() {
        document.getElementById('stockFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('stockUpdateForm').addEventListener('submit', (e) => this.handleStockUpdate(e));

        // Modal close buttons
        document.getElementById('partDetailsClose').addEventListener('click', () => this.hidePartDetailsModal());
        document.getElementById('stockUpdateClose').addEventListener('click', () => this.hideStockUpdateModal());
        document.getElementById('stockUpdateCancel').addEventListener('click', () => this.hideStockUpdateModal());

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideAllModals();
                }
            });
        });

        this.setupNavigationListeners();
    }

    setupNavigationListeners() {
        const providersLink = document.getElementById('providers-link');
        if (providersLink) {
            providersLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/suppliers';
            });
        }

        const ordersLink = document.getElementById('orders-link');
        if (ordersLink) {
            ordersLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/suppliers#orders';
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    async loadAdminInfo() {
        try {
            const adminName = this.SecurityUtils.getCurrentUserName() || 'Admin';
            const nameElement = document.getElementById('admin-name');
            if (nameElement) {
                nameElement.textContent = this.SecurityUtils.sanitizeInput(adminName);
            }
        } catch (error) {
            const nameElement = document.getElementById('admin-name');
            if (nameElement) {
                nameElement.textContent = 'Admin';
            }
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.clear();
        window.location.href = '/homepage';
    }

    initializePage() {
        document.getElementById('stockFilter').value = 'all';
    }

    async loadParts() {
        try {
            const headers = this.getAuthHeaders();
            if (!headers) return;

            const response = await fetch('/inventory/api/parts', {headers});
            const data = await response.json();

            if (data.success && Array.isArray(data.parts)) {
                this.allParts = data.parts.map(part => this.SecurityUtils.sanitizeObject(part));
                this.applyFilters();
            } else {
                throw new Error(data.message || 'Failed to load parts');
            }
        } catch (error) {
            this.displayEmptyState('Error loading parts. Please try again.');
        }
    }

    applyFilters() {
        const stockFilter = this.SecurityUtils.sanitizeInput(document.getElementById('stockFilter').value);

        this.filteredParts = [...this.allParts];

        switch (stockFilter) {
            case 'in-stock':
                this.filteredParts = this.filteredParts.filter(part => part.stockQuantity > part.minimumStockLevel);
                break;
            case 'low-stock':
                this.filteredParts = this.filteredParts.filter(part => part.stockQuantity <= part.minimumStockLevel && part.stockQuantity > 0);
                break;
            case 'out-of-stock':
                this.filteredParts = this.filteredParts.filter(part => part.stockQuantity === 0);
                break;
            case 'all':
            default:
                // Show all parts, no filtering needed
                break;
        }

        this.filteredParts.sort((a, b) => {
            const aVal = String(a.name || '').toLowerCase();
            const bVal = String(b.name || '').toLowerCase();
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
        });

        this.displayParts();
        this.updatePartsCount();
    }

    displayParts() {
        const container = document.getElementById('partsContainer');
        if (!container) return;

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (this.filteredParts.length === 0) {
            this.displayEmptyState();
            return;
        }

        this.filteredParts.forEach(part => {
            const partCard = this.createPartCardElement(part);
            container.appendChild(partCard);
        });
    }

    updatePartsCount() {
        const countElement = document.getElementById('partsCount');
        if (countElement) {
            const count = this.filteredParts.length;
            const text = count === 1 ? '1 part found' : `${count} parts found`;
            countElement.textContent = text;
        }
    }

    createPartCardElement(part) {
        const stockStatus = this.getStockStatus(part);
        const stockClass = stockStatus.toLowerCase().replace(' ', '-');

        const partName = this.SecurityUtils.sanitizeInput(part.name || '');
        const partNumber = this.SecurityUtils.sanitizeInput(part.partNumber || '');
        const partId = parseInt(part.id);

        if (isNaN(partId)) {
            console.error('Invalid part ID:', part.id);
            return document.createElement('div');
        }

        // Create main card div
        const partCard = document.createElement('div');
        partCard.className = `part-card ${stockClass}`;
        partCard.dataset.partId = partId;

        // Create header
        const header = document.createElement('div');
        header.className = 'part-card-header';

        // Create title section
        const titleDiv = document.createElement('div');
        titleDiv.className = 'part-title';

        const nameH3 = document.createElement('h3');
        nameH3.textContent = partName;
        titleDiv.appendChild(nameH3);

        if (partNumber) {
            const partNumberSpan = document.createElement('span');
            partNumberSpan.className = 'part-number';
            partNumberSpan.textContent = partNumber;
            //titleDiv.appendChild(partNumberSpan);
        }

        // Create actions section
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'part-actions';

        // View details button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn';
        viewBtn.title = 'View Details';
        viewBtn.addEventListener('click', () => this.showPartDetails(partId));

        const viewIcon = document.createElement('i');
        viewIcon.className = 'fas fa-eye';
        viewBtn.appendChild(viewIcon);

        // Order stock button
        const orderBtn = document.createElement('button');
        orderBtn.className = 'action-btn stock';
        orderBtn.title = 'Order More Stock';
        orderBtn.addEventListener('click', () => this.redirectToNewOrder(partId));

        const orderIcon = document.createElement('i');
        orderIcon.className = 'fas fa-plus-circle';
        orderBtn.appendChild(orderIcon);

        // Assemble everything
        actionsDiv.appendChild(viewBtn);
        actionsDiv.appendChild(orderBtn);

        header.appendChild(titleDiv);
        header.appendChild(actionsDiv);
        partCard.appendChild(header);

        return partCard;
    }

    redirectToNewOrder(partId) {
        const part = this.allParts.find(p => p.id === partId);
        if (!part) {
            console.error('Part not found');
            return;
        }

        const partData = {
            id: part.id,
            name: this.SecurityUtils.sanitizeInput(part.name),
            partNumber: this.SecurityUtils.sanitizeInput(part.partNumber),
            price: parseFloat(part.price) || 0,
            category: this.SecurityUtils.sanitizeInput(part.category),
            stockQuantity: parseInt(part.stockQuantity) || 0,
            minimumStockLevel: parseInt(part.minimumStockLevel) || 0
        };

        localStorage.setItem('preselectedPart', JSON.stringify(partData));

        setTimeout(() => {
            window.location.href = '/suppliers?action=new-order&part=' + encodeURIComponent(part.id);
        }, 1000);
    }

    getStockStatus(part) {
        const stockQuantity = parseInt(part.stockQuantity) || 0;
        const minimumStockLevel = parseInt(part.minimumStockLevel) || 0;

        if (stockQuantity === 0) {
            return 'Out of Stock';
        } else if (stockQuantity <= minimumStockLevel) {
            return 'Low Stock';
        } else {
            return 'In Stock';
        }
    }

    displayEmptyState(message = null) {
        const container = document.getElementById('partsContainer');
        if (!container) return;

        // Clear container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const defaultMessage = 'No parts match your current filters.';
        const safeMessage = this.SecurityUtils.sanitizeInput(message || defaultMessage);

        // Create empty state div
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';

        // Icon
        const icon = document.createElement('i');
        icon.className = 'fas fa-boxes';

        // Title
        const title = document.createElement('h3');
        title.textContent = 'No Parts Found';

        // Message
        const messagePara = document.createElement('p');
        messagePara.textContent = safeMessage;

        // Clear filters button
        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn-secondary';
        clearBtn.addEventListener('click', () => this.clearAllFilters());

        const clearIcon = document.createElement('i');
        clearIcon.className = 'fas fa-filter';
        clearBtn.appendChild(clearIcon);
        clearBtn.appendChild(document.createTextNode(' Clear All Filters'));

        emptyState.appendChild(icon);
        emptyState.appendChild(title);
        emptyState.appendChild(messagePara);
        emptyState.appendChild(clearBtn);

        container.appendChild(emptyState);
    }

    clearAllFilters() {
        document.getElementById('stockFilter').value = 'all';
        this.applyFilters();
    }

    async showPartDetails(partId) {
        try {
            const headers = this.getAuthHeaders();
            if (!headers) return;

            const response = await fetch(`/inventory/api/parts/${encodeURIComponent(partId)}`, {headers});
            const data = await response.json();

            if (data.success && data.part) {
                const sanitizedPart = this.SecurityUtils.sanitizeObject(data.part);
                this.displayPartDetails(sanitizedPart);
                const modal = document.getElementById('partDetailsModal');
                if (modal) {
                    modal.style.display = 'flex';
                }
            } else {
                throw new Error(data.message || 'Failed to load part details');
            }
        } catch (error) {
            console.error('Error loading part details:', error);
        }
    }

    displayPartDetails(part) {
        const stockStatus = this.getStockStatus(part);
        const content = document.getElementById('partDetailsContent');
        if (!content) return;

        // Clear content
        while (content.firstChild) {
            content.removeChild(content.firstChild);
        }

        // Create simple details container
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'part-details-simple';

        // Create detail items
        const details = [
            {label: 'Name', value: part.name || '', className: ''},
            {label: 'Part Number', value: part.partNumber || 'N/A', className: ''},
            {label: 'Category', value: part.category || '', className: ''},
            {label: 'Description', value: part.description || 'No description', className: ''},
            {label: 'Price', value: this.formatCurrency(part.price), className: 'price'},
            {
                label: 'Current Stock',
                value: part.stockQuantity,
                className: `stock ${stockStatus.toLowerCase().replace(' ', '-')}`
            },
            {label: 'Minimum Level', value: part.minimumStockLevel, className: ''},
            {label: 'Stock Status', value: stockStatus, className: `stock ${stockStatus.toLowerCase().replace(' ', '-')}`},
            {label: 'Created', value: this.formatDate(part.createdAt), className: ''},
            {label: 'Last Updated', value: this.formatDate(part.updatedAt), className: ''}
        ];

        details.forEach(detail => {
            const detailItem = document.createElement('div');
            detailItem.className = 'detail-item';

            const label = document.createElement('span');
            label.className = 'detail-label';
            label.textContent = detail.label + ':';

            const value = document.createElement('span');
            value.className = `detail-value ${detail.className}`;
            value.textContent = this.SecurityUtils.sanitizeInput(String(detail.value));

            detailItem.appendChild(label);
            detailItem.appendChild(value);
            detailsContainer.appendChild(detailItem);
        });

        // Actions
        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-secondary';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => this.hidePartDetailsModal());

        const orderBtn = document.createElement('button');
        orderBtn.className = 'btn-primary';
        orderBtn.addEventListener('click', () => this.redirectToNewOrder(part.id));

        const orderIcon = document.createElement('i');
        orderIcon.className = 'fas fa-plus-circle';
        orderBtn.appendChild(orderIcon);
        orderBtn.appendChild(document.createTextNode(' Order More Stock'));

        actions.appendChild(closeBtn);
        actions.appendChild(orderBtn);

        content.appendChild(detailsContainer);
        content.appendChild(actions);
    }


    async handleStockUpdate(e) {
        e.preventDefault();

        const partId = this.SecurityUtils.sanitizeInput(document.getElementById('updatePartId').value);
        const operation = this.SecurityUtils.sanitizeInput(document.getElementById('stockOperation').value);
        const quantityInput = document.getElementById('stockQuantity').value;
        const reasonInput = document.getElementById('stockReason').value;

        const quantity = parseInt(quantityInput);
        const reason = this.SecurityUtils.sanitizeInput(reasonInput.trim());

        if (!quantity || quantity <= 0 || isNaN(quantity)) {
            return;
        }

        if (!['add', 'subtract', 'set'].includes(operation)) {
            return;
        }

        try {
            const headers = this.getAuthHeaders();
            if (!headers) return;

            const response = await fetch(`/inventory/api/parts/${encodeURIComponent(partId)}/stock`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    quantity,
                    operation,
                    reason
                })
            });

            const data = await response.json();

            if (data.success) {
                this.hideStockUpdateModal();
                await this.loadParts();
            }
        } catch (error) {
            console.error('Error updating stock:', error);
        }
    }

    hidePartDetailsModal() {
        const modal = document.getElementById('partDetailsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    hideStockUpdateModal() {
        const modal = document.getElementById('stockUpdateModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.updatePartId = null;
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        this.updatePartId = null;
    }

    formatCurrency(amount) {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('ro-RO', {
            style: 'currency',
            currency: 'RON'
        }).format(numAmount);
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('ro-RO', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    refreshParts() {
        this.loadParts();
    }

    startAutoRefresh() {
        setInterval(() => this.refreshParts(), 5 * 60 * 1000);
    }

    highlightCurrentPage() {
        const currentPath = window.location.pathname;
        const sidebarLinks = document.querySelectorAll('.sidebar-nav a');

        sidebarLinks.forEach(link => {
            try {
                const linkPath = new URL(link.href).pathname;
                if (currentPath.startsWith('/inventory') && linkPath === '/inventory/dashboard') {
                    link.parentElement.classList.add('active');
                } else if (currentPath === linkPath) {
                    link.parentElement.classList.add('active');
                } else {
                    link.parentElement.classList.remove('active');
                }
            } catch (error) {
                console.error('Error processing sidebar link:', error);
            }
        });
    }
}

// Initialize the PartsManager when the script loads
const partsManager = new PartsManager();

