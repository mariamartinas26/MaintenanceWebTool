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
            console.log('Sending login request...');
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            // Verifică dacă response-ul e OK
            if (!response.ok) {
                console.log('Response not OK:', response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Citește răspunsul ca text mai întâi
            const responseText = await response.text();
            console.log('Raw response text:', responseText);

            // Apoi încearcă să-l parsezi
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed data:', data);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text was:', responseText);
                throw new Error('Invalid JSON response from server');
            }

            if (data.success) {
                console.log('Login successful, user data:', data.user);
                console.log('User role:', data.user.role);

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Verifică rolul din răspuns
                switch(data.user.role) {
                    case 'manager':
                        console.log('Redirecting to manager dashboard');
                        window.location.href = '/manager/dashboard';
                        break;
                    case 'admin':
                        console.log('Redirecting to admin dashboard');
                        window.location.href = '/admin/dashboard';
                        break;
                    case 'accountant':
                        console.log('Redirecting to accountant dashboard');
                        window.location.href = '/accountant/dashboard';
                        break;
                    case 'client':
                    default:
                        console.log('Redirecting to client dashboard');
                        window.location.href = '/client/dashboard';
                        break;
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Network error: ' + error.message, 'error');
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
        const userString = localStorage.getItem('user');
        console.log('User string from localStorage:', userString);

        if (userString) {
            try {
                const user = JSON.parse(userString);
                console.log('Parsed user:', user);

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
            } catch (parseError) {
                console.error('Error parsing user from localStorage:', parseError);
                // Șterge datele corupte
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.clear();
            }
        }
    }
});