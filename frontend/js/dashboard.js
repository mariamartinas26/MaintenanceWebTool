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

    createElement(tag, className = '', textContent = '') {
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
        //pt tab
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
        //afisez tab ul corespunzator
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
            //dropdown cu vehicule
            this.populateVehicleDropdown(data.vehicles.map(vehicle => this.sanitizeObject(vehicle)));
        }
    }

    populateVehicleDropdown(vehicles) {
        const select = document.getElementById('existing-vehicle');
        if (!select) return;

        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        this.safeSetText(defaultOption, 'Select vehicle or add a new one');
        select.appendChild(defaultOption);

        //adaug fiecare vehicul ca optiune
        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = String(vehicle.id);

            const brand = vehicle.brand || '';
            const model = vehicle.model || '';
            const year = vehicle.year || '';

            this.safeSetText(option, `${brand} ${model} (${year})`);
            select.appendChild(option);
        });
    }

    async loadAvailableSlots() {
        const dateInput = document.getElementById('appointment-date');
        const timeSelect = document.getElementById('appointment-time');

        if (!dateInput || !timeSelect || !dateInput.value) return;

        try {
            while (timeSelect.firstChild) {
                timeSelect.removeChild(timeSelect.firstChild);
            }

            const response = await fetch(`/api/calendar/available-slots?date=${encodeURIComponent(dateInput.value)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            while (timeSelect.firstChild) {
                timeSelect.removeChild(timeSelect.firstChild);
            }

            if (data.success) {
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                this.safeSetText(defaultOption, 'Select time');
                timeSelect.appendChild(defaultOption);
                //daca nu exista sloturi disponibile
                if (data.availableSlots.length === 0) {
                    const noSlotsOption = document.createElement('option');
                    noSlotsOption.value = '';
                    this.safeSetText(noSlotsOption, 'No slots available');
                    timeSelect.appendChild(noSlotsOption);
                } else {
                    data.availableSlots.forEach(slot => {
                        const sanitizedSlot = this.sanitizeObject(slot);
                        const option = document.createElement('option');
                        option.value = sanitizedSlot.startTime; //creez o optiune pt fiecare slot disponibil
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

            //daca nu am selectat un vehicul existent si avem date pentru un vehicul nou
            if (!vehicleId && appointmentData.vehicle_type) {
                const vehicleData = this.sanitizeObject({
                    vehicle_type: appointmentData.vehicle_type,
                    brand: appointmentData.brand,
                    model: appointmentData.model,
                    year: parseInt(appointmentData.year),
                    is_electric: appointmentData.is_electric === 'on',
                    notes: appointmentData.notes || null
                });
                //trimitem cererea pt a crea noul vehicul
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
                    vehicleId = vehicleResult.vehicle.id; //salvez id ul vehicului creat
                    await this.loadVehicles();
                } else {
                    alert(vehicleResult.message || 'Error creating vehicle');
                    return;
                }
            }

            const appointment = this.sanitizeObject({
                date: appointmentData.date,
                time: appointmentData.time,
                serviceType: appointmentData.serviceType,
                description: appointmentData.description,
                vehicleId: vehicleId || null
            });
            //creez noua programare cu vehiculul existent sau cel nou
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appointment)
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
            alert('Error creating appointment');
        }
    }

    resetForm() {
        const form = document.getElementById('appointment-form');
        if (form) {
            form.reset();

            const timeSelect = document.getElementById('appointment-time');
            if (timeSelect) {
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

            //face o cerere la backend
            const response = await fetch('/api/appointments', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                //verific daca nu am nicio programare
                if (data.appointments.length === 0) {
                    this.displayEmptyAppointments(appointmentsContainer);
                } else {
                    this.displayAppointments(data.appointments.map(appointment => this.sanitizeObject(appointment)));
                }
            } else {
                this.displayAppointmentsError(appointmentsContainer, data.message);
            }
        } catch (error) {
            const appointmentsContainer = document.getElementById('appointments-container');
            if (appointmentsContainer) {
                this.displayAppointmentsError(appointmentsContainer, 'Connection error');
            }
        }
    }

    displayEmptyAppointments(container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const emptyMessage = this.createElement('div', 'empty-message');
        const h4 = this.createElement('h4', '', 'No Appointments Yet');
        const p = this.createElement('p', '', "You don't have any appointments scheduled.");
        const button = this.createElement('button', 'primary-btn', 'Schedule Now');
        button.onclick = () => this.switchTab('new-appointment');

        emptyMessage.appendChild(h4);
        emptyMessage.appendChild(p);
        emptyMessage.appendChild(button);
        container.appendChild(emptyMessage);
    }

    displayAppointmentsError(container, message) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const errorMessage = this.createElement('div', 'error-message');
        const p = this.createElement('p', '', `Error loading appointments: ${message}`);
        const button = this.createElement('button', 'secondary-btn', 'Try again');
        button.onclick = () => this.loadAppointments();

        errorMessage.appendChild(p);
        errorMessage.appendChild(button);
        container.appendChild(errorMessage);
    }

    displayAppointments(appointments) {
        const appointmentsContainer = document.getElementById('appointments-container');

        while (appointmentsContainer.firstChild) {
            appointmentsContainer.removeChild(appointmentsContainer.firstChild);
        }
        //ordonez cronologic
        appointments.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

        appointments.forEach(appointment => {
            const appointmentCard = this.createAppointmentCard(appointment);
            appointmentsContainer.appendChild(appointmentCard);
        });
    }

    createAppointmentCard(appointment) {
        const appointmentCard = this.createElement('div', 'appointment-card');
        appointmentCard.setAttribute('data-appointment-id', String(appointment.id));

        const [year, month, day] = appointment.date.split('-');
        const appointmentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        //header
        const appointmentHeader = this.createElement('div', 'appointment-header');

        const appointmentDateDiv = this.createElement('div', 'appointment-date');
        const h3 = this.createElement('h3', '', formattedDate);
        const timeP = this.createElement('p', 'appointment-time', appointment.time);
        appointmentDateDiv.appendChild(h3);
        appointmentDateDiv.appendChild(timeP);

        const statusText = this.getStatusText(appointment.status);
        const statusClass = this.getStatusClass(appointment.status); //pt css
        const appointmentStatus = this.createElement('div', `appointment-status ${statusClass}`, statusText);

        appointmentHeader.appendChild(appointmentDateDiv);
        appointmentHeader.appendChild(appointmentStatus);

        //detalii
        const appointmentDetails = this.createElement('div', 'appointment-details');

        //service type
        if (appointment.serviceType) {
            const serviceTypeDiv = this.createElement('div', 'service-type');
            const serviceStrong = this.createElement('strong', '', 'Service: ');
            serviceTypeDiv.appendChild(serviceStrong);
            serviceTypeDiv.appendChild(document.createTextNode(this.getServiceTypeText(appointment.serviceType)));
            appointmentDetails.appendChild(serviceTypeDiv);
        }

        //descriere
        const descriptionDiv = this.createElement('div', 'description');
        const descStrong = this.createElement('strong', '', 'Description: ');
        descriptionDiv.appendChild(descStrong);
        descriptionDiv.appendChild(document.createTextNode(appointment.description));
        appointmentDetails.appendChild(descriptionDiv);

        //raspuns de la admin
        if (appointment.adminResponse) {
            const adminResponseDiv = this.createElement('div', 'admin-response');
            const adminStrong = this.createElement('strong', '', 'Admin response: ');
            adminResponseDiv.appendChild(adminStrong);
            adminResponseDiv.appendChild(document.createTextNode(appointment.adminResponse));
            appointmentDetails.appendChild(adminResponseDiv);
        }

        //pret estimativ
        if (appointment.estimatedPrice) {
            const estimatedPriceDiv = this.createElement('div', 'estimated-price');
            const priceStrong = this.createElement('strong', '', 'Estimated price: ');
            estimatedPriceDiv.appendChild(priceStrong);
            estimatedPriceDiv.appendChild(document.createTextNode(appointment.estimatedPrice));
            appointmentDetails.appendChild(estimatedPriceDiv);
        }

        //info vehicul
        if (appointment.vehicle) {
            const vehicleInfoDiv = this.createElement('div', 'vehicle-info');
            const vehicleStrong = this.createElement('strong', '', 'Vehicle: ');
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

    //pt css
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