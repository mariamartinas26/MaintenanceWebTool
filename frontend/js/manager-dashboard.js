function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

function safeJsonParse(jsonString) {
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
            return sanitizeObject(parsed);
        }

        return parsed;
    } catch (error) {
        console.error('Error parsing JSON safely:', error);
        return null;
    }
}

function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return typeof obj === 'string' ? sanitizeInput(obj) : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizeInput(key);
        sanitized[sanitizedKey] = sanitizeObject(value);
    }

    return sanitized;
}

function validateToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return false;
    }

    const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    return jwtRegex.test(token);
}


class ManagerDashboard {
    constructor() {
        this.requestsContainer = document.getElementById('requests-container');
        this.logoutBtn = document.getElementById('logout-btn');

        this.viewModal = document.getElementById('view-request-modal');
        this.approveModal = document.getElementById('approve-request-modal');
        this.rejectModal = document.getElementById('reject-request-modal');
        this.closeModalBtns = document.querySelectorAll('.close-modal');

        this.pendingCount = document.getElementById('pending-count');
        this.approvedCount = document.getElementById('approved-count');
        this.rejectedCount = document.getElementById('rejected-count');

        this.allRequests = [];
        this.filteredRequests = [];
        this.currentRequestId = null;

        this.refreshInterval = null;

        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.checkManagerAuth();
            this.loadRequests();
            this.setupEventListeners();
            this.updateStats();
            this.startAutoRefresh();
        });
    }

    redirectBasedOnRole(role) {
        const routes = {
            admin: '/admin/dashboard',
            manager: null,
            accountant: '/accountant/dashboard',
            client: '/client/dashboard'
        };

        const sanitizedRole = sanitizeInput(role);
        const route = routes[sanitizedRole];

        if (route) {
            window.location.href = route;
        } else if (sanitizedRole === 'manager') {
            // Manager stays on current page
        } else {
            window.location.href = '/login';
        }
    }

    checkManagerAuth() {
        const token = localStorage.getItem('token');
        const userString = localStorage.getItem('user');

        if (!token || !validateToken(token)) {
            window.location.href = '/login';
            return;
        }

        const user = safeJsonParse(userString) || {};

        if (!['admin', 'manager'].includes(user.role)) {
            this.redirectBasedOnRole(user.role);
            return;
        }
    }

    async loadRequests() {
        try {
            const token = localStorage.getItem('token');
            if (!validateToken(token)) {
                throw new Error('Invalid token');
            }

            const response = await fetch('/api/manager/requests', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load requests');
            }

            const data = await response.json();
            // Sanitize the received data
            const sanitizedData = sanitizeObject(data);
            this.allRequests = sanitizedData.requests || [];
            this.filteredRequests = [...this.allRequests];
            this.renderRequests();
            this.updateStats();

        } catch (error) {
            console.error('Failed to load requests:', error);
            this.allRequests = [];
            this.filteredRequests = [];
            this.renderRequests();
        }
    }

    setupEventListeners() {
        this.logoutBtn.addEventListener('click', () => this.handleLogout());

        this.closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        [this.viewModal, this.approveModal, this.rejectModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        document.getElementById('confirm-approve-btn').addEventListener('click', () => this.confirmApproval());
        document.getElementById('confirm-reject-btn').addEventListener('click', () => this.confirmRejection());
    }

    renderRequests() {
        if (this.filteredRequests.length === 0) {
            this.requestsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No requests found</h3>
                </div>
            `;
            return;
        }

        this.requestsContainer.innerHTML = '';

        this.filteredRequests.forEach(request => {
            const card = this.createRequestCard(request);
            this.requestsContainer.appendChild(card);
        });
    }

    createRequestCard(request) {
        const template = document.getElementById('request-card-template');
        const card = template.content.cloneNode(true);

        // Use textContent for safe text insertion
        card.querySelector('.request-name').textContent = `${request.first_name} ${request.last_name}`;
        card.querySelector('.request-email').textContent = request.email;
        card.querySelector('.request-date').textContent = `Requested: ${this.formatDate(request.created_at)}`;
        card.querySelector('.phone-value').textContent = request.phone;

        const roleBadge = card.querySelector('.role-badge');
        if (request.status === 'approved' && request.assigned_role) {
            roleBadge.textContent = `Assigned: ${request.assigned_role}`;
            roleBadge.className = `role-badge role-${sanitizeInput(request.assigned_role)}`;
            roleBadge.title = `Originally requested: ${sanitizeInput(request.role)}`;
        } else {
            roleBadge.textContent = `Requested: ${request.role}`;
            roleBadge.className = `role-badge role-${sanitizeInput(request.role)}`;
        }

        const statusBadge = card.querySelector('.status-badge');
        statusBadge.textContent = request.status;
        statusBadge.className = `status-badge status-${sanitizeInput(request.status)}`;

        // Safe message handling
        if (request.message) {
            card.querySelector('.request-message').style.display = 'block';
            card.querySelector('.message-text').textContent = request.message;
        }

        card.querySelector('.view-btn').addEventListener('click', () => this.viewRequest(request.id));

        if (request.status === 'pending') {
            card.querySelector('.approve-btn').addEventListener('click', () => this.showApproveModal(request.id));
            card.querySelector('.reject-btn').addEventListener('click', () => this.showRejectModal(request.id));
        } else {
            card.querySelector('.approve-btn').style.display = 'none';
            card.querySelector('.reject-btn').style.display = 'none';
        }

        // Sanitize the request ID before setting it as attribute
        card.querySelector('.request-card').setAttribute('data-request-id', sanitizeInput(request.id.toString()));

        return card;
    }

    updateStats() {
        const pending = this.allRequests.filter(r => r.status === 'pending').length;
        const approved = this.allRequests.filter(r => r.status === 'approved').length;
        const rejected = this.allRequests.filter(r => r.status === 'rejected').length;

        this.pendingCount.textContent = pending.toString();
        this.approvedCount.textContent = approved.toString();
        this.rejectedCount.textContent = rejected.toString();
    }

    viewRequest(requestId) {
        const request = this.allRequests.find(r => r.id === requestId);
        if (!request) return;

        const template = document.getElementById('request-details-template');
        const details = template.content.cloneNode(true);

        // Use textContent for all user data
        details.querySelector('.full-name').textContent = `${request.first_name} ${request.last_name}`;
        details.querySelector('.email-value').textContent = request.email;
        details.querySelector('.phone-value').textContent = request.phone;
        details.querySelector('.role-value').textContent = request.role;
        details.querySelector('.request-date').textContent = this.formatDate(request.created_at);

        const statusBadge = details.querySelector('.status-badge');
        statusBadge.textContent = request.status;
        statusBadge.className = `status-badge status-${sanitizeInput(request.status)}`;

        if (request.message) {
            details.querySelector('.message-section').style.display = 'block';
            details.querySelector('.message-text').textContent = request.message;
        }

        if (request.processed_at) {
            details.querySelector('.processed-item').style.display = 'flex';
            details.querySelector('.processed-date').textContent = this.formatDate(request.processed_at);
        }

        if (request.manager_message) {
            details.querySelector('.admin-message-item').style.display = 'flex';
            details.querySelector('.admin-message').textContent = request.manager_message;
        }

        const modalBody = document.getElementById('request-details');
        modalBody.innerHTML = '';
        modalBody.appendChild(details);

        this.showModal(this.viewModal);
    }

    showApproveModal(requestId) {
        this.currentRequestId = requestId;

        document.getElementById('assign-role').value = '';
        document.getElementById('approve-message').value = '';

        const request = this.allRequests.find(r => r.id === requestId);
        if (request) {
            document.getElementById('assign-role').value = sanitizeInput(request.role);
        }

        this.showModal(this.approveModal);
    }

    showRejectModal(requestId) {
        this.currentRequestId = requestId;
        document.getElementById('reject-message').value = '';
        this.showModal(this.rejectModal);
    }

    async confirmApproval() {
        if (!this.currentRequestId) return;

        const assignedRole = sanitizeInput(document.getElementById('assign-role').value);
        const welcomeMessage = sanitizeInput(document.getElementById('approve-message').value.trim());

        if (!assignedRole) {
            alert('Please select a role for the user');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!validateToken(token)) {
                throw new Error('Invalid token');
            }

            const response = await fetch(`/api/manager/requests/${sanitizeInput(this.currentRequestId.toString())}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assigned_role: assignedRole,
                    manager_message: welcomeMessage
                })
            });

            const data = await response.json();
            const sanitizedData = sanitizeObject(data);

            if (sanitizedData.success) {
                alert(`Request approved! User assigned role: ${assignedRole}`);
                this.closeAllModals();
                this.loadRequests();
            } else {
                alert(sanitizedData.message || 'Failed to approve request');
            }

        } catch (error) {
            console.error('Approval error:', error);
            alert('Failed to approve request');
        }
    }

    async confirmRejection() {
        if (!this.currentRequestId) return;

        const rejectionMessage = sanitizeInput(document.getElementById('reject-message').value.trim());

        if (!rejectionMessage) {
            alert('Please provide a message for the user');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!validateToken(token)) {
                throw new Error('Invalid token');
            }

            const response = await fetch(`/api/manager/requests/${sanitizeInput(this.currentRequestId.toString())}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    manager_message: rejectionMessage
                })
            });

            const data = await response.json();
            const sanitizedData = sanitizeObject(data);

            if (sanitizedData.success) {
                alert('Request rejected successfully!');
                this.closeAllModals();
                this.loadRequests();
            } else {
                alert(sanitizedData.message || 'Failed to reject request');
            }

        } catch (error) {
            console.error('Rejection error:', error);
            alert('Failed to reject request');
        }
    }

    showModal(modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeAllModals() {
        [this.viewModal, this.approveModal, this.rejectModal].forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';

        document.getElementById('assign-role').value = '';
        document.getElementById('approve-message').value = '';
        document.getElementById('reject-message').value = '';

        this.currentRequestId = null;
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            this.stopAutoRefresh();
            window.location.href = '/homepage';
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadRequests();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Invalid date';
            }
            return date.toLocaleDateString('ro-RO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Invalid date';
        }
    }
}

const managerDashboard = new ManagerDashboard();