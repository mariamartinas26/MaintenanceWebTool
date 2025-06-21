class Dashboard {
    constructor() {
        this.token = null;
        this.user = {};
        this.currentAppointments = [];
        this.initSecurityUtils();
        this.init();
    }

    initSecurityUtils() {
        // Security utility functions
        this.sanitizeInput = function(input) {
            if (typeof input !== 'string') return input;

            return input
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        };

        this.safeJsonParse = function(jsonString) {
            try {
                if (!jsonString || typeof jsonString !== 'string') {
                    return null;
                }

                if (/<script|javascript:|on\w+\s*=|data:/i.test(jsonString)) {
                    console.warn('Potentially malicious content detected in JSON');
                    return null;
                }

                const parsed = JSON.parse(jsonString);
                if (typeof parsed === 'object' && parsed !== null) {
                    return this.sanitizeObject(parsed);
                }

                return parsed;
            } catch (error) {
                console.error('Error parsing JSON safely:', error);
                return null;
            }
        }.bind(this);

        this.sanitizeObject = function(obj) {
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
        }.bind(this);

        this.validateToken = function(token) {
            if (!token || typeof token !== 'string') {
                return false;
            }

            const parts = token.split('.');
            if (parts.length !== 3) {
                return false;
            }

            const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
            return jwtRegex.test(token);
        };

        this.safeDecodeJWT = function(token) {
            try {
                if (!this.validateToken(token)) {
                    return null;
                }

                const parts = token.split('.');
                const payload = parts[1];

                const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
                return this.safeJsonParse(decoded);
            } catch (error) {
                console.error('Error decoding JWT safely:', error);
                return null;
            }
        }.bind(this);

        this.safeSetHTML = function(element, html) {
            const sanitized = this.sanitizeInput(html);
            element.innerHTML = sanitized;
        };
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupScheduleButton();
            this.checkAuthentication();
            this.initializeDashboard();
            this.loadUserInfo();
            this.loadAppointments();
            this.loadUserVehicles();
            this.setupEventListeners();
            this.setupFormHandlers();
            this.setupMobileMenu();
            this.startTokenValidationInterval();
        });
    }

    setupScheduleButton() {
        const scheduleBtn = document.querySelector('.schedule-now-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => {
                document.querySelector('[data-tab="new-appointment"]').click();
            });
        }
    }

    checkAuthentication() {
        this.token = localStorage.getItem('token');
        const userString = localStorage.getItem('user');
        this.user = userString ? this.safeJsonParse(userString) || {} : {};

        if (!this.token || !this.user.id) {
            window.location.href = 'login.html';
            return;
        }
    }

    initializeDashboard() {
        console.log('Dashboard initialized for user:', this.user.first_name);

        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('appointment-date');
        if (dateInput) {
            dateInput.min = today;
        }
    }

    loadUserInfo() {
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && this.user.first_name) {
            userNameElement.textContent = this.sanitizeInput(this.user.first_name);
        }
    }

    async loadUserVehicles() {
        try {
            const response = await fetch('/api/vehicles', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.populateVehicleSelect(data.vehicles);
            } else {
                console.error('Error loading vehicles:', data.message);
            }

        } catch (error) {
            console.error('Error loading vehicles:', error);
        }
    }

    populateVehicleSelect(vehicles) {
        const select = document.getElementById('existing-vehicle');
        if (!select) return;

        // Clear existing options except the first one
        select.innerHTML = '<option value="">Select vehicle or add a new one</option>';

        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = this.sanitizeInput(vehicle.id);

            const brand = this.sanitizeInput(vehicle.brand || '');
            const model = this.sanitizeInput(vehicle.model || '');
            const year = this.sanitizeInput(vehicle.year || '');
            const vehicleType = this.sanitizeInput(vehicle.vehicle_type || '');
            const electricText = vehicle.is_electric ? ' Electric' : '';

            option.textContent = `${brand} ${model} (${year}) - ${vehicleType}${electricText}`;
            select.appendChild(option);
        });
    }

    setupMobileMenu() {
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
        const mobileNavClose = document.getElementById('mobile-nav-close');

        if (mobileMenuToggle && mobileNavOverlay) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileNavOverlay.style.display = 'block';
            });
        }

        if (mobileNavClose && mobileNavOverlay) {
            mobileNavClose.addEventListener('click', () => {
                mobileNavOverlay.style.display = 'none';
            });
        }

        if (mobileNavOverlay) {
            mobileNavOverlay.addEventListener('click', (e) => {
                if (e.target === mobileNavOverlay) {
                    mobileNavOverlay.style.display = 'none';
                }
            });
        }

        // Mobile nav links
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const targetTab = link.getAttribute('data-tab');
                if (targetTab) {
                    // Update active states for mobile nav
                    mobileNavLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');

                    // Switch tab
                    this.switchTab(targetTab);

                    // Close mobile menu
                    mobileNavOverlay.style.display = 'none';
                }
            });
        });

        // Mobile logout button
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => this.logout());
        }

        // Mobile contact button
        const mobileContactBtn = document.getElementById('mobile-contact-btn');
        if (mobileContactBtn) {
            mobileContactBtn.addEventListener('click', () => {
                this.showContactModal();
                mobileNavOverlay.style.display = 'none';
            });
        }
    }

    setupEventListeners() {
        // Contact modal
        const contactModal = document.getElementById('contact-modal');
        const closeContactModal = document.getElementById('close-contact-modal');

        if (closeContactModal && contactModal) {
            closeContactModal.addEventListener('click', () => {
                contactModal.style.display = 'none';
            });

            window.addEventListener('click', (e) => {
                if (e.target === contactModal) {
                    contactModal.style.display = 'none';
                }
            });
        }

        // Appointment modal
        const appointmentModal = document.getElementById('appointment-modal');
        const closeAppointmentModal = appointmentModal?.querySelector('.close-modal');

        if (closeAppointmentModal && appointmentModal) {
            closeAppointmentModal.addEventListener('click', () => {
                appointmentModal.style.display = 'none';
            });

            window.addEventListener('click', (e) => {
                if (e.target === appointmentModal) {
                    appointmentModal.style.display = 'none';
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (appointmentModal.style.display === 'flex') {
                        appointmentModal.style.display = 'none';
                    }
                    if (contactModal && contactModal.style.display === 'flex') {
                        contactModal.style.display = 'none';
                    }
                }
            });
        }

        // Tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });

        // Logout buttons
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
                    this.resetForm();
                    this.switchTab('appointments');
                }
            });
        }
    }

    switchTab(targetTab) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        const targetTabBtn = document.querySelector(`[data-tab="${targetTab}"].tab-btn`);
        if (targetTabBtn) {
            targetTabBtn.classList.add('active');
        }

        // Switch tab panes
        const tabPanes = document.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => pane.classList.remove('active'));
        const targetPane = document.getElementById(targetTab);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    showContactModal() {
        const contactModal = document.getElementById('contact-modal');
        if (contactModal) {
            contactModal.style.display = 'flex';
        }
    }

    setupFormHandlers() {
        // Date change handler - load available slots
        const dateInput = document.getElementById('appointment-date');
        if (dateInput) {
            dateInput.addEventListener('change', () => this.loadAvailableSlots());
        }

        // Existing vehicle selection handler
        const existingVehicleSelect = document.getElementById('existing-vehicle');
        if (existingVehicleSelect) {
            existingVehicleSelect.addEventListener('change', () => {
                const newVehicleSection = document.getElementById('new-vehicle-section');
                if (existingVehicleSelect.value) {
                    // Hide new vehicle form and clear its values
                    if (newVehicleSection) {
                        newVehicleSection.style.display = 'none';
                    }
                    this.clearNewVehicleForm();
                } else {
                    // Show new vehicle form
                    if (newVehicleSection) {
                        newVehicleSection.style.display = 'block';
                    }
                }
            });
        }

        // Description character counter
        const descriptionTextarea = document.getElementById('description');
        const charCounter = document.querySelector('.char-counter');
        if (descriptionTextarea && charCounter) {
            descriptionTextarea.addEventListener('input', function() {
                const length = this.value.length;
                charCounter.textContent = `${length}/10 minimum characters`;

                if (length >= 10) {
                    charCounter.classList.add('valid');
                    charCounter.classList.remove('invalid');
                } else {
                    charCounter.classList.add('invalid');
                    charCounter.classList.remove('valid');
                }
            });
        }

        // Form submission
        const appointmentForm = document.getElementById('appointment-form');
        if (appointmentForm) {
            appointmentForm.addEventListener('submit', (e) => this.handleFormSubmission(e));
        }
    }

    async loadAvailableSlots() {
        const dateInput = document.getElementById('appointment-date');
        const timeSelect = document.getElementById('appointment-time');

        if (!dateInput || !timeSelect || !dateInput.value) return;

        try {
            timeSelect.innerHTML = '<option value="">Loading...</option>';

            const response = await fetch(`/api/calendar/available-slots?date=${dateInput.value}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                timeSelect.innerHTML = '<option value="">Select time</option>';

                if (data.availableSlots.length === 0) {
                    timeSelect.innerHTML = '<option value="">No slots available</option>';
                } else {
                    data.availableSlots.forEach(slot => {
                        const option = document.createElement('option');
                        option.value = this.sanitizeInput(slot.startTime);

                        const startTime = this.sanitizeInput(slot.startTime);
                        const availableSpots = this.sanitizeInput(slot.availableSpots);
                        option.textContent = `${startTime} (${availableSpots} slots available)`;

                        timeSelect.appendChild(option);
                    });
                }
            } else {
                timeSelect.innerHTML = '<option value="">Error loading</option>';
            }

        } catch (error) {
            console.error('Error loading available slots:', error);
            timeSelect.innerHTML = '<option value="">Error loading</option>';
        }
    }

    clearNewVehicleForm() {
        const fields = ['vehicle-type', 'brand', 'model', 'year', 'vehicle-notes'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });

        const isElectricCheckbox = document.getElementById('is-electric');
        if (isElectricCheckbox) isElectricCheckbox.checked = false;
    }

    resetForm() {
        const form = document.getElementById('appointment-form');
        if (form) {
            form.reset();
            this.clearNewVehicleForm();

            const timeSelect = document.getElementById('appointment-time');
            if (timeSelect) {
                timeSelect.innerHTML = '<option value="">Select date first</option>';
            }

            const newVehicleSection = document.getElementById('new-vehicle-section');
            if (newVehicleSection) {
                newVehicleSection.style.display = 'block';
            }

            const charCounter = document.querySelector('.char-counter');
            if (charCounter) {
                charCounter.textContent = '0/10 minimum characters';
                charCounter.classList.remove('valid', 'invalid');
            }
        }
    }

    async handleFormSubmission(e) {
        e.preventDefault();

        try {
            // Collect form data
            const formData = new FormData(e.target);
            const appointmentData = Object.fromEntries(formData);

            // Validate required fields
            if (!appointmentData.date || !appointmentData.time || !appointmentData.description) {
                console.error('Please fill in all required fields');
                return;
            }

            if (appointmentData.description.length < 10) {
                console.error('Description must contain at least 10 characters');
                return;
            }

            // Check if we need to create a new vehicle
            let vehicleId = appointmentData.vehicleId;

            if (!vehicleId && appointmentData.vehicle_type) {
                // Create new vehicle first
                const vehicleData = {
                    vehicle_type: appointmentData.vehicle_type,
                    brand: appointmentData.brand,
                    model: appointmentData.model,
                    year: parseInt(appointmentData.year),
                    is_electric: appointmentData.is_electric === 'on',
                    notes: appointmentData.notes || null
                };

                const vehicleResponse = await fetch('/api/vehicles', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(vehicleData)
                });

                const vehicleResult = await vehicleResponse.json();

                if (vehicleResult.success) {
                    vehicleId = vehicleResult.vehicle.id;
                    // Refresh vehicles list
                    await this.loadUserVehicles();
                } else {
                    console.error(vehicleResult.message || 'Error creating vehicle');
                    return;
                }
            }

            // Create appointment
            const appointmentPayload = {
                date: appointmentData.date,
                time: appointmentData.time,
                serviceType: appointmentData.serviceType,
                description: appointmentData.description,
                vehicleId: vehicleId || null
            };

            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appointmentPayload)
            });

            const data = await response.json();

            if (data.success) {
                console.log('Appointment created successfully!');
                this.resetForm();
                this.loadAppointments();
                // Switch back to appointments tab
                this.switchTab('appointments');
            } else {
                console.error(data.message || 'Error creating appointment');
            }

        } catch (error) {
            console.error('Error creating appointment:', error);
        }
    }

    async loadAppointments() {
        try {
            const appointmentsContainer = document.getElementById('appointments-container');
            if (!appointmentsContainer) {
                return;
            }

            const response = await fetch('/api/appointments', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                if (data.appointments.length === 0) {
                    appointmentsContainer.innerHTML = `
                        <div class="empty-message">
                            <div class="empty-icon">Calendar</div>
                            <h4>No Appointments Yet</h4>
                            <p>You don't have any appointments scheduled. Create your first appointment to get started!</p>
                            <button onclick="dashboard.switchTab('new-appointment')" class="primary-btn">
                                <span class="btn-icon">+</span>
                                <span class="btn-text">Schedule Now</span>
                            </button>
                        </div>
                    `;
                } else {
                    this.displayAppointments(data.appointments);
                }
            } else {
                appointmentsContainer.innerHTML = `
                    <div class="error-message">
                        <p>Error loading appointments: ${data.message}</p>
                        <button onclick="dashboard.loadAppointments()" class="secondary-btn">Try again</button>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error loading appointments:', error);
            const appointmentsContainer = document.getElementById('appointments-container');
            if (appointmentsContainer) {
                appointmentsContainer.innerHTML = `
                    <div class="error-message">
                        <p>Connection error. Please check your internet connection.</p>
                        <button onclick="dashboard.loadAppointments()" class="secondary-btn">Try again</button>
                    </div>
                `;
            }
        }
    }

    displayAppointments(appointments) {
        this.currentAppointments = appointments;

        const appointmentsContainer = document.getElementById('appointments-container');
        appointments.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

        appointmentsContainer.innerHTML = appointments.map(appointment => {
            // Sanitize all appointment data
            const sanitizedAppointment = this.sanitizeObject(appointment);

            // Parse date correctly without timezone issues
            const [year, month, day] = sanitizedAppointment.date.split('-');
            const appointmentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

            const formattedDate = appointmentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const statusText = this.getStatusText(sanitizedAppointment.status);
            const statusClass = this.getStatusClass(sanitizedAppointment.status);

            const appointmentDateTime = new Date(`${sanitizedAppointment.date}T${sanitizedAppointment.time}`);
            const now = new Date();
            const timeDiff = appointmentDateTime.getTime() - now.getTime();
            const hoursDiff = timeDiff / (1000 * 3600);
            const canCancel = sanitizedAppointment.status === 'pending' && hoursDiff >= 24;

            return `
                <div class="appointment-card" data-appointment-id="${sanitizedAppointment.id}">
                    <div class="appointment-header">
                        <div class="appointment-date">
                            <h3>${formattedDate}</h3>
                            <p class="appointment-time">${sanitizedAppointment.time}</p>
                        </div>
                        <div class="appointment-status ${statusClass}">
                            ${statusText}
                        </div>
                    </div>
                    <div class="appointment-details">
                        ${sanitizedAppointment.serviceType ? `
                            <div class="service-type">
                                <strong>Service:</strong> ${this.getServiceTypeText(sanitizedAppointment.serviceType)}
                            </div>
                        ` : ''}
                        <div class="description">
                            <strong>Description:</strong> ${sanitizedAppointment.description}
                        </div>
                        ${sanitizedAppointment.adminResponse ? `
                            <div class="admin-response">
                                <strong>Admin response:</strong> ${sanitizedAppointment.adminResponse}
                            </div>
                        ` : ''}
                        ${sanitizedAppointment.estimatedPrice ? `
                            <div class="estimated-price">
                                <strong>Estimated price:</strong> ${sanitizedAppointment.estimatedPrice}
                            </div>
                        ` : ''}
                        ${sanitizedAppointment.vehicle ? `
                            <div class="vehicle-info">
                                <strong>Vehicle:</strong> ${sanitizedAppointment.vehicle.brand} ${sanitizedAppointment.vehicle.model} (${sanitizedAppointment.vehicle.year})${sanitizedAppointment.vehicle.is_electric ? ' Electric' : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="appointment-actions">
                        ${canCancel ? `
                            <button class="secondary-btn" onclick="dashboard.cancelAppointment('${sanitizedAppointment.id}')">
                                Cancel
                            </button>
                        ` : ''}
                       <button class="primary-btn" onclick="dashboard.viewAppointmentDetails('${sanitizedAppointment.id}')">
                            Details
                       </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'approved': 'Approved',
            'confirmed': 'Confirmed',
            'rejected': 'Rejected',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    getStatusClass(status) {
        return `status-${status}`;
    }

    getServiceTypeText(serviceType) {
        const serviceMap = {
            'mentenanta': 'General Maintenance',
            'reparatii': 'Repairs',
            'diagnoza': 'Diagnosis',
            'piese': 'Parts Replacement',
            'general': 'General Service'
        };
        return serviceMap[serviceType] || serviceType;
    }

    async cancelAppointment(appointmentId) {
        if (!confirm('Are you sure you want to cancel this appointment?')) {
            return;
        }

        try {
            const response = await fetch(`/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'cancelled' })
            });

            const data = await response.json();

            if (data.success) {
                console.log('Appointment cancelled successfully');
                this.loadAppointments();
            } else {
                console.error(data.message || 'Error cancelling appointment');
            }

        } catch (error) {
            console.error('Error cancelling appointment:', error);
        }
    }

    viewAppointmentDetails(appointmentId) {
        const appointments = this.currentAppointments || [];
        const appointment = appointments.find(apt => apt.id == appointmentId);

        if (!appointment) {
            alert('Appointment not found');
            return;
        }

        const sanitizedAppointment = this.sanitizeObject(appointment);

        const modal = document.getElementById('appointment-modal');
        const detailsContainer = document.getElementById('appointment-details');

        if (!modal || !detailsContainer) {
            const details = `
Appointment Details:

Date: ${sanitizedAppointment.date}
Time: ${sanitizedAppointment.time}
Service: ${this.getServiceTypeText(sanitizedAppointment.serviceType)}
Status: ${this.getStatusText(sanitizedAppointment.status)}
Description: ${sanitizedAppointment.description}
${sanitizedAppointment.adminResponse ? '\nAdmin response: ' + sanitizedAppointment.adminResponse : ''}
${sanitizedAppointment.estimatedPrice ? '\nEstimated price: RON' + sanitizedAppointment.estimatedPrice : ''}
${sanitizedAppointment.vehicle ? '\nVehicle: ' + sanitizedAppointment.vehicle.brand + ' ' + sanitizedAppointment.vehicle.model + ' (' + sanitizedAppointment.vehicle.year + ')' : ''}
Created: ${new Date(sanitizedAppointment.createdAt).toLocaleDateString('en-US')}
            `;
            alert(details);
            return;
        }

        const [year, month, day] = sanitizedAppointment.date.split('-');
        const appointmentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const appointmentDateTime = new Date(`${sanitizedAppointment.date}T${sanitizedAppointment.time}`);
        const now = new Date();
        const timeDiff = appointmentDateTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);
        const canCancel = sanitizedAppointment.status === 'pending' && hoursDiff >= 1;

        const detailsHTML = `
        <div class="detail-item">
            <div class="detail-label">Date and Time:</div>
            <div class="detail-value">
                <strong>${formattedDate}</strong> at <strong>${sanitizedAppointment.time}</strong>
            </div>
        </div>

        <div class="detail-item">
            <div class="detail-label">Status:</div>
            <div class="detail-value">
                <span class="appointment-status ${this.getStatusClass(sanitizedAppointment.status)}">
                    ${this.getStatusText(sanitizedAppointment.status)}
                </span>
            </div>
        </div>

        <div class="detail-item">
            <div class="detail-label">Service Type:</div>
            <div class="detail-value">${this.getServiceTypeText(sanitizedAppointment.serviceType)}</div>
        </div>

        <div class="detail-item">
            <div class="detail-label">Problem Description:</div>
            <div class="detail-value">${sanitizedAppointment.description}</div>
        </div>

        ${sanitizedAppointment.adminResponse ? `
            <div class="detail-item">
                <div class="detail-label">Administrator Response:</div>
                <div class="detail-value" style="background-color: #e8f5e8; border-left: 4px solid var(--success);">
                    ${sanitizedAppointment.adminResponse}
                </div>
            </div>
        ` : ''}

        ${sanitizedAppointment.estimatedPrice ? `
            <div class="detail-item">
                <div class="detail-label">Estimated Price:</div>
                <div class="detail-value">
                    <strong style="color: var(--success); font-size: 1.2em;">
                        ${sanitizedAppointment.estimatedPrice}
                    </strong>
                </div>
            </div>
        ` : ''}

        ${sanitizedAppointment.estimatedCompletionTime ? `
            <div class="detail-item">
                <div class="detail-label">Estimated Completion Date:</div>
                <div class="detail-value">
                    ${new Date(sanitizedAppointment.estimatedCompletionTime).toLocaleDateString('en-US')}
                </div>
            </div>
        ` : ''}

        ${sanitizedAppointment.vehicle ? `
            <div class="detail-item">
                <div class="detail-label">Vehicle:</div>
                <div class="detail-value">
                    <strong>${sanitizedAppointment.vehicle.brand} ${sanitizedAppointment.vehicle.model}</strong> 
                    (${sanitizedAppointment.vehicle.year}) - ${sanitizedAppointment.vehicle.vehicle_type || sanitizedAppointment.vehicle.type}
                    ${sanitizedAppointment.vehicle.is_electric ? ' Electric' : ''}
                    ${sanitizedAppointment.vehicle.notes ? `<br><small>Notes: ${sanitizedAppointment.vehicle.notes}</small>` : ''}
                </div>
            </div>
        ` : ''}

        <div class="detail-item">
            <div class="detail-label">Creation Date:</div>
            <div class="detail-value">
                ${new Date(sanitizedAppointment.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}
            </div>
        </div>

        ${canCancel ? `
            <div class="form-actions" style="margin-top: 20px;">
                <button class="secondary-btn" onclick="dashboard.cancelAppointmentFromModal('${sanitizedAppointment.id}')">
                    Cancel Appointment
                </button>
            </div>
        ` : ''}
        `;

        detailsContainer.innerHTML = detailsHTML;
        modal.style.display = 'flex';
    }

    cancelAppointmentFromModal(appointmentId) {
        const modal = document.getElementById('appointment-modal');
        modal.style.display = 'none';
        this.cancelAppointment(appointmentId);
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/homepage';
        }
    }

    startTokenValidationInterval() {
        setInterval(() => {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) {
                window.location.href = 'login.html';
            }
        }, 60000);
    }
}

const dashboard = new Dashboard();