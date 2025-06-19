// frontend/js/accountant.js

// Funcții helper necesare
function getCurrentUserRole() {
    try {
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            return userData.role;
        }
        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

function getCurrentUserName() {
    try {
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            return `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
        }
        return null;
    } catch (error) {
        console.error('Error getting user name:', error);
        return null;
    }
}

function logout() {
    if (confirm('Sigur vrei să te deconectezi?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/homepage';
    }
}

function navigateToPage(url) {
    window.location.href = url;
}

function createAccountantDashboard() {
    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) {
        return;
    }

    dashboard.innerHTML = `
        <div class="manager-container">
            <!-- Header Section -->
            <div class="manager-header">
                <div class="header-content">
                    <div class="header-title">
                        <button class="btn btn-secondary" onclick="logout()">Logout</button>
                        <h1>Accountant Dashboard</h1>
                    </div>
                </div>
            </div>

            <!-- Quick Actions Section -->
            <div class="requests-section">
                <div class="requests-grid">
                    <div class="request-card">
                        <div class="request-header">
                            <div class="request-info">
                                <h4>Suppliers</h4>
                                <div class="request-email">Adauga furnizori</div>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="action-btn view-btn">Vizualizează</button>
                            <button class="action-btn approve-btn">Gestionează</button>
                        </div>
                    </div>

                    <div class="request-card">
                        <div class="request-header">
                            <div class="request-info">
                                <h4>Import/Export</h4>
                                <div class="request-email">Import si export</div>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="action-btn view-btn">Import</button>
                            <button class="action-btn approve-btn">Export</button>
                        </div>
                    </div>   
                </div>
            </div>
        </div>
    `;
}

function checkAccountantAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        console.log('No token, redirecting to login');
        window.location.href = '/login';
        return false;
    }

    if (!['admin', 'manager', 'accountant'].includes(user.role)) {
        console.log('User not allowed on accountant dashboard:', user.role);

        switch(user.role) {
            case 'manager':
                window.location.href = '/manager/dashboard';
                break;
            case 'client':
                window.location.href = '/client/dashboard';
                break;
            default:
                window.location.href = '/login';
        }
        return false;
    }

    return true;
}

function initializeAccountantDashboard() {
    if (!checkAccountantAuth()) {
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = getCurrentUserName();
    const userNameElement = document.getElementById('user-name');

    if (userNameElement) {
        if (userName) {
            const roleLabel = user.role === 'accountant' ? 'Contabil' :
                user.role === 'admin' ? 'Administrator' :
                    user.role === 'manager' ? 'Manager' : user.role;
            userNameElement.textContent = `${roleLabel}: ${userName}`;
        } else {
            userNameElement.textContent = `${user.role}: ${user.email || 'Utilizator'}`;
        }
    }

    createAccountantDashboard();
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Accountant dashboard page loaded');
    initializeAccountantDashboard();
});

if (typeof window !== 'undefined') {
    window.getCurrentUserRole = getCurrentUserRole;
    window.getCurrentUserName = getCurrentUserName;
    window.logout = logout;
    window.navigateToPage = navigateToPage;
    window.createAccountantDashboard = createAccountantDashboard;
}