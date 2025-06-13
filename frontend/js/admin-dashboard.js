class AdminDashboard {
    constructor() {
        this.appointments = [];
        this.availableParts = [];
        this.selectedParts = [];
        this.currentFilters = {
            status: 'all',
            date: 'all',
            search: ''
        };
        this.init();
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
        // Search functionality
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.querySelector('.search-btn');

        searchInput.addEventListener('input', this.debounce(() => {
            this.currentFilters.search = searchInput.value;
            this.loadAppointments();
        }, 300));

        searchBtn.addEventListener('click', () => {
            this.currentFilters.search = searchInput.value;
            this.loadAppointments();
        });

        // Filter functionality
        const statusFilter = document.getElementById('status-filter');
        const dateFilter = document.getElementById('date-filter');

        statusFilter.addEventListener('change', () => {
            this.currentFilters.status = statusFilter.value;
            this.loadAppointments();
        });

        dateFilter.addEventListener('change', () => {
            this.currentFilters.date = dateFilter.value;
            this.loadAppointments();
        });

        // Logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    }

    setupModals() {
        // Close modal events
        const closeModalBtns = document.querySelectorAll('.close-modal');
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', this.closeModal.bind(this));
        });

        // Close modal when clicking outside
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        });

        // Cancel edit button
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        cancelEditBtn.addEventListener('click', this.closeModal.bind(this));

        // Form submission
        const appointmentForm = document.getElementById('appointment-form');
        appointmentForm.addEventListener('submit', this.handleStatusUpdate.bind(this));

        // Status radio button changes
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
                // Inventory navigation
                if (iconElement.textContent.includes('Tool') || link.textContent.toLowerCase().includes('inventory')) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.href = '/inventory/dashboard';
                    });
                }

                // Suppliers navigation
                if (iconElement.textContent.includes('Store') || link.textContent.toLowerCase().includes('supplier')) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.href = '/suppliers';
                    });
                }
            }
        });
    }

    // Parts Selection Setup
    setupPartsSelection() {
        const partsSearchInput = document.getElementById('parts-search-input');
        const partsDropdown = document.getElementById('parts-dropdown');

        if (!partsSearchInput || !partsDropdown) {
            return;
        }

        // Show dropdown on click/focus
        partsSearchInput.addEventListener('click', () => {
            this.showPartsDropdown();
        });

        partsSearchInput.addEventListener('focus', () => {
            this.showPartsDropdown();
        });

        // Close dropdown when clicking outside
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
                return;
            }

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
                this.availableParts = data.parts.map(part => ({
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
                this.showError('Error loading parts: ' + data.message);
            }
        } catch (error) {
            this.showError('Error loading parts data');
        }
    }

    showPartsDropdown() {
        const dropdown = document.getElementById('parts-dropdown');

        if (this.availableParts.length === 0) {
            dropdown.innerHTML = '<div class="part-option">No parts available</div>';
        } else {
            this.renderPartsDropdown(this.availableParts);
        }

        dropdown.classList.add('show');
    }

    renderPartsDropdown(parts) {
        const dropdown = document.getElementById('parts-dropdown');

        if (parts.length === 0) {
            dropdown.innerHTML = '<div class="part-option">No parts found</div>';
            return;
        }

        dropdown.innerHTML = parts.map(part => `
            <div class="part-option" data-part-id="${part.id}">
                <div class="part-name">${part.name}</div>
                <div class="part-details">
                    ${part.partNumber} | Stock: ${part.stockQuantity} | ${part.price.toFixed(2)} RON
                    ${part.category ? ` | ${part.category}` : ''}
                </div>
            </div>
        `).join('');

        // Add click events for part selection
        dropdown.querySelectorAll('.part-option[data-part-id]').forEach(option => {
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

        // Check if part already selected
        const existingPart = this.selectedParts.find(p => p.id === part.id);
        if (existingPart) {
            existingPart.quantity += 1;
        } else {
            this.selectedParts.push({
                id: part.id,
                name: part.name,
                partNumber: part.partNumber,
                category: part.category,
                price: part.price,
                stockQuantity: part.stockQuantity,
                description: part.description,
                quantity: 1
            });
        }

        this.renderSelectedParts();
        this.updatePartsTotal();
    }

    renderSelectedParts() {
        const container = document.getElementById('selected-parts');

        if (this.selectedParts.length === 0) {
            container.innerHTML = '<span>No parts selected</span>';
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');
        container.innerHTML = this.selectedParts.map(part => `
            <div class="selected-part-item" data-part-id="${part.id}">
                <div class="part-info">
                    <div class="name">${part.name}</div>
                    <div class="price">${part.partNumber} | ${part.price} RON each</div>
                </div>
                <div class="quantity-controls">
                    <button type="button" class="quantity-btn decrease" data-part-id="${part.id}">-</button>
                    <input type="number" class="quantity-input" value="${part.quantity}" 
                           min="1" data-part-id="${part.id}">
                    <button type="button" class="quantity-btn increase" data-part-id="${part.id}">+</button>
                </div>
                <button type="button" class="remove-part" data-part-id="${part.id}">Remove</button>
            </div>
        `).join('');

        // Bind events for quantity controls
        this.bindPartControlEvents();
    }

    bindPartControlEvents() {
        // Quantity buttons
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const partId = parseInt(e.target.dataset.partId);
                const isIncrease = e.target.classList.contains('increase');
                this.updatePartQuantity(partId, isIncrease ? 1 : -1);
            });
        });

        // Quantity inputs
        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const partId = parseInt(e.target.dataset.partId);
                const newQuantity = parseInt(e.target.value);
                this.setPartQuantity(partId, newQuantity);
            });
        });

        // Remove buttons
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
            amountElement.textContent = total.toFixed(2);
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
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
                return;
            }

            const params = new URLSearchParams();
            if (this.currentFilters.status !== 'all') {
                params.append('status', this.currentFilters.status);
            }
            if (this.currentFilters.date !== 'all') {
                params.append('date_filter', this.currentFilters.date);
            }
            if (this.currentFilters.search) {
                params.append('search', this.currentFilters.search);
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
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
                return;
            }

            if (data.success) {
                this.appointments = data.appointments;
                this.renderAppointments();
            } else {
                this.showError('Error loading appointments: ' + data.message);
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
            container.innerHTML = `
                <div class="no-appointments">
                    <p>No appointments found for the selected filters.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.appointments.map(appointment =>
            this.createAppointmentCard(appointment)
        ).join('');

        // Bind events for the new cards
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

        return `
            <div class="appointment-card ${appointment.status}" data-id="${appointment.id}">
                <div class="appointment-header">
                    <span class="appointment-date">${formattedDate}</span>
                    <span class="appointment-status status-${appointment.status}">
                        ${this.getStatusText(appointment.status)}
                    </span>
                </div>
                <div class="client-name">${appointment.clientName}</div>
                <div class="service-type">${appointment.serviceType}</div>
                <div class="appointment-description">
                    ${appointment.problemDescription}
                </div>
                <div class="appointment-actions">
                    <button class="view-btn" data-id="${appointment.id}">
                        View Details
                    </button>
                    <button class="manage-btn" data-id="${appointment.id}">
                        Manage
                    </button>
                </div>
            </div>
        `;
    }

    bindCardEvents() {
        // View buttons
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appointmentId = e.target.dataset.id;
                this.viewAppointmentDetails(appointmentId);
            });
        });

        // Manage buttons
        const manageBtns = document.querySelectorAll('.manage-btn');
        manageBtns.forEach(btn => {
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
                this.displayAppointmentDetails(data.appointment);
                this.openModal('view-appointment-modal');
            } else {
                this.showError('Error loading details: ' + data.message);
            }
        } catch (error) {
            this.showError('Connection error.');
        }
    }

    displayAppointmentDetails(appointment) {
        const detailsContainer = document.getElementById('appointment-details');

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        detailsContainer.innerHTML = `
            <div class="detail-section">
                <h3>Client Information</h3>
                <div class="detail-item">
                    <div class="detail-label">Name:</div>
                    <div class="detail-value">${appointment.clientInfo.name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email:</div>
                    <div class="detail-value">${appointment.clientInfo.email}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Phone:</div>
                    <div class="detail-value">${appointment.clientInfo.phone || 'Not specified'}</div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Appointment Details</h3>
                <div class="detail-item">
                    <div class="detail-label">Date and Time:</div>
                    <div class="detail-value">${formattedDate}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="appointment-status status-${appointment.status}">
                            ${this.getStatusText(appointment.status)}
                        </span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Vehicle Information</h3>
                <div class="detail-item">
                    <div class="detail-label">Type:</div>
                    <div class="detail-value">${appointment.vehicleInfo.type || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Brand and Model:</div>
                    <div class="detail-value">${appointment.vehicleInfo.brand} ${appointment.vehicleInfo.model}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Year:</div>
                    <div class="detail-value">${appointment.vehicleInfo.year || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Electric:</div>
                    <div class="detail-value">${appointment.vehicleInfo.isElectric ? 'Yes' : 'No'}</div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Problem Description</h3>
                <div class="detail-item">
                    <div class="detail-value">${appointment.problemDescription}</div>
                </div>
            </div>

            ${this.renderAdminResponseSection(appointment)}

            ${this.renderRejectionSection(appointment)}

            ${appointment.estimatedPrice ? `
                <div class="detail-section">
                    <h3>Approval Information</h3>
                    <div class="detail-item">
                        <div class="detail-label">Estimated Price:</div>
                        <div class="detail-value">$${appointment.estimatedPrice}</div>
                    </div>
                    ${appointment.warrantyInfo ? `
                        <div class="detail-item">
                            <div class="detail-label">Warranty:</div>
                            <div class="detail-value">${appointment.warrantyInfo}</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            ${appointment.mediaFiles && appointment.mediaFiles.length > 0 ? `
                <div class="detail-section">
                    <h3>Attached Files</h3>
                    <div class="attachments-list">
                        ${appointment.mediaFiles.map(file => `
                            <div class="attachment-item">
                                <span>Attachment</span>
                                <a href="${file.filePath}" target="_blank">${file.fileName}</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    renderAdminResponseSection(appointment) {
        if (!appointment.adminResponse) {
            return '';
        }

        return `
            <div class="detail-section">
                <h3>Admin Response</h3>
                <div class="detail-item">
                    <div class="detail-value">${appointment.adminResponse}</div>
                </div>
            </div>
        `;
    }

    renderRejectionSection(appointment) {
        if (appointment.status !== 'rejected' || !appointment.rejectionReason) {
            return '';
        }

        return `
            <div class="detail-section">
                <h3>Rejection Details</h3>
                <div class="detail-item">
                    <div class="detail-label">Reason:</div>
                    <div class="detail-value">${appointment.rejectionReason}</div>
                </div>
                ${appointment.retryDays ? `
                    <div class="detail-item">
                        <div class="detail-label">Retry After:</div>
                        <div class="detail-value">${appointment.retryDays} days</div>
                    </div>
                ` : ''}
            </div>
        `;
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
                this.populateManageForm(data.appointment);
                this.openModal('edit-appointment-modal');
            } else {
                this.showError('Error loading details: ' + data.message);
            }
        } catch (error) {
            this.showError('Connection error.');
        }
    }

    populateManageForm(appointment) {
        document.getElementById('appointment-id').value = appointment.id;
        document.getElementById('client-name').value = appointment.clientInfo.name;
        document.getElementById('service-type').value = `${appointment.vehicleInfo.type} ${appointment.vehicleInfo.brand} ${appointment.vehicleInfo.model}`;

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('appointment-date').value = formattedDate;
        document.getElementById('client-message').value = appointment.problemDescription;

        // Set current status
        const statusRadio = document.querySelector(`input[name="status"][value="${appointment.status}"]`);
        if (statusRadio) {
            statusRadio.checked = true;
            this.handleStatusChange({ target: statusRadio });
        }

        // Populate existing values if available
        if (appointment.estimatedPrice) {
            document.getElementById('estimated-price').value = appointment.estimatedPrice;
        }
        if (appointment.warrantyInfo) {
            const warrantyMatch = appointment.warrantyInfo.match(/(\d+)/);
            if (warrantyMatch) {
                document.getElementById('warranty').value = warrantyMatch[1];
            }
        }

        // Separate admin response and rejection reason
        if (appointment.adminResponse) {
            document.getElementById('admin-message').value = appointment.adminResponse;
        }
        if (appointment.rejectionReason) {
            document.getElementById('rejection-reason').value = appointment.rejectionReason;
        }
        if (appointment.retryDays) {
            document.getElementById('retry-days').value = appointment.retryDays;
        }

        // Reset selected parts
        this.selectedParts = [];
        this.renderSelectedParts();
        this.updatePartsTotal();
    }

    handleStatusChange(e) {
        const status = e.target.value;
        const approvalFields = document.getElementById('approval-fields');
        const rejectionFields = document.getElementById('rejection-fields');
        const adminMessageField = document.getElementById('admin-message-field');

        // Hide all conditional fields first
        approvalFields.style.display = 'none';
        rejectionFields.style.display = 'none';

        // Admin message field is always visible for all statuses
        if (adminMessageField) {
            adminMessageField.style.display = 'block';
        }

        // Show relevant fields based on status
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

            const updateData = {
                status: status
            };

            // Add admin response for ALL statuses
            const adminMessage = document.getElementById('admin-message').value;
            if (adminMessage.trim()) {
                updateData.adminResponse = adminMessage;
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

                // Add selected parts to the update data
                if (this.selectedParts.length > 0) {
                    updateData.selectedParts = this.selectedParts.map(part => ({
                        partId: part.id,
                        quantity: part.quantity,
                        unitPrice: part.price
                    }));
                }
            }

            if (status === 'rejected') {
                updateData.rejectionReason = document.getElementById('rejection-reason').value;
                updateData.retryDays = parseInt(document.getElementById('retry-days').value) || 0;

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
                this.showSuccess(data.message);
                this.closeModal();
                this.loadAppointments(); // Reload appointments
            } else {
                this.showError('Update error: ' + data.message);
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

        // Reset forms
        const appointmentForm = document.getElementById('appointment-form');
        if (appointmentForm) {
            appointmentForm.reset();
        }

        // Reset selected parts
        this.selectedParts = [];
        this.renderSelectedParts();
        this.updatePartsTotal();

        // Hide conditional fields
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
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading appointments...</p>
            </div>
        `;
    }

    hideLoading() {
        // Loading will be hidden when appointments are made
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Remove any existing notifications first
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideNotification(notification);
        }, 5000);

        // Close button event
        const closeBtn = notification.querySelector('.notification-close');
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
            // Clear stored authentication data
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect to login page
            window.location.href = '/login';
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

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});