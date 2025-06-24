class RegisterManager {
    constructor() {
        this.messageElement = null;
        this.closeButton = null;
        this.registerForm = null;
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
        this.registerForm = document.getElementById('registerForm');

        this.bindEvents();
    }

    bindEvents() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.handleClose());
        }

        if (this.registerForm) {
            this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    handleClose() {
        window.location.href = '/';
    }

    async handleRegister(e) {
        e.preventDefault();

        const formElements = {
            first_name: document.getElementById('prenume'),
            last_name: document.getElementById('nume'),
            email: document.getElementById('email'),
            phone: document.getElementById('telefon'),
            password: document.getElementById('parola'),
        };

        if (!formElements.first_name || !formElements.last_name ||
            !formElements.email || !formElements.phone || !formElements.password) {
            this.showMessage('Required form elements not found', 'error');
            return;
        }

        const formData = this.sanitizeFormData({
            first_name: formElements.first_name.value.trim(),
            last_name: formElements.last_name.value.trim(),
            email: formElements.email.value.trim(),
            phone: formElements.phone.value.trim(),
            password: formElements.password.value,
            role: formElements.role?.value || 'client',
            company_name: formElements.company_name?.value?.trim() || null,
            experience_years: formElements.experience_years?.value || null,
            message: formElements.message?.value?.trim() || null
        });

        if (!this.validateForm(formData)) {
            return;
        }

        try {
            const response = await fetch('/api/auth/register-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            let data;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    throw new Error('Invalid JSON response from server');
                }
            } else {
                const responseText = await response.text();
                console.error('Non-JSON response:', responseText);
                throw new Error('Server returned non-JSON response');
            }

            if (!response.ok) {

                if (response.status >= 500) {
                    throw new Error('Server error. Please try again later.');
                } else if (response.status === 400) {
                    throw new Error(data.message || 'Invalid request data');
                } else if (response.status === 409) {
                    throw new Error('Email already exists');
                } else {
                    throw new Error(data.message || 'Registration failed');
                }
            }

            if (data.success) {
                this.showMessage('Registration request submitted successfully! The manager will approve your request in 1 day', 'success');

                this.registerForm.reset();

                setTimeout(() => {
                    window.location.href = '/homepage';
                }, 3000);
            } else {
                let errorMessage = 'Registration request failed';

                if (data.errors && Array.isArray(data.errors)) {
                    const sanitizedErrors = data.errors.map(error => this.sanitizeInput(error));
                    errorMessage = sanitizedErrors.join(', ');
                } else if (data.message) {
                    errorMessage = this.sanitizeInput(data.message);
                }

                this.showMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);

            let errorMessage = 'Network error occurred';

            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Cannot connect to server. Please check your internet connection.';
            } else if (error.message.includes('Server error')) {
                errorMessage = 'Server is temporarily unavailable. Please try again later.';
            } else if (error.message.includes('Invalid JSON')) {
                errorMessage = 'Server response error. Please try again.';
            } else if (error.message) {
                errorMessage = this.sanitizeInput(error.message);
            }

            this.showMessage(errorMessage, 'error');
        }
    }

    sanitizeFormData(data) {
        const sanitizedData = {};

        for (const [key, value] of Object.entries(data)) {
            if (key === 'password') {
                sanitizedData[key] = value;
            } else if (key === 'experience_years') {
                sanitizedData[key] = value ? parseInt(value, 10) : null;
            } else if (value === null || value === undefined) {
                sanitizedData[key] = null;
            } else {
                sanitizedData[key] = this.sanitizeInput(String(value));
            }
        }

        return sanitizedData;
    }

    validateForm(data) {
        if (!data.first_name || data.first_name.length < 2) {
            this.showMessage('First name must be at least 2 characters', 'error');
            return false;
        }

        if (!data.last_name || data.last_name.length < 2) {
            this.showMessage('Last name must be at least 2 characters', 'error');
            return false;
        }

        if (!data.email || !this.isValidEmail(data.email)) {
            this.showMessage('Please enter a valid email', 'error');
            return false;
        }

        if (!data.phone || !this.isValidPhone(data.phone)) {
            this.showMessage('Phone number must have format 07xxxxxxxx', 'error');
            return false;
        }

        if (!data.password || data.password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
            return false;
        }

        if (data.first_name.length > 50) {
            this.showMessage('First name is too long', 'error');
            return false;
        }

        if (data.last_name.length > 50) {
            this.showMessage('Last name is too long', 'error');
            return false;
        }

        if (data.email.length > 254) {
            this.showMessage('Email is too long', 'error');
            return false;
        }

        if (data.company_name && data.company_name.length > 100) {
            this.showMessage('Company name is too long', 'error');
            return false;
        }

        if (data.message && data.message.length > 1000) {
            this.showMessage('Message is too long', 'error');
            return false;
        }

        if (data.experience_years && (data.experience_years < 0 || data.experience_years > 50)) {
            this.showMessage('Experience years must be between 0 and 50', 'error');
            return false;
        }

        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^0\d{9}$/;
        return phoneRegex.test(phone);
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
            }, 8000);
        }
    }
}

const registerManager = new RegisterManager();