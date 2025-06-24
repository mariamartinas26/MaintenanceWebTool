//aici ne ocupam acum doar sa vedem ce orders avem si sa putem adauga unele noi (in admin)
//in accountant facem partea de get suppliers
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

    async initializeData() {
        await Promise.all([
            this.loadSuppliersFromAPI(),
            this.loadPartsFromAPI(),
            this.loadOrdersFromAPI()
        ]);
        this.checkForPreselectedPart(); //verific daca am deja o piesa selectata
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
                e.preventDefault(); //prevent sa nu dam refresh
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

    //INCARCARE DATE DIN API

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
            //doar incarcam datele
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
                //doar incarcam datele
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
            this.loadOrders(); //incarcam si afisam comenzile
        }
    }

    //AFISARE COMEZI

    loadOrders() {
        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        while (ordersList.firstChild) {
            ordersList.removeChild(ordersList.firstChild);
        }

        //daca nu avem orders =>empty state
        if (this.orders.length === 0) {
            const emptyState = this.createSafeElement('div', 'empty-state');
            const h3 = this.createSafeElement('h3', '', 'No orders found');
            const p = this.createSafeElement('p', '', 'No orders have been placed yet');
            emptyState.appendChild(h3);
            emptyState.appendChild(p);
            ordersList.appendChild(emptyState);
            return;
        }

        //pt fiecare comanda creaza card
        this.orders.forEach(order => {
            const orderCard = this.createOrderCard(order);
            ordersList.appendChild(orderCard);
        });
    }

    createOrderCard(order) {
        const totalAmount = parseFloat(order.total_amount);
        const orderCard = this.createSafeElement('div', `order-card ${order.status || ''}`);

        //header comanda
        const orderHeader = this.createSafeElement('div', 'order-header');
        const orderNumber = this.createSafeElement('h3', 'order-number', `ORDER #${order.id || ''}`);
        const orderStatus = this.createSafeElement('span', `order-status status-${order.status || 'ordered'}`, (order.status || 'ordered').toUpperCase());

        orderHeader.appendChild(orderNumber);
        orderHeader.appendChild(orderStatus);

        //order supplier
        const orderSupplier = this.createSafeElement('p', 'order-supplier', `Supplier: ${order.supplier_name}`);

        const orderItems = this.createSafeElement('div', 'order-items');

        //mai multe produse comandate
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            //afiseaza fiecare piesa din comanda
            order.items.forEach(item => {
                const orderItemDisplay = this.createSafeElement('div', 'order-item-display');

                const itemName = this.createSafeElement('span', '', `${item.name} (${item.quantity}x)`);
                const itemPrice = this.createSafeElement('span', '', `RON ${(item.quantity * item.unit_price).toFixed(2)}`);

                orderItemDisplay.appendChild(itemName);
                orderItemDisplay.appendChild(itemPrice);
                orderItems.appendChild(orderItemDisplay);
            });
        } else { //un produs comandat
            const orderItemDisplay = this.createSafeElement('div', 'order-item-display');

            const productName = order.product_name || 'Order Items';
            const quantity = order.product_quantity || 1;

            const itemName = this.createSafeElement('span', '', `${productName} (${quantity}x)`);
            const itemPrice = this.createSafeElement('span', '', `RON ${totalAmount.toFixed(2)}`);

            orderItemDisplay.appendChild(itemName);
            orderItemDisplay.appendChild(itemPrice);
            orderItems.appendChild(orderItemDisplay);
        }

        //order total
        const orderTotal = this.createSafeElement('div', 'order-total', `Total: RON ${totalAmount.toFixed(2)}`);

        //order date
        const orderDate = this.createSafeElement('div', 'order-date', `Ordered: ${this.formatDate(order.order_date)}`);

        let deliveryDate = null;
        //expected delivery
        if (order.expected_delivery_date) {
            deliveryDate = this.createSafeElement('div', 'order-date', `Delivery: ${this.formatDate(order.expected_delivery_date)}`);
        }

        //updatare status
        const orderActions = this.createSafeElement('div', 'order-actions');

        if (order.status !== 'delivered') {
            const updateBtn = this.createSafeElement('button', 'btn btn-sm primary-btn', 'Update Status');
            updateBtn.onclick = () => this.updateOrderStatus(order.id);
            orderActions.appendChild(updateBtn);
        }

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

    //CREARE COMENZI NOI

    openOrderModal() {
        const modal = document.getElementById('orderModal');
        const supplierSelect = document.getElementById('orderSupplier');

        if (!modal || !supplierSelect) return;

        if (!this.parts?.length) {
            return;
        }
        while (supplierSelect.firstChild) {
            supplierSelect.removeChild(supplierSelect.firstChild);
        }

        //dropdown furnizori
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        this.safeSetText(defaultOption, 'Select Supplier');
        supplierSelect.appendChild(defaultOption);
        //populeaza dropdown
        this.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = String(supplier.id);
            this.safeSetText(option, supplier.company_name || supplier.name || '');
            supplierSelect.appendChild(option);
        });
        //reseteaza formularul
        const orderForm = document.getElementById('orderForm');
        if (orderForm) orderForm.reset();

        const orderItems = document.getElementById('orderItems');
        if (orderItems) {
            this.populateOrderItems(orderItems);//dropdown cu piese
        }

        this.calculateOrderTotal();
        modal.style.display = 'flex';
    }

    populateOrderItems(container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        //verifica daca avem piese disponibile
        if (!this.parts?.length) {
            const orderItem = this.createSafeElement('div', 'order-item');
            const p = this.createSafeElement('p', '', 'No parts available');
            orderItem.appendChild(p);
            container.appendChild(orderItem);
            return;
        }

        const orderItem = this.createOrder();
        container.appendChild(orderItem);
    }

    createOrder() {
        const orderItem = this.createSafeElement('div', 'order-item');
        const formRow = this.createSafeElement('div', 'form-row');

        //dropdown selectare piesa
        const partGroup = this.createSafeElement('div', 'form-group');
        const partSelect = document.createElement('select');
        partSelect.className = 'part-select';
        partSelect.required = true;
        partSelect.onchange = () => this.updatePartPrice(partSelect);

        const defaultPartOption = document.createElement('option');
        defaultPartOption.value = '';
        this.safeSetText(defaultPartOption, 'Select Part');
        partSelect.appendChild(defaultPartOption);
        //populeaza cu piese disponibile
        this.parts.forEach(part => {
            const option = document.createElement('option');
            option.value = String(part.id);
            option.setAttribute('data-price', String(part.price));
            this.safeSetText(option, `${part.name} - RON ${parseFloat(part.price).toFixed(2)}`);
            partSelect.appendChild(option);
        });

        partGroup.appendChild(partSelect);

        //cantitatea
        const quantityGroup = this.createSafeElement('div', 'form-group');
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.placeholder = 'Quantity';
        quantityInput.className = 'quantity';
        quantityInput.min = '1';
        quantityInput.required = true;
        quantityInput.onchange = () => this.calculateOrderTotal();
        quantityGroup.appendChild(quantityInput);

        const priceGroup = this.createSafeElement('div', 'form-group');
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.placeholder = 'Unit Price';
        priceInput.className = 'unit-price';
        priceInput.step = '0.01';
        priceInput.min = '0';
        priceInput.required = true;
        priceInput.readOnly = true; //nu se poate modifica pretul
        priceGroup.appendChild(priceInput);

        //buton remove
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

    //mai adaugam o piesa la order
    addOrderItem() {
        const container = document.getElementById('orderItems');
        if (!container) return;

        const newItem = this.createOrder();
        container.appendChild(newItem);
    }

    removeOrderItem(button) {
        const orderItem = button.closest('.order-item');
        if (document.querySelectorAll('.order-item').length > 1) {
            orderItem.remove();
            this.calculateOrderTotal();
        }
    }

    updatePartPrice(selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const price = selectedOption.getAttribute('data-price');//extrag pretul din optiunea selectata
        const orderItem = selectElement.closest('.order-item');
        const priceInput = orderItem.querySelector('.unit-price');

        //actualizeaza pretul si recalculeaza totalul
        if (price && priceInput) {
            priceInput.value = parseFloat(price).toFixed(2);
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

    saveOrder() {
        const supplierIdElement = document.getElementById('orderSupplier');

        if (!supplierIdElement) {
            return;
        }
        //furnizorul selectat din dropdown
        const supplierId = supplierIdElement.value;
        if (!supplierId) {
            return;
        }

        const supplier = this.suppliers.find(s => s.id === parseInt(supplierId));
        if (!supplier) {
            return;
        }

        const orderItems = [];
        document.querySelectorAll('.order-item').forEach(item => {
            const partSelect = item.querySelector('.part-select');
            const quantityInput = item.querySelector('.quantity');
            const unitPriceInput = item.querySelector('.unit-price');

            const quantity = parseInt(quantityInput?.value);
            const unitPrice = parseFloat(unitPriceInput?.value);
            //creez cate un obiect pentru fiecare produs din comanda
            if (partSelect?.value && quantity && unitPrice) {
                const selectedPart = this.parts.find(p => p.id === parseInt(partSelect.value));
                if (selectedPart) {
                    orderItems.push({
                        name: selectedPart.name,
                        part_id: selectedPart.id,
                        quantity: quantity,
                        unit_price: unitPrice
                    });
                }
            }
        });

        if (orderItems.length === 0) {
            alert('Please add at least one item to the order');
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

    closeOrderModal() {
        const modal = document.getElementById('orderModal');
        if (modal) modal.style.display = 'none';
    }

    //SALVAREA COMENZILOR IN API

    async saveOrderToAPI(orderData) {
        try {
            const sanitizedData = this.sanitizeObject(orderData);

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sanitizedData)
            });

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            if (result.success) {
                alert('Order saved successfully!');
                await this.loadOrdersFromAPI();
            } else {
                throw new Error(result.message || 'Failed to save order');
            }
        } catch (error) {
            alert('Error saving order: ' + error.message);
        }
    }

    //UPDATE STATUS LA O COMANDA

    updateOrderStatus(orderId) {
        const order = this.orders.find(o => o.id == orderId);
        if (!order) {
            return;
        }
        this.openOrderStatusModal(orderId);
    }

    //modal pt update order status
    openOrderStatusModal(orderId) {
        //gaseste comanda
        const order = this.orders.find(o => o.id == orderId);
        if (!order) return;

        const modal = this.createSafeElement('div', 'modal');
        modal.id = 'orderStatusModal';
        modal.style.display = 'flex';

        const modalContent = this.createSafeElement('div', 'modal-content');

        //header
        const modalHeader = this.createSafeElement('div', 'modal-header');
        const h2 = this.createSafeElement('h2', '', 'Update Order Status');
        const closeBtn = this.createSafeElement('span', 'close-modal', '×');
        closeBtn.onclick = () => this.closeOrderStatusModal();

        modalHeader.appendChild(h2);
        modalHeader.appendChild(closeBtn);

        //body
        const modalBody = this.createSafeElement('div', 'modal-body');

        //info
        const orderInfo = this.createSafeElement('div', 'order-info');
        const orderIdP = this.createSafeElement('p');
        const orderIdStrong = this.createSafeElement('strong', '', `Order #${order.id}`);
        orderIdP.appendChild(orderIdStrong);

        const supplierP = this.createSafeElement('p', '', `Supplier: ${order.supplier_name}`);
        const currentP = this.createSafeElement('p', '', `Current: ${(order.status || 'ordered').toUpperCase()}`);

        orderInfo.appendChild(orderIdP);
        orderInfo.appendChild(supplierP);
        orderInfo.appendChild(currentP);

        //actualizare status form
        const form = document.createElement('form');
        form.id = 'orderStatusForm';

        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'statusOrderId';
        hiddenInput.value = String(order.id);

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

        //afisam doar statusurile diferite de cel actual
        statuses.filter(s => s.value !== order.status).forEach(status => {
            const option = document.createElement('option');
            option.value = status.value;
            this.safeSetText(option, status.label);
            statusSelect.appendChild(option);
        });

        statusGroup.appendChild(statusLabel);
        statusGroup.appendChild(statusSelect);

        //delivery date
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

    async updateOrderStatusAPI(orderId, status, actualDeliveryDate = null) {
        try {
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

            if (!response.ok) {
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            if (result.success) {
                await this.loadOrdersFromAPI();
            } else {
                throw new Error(result.message || 'Failed to update order status');
            }
        } catch (error) {
            alert('Error updating order status: ' + error.message);
        }
    }

    //PT COMANDA DIN INVENTORY

    checkForPreselectedPart() {
        const urlParams = new URLSearchParams(window.location.search);
        const preselectedPartData = localStorage.getItem('preselectedPart');

        if (urlParams.get('action') === 'new-order' && preselectedPartData) {
            try {
                const partData = JSON.parse(preselectedPartData);
                localStorage.removeItem('preselectedPart');
                setTimeout(() => this.modalWithPreselectedPart(partData), 500);
            } catch (error) {
                localStorage.removeItem('preselectedPart');
            }
        }
    }

    modalWithPreselectedPart(partData) {
        this.openOrderModal();
        setTimeout(() => {
            this.preselectPartInModal(partData);
        }, 100);
    }

    preselectPartInModal(partData) {
        const partSelect = document.querySelector('.order-item .part-select');
        if (!partSelect) return;

        //selectam piesa
        partSelect.value = String(partData.id);

        //pretul pt piesa selectata
        this.updatePartPrice(partSelect);

        //cantitate sugerata ca sa avem cel putin nivelul minim de stoc
        const quantityInput = partSelect.closest('.order-item').querySelector('.quantity');
        if (quantityInput) {
            const suggestedQuantity = Math.max(1, (partData.minimumStockLevel) - (partData.stockQuantity || 0));
            quantityInput.value = String(suggestedQuantity);
        }

        //recalculam total
        this.calculateOrderTotal();
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

const orderManager = new OrderManager();
document.addEventListener('DOMContentLoaded', () => orderManager.init());

function openOrderModal() {
    orderManager.openOrderModal();
}

function closeOrderModal() {
    orderManager.closeOrderModal();
}

function addOrderItem() {
    orderManager.addOrderItem();
}

function saveOrder() {
    orderManager.saveOrder();
}