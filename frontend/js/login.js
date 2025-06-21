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

        const email = emailInput.value.trim(); // Don't sanitize before sending
        const password = passwordInput.value;

        if (!this.validateForm(email, password)) {
            return;
        }

        try {
            console.log('Attempting login with:', { email }); // Debug log

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            console.log('Response status:', response.status); // Debug log

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Login error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            console.log('Response text:', responseText); // Debug log

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                throw new Error('Invalid JSON response from server');
            }

            if (data.success) {
                this.storeAuthData(data.token, data.user);
                this.redirectUser(data.user);
            } else {
                this.showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error: ' + error.message, 'error');
        }
    }

    storeAuthData(token, user) {
        try {
            // Fix: Use the correct field names from backend response
            const sanitizedUser = {
                id: user.id,
                email: user.email ? this.sanitizeInput(user.email) : '',
                first_name: user.first_name ? this.sanitizeInput(user.first_name) : '',
                last_name: user.last_name ? this.sanitizeInput(user.last_name) : '',
                role: user.role ? this.sanitizeInput(user.role) : 'client'
            };

            localStorage.setItem('token', token); // Don't sanitize the token
            localStorage.setItem('user', JSON.stringify(sanitizedUser));

            console.log('Auth data stored:', { user: sanitizedUser }); // Debug log
        } catch (error) {
            console.error('Error saving login data:', error);
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
        console.log('Redirecting to:', route); // Debug log
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
                        this.redirectUser(user);
                    } else {
                        console.log('Invalid user data, clearing auth');
                        this.clearAuthData();
                    }
                } catch (parseError) {
                    console.error('Error parsing stored user data:', parseError);
                    this.clearAuthData();
                }
            }
        }
    }

    clearAuthData() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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