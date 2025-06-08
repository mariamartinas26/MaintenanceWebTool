class AdminDashboard {
    constructor() {
        this.appointments = [];
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

    async loadAppointments() {
        try {
            this.showLoading();

            // Get token from localStorage (compatibil cu login-ul tău)
            const token = localStorage.getItem('token');
            if (!token) {
                this.showError('Nu ești autentificat. Te redirectez la login...');
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
                    'Authorization': `Bearer ${token}`, // Folosește token-ul din localStorage
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.status === 401) {
                this.showError('Sesiunea a expirat. Te redirectez la login...');
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
                this.showError('Eroare la încărcarea programărilor: ' + data.message);
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
            this.showError('Eroare de conexiune. Vă rugăm să încercați din nou.');
        } finally {
            this.hideLoading();
        }
    }

    renderAppointments() {
        const container = document.getElementById('appointments-container');

        if (this.appointments.length === 0) {
            container.innerHTML = `
                <div class="no-appointments">
                    <p>Nu au fost găsite programări pentru filtrele selectate.</p>
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
        const formattedDate = appointmentDate.toLocaleDateString('ro-RO', {
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
                        Vezi detalii
                    </button>
                    <button class="manage-btn" data-id="${appointment.id}">
                        Gestionează
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
                this.showError('Eroare la încărcarea detaliilor: ' + data.message);
            }
        } catch (error) {
            console.error('Error fetching appointment details:', error);
            this.showError('Eroare de conexiune.');
        }
    }

    displayAppointmentDetails(appointment) {
        const detailsContainer = document.getElementById('appointment-details');

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('ro-RO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        detailsContainer.innerHTML = `
            <div class="detail-section">
                <h3>Informații Client</h3>
                <div class="detail-item">
                    <div class="detail-label">Nume:</div>
                    <div class="detail-value">${appointment.clientInfo.name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email:</div>
                    <div class="detail-value">${appointment.clientInfo.email}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Telefon:</div>
                    <div class="detail-value">${appointment.clientInfo.phone || 'Nu a fost specificat'}</div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Detalii Programare</h3>
                <div class="detail-item">
                    <div class="detail-label">Data și Ora:</div>
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
                <h3>Informații Vehicul</h3>
                <div class="detail-item">
                    <div class="detail-label">Tip:</div>
                    <div class="detail-value">${appointment.vehicleInfo.type || 'Nu a fost specificat'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Marcă și Model:</div>
                    <div class="detail-value">${appointment.vehicleInfo.brand} ${appointment.vehicleInfo.model}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">An:</div>
                    <div class="detail-value">${appointment.vehicleInfo.year || 'Nu a fost specificat'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Electric:</div>
                    <div class="detail-value">${appointment.vehicleInfo.isElectric ? 'Da' : 'Nu'}</div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Descrierea Problemei</h3>
                <div class="detail-item">
                    <div class="detail-value">${appointment.problemDescription}</div>
                </div>
            </div>

            ${appointment.adminResponse ? `
                <div class="detail-section">
                    <h3>Răspuns Admin</h3>
                    <div class="detail-item">
                        <div class="detail-value">${appointment.adminResponse}</div>
                    </div>
                </div>
            ` : ''}

            ${appointment.estimatedPrice ? `
                <div class="detail-section">
                    <h3>Informații Aprobare</h3>
                    <div class="detail-item">
                        <div class="detail-label">Preț Estimativ:</div>
                        <div class="detail-value">${appointment.estimatedPrice} RON</div>
                    </div>
                    ${appointment.warrantyInfo ? `
                        <div class="detail-item">
                            <div class="detail-label">Garanție:</div>
                            <div class="detail-value">${appointment.warrantyInfo}</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            ${appointment.mediaFiles && appointment.mediaFiles.length > 0 ? `
                <div class="detail-section">
                    <h3>Fișiere Atașate</h3>
                    <div class="attachments-list">
                        ${appointment.mediaFiles.map(file => `
                            <div class="attachment-item">
                                <span>📎</span>
                                <a href="${file.filePath}" target="_blank">${file.fileName}</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
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
                this.showError('Eroare la încărcarea detaliilor: ' + data.message);
            }
        } catch (error) {
            console.error('Error fetching appointment details:', error);
            this.showError('Eroare de conexiune.');
        }
    }

    populateManageForm(appointment) {
        document.getElementById('appointment-id').value = appointment.id;
        document.getElementById('client-name').value = appointment.clientInfo.name;
        document.getElementById('service-type').value = `${appointment.vehicleInfo.type} ${appointment.vehicleInfo.brand} ${appointment.vehicleInfo.model}`;

        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('ro-RO', {
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
        if (appointment.adminResponse) {
            document.getElementById('admin-message').value = appointment.adminResponse;
        }
    }

    handleStatusChange(e) {
        const status = e.target.value;
        const approvalFields = document.getElementById('approval-fields');
        const rejectionFields = document.getElementById('rejection-fields');

        // Hide all conditional fields first
        approvalFields.style.display = 'none';
        rejectionFields.style.display = 'none';

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
                status: status,
                adminMessage: document.getElementById('admin-message').value
            };

            if (status === 'approved') {
                updateData.estimatedPrice = parseFloat(document.getElementById('estimated-price').value);
                updateData.warranty = parseInt(document.getElementById('warranty').value);

                if (!updateData.estimatedPrice || updateData.estimatedPrice <= 0) {
                    this.showError('Prețul estimativ este obligatoriu pentru aprobare');
                    return;
                }
                if (!updateData.warranty || updateData.warranty < 0) {
                    this.showError('Garanția este obligatorie pentru aprobare');
                    return;
                }
            }

            if (status === 'rejected') {
                updateData.rejectionReason = document.getElementById('rejection-reason').value;
                updateData.retryDays = parseInt(document.getElementById('retry-days').value) || 0;

                if (!updateData.rejectionReason) {
                    this.showError('Motivul respingerii este obligatoriu');
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
                this.showError('Eroare la actualizare: ' + data.message);
            }

        } catch (error) {
            console.error('Error updating appointment:', error);
            this.showError('Eroare de conexiune.');
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

        // Hide conditional fields
        const approvalFields = document.getElementById('approval-fields');
        const rejectionFields = document.getElementById('rejection-fields');
        if (approvalFields) approvalFields.style.display = 'none';
        if (rejectionFields) rejectionFields.style.display = 'none';
    }

    getStatusText(status) {
        const statusTexts = {
            'pending': 'În așteptare',
            'approved': 'Aprobat',
            'rejected': 'Respins',
            'completed': 'Finalizat',
            'cancelled': 'Anulat'
        };
        return statusTexts[status] || status;
    }

    showLoading() {
        const container = document.getElementById('appointments-container');
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Se încarcă programările...</p>
            </div>
        `;
    }

    hideLoading() {
        // Loading will be hidden when appointments are rendered
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
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
        if (confirm('Sunteți sigur că doriți să vă delogați?')) {
            // Clear stored authentication data (compatibil cu login-ul tău)
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect to login page
            window.location.href = '/login';
        }
    }

    handleAuthError() {
        this.showError('Sesiunea a expirat. Te redirectez la login...');
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

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});

// Add notification styles to the page
const notificationStyles = `
<style>
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 1000;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.notification.show {
    transform: translateX(0);
}

.notification-error {
    background-color: #dc3545;
}

.notification-success {
    background-color: #28a745;
}

.notification-info {
    background-color: #17a2b8;
}

.notification-close {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    margin-left: 10px;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--text-light);
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--light-gray);
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 15px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.no-appointments {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-light);
}

.no-appointments p {
    font-size: 16px;
    margin: 0;
}

/* Additional responsive styles for notifications */
@media (max-width: 576px) {
    .notification {
        right: 10px;
        left: 10px;
        max-width: none;
        transform: translateY(-100%);
    }
    
    .notification.show {
        transform: translateY(0);
    }
}
</style>
`;

// Inject styles into the page
document.head.insertAdjacentHTML('beforeend', notificationStyles);