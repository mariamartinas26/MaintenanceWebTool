document.addEventListener('DOMContentLoaded', function() {
    const messageElement = document.getElementById('mesaj');
    const closeButton = document.getElementById('closeButton');

    closeButton.addEventListener('click', function() {
        window.location.href = '/';
    });

    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                switch(data.user.role) {
                    case 'manager':
                        window.location.href = '/manager/dashboard';
                        break;
                    case 'admin':
                        window.location.href = '/admin/dashboard';
                        break;
                    case 'contabil':
                        window.location.href = '/contabil/dashboard';
                        break;
                    case 'client':
                    default:
                        window.location.href = '/client/dashboard';
                        break;
                }
            } else {
                showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            showMessage('Network error', 'error');
        }
    });

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

    const token = localStorage.getItem('token');
    if (token) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        switch(user.role) {
            case 'manager':
                window.location.href = '/manager/dashboard';
                break;
            case 'admin':
                window.location.href = '/admin/dashboard';
                break;
            case 'contabil':
                window.location.href = '/contabil/dashboard';
                break;
            default:
                window.location.href = '/client/dashboard';
                break;
        }
    }
});