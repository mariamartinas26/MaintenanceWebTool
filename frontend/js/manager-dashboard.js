
const requestsContainer = document.getElementById('requests-container');
const statusFilter = document.getElementById('status-filter');
const roleFilter = document.getElementById('role-filter');
const logoutBtn = document.getElementById('logout-btn');

// Modal elements
const viewModal = document.getElementById('view-request-modal');
const approveModal = document.getElementById('approve-request-modal');
const rejectModal = document.getElementById('reject-request-modal');
const closeModalBtns = document.querySelectorAll('.close-modal');

const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');

const pendingCount = document.getElementById('pending-count');
const approvedCount = document.getElementById('approved-count');
const rejectedCount = document.getElementById('rejected-count');

let allRequests = [];
let filteredRequests = [];
let currentRequestId = null;

//initializare
document.addEventListener('DOMContentLoaded', function() {
    checkManagerAuth();
    loadRequests();
    setupEventListeners();
    updateStats();
});

//verif daca user e aurentificat ca manager
function checkManagerAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'manager') {
        window.location.href = '/login';
        return;
    }
}


async function loadRequests() {
    try {
        const response = await fetch('/api/manager/requests', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load requests');
        }

        const data = await response.json();
        allRequests = data.requests || [];
        filteredRequests = [...allRequests];
        renderRequests();
        updateStats();

    } catch (error) {
        showNotification('Failed to load requests', 'error');
        allRequests = [];
        filteredRequests = [];
        renderRequests();
    }
}

function setupEventListeners() {

    logoutBtn.addEventListener('click', handleLogout);

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Modal backdrop click
    [viewModal, approveModal, rejectModal].forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });

    // Notification close
    notificationClose.addEventListener('click', hideNotification);

    // Approve and reject confirmation buttons
    document.getElementById('confirm-approve-btn').addEventListener('click', confirmApproval);
    document.getElementById('confirm-reject-btn').addEventListener('click', confirmRejection);
}


function renderRequests() {
    if (filteredRequests.length === 0) {
        requestsContainer.innerHTML = `
            <div class="empty-state">
                <h3>No requests found</h3>
            </div>
        `;
        return;
    }

    requestsContainer.innerHTML = '';

    filteredRequests.forEach(request => {
        const card = createRequestCard(request);
        requestsContainer.appendChild(card);
    });
}
function createRequestCard(request) {
    const template = document.getElementById('request-card-template');
    const card = template.content.cloneNode(true);

    // Populează datele
    card.querySelector('.request-name').textContent = `${request.first_name} ${request.last_name}`;
    card.querySelector('.request-email').textContent = request.email;
    card.querySelector('.request-date').textContent = `Requested: ${formatDate(request.created_at)}`;
    card.querySelector('.phone-value').textContent = request.phone;

    // Role badge - afișează rolul asignat dacă există, altfel rolul cerut
    const roleBadge = card.querySelector('.role-badge');
    if (request.status === 'approved' && request.assigned_role) {
        roleBadge.textContent = `Assigned: ${request.assigned_role}`;
        roleBadge.className = `role-badge role-${request.assigned_role}`;
        roleBadge.title = `Originally requested: ${request.role}`;
    } else {
        roleBadge.textContent = `Requested: ${request.role}`;
        roleBadge.className = `role-badge role-${request.role}`;
    }

    // Status badge
    const statusBadge = card.querySelector('.status-badge');
    statusBadge.textContent = request.status;
    statusBadge.className = `status-badge status-${request.status}`;

    // Company (conditional)
    if (request.company_name) {
        card.querySelector('.company-row').style.display = 'flex';
        card.querySelector('.company-value').textContent = request.company_name;
    }

    // Experience (conditional)
    if (request.experience_years) {
        card.querySelector('.experience-row').style.display = 'flex';
        card.querySelector('.experience-value').textContent = `${request.experience_years} years`;
    }

    // Message (conditional)
    if (request.message) {
        card.querySelector('.request-message').style.display = 'block';
        card.querySelector('.message-text').textContent = request.message;
    }

    // Event listeners
    card.querySelector('.view-btn').addEventListener('click', () => viewRequest(request.id));

    if (request.status === 'pending') {
        card.querySelector('.approve-btn').addEventListener('click', () => showApproveModal(request.id));
        card.querySelector('.reject-btn').addEventListener('click', () => showRejectModal(request.id));
    } else {
        card.querySelector('.approve-btn').style.display = 'none';
        card.querySelector('.reject-btn').style.display = 'none';
    }

    // Set data attribute
    card.querySelector('.request-card').setAttribute('data-request-id', request.id);

    return card;
}

function addRequestEventListeners() {
}

// Update statistics
function updateStats() {
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;

    pendingCount.textContent = pending;
    approvedCount.textContent = approved;
    rejectedCount.textContent = rejected;
}

//detalii request
function viewRequest(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    const template = document.getElementById('request-details-template');
    const details = template.content.cloneNode(true);

    details.querySelector('.full-name').textContent = `${request.first_name} ${request.last_name}`;
    details.querySelector('.email-value').textContent = request.email;
    details.querySelector('.phone-value').textContent = request.phone;
    details.querySelector('.role-value').textContent = request.role;
    details.querySelector('.request-date').textContent = formatDate(request.created_at);

    const statusBadge = details.querySelector('.status-badge');
    statusBadge.textContent = request.status;
    statusBadge.className = `status-badge status-${request.status}`;

    if (request.message) {
        details.querySelector('.message-section').style.display = 'block';
        details.querySelector('.message-text').textContent = request.message;
    }

    if (request.processed_at) {
        details.querySelector('.processed-item').style.display = 'flex';
        details.querySelector('.processed-date').textContent = formatDate(request.processed_at);
    }

    if (request.manager_message) {
        details.querySelector('.admin-message-item').style.display = 'flex';
        details.querySelector('.admin-message').textContent = request.manager_message;
    }

    const modalBody = document.getElementById('request-details');
    modalBody.innerHTML = '';
    modalBody.appendChild(details);

    showModal(viewModal);
}


function showApproveModal(requestId) {
    currentRequestId = requestId;

    // Reset form fields
    document.getElementById('assign-role').value = '';
    document.getElementById('approve-message').value = '';

    // Optionally, pre-select the requested role
    const request = allRequests.find(r => r.id === requestId);
    if (request) {
        document.getElementById('assign-role').value = request.role;
    }

    showModal(approveModal);
}

function showRejectModal(requestId) {
    currentRequestId = requestId;
    document.getElementById('reject-message').value = '';
    showModal(rejectModal);
}

async function confirmApproval() {
    if (!currentRequestId) return;

    const assignedRole = document.getElementById('assign-role').value;
    const welcomeMessage = document.getElementById('approve-message').value.trim();

    // Validare rol
    if (!assignedRole) {
        showNotification('Please select a role for the user', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/manager/requests/${currentRequestId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assigned_role: assignedRole,  // Nou câmp
                manager_message: welcomeMessage
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`Request approved! User assigned role: ${assignedRole}`, 'success');
            closeAllModals();
            loadRequests();
        } else {
            showNotification(data.message || 'Failed to approve request', 'error');
        }

    } catch (error) {
        showNotification('Failed to approve request', 'error');
    }
}

// Confirm rejection
async function confirmRejection() {
    if (!currentRequestId) return;

    const rejectionMessage = document.getElementById('reject-message').value.trim();


    if (!rejectionMessage) {
        showNotification('Please provide a message for the user', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/manager/requests/${currentRequestId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                manager_message: rejectionMessage
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Request rejected successfully!', 'success');
            closeAllModals();
            loadRequests();
        } else {
            showNotification(data.message || 'Failed to reject request', 'error');
        }

    } catch (error) {
        showNotification('Failed to reject request', 'error');
    }
}

// Modal management
function showModal(modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeAllModals() {
    [viewModal, approveModal, rejectModal].forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';

    // Reset form fields
    document.getElementById('assign-role').value = '';
    document.getElementById('approve-message').value = '';
    document.getElementById('reject-message').value = '';

    currentRequestId = null;
}
// Logout handler
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/homepage';
    }
}

// Notification system
function showNotification(message, type) {
    notificationMessage.textContent = message;
    notification.className = `notification notification-${type} show`;

    setTimeout(() => {
        hideNotification();
    }, 5000);
}

function hideNotification() {
    notification.classList.remove('show');
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

setInterval(() => {
    loadRequests();
}, 30000);