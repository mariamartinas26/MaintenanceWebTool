// Global variables
let allParts = [];
let filteredParts = [];
let currentPage = 1;
let itemsPerPage = 12;
let selectedParts = new Set();
let updatePartId = null;

const SecurityUtils = window.SecurityUtils;

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!SecurityUtils.validateToken(token)) {
        window.location.href = '/admin/login';
        return null;
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SecurityUtils.sanitizeInput(token)}`
    };
}

function checkAuthentication() {
    const token = localStorage.getItem('token');
    if (!SecurityUtils.validateToken(token)) {
        window.location.href = '/admin/login';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuthentication()) {
        return;
    }

    initializePage();
    setupEventListeners();
    loadParts();
    loadAdminInfo();
    highlightCurrentPage();
});

function setupEventListeners() {
    document.getElementById('stockFilter').addEventListener('change', applyFilters);
    document.getElementById('stockUpdateForm').addEventListener('submit', handleStockUpdate);

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideAllModals();
            }
        });
    });

    setupNavigationListeners();
}

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

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            logout();
        });
    }
}

async function loadAdminInfo() {
    try {
        const adminName = SecurityUtils.getCurrentUserName() || 'Admin';
        const nameElement = document.getElementById('admin-name');
        if (nameElement) {
            nameElement.textContent = SecurityUtils.sanitizeInput(adminName);
        }
    } catch (error) {
        const nameElement = document.getElementById('admin-name');
        if (nameElement) {
            nameElement.textContent = 'Admin';
        }
    }
}

function logout() {
    if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/homepage';
    }
}

function initializePage() {
    const savedItemsPerPage = localStorage.getItem('partsItemsPerPage');
    if (savedItemsPerPage) {
        const parsed = parseInt(SecurityUtils.sanitizeInput(savedItemsPerPage));
        if (!isNaN(parsed) && parsed > 0) {
            itemsPerPage = parsed;
        }
    }

    document.getElementById('stockFilter').value = 'in-stock';
}

async function loadParts() {
    try {
        const headers = getAuthHeaders();
        if (!headers) return;

        const response = await fetch('/inventory/api/parts', { headers });
        const data = await response.json();

        if (data.success && Array.isArray(data.parts)) {
            allParts = data.parts.map(part => SecurityUtils.sanitizeObject(part));
            applyFilters();
        } else {
            throw new Error(data.message || 'Failed to load parts');
        }
    } catch (error) {
        displayEmptyState('Error loading parts. Please try again.');
    }
}

function applyFilters() {
    const stockFilter = SecurityUtils.sanitizeInput(document.getElementById('stockFilter').value);

    filteredParts = [...allParts];

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

    filteredParts.sort((a, b) => {
        const aVal = String(a.name || '').toLowerCase();
        const bVal = String(b.name || '').toLowerCase();
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
    });

    currentPage = 1;
    displayParts();
    updatePagination();
}

function displayParts() {
    const container = document.getElementById('partsContainer');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (filteredParts.length === 0) {
        displayEmptyState();
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredParts.slice(startIndex, endIndex);

    pageItems.forEach(part => {
        const partCard = createPartCardElement(part);
        container.appendChild(partCard);
    });
}

function createPartCardElement(part) {
    const stockStatus = getStockStatus(part);
    const stockClass = stockStatus.toLowerCase().replace(' ', '-');

    const partName = SecurityUtils.sanitizeInput(part.name || '');
    const partNumber = SecurityUtils.sanitizeInput(part.partNumber || '');
    const partId = parseInt(part.id);

    if (isNaN(partId)) {
        console.error('Invalid part ID:', part.id);
        return document.createElement('div'); // Return empty div
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
        titleDiv.appendChild(partNumberSpan);
    }

    // Create actions section
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'part-actions';

    // View details button
    const viewBtn = document.createElement('button');
    viewBtn.className = 'action-btn';
    viewBtn.title = 'View Details';
    viewBtn.addEventListener('click', () => showPartDetails(partId));

    const viewIcon = document.createElement('i');
    viewIcon.className = 'fas fa-eye';
    viewBtn.appendChild(viewIcon);

    // Order stock button
    const orderBtn = document.createElement('button');
    orderBtn.className = 'action-btn stock';
    orderBtn.title = 'Order More Stock';
    orderBtn.addEventListener('click', () => redirectToNewOrder(partId));

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

// Redirect to suppliers page with pre-selected part
function redirectToNewOrder(partId) {
    const part = allParts.find(p => p.id === partId);
    if (!part) {
        console.error('Part not found');
        return;
    }

    const partData = {
        id: part.id,
        name: SecurityUtils.sanitizeInput(part.name),
        partNumber: SecurityUtils.sanitizeInput(part.partNumber),
        price: parseFloat(part.price) || 0,
        category: SecurityUtils.sanitizeInput(part.category),
        stockQuantity: parseInt(part.stockQuantity) || 0,
        minimumStockLevel: parseInt(part.minimumStockLevel) || 0
    };

    localStorage.setItem('preselectedPart', JSON.stringify(partData));

    setTimeout(() => {
        window.location.href = '/suppliers?action=new-order&part=' + encodeURIComponent(part.id);
    }, 1000);
}

function getStockStatus(part) {
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

// Display empty state using DOM methods
function displayEmptyState(message = null) {
    const container = document.getElementById('partsContainer');
    if (!container) return;

    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const defaultMessage = 'No parts match your current filters.';
    const safeMessage = SecurityUtils.sanitizeInput(message || defaultMessage);

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
    clearBtn.addEventListener('click', clearAllFilters);

    const clearIcon = document.createElement('i');
    clearIcon.className = 'fas fa-filter';
    clearBtn.appendChild(clearIcon);
    clearBtn.appendChild(document.createTextNode(' Clear All Filters'));

    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(messagePara);
    emptyState.appendChild(clearBtn);

    container.appendChild(emptyState);

    const pagination = document.getElementById('pagination');
    if (pagination) {
        pagination.style.display = 'none';
    }
}

function clearAllFilters() {
    document.getElementById('stockFilter').value = 'in-stock';
    applyFilters();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredParts.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (!pagination || !prevBtn || !nextBtn || !pageInfo) return;

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

        const partsSection = document.querySelector('.parts-section');
        if (partsSection) {
            partsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
}

async function showPartDetails(partId) {
    try {
        const headers = getAuthHeaders();
        if (!headers) return;

        const response = await fetch(`/inventory/api/parts/${encodeURIComponent(partId)}`, { headers });
        const data = await response.json();

        if (data.success && data.part) {
            const sanitizedPart = SecurityUtils.sanitizeObject(data.part);
            displayPartDetails(sanitizedPart);
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

// Display part details using DOM methods - simplified version
function displayPartDetails(part) {
    const stockStatus = getStockStatus(part);
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
        { label: 'Name', value: part.name || '', className: '' },
        { label: 'Part Number', value: part.partNumber || 'N/A', className: '' },
        { label: 'Category', value: part.category || '', className: '' },
        { label: 'Description', value: part.description || 'No description', className: '' },
        { label: 'Price', value: formatCurrency(part.price), className: 'price' },
        { label: 'Current Stock', value: part.stockQuantity, className: `stock ${stockStatus.toLowerCase().replace(' ', '-')}` },
        { label: 'Minimum Level', value: part.minimumStockLevel, className: '' },
        { label: 'Stock Status', value: stockStatus, className: `stock ${stockStatus.toLowerCase().replace(' ', '-')}` },
        { label: 'Created', value: formatDate(part.createdAt), className: '' },
        { label: 'Last Updated', value: formatDate(part.updatedAt), className: '' }
    ];

    details.forEach(detail => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';

        const label = document.createElement('span');
        label.className = 'detail-label';
        label.textContent = detail.label + ':';

        const value = document.createElement('span');
        value.className = `detail-value ${detail.className}`;
        value.textContent = SecurityUtils.sanitizeInput(String(detail.value));

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
    closeBtn.addEventListener('click', hidePartDetailsModal);

    const orderBtn = document.createElement('button');
    orderBtn.className = 'btn-primary';
    orderBtn.addEventListener('click', () => redirectToNewOrder(part.id));

    const orderIcon = document.createElement('i');
    orderIcon.className = 'fas fa-plus-circle';
    orderBtn.appendChild(orderIcon);
    orderBtn.appendChild(document.createTextNode(' Order More Stock'));

    actions.appendChild(closeBtn);
    actions.appendChild(orderBtn);

    content.appendChild(detailsContainer);
    content.appendChild(actions);
}

function showStockUpdateModal(partId) {
    const part = allParts.find(p => p.id === partId);
    if (!part) return;

    updatePartId = partId;

    const updatePartIdElement = document.getElementById('updatePartId');
    const updatePartInfoElement = document.getElementById('updatePartInfo');

    if (updatePartIdElement) {
        updatePartIdElement.value = partId;
    }

    if (updatePartInfoElement) {
        // Clear and rebuild content safely
        while (updatePartInfoElement.firstChild) {
            updatePartInfoElement.removeChild(updatePartInfoElement.firstChild);
        }

        const title = document.createElement('h4');
        title.textContent = SecurityUtils.sanitizeInput(part.name);

        const partNumPara = document.createElement('p');
        partNumPara.textContent = `Part Number: ${SecurityUtils.sanitizeInput(part.partNumber) || 'N/A'}`;

        const stockPara = document.createElement('p');
        const stockStrong = document.createElement('strong');
        stockStrong.textContent = part.stockQuantity;
        stockPara.appendChild(document.createTextNode('Current Stock: '));
        stockPara.appendChild(stockStrong);

        const minPara = document.createElement('p');
        minPara.textContent = `Minimum Level: ${part.minimumStockLevel}`;

        updatePartInfoElement.appendChild(title);
        updatePartInfoElement.appendChild(partNumPara);
        updatePartInfoElement.appendChild(stockPara);
        updatePartInfoElement.appendChild(minPara);
    }

    const form = document.getElementById('stockUpdateForm');
    if (form) {
        form.reset();
    }

    if (updatePartIdElement) {
        updatePartIdElement.value = partId;
    }

    const modal = document.getElementById('stockUpdateModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

async function handleStockUpdate(e) {
    e.preventDefault();

    const partId = SecurityUtils.sanitizeInput(document.getElementById('updatePartId').value);
    const operation = SecurityUtils.sanitizeInput(document.getElementById('stockOperation').value);
    const quantityInput = document.getElementById('stockQuantity').value;
    const reasonInput = document.getElementById('stockReason').value;

    const quantity = parseInt(quantityInput);
    const reason = SecurityUtils.sanitizeInput(reasonInput.trim());

    if (!quantity || quantity <= 0 || isNaN(quantity)) {
        return;
    }

    if (!['add', 'subtract', 'set'].includes(operation)) {
        return;
    }

    try {
        const headers = getAuthHeaders();
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
            hideStockUpdateModal();
            await loadParts();
        }
    } catch (error) {
        console.error('Error updating stock:', error);
    }
}

// Modal management functions
function hidePartDetailsModal() {
    const modal = document.getElementById('partDetailsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function hideStockUpdateModal() {
    const modal = document.getElementById('stockUpdateModal');
    if (modal) {
        modal.style.display = 'none';
    }
    updatePartId = null;
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    updatePartId = null;
}

function formatCurrency(amount) {
    const numAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON'
    }).format(numAmount);
}

function formatDate(dateString) {
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

function refreshParts() {
    loadParts();
}


setInterval(refreshParts, 5 * 60 * 1000);

function highlightCurrentPage() {
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