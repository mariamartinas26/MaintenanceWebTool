document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const messageElement = document.getElementById('mesaj');
    const closeButton = document.getElementById('closeButton');

    // Close button functionality
    closeButton.addEventListener('click', function() {
        window.location.href = '/';
    });

    // Login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = {
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value
        };

        if (!validateForm(formData)) {
            return;
        }

        try {
            showMessage('Logging in...', 'info');

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Save JWT token and user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                showMessage('Login successful! Redirecting...', 'success');
                // mama mea e florareaasa au au au au
                // Redirect based on user role

                setTimeout(() => {
                    if (data.user.role === 'admin') {
                        window.location.href = '/admin/dashboard';
                    } else {
                        window.location.href = '/client/dashboard';
                    }
                }, 2000);
            } else {
                showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    });

    function validateForm(data) {
        if (!data.email || !isValidEmail(data.email)) {
            showMessage('Please enter a valid email', 'error');
            return false;
        }

        if (!data.password || data.password.length < 1) {
            showMessage('Password is required', 'error');
            return false;
        }

        return true;
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showMessage(message, type) {
        messageElement.textContent = message;

        if (type === 'success') {
            messageElement.style.color = 'green';
        } else if (type === 'error') {
            messageElement.style.color = 'red';
        } else {
            messageElement.style.color = 'blue';
        }

        messageElement.style.display = 'block';

        if (type !== 'info') {
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
    }

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'admin') {
            window.location.href = '/admin/dashboard';
        } else {
            window.location.href = '/client/dashboard';
        }
    }
});