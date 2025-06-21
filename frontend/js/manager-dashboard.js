class ManagerDashboard {
    constructor() {
        this.requestsContainer = document.getElementById('requests-container');
        this.logoutBtn = document.getElementById('logout-btn');

        this.viewModal = document.getElementById('view-request-modal');
        this.approveModal = document.getElementById('approve-request-modal');
        this.rejectModal = document.getElementById('reject-request-modal');

        this.pendingCount = document.getElementById('pending-count');
        this.approvedCount = document.getElementById('approved-count');
        this.rejectedCount = document.getElementById('rejected-count');

        this.allRequests = [];
        this.currentRequestId = null;

        this.init();
    }

    init() {
        this.checkAuth();
        this.loadRequests();
        this.setupEventListeners();
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = this.getUser();

        if (!token || !user) {
            window.location.href = '/login';
            return;
        }

        if (!['admin', 'manager'].includes(user.role)) {
            window.location.href = '/login';
            return;
        }
    }

    getUser() {
        try {
            const userString = localStorage.getItem('user');
            return userString ? JSON.parse(userString) : null;
        } catch (error) {
            return null;
        }
    }

    async loadRequests() {
        try {
            const token = localStorage.getItem('token');

            const response = await fetch('/api/manager/requests', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to load requests');
            }

            const data = await response.json();

            this.allRequests = data.requests || data.data || [];
            this.renderRequests();
            this.updateStats();

        } catch (error) {
            console.error('Failed to load requests:', error);
            this.allRequests = [];
            this.renderRequests();
        }
    }

    setupEventListeners() {
        this.logoutBtn.addEventListener('click', () => this.handleLogout());

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        [this.viewModal, this.approveModal, this.rejectModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        document.getElementById('approve-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmApproval();
        });

        document.getElementById('reject-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmRejection();
        });
    }

    renderRequests() {
        if (this.allRequests.length === 0) {
            this.requestsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No requests found</h3>
                    <p>There are currently no registration requests to review.</p>
                </div>
            `;
            return;
        }

        this.requestsContainer.innerHTML = '';

        this.allRequests.forEach(request => {
            const card = this.createRequestCard(request);
            this.requestsContainer.appendChild(card);
        });
    }

    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = 'request-card';

        const isPending = request.status === 'pending';
        const approveBtn = isPending ? `<button type="button" class="action-btn approve-btn" onclick="dashboard.showApproveModal(${request.id})">Approve</button>` : '';
        const rejectBtn = isPending ? `<button type="button" class="action-btn reject-btn" onclick="dashboard.showRejectModal(${request.id})">Reject</button>` : '';

        card.innerHTML = `
            <div class="request-header">
                <div class="request-info">
                    <h4>${this.escapeHtml(request.first_name)} ${this.escapeHtml(request.last_name)}</h4>
                    <div class="request-email">${this.escapeHtml(request.email)}</div>
                </div>
            </div>

            <div class="request-details">
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${this.escapeHtml(request.phone || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <span class="status-badge status-${request.status}">${this.escapeHtml(request.status)}</span>
                    </span>
                </div>
                ${request.assigned_role ? `
                <div class="detail-row">
                    <span class="detail-label">Assigned Role:</span>
                    <span class="detail-value">${this.escapeHtml(request.assigned_role)}</span>
                </div>
                ` : ''}
            </div>

            ${request.message ? `
            <div class="request-message">
                <p>${this.escapeHtml(request.message)}</p>
            </div>
            ` : ''}

            <div class="request-actions">
                <button type="button" class="action-btn view-btn" onclick="dashboard.viewRequest(${request.id})">View Details</button>
                ${approveBtn}
                ${rejectBtn}
            </div>
        `;

        return card;
    }

    updateStats() {
        const pending = this.allRequests.filter(r => r.status === 'pending').length;
        const approved = this.allRequests.filter(r => r.status === 'approved').length;
        const rejected = this.allRequests.filter(r => r.status === 'rejected').length;

        this.pendingCount.textContent = pending;
        this.approvedCount.textContent = approved;
        this.rejectedCount.textContent = rejected;
    }

    viewRequest(requestId) {
        const request = this.allRequests.find(r => r.id === requestId);
        if (!request) return;

        const modalBody = document.getElementById('request-details');
        modalBody.innerHTML = `
            <div class="basic-info">
                <h3>Personal Info</h3>
                <p><strong>Name:</strong> ${this.escapeHtml(request.first_name)} ${this.escapeHtml(request.last_name)}</p>
                <p><strong>Email:</strong> ${this.escapeHtml(request.email)}</p>
                <p><strong>Phone:</strong> ${this.escapeHtml(request.phone || 'N/A')}</p>
                <p><strong>Requested Role:</strong> ${this.escapeHtml(request.requested_role || request.role)}</p>
                ${request.assigned_role ? `<p><strong>Assigned Role:</strong> ${this.escapeHtml(request.assigned_role)}</p>` : ''}
                
                ${request.message ? `
                <h3>Message</h3>
                <p>${this.escapeHtml(request.message)}</p>
                ` : ''}
                
                <h3>Details</h3>
                <p><strong>Status:</strong> <span class="status-badge status-${request.status}">${this.escapeHtml(request.status)}</span></p>
                <p><strong>Requested:</strong> ${this.formatDate(request.created_at)}</p>
                ${request.processed_at ? `<p><strong>Processed:</strong> ${this.formatDate(request.processed_at)}</p>` : ''}
                ${request.manager_message ? `<p><strong>Manager Note:</strong> ${this.escapeHtml(request.manager_message)}</p>` : ''}
            </div>
        `;

        this.showModal(this.viewModal);
    }

    showApproveModal(requestId) {
        this.currentRequestId = requestId;

        const request = this.allRequests.find(r => r.id === requestId);
        if (request) {
            document.getElementById('assign-role').value = request.requested_role || request.role;
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

        const assignedRole = document.getElementById('assign-role').value;

        if (!assignedRole) {
            alert('Please select a role for the user');
            return;
        }

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`/api/manager/requests/${this.currentRequestId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assigned_role: assignedRole
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(`Request approved! User assigned role: ${assignedRole}`);
                this.closeAllModals();
                this.loadRequests();
            } else {
                alert(data.message || 'Failed to approve request');
            }

        } catch (error) {
            console.error('Approval error:', error);
            alert('Failed to approve request');
        }
    }

    async confirmRejection() {
        if (!this.currentRequestId) return;

        const rejectionMessage = document.getElementById('reject-message').value.trim();

        if (!rejectionMessage) {
            alert('Please provide a reason for rejection');
            return;
        }

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`/api/manager/requests/${this.currentRequestId}/reject`, {
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

            if (data.success) {
                alert('Request rejected successfully!');
                this.closeAllModals();
                this.loadRequests();
            } else {
                alert(data.message || 'Failed to reject request');
            }

        } catch (error) {
            console.error('Rejection error:', error);
            alert('Failed to reject request');
        }
    }

    showModal(modal) {
        modal.style.display = 'flex';
    }

    closeAllModals() {
        [this.viewModal, this.approveModal, this.rejectModal].forEach(modal => {
            modal.style.display = 'none';
        });
        this.currentRequestId = null;
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/homepage';
        }
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ro-RO');
        } catch (error) {
            return 'Invalid date';
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
}

const dashboard = new ManagerDashboard();