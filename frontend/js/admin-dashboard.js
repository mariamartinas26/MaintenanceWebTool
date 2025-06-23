class AdminDashboard {
    constructor() {
        this.appointments = [];
        this.availableParts = [];
        this.selectedParts = [];
        this.currentFilters = {
            status: 'all'
        };
        this.init();
    }

    sanitizeInput(input) {
        return window.SecurityUtils.sanitizeInput(input);
    }

    sanitizeObject(obj) {
        return window.SecurityUtils.sanitizeObject(obj);
    }

    safeSetText(element, text) {
        if (element && text !== null && text !== undefined) {
            element.textContent = String(text);
        }
    }

    safeSetValue(element, value) {
        if (element && value !== null && value !== undefined) {
            element.value = this.sanitizeInput(String(value));
        }
    }

    createSafeElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = this.sanitizeInput(className);
        }
        if (textContent) {
            this.safeSetText(element, textContent);
        }
        return element;
    }

    init() {
        this.bindEvents();
        this.loadAppointments();
        this.setupModals();
        this.setupNavigation();
        this.loadParts();
        this.setupPartsSelection();
    }

    bindEvents() {
        const statusFilter = document.getElementById('status-filter');
        statusFilter.addEventListener('change', () => {
            this.currentFilters.status = statusFilter.value;
            this.loadAppointments();
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
    }

    setupModals() {
        const closeModalBtns = document.querySelectorAll('.close-modal');
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', this.closeModal.bind(this));
        });

        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        });

        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        cancelEditBtn.addEventListener('click', this.closeModal.bind(this));

        const appointmentForm = document.getElementById('appointment-form');
        appointmentForm.addEventListener('submit', this.handleStatusUpdate.bind(this));

        const statusRadios = document.querySelectorAll('input[name="status"]');
        statusRadios.forEach(radio => {
            radio.addEventListener('change', this.handleStatusChange.bind(this));
        });
    }

    setupNavigation() {
        const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
        sidebarLinks.forEach(link => {
            const iconElement = link.querySelector('.icon');
            if (iconElement) {
                if (iconElement.textContent.includes('Tool') || link.textContent.toLowerCase().includes('inventory')) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.href = '/inventory/dashboard';
                    });
                }
                if (iconElement.textContent.includes('Store') || link.textContent.toLowerCase().includes('supplier')) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.href = '/suppliers';
                    });
                }
            }
        });
    }

    setupPartsSelection() {
        const partsSearchInput = document.getElementById('parts-search-input');
        const partsDropdown = document.getElementById('parts-dropdown');

        if (!partsSearchInput || !partsDropdown) return;

        partsSearchInput.addEventListener('click', () => this.showPartsDropdown());
        partsSearchInput.addEventListener('focus', () => this.showPartsDropdown());

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.parts-search')) {
                partsDropdown.classList.remove('show');
            }
        });
    }

    async loadParts() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('No token found, skipping parts loading');
                return;
            }

            console.log('Loading parts from API...');
            const response = await fetch('/admin/api/parts?available_only=true', {
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

            if (data.success && data.parts) {

                this.availableParts = data.parts.map((part, index) => {
                    const sanitizedPart = this.sanitizeObject({
                        id: part.id,
                        name: part.name,
                        partNumber: part.part_number,
                        category: part.category,
                        price: parseFloat(part.price),
                        stockQuantity: part.stock_quantity,
                        description: part.description || '',
                        supplierName: part.supplier_name || 'Unknown'
                    });

                    if (!sanitizedPart.price || sanitizedPart.price <= 0 || isNaN(sanitizedPart.price)) {
                        console.warn(`Part ${index} has invalid price:`, sanitizedPart);
                    }

                    return sanitizedPart;
                });

                console.log(`Successfully loaded ${this.availableParts.length} parts`);
            } else {
                console.error('Failed to load parts:', data);
                this.availableParts = [];
            }
        } catch (error) {
            console.error('Error loading parts:', error);
            this.availableParts = [];
        }
    }

    showPartsDropdown() {
        const dropdown = document.getElementById('parts-dropdown');

        if (this.availableParts.length === 0) {
            this.safeSetText(dropdown, 'No parts available');
            dropdown.className = 'part-option';
        } else {
            this.renderPartsDropdown(this.availableParts);
        }

        dropdown.classList.add('show');
    }

    renderPartsDropdown(parts) {
        const dropdown = document.getElementById('parts-dropdown');

        while (dropdown.firstChild) {
            dropdown.removeChild(dropdown.firstChild);
        }

        if (parts.length === 0) {
            const option = this.createSafeElement('div', 'part-option', 'No parts found');
            dropdown.appendChild(option);
            return;
        }

        parts.forEach(part => {
            const option = this.createSafeElement('div', 'part-option');
            option.dataset.partId = String(part.id);

            const nameDiv = this.createSafeElement('div', 'part-name', part.name);
            const detailsDiv = this.createSafeElement('div', 'part-details');

            const detailsText = `${part.partNumber} | Stock: ${part.stockQuantity} | ${part.price.toFixed(2)} RON${part.category ? ` | ${part.category}` : ''}`;
            this.safeSetText(detailsDiv, detailsText);

            option.appendChild(nameDiv);
            option.appendChild(detailsDiv);
            dropdown.appendChild(option);

            option.addEventListener('click', (e) => {
                const partId = parseInt(e.currentTarget.dataset.partId);
                const selectedPart = parts.find(p => p.id === partId);
                if (selectedPart) {
                    this.addPartToSelection(selectedPart);
                    dropdown.classList.remove('show');
                    document.getElementById('parts-search-input').value = '';
                }
            });
        });
    }

    addPartToSelection(part) {
        if (!part || !part.id) {
            console.error('Invalid part provided to addPartToSelection:', part);
            return;
        }


        if (!part.price || part.price <= 0 || isNaN(part.price)) {
            console.error('Part has invalid price:', part);
            return;
        }

        const existingPartIndex = this.selectedParts.findIndex(p => p.id === part.id);

        if (existingPartIndex !== -1) {
            this.selectedParts[existingPartIndex].quantity += 1;
        } else {
            const newPart = this.sanitizeObject({
                id: part.id,
                name: part.name,
                partNumber: part.partNumber,
                category: part.category,
                price: parseFloat(part.price),
                stockQuantity: part.stockQuantity,
                description: part.description,
                quantity: 1
            });

            if (!newPart.price || newPart.price <= 0 || isNaN(newPart.price)) {
                console.error('Part price became invalid after sanitization:', newPart);
                return;
            }

            this.selectedParts.push(newPart);
        }

        this.renderSelectedParts();
        this.updatePartsTotal();
    }

    renderSelectedParts() {
        const container = document.getElementById('selected-parts');

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (this.selectedParts.length === 0) {
            const span = this.createSafeElement('span', '', 'No parts selected');
            container.appendChild(span);
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');

        this.selectedParts.forEach(part => {
            const item = this.createSafeElement('div', 'selected-part-item');
            item.dataset.partId = String(part.id);

            const partInfo = this.createSafeElement('div', 'part-info');
            const nameDiv = this.createSafeElement('div', 'name', part.name);
            const priceDiv = this.createSafeElement('div', 'price', `${part.partNumber} | ${part.price} RON each`);
            partInfo.appendChild(nameDiv);
            partInfo.appendChild(priceDiv);

            const quantityControls = this.createSafeElement('div', 'quantity-controls');

            const decreaseBtn = this.createSafeElement('button', 'quantity-btn decrease', '-');
            decreaseBtn.type = 'button';
            decreaseBtn.dataset.partId = String(part.id);

            const quantityInput = document.createElement('input');
            quantityInput.type = 'number';
            quantityInput.className = 'quantity-input';
            quantityInput.value = String(part.quantity);
            quantityInput.min = '1';
            quantityInput.dataset.partId = String(part.id);

            const increaseBtn = this.createSafeElement('button', 'quantity-btn increase', '+');
            increaseBtn.type = 'button';
            increaseBtn.dataset.partId = String(part.id);

            quantityControls.appendChild(decreaseBtn);
            quantityControls.appendChild(quantityInput);
            quantityControls.appendChild(increaseBtn);

            const removeBtn = this.createSafeElement('button', 'remove-part', 'Remove');
            removeBtn.type = 'button';
            removeBtn.dataset.partId = String(part.id);

            item.appendChild(partInfo);
            item.appendChild(quantityControls);
            item.appendChild(removeBtn);
            container.appendChild(item);
        });

        this.bindPartControlEvents();
    }

    bindPartControlEvents() {
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const partId = parseInt(e.target.dataset.partId);
                const isIncrease = e.target.classList.contains('increase');
                this.updatePartQuantity(partId, isIncrease ? 1 : -1);
            });
        });

        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const partId = parseInt(e.target.dataset.partId);
                const newQuantity = parseInt(e.target.value);
                this.setPartQuantity(partId, newQuantity);
            });
        });

        document.querySelectorAll('.remove-part').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const partId = parseInt(e.target.dataset.partId);
                this.removePartFromSelection(partId);
            });
        });
    }

    updatePartQuantity(partId, change) {
        const part = this.selectedParts.find(p => p.id === partId);
        if (!part) return;

        part.quantity += change;
        if (part.quantity <= 0) {
            this.removePartFromSelection(partId);
        } else {
            this.renderSelectedParts();
            this.updatePartsTotal();
        }
    }

    setPartQuantity(partId, quantity) {
        if (quantity <= 0) {
            this.removePartFromSelection(partId);
            return;
        }

        const part = this.selectedParts.find(p => p.id === partId);
        if (part) {
            part.quantity = quantity;
            this.renderSelectedParts();
            this.updatePartsTotal();
        }
    }

    removePartFromSelection(partId) {
        this.selectedParts = this.selectedParts.filter(p => p.id !== partId);
        this.renderSelectedParts();
        this.updatePartsTotal();
    }

    updatePartsTotal() {
        const total = this.selectedParts.reduce((sum, part) => {
            return sum + (part.price * part.quantity);
        }, 0);

        const totalElement = document.getElementById('parts-total');
        const amountElement = document.getElementById('parts-total-amount');

        if (total > 0) {
            totalElement.style.display = 'block';
            this.safeSetText(amountElement, total.toFixed(2));
        } else {
            totalElement.style.display = 'none';
        }
    }

    async loadAppointments() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setTimeout(() => window.location.href = '/login', 2000);
                return;
            }

            const params = new URLSearchParams();
            if (this.currentFilters.status !== 'all') {
                params.append('status', this.currentFilters.status);
            }

            const response = await fetch(`/admin/api/appointments?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setTimeout(() => window.location.href = '/login', 2000);
                return;
            }

            if (data.success) {
                this.appointments = data.appointments.map(appointment => this.sanitizeObject(appointment));
                this.renderAppointments();
            }
        } catch (error) {
            // Silent error handling
        }
    }

    renderAppointments() {
        const container = document.getElementById('appointments-container');

        // Clear existing content safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (this.appointments.length === 0) {
            const noAppointments = this.createSafeElement('div', 'no-appointments');
            const p = this.createSafeElement('p', '', 'No appointments found for the selected filter.');
            noAppointments.appendChild(p);
            container.appendChild(noAppointments);
            return;
        }

        this.appointments.forEach(appointment => {
            const card = this.createAppointmentCard(appointment);
            container.appendChild(card);
        });

        this.bindCardEvents();
    }

    createAppointmentCard(appointment) {
        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const card = this.createSafeElement('div', `appointment-card ${appointment.status}`);
        card.dataset.id = String(appointment.id);

        const header = this.createSafeElement('div', 'appointment-header');
        const dateSpan = this.createSafeElement('span', 'appointment-date', formattedDate);
        const statusSpan = this.createSafeElement('span', `appointment-status status-${appointment.status}`, this.getStatusText(appointment.status));
        header.appendChild(dateSpan);
        header.appendChild(statusSpan);

        const clientName = this.createSafeElement('div', 'client-name', appointment.clientName);
        const serviceType = this.createSafeElement('div', 'service-type', appointment.serviceType);
        const description = this.createSafeElement('div', 'appointment-description', appointment.problemDescription);

        const actions = this.createSafeElement('div', 'appointment-actions');
        const viewBtn = this.createSafeElement('button', 'view-btn', 'View Details');
        viewBtn.dataset.id = String(appointment.id);
        actions.appendChild(viewBtn);


        if (appointment.status === 'pending') {
            const manageBtn = this.createSafeElement('button', 'manage-btn', 'Manage');
            manageBtn.dataset.id = String(appointment.id);
            actions.appendChild(manageBtn);
        }

        card.appendChild(header);
        card.appendChild(clientName);
        card.appendChild(serviceType);
        card.appendChild(description);
        card.appendChild(actions);

        return card;
    }

    bindCardEvents() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appointmentId = e.target.dataset.id;
                this.viewAppointmentDetails(appointmentId);
            });
        });

        document.querySelectorAll('.manage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appointmentId = e.target.dataset.id;
                this.openManageModal(appointmentId);
            });
        });
    }

    async viewAppointmentDetails(appointmentId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/admin/api/appointments/${appointmentId}`, {
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
                this.displayAppointmentDetails(this.sanitizeObject(data.appointment));
                this.openModal('view-appointment-modal');
            }
        } catch (error) {

        }
    }

    displayAppointmentDetails(appointment) {
        const detailsContainer = document.getElementById('appointment-details');

        // Clear existing content safely
        while (detailsContainer.firstChild) {
            detailsContainer.removeChild(detailsContainer.firstChild);
        }

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        if (appointment.status !== 'pending') {
            const statusNotice = this.createSafeElement('div', `status-notice status-${appointment.status}`);
            const statusText = appointment.status === 'approved' ? 'This appointment has been approved and cannot be modified.' :
                appointment.status === 'rejected' ? 'This appointment has been rejected and cannot be modified.' :
                    'This appointment has been processed and cannot be modified.';
            this.safeSetText(statusNotice, statusText);
            detailsContainer.appendChild(statusNotice);
        }

        const clientSection = this.createDetailSection('Client Information', [
            {label: 'Name', value: appointment.clientInfo.name},
            {label: 'Email', value: appointment.clientInfo.email},
            {label: 'Phone', value: appointment.clientInfo.phone || 'Not specified'}
        ]);

        const appointmentSection = this.createDetailSection('Appointment Details', [
            {label: 'Date and Time', value: formattedDate},
            {label: 'Status', value: this.getStatusText(appointment.status), isStatus: true, status: appointment.status}
        ]);

        const vehicleSection = this.createDetailSection('Vehicle Information', [
            {label: 'Type', value: appointment.vehicleInfo.type || 'Not specified'},
            {label: 'Brand and Model', value: `${appointment.vehicleInfo.brand} ${appointment.vehicleInfo.model}`},
            {label: 'Year', value: appointment.vehicleInfo.year || 'Not specified'},
            {label: 'Electric', value: appointment.vehicleInfo.isElectric ? 'Yes' : 'No'}
        ]);

        const problemSection = this.createDetailSection('Problem Description', [
            {label: '', value: appointment.problemDescription, isDescription: true}
        ]);

        detailsContainer.appendChild(clientSection);
        detailsContainer.appendChild(appointmentSection);
        detailsContainer.appendChild(vehicleSection);
        detailsContainer.appendChild(problemSection);

        if (appointment.adminResponse) {
            const adminSection = this.createDetailSection('Admin Response', [
                {label: '', value: appointment.adminResponse, isDescription: true}
            ]);
            detailsContainer.appendChild(adminSection);
        }

        if (appointment.status === 'rejected' && appointment.rejectionReason) {
            const rejectionItems = [{label: 'Reason', value: appointment.rejectionReason}];
            if (appointment.retryDays) {
                rejectionItems.push({label: 'Retry After', value: `${appointment.retryDays} days`});
            }
            const rejectionSection = this.createDetailSection('Rejection Details', rejectionItems);
            detailsContainer.appendChild(rejectionSection);
        }

        if (appointment.estimatedPrice) {
            const approvalItems = [{label: 'Estimated Price', value: `${appointment.estimatedPrice} RON`}];
            if (appointment.warrantyInfo) {
                approvalItems.push({label: 'Warranty', value: appointment.warrantyInfo});
            }
            const approvalSection = this.createDetailSection('Approval Information', approvalItems);
            detailsContainer.appendChild(approvalSection);
        }

        if (appointment.selectedParts && appointment.selectedParts.length > 0) {
            const partsSection = this.createDetailSection('Selected Parts', []);
            const partsList = this.createSafeElement('div', 'selected-parts-list');

            appointment.selectedParts.forEach(part => {
                const partItem = this.createSafeElement('div', 'part-detail-item');
                const partInfo = `${part.partName} (${part.partNumber}) - Quantity: ${part.quantity} × ${part.unitPrice} RON = ${part.subtotal} RON`;
                this.safeSetText(partItem, partInfo);
                partsList.appendChild(partItem);
            });

            partsSection.appendChild(partsList);
            detailsContainer.appendChild(partsSection);
        }

        if (appointment.mediaFiles && appointment.mediaFiles.length > 0) {
            const filesSection = this.createDetailSection('Attached Files', []);
            const attachmentsList = this.createSafeElement('div', 'attachments-list');

            appointment.mediaFiles.forEach(file => {
                const attachmentItem = this.createSafeElement('div', 'attachment-item');
                const span = this.createSafeElement('span', '', 'Attachment');
                const link = document.createElement('a');
                link.href = this.sanitizeInput(file.filePath);
                link.target = '_blank';
                this.safeSetText(link, file.fileName);

                attachmentItem.appendChild(span);
                attachmentItem.appendChild(link);
                attachmentsList.appendChild(attachmentItem);
            });

            filesSection.appendChild(attachmentsList);
            detailsContainer.appendChild(filesSection);
        }
    }

    createDetailSection(title, items) {
        const section = this.createSafeElement('div', 'detail-section');
        const h3 = this.createSafeElement('h3', '', title);
        section.appendChild(h3);

        items.forEach(item => {
            const detailItem = this.createSafeElement('div', 'detail-item');

            if (item.isDescription) {
                const valueDiv = this.createSafeElement('div', 'detail-value', item.value);
                detailItem.appendChild(valueDiv);
            } else if (item.isStatus) {
                const labelDiv = this.createSafeElement('div', 'detail-label', item.label + ':');
                const valueDiv = this.createSafeElement('div', 'detail-value');
                const statusSpan = this.createSafeElement('span', `appointment-status status-${item.status}`, item.value);
                valueDiv.appendChild(statusSpan);
                detailItem.appendChild(labelDiv);
                detailItem.appendChild(valueDiv);
            } else if (item.label) {
                const labelDiv = this.createSafeElement('div', 'detail-label', item.label + ':');
                const valueDiv = this.createSafeElement('div', 'detail-value', item.value);
                detailItem.appendChild(labelDiv);
                detailItem.appendChild(valueDiv);
            }

            section.appendChild(detailItem);
        });

        return section;
    }

    async openManageModal(appointmentId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/admin/api/appointments/${appointmentId}`, {
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
                const appointment = this.sanitizeObject(data.appointment);

                if (appointment.status !== 'pending') {
                    alert('This appointment cannot be modified as it has already been processed.');
                    return;
                }

                this.populateManageForm(appointment);
                this.openModal('edit-appointment-modal');
            }
        } catch (error) {
            console.error('Error loading appointment details:', error);
            alert('Error loading appointment details. Please try again.');
        }
    }


    populateManageForm(appointment) {
        this.safeSetValue(document.getElementById('appointment-id'), appointment.id);
        this.safeSetValue(document.getElementById('client-name'), appointment.clientInfo.name);
        this.safeSetValue(document.getElementById('service-type'), `${appointment.vehicleInfo.type} ${appointment.vehicleInfo.brand} ${appointment.vehicleInfo.model}`);

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        this.safeSetValue(document.getElementById('appointment-date'), formattedDate);
        this.safeSetValue(document.getElementById('client-message'), appointment.problemDescription);

        const statusRadio = document.querySelector(`input[name="status"][value="${appointment.status}"]`);
        if (statusRadio) {
            statusRadio.checked = true;
            this.handleStatusChange({target: statusRadio});
        }

        if (appointment.estimatedPrice) {
            this.safeSetValue(document.getElementById('estimated-price'), appointment.estimatedPrice);
        }
        if (appointment.warrantyInfo) {
            const warrantyMatch = appointment.warrantyInfo.match(/(\d+)/);
            if (warrantyMatch) {
                this.safeSetValue(document.getElementById('warranty'), warrantyMatch[1]);
            }
        }
        if (appointment.adminResponse) {
            this.safeSetValue(document.getElementById('admin-message'), appointment.adminResponse);
        }
        if (appointment.rejectionReason) {
            this.safeSetValue(document.getElementById('rejection-reason'), appointment.rejectionReason);
        }
        if (appointment.retryDays) {
            this.safeSetValue(document.getElementById('retry-days'), appointment.retryDays);
        }

        this.selectedParts = [];
        this.renderSelectedParts();
        this.updatePartsTotal();
    }

    handleStatusChange(e) {
        const status = e.target.value;
        const approvalFields = document.getElementById('approval-fields');
        const rejectionFields = document.getElementById('rejection-fields');
        const adminMessageField = document.getElementById('admin-message-field');

        approvalFields.style.display = 'none';
        rejectionFields.style.display = 'none';

        if (adminMessageField) {
            adminMessageField.style.display = 'block';
        }

        if (status === 'approved') {
            approvalFields.style.display = 'block';
        } else if (status === 'rejected') {
            rejectionFields.style.display = 'block';
        }
    }

    async handleStatusUpdate(e) {
        e.preventDefault();

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData(e.target);
            const appointmentId = formData.get('appointment-id') || document.getElementById('appointment-id').value;
            const status = formData.get('status');

            console.log('=== Frontend Status Update ===');
            console.log('Appointment ID:', appointmentId);
            console.log('New Status:', status);
            console.log('Selected Parts:', this.selectedParts);

            const updateData = {status: status};

            const adminMessage = document.getElementById('admin-message').value;
            if (adminMessage && adminMessage.trim()) {
                updateData.adminResponse = this.sanitizeInput(adminMessage);
            }

            if (status === 'approved') {
                const estimatedPriceInput = document.getElementById('estimated-price');
                const warrantyInput = document.getElementById('warranty');

                const estimatedPrice = parseFloat(estimatedPriceInput.value);
                const warranty = parseInt(warrantyInput.value);

                if (!estimatedPrice || estimatedPrice <= 0) {
                    alert('Please enter a valid estimated price');
                    return;
                }
                if (!warranty || warranty < 0) {
                    alert('Please enter a valid warranty period');
                    return;
                }

                updateData.estimatedPrice = estimatedPrice;
                updateData.warranty = warranty;

                // Handle selected parts
                if (this.selectedParts && this.selectedParts.length > 0) {
                    console.log('Processing selected parts...');

                    // Validate all parts have valid prices
                    const invalidParts = [];
                    for (let i = 0; i < this.selectedParts.length; i++) {
                        const part = this.selectedParts[i];
                        console.log(`Validating part ${i}:`, part);

                        if (!part.price || part.price <= 0 || isNaN(part.price)) {
                            invalidParts.push({
                                index: i,
                                part: part,
                                issue: `Invalid price: ${part.price}`
                            });
                        }

                        if (!part.quantity || part.quantity <= 0 || isNaN(part.quantity)) {
                            invalidParts.push({
                                index: i,
                                part: part,
                                issue: `Invalid quantity: ${part.quantity}`
                            });
                        }

                        if (!part.id) {
                            invalidParts.push({
                                index: i,
                                part: part,
                                issue: 'Missing part ID'
                            });
                        }
                    }

                    if (invalidParts.length > 0) {
                        console.error('Invalid parts found:', invalidParts);
                        alert('Some selected parts have invalid data. Please check and try again.');
                        return;
                    }

                    // Transform parts data for backend
                    updateData.selectedParts = this.selectedParts.map((part, index) => {
                        const partData = {
                            partId: parseInt(part.id),
                            quantity: parseInt(part.quantity),
                            unitPrice: parseFloat(part.price)
                        };

                        console.log(`Transformed part ${index}:`, partData);
                        return partData;
                    });

                    console.log('Final parts data to send:', updateData.selectedParts);
                } else {
                    console.log('No parts selected');
                }
            }

            if (status === 'rejected') {
                const rejectionReasonInput = document.getElementById('rejection-reason');
                const rejectionReason = rejectionReasonInput.value;

                if (!rejectionReason || !rejectionReason.trim()) {
                    alert('Please enter a rejection reason');
                    return;
                }

                updateData.rejectionReason = this.sanitizeInput(rejectionReason);
            }

            console.log('Final update data:', JSON.stringify(updateData, null, 2));

            const response = await fetch(`/admin/api/appointments/${appointmentId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();
            console.log('Server response:', data);

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (data.success) {
                this.closeModal();
                this.loadAppointments();
                alert('Appointment status updated successfully');
            } else {
                console.error('Update failed:', data);
                alert('Failed to update appointment: ' + (data.message || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error in handleStatusUpdate:', error);
            alert('An error occurred while updating the appointment. Please try again.');
        }
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

        const appointmentForm = document.getElementById('appointment-form');
        if (appointmentForm) {
            appointmentForm.reset();
        }

        this.selectedParts = [];
        this.renderSelectedParts();
        this.updatePartsTotal();

        const approvalFields = document.getElementById('approval-fields');
        const rejectionFields = document.getElementById('rejection-fields');
        const adminMessageField = document.getElementById('admin-message-field');

        if (approvalFields) approvalFields.style.display = 'none';
        if (rejectionFields) rejectionFields.style.display = 'none';
        if (adminMessageField) adminMessageField.style.display = 'block';
    }

    getStatusText(status) {
        const statusTexts = {
            'pending': 'Pending',
            'approved': 'Approved',
            'rejected': 'Rejected',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        };
        return statusTexts[status] || status;
    }

    handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.clear();
        window.location.href = '/homepage';
    }

    handleAuthError() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});