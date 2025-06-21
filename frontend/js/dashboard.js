class Dashboard {
    constructor() {
        this.token = null;
        this.user = {};
        this.currentAppointments = [];
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
            userNameElement.textContent = this.sanitizeInput(this.user.first_name);
        }
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn[data-tab]').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.getAttribute('data-tab'));
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Form handlers
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

        // Schedule now button
        const scheduleBtn = document.querySelector('.schedule-now-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => {
                this.switchTab('new-appointment');
            });
        }
    }

    switchTab(targetTab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const targetTabBtn = document.querySelector(`[data-tab="${targetTab}"].tab-btn`);
        if (targetTabBtn) {
            targetTabBtn.classList.add('active');
        }

        // Switch tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        const targetPane = document.getElementById(targetTab);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    async loadVehicles() {
        try {
            const response = await fetch('/api/vehicles', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                this.populateVehicleSelect(data.vehicles);
            }
        } catch (error) {
            console.error('Error loading vehicles:', error);
        }
    }

    populateVehicleSelect(vehicles) {
        const select = document.getElementById('existing-vehicle');
        if (!select) return;

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

    async loadAvailableSlots() {
        const dateInput = document.getElementById('appointment-date');
        const timeSelect = document.getElementById('appointment-time');

        if (!dateInput || !timeSelect || !dateInput.value) return;

        try {
            timeSelect.innerHTML = '<option value="">Loading...</option>';

            const response = await fetch(`/api/calendar/available-slots?date=${dateInput.value}`, {
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

            // Create new vehicle if needed
            if (!vehicleId && appointmentData.vehicle_type) {
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
                    await this.loadVehicles();
                } else {
                    alert(vehicleResult.message || 'Error creating vehicle');
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
                timeSelect.innerHTML = '<option value="">Select date first</option>';
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
                    appointmentsContainer.innerHTML = `
                        <div class="empty-message">
                            <h4>No Appointments Yet</h4>
                            <p>You don't have any appointments scheduled.</p>
                            <button onclick="dashboard.switchTab('new-appointment')" class="primary-btn">
                                Schedule Now
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
                        <p>Connection error. Please try again.</p>
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
            const sanitizedAppointment = this.sanitizeObject(appointment);

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
                body: JSON.stringify({status: 'cancelled'})
            });

            const data = await response.json();

            if (data.success) {
                alert('Appointment cancelled successfully');
                this.loadAppointments();
            } else {
                alert(data.message || 'Error cancelling appointment');
            }
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            alert('Error cancelling appointment');
        }
    }


    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/homepage';
        }
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