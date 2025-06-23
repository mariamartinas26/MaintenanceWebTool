class Dashboard {
    constructor() {
        this.token = null;
        this.user = {};
        this.initSecurityUtils();
        this.init();
    }

    initSecurityUtils() {
        this.sanitizeInput = function (input) {
            if (typeof input !== 'string') return input;
            return input
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        };

        this.safeJsonParse = function (jsonString) {
            try {
                if (!jsonString || typeof jsonString !== 'string') return null;
                if (/<script|javascript:|on\w+\s*=|data:/i.test(jsonString)) {
                    return null;
                }
                const parsed = JSON.parse(jsonString);
                if (typeof parsed === 'object' && parsed !== null) {
                    return this.sanitizeObject(parsed);
                }
                return parsed;
            } catch (error) {
                return null;
            }
        }.bind(this);

        this.sanitizeObject = function (obj) {
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

        this.validateToken = function (token) {
            if (!token || typeof token !== 'string') return false;
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
            return jwtRegex.test(token);
        };
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

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadUserInfo();
        this.loadAppointments();
        this.loadVehicles();
        this.setMinDate();
        this.startTokenValidation();
    }

    checkAuth() {
        this.token = localStorage.getItem('token');
        const userString = localStorage.getItem('user');
        this.user = userString ? this.safeJsonParse(userString) || {} : {};

        if (!this.token || !this.user.id) {
            window.location.href = '/login';
            return;
        }
    }

    setMinDate() {
        const dateInput = document.getElementById('appointment-date');
        if (dateInput) {
            dateInput.min = new Date().toISOString().split('T')[0];
        }
    }

    loadUserInfo() {
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && this.user.first_name) {
            this.safeSetText(userNameElement, this.user.first_name);
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.tab-btn[data-tab]').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.getAttribute('data-tab'));
            });
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        const appointmentForm = document.getElementById('appointment-form');
        if (appointmentForm) {
            appointmentForm.addEventListener('submit', (e) => this.handleFormSubmission(e));
        }

        const dateInput = document.getElementById('appointment-date');
        if (dateInput) {
            dateInput.addEventListener('change', () => this.loadAvailableSlots());
        }

        const existingVehicleSelect = document.getElementById('existing-vehicle');
        if (existingVehicleSelect) {
            existingVehicleSelect.addEventListener('change', () => {
                const newVehicleSection = document.getElementById('new-vehicle-section');
                if (existingVehicleSelect.value) {
                    newVehicleSection.style.display = 'none';
                } else {
                    newVehicleSection.style.display = 'block';
                }
            });
        }
    }

    switchTab(targetTab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const targetTabBtn = document.querySelector(`[data-tab="${targetTab}"].tab-btn`);
        if (targetTabBtn) {
            targetTabBtn.classList.add('active');
        }

        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        const targetPane = document.getElementById(targetTab);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    async loadVehicles() {
        const response = await fetch('/api/vehicles', {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            this.populateVehicleSelect(data.vehicles.map(vehicle => this.sanitizeObject(vehicle)));
        }
    }

    populateVehicleSelect(vehicles) {
        const select = document.getElementById('existing-vehicle');
        if (!select) return;

        // Clear existing content safely
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        this.safeSetText(defaultOption, 'Select vehicle or add a new one');
        select.appendChild(defaultOption);

        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = String(vehicle.id);

            const brand = vehicle.brand || '';
            const model = vehicle.model || '';
            const year = vehicle.year || '';
            const vehicleType = vehicle.vehicle_type || '';
            const electricText = vehicle.is_electric ? ' Electric' : '';

            this.safeSetText(option, `${brand} ${model} (${year}) - ${vehicleType}${electricText}`);
            select.appendChild(option);
        });
    }

    async loadAvailableSlots() {
        const dateInput = document.getElementById('appointment-date');
        const timeSelect = document.getElementById('appointment-time');

        if (!dateInput || !timeSelect || !dateInput.value) return;

        try {
            // Clear existing content safely
            while (timeSelect.firstChild) {
                timeSelect.removeChild(timeSelect.firstChild);
            }

            const loadingOption = document.createElement('option');
            loadingOption.value = '';
            this.safeSetText(loadingOption, 'Loading...');
            timeSelect.appendChild(loadingOption);

            const response = await fetch(`/api/calendar/available-slots?date=${encodeURIComponent(dateInput.value)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            // Clear loading option
            while (timeSelect.firstChild) {
                timeSelect.removeChild(timeSelect.firstChild);
            }

            if (data.success) {
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                this.safeSetText(defaultOption, 'Select time');
                timeSelect.appendChild(defaultOption);

                if (data.availableSlots.length === 0) {
                    const noSlotsOption = document.createElement('option');
                    noSlotsOption.value = '';
                    this.safeSetText(noSlotsOption, 'No slots available');
                    timeSelect.appendChild(noSlotsOption);
                } else {
                    data.availableSlots.forEach(slot => {
                        const sanitizedSlot = this.sanitizeObject(slot);
                        const option = document.createElement('option');
                        option.value = sanitizedSlot.startTime;
                        this.safeSetText(option, `${sanitizedSlot.startTime} (${sanitizedSlot.availableSpots} slots available)`);
                        timeSelect.appendChild(option);
                    });
                }
            } else {
                const errorOption = document.createElement('option');
                errorOption.value = '';
                this.safeSetText(errorOption, 'Error loading');
                timeSelect.appendChild(errorOption);
            }
        } catch (error) {
            // Clear existing content safely
            while (timeSelect.firstChild) {
                timeSelect.removeChild(timeSelect.firstChild);
            }

            const errorOption = document.createElement('option');
            errorOption.value = '';
            this.safeSetText(errorOption, 'Error loading');
            timeSelect.appendChild(errorOption);
        }
    }

    async handleFormSubmission(e) {
        e.preventDefault();

        try {
            const formData = new FormData(e.target);
            const appointmentData = Object.fromEntries(formData);

            if (!appointmentData.date || !appointmentData.time || !appointmentData.description) {
                alert('Please fill in all required fields');
                return;
            }

            if (appointmentData.description.length < 10) {
                alert('Description must contain at least 10 characters');
                return;
            }

            let vehicleId = appointmentData.vehicleId;

            if (!vehicleId && appointmentData.vehicle_type) {
                const vehicleData = this.sanitizeObject({
                    vehicle_type: appointmentData.vehicle_type,
                    brand: appointmentData.brand,
                    model: appointmentData.model,
                    year: parseInt(appointmentData.year),
                    is_electric: appointmentData.is_electric === 'on',
                    notes: appointmentData.notes || null
                });

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
                    await this.loadVehicles();
                } else {
                    alert(vehicleResult.message || 'Error creating vehicle');
                    return;
                }
            }

            const appointmentPayload = this.sanitizeObject({
                date: appointmentData.date,
                time: appointmentData.time,
                serviceType: appointmentData.serviceType,
                description: appointmentData.description,
                vehicleId: vehicleId || null
            });

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
                alert('Appointment created successfully!');
                this.resetForm();
                this.loadAppointments();
                this.switchTab('appointments');
            } else {
                alert(data.message || 'Error creating appointment');
            }
        } catch (error) {
            console.error('Error creating appointment:', error);
            alert('Error creating appointment');
        }
    }

    resetForm() {
        const form = document.getElementById('appointment-form');
        if (form) {
            form.reset();

            const timeSelect = document.getElementById('appointment-time');
            if (timeSelect) {
                // Clear existing content safely
                while (timeSelect.firstChild) {
                    timeSelect.removeChild(timeSelect.firstChild);
                }

                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                this.safeSetText(defaultOption, 'Select date first');
                timeSelect.appendChild(defaultOption);
            }

            const newVehicleSection = document.getElementById('new-vehicle-section');
            if (newVehicleSection) {
                newVehicleSection.style.display = 'block';
            }
        }
    }

    async loadAppointments() {
        try {
            const appointmentsContainer = document.getElementById('appointments-container');
            if (!appointmentsContainer) return;

            const response = await fetch('/api/appointments', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                if (data.appointments.length === 0) {
                    this.displayEmptyAppointments(appointmentsContainer);
                } else {
                    this.displayAppointments(data.appointments.map(appointment => this.sanitizeObject(appointment)));
                }
            } else {
                this.displayAppointmentsError(appointmentsContainer, data.message);
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
            const appointmentsContainer = document.getElementById('appointments-container');
            if (appointmentsContainer) {
                this.displayAppointmentsError(appointmentsContainer, 'Connection error. Please try again.');
            }
        }
    }

    displayEmptyAppointments(container) {
        // Clear existing content safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const emptyMessage = this.createSafeElement('div', 'empty-message');
        const h4 = this.createSafeElement('h4', '', 'No Appointments Yet');
        const p = this.createSafeElement('p', '', "You don't have any appointments scheduled.");
        const button = this.createSafeElement('button', 'primary-btn', 'Schedule Now');
        button.onclick = () => this.switchTab('new-appointment');

        emptyMessage.appendChild(h4);
        emptyMessage.appendChild(p);
        emptyMessage.appendChild(button);
        container.appendChild(emptyMessage);
    }

    displayAppointmentsError(container, message) {
        // Clear existing content safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const errorMessage = this.createSafeElement('div', 'error-message');
        const p = this.createSafeElement('p', '', `Error loading appointments: ${message}`);
        const button = this.createSafeElement('button', 'secondary-btn', 'Try again');
        button.onclick = () => this.loadAppointments();

        errorMessage.appendChild(p);
        errorMessage.appendChild(button);
        container.appendChild(errorMessage);
    }

    displayAppointments(appointments) {
        this.currentAppointments = appointments;
        const appointmentsContainer = document.getElementById('appointments-container');

        // Clear existing content safely
        while (appointmentsContainer.firstChild) {
            appointmentsContainer.removeChild(appointmentsContainer.firstChild);
        }

        appointments.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

        appointments.forEach(appointment => {
            const appointmentCard = this.createAppointmentCard(appointment);
            appointmentsContainer.appendChild(appointmentCard);
        });
    }

    createAppointmentCard(appointment) {
        const appointmentCard = this.createSafeElement('div', 'appointment-card');
        appointmentCard.setAttribute('data-appointment-id', String(appointment.id));

        // Parse and format date
        const [year, month, day] = appointment.date.split('-');
        const appointmentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Appointment header
        const appointmentHeader = this.createSafeElement('div', 'appointment-header');

        const appointmentDateDiv = this.createSafeElement('div', 'appointment-date');
        const h3 = this.createSafeElement('h3', '', formattedDate);
        const timeP = this.createSafeElement('p', 'appointment-time', appointment.time);
        appointmentDateDiv.appendChild(h3);
        appointmentDateDiv.appendChild(timeP);

        const statusText = this.getStatusText(appointment.status);
        const statusClass = this.getStatusClass(appointment.status);
        const appointmentStatus = this.createSafeElement('div', `appointment-status ${statusClass}`, statusText);

        appointmentHeader.appendChild(appointmentDateDiv);
        appointmentHeader.appendChild(appointmentStatus);

        // Appointment details
        const appointmentDetails = this.createSafeElement('div', 'appointment-details');

        // Service type (if exists)
        if (appointment.serviceType) {
            const serviceTypeDiv = this.createSafeElement('div', 'service-type');
            const serviceStrong = this.createSafeElement('strong', '', 'Service: ');
            serviceTypeDiv.appendChild(serviceStrong);
            serviceTypeDiv.appendChild(document.createTextNode(this.getServiceTypeText(appointment.serviceType)));
            appointmentDetails.appendChild(serviceTypeDiv);
        }

        // Description
        const descriptionDiv = this.createSafeElement('div', 'description');
        const descStrong = this.createSafeElement('strong', '', 'Description: ');
        descriptionDiv.appendChild(descStrong);
        descriptionDiv.appendChild(document.createTextNode(appointment.description));
        appointmentDetails.appendChild(descriptionDiv);

        // Admin response (if exists)
        if (appointment.adminResponse) {
            const adminResponseDiv = this.createSafeElement('div', 'admin-response');
            const adminStrong = this.createSafeElement('strong', '', 'Admin response: ');
            adminResponseDiv.appendChild(adminStrong);
            adminResponseDiv.appendChild(document.createTextNode(appointment.adminResponse));
            appointmentDetails.appendChild(adminResponseDiv);
        }

        // Estimated price (if exists)
        if (appointment.estimatedPrice) {
            const estimatedPriceDiv = this.createSafeElement('div', 'estimated-price');
            const priceStrong = this.createSafeElement('strong', '', 'Estimated price: ');
            estimatedPriceDiv.appendChild(priceStrong);
            estimatedPriceDiv.appendChild(document.createTextNode(appointment.estimatedPrice));
            appointmentDetails.appendChild(estimatedPriceDiv);
        }

        // Vehicle info (if exists)
        if (appointment.vehicle) {
            const vehicleInfoDiv = this.createSafeElement('div', 'vehicle-info');
            const vehicleStrong = this.createSafeElement('strong', '', 'Vehicle: ');
            const vehicleText = `${appointment.vehicle.brand} ${appointment.vehicle.model} (${appointment.vehicle.year})${appointment.vehicle.is_electric ? ' Electric' : ''}`;
            vehicleInfoDiv.appendChild(vehicleStrong);
            vehicleInfoDiv.appendChild(document.createTextNode(vehicleText));
            appointmentDetails.appendChild(vehicleInfoDiv);
        }

        appointmentCard.appendChild(appointmentHeader);
        appointmentCard.appendChild(appointmentDetails);

        return appointmentCard;
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'approved': 'Approved',
            'confirmed': 'Confirmed',
            'rejected': 'Rejected',
            'completed': 'Completed',
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
            'piese': 'Parts Replacement',
        };
        return serviceMap[serviceType] || serviceType;
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.clear();
        window.location.href = '/homepage';
    }

    startTokenValidation() {
        setInterval(() => {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) {
                window.location.href = '/login';
            }
        }, 60000);
    }
}

const dashboard = new Dashboard();