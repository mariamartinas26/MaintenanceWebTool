let selectedPartId = null;
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

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuthentication()) {
        return;
    }
    loadDashboardData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Stock update form submission
    document.getElementById('stockUpdateForm').addEventListener('submit', handleStockUpdate);

    // Close modal when clicking outside
    document.getElementById('stockUpdateModal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideStockUpdateModal();
        }
    });

    // ESC key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideStockUpdateModal();
        }
    });

    // Navigation functionality
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

async function loadDashboardData() {

    try {
        await Promise.all([
            loadStatistics(),
            loadCategories(),
            loadAdminInfo()
        ]);
    } catch (error) {
        showNotification('Error loading dashboard data', 'error');
    }
}

// Load inventory statistics
async function loadStatistics() {
    try {
        const response = await fetch('/inventory/api/parts/statistics', {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            updateStatisticsDisplay(data.statistics);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        showNotification('Error loading statistics', 'error');
    }
}

// Update statistics display (removed lowStockCount)
function updateStatisticsDisplay(stats) {
    document.getElementById('totalParts').textContent = stats.totalParts.toLocaleString();
    document.getElementById('inventoryValue').textContent = stats.totalInventoryValue.toLocaleString('ro-RO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    document.getElementById('totalCategories').textContent = stats.totalCategories.toLocaleString();
}

// Load categories overview
async function loadCategories() {
    try {
        const [categoriesResponse, partsResponse] = await Promise.all([
            fetch('/inventory/api/parts/categories', {
                headers: getAuthHeaders()
            }),
            fetch('/inventory/api/parts', {
                headers: getAuthHeaders()
            })
        ]);

        const categoriesData = await categoriesResponse.json();
        const partsData = await partsResponse.json();

        if (categoriesData.success && partsData.success) {
            displayCategories(categoriesData.categories, partsData.parts);
        } else {
            throw new Error('Error loading categories data');
        }
    } catch (error) {
        document.getElementById('categoriesGrid').innerHTML =
            '<div class="loading">Error loading categories</div>';
    }
}

// Display categories with part counts
function displayCategories(categories, parts) {
    const container = document.getElementById('categoriesGrid');

    if (categories.length === 0) {
        container.innerHTML = '<div class="loading">No categories found</div>';
        return;
    }

    // Count parts by category
    const categoryCounts = {};
    categories.forEach(category => {
        categoryCounts[category] = parts.filter(part => part.category === category).length;
    });

    const html = categories.map(category => `
        <div class="category-card">
            <h4>${escapeHtml(category)}</h4>
            <div class="count">${categoryCounts[category] || 0}</div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Load admin info
async function loadAdminInfo() {
    try {
        // Get admin info from token or session
        const adminName = localStorage.getItem('adminName') || 'Admin';
        document.getElementById('admin-name').textContent = adminName;
    } catch (error) {
        document.getElementById('admin-name').textContent = 'Admin';
    }
}

function showStockUpdateModal() {
    document.getElementById('stockUpdateModal').style.display = 'flex';
    document.getElementById('partSearch').focus();
}

function hideStockUpdateModal() {
    document.getElementById('stockUpdateModal').style.display = 'none';
    resetStockUpdateForm();
}

function resetStockUpdateForm() {
    document.getElementById('stockUpdateForm').reset();
    document.getElementById('selectedPartInfo').style.display = 'none';
    document.getElementById('partSearchResults').style.display = 'none';
    selectedPartId = null;
}

// Search parts for stock update
async function searchPartsForStock() {
    const searchTerm = document.getElementById('partSearch').value.trim();
    const resultsContainer = document.getElementById('partSearchResults');

    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    if (searchTerm.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/inventory/api/parts/search?q=${encodeURIComponent(searchTerm)}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                displaySearchResults(data.parts.slice(0, 10)); // Show max 10 results
            } else {
                resultsContainer.innerHTML = '<div class="search-result-item">No parts found</div>';
                resultsContainer.style.display = 'block';
            }
        } catch (error) {
            resultsContainer.innerHTML = '<div class="search-result-item">Error searching parts</div>';
            resultsContainer.style.display = 'block';
        }
    }, 300);
}

// Display search results
function displaySearchResults(parts) {
    const container = document.getElementById('partSearchResults');

    if (parts.length === 0) {
        container.innerHTML = '<div class="search-result-item">No parts found</div>';
    } else {
        const html = parts.map(part => `
            <div class="search-result-item" onclick="selectPart(${part.id}, '${escapeHtml(part.name)}', ${part.stockQuantity}, ${part.minimumStockLevel})">
                <strong>${escapeHtml(part.name)}</strong><br>
                <small>${escapeHtml(part.partNumber || 'No part number')} - Stock: ${part.stockQuantity}</small>
            </div>
        `).join('');
        container.innerHTML = html;
    }

    container.style.display = 'block';
}

// Select a part for stock update
function selectPart(partId, partName, currentStock, minLevel) {
    selectedPartId = partId;

    document.getElementById('selectedPartName').textContent = partName;
    document.getElementById('currentStock').textContent = currentStock;
    document.getElementById('minLevel').textContent = minLevel;
    document.getElementById('selectedPartInfo').style.display = 'block';

    document.getElementById('partSearchResults').style.display = 'none';
    document.getElementById('partSearch').value = partName;
}

async function handleStockUpdate(e) {
    e.preventDefault();

    if (!selectedPartId) {
        showNotification('Please select a part first', 'error');
        return;
    }

    const operation = document.getElementById('stockOperation').value;
    const quantity = parseInt(document.getElementById('stockQuantity').value);
    const reason = document.getElementById('stockReason').value.trim();

    if (!quantity || quantity <= 0) {
        showNotification('Please enter a valid quantity', 'error');
        return;
    }

    try {

        const response = await fetch(`/inventory/api/parts/${selectedPartId}/stock`, {
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
            // Reload statistics to reflect changes
            await loadStatistics();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error updating stock', 'error');
    }
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

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('adminName');
        window.location.href = '/admin/login';
    }
}
