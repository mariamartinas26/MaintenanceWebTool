let suppliers = [];
let orders = [];
let parts = [];

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

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

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
// Adaugă această funcție în fișierul JavaScript, după loadOrdersFromAPI
async function loadPartsFromAPI() {
    try {
        console.log('Loading parts from API...');
        const response = await fetch('/api/parts');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Parts API response:', result);

        if (result.success) {
            parts = result.data;
            console.log('Parts loaded successfully:', parts);
            console.log('Number of parts:', parts.length);

            // Debug: afișează primele câteva părți
            if (parts.length > 0) {
                console.log('First part example:', parts[0]);
            }
        } else {
            throw new Error(result.message || 'Failed to load parts');
        }
    } catch (error) {
        console.error('Error loading parts from API:', error);
        showNotification('Error loading parts from API: ' + error.message, 'error');
        // Nu lăsa aplicația să crașeze - setează parts ca array gol
        parts = [];
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
            console.log('=== ORDERS DEBUG ===');
            console.log('All orders from API:', orders);

            if (orders && orders.length > 0) {
                console.log('First order complete structure:');
                console.log(JSON.stringify(orders[0], null, 2));
            }
            console.log('=== END DEBUG ===');

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

function saveOrder() {
    console.log('saveOrder called');

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
        const partSelect = item.querySelector('.part-select');
        const quantity = parseInt(item.querySelector('.quantity')?.value);
        const unitPrice = parseFloat(item.querySelector('.unit-price')?.value);

        console.log('Processing item:', {
            partSelectValue: partSelect?.value,
            quantity,
            unitPrice,
            partsArray: parts
        });

        if (partSelect && partSelect.value && quantity && unitPrice) {
            // Găsește partea selectată pentru a obține numele
            const selectedPart = parts.find(p => p.id === parseInt(partSelect.value));

            console.log('Selected part:', selectedPart);

            if (selectedPart) {
                orderItems.push({
                    name: selectedPart.name,
                    part_id: selectedPart.id,
                    quantity,
                    unit_price: unitPrice
                });
            } else {
                console.error('Part not found for ID:', partSelect.value);
                // Fallback - folosește textul din option
                const selectedOption = partSelect.options[partSelect.selectedIndex];
                if (selectedOption) {
                    orderItems.push({
                        name: selectedOption.text.split(' - ')[0],
                        part_id: parseInt(partSelect.value),
                        quantity,
                        unit_price: unitPrice
                    });
                }
            }
        }
    });

    console.log('=== SAVING ORDER ===');
    console.log('Final order items being sent:', orderItems);

    if (orderItems.length === 0) {
        showNotification('Please add at least one order item', 'error');
        return;
    }

    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + (supplier.delivery_time_days || supplier.deliveryTime || 7));

    const orderData = {
        supplier_id: parseInt(supplierId),
        items: orderItems,
        notes: notes,
        expected_delivery_date: expectedDelivery.toISOString().split('T')[0]
    };

    console.log('Order data structure:', orderData);

    saveOrderToAPI(orderData);
    closeOrderModal();
}


async function updateOrderStatusAPI(orderId, status, actualDeliveryDate = null, notes = null) {
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: status,
                actual_delivery_date: actualDeliveryDate,
                notes: notes
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            await loadOrdersFromAPI();
        } else {
            throw new Error(result.message || 'Failed to update order status');
        }
    } catch (error) {
        showNotification('Error updating order status: ' + error.message, 'error');
    }
}

// Display functions
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
                    <h3 class="supplier-name">${supplier.company_name || supplier.name}</h3>
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

        // Debug log pentru fiecare comandă
        console.log('Processing order:', order.id, 'Structure:', order);

        // Încearcă să obții numele produsului din noile coloane sau din items array (pentru compatibilitate)
        let productName = 'Unknown Product';
        let quantity = 1;
        let unitPrice = totalAmount;

        if (order.product_name) {
            // Folosește noua structură
            productName = order.product_name;
            quantity = order.product_quantity || 1;
            unitPrice = parseFloat(order.product_unit_price || totalAmount);
            console.log('Using new structure:', productName, quantity, unitPrice);
        } else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            // Folosește vechea structură pentru compatibilitate
            const firstItem = order.items[0];
            console.log('First item from items array:', firstItem);

            // Încearcă toate câmpurile posibile pentru numele produsului
            productName = firstItem.name ||
                firstItem.part_name ||
                firstItem.item_name ||
                firstItem.description ||
                firstItem.product_name ||
                `Product #${order.id}`;

            quantity = firstItem.quantity || firstItem.qty || 1;
            unitPrice = parseFloat(firstItem.unit_price || firstItem.unitPrice || firstItem.price || 0);

            console.log('Using items structure:', {
                name: firstItem.name,
                part_name: firstItem.part_name,
                resolved_name: productName,
                quantity: quantity,
                unitPrice: unitPrice
            });
        } else {
            // Fallback - folosește ID-ul comenzii ca nume
            productName = `Order Items #${order.id}`;
            quantity = 1;
            unitPrice = totalAmount;
            console.log('Using fallback structure for order:', order.id);
        }

        return `
        <div class="order-card ${order.status}">
            <div class="order-header">
                <h3 class="order-number">ORDER #${order.id}</h3>
                <span class="order-status status-${order.status}">${order.status ? order.status.toUpperCase() : 'ORDERED'}</span>
            </div>
            <p class="order-supplier">Supplier: ${order.supplier_name || order.supplierName || 'N/A'}</p>
            <div class="order-items">
                <div class="order-item-display">
                    <span>${productName} (${quantity}x)</span>
                    <span>RON ${(quantity * unitPrice).toFixed(2)}</span>
                </div>
            </div>
            <div class="order-total">Total: RON ${totalAmount.toFixed(2)}</div>
            <div class="order-date">Ordered: ${formatDate(order.order_date || order.orderDate)}</div>
            ${order.expected_delivery_date || order.estimatedDelivery ? `<div class="order-date">Est. Delivery: ${formatDate(order.expected_delivery_date || order.estimatedDelivery)}</div>` : ''}
            ${order.actual_delivery_date ? `<div class="order-date">Actual Delivery: ${formatDate(order.actual_delivery_date)}</div>` : ''}
            <div class="order-actions">
                ${order.status !== 'delivered' ? `<button class="btn btn-sm primary-btn" onclick="updateOrderStatus('${order.id}')">Update Status</button>` : ''}
            </div>
        </div>
        `;
    }).join('');
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
// Funcție pentru actualizarea prețului când se selectează o parte
function updatePartPrice(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const price = selectedOption.getAttribute('data-price');

    const orderItem = selectElement.closest('.order-item');
    const priceInput = orderItem.querySelector('.unit-price');

    if (price && priceInput) {
        priceInput.value = parseFloat(price).toFixed(2);
        calculateOrderTotal();
    }
}

function openOrderModal() {
    const modal = document.getElementById('orderModal');
    const supplierSelect = document.getElementById('orderSupplier');

    if (!modal || !supplierSelect) {
        return;
    }

    // Verifică dacă parts sunt încărcate
    if (!parts || parts.length === 0) {
        showNotification('Parts are still loading. Please wait...', 'warning');
        // Încearcă să reîncarchezi parts-urile
        loadPartsFromAPI().then(() => {
            // Reîncearcă să deschizi modalul după încărcare
            if (parts && parts.length > 0) {
                openOrderModal();
            } else {
                showNotification('No parts available. Please add parts first.', 'error');
            }
        });
        return;
    }

    // Populate supplier dropdown
    supplierSelect.innerHTML = '<option value="">Select Supplier</option>' +
        suppliers.map(supplier => `<option value="${supplier.id}">${supplier.company_name || supplier.name}</option>`).join('');

    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.reset();
    }

    // Structură nouă cu dropdown pentru parts
    const orderItems = document.getElementById('orderItems');
    if (orderItems) {
        orderItems.innerHTML = createOrderItemHTML();
    }

    calculateOrderTotal();
    modal.style.display = 'flex';
}

// Funcție helper pentru crearea HTML-ului unui order item
function createOrderItemHTML() {
    // Verifică dacă parts sunt încărcate
    if (!parts || parts.length === 0) {
        console.warn('Parts not loaded yet or empty');
        return `
            <div class="order-item">
                <div class="form-row">
                    <div class="form-group">
                        <select class="part-select" required onchange="updatePartPrice(this)">
                            <option value="">Loading parts...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <input type="number" placeholder="Quantity" class="quantity" min="1" required onchange="calculateOrderTotal()">
                    </div>
                    <div class="form-group">
                        <input type="number" placeholder="Unit Price" class="unit-price" step="0.01" min="0" required readonly>
                    </div>
                    <button type="button" class="btn danger-btn" onclick="removeOrderItem(this)">Remove</button>
                </div>
            </div>
        `;
    }

    const partsOptions = parts.map(part =>
        `<option value="${part.id}" data-price="${part.price}">${part.name} - RON ${parseFloat(part.price).toFixed(2)}</option>`
    ).join('');

    return `
        <div class="order-item">
            <div class="form-row">
                <div class="form-group">
                    <select class="part-select" required onchange="updatePartPrice(this)">
                        <option value="">Select Part</option>
                        ${partsOptions}
                    </select>
                </div>
                <div class="form-group">
                    <input type="number" placeholder="Quantity" class="quantity" min="1" required onchange="calculateOrderTotal()">
                </div>
                <div class="form-group">
                    <input type="number" placeholder="Unit Price" class="unit-price" step="0.01" min="0" required readonly>
                </div>
                <button type="button" class="btn danger-btn" onclick="removeOrderItem(this)">Remove</button>
            </div>
        </div>
    `;
}
function createOrderItemHTML() {
    const partsOptions = parts.map(part =>
        `<option value="${part.id}" data-price="${part.price}">${part.name} - RON ${parseFloat(part.price).toFixed(2)}</option>`
    ).join('');

    return `
        <div class="order-item">
            <div class="form-row">
                <div class="form-group">
                    <select class="part-select" required onchange="updatePartPrice(this)">
                        <option value="">Select Part</option>
                        ${partsOptions}
                    </select>
                </div>
                <div class="form-group">
                    <input type="number" placeholder="Quantity" class="quantity" min="1" required onchange="calculateOrderTotal()">
                </div>
                <div class="form-group">
                    <input type="number" placeholder="Unit Price" class="unit-price" step="0.01" min="0" required readonly>
                </div>
                <button type="button" class="btn danger-btn" onclick="removeOrderItem(this)">Remove</button>
            </div>
        </div>
    `;
}

function closeOrderModal() {
    const modal = document.getElementById('orderModal');
    if (modal) {
        modal.style.display = 'none';
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

    saveSupplierToAPI(formData);
    closeSupplierModal();
}



// Order item management
function addOrderItem() {
    const container = document.getElementById('orderItems');
    if (!container) return;

    const newItem = document.createElement('div');
    newItem.className = 'order-item';
    newItem.innerHTML = createOrderItemHTML();
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

// Order status management
function updateOrderStatus(orderId) {
    const order = orders.find(o => o.id == orderId);

    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }

    openOrderStatusModal(orderId);
}

function openOrderStatusModal(orderId) {
    const order = orders.find(o => o.id == orderId);

    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }

    const totalAmount = parseFloat(order.total_amount || order.total || 0);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'orderStatusModal';
    modal.style.display = 'flex';

    const statuses = [
        { value: 'ordered', label: 'Ordered', color: '#6c757d', description: 'Order has been placed' },
        { value: 'in_transit', label: 'In Transit', color: '#ffc107', description: 'Order is being shipped/in transit' },
        { value: 'delivered', label: 'Delivered', color: '#28a745', description: 'Order has been delivered' },
        { value: 'cancelled', label: 'Cancelled', color: '#dc3545', description: 'Order has been cancelled' }
    ];

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Update Order Status</h2>
                <span class="close-modal" onclick="closeOrderStatusModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="order-info">
                    <h3>Order #${order.id}</h3>
                    <p><strong>Supplier:</strong> ${order.supplier_name || order.supplierName || 'N/A'}</p>
                    <p><strong>Current Status:</strong> <span class="status-badge status-${order.status}">${(order.status || 'ordered').toUpperCase()}</span></p>
                    <p><strong>Total:</strong> RON ${totalAmount.toFixed(2)}</p>
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
                                        <div class="status-description">${status.description}</div>
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

    // Add form submit handler
    document.getElementById('orderStatusForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateOrderStatusFromModal();
    });

    // Close on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeOrderStatusModal();
        }
    });
}

function selectOrderStatus(status) {
    // Remove previous selection
    document.querySelectorAll('#orderStatusModal .status-option').forEach(option => {
        option.classList.remove('selected');
    });

    // Select current option by status value
    const currentOption = document.querySelector(`#orderStatusModal .status-option[onclick*="${status}"]`);
    if (currentOption) {
        currentOption.classList.add('selected');
    }

    // Store selected status
    document.getElementById('orderStatusForm').setAttribute('data-selected-status', status);

    // Enable update button
    document.getElementById('updateStatusBtn').disabled = false;

    // Show delivery date field for delivered status
    const deliveryDateGroup = document.getElementById('deliveryDateGroup');
    if (status === 'delivered') {
        deliveryDateGroup.style.display = 'block';
    } else {
        deliveryDateGroup.style.display = 'none';
    }
}

async function updateOrderStatusFromModal() {
    const orderId = document.getElementById('statusOrderId').value;
    const selectedStatus = document.getElementById('orderStatusForm').getAttribute('data-selected-status');
    const actualDeliveryDate = document.getElementById('actualDeliveryDate').value;
    const notes = document.getElementById('statusNotes').value;

    if (!selectedStatus) {
        showNotification('Please select a new status', 'error');
        return;
    }

    try {
        const updateBtn = document.getElementById('updateStatusBtn');
        updateBtn.disabled = true;
        updateBtn.textContent = 'Updating...';

        await updateOrderStatusAPI(orderId, selectedStatus, actualDeliveryDate, notes);
        closeOrderStatusModal();

    } catch (error) {
        showNotification('Error updating order status: ' + error.message, 'error');

        const updateBtn = document.getElementById('updateStatusBtn');
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update Status';
    }
}

function closeOrderStatusModal() {
    const modal = document.getElementById('orderStatusModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.removeChild(modal);
    }
}

// Action functions
function editSupplier(id) {
    openSupplierModal(id);
}

function deleteSupplier(id) {
    if (confirm('Are you sure you want to delete this supplier?')) {
        deleteSupplierFromAPI(id);
    }
}

function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }

    const orderTotal = parseFloat(order.total_amount || order.total || 0);
    const orderDate = formatDate(order.order_date || order.orderDate);
    const supplierName = order.supplier_name || order.supplierName || 'Unknown Supplier';

    let productDetails = '';

    console.log('Viewing order details for:', order.id, order);

    if (order.product_name) {
        // Folosește noua structură
        const productName = order.product_name;
        const quantity = order.product_quantity || 1;
        const unitPrice = parseFloat(order.product_unit_price || orderTotal);

        productDetails = `Product: ${productName}
Quantity: ${quantity}
Unit Price: RON ${unitPrice.toFixed(2)}
Line Total: RON ${(quantity * unitPrice).toFixed(2)}`;
    } else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        // Folosește vechea structură pentru compatibilitate
        productDetails = 'Products:\n' + order.items.map((item, index) => {


            const name = item.name ||
                item.part_name ||
                item.item_name ||
                item.description ||
                item.product_name ||
                `Item #${index + 1}`;

            const qty = item.quantity || item.qty || 1;
            const price = parseFloat(item.unit_price || item.unitPrice || item.price || 0);

            console.log(`Resolved item ${index}:`, { name, qty, price });

            return `• ${name} (${qty}x) - RON ${(qty * price).toFixed(2)}`;
        }).join('\n');
    } else {
        productDetails = 'Product details not available';
    }

    const details = `Order Details:

Order ID: ${order.id}
Supplier: ${supplierName}
Status: ${(order.status || 'ordered').toUpperCase()}
Total: RON ${orderTotal.toFixed(2)}
Order Date: ${orderDate}
${order.expected_delivery_date ? `Expected Delivery: ${formatDate(order.expected_delivery_date)}` : ''}
${order.actual_delivery_date ? `Actual Delivery: ${formatDate(order.actual_delivery_date)}` : ''}

${productDetails}

${order.notes ? `Notes: ${order.notes}` : ''}`;

    alert(details);
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
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

function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        window.location.href = '/homepage';
    }
}

// Initialize data
async function initializeData() {
    await loadSuppliersFromAPI();
    await loadPartsFromAPI();
    await loadOrdersFromAPI();
}