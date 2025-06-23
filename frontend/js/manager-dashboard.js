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

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    sanitizeObject(obj) {
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

            this.allRequests = (data.requests || data.data || []).map(request => this.sanitizeObject(request));
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
        // Clear existing content safely
        while (this.requestsContainer.firstChild) {
            this.requestsContainer.removeChild(this.requestsContainer.firstChild);
        }

        if (this.allRequests.length === 0) {
            const emptyState = this.createSafeElement('div', 'empty-state');
            const h3 = this.createSafeElement('h3', '', 'No requests found');
            const p = this.createSafeElement('p', '', 'There are currently no registration requests to review.');

            emptyState.appendChild(h3);
            emptyState.appendChild(p);
            this.requestsContainer.appendChild(emptyState);
            return;
        }

        this.allRequests.forEach(request => {
            const card = this.createRequestCard(request);
            this.requestsContainer.appendChild(card);
        });
    }

    createRequestCard(request) {
        const card = this.createSafeElement('div', 'request-card');

        // Request header
        const requestHeader = this.createSafeElement('div', 'request-header');
        const requestInfo = this.createSafeElement('div', 'request-info');

        const h4 = this.createSafeElement('h4', '', `${request.first_name || ''} ${request.last_name || ''}`);
        const requestEmail = this.createSafeElement('div', 'request-email', request.email || '');

        requestInfo.appendChild(h4);
        requestInfo.appendChild(requestEmail);
        requestHeader.appendChild(requestInfo);

        // Request details
        const requestDetails = this.createSafeElement('div', 'request-details');

        // Phone detail row
        const phoneRow = this.createSafeElement('div', 'detail-row');
        const phoneLabel = this.createSafeElement('span', 'detail-label', 'Phone:');
        const phoneValue = this.createSafeElement('span', 'detail-value', request.phone || 'N/A');
        phoneRow.appendChild(phoneLabel);
        phoneRow.appendChild(phoneValue);

        // Status detail row
        const statusRow = this.createSafeElement('div', 'detail-row');
        const statusLabel = this.createSafeElement('span', 'detail-label', 'Status:');
        const statusValueContainer = this.createSafeElement('span', 'detail-value');
        const statusBadge = this.createSafeElement('span', `status-badge status-${request.status}`, request.status || '');
        statusValueContainer.appendChild(statusBadge);
        statusRow.appendChild(statusLabel);
        statusRow.appendChild(statusValueContainer);

        requestDetails.appendChild(phoneRow);
        requestDetails.appendChild(statusRow);

        // Assigned role row (if exists)
        if (request.assigned_role) {
            const roleRow = this.createSafeElement('div', 'detail-row');
            const roleLabel = this.createSafeElement('span', 'detail-label', 'Assigned Role:');
            const roleValue = this.createSafeElement('span', 'detail-value', request.assigned_role);
            roleRow.appendChild(roleLabel);
            roleRow.appendChild(roleValue);
            requestDetails.appendChild(roleRow);
        }

        // Request message (if exists)
        let requestMessage = null;
        if (request.message) {
            requestMessage = this.createSafeElement('div', 'request-message');
            const p = this.createSafeElement('p', '', request.message);
            requestMessage.appendChild(p);
        }

        // Request actions
        const requestActions = this.createSafeElement('div', 'request-actions');

        const viewBtn = this.createSafeElement('button', 'action-btn view-btn', 'View Details');
        viewBtn.type = 'button';
        viewBtn.onclick = () => this.viewRequest(request.id);
        requestActions.appendChild(viewBtn);

        const isPending = request.status === 'pending';
        if (isPending) {
            const approveBtn = this.createSafeElement('button', 'action-btn approve-btn', 'Approve');
            approveBtn.type = 'button';
            approveBtn.onclick = () => this.showApproveModal(request.id);
            requestActions.appendChild(approveBtn);

            const rejectBtn = this.createSafeElement('button', 'action-btn reject-btn', 'Reject');
            rejectBtn.type = 'button';
            rejectBtn.onclick = () => this.showRejectModal(request.id);
            requestActions.appendChild(rejectBtn);
        }

        // Assemble the card
        card.appendChild(requestHeader);
        card.appendChild(requestDetails);
        if (requestMessage) {
            card.appendChild(requestMessage);
        }
        card.appendChild(requestActions);

        return card;
    }

    updateStats() {
        const pending = this.allRequests.filter(r => r.status === 'pending').length;
        const approved = this.allRequests.filter(r => r.status === 'approved').length;
        const rejected = this.allRequests.filter(r => r.status === 'rejected').length;

        this.safeSetText(this.pendingCount, pending);
        this.safeSetText(this.approvedCount, approved);
        this.safeSetText(this.rejectedCount, rejected);
    }

    viewRequest(requestId) {
        const request = this.allRequests.find(r => r.id === requestId);
        if (!request) return;

        const modalBody = document.getElementById('request-details');

        // Clear existing content safely
        while (modalBody.firstChild) {
            modalBody.removeChild(modalBody.firstChild);
        }

        const basicInfo = this.createSafeElement('div', 'basic-info');

        // Personal Info section
        const personalInfoH3 = this.createSafeElement('h3', '', 'Personal Info');
        basicInfo.appendChild(personalInfoH3);

        const nameP = this.createSafeElement('p');
        const nameStrong = this.createSafeElement('strong', '', 'Name: ');
        nameP.appendChild(nameStrong);
        nameP.appendChild(document.createTextNode(`${request.first_name || ''} ${request.last_name || ''}`));
        basicInfo.appendChild(nameP);

        const emailP = this.createSafeElement('p');
        const emailStrong = this.createSafeElement('strong', '', 'Email: ');
        emailP.appendChild(emailStrong);
        emailP.appendChild(document.createTextNode(request.email || ''));
        basicInfo.appendChild(emailP);

        const phoneP = this.createSafeElement('p');
        const phoneStrong = this.createSafeElement('strong', '', 'Phone: ');
        phoneP.appendChild(phoneStrong);
        phoneP.appendChild(document.createTextNode(request.phone || 'N/A'));
        basicInfo.appendChild(phoneP);

        const requestedRoleP = this.createSafeElement('p');
        const requestedRoleStrong = this.createSafeElement('strong', '', 'Requested Role: ');
        requestedRoleP.appendChild(requestedRoleStrong);
        requestedRoleP.appendChild(document.createTextNode(request.requested_role || request.role || ''));
        basicInfo.appendChild(requestedRoleP);

        if (request.assigned_role) {
            const assignedRoleP = this.createSafeElement('p');
            const assignedRoleStrong = this.createSafeElement('strong', '', 'Assigned Role: ');
            assignedRoleP.appendChild(assignedRoleStrong);
            assignedRoleP.appendChild(document.createTextNode(request.assigned_role));
            basicInfo.appendChild(assignedRoleP);
        }

        // Message section (if exists)
        if (request.message) {
            const messageH3 = this.createSafeElement('h3', '', 'Message');
            basicInfo.appendChild(messageH3);

            const messageP = this.createSafeElement('p', '', request.message);
            basicInfo.appendChild(messageP);
        }

        // Details section
        const detailsH3 = this.createSafeElement('h3', '', 'Details');
        basicInfo.appendChild(detailsH3);

        const statusP = this.createSafeElement('p');
        const statusStrong = this.createSafeElement('strong', '', 'Status: ');
        statusP.appendChild(statusStrong);
        const statusSpan = this.createSafeElement('span', `status-badge status-${request.status}`, request.status || '');
        statusP.appendChild(statusSpan);
        basicInfo.appendChild(statusP);

        const requestedP = this.createSafeElement('p');
        const requestedStrong = this.createSafeElement('strong', '', 'Requested: ');
        requestedP.appendChild(requestedStrong);
        requestedP.appendChild(document.createTextNode(this.formatDate(request.created_at)));
        basicInfo.appendChild(requestedP);

        if (request.processed_at) {
            const processedP = this.createSafeElement('p');
            const processedStrong = this.createSafeElement('strong', '', 'Processed: ');
            processedP.appendChild(processedStrong);
            processedP.appendChild(document.createTextNode(this.formatDate(request.processed_at)));
            basicInfo.appendChild(processedP);
        }

        if (request.manager_message) {
            const managerNoteP = this.createSafeElement('p');
            const managerNoteStrong = this.createSafeElement('strong', '', 'Manager Note: ');
            managerNoteP.appendChild(managerNoteStrong);
            managerNoteP.appendChild(document.createTextNode(request.manager_message));
            basicInfo.appendChild(managerNoteP);
        }

        modalBody.appendChild(basicInfo);
        this.showModal(this.viewModal);
    }

    showApproveModal(requestId) {
        this.currentRequestId = requestId;

        const request = this.allRequests.find(r => r.id === requestId);
        if (request) {
            const assignRoleSelect = document.getElementById('assign-role');
            if (assignRoleSelect) {
                assignRoleSelect.value = request.requested_role || request.role || '';
            }
        }

        this.showModal(this.approveModal);
    }

    showRejectModal(requestId) {
        this.currentRequestId = requestId;
        const rejectMessageTextarea = document.getElementById('reject-message');
        if (rejectMessageTextarea) {
            rejectMessageTextarea.value = '';
        }
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
                    assigned_role: this.sanitizeInput(assignedRole)
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
                    manager_message: this.sanitizeInput(rejectionMessage)
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.clear();
        window.location.href = '/homepage';
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ro-RO');
        } catch (error) {
            return 'Invalid date';
        }
    }

    // Legacy method kept for compatibility but now uses sanitizeInput
    escapeHtml(text) {
        return this.sanitizeInput(text);
    }
}

const dashboard = new ManagerDashboard();