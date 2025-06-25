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
        this.loadRequestsFromAPI();
        this.setupEventListeners();
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = this.getUser();

        if (!token || !user) {
            window.location.href = '/login';
            return;
        }

        if (!['manager'].includes(user.role)) {
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
        //daca da approve
        document.getElementById('approve-form').addEventListener('submit', (e) => {
            e.preventDefault(); //previne refresh ul paginii
            this.confirmApproval();
        });
        //daca da reject
        document.getElementById('reject-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmRejection();
        });
    }

    async loadRequestsFromAPI() {
        try {
            const token = localStorage.getItem('token');

            //cerere http
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

            this.allRequests = data.requests; //rapsunsul de la backend

            this.displayRequests(); //afisam cererile
            this.updateStats(); //statistici nr cereri pending,approved,rejected
        } catch (error) {
            this.allRequests = [];
            this.displayRequests();
        }
    }

    displayRequests() {
        while (this.requestsContainer.firstChild) {
            this.requestsContainer.removeChild(this.requestsContainer.firstChild);
        }
        //cazul in care nu avem requests
        if (this.allRequests.length === 0) {
            const emptyState = this.createElement('div', 'empty-state');
            const h3 = this.createElement('h3', '', 'No requests found');
            const p = this.createElement('p', '', 'There are currently no registration requests');

            emptyState.appendChild(h3);
            emptyState.appendChild(p);
            this.requestsContainer.appendChild(emptyState);
            return;
        }

        this.allRequests.forEach((request, index) => {
            const card = this.createRequestCard(request);
            this.requestsContainer.appendChild(card);
        });
    }

    createRequestCard(request) {
        const card = this.createElement('div', 'request-card');

        //nume+email
        const requestHeader = this.createElement('div', 'request-header');
        const requestInfo = this.createElement('div', 'request-info');

        const h4 = this.createElement('h4', '', `${request.first_name || ''} ${request.last_name || ''}`);
        const requestEmail = this.createElement('div', 'request-email', request.email || '');

        requestInfo.appendChild(h4);
        requestInfo.appendChild(requestEmail);
        requestHeader.appendChild(requestInfo);

        //detaliile
        const requestDetails = this.createElement('div', 'request-details');

        //phone nr details
        const phoneRow = this.createElement('div', 'detail-row');
        const phoneLabel = this.createElement('span', 'detail-label', 'Phone:');
        const phoneValue = this.createElement('span', 'detail-value', request.phone);
        phoneRow.appendChild(phoneLabel);
        phoneRow.appendChild(phoneValue);

        //status (pending,rejected,approved)
        const statusRow = this.createElement('div', 'detail-row');
        const statusLabel = this.createElement('span', 'detail-label', 'Status: ');
        const statusValueContainer = this.createElement('span', 'detail-value');
        const statusBadge = this.createElement('span', `status-badge status-${request.status}`, request.status || '');
        statusValueContainer.appendChild(statusBadge);
        statusRow.appendChild(statusLabel);
        statusRow.appendChild(statusValueContainer);

        requestDetails.appendChild(phoneRow);
        requestDetails.appendChild(statusRow);

        //rolul asignat de manager
        if (request.assigned_role) {
            const roleRow = this.createElement('div', 'detail-row');
            const roleLabel = this.createElement('span', 'detail-label', 'Assigned Role: ');
            const roleValue = this.createElement('span', 'detail-value', request.assigned_role);
            roleRow.appendChild(roleLabel);
            roleRow.appendChild(roleValue);
            requestDetails.appendChild(roleRow);
        }

        //view details
        const requestActions = this.createElement('div', 'request-actions');

        const viewBtn = this.createElement('button', 'action-btn view-btn', 'View Details');
        viewBtn.type = 'button';
        viewBtn.onclick = () => this.viewRequest(request.id);
        requestActions.appendChild(viewBtn);

        const isPending = request.status === 'pending';
        if (isPending) {
            const approveBtn = this.createElement('button', 'action-btn approve-btn', 'Approve');
            approveBtn.type = 'button';
            approveBtn.onclick = () => this.showApproveModal(request.id);
            requestActions.appendChild(approveBtn);

            const rejectBtn = this.createElement('button', 'action-btn reject-btn', 'Reject');
            rejectBtn.type = 'button';
            rejectBtn.onclick = () => this.showRejectModal(request.id);
            requestActions.appendChild(rejectBtn);
        }

        card.appendChild(requestHeader);
        card.appendChild(requestDetails);
        card.appendChild(requestActions);

        return card;
    }

    //nr cereri pending,approved,rejected
    updateStats() {
        const pending = this.allRequests.filter(r => r.status === 'pending').length;
        const approved = this.allRequests.filter(r => r.status === 'approved').length;
        const rejected = this.allRequests.filter(r => r.status === 'rejected').length;

        this.safeSetText(this.pendingCount, pending);
        this.safeSetText(this.approvedCount, approved);
        this.safeSetText(this.rejectedCount, rejected);
    }

    //modal detaliile despre request
    viewRequest(requestId) {
        const request = this.allRequests.find(r => r.id === requestId);
        if (!request) return;

        const modalBody = document.getElementById('request-details');

        while (modalBody.firstChild) {
            modalBody.removeChild(modalBody.firstChild);
        }

        const basicInfo = this.createElement('div', 'basic-info');

        const nameP = this.createElement('p');
        const nameStrong = this.createElement('strong', '', 'Name: ');
        nameP.appendChild(nameStrong);
        nameP.appendChild(document.createTextNode(`${request.first_name || ''} ${request.last_name || ''}`));
        basicInfo.appendChild(nameP);

        const emailP = this.createElement('p');
        const emailStrong = this.createElement('strong', '', 'Email: ');
        emailP.appendChild(emailStrong);
        emailP.appendChild(document.createTextNode(request.email || ''));
        basicInfo.appendChild(emailP);

        const phoneP = this.createElement('p');
        const phoneStrong = this.createElement('strong', '', 'Phone: ');
        phoneP.appendChild(phoneStrong);
        phoneP.appendChild(document.createTextNode(request.phone || 'N/A'));
        basicInfo.appendChild(phoneP);

        //daca a asignat un rol
        if (request.assigned_role) {
            const assignedRoleP = this.createElement('p');
            const assignedRoleStrong = this.createElement('strong', '', 'Assigned Role: ');
            assignedRoleP.appendChild(assignedRoleStrong);
            assignedRoleP.appendChild(document.createTextNode(request.assigned_role));
            basicInfo.appendChild(assignedRoleP);
        }

        const statusP = this.createElement('p');
        const statusStrong = this.createElement('strong', '', 'Status: ');
        statusP.appendChild(statusStrong);
        const statusSpan = this.createElement('span', `status-badge status-${request.status}`, request.status || '');
        statusP.appendChild(statusSpan);
        basicInfo.appendChild(statusP);

        modalBody.appendChild(basicInfo);
        this.showModal(this.viewModal);
    }

    showApproveModal(requestId) {
        this.currentRequestId = requestId;

        const request = this.allRequests.find(r => r.id === requestId);
        if (request) {
            const assignRoleSelect = document.getElementById('assign-role');
            if (assignRoleSelect) {
                assignRoleSelect.value = request.role;
            }
        }
        //dropdown cu rolurile disponibile
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
    //CONFIRM APPROVAL POST
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
                this.closeAllModals();
                this.loadRequestsFromAPI();
            } else {
                alert(data.message || 'Failed to approve request');
            }

        } catch (error) {
            alert('Failed to approve request');
        }
    }
    //REJECTION POST
    async confirmRejection() {
        if (!this.currentRequestId) return;

        const rejectionMessage = document.getElementById('reject-message').value.trim();

        if (!rejectionMessage) {
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
                this.loadRequestsFromAPI();
            } else {
                alert(data.message || 'Failed to reject request');
            }

        } catch (error) {
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
}

const dashboard = new ManagerDashboard();