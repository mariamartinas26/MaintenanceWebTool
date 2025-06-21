class LoginManager {
    constructor() {
        this.messageElement = null;
        this.closeButton = null;
        this.loginForm = null;
        this.init();
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return String(input);
        }
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/&/g, '&amp;');
    }

    safeSetText(element, text) {
        if (!element) return;
        element.textContent = String(text);
    }

    init() {

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupElements());
        } else {
            this.setupElements();
        }
    }

    setupElements() {
        this.messageElement = document.getElementById('mesaj');
        this.closeButton = document.getElementById('closeButton');
        this.loginForm = document.getElementById('loginForm');

        this.bindEvents();
        this.checkExistingAuth();
    }

    bindEvents() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.handleClose());
        }

        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    handleClose() {
        window.location.href = '/';
    }

    async handleLogin(e) {
        e.preventDefault();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        if (!emailInput || !passwordInput) {
            this.showMessage('Form elements not found', 'error');
            return;
        }

        const email = this.sanitizeInput(emailInput.value.trim());
        const password = passwordInput.value;

        if (!this.validateForm(email, password)) {
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error('Invalid JSON response from server');
            }

            if (data.success) {
                this.storeAuthData(data.token, data.user);
                this.redirectUser(data.user);
            } else {
                this.showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            this.showMessage('Network error: ' + this.sanitizeInput(error.message), 'error');
        }
    }

    storeAuthData(token, user) {
        try {
            const sanitizedUser = {
                ...user,
                name: user.name ? this.sanitizeInput(user.name) : '',
                email: user.email ? this.sanitizeInput(user.email) : '',
                role: user.role ? this.sanitizeInput(user.role) : 'client'
            };

            localStorage.setItem('token', this.sanitizeInput(token));
            localStorage.setItem('user', JSON.stringify(sanitizedUser));
        } catch (error) {
            this.showMessage('Error saving login data', 'error');
        }
    }

    redirectUser(user) {
        const roleRoutes = {
            'manager': '/manager/dashboard',
            'admin': '/admin/dashboard',
            'accountant': '/accountant/dashboard',
            'contabil': '/contabil/dashboard',
            'client': '/client/dashboard'
        };

        const route = roleRoutes[user.role] || '/client/dashboard';
        window.location.href = route;
    }

    showMessage(message, type) {
        if (!this.messageElement) return;

        this.safeSetText(this.messageElement, message);

        const colors = {
            'success': 'green',
            'error': 'red',
            'info': 'blue'
        };

        this.messageElement.style.color = colors[type] || 'blue';
        this.messageElement.style.display = 'block';

        if (type !== 'info') {
            setTimeout(() => {
                this.messageElement.style.display = 'none';
            }, 5000);
        }
    }

    checkExistingAuth() {
        const token = localStorage.getItem('token');

        if (token) {
            const userString = localStorage.getItem('user');

            if (userString) {
                try {
                    const user = JSON.parse(userString);

                    if (user && typeof user === 'object' && user.role) {
                        const sanitizedUser = {
                            ...user,
                            name: user.name ? this.sanitizeInput(user.name) : '',
                            email: user.email ? this.sanitizeInput(user.email) : '',
                            role: this.sanitizeInput(user.role)
                        };

                        this.redirectUser(sanitizedUser);
                    } else {
                        throw new Error('Invalid user data structure');
                    }
                } catch (parseError) {
                    this.clearAuthData();
                }
            }
        }
    }

    clearAuthData() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.clear();
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateForm(email, password) {
        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return false;
        }

        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return false;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            return false;
        }

        return true;
    }
}

const loginManager = new LoginManager();