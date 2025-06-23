//aici ne ocupam acum doar sa vedem ce orders avem si sa putem adauga unele noi (in admin) in accountant facem partea de get suppliers
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
            window.location.href = '/login';
            return false;
        }
        if (user.role !== 'admin') {
            window.location.href = '/homepage';
            return false;
        }
        return true;
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    sanitizeObject(obj) {
        if (obj === null || typeof obj !== 'object') {
            return typeof obj === 'string' ? this.sanitizeInput(obj) : obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = this.sanitizeInput(key);
            sanitized[sanitizedKey] = this.sanitizeObject(value);
        }

        return sanitized;
    }

    createSafeElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = this.sanitizeInput(className);
        }
        if (textContent) {
            element.textContent = String(textContent);
        }
        return element;
    }

    safeSetText(element, text) {
        if (element && text !== null && text !== undefined) {
            element.textContent = String(text);
        }
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
            this.suppliers = result.data.map(supplier => this.sanitizeObject(supplier));
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
                this.parts = result.data.map(part => this.sanitizeObject(part));
            }
        } catch (error) {
            this.parts = [];
        }
    }

    async loadOrdersFromAPI() {
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
            this.orders = result.data.map(order => this.sanitizeObject(order));
            this.loadOrders();
        }
    }

    async saveOrderToAPI(orderData) {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.sanitizeObject(orderData))
        });

        if (response.status === 401) {
            this.handleAuthError();
            return;
        }

        const result = await response.json();
        if (result.success) {
            await this.loadOrdersFromAPI();
        } else {
            throw new Error(result.message || 'Failed to save order');
        }
    }

    async updateOrderStatusAPI(orderId, status, actualDeliveryDate = null) {
        const body = {status: this.sanitizeInput(status)};
        if (actualDeliveryDate) {
            body.actual_delivery_date = this.sanitizeInput(actualDeliveryDate);
        }

        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
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
            await this.loadOrdersFromAPI();
        } else {
            throw new Error(result.message || 'Failed to update order status');
        }
    }

    saveOrder() {
        const supplierIdElement = document.getElementById('orderSupplier');

        if (!supplierIdElement) {
            return;
        }

        const supplierId = supplierIdElement.value;
        if (!supplierId) {
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

        // Clear existing content safely
        while (ordersList.firstChild) {
            ordersList.removeChild(ordersList.firstChild);
        }

        if (this.orders.length === 0) {
            const emptyState = this.createSafeElement('div', 'empty-state');
            const h3 = this.createSafeElement('h3', '', 'No orders found');
            const p = this.createSafeElement('p', '', 'No purchase orders have been placed yet');
            emptyState.appendChild(h3);
            emptyState.appendChild(p);
            ordersList.appendChild(emptyState);
            return;
        }

        this.orders.forEach(order => {
            const orderCard = this.createOrderCard(order);
            ordersList.appendChild(orderCard);
        });
    }

    createOrderCard(order) {
        const totalAmount = parseFloat(order.total_amount || 0);

        let productName = 'Order Items';
        let quantity = 1;

        // Find product name and quantity safely
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

        const orderCard = this.createSafeElement('div', `order-card ${order.status || ''}`);

        // Order header
        const orderHeader = this.createSafeElement('div', 'order-header');
        const orderNumber = this.createSafeElement('h3', 'order-number', `ORDER #${order.id || ''}`);
        const orderStatus = this.createSafeElement('span', `order-status status-${order.status || 'ordered'}`, (order.status || 'ordered').toUpperCase());

        orderHeader.appendChild(orderNumber);
        orderHeader.appendChild(orderStatus);

        // Order supplier
        const orderSupplier = this.createSafeElement('p', 'order-supplier', `Supplier: ${order.supplier_name || 'N/A'}`);

        // Order items
        const orderItems = this.createSafeElement('div', 'order-items');
        const orderItemDisplay = this.createSafeElement('div', 'order-item-display');

        const itemName = this.createSafeElement('span', '', `${productName} (${quantity}x)`);
        const itemPrice = this.createSafeElement('span', '', `RON ${(quantity * unitPrice).toFixed(2)}`);

        orderItemDisplay.appendChild(itemName);
        orderItemDisplay.appendChild(itemPrice);
        orderItems.appendChild(orderItemDisplay);

        // Order total
        const orderTotal = this.createSafeElement('div', 'order-total', `Total: RON ${totalAmount.toFixed(2)}`);

        // Order dates
        const orderDate = this.createSafeElement('div', 'order-date', `Ordered: ${this.formatDate(order.order_date)}`);

        let deliveryDate = null;
        if (order.expected_delivery_date) {
            deliveryDate = this.createSafeElement('div', 'order-date', `Delivery: ${this.formatDate(order.expected_delivery_date)}`);
        }

        // Order actions
        const orderActions = this.createSafeElement('div', 'order-actions');

        if (order.status !== 'delivered') {
            const updateBtn = this.createSafeElement('button', 'btn btn-sm primary-btn', 'Update Status');
            updateBtn.onclick = () => this.updateOrderStatus(order.id);
            orderActions.appendChild(updateBtn);
        }

        // Assemble the card
        orderCard.appendChild(orderHeader);
        orderCard.appendChild(orderSupplier);
        orderCard.appendChild(orderItems);
        orderCard.appendChild(orderTotal);
        orderCard.appendChild(orderDate);
        if (deliveryDate) {
            orderCard.appendChild(deliveryDate);
        }
        orderCard.appendChild(orderActions);

        return orderCard;
    }

    openOrderModal() {
        const modal = document.getElementById('orderModal');
        const supplierSelect = document.getElementById('orderSupplier');

        if (!modal || !supplierSelect) return;

        if (!this.parts?.length) {
            return;
        }

        // Clear and populate supplier select safely
        while (supplierSelect.firstChild) {
            supplierSelect.removeChild(supplierSelect.firstChild);
        }

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        this.safeSetText(defaultOption, 'Select Supplier');
        supplierSelect.appendChild(defaultOption);

        this.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = String(supplier.id);
            this.safeSetText(option, supplier.company_name || supplier.name || '');
            supplierSelect.appendChild(option);
        });

        const orderForm = document.getElementById('orderForm');
        if (orderForm) orderForm.reset();

        const orderItems = document.getElementById('orderItems');
        if (orderItems) {
            this.populateOrderItems(orderItems);
        }

        this.calculateOrderTotal();
        modal.style.display = 'flex';
    }

    populateOrderItems(container) {
        // Clear existing content safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (!this.parts?.length) {
            const orderItem = this.createSafeElement('div', 'order-item');
            const p = this.createSafeElement('p', '', 'No parts available');
            orderItem.appendChild(p);
            container.appendChild(orderItem);
            return;
        }

        const orderItem = this.createOrderItemElement();
        container.appendChild(orderItem);
    }

    createOrderItemElement() {
        const orderItem = this.createSafeElement('div', 'order-item');
        const formRow = this.createSafeElement('div', 'form-row');

        // Part select group
        const partGroup = this.createSafeElement('div', 'form-group');
        const partSelect = document.createElement('select');
        partSelect.className = 'part-select';
        partSelect.required = true;
        partSelect.onchange = () => this.updatePartPrice(partSelect);

        const defaultPartOption = document.createElement('option');
        defaultPartOption.value = '';
        this.safeSetText(defaultPartOption, 'Select Part');
        partSelect.appendChild(defaultPartOption);

        this.parts.forEach(part => {
            const option = document.createElement('option');
            option.value = String(part.id);
            option.setAttribute('data-price', String(part.price));
            this.safeSetText(option, `${part.name} - RON ${parseFloat(part.price).toFixed(2)}`);
            partSelect.appendChild(option);
        });

        partGroup.appendChild(partSelect);

        // Quantity group
        const quantityGroup = this.createSafeElement('div', 'form-group');
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.placeholder = 'Quantity';
        quantityInput.className = 'quantity';
        quantityInput.min = '1';
        quantityInput.required = true;
        quantityInput.onchange = () => this.calculateOrderTotal();
        quantityGroup.appendChild(quantityInput);

        // Unit price group
        const priceGroup = this.createSafeElement('div', 'form-group');
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.placeholder = 'Unit Price';
        priceInput.className = 'unit-price';
        priceInput.step = '0.01';
        priceInput.min = '0';
        priceInput.required = true;
        priceInput.readOnly = true;
        priceGroup.appendChild(priceInput);

        // Remove button
        const removeBtn = this.createSafeElement('button', 'btn danger-btn', 'Remove');
        removeBtn.type = 'button';
        removeBtn.onclick = () => this.removeOrderItem(removeBtn);

        formRow.appendChild(partGroup);
        formRow.appendChild(quantityGroup);
        formRow.appendChild(priceGroup);
        formRow.appendChild(removeBtn);
        orderItem.appendChild(formRow);

        return orderItem;
    }

    closeOrderModal() {
        const modal = document.getElementById('orderModal');
        if (modal) modal.style.display = 'none';
    }

    addOrderItem() {
        const container = document.getElementById('orderItems');
        if (!container) return;

        const newItem = this.createOrderItemElement();
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
            this.safeSetText(totalElement, total.toFixed(2));
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
            return;
        }
        this.openOrderStatusModal(orderId);
    }

    openOrderStatusModal(orderId) {
        const order = this.orders.find(o => o.id == orderId);
        if (!order) return;

        const modal = this.createSafeElement('div', 'modal');
        modal.id = 'orderStatusModal';
        modal.style.display = 'flex';

        const modalContent = this.createSafeElement('div', 'modal-content');

        // Modal header
        const modalHeader = this.createSafeElement('div', 'modal-header');
        const h2 = this.createSafeElement('h2', '', 'Update Order Status');
        const closeBtn = this.createSafeElement('span', 'close-modal', '×');
        closeBtn.onclick = () => this.closeOrderStatusModal();

        modalHeader.appendChild(h2);
        modalHeader.appendChild(closeBtn);

        // Modal body
        const modalBody = this.createSafeElement('div', 'modal-body');

        // Order info
        const orderInfo = this.createSafeElement('div', 'order-info');
        const orderIdP = this.createSafeElement('p');
        const orderIdStrong = this.createSafeElement('strong', '', `Order #${order.id}`);
        orderIdP.appendChild(orderIdStrong);

        const supplierP = this.createSafeElement('p', '', `Supplier: ${order.supplier_name || 'N/A'}`);
        const currentP = this.createSafeElement('p', '', `Current: ${(order.status || 'ordered').toUpperCase()}`);

        orderInfo.appendChild(orderIdP);
        orderInfo.appendChild(supplierP);
        orderInfo.appendChild(currentP);

        // Form
        const form = document.createElement('form');
        form.id = 'orderStatusForm';

        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'statusOrderId';
        hiddenInput.value = String(order.id);

        // Status select group
        const statusGroup = this.createSafeElement('div', 'form-group');
        const statusLabel = this.createSafeElement('label', '', 'New Status:');
        statusLabel.setAttribute('for', 'newStatus');

        const statusSelect = document.createElement('select');
        statusSelect.id = 'newStatus';
        statusSelect.className = 'form-control';
        statusSelect.required = true;

        const defaultStatusOption = document.createElement('option');
        defaultStatusOption.value = '';
        this.safeSetText(defaultStatusOption, 'Select new status');
        statusSelect.appendChild(defaultStatusOption);

        const statuses = [
            {value: 'ordered', label: 'Ordered'},
            {value: 'in_transit', label: 'In Transit'},
            {value: 'delivered', label: 'Delivered'},
            {value: 'cancelled', label: 'Cancelled'}
        ];

        statuses.filter(s => s.value !== order.status).forEach(status => {
            const option = document.createElement('option');
            option.value = status.value;
            this.safeSetText(option, status.label);
            statusSelect.appendChild(option);
        });

        statusGroup.appendChild(statusLabel);
        statusGroup.appendChild(statusSelect);

        // Delivery date group (initially hidden)
        const deliveryDateGroup = this.createSafeElement('div', 'form-group');
        deliveryDateGroup.id = 'deliveryDateGroup';
        deliveryDateGroup.style.display = 'none';

        const deliveryLabel = this.createSafeElement('label', '', 'Delivery Date:');
        deliveryLabel.setAttribute('for', 'actualDeliveryDate');

        const deliveryInput = document.createElement('input');
        deliveryInput.type = 'date';
        deliveryInput.id = 'actualDeliveryDate';
        deliveryInput.className = 'form-control';
        deliveryInput.value = new Date().toISOString().split('T')[0];

        deliveryDateGroup.appendChild(deliveryLabel);
        deliveryDateGroup.appendChild(deliveryInput);

        // Form actions
        const formActions = this.createSafeElement('div', 'form-actions');
        const cancelBtn = this.createSafeElement('button', 'btn secondary-btn', 'Cancel');
        cancelBtn.type = 'button';
        cancelBtn.onclick = () => this.closeOrderStatusModal();

        const updateBtn = this.createSafeElement('button', 'btn primary-btn', 'Update');
        updateBtn.type = 'submit';

        formActions.appendChild(cancelBtn);
        formActions.appendChild(updateBtn);

        form.appendChild(hiddenInput);
        form.appendChild(statusGroup);
        form.appendChild(deliveryDateGroup);
        form.appendChild(formActions);

        modalBody.appendChild(orderInfo);
        modalBody.appendChild(form);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modal.appendChild(modalContent);

        document.body.appendChild(modal);

        // Event listeners
        statusSelect.addEventListener('change', (e) => {
            const deliveryDateGroup = document.getElementById('deliveryDateGroup');
            deliveryDateGroup.style.display = e.target.value === 'delivered' ? 'block' : 'none';
        });

        form.addEventListener('submit', (e) => {
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
            return;
        }

        await this.updateOrderStatusAPI(orderId, selectedStatus, actualDeliveryDate);
        this.closeOrderStatusModal();
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

        // Clear and populate supplier select safely
        while (supplierSelect.firstChild) {
            supplierSelect.removeChild(supplierSelect.firstChild);
        }

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        this.safeSetText(defaultOption, 'Select Supplier');
        supplierSelect.appendChild(defaultOption);

        this.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = String(supplier.id);
            this.safeSetText(option, supplier.company_name || supplier.name || '');
            supplierSelect.appendChild(option);
        });

        const orderForm = document.getElementById('orderForm');
        if (orderForm) orderForm.reset();

        const orderItems = document.getElementById('orderItems');
        if (orderItems) {
            // Clear existing content safely
            while (orderItems.firstChild) {
                orderItems.removeChild(orderItems.firstChild);
            }

            const orderItem = this.createSafeElement('div', 'order-item');
            const formRow = this.createSafeElement('div', 'form-row');

            // Part select group with preselected part
            const partGroup = this.createSafeElement('div', 'form-group');
            const partSelect = document.createElement('select');
            partSelect.className = 'part-select';
            partSelect.required = true;
            partSelect.onchange = () => this.updatePartPrice(partSelect);

            const defaultPartOption = document.createElement('option');
            defaultPartOption.value = '';
            this.safeSetText(defaultPartOption, 'Select Part');
            partSelect.appendChild(defaultPartOption);

            this.parts.forEach(part => {
                const option = document.createElement('option');
                option.value = String(part.id);
                option.setAttribute('data-price', String(part.price));
                if (part.id === partData.id) {
                    option.selected = true;
                }
                this.safeSetText(option, `${part.name} - RON ${parseFloat(part.price).toFixed(2)}`);
                partSelect.appendChild(option);
            });

            partGroup.appendChild(partSelect);

            // Quantity group with suggested quantity
            const quantityGroup = this.createSafeElement('div', 'form-group');
            const quantityInput = document.createElement('input');
            quantityInput.type = 'number';
            quantityInput.placeholder = 'Quantity';
            quantityInput.className = 'quantity';
            quantityInput.min = '1';
            quantityInput.required = true;
            quantityInput.onchange = () => this.calculateOrderTotal();

            const suggestedQuantity = Math.max(1, (partData.minimumStockLevel || 10) - (partData.stockQuantity || 0));
            quantityInput.value = String(suggestedQuantity);

            quantityGroup.appendChild(quantityInput);

            // Unit price group with preselected price
            const priceGroup = this.createSafeElement('div', 'form-group');
            const priceInput = document.createElement('input');
            priceInput.type = 'number';
            priceInput.placeholder = 'Unit Price';
            priceInput.className = 'unit-price';
            priceInput.step = '0.01';
            priceInput.min = '0';
            priceInput.required = true;
            priceInput.readOnly = true;

            const preselectedPrice = parseFloat(partData.price || 0).toFixed(2);
            priceInput.value = preselectedPrice;

            priceGroup.appendChild(priceInput);

            // Remove button
            const removeBtn = this.createSafeElement('button', 'btn danger-btn', 'Remove');
            removeBtn.type = 'button';
            removeBtn.onclick = () => this.removeOrderItem(removeBtn);

            formRow.appendChild(partGroup);
            formRow.appendChild(quantityGroup);
            formRow.appendChild(priceGroup);
            formRow.appendChild(removeBtn);
            orderItem.appendChild(formRow);
            orderItems.appendChild(orderItem);
        }

        this.calculateOrderTotal();
        modal.style.display = 'flex';
    }

    formatDate(dateString) {
        return dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
    }

    handleLogout() {
        window.location.href = '/homepage';
        localStorage.clear();
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
function openOrderModal() {
    orderManager.openOrderModal();
}

function closeOrderModal() {
    orderManager.closeOrderModal();
}

function addOrderItem() {
    orderManager.addOrderItem();
}

function removeOrderItem(button) {
    orderManager.removeOrderItem(button);
}

function saveOrder() {
    orderManager.saveOrder();
}
