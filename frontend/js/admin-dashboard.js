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

    safeJsonParse(jsonString) {
        return window.SecurityUtils.safeJsonParse(jsonString);
    }

    sanitizeObject(obj) {
        return window.SecurityUtils.sanitizeObject(obj);
    }

    safeSetText(element, text) {
        if (element && text !== null && text !== undefined) {
            element.textContent = String(text);
        }
    }

    safeSetHTML(element, html) {
        if (element && html !== null && html !== undefined) {
            const sanitized = this.sanitizeInput(String(html));
            element.innerHTML = sanitized;
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
            if (!token) return;

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

            if (data.success) {
                this.availableParts = data.parts.map(part => this.sanitizeObject({
                    id: part.id,
                    name: part.name,
                    partNumber: part.part_number,
                    category: part.category,
                    price: parseFloat(part.price),
                    stockQuantity: part.stock_quantity,
                    description: part.description || '',
                    supplierName: part.supplier_name || 'Unknown'
                }));
            } else {
                this.showError('Error loading parts: ' + this.sanitizeInput(data.message));
            }
        } catch (error) {
            this.showError('Error loading parts data');
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

        if (parts.length === 0) {
            const option = this.createSafeElement('div', 'part-option', 'No parts found');
            dropdown.innerHTML = '';
            dropdown.appendChild(option);
            return;
        }

        dropdown.innerHTML = '';

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
        if (!part || !part.id) return;

        const existingPart = this.selectedParts.find(p => p.id === part.id);
        if (existingPart) {
            existingPart.quantity += 1;
        } else {
            this.selectedParts.push(this.sanitizeObject({
                id: part.id,
                name: part.name,
                partNumber: part.partNumber,
                category: part.category,
                price: part.price,
                stockQuantity: part.stockQuantity,
                description: part.description,
                quantity: 1
            }));
        }

        this.renderSelectedParts();
        this.updatePartsTotal();
    }

    renderSelectedParts() {
        const container = document.getElementById('selected-parts');

        if (this.selectedParts.length === 0) {
            container.innerHTML = '';
            const span = this.createSafeElement('span', '', 'No parts selected');
            container.appendChild(span);
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');
        container.innerHTML = '';

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
            this.showLoading();

            const token = localStorage.getItem('token');
            if (!token) {
                this.showError('You are not authenticated. Redirecting to login...');
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
                this.showError('Session expired. Redirecting to login...');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setTimeout(() => window.location.href = '/login', 2000);
                return;
            }

            if (data.success) {
                this.appointments = data.appointments.map(appointment => this.sanitizeObject(appointment));
                this.renderAppointments();
            } else {
                this.showError('Error loading appointments: ' + this.sanitizeInput(data.message));
            }
        } catch (error) {
            this.showError('Connection error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    renderAppointments() {
        const container = document.getElementById('appointments-container');

        if (this.appointments.length === 0) {
            container.innerHTML = '';
            const noAppointments = this.createSafeElement('div', 'no-appointments');
            const p = this.createSafeElement('p', '', 'No appointments found for the selected filter.');
            noAppointments.appendChild(p);
            container.appendChild(noAppointments);
            return;
        }

        container.innerHTML = '';
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
        const manageBtn = this.createSafeElement('button', 'manage-btn', 'Manage');
        manageBtn.dataset.id = String(appointment.id);
        actions.appendChild(viewBtn);
        actions.appendChild(manageBtn);

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
            } else {
                this.showError('Error loading details: ' + this.sanitizeInput(data.message));
            }
        } catch (error) {
            this.showError('Connection error.');
        }
    }

    displayAppointmentDetails(appointment) {
        const detailsContainer = document.getElementById('appointment-details');
        detailsContainer.innerHTML = '';

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const clientSection = this.createDetailSection('Client Information', [
            { label: 'Name', value: appointment.clientInfo.name },
            { label: 'Email', value: appointment.clientInfo.email },
            { label: 'Phone', value: appointment.clientInfo.phone || 'Not specified' }
        ]);

        const appointmentSection = this.createDetailSection('Appointment Details', [
            { label: 'Date and Time', value: formattedDate },
            { label: 'Status', value: this.getStatusText(appointment.status), isStatus: true, status: appointment.status }
        ]);

        const vehicleSection = this.createDetailSection('Vehicle Information', [
            { label: 'Type', value: appointment.vehicleInfo.type || 'Not specified' },
            { label: 'Brand and Model', value: `${appointment.vehicleInfo.brand} ${appointment.vehicleInfo.model}` },
            { label: 'Year', value: appointment.vehicleInfo.year || 'Not specified' },
            { label: 'Electric', value: appointment.vehicleInfo.isElectric ? 'Yes' : 'No' }
        ]);

        const problemSection = this.createDetailSection('Problem Description', [
            { label: '', value: appointment.problemDescription, isDescription: true }
        ]);

        detailsContainer.appendChild(clientSection);
        detailsContainer.appendChild(appointmentSection);
        detailsContainer.appendChild(vehicleSection);
        detailsContainer.appendChild(problemSection);

        if (appointment.adminResponse) {
            const adminSection = this.createDetailSection('Admin Response', [
                { label: '', value: appointment.adminResponse, isDescription: true }
            ]);
            detailsContainer.appendChild(adminSection);
        }

        if (appointment.status === 'rejected' && appointment.rejectionReason) {
            const rejectionItems = [{ label: 'Reason', value: appointment.rejectionReason }];
            if (appointment.retryDays) {
                rejectionItems.push({ label: 'Retry After', value: `${appointment.retryDays} days` });
            }
            const rejectionSection = this.createDetailSection('Rejection Details', rejectionItems);
            detailsContainer.appendChild(rejectionSection);
        }

        if (appointment.estimatedPrice) {
            const approvalItems = [{ label: 'Estimated Price', value: `${appointment.estimatedPrice} RON` }];
            if (appointment.warrantyInfo) {
                approvalItems.push({ label: 'Warranty', value: appointment.warrantyInfo });
            }
            const approvalSection = this.createDetailSection('Approval Information', approvalItems);
            detailsContainer.appendChild(approvalSection);
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
                this.populateManageForm(this.sanitizeObject(data.appointment));
                this.openModal('edit-appointment-modal');
            } else {
                this.showError('Error loading details: ' + this.sanitizeInput(data.message));
            }
        } catch (error) {
            this.showError('Connection error.');
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
            this.handleStatusChange({ target: statusRadio });
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

            const updateData = { status: status };

            const adminMessage = document.getElementById('admin-message').value;
            if (adminMessage.trim()) {
                updateData.adminResponse = this.sanitizeInput(adminMessage);
            }

            if (status === 'approved') {
                updateData.estimatedPrice = parseFloat(document.getElementById('estimated-price').value);
                updateData.warranty = parseInt(document.getElementById('warranty').value);

                if (!updateData.estimatedPrice || updateData.estimatedPrice <= 0) {
                    this.showError('Estimated price is required for approval');
                    return;
                }
                if (!updateData.warranty || updateData.warranty < 0) {
                    this.showError('Warranty is required for approval');
                    return;
                }

                if (this.selectedParts.length > 0) {
                    updateData.selectedParts = this.selectedParts.map(part => ({
                        partId: part.id,
                        quantity: part.quantity,
                        unitPrice: part.price
                    }));
                }
            }

            if (status === 'rejected') {
                updateData.rejectionReason = this.sanitizeInput(document.getElementById('rejection-reason').value);

                if (!updateData.rejectionReason || !updateData.rejectionReason.trim()) {
                    this.showError('Rejection reason is required');
                    return;
                }
            }

            const response = await fetch(`/admin/api/appointments/${appointmentId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (data.success) {
                this.showSuccess(this.sanitizeInput(data.message));
                this.closeModal();
                this.loadAppointments();
            } else {
                this.showError('Update error: ' + this.sanitizeInput(data.message));
            }

        } catch (error) {
            this.showError('Connection error.');
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

    showLoading() {
        const container = document.getElementById('appointments-container');
        container.innerHTML = '';

        const loadingDiv = this.createSafeElement('div', 'loading-spinner');
        const spinner = this.createSafeElement('div', 'spinner');
        const p = this.createSafeElement('p', '', 'Loading appointments...');

        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(p);
        container.appendChild(loadingDiv);
    }

    hideLoading() {
        // Loading will be hidden when appointments are rendered
    }

    showError(message) {
        this.showNotification(this.sanitizeInput(message), 'error');
    }

    showSuccess(message) {
        this.showNotification(this.sanitizeInput(message), 'success');
    }

    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });

        const notification = this.createSafeElement('div', `notification notification-${type}`);

        const messageSpan = this.createSafeElement('span', 'notification-message', message);
        const closeBtn = this.createSafeElement('button', 'notification-close', '×');

        notification.appendChild(messageSpan);
        notification.appendChild(closeBtn);

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            this.hideNotification(notification);
        }, 5000);

        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
    }

    hideNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    handleLogout() {
        if (confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/homepage';
        }
    }

    handleAuthError() {
        this.showError('Session expired. Redirecting to login...');
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