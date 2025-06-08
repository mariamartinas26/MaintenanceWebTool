// Global variables
let lowStockParts = [];
let filteredParts = [];
let updatePartId = null;

// Helper functions for authentication
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
    // Check authentication first
    if (!checkAuthentication()) {
        return;
    }

    setupEventListeners();
    loadLowStockData();
    loadCategories();
});

// Setup event listeners
function setupEventListeners() {
    // Filters
    document.getElementById('urgencyFilter').addEventListener('change', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);

    // Stock update form
    document.getElementById('stockUpdateForm').addEventListener('submit', handleStockUpdate);

    // Modal close events
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
}

// Load low stock data
async function loadLowStockData() {
    try {
        showLoading(true);

        const response = await fetch('/inventory/api/parts/low-stock', {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            lowStockParts = data.parts;
            updateSummaryCards();
            applyFilters();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading low stock data:', error);
        showNotification('Error loading low stock data', 'error');
        displayEmptyState('Error loading data. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Load categories for filter
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

// Update summary cards
function updateSummaryCards() {
    const criticalCount = lowStockParts.filter(part => part.stockQuantity === 0).length;
    const lowStockCount = lowStockParts.filter(part => part.stockQuantity > 0 && part.stockQuantity <= part.minimumStockLevel).length;

    // Calculate potential lost value (estimated based on current demand)
    const lostValue = lowStockParts
        .filter(part => part.stockQuantity === 0)
        .reduce((total, part) => total + (part.price * part.minimumStockLevel), 0);

    document.getElementById('criticalCount').textContent = criticalCount;
    document.getElementById('lowStockCount').textContent = lowStockCount;
    document.getElementById('lostValue').textContent = formatCurrency(lostValue);
}

// Apply filters and sorting
function applyFilters() {
    const urgencyFilter = document.getElementById('urgencyFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    // Start with all low stock parts
    filteredParts = [...lowStockParts];

    // Apply urgency filter
    if (urgencyFilter !== 'all') {
        filteredParts = filteredParts.filter(part => {
            const urgency = getUrgencyLevel(part);
            return urgency === urgencyFilter;
        });
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
        filteredParts = filteredParts.filter(part => part.category === categoryFilter);
    }

    // Apply sorting
    filteredParts.sort((a, b) => {
        switch (sortBy) {
            case 'urgency':
                const urgencyOrder = { critical: 0, high: 1, medium: 2 };
                const aUrgency = getUrgencyLevel(a);
                const bUrgency = getUrgencyLevel(b);
                return urgencyOrder[aUrgency] - urgencyOrder[bUrgency];

            case 'name':
                return a.name.localeCompare(b.name);

            case 'stockQuantity':
                return a.stockQuantity - b.stockQuantity;

            case 'price':
                return b.price - a.price; // Higher price first

            default:
                return 0;
        }
    });

    displayLowStockParts();
}

// Get urgency level for a part
function getUrgencyLevel(part) {
    if (part.stockQuantity === 0) {
        return 'critical';
    } else if (part.stockQuantity <= Math.floor(part.minimumStockLevel / 2)) {
        return 'high';
    } else {
        return 'medium';
    }
}

// Display low stock parts
function displayLowStockParts() {
    const container = document.getElementById('lowStockContainer');

    if (filteredParts.length === 0) {
        if (lowStockParts.length === 0) {
            displayEmptyState('🎉 Great news! All parts are well stocked.', 'success');
        } else {
            displayEmptyState('No parts match your current filters.');
        }
        return;
    }

    const html = filteredParts.map(part => createLowStockItem(part)).join('');
    container.innerHTML = html;
}

// Create low stock item HTML
function createLowStockItem(part) {
    const urgency = getUrgencyLevel(part);
    const stockPercentage = part.minimumStockLevel > 0 ? (part.stockQuantity / part.minimumStockLevel) * 100 : 0;

    return `
        <div class="low-stock-item ${urgency}" data-part-id="${part.id}">
            <div class="item-header">
                <div class="item-title">
                    <h3>${escapeHtml(part.name)}</h3>
                    ${part.partNumber ? `<span class="part-number">${escapeHtml(part.partNumber)}</span>` : ''}
                </div>
                <span class="urgency-badge ${urgency}">${urgency}</span>
            </div>
            
            <div class="item-details">
                <div class="detail-group">
                    <span class="detail-label">Category</span>
                    <span class="detail-value">${escapeHtml(part.category)}</span>
                </div>
                
                <div class="detail-group">
                    <span class="detail-label">Current Stock</span>
                    <div class="stock-info">
                        <span class="detail-value">${part.stockQuantity} / ${part.minimumStockLevel}</span>
                        <div class="stock-bar">
                            <div class="stock-fill ${urgency}" style="width: ${Math.min(stockPercentage, 100)}%"></div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-group">
                    <span class="detail-label">Unit Price</span>
                    <span class="detail-value">${formatCurrency(part.price)}</span>
                </div>
                
                ${part.supplier?.name ? `
                    <div class="detail-group">
                        <span class="detail-label">Supplier</span>
                        <span class="detail-value">${escapeHtml(part.supplier.name)}</span>
                    </div>
                ` : ''}
                
                <div class="detail-group">
                    <span class="detail-label">Restock Value</span>
                    <span class="detail-value">${formatCurrency(part.price * part.minimumStockLevel)}</span>
                </div>
            </div>
            
            <div class="item-actions">
                <button class="action-btn" onclick="viewPartDetails(${part.id})">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn" onclick="editPart(${part.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn primary" onclick="showStockUpdateModal(${part.id})">
                    <i class="fas fa-plus"></i> Restock
                </button>
            </div>
        </div>
    `;
}

// Display empty state
function displayEmptyState(message = 'No low stock parts found.', type = 'info') {
    const container = document.getElementById('lowStockContainer');
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';

    container.innerHTML = `
        <div class="empty-state">
            <i class="fas ${icon}"></i>
            <h3>${type === 'success' ? 'All Good!' : 'No Results'}</h3>
            <p>${message}</p>
            ${type !== 'success' ? `
                <button class="btn-secondary" onclick="clearFilters()">
                    <i class="fas fa-filter"></i> Clear Filters
                </button>
            ` : `
                <button class="btn-primary" onclick="window.location.href='/inventory/dashboard'">
                    <i class="fas fa-tachometer-alt"></i> Back to Dashboard
                </button>
            `}
        </div>
    `;
}

// Clear all filters
function clearFilters() {
    document.getElementById('urgencyFilter').value = 'all';
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('sortBy').value = 'urgency';
    applyFilters();
}

// Show stock update modal
function showStockUpdateModal(partId) {
    const part = lowStockParts.find(p => p.id === partId);
    if (!part) return;

    updatePartId = partId;

    // Populate part info
    document.getElementById('updatePartId').value = partId;
    document.getElementById('updatePartInfo').innerHTML = `
        <h4>${escapeHtml(part.name)}</h4>
        <p><strong>Part Number:</strong> ${part.partNumber ? escapeHtml(part.partNumber) : 'N/A'}</p>
        <p><strong>Current Stock:</strong> ${part.stockQuantity}</p>
        <p><strong>Minimum Level:</strong> ${part.minimumStockLevel}</p>
        <p><strong>Suggested Restock:</strong> ${Math.max(part.minimumStockLevel - part.stockQuantity, part.minimumStockLevel)} units</p>
    `;

    // Pre-fill suggested quantity
    const suggestedQuantity = part.stockQuantity === 0
        ? part.minimumStockLevel * 2  // Double minimum if out of stock
        : part.minimumStockLevel - part.stockQuantity + 5; // Top up plus buffer

    document.getElementById('stockQuantity').value = Math.max(suggestedQuantity, 1);
    document.getElementById('stockOperation').value = 'add';
    document.getElementById('stockReason').value = 'Restocking low inventory';

    // Show modal
    document.getElementById('stockUpdateModal').style.display = 'block';
}

// Hide stock update modal
function hideStockUpdateModal() {
    document.getElementById('stockUpdateModal').style.display = 'none';
    document.getElementById('stockUpdateForm').reset();
    updatePartId = null;
}

// Handle stock update form submission
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

    if (!reason) {
        showNotification('Please provide a reason for the stock update', 'error');
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
            // Reload data to reflect changes
            await loadLowStockData();
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

// Navigation functions
function viewPartDetails(partId) {
    window.location.href = `/inventory/parts#part-${partId}`;
}

function editPart(partId) {
    window.location.href = `/inventory/parts/edit/${partId}`;
}

// Export functions
function exportLowStock() {
    const csvContent = generateCSV(filteredParts);
    downloadCSV(csvContent, `low_stock_report_${new Date().toISOString().split('T')[0]}.csv`);
    showNotification(`Exported ${filteredParts.length} low stock items`, 'success');
}

function generateCSV(parts) {
    const headers = ['Name', 'Part Number', 'Category', 'Current Stock', 'Minimum Level', 'Urgency', 'Unit Price', 'Restock Value', 'Supplier'];
    const rows = parts.map(part => [
        part.name,
        part.partNumber || '',
        part.category,
        part.stockQuantity,
        part.minimumStockLevel,
        getUrgencyLevel(part),
        part.price,
        (part.price * part.minimumStockLevel).toFixed(2),
        part.supplier?.name || ''
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

// Refresh data
function refreshData() {
    loadLowStockData();
    showNotification('Data refreshed', 'success');
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    // Add styles if not already added
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
            
            .notification-success { background: #10b981; }
            .notification-error { background: #ef4444; }
            .notification-warning { background: #f59e0b; }
            .notification-info { background: #3b82f6; }
            
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

    // Add to page
    document.body.appendChild(notification);

    // Remove after 5 seconds
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

// Auto-refresh every 10 minutes
setInterval(refreshData, 10 * 60 * 1000);