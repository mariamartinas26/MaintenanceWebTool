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
    setupEventListeners();

    function initializeDashboard() {
        console.log('Dashboard initialized for user:', user.first_name);
    }

    function loadUserInfo() {
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && user.first_name) {
            userNameElement.textContent = user.first_name;
        }
    }

    function setupEventListeners() {
        const closeModal = document.querySelector('.close-modal');
        const modal = document.getElementById('appointment-modal');

        if (closeModal && modal) {
            // Event listener pentru butonul X
            closeModal.addEventListener('click', function() {
                modal.style.display = 'none';
            });

            // Event listener pentru click în afara modal-ului
            window.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });

            // Event listener pentru tasta Escape
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modal.style.display === 'flex') {
                    modal.style.display = 'none';
                }
            });
        }
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');

                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Update active tab pane
                tabPanes.forEach(pane => pane.classList.remove('active'));
                const targetPane = document.getElementById(targetTab);
                if (targetPane) {
                    targetPane.classList.add('active');
                }
            });
        });

        // New appointment button - redirect to schedule page
        const newAppointmentBtn = document.getElementById('new-appointment-btn');
        if (newAppointmentBtn) {
            newAppointmentBtn.addEventListener('click', function() {
                window.location.href = '/schedule';
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }

        // Refresh appointments button
        const refreshBtn = document.getElementById('refresh-appointments');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadAppointments);
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
                            <p>Nu ai încă programări. Creează prima ta programare!</p>
                            <button onclick="window.location.href='/schedule'" class="primary-btn">
                                Programează acum
                            </button>
                        </div>
                    `;
                } else {
                    displayAppointments(data.appointments);
                }
            } else {
                appointmentsContainer.innerHTML = `
                    <div class="error-message">
                        <p>Eroare la încărcarea programărilor: ${data.message}</p>
                        <button onclick="loadAppointments()" class="secondary-btn">Încearcă din nou</button>
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
                        <p>Eroare de conexiune. Te rog verifică conexiunea la internet.</p>
                        <button onclick="loadAppointments()" class="secondary-btn">Încearcă din nou</button>
                    </div>
                `;
            }
            showLoading(false);
        }
    }

    function displayAppointments(appointments) {
        window.currentAppointments = appointments;

        const appointmentsContainer = document.getElementById('appointments-container');
        // Sortează programările după dată (cele mai recente primul)
        appointments.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

        appointmentsContainer.innerHTML = appointments.map(appointment => {
            const appointmentDate = new Date(appointment.date);
            const formattedDate = appointmentDate.toLocaleDateString('ro-RO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const statusText = getStatusText(appointment.status);
            const statusClass = getStatusClass(appointment.status);

            // Calculează dacă programarea poate fi anulată (24h înainte)
            const appointmentDateTime = new Date(appointment.date + 'T' + appointment.time);
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
                                <strong>Serviciu:</strong> ${getServiceTypeText(appointment.serviceType)}
                            </div>
                        ` : ''}
                        <div class="description">
                            <strong>Descriere:</strong> ${appointment.description}
                        </div>
                        ${appointment.adminResponse ? `
                            <div class="admin-response">
                                <strong>Răspuns admin:</strong> ${appointment.adminResponse}
                            </div>
                        ` : ''}
                        ${appointment.estimatedPrice ? `
                            <div class="estimated-price">
                                <strong>Preț estimat:</strong> ${appointment.estimatedPrice} RON
                            </div>
                        ` : ''}
                        ${appointment.vehicle ? `
                            <div class="vehicle-info">
                                <strong>Vehicul:</strong> ${appointment.vehicle.brand} ${appointment.vehicle.model} (${appointment.vehicle.year})
                            </div>
                        ` : ''}
                        <div class="created-at">
                            <small>Creat: ${new Date(appointment.createdAt).toLocaleDateString('ro-RO')}</small>
                        </div>
                    </div>
                    <div class="appointment-actions">
                        ${canCancel ? `
                            <button class="secondary-btn" onclick="cancelAppointment('${appointment.id}')">
                                Anulează
                            </button>
                        ` : ''}
                       <button class="primary-btn" onclick="viewAppointmentDetails('${appointment.id}')">
                            Detalii
                       </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getStatusText(status) {
        const statusMap = {
            'pending': 'În așteptare',
            'approved': 'Aprobată',
            'rejected': 'Respinsă',
            'completed': 'Finalizată',
            'cancelled': 'Anulată'
        };
        return statusMap[status] || status;
    }

    function getStatusClass(status) {
        return `status-${status}`;
    }

    function getServiceTypeText(serviceType) {
        const serviceMap = {
            'mentenanta': 'Mentenanță Generală',
            'reparatii': 'Reparații',
            'diagnoza': 'Diagnoză',
            'piese': 'Înlocuire Piese',
            'general': 'Serviciu General'
        };
        return serviceMap[serviceType] || serviceType;
    }

    // Funcții globale pentru butoanele din HTML
    window.cancelAppointment = async function(appointmentId) {
        if (!confirm('Ești sigur că vrei să anulezi această programare?')) {
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
                showMessage('Programarea a fost anulată cu succes', 'success');
                loadAppointments(); // Reîncarcă lista
            } else {
                showMessage(data.message || 'Eroare la anularea programării', 'error');
            }

            showLoading(false);

        } catch (error) {
            console.error('Error cancelling appointment:', error);
            showMessage('Eroare de rețea. Te rog încearcă din nou.', 'error');
            showLoading(false);
        }
    };

    // Înlocuiește funcția viewAppointmentDetails în dashboard.js cu:

    window.viewAppointmentDetails = function(appointmentId) {
        // Găsește programarea în lista curentă de programări
        const appointments = window.currentAppointments || []; // Păstrează referința la programări
        const appointment = appointments.find(apt => apt.id == appointmentId);

        if (!appointment) {
            alert('Programarea nu a fost găsită');
            return;
        }

        // Populează modal-ul cu detaliile programării
        const modal = document.getElementById('appointment-modal');
        const detailsContainer = document.getElementById('appointment-details');

        if (!modal || !detailsContainer) {
            // Fallback la alert dacă modal-ul nu există
            const details = `
Detalii Programare:

Data: ${appointment.date}
Ora: ${appointment.time}
Serviciu: ${getServiceTypeText(appointment.serviceType)}
Status: ${getStatusText(appointment.status)}
Descriere: ${appointment.description}
${appointment.adminResponse ? '\nRăspuns admin: ' + appointment.adminResponse : ''}
${appointment.estimatedPrice ? '\nPreț estimat: ' + appointment.estimatedPrice + ' RON' : ''}
${appointment.vehicle ? '\nVehicul: ' + appointment.vehicle.brand + ' ' + appointment.vehicle.model + ' (' + appointment.vehicle.year + ')' : ''}
Creat: ${new Date(appointment.createdAt).toLocaleDateString('ro-RO')}
        `;
            alert(details);
            return;
        }

        // Formatează data pentru afișare
        const appointmentDate = new Date(appointment.date);
        const formattedDate = appointmentDate.toLocaleDateString('ro-RO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Calculează dacă programarea poate fi anulată
        const appointmentDateTime = new Date(appointment.date + 'T' + appointment.time);
        const now = new Date();
        const timeDiff = appointmentDateTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);
        const canCancel = appointment.status === 'pending' && hoursDiff >= 1;

        // Creează conținutul modal-ului
        detailsContainer.innerHTML = `
        <div class="detail-item">
            <div class="detail-label">Data și Ora:</div>
            <div class="detail-value">
                <strong>${formattedDate}</strong> la <strong>${appointment.time}</strong>
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
            <div class="detail-label">Tip Serviciu:</div>
            <div class="detail-value">${getServiceTypeText(appointment.serviceType)}</div>
        </div>

        <div class="detail-item">
            <div class="detail-label">Descrierea Problemei:</div>
            <div class="detail-value">${appointment.description}</div>
        </div>

        ${appointment.adminResponse ? `
            <div class="detail-item">
                <div class="detail-label">Răspuns Administrator:</div>
                <div class="detail-value" style="background-color: #e8f5e8; border-left: 4px solid var(--success);">
                    ${appointment.adminResponse}
                </div>
            </div>
        ` : ''}

        ${appointment.estimatedPrice ? `
            <div class="detail-item">
                <div class="detail-label">Preț Estimat:</div>
                <div class="detail-value">
                    <strong style="color: var(--success); font-size: 1.2em;">
                        ${appointment.estimatedPrice} RON
                    </strong>
                </div>
            </div>
        ` : ''}

        ${appointment.estimatedCompletionTime ? `
            <div class="detail-item">
                <div class="detail-label">Data Estimată de Finalizare:</div>
                <div class="detail-value">
                    ${new Date(appointment.estimatedCompletionTime).toLocaleDateString('ro-RO')}
                </div>
            </div>
        ` : ''}

        ${appointment.vehicle ? `
            <div class="detail-item">
                <div class="detail-label">Vehicul:</div>
                <div class="detail-value">
                    <strong>${appointment.vehicle.brand} ${appointment.vehicle.model}</strong> 
                    (${appointment.vehicle.year}) - ${appointment.vehicle.type}
                </div>
            </div>
        ` : ''}

        <div class="detail-item">
            <div class="detail-label">Data Creării:</div>
            <div class="detail-value">
                ${new Date(appointment.createdAt).toLocaleDateString('ro-RO', {
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
                    Anulează Programarea
                </button>
            </div>
        ` : ''}
    `;

        // Afișează modal-ul
        modal.style.display = 'flex';
    };

// Funcție pentru anularea din modal
    window.cancelAppointmentFromModal = function(appointmentId) {
        const modal = document.getElementById('appointment-modal');
        modal.style.display = 'none';

        // Apelează funcția de anulare existentă
        cancelAppointment(appointmentId);
    };

    // Fă funcția loadAppointments globală pentru a putea fi apelată din HTML
    window.loadAppointments = loadAppointments;

    function logout() {
        if (confirm('Ești sigur că vrei să te deconectezi?')) {
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
            // Fallback la alert dacă toast-ul nu există
            alert(message);
        }
    }

    // Check token validity periodically
    setInterval(function() {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            window.location.href = 'login.html';
        }
    }, 60000); // Check every minute
});