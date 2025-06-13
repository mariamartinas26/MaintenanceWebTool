let suppliers = [];
let parts = [];
let orders = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initializeData().then(() => {
        showTab('suppliers');
    });
});

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            showTab(tabName);
        });
    });


    // Supplier form submission
    const supplierForm = document.getElementById('supplierForm');
    if (supplierForm) {
        supplierForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSupplier();
        });
    }

    // Order form submission
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveOrder();
        });
    }

    // Modal close on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });

    // Order total calculation
    const orderItems = document.getElementById('orderItems');
    if (orderItems) {
        orderItems.addEventListener('input', calculateOrderTotal);
    }
}

// Tab management
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Load tab-specific data
    switch(tabName) {
        case 'suppliers':
            loadSuppliers();
            break;
        case 'catalog':
            loadParts();
            loadSupplierFilter();
            break;
        case 'orders':
            loadOrders();
            break;
    }
}

// API Integration
async function loadSuppliersFromAPI() {
    try {
        showLoading('suppliers-list');
        const response = await fetch('/api/suppliers');

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
        showNotification('Error loading suppliers from API: ' + error.message, 'error');
        hideLoading('suppliers-list');
    }
}

async function saveSupplierToAPI(supplierData) {
    try {
        const isUpdate = supplierData.id;
        const url = isUpdate ? `/api/suppliers/${supplierData.id}` : '/api/suppliers';
        const method = isUpdate ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(supplierData)
        });

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

async function deleteSupplierFromAPI(id) {
    try {
        const response = await fetch(`/api/suppliers/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            await loadSuppliersFromAPI();
        } else {
            throw new Error(result.message || 'Failed to delete supplier');
        }
    } catch (error) {
        showNotification('Error deleting supplier: ' + error.message, 'error');
    }
}

async function loadPartsFromAPI() {
    try {
        showLoading('parts-list');
        const response = await fetch('/api/parts');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            parts = cleanPartData(result.data);
            loadParts();
        } else {
            throw new Error(result.message || 'Failed to load parts');
        }
    } catch (error) {
        showNotification('Error loading parts from API: ' + error.message, 'error');
        hideLoading('parts-list');
    }
}

async function loadOrdersFromAPI() {
    try {
        showLoading('orders-list');
        const response = await fetch('/api/orders');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            orders = result.data;

            orders.forEach((order, index) => {
                console.log(`  ${index + 1}. ID: "${order.id}" (${typeof order.id}), Status: ${order.status}`);
            });

            loadOrders();
        } else {
            throw new Error(result.message || 'Failed to load orders');
        }
    } catch (error) {
        showNotification('Error loading orders from API: ' + error.message, 'error');
        hideLoading('orders-list');
    }
}

async function saveOrderToAPI(orderData) {
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            await loadOrdersFromAPI();
        } else {
            throw new Error(result.message || 'Failed to save order');
        }
    } catch (error) {
        showNotification('Error saving order: ' + error.message, 'error');
    }
}

async function updateOrderStatusAPI(orderId, status, actualDeliveryDate = null, notes = null) {
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orderId: orderId,
                status: status,
                actual_delivery_date: actualDeliveryDate,
                notes: notes
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            await loadOrdersFromAPI();

            if (status === 'delivered') {
                await loadPartsFromAPI();
            }
        } else {
            throw new Error(result.message || 'Failed to update order status');
        }
    } catch (error) {
        showNotification('Error updating order status: ' + error.message, 'error');
    }
}


function loadSuppliers() {
    const suppliersList = document.getElementById('suppliers-list');

    if (!suppliersList) {
        console.error('suppliers-list element not found');
        return;
    }

    if (suppliers.length === 0) {
        suppliersList.innerHTML = '<div class="empty-state"><h3>No suppliers found</h3><p>Add your first supplier to get started</p></div>';
        return;
    }

    suppliersList.innerHTML = suppliers.map(supplier => `
        <div class="supplier-card">
            <div class="supplier-header">
                <div>
                    <h3 class="supplier-name">${supplier.company_name || suppliFer.name}</h3>
                    <p class="supplier-specialization">${supplier.specialization || 'General'}</p>
                </div>
            </div>
            <div class="supplier-details">
                <div class="supplier-detail">
                    <span>${supplier.contact_person}</span>
                </div>
                <div class="supplier-detail">
                    <span>${supplier.phone || 'N/A'}</span>
                </div>
                <div class="supplier-detail">
                    <span>${supplier.email}</span>
                </div>
                <div class="supplier-detail">
                    <span>${supplier.delivery_time_days || supplier.deliveryTime || 7} days delivery</span>
                </div>
            </div>
            <div class="supplier-actions">
                <button class="btn btn-sm secondary-btn" onclick="editSupplier(${supplier.id})">Edit</button>
                <button class="btn btn-sm danger-btn" onclick="deleteSupplier(${supplier.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function loadParts() {
    const partsList = document.getElementById('parts-list');

    if (!partsList) {
        console.error('parts-list element not found');
        return;
    }

    if (parts.length === 0) {
        partsList.innerHTML = '<div class="empty-state"><h3>No parts found</h3><p>Parts catalog is empty</p></div>';
        return;
    }

    const filteredParts = filterPartsBySupplier();

    partsList.innerHTML = filteredParts.map(part => {
        const stockStatus = getStockStatus(part.stock_quantity || part.stock, part.minimum_stock_level || part.minStock);

        const price = parseFloat(part.price) || 0;

        return `
            <div class="part-card">
                <h3 class="part-name">${part.name}</h3>
                <p class="part-supplier">Supplier: ${part.supplier_name || part.supplierName}</p>
                <div class="part-price">$${price.toFixed(2)}</div>
                <div class="part-stock ${stockStatus.class}">
                    Stock: ${part.stock_quantity || part.stock} units ${stockStatus.indicator}
                </div>
                <div class="part-actions">
                    <button class="btn btn-sm secondary-btn" onclick="editPart(${part.id})">Edit</button>
                    <button class="btn btn-sm primary-btn" onclick="orderPart(${part.id})">Order</button>
                </div>
            </div>
        `;
    }).join('');
}

function loadOrders() {
    const ordersList = document.getElementById('orders-list');

    if (!ordersList) {
        return;
    }

    if (orders.length === 0) {
        ordersList.innerHTML = '<div class="empty-state"><h3>No orders found</h3><p>No purchase orders have been placed yet</p></div>';
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const totalAmount = parseFloat(order.total_amount || order.total || 0);

        return `
        <div class="order-card ${order.status}">
            <div class="order-header">
                <h3 class="order-number">${order.id}</h3>
                <span class="order-status status-${order.status}">${order.status}</span>
            </div>
            <p class="order-supplier">Supplier: ${order.supplier_name || order.supplierName || 'N/A'}</p>
            <div class="order-items">
                ${order.items ? order.items.map(item => {
            const unitPrice = parseFloat(item.unit_price || item.unitPrice) || 0;
            const quantity = parseInt(item.quantity) || 0;
            const total = quantity * unitPrice;

            return `
                        <div class="order-item">
                            <span>${item.name || item.part_name} (${quantity}x)</span>
                            <span>$${total.toFixed(2)}</span>
                        </div>
                    `;
        }).join('') : ''}
            </div>
            <div class="order-total">Total: $${totalAmount.toFixed(2)}</div>
            <div class="order-date">Ordered: ${formatDate(order.order_date || order.orderDate)}</div>
            ${order.expected_delivery_date || order.estimatedDelivery ? `<div class="order-date">Est. Delivery: ${formatDate(order.expected_delivery_date || order.estimatedDelivery)}</div>` : ''}
            <div class="order-actions">
                <button class="btn btn-sm secondary-btn" onclick="viewOrderDetails('${order.id}')">View Details</button>
                ${order.status !== 'delivered' ? `<button class="btn btn-sm primary-btn" onclick="updateOrderStatus('${order.id}')">Update Status</button>` : ''}
            </div>
        </div>
    `;
    }).join('');
}

function cleanPartData(parts) {
    return parts.map(part => ({
        ...part,
        price: parseFloat(part.price) || 0,
        stock_quantity: parseInt(part.stock_quantity) || 0,
        minimum_stock_level: parseInt(part.minimum_stock_level) || 0
    }));
}

// Modal functions
function openSupplierModal(supplierId = null) {
    const modal = document.getElementById('supplierModal');
    const title = document.getElementById('supplierModalTitle');
    const form = document.getElementById('supplierForm');

    if (!modal || !title || !form) {
        return;
    }

    if (supplierId) {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            title.textContent = 'Edit Supplier';
            populateSupplierForm(supplier);
        }
    } else {
        title.textContent = 'Add New Supplier';
        form.reset();
        const supplierIdField = document.getElementById('supplierId');
        if (supplierIdField) {
            supplierIdField.value = '';
        }
    }

    modal.style.display = 'flex';
}

function closeSupplierModal() {
    const modal = document.getElementById('supplierModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function populateSupplierForm(supplier) {
    const fields = {
        'supplierId': supplier.id,
        'supplierName': supplier.company_name || supplier.name,
        'contactPerson': supplier.contact_person,
        'phone': supplier.phone,
        'email': supplier.email,
        'address': supplier.address,
        'specialization': supplier.specialization,
        'deliveryTime': supplier.delivery_time_days || supplier.deliveryTime
    };

    for (const [fieldId, value] of Object.entries(fields)) {
        const field = document.getElementById(fieldId);
        if (field && value !== undefined) {
            field.value = value;
        }
    }
}

// Save functions
function saveSupplier() {
    const formData = {
        id: document.getElementById('supplierId')?.value || null,
        name: document.getElementById('supplierName')?.value,
        contact_person: document.getElementById('contactPerson')?.value,
        phone: document.getElementById('phone')?.value,
        email: document.getElementById('email')?.value,
        address: document.getElementById('address')?.value,
        specialization: document.getElementById('specialization')?.value,
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
        showNotification('Please provide a valid email address', 'error');
        return;
    }

    if (typeof saveSupplierToAPI === 'function') {
        saveSupplierToAPI(formData);
    } else {
        // Fallback to local storage
        if (formData.id) {
            const index = suppliers.findIndex(s => s.id === parseInt(formData.id));
            if (index !== -1) {
                suppliers[index] = { ...suppliers[index], ...formData };
                showNotification('Supplier updated successfully!', 'success');
            }
        } else {
            const newId = suppliers.length > 0 ? Math.max(...suppliers.map(s => s.id)) + 1 : 1;
            suppliers.push({
                id: newId,
                ...formData,
                rating: 0,
                evaluation: { quality: 0, punctuality: 0, delivery: 0, overall: 0 }
            });
            showNotification('Supplier added successfully!', 'success');
        }
        loadSuppliers();
    }

    closeSupplierModal();
}

// Utility functions
function getStockStatus(stock, minStock) {
    if (stock === 0) {
        return { class: 'stock-out' };
    } else if (stock <= minStock) {
        return { class: 'stock-low' };
    } else {
        return { class: 'stock-available' };
    }
}

function filterPartsBySupplier() {
    const supplierFilter = document.getElementById('supplierFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    const supplierValue = supplierFilter?.value || '';
    const categoryValue = categoryFilter?.value || '';

    return parts.filter(part => {
        const matchesSupplier = !supplierValue || (part.supplier_id || part.supplierId).toString() === supplierValue;
        const matchesCategory = !categoryValue || part.category === categoryValue;
        return matchesSupplier && matchesCategory;
    });
}

function loadSupplierFilter() {
    const supplierFilter = document.getElementById('supplierFilter');
    if (supplierFilter) {
        supplierFilter.innerHTML = '<option value="">All Suppliers</option>' +
            suppliers.map(supplier => `<option value="${supplier.id}">${supplier.company_name || supplier.name}</option>`).join('');
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

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

function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading">Loading...</div>';
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="empty-state"><h3>Failed to load data</h3><p>Please try refreshing the page</p></div>';
    }
}

// Action functions
function editSupplier(id) {
    openSupplierModal(id);
}

function deleteSupplier(id) {
    if (confirm('Are you sure you want to delete this supplier?')) {
        if (typeof deleteSupplierFromAPI === 'function') {
            deleteSupplierFromAPI(id);
        } else {
            suppliers = suppliers.filter(s => s.id !== id);
            loadSuppliers();
            showNotification('Supplier deleted successfully!', 'success');
        }
    }
}

function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        const orderTotal = order.total_amount || order.total;
        const orderDate = order.order_date || order.orderDate;
        const supplierName = order.supplier_name || order.supplierName;

        const itemsText = order.items ? order.items.map(item =>
            `${item.name || item.part_name} (${item.quantity}x) - ${(item.quantity * (item.unit_price || item.unitPrice)).toFixed(2)}`
        ).join('\n') : 'No items';

        alert(`Order Details:\n\nOrder ID: ${order.id}\nSupplier: ${supplierName}\nStatus: ${order.status}\nTotal: ${orderTotal.toFixed(2)}\nOrder Date: ${orderDate}\n\nItems:\n${itemsText}`);
    }
}

function editPart(id) {
    const part = parts.find(p => p.id === id);
    if (part) {
        const partData = `
            Part: ${part.name}
            Category: ${part.category}
            Price: ${part.price}
            Stock: ${part.stock_quantity || part.stock}
            Min Stock: ${part.minimum_stock_level || part.minStock}
            Supplier: ${part.supplier_name || part.supplierName}
        `;
        alert(`Edit Part:\n\n${partData}\n\nPart editing functionality can be implemented here.`);
    }
}

function orderPart(id) {
    const part = parts.find(p => p.id === id);
    if (part) {
        openOrderModal();

        const orderSupplier = document.getElementById('orderSupplier');
        if (orderSupplier) {
            orderSupplier.value = part.supplier_id || part.supplierId;
        }

        const firstPartName = document.querySelector('.part-name');
        const firstUnitPrice = document.querySelector('.unit-price');

        if (firstPartName && firstUnitPrice) {
            firstPartName.value = part.name;

            const price = parseFloat(part.price) || 0;
            firstUnitPrice.value = price.toFixed(2);

            const currentStock = part.stock_quantity || part.stock || 0;
            const minStock = part.minimum_stock_level || part.minStock || 10;
            const suggestedQuantity = Math.max(minStock - currentStock, 1);

            const firstQuantity = document.querySelector('.quantity');
            if (firstQuantity) {
                firstQuantity.value = suggestedQuantity;
                calculateOrderTotal();
            }
        }
    }
}


function openOrderModal() {
    const modal = document.getElementById('orderModal');
    const supplierSelect = document.getElementById('orderSupplier');

    if (!modal || !supplierSelect) {
        return;
    }

    //supplier dropdown
    supplierSelect.innerHTML = '<option value="">Select Supplier</option>' +
        suppliers.map(supplier => `<option value="${supplier.id}">${supplier.company_name || supplier.name}</option>`).join('');

    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.reset();
    }

    modal.style.display = 'flex';
}

function closeOrderModal() {
    const modal = document.getElementById('orderModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function addOrderItem() {
    const container = document.getElementById('orderItems');
    if (!container) return;

    const newItem = document.createElement('div');
    newItem.className = 'order-item';
    newItem.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <input type="text" placeholder="Part Name" class="part-name" required>
            </div>
            <div class="form-group">
                <input type="number" placeholder="Quantity" class="quantity" min="1" required>
            </div>
            <div class="form-group">
                <input type="number" placeholder="Unit Price" class="unit-price" step="0.01" min="0" required>
            </div>
            <button type="button" class="btn danger-btn" onclick="removeOrderItem(this)">Remove</button>
        </div>
    `;
    container.appendChild(newItem);
}

function removeOrderItem(button) {
    const orderItem = button.closest('.order-item');
    if (document.querySelectorAll('.order-item').length > 1) {
        orderItem.remove();
        calculateOrderTotal();
    }
}

function calculateOrderTotal() {
    const orderItems = document.querySelectorAll('.order-item');
    let total = 0;

    orderItems.forEach(item => {
        const quantity = parseFloat(item.querySelector('.quantity')?.value) || 0;
        const unitPrice = parseFloat(item.querySelector('.unit-price')?.value) || 0;
        total += quantity * unitPrice;
    });

    const totalElement = document.getElementById('orderTotal');
    if (totalElement) {
        totalElement.textContent = total.toFixed(2);
    }
}

function saveOrder() {
    const supplierIdElement = document.getElementById('orderSupplier');
    const notesElement = document.getElementById('orderNotes');

    if (!supplierIdElement) {
        showNotification('Order form elements not found', 'error');
        return;
    }

    const supplierId = supplierIdElement.value;
    const supplier = suppliers.find(s => s.id === parseInt(supplierId));
    const notes = notesElement?.value || '';

    if (!supplierId) {
        showNotification('Please select a supplier', 'error');
        return;
    }

    const orderItems = [];
    document.querySelectorAll('.order-item').forEach(item => {
        const partName = item.querySelector('.part-name')?.value;
        const quantity = parseInt(item.querySelector('.quantity')?.value);
        const unitPrice = parseFloat(item.querySelector('.unit-price')?.value);

        if (partName && quantity && unitPrice) {
            orderItems.push({ name: partName, quantity, unit_price: unitPrice });
        }
    });

    if (orderItems.length === 0) {
        showNotification('Please add at least one order item', 'error');
        return;
    }

    const total = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const orderDate = new Date().toISOString().split('T')[0];
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + (supplier.delivery_time_days || supplier.deliveryTime || 7));

    const orderData = {
        supplier_id: parseInt(supplierId),
        items: orderItems,
        notes: notes,
        expected_delivery_date: expectedDelivery.toISOString().split('T')[0]
    };

    if (typeof saveOrderToAPI === 'function') {
        saveOrderToAPI(orderData);
    } else {
        const newOrder = {
            id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
            supplier_id: parseInt(supplierId),
            supplier_name: supplier.company_name || supplier.name,
            status: 'ordered',
            order_date: orderDate,
            expected_delivery_date: expectedDelivery.toISOString().split('T')[0],
            items: orderItems,
            total_amount: total,
            notes: notes
        };

        orders.unshift(newOrder);
        showNotification('Order placed successfully!', 'success');
        loadOrders();
    }

    closeOrderModal();
}

function generateAutoOrder(part) {
    const supplierId = part.supplier_id || part.supplierId;
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
        const minStock = part.minimum_stock_level || part.minStock || 10;
        const orderQuantity = Math.max(minStock * 2, 10);

        const autoOrder = {
            id: `AUTO-${String(orders.length + 1).padStart(3, '0')}`,
            supplier_id: supplier.id,
            supplier_name: supplier.company_name || supplier.name,
            status: 'ordered',
            order_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: new Date(Date.now() + (supplier.delivery_time_days || supplier.deliveryTime || 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [{ name: part.name, quantity: orderQuantity, unit_price: part.price }],
            total_amount: orderQuantity * part.price,
            notes: 'Auto-generated order for low stock'
        };

        orders.unshift(autoOrder);
        showNotification(`Auto-order generated for ${part.name}`, 'info');
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/login';
    }
}

function openOrderStatusModal(orderId) {
    let order = null;

    order = orders.find(o => o.id === orderId);

    if (!order) {
        order = orders.find(o => String(o.id) === String(orderId));
    }

    if (!order) {
        if (!isNaN(orderId)) {
            order = orders.find(o => Number(o.id) === Number(orderId));
        }
    }

    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }
    const totalAmount = parseFloat(order.total_amount || order.total || 0);
    console.log('Total amount debug:', {
        raw_total_amount: order.total_amount,
        raw_total: order.total,
        parsed_total: totalAmount,
        type: typeof totalAmount
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'orderStatusModal';
    modal.style.display = 'flex';

    const statuses = [
        { value: 'ordered', label: 'Ordered', color: '#17a2b8' },
        { value: 'confirmed', label: 'Confirmed', color: '#4ecdc4' },
        { value: 'in_transit', label: 'In Transit', color: '#ffc107' },
        { value: 'delivered', label: 'Delivered', color: '#28a745' },
        { value: 'cancelled', label: 'Cancelled', color: '#dc3545' }
    ];

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Update Order Status</h2>
                <span class="close-modal" onclick="closeOrderStatusModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="order-info">
                    <h3>Order: ${order.id}</h3>
                    <p><strong>Supplier:</strong> ${order.supplier_name || order.supplierName || 'N/A'}</p>
                    <p><strong>Current Status:</strong> <span class="status-badge status-${order.status}">${order.status}</span></p>
                    <p><strong>Total:</strong> $${totalAmount.toFixed(2)}</p>
                </div>

                <form id="orderStatusForm">
                    <input type="hidden" id="statusOrderId" value="${order.id}">
                    
                    <div class="form-group">
                        <label>Select New Status:</label>
                        <div class="status-options">
                            ${statuses.map(status => `
                                <div class="status-option ${status.value === order.status ? 'disabled' : ''}" 
                                     ${status.value === order.status ? '' : `onclick="selectOrderStatus('${status.value}')"`}>
                                    <div class="status-indicator" style="background-color: ${status.color}"></div>
                                    <div class="status-info">
                                        <div class="status-label">${status.label}</div>
                                        <div class="status-description">${getStatusDescription(status.value)}</div>
                                    </div>
                                    ${status.value === order.status ? '<span class="current-badge">Current</span>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-group" id="deliveryDateGroup" style="display: none;">
                        <label for="actualDeliveryDate">Actual Delivery Date:</label>
                        <input type="date" id="actualDeliveryDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>

                    <div class="form-group">
                        <label for="statusNotes">Notes (optional):</label>
                        <textarea id="statusNotes" rows="3" placeholder="Add any notes about this status change..."></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn secondary-btn" onclick="closeOrderStatusModal()">Cancel</button>
                        <button type="submit" class="btn primary-btn" id="updateStatusBtn" disabled>Update Status</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('orderStatusForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateOrderStatusFromModal();
    });

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeOrderStatusModal();
        }
    });
}


async function updateOrderStatusFromModal() {
    const orderId = document.getElementById('statusOrderId').value;
    const selectedStatus = document.getElementById('orderStatusForm').getAttribute('data-selected-status');
    const actualDeliveryDate = document.getElementById('actualDeliveryDate').value;
    const notes = document.getElementById('statusNotes').value;

    console.log('Frontend - updateOrderStatusFromModal called with:');
    console.log('  orderId:', orderId, 'Type:', typeof orderId);
    console.log('  selectedStatus:', selectedStatus);

    if (!selectedStatus) {
        showNotification('Please select a new status', 'error');
        return;
    }

    try {
        document.getElementById('updateStatusBtn').disabled = true;
        document.getElementById('updateStatusBtn').textContent = 'Updating...';
        await updateOrderStatusAPI(orderId, selectedStatus, actualDeliveryDate, notes);

        closeOrderStatusModal();

    } catch (error) {
        showNotification('Error updating order status: ' + error.message, 'error');

        document.getElementById('updateStatusBtn').disabled = false;
        document.getElementById('updateStatusBtn').textContent = 'Update Status';
    }
}


function getStatusDescription(status) {
    const descriptions = {
        'ordered': 'Order has been placed with supplier',
        'confirmed': 'Supplier has confirmed the order',
        'in_transit': 'Order is being shipped',
        'delivered': 'Order has been delivered',
        'cancelled': 'Order has been cancelled'
    };
    return descriptions[status] || '';
}

function updateOrderStatus(orderId) {
    let order = orders.find(o => o.id === orderId);

    if (!order) {
        order = orders.find(o => String(o.id) === String(orderId));
    }

    if (!order) {
        if (!isNaN(orderId)) {
            order = orders.find(o => Number(o.id) === Number(orderId));
        }
    }

    if (order) {
        openOrderStatusModal(orderId);
    } else {
        showNotification('Order not found in local data', 'error');
    }
}


function closeOrderStatusModal() {
    const modal = document.getElementById('orderStatusModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}
async function initializeData() {
        await loadSuppliersFromAPI();
        await loadPartsFromAPI();
        await loadOrdersFromAPI();
}