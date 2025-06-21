class OrderManager {
    constructor() {
        this.suppliers = [];
        this.orders = [];
        this.parts = [];
        this.token = localStorage.getItem('token');
    }

    init() {
        if (!this.checkAuthentication()) return;
        this.setupEventListeners();
        this.initializeData();
    }

    checkAuthentication() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!this.token) {
            alert('You need to login first');
            window.location.href = '/login';
            return false;
        }
        if (user.role !== 'admin' && user.role !== 'manager') {
            alert('Access denied. Admin or manager role required.');
            window.location.href = '/homepage';
            return false;
        }
        return true;
    }

    setupEventListeners() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        const orderForm = document.getElementById('orderForm');
        if (orderForm) {
            orderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveOrder();
            });
        }

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    async initializeData() {
        await Promise.all([
            this.loadSuppliersFromAPI(),
            this.loadPartsFromAPI(),
            this.loadOrdersFromAPI()
        ]);
        this.checkForPreselectedPart();
    }

    async loadSuppliersFromAPI() {
        try {
            const response = await fetch('/api/suppliers', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            const result = await response.json();
            if (result.success) {
                this.suppliers = result.data;
            }
        } catch (error) {
            this.showNotification('Error loading suppliers: ' + error.message, 'error');
        }
    }

    async loadPartsFromAPI() {
        try {
            const response = await fetch('/api/parts', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            const result = await response.json();
            if (result.success) {
                this.parts = result.data;
            }
        } catch (error) {
            this.showNotification('Error loading parts: ' + error.message, 'error');
            this.parts = [];
        }
    }

    async loadOrdersFromAPI() {
        try {
            this.showLoading('orders-list');
            const response = await fetch('/api/orders', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            const result = await response.json();
            if (result.success) {
                this.orders = result.data;
                this.loadOrders();
            }
        } catch (error) {
            this.showNotification('Error loading orders: ' + error.message, 'error');
            this.hideLoading('orders-list');
        }
    }

    async saveOrderToAPI(orderData) {
        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            const result = await response.json();
            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadOrdersFromAPI();
            } else {
                throw new Error(result.message || 'Failed to save order');
            }
        } catch (error) {
            this.showNotification('Error saving order: ' + error.message, 'error');
        }
    }

    async updateOrderStatusAPI(orderId, status, actualDeliveryDate = null) {
        try {
            const body = { status: status };
            if (actualDeliveryDate) {
                body.actual_delivery_date = actualDeliveryDate;
            }

            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            const result = await response.json();
            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadOrdersFromAPI();
            } else {
                throw new Error(result.message || 'Failed to update order status');
            }
        } catch (error) {
            this.showNotification('Error updating order status: ' + error.message, 'error');
        }
    }

    saveOrder() {
        const supplierIdElement = document.getElementById('orderSupplier');

        if (!supplierIdElement) {
            this.showNotification('Order form elements not found', 'error');
            return;
        }

        const supplierId = supplierIdElement.value;
        if (!supplierId) {
            this.showNotification('Please select a supplier', 'error');
            return;
        }

        const supplier = this.suppliers.find(s => s.id === parseInt(supplierId));

        const orderItems = [];
        document.querySelectorAll('.order-item').forEach(item => {
            const partSelect = item.querySelector('.part-select');
            const quantity = parseInt(item.querySelector('.quantity')?.value);
            const unitPrice = parseFloat(item.querySelector('.unit-price')?.value);

            if (partSelect?.value && quantity && unitPrice) {
                const selectedPart = this.parts.find(p => p.id === parseInt(partSelect.value));
                if (selectedPart) {
                    orderItems.push({
                        name: selectedPart.name,
                        part_id: selectedPart.id,
                        quantity,
                        unit_price: unitPrice
                    });
                }
            }
        });

        if (orderItems.length === 0) {
            this.showNotification('Please add at least one order item', 'error');
            return;
        }

        const expectedDelivery = new Date();
        expectedDelivery.setDate(expectedDelivery.getDate() + (supplier?.delivery_time_days || 7));

        const orderData = {
            supplier_id: parseInt(supplierId),
            items: orderItems,
            expected_delivery_date: expectedDelivery.toISOString().split('T')[0]
        };

        this.saveOrderToAPI(orderData);
        this.closeOrderModal();
    }

    loadOrders() {
        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        if (this.orders.length === 0) {
            ordersList.innerHTML = '<div class="empty-state"><h3>No orders found</h3><p>No purchase orders have been placed yet</p></div>';
            return;
        }

        ordersList.innerHTML = this.orders.map(order => {
            const totalAmount = parseFloat(order.total_amount || 0);

            let productName = 'Order Items';
            let quantity = 1;

            for (const key of Object.keys(order)) {
                const value = order[key];
                if (typeof value === 'string' && value.length > 2 &&
                    !['status', 'notes'].includes(key) &&
                    !key.includes('date') && !key.includes('id') &&
                    !key.includes('supplier') && !key.includes('amount')) {
                    productName = value;
                    break;
                }
            }

            for (const key of Object.keys(order)) {
                const value = order[key];
                if (typeof value === 'number' && value > 0 && value < 1000 && !key.includes('amount') && !key.includes('id')) {
                    quantity = value;
                    break;
                }
            }

            const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount;

            return `
                <div class="order-card ${order.status}">
                    <div class="order-header">
                        <h3 class="order-number">ORDER #${order.id}</h3>
                        <span class="order-status status-${order.status}">${(order.status || 'ordered').toUpperCase()}</span>
                    </div>
                    <p class="order-supplier">Supplier: ${order.supplier_name || 'N/A'}</p>
                    <div class="order-items">
                        <div class="order-item-display">
                            <span>${productName} (${quantity}x)</span>
                            <span>RON ${(quantity * unitPrice).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="order-total">Total: RON ${totalAmount.toFixed(2)}</div>
                    <div class="order-date">Ordered: ${this.formatDate(order.order_date)}</div>
                    ${order.expected_delivery_date ? `<div class="order-date">Delivery: ${this.formatDate(order.expected_delivery_date)}</div>` : ''}
                    <div class="order-actions">
                        ${order.status !== 'delivered' ? `<button class="btn btn-sm primary-btn" onclick="orderManager.updateOrderStatus('${order.id}')">Update Status</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    openOrderModal() {
        const modal = document.getElementById('orderModal');
        const supplierSelect = document.getElementById('orderSupplier');

        if (!modal || !supplierSelect) return;

        if (!this.parts?.length) {
            this.showNotification('No parts available. Please add parts first.', 'error');
            return;
        }

        supplierSelect.innerHTML = '<option value="">Select Supplier</option>' +
            this.suppliers.map(supplier => `<option value="${supplier.id}">${supplier.company_name || supplier.name}</option>`).join('');

        const orderForm = document.getElementById('orderForm');
        if (orderForm) orderForm.reset();

        const orderItems = document.getElementById('orderItems');
        if (orderItems) {
            orderItems.innerHTML = this.createOrderItemHTML();
        }

        this.calculateOrderTotal();
        modal.style.display = 'flex';
    }

    createOrderItemHTML() {
        if (!this.parts?.length) {
            return `<div class="order-item"><p>No parts available</p></div>`;
        }

        const partsOptions = this.parts.map(part =>
            `<option value="${part.id}" data-price="${part.price}">${part.name} - RON ${parseFloat(part.price).toFixed(2)}</option>`
        ).join('');

        return `
            <div class="order-item">
                <div class="form-row">
                    <div class="form-group">
                        <select class="part-select" required onchange="orderManager.updatePartPrice(this)">
                            <option value="">Select Part</option>
                            ${partsOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <input type="number" placeholder="Quantity" class="quantity" min="1" required onchange="orderManager.calculateOrderTotal()">
                    </div>
                    <div class="form-group">
                        <input type="number" placeholder="Unit Price" class="unit-price" step="0.01" min="0" required readonly>
                    </div>
                    <button type="button" class="btn danger-btn" onclick="orderManager.removeOrderItem(this)">Remove</button>
                </div>
            </div>
        `;
    }

    closeOrderModal() {
        const modal = document.getElementById('orderModal');
        if (modal) modal.style.display = 'none';
    }

    addOrderItem() {
        const container = document.getElementById('orderItems');
        if (!container) return;

        const newItem = document.createElement('div');
        newItem.className = 'order-item';
        newItem.innerHTML = this.createOrderItemHTML();
        container.appendChild(newItem);
    }

    removeOrderItem(button) {
        const orderItem = button.closest('.order-item');
        if (document.querySelectorAll('.order-item').length > 1) {
            orderItem.remove();
            this.calculateOrderTotal();
        }
    }

    calculateOrderTotal() {
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

    updatePartPrice(selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const price = selectedOption.getAttribute('data-price');
        const orderItem = selectElement.closest('.order-item');
        const priceInput = orderItem.querySelector('.unit-price');

        if (price && priceInput) {
            priceInput.value = parseFloat(price).toFixed(2);
            this.calculateOrderTotal();
        }
    }

    updateOrderStatus(orderId) {
        const order = this.orders.find(o => o.id == orderId);
        if (!order) {
            this.showNotification('Order not found', 'error');
            return;
        }
        this.openOrderStatusModal(orderId);
    }

    openOrderStatusModal(orderId) {
        const order = this.orders.find(o => o.id == orderId);
        if (!order) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'orderStatusModal';
        modal.style.display = 'flex';

        const statuses = [
            { value: 'ordered', label: 'Ordered' },
            { value: 'in_transit', label: 'In Transit' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' }
        ];

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Update Order Status</h2>
                    <span class="close-modal" onclick="orderManager.closeOrderStatusModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="order-info">
                        <p><strong>Order #${order.id}</strong></p>
                        <p>Supplier: ${order.supplier_name || 'N/A'}</p>
                        <p>Current: ${(order.status || 'ordered').toUpperCase()}</p>
                    </div>
                    
                    <form id="orderStatusForm">
                        <input type="hidden" id="statusOrderId" value="${order.id}">
                        
                        <div class="form-group">
                            <label for="newStatus">New Status:</label>
                            <select id="newStatus" class="form-control" required>
                                <option value="">Select new status</option>
                                ${statuses.filter(s => s.value !== order.status).map(status =>
            `<option value="${status.value}">${status.label}</option>`
        ).join('')}
                            </select>
                        </div>

                        <div class="form-group" id="deliveryDateGroup" style="display: none;">
                            <label for="actualDeliveryDate">Delivery Date:</label>
                            <input type="date" id="actualDeliveryDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn secondary-btn" onclick="orderManager.closeOrderStatusModal()">Cancel</button>
                            <button type="submit" class="btn primary-btn">Update</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('newStatus').addEventListener('change', (e) => {
            const deliveryDateGroup = document.getElementById('deliveryDateGroup');
            deliveryDateGroup.style.display = e.target.value === 'delivered' ? 'block' : 'none';
        });

        document.getElementById('orderStatusForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateOrderStatusFromModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeOrderStatusModal();
        });
    }

    async updateOrderStatusFromModal() {
        const orderId = document.getElementById('statusOrderId')?.value;
        const selectedStatus = document.getElementById('newStatus')?.value;
        const actualDeliveryDateEl = document.getElementById('actualDeliveryDate');
        const actualDeliveryDate = actualDeliveryDateEl && selectedStatus === 'delivered' ? actualDeliveryDateEl.value : null;

        if (!selectedStatus) {
            this.showNotification('Please select a new status', 'error');
            return;
        }

        try {
            await this.updateOrderStatusAPI(orderId, selectedStatus, actualDeliveryDate);
            this.closeOrderStatusModal();
        } catch (error) {
            this.showNotification('Error updating order status: ' + error.message, 'error');
        }
    }

    closeOrderStatusModal() {
        const modal = document.getElementById('orderStatusModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.removeChild(modal);
        }
    }

    checkForPreselectedPart() {
        const urlParams = new URLSearchParams(window.location.search);
        const preselectedPartData = localStorage.getItem('preselectedPart');

        if (urlParams.get('action') === 'new-order' && preselectedPartData) {
            try {
                const partData = JSON.parse(preselectedPartData);
                localStorage.removeItem('preselectedPart');
                this.showNotification(`Creating order for: ${partData.name}`, 'info');
                setTimeout(() => this.openOrderModalWithPreselectedPart(partData), 500);
            } catch (error) {
                localStorage.removeItem('preselectedPart');
            }
        }
    }

    openOrderModalWithPreselectedPart(partData) {
        const modal = document.getElementById('orderModal');
        const supplierSelect = document.getElementById('orderSupplier');

        if (!modal || !supplierSelect || !this.parts?.length) return;

        supplierSelect.innerHTML = '<option value="">Select Supplier</option>' +
            this.suppliers.map(supplier => `<option value="${supplier.id}">${supplier.company_name || supplier.name}</option>`).join('');

        const orderForm = document.getElementById('orderForm');
        if (orderForm) orderForm.reset();

        const orderItems = document.getElementById('orderItems');
        if (orderItems) {
            const partsOptions = this.parts.map(part => {
                const isSelected = part.id === partData.id ? 'selected' : '';
                return `<option value="${part.id}" data-price="${part.price}" ${isSelected}>${part.name} - RON ${parseFloat(part.price).toFixed(2)}</option>`;
            }).join('');

            const suggestedQuantity = Math.max(1, (partData.minimumStockLevel || 10) - (partData.stockQuantity || 0));
            const preselectedPrice = parseFloat(partData.price || 0).toFixed(2);

            orderItems.innerHTML = `
                <div class="order-item">
                    <div class="form-row">
                        <div class="form-group">
                            <select class="part-select" required onchange="orderManager.updatePartPrice(this)">
                                <option value="">Select Part</option>
                                ${partsOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <input type="number" placeholder="Quantity" class="quantity" min="1" value="${suggestedQuantity}" required onchange="orderManager.calculateOrderTotal()">
                        </div>
                        <div class="form-group">
                            <input type="number" placeholder="Unit Price" class="unit-price" step="0.01" min="0" value="${preselectedPrice}" required readonly>
                        </div>
                        <button type="button" class="btn danger-btn" onclick="orderManager.removeOrderItem(this)">Remove</button>
                    </div>
                </div>
            `;
        }

        this.calculateOrderTotal();
        modal.style.display = 'flex';
        this.showNotification(`Part "${partData.name}" has been preselected for this order`, 'success');
    }

    formatDate(dateString) {
        return dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.innerHTML = '<div class="loading">Loading...</div>';
    }

    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.innerHTML = '<div class="empty-state"><h3>Failed to load data</h3><p>Please try refreshing the page</p></div>';
    }

    handleLogout() {
        if (confirm('Are you sure you want to log out?')) {
            window.location.href = '/homepage';
        }
    }

    handleAuthError() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        alert('Session expired. Please login again.');
        window.location.href = '/login';
    }
}

// Initialize
const orderManager = new OrderManager();
document.addEventListener('DOMContentLoaded', () => orderManager.init());

// Global functions for HTML onclick events
function openOrderModal() { orderManager.openOrderModal(); }
function closeOrderModal() { orderManager.closeOrderModal(); }
function addOrderItem() { orderManager.addOrderItem(); }
function removeOrderItem(button) { orderManager.removeOrderItem(button); }
function saveOrder() { orderManager.saveOrder(); }
function updatePartPrice(selectElement) { orderManager.updatePartPrice(selectElement); }
function calculateOrderTotal() { orderManager.calculateOrderTotal(); }
function updateOrderStatus(orderId) { orderManager.updateOrderStatus(orderId); }