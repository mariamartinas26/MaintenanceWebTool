document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || !user.id) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize dashboard
    initializeDashboard();
    loadUserInfo();
    loadAppointments();
    loadUserVehicles();
    setupEventListeners();
    setupFormHandlers();
    setupMobileMenu();

    function initializeDashboard() {
        console.log('Dashboard initialized for user:', user.first_name);

        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('appointment-date');
        if (dateInput) {
            dateInput.min = today;
        }
    }

    function loadUserInfo() {
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && user.first_name) {
            userNameElement.textContent = user.first_name;
        }
    }

    async function loadUserVehicles() {
        try {
            const response = await fetch('/api/vehicles', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                populateVehicleSelect(data.vehicles);
            } else {
                console.error('Error loading vehicles:', data.message);
            }

        } catch (error) {
            console.error('Error loading vehicles:', error);
        }
    }

    function populateVehicleSelect(vehicles) {
        const select = document.getElementById('existing-vehicle');
        if (!select) return;

        // Clear existing options except the first one
        select.innerHTML = '<option value="">Select vehicle or add a new one</option>';

        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.id;
            option.textContent = `${vehicle.brand} ${vehicle.model} (${vehicle.year}) - ${vehicle.vehicle_type}${vehicle.is_electric ? ' Electric' : ''}`;
            select.appendChild(option);
        });
    }

    function setupMobileMenu() {
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
        const mobileNavClose = document.getElementById('mobile-nav-close');

        if (mobileMenuToggle && mobileNavOverlay) {
            mobileMenuToggle.addEventListener('click', function() {
                mobileNavOverlay.style.display = 'block';
            });
        }

        if (mobileNavClose && mobileNavOverlay) {
            mobileNavClose.addEventListener('click', function() {
                mobileNavOverlay.style.display = 'none';
            });
        }

        if (mobileNavOverlay) {
            mobileNavOverlay.addEventListener('click', function(e) {
                if (e.target === mobileNavOverlay) {
                    mobileNavOverlay.style.display = 'none';
                }
            });
        }

        // Mobile nav links
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                if (targetTab) {
                    // Update active states for mobile nav
                    mobileNavLinks.forEach(l => l.classList.remove('active'));
                    this.classList.add('active');

                    // Switch tab
                    switchTab(targetTab);

                    // Close mobile menu
                    mobileNavOverlay.style.display = 'none';
                }
            });
        });

        // Mobile logout button
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', logout);
        }

        // Mobile contact button
        const mobileContactBtn = document.getElementById('mobile-contact-btn');
        if (mobileContactBtn) {
            mobileContactBtn.addEventListener('click', function() {
                showContactModal();
                mobileNavOverlay.style.display = 'none';
            });
        }
    }

    function setupEventListeners() {
        // Contact modal
        const contactBtn = document.getElementById('contact-btn');
        const contactModal = document.getElementById('contact-modal');
        const closeContactModal = document.getElementById('close-contact-modal');

        if (contactBtn) {
            contactBtn.addEventListener('click', showContactModal);
        }

        if (closeContactModal && contactModal) {
            closeContactModal.addEventListener('click', function() {
                contactModal.style.display = 'none';
            });

            window.addEventListener('click', function(e) {
                if (e.target === contactModal) {
                    contactModal.style.display = 'none';
                }
            });
        }

        // Appointment modal
        const appointmentModal = document.getElementById('appointment-modal');
        const closeAppointmentModal = appointmentModal?.querySelector('.close-modal');

        if (closeAppointmentModal && appointmentModal) {
            closeAppointmentModal.addEventListener('click', function() {
                appointmentModal.style.display = 'none';
            });

            window.addEventListener('click', function(e) {
                if (e.target === appointmentModal) {
                    appointmentModal.style.display = 'none';
                }
            });

            document.addEventListener('keydown', function(e) {
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

        // Navigation tab switching
        const navLinks = document.querySelectorAll('.nav-link[data-tab]');
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetTab = this.getAttribute('data-tab');

                // Update active states for main nav
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');

                switchTab(targetTab);
            });
        });

        // Tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                switchTab(targetTab);
            });
        });

        // New appointment button
        const newAppointmentBtn = document.getElementById('new-appointment-btn');
        if (newAppointmentBtn) {
            newAppointmentBtn.addEventListener('click', function() {
                switchTab('new-appointment');
            });
        }

        // Logout buttons
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
                    resetForm();
                    switchTab('appointments');
                }
            });
        }
    }

    function switchTab(targetTab) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        const targetTabBtn = document.querySelector(`[data-tab="${targetTab}"].tab-btn`);
        if (targetTabBtn) {
            targetTabBtn.classList.add('active');
        }

        // Update nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        const targetNavLink = document.querySelector(`[data-tab="${targetTab}"].nav-link`);
        if (targetNavLink) {
            targetNavLink.classList.add('active');
        }

        // Switch tab panes
        const tabPanes = document.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => pane.classList.remove('active'));
        const targetPane = document.getElementById(targetTab);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    function showContactModal() {
        const contactModal = document.getElementById('contact-modal');
        if (contactModal) {
            contactModal.style.display = 'flex';
        }
    }

    function setupFormHandlers() {
        // Date change handler - load available slots
        const dateInput = document.getElementById('appointment-date');
        if (dateInput) {
            dateInput.addEventListener('change', loadAvailableSlots);
        }

        // Existing vehicle selection handler
        const existingVehicleSelect = document.getElementById('existing-vehicle');
        if (existingVehicleSelect) {
            existingVehicleSelect.addEventListener('change', function() {
                const newVehicleSection = document.getElementById('new-vehicle-section');
                if (this.value) {
                    // Hide new vehicle form and clear its values
                    if (newVehicleSection) {
                        newVehicleSection.style.display = 'none';
                    }
                    clearNewVehicleForm();
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
            appointmentForm.addEventListener('submit', handleFormSubmission);
        }
    }

    async function loadAvailableSlots() {
        const dateInput = document.getElementById('appointment-date');
        const timeSelect = document.getElementById('appointment-time');

        if (!dateInput || !timeSelect || !dateInput.value) return;

        try {
            timeSelect.innerHTML = '<option value="">Loading...</option>';

            const response = await fetch(`/api/calendar/available-slots?date=${dateInput.value}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                timeSelect.innerHTML = '<option value="">Select time</option>';

                if (data.availableSlots.length === 0) {
                    timeSelect.innerHTML = '<option value="">No slots available</option>';
                    if (data.message) {
                        showMessage(data.message, 'warning');
                    }
                } else {
                    data.availableSlots.forEach(slot => {
                        const option = document.createElement('option');
                        option.value = slot.startTime;
                        option.textContent = `${slot.startTime} (${slot.availableSpots} slots available)`;
                        timeSelect.appendChild(option);
                    });
                }
            } else {
                timeSelect.innerHTML = '<option value="">Error loading</option>';
                showMessage(data.message || 'Error loading slots', 'error');
            }

        } catch (error) {
            console.error('Error loading available slots:', error);
            timeSelect.innerHTML = '<option value="">Error loading</option>';
            showMessage('Error loading available slots', 'error');
        }
    }

    function clearNewVehicleForm() {
        const fields = ['vehicle-type', 'brand', 'model', 'year', 'vehicle-notes'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });

        const isElectricCheckbox = document.getElementById('is-electric');
        if (isElectricCheckbox) isElectricCheckbox.checked = false;
    }

    function resetForm() {
        const form = document.getElementById('appointment-form');
        if (form) {
            form.reset();
            clearNewVehicleForm();

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

    async function handleFormSubmission(e) {
        e.preventDefault();

        try {
            showLoading(true);

            // Collect form data
            const formData = new FormData(e.target);
            const appointmentData = Object.fromEntries(formData);

            // Validate required fields
            if (!appointmentData.date || !appointmentData.time || !appointmentData.description) {
                showMessage('Please fill in all required fields', 'error');
                showLoading(false);
                return;
            }

            if (appointmentData.description.length < 10) {
                showMessage('Description must contain at least 10 characters', 'error');
                showLoading(false);
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
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(vehicleData)
                });

                const vehicleResult = await vehicleResponse.json();

                if (vehicleResult.success) {
                    vehicleId = vehicleResult.vehicle.id;
                    // Refresh vehicles list
                    await loadUserVehicles();
                } else {
                    showMessage(vehicleResult.message || 'Error creating vehicle', 'error');
                    showLoading(false);
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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appointmentPayload)
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Appointment created successfully!', 'success');
                resetForm();
                loadAppointments();
                // Switch back to appointments tab
                switchTab('appointments');
            } else {
                showMessage(data.message || 'Error creating appointment', 'error');
            }

            showLoading(false);

        } catch (error) {
            console.error('Error creating appointment:', error);
            showMessage('Network error. Please try again.', 'error');
            showLoading(false);
        }
    }

    async function loadAppointments() {
        try {
            showLoading(true);

            const appointmentsContainer = document.getElementById('appointments-container');
            if (!appointmentsContainer) {
                showLoading(false);
                return;
            }

            const response = await fetch('/api/appointments', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
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
                            <button onclick="switchTabGlobal('new-appointment')" class="primary-btn">
                                <span class="btn-icon">+</span>
                                <span class="btn-text">Schedule Now</span>
                            </button>
                        </div>
                    `;
                } else {
                    displayAppointments(data.appointments);
                }
            } else {
                appointmentsContainer.innerHTML = `
                    <div class="error-message">
                        <p>Error loading appointments: ${data.message}</p>
                        <button onclick="loadAppointmentsGlobal()" class="secondary-btn">Try again</button>
                    </div>
                `;
            }

            showLoading(false);

        } catch (error) {
            console.error('Error loading appointments:', error);
            const appointmentsContainer = document.getElementById('appointments-container');
            if (appointmentsContainer) {
                appointmentsContainer.innerHTML = `
                    <div class="error-message">
                        <p>Connection error. Please check your internet connection.</p>
                        <button onclick="loadAppointmentsGlobal()" class="secondary-btn">Try again</button>
                    </div>
                `;
            }
            showLoading(false);
        }
    }

    function displayAppointments(appointments) {
        window.currentAppointments = appointments;

        const appointmentsContainer = document.getElementById('appointments-container');
        appointments.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

        appointmentsContainer.innerHTML = appointments.map(appointment => {
            // Parse date correctly without timezone issues
            const [year, month, day] = appointment.date.split('-');
            const appointmentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

            const formattedDate = appointmentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const statusText = getStatusText(appointment.status);
            const statusClass = getStatusClass(appointment.status);

            const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
            const now = new Date();
            const timeDiff = appointmentDateTime.getTime() - now.getTime();
            const hoursDiff = timeDiff / (1000 * 3600);
            const canCancel = appointment.status === 'pending' && hoursDiff >= 24;

            return `
                <div class="appointment-card" data-appointment-id="${appointment.id}">
                    <div class="appointment-header">
                        <div class="appointment-date">
                            <h3>${formattedDate}</h3>
                            <p class="appointment-time">${appointment.time}</p>
                        </div>
                        <div class="appointment-status ${statusClass}">
                            ${statusText}
                        </div>
                    </div>
                    <div class="appointment-details">
                        ${appointment.serviceType ? `
                            <div class="service-type">
                                <strong>Service:</strong> ${getServiceTypeText(appointment.serviceType)}
                            </div>
                        ` : ''}
                        <div class="description">
                            <strong>Description:</strong> ${appointment.description}
                        </div>
                        ${appointment.adminResponse ? `
                            <div class="admin-response">
                                <strong>Admin response:</strong> ${appointment.adminResponse}
                            </div>
                        ` : ''}
                        ${appointment.estimatedPrice ? `
                            <div class="estimated-price">
                                <strong>Estimated price:</strong> $${appointment.estimatedPrice}
                            </div>
                        ` : ''}
                        ${appointment.vehicle ? `
                            <div class="vehicle-info">
                                <strong>Vehicle:</strong> ${appointment.vehicle.brand} ${appointment.vehicle.model} (${appointment.vehicle.year})${appointment.vehicle.is_electric ? ' Electric' : ''}
                            </div>
                        ` : ''}
                        <div class="created-at">
                            <small>Created: ${new Date(appointment.createdAt).toLocaleDateString('en-US')}</small>
                        </div>
                    </div>
                    <div class="appointment-actions">
                        ${canCancel ? `
                            <button class="secondary-btn" onclick="cancelAppointment('${appointment.id}')">
                                Cancel
                            </button>
                        ` : ''}
                       <button class="primary-btn" onclick="viewAppointmentDetails('${appointment.id}')">
                            Details
                       </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getStatusText(status) {
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

    function getStatusClass(status) {
        return `status-${status}`;
    }

    function getServiceTypeText(serviceType) {
        const serviceMap = {
            'mentenanta': 'General Maintenance',
            'reparatii': 'Repairs',
            'diagnoza': 'Diagnosis',
            'piese': 'Parts Replacement',
            'general': 'General Service'
        };
        return serviceMap[serviceType] || serviceType;
    }

    // Global functions for HTML buttons
    window.cancelAppointment = async function(appointmentId) {
        if (!confirm('Are you sure you want to cancel this appointment?')) {
            return;
        }

        try {
            showLoading(true);

            const response = await fetch(`/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'cancelled' })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Appointment cancelled successfully', 'success');
                loadAppointments();
            } else {
                showMessage(data.message || 'Error cancelling appointment', 'error');
            }

            showLoading(false);

        } catch (error) {
            console.error('Error cancelling appointment:', error);
            showMessage('Network error. Please try again.', 'error');
            showLoading(false);
        }
    };

    window.viewAppointmentDetails = function(appointmentId) {
        const appointments = window.currentAppointments || [];
        const appointment = appointments.find(apt => apt.id == appointmentId);

        if (!appointment) {
            alert('Appointment not found');
            return;
        }

        const modal = document.getElementById('appointment-modal');
        const detailsContainer = document.getElementById('appointment-details');

        if (!modal || !detailsContainer) {
            const details = `
Appointment Details:

Date: ${appointment.date}
Time: ${appointment.time}
Service: ${getServiceTypeText(appointment.serviceType)}
Status: ${getStatusText(appointment.status)}
Description: ${appointment.description}
${appointment.adminResponse ? '\nAdmin response: ' + appointment.adminResponse : ''}
${appointment.estimatedPrice ? '\nEstimated price: $' + appointment.estimatedPrice : ''}
${appointment.vehicle ? '\nVehicle: ' + appointment.vehicle.brand + ' ' + appointment.vehicle.model + ' (' + appointment.vehicle.year + ')' : ''}
Created: ${new Date(appointment.createdAt).toLocaleDateString('en-US')}
        `;
            alert(details);
            return;
        }

        // Format date correctly for modal
        const [year, month, day] = appointment.date.split('-');
        const appointmentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
        const now = new Date();
        const timeDiff = appointmentDateTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);
        const canCancel = appointment.status === 'pending' && hoursDiff >= 1;

        detailsContainer.innerHTML = `
        <div class="detail-item">
            <div class="detail-label">Date and Time:</div>
            <div class="detail-value">
                <strong>${formattedDate}</strong> at <strong>${appointment.time}</strong>
            </div>
        </div>

        <div class="detail-item">
            <div class="detail-label">Status:</div>
            <div class="detail-value">
                <span class="appointment-status ${getStatusClass(appointment.status)}">
                    ${getStatusText(appointment.status)}
                </span>
            </div>
        </div>

        <div class="detail-item">
            <div class="detail-label">Service Type:</div>
            <div class="detail-value">${getServiceTypeText(appointment.serviceType)}</div>
        </div>

        <div class="detail-item">
            <div class="detail-label">Problem Description:</div>
            <div class="detail-value">${appointment.description}</div>
        </div>

        ${appointment.adminResponse ? `
            <div class="detail-item">
                <div class="detail-label">Administrator Response:</div>
                <div class="detail-value" style="background-color: #e8f5e8; border-left: 4px solid var(--success);">
                    ${appointment.adminResponse}
                </div>
            </div>
        ` : ''}

        ${appointment.estimatedPrice ? `
            <div class="detail-item">
                <div class="detail-label">Estimated Price:</div>
                <div class="detail-value">
                    <strong style="color: var(--success); font-size: 1.2em;">
                        $${appointment.estimatedPrice}
                    </strong>
                </div>
            </div>
        ` : ''}

        ${appointment.estimatedCompletionTime ? `
            <div class="detail-item">
                <div class="detail-label">Estimated Completion Date:</div>
                <div class="detail-value">
                    ${new Date(appointment.estimatedCompletionTime).toLocaleDateString('en-US')}
                </div>
            </div>
        ` : ''}

        ${appointment.vehicle ? `
            <div class="detail-item">
                <div class="detail-label">Vehicle:</div>
                <div class="detail-value">
                    <strong>${appointment.vehicle.brand} ${appointment.vehicle.model}</strong> 
                    (${appointment.vehicle.year}) - ${appointment.vehicle.vehicle_type || appointment.vehicle.type}
                    ${appointment.vehicle.is_electric ? ' Electric' : ''}
                    ${appointment.vehicle.notes ? `<br><small>Notes: ${appointment.vehicle.notes}</small>` : ''}
                </div>
            </div>
        ` : ''}

        <div class="detail-item">
            <div class="detail-label">Creation Date:</div>
            <div class="detail-value">
                ${new Date(appointment.createdAt).toLocaleDateString('en-US', {
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
                <button class="secondary-btn" onclick="cancelAppointmentFromModal('${appointment.id}')">
                    Cancel Appointment
                </button>
            </div>
        ` : ''}
    `;

        modal.style.display = 'flex';
    };

    window.cancelAppointmentFromModal = function(appointmentId) {
        const modal = document.getElementById('appointment-modal');
        modal.style.display = 'none';
        cancelAppointment(appointmentId);
    };

    // Make functions globally accessible
    window.loadAppointments = loadAppointments;
    window.loadAppointmentsGlobal = loadAppointments;
    window.loadUserVehicles = loadUserVehicles;
    window.switchTabGlobal = switchTab;

    function logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/homepage';
        }
    }

    function showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }

    function showMessage(message, type = 'info') {
        const toast = document.getElementById('message-toast');
        const messageText = document.getElementById('message-text');

        if (toast && messageText) {
            messageText.textContent = message;
            toast.className = `message-toast ${type}`;
            toast.style.display = 'block';

            setTimeout(() => {
                toast.style.display = 'none';
            }, 4000);
        } else {
            alert(message);
        }
    }

    // Check token validity periodically
    setInterval(function() {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            window.location.href = 'login.html';
        }
    }, 60000);
});