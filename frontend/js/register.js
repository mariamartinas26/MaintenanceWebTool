document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const messageElement = document.getElementById('mesaj');
    const closeButton = document.getElementById('closeButton');

    closeButton.addEventListener('click', function() {
        window.location.href = '/';
    });

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = {
            first_name: document.getElementById('prenume').value.trim(),
            last_name: document.getElementById('nume').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('telefon').value.trim(),
            password: document.getElementById('parola').value,
            role: document.getElementById('rol')?.value || 'client',
            company_name: document.getElementById('companie')?.value?.trim() || null,
            experience_years: document.getElementById('experienta')?.value || null,
            message: document.getElementById('mesaj_cerere')?.value?.trim() || null
        };

        if (!validateForm(formData)) {
            return;
        }

        try {
            //fac request la manager ptr register
            const response = await fetch('/api/auth/register-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Registration request submitted successfully! The manager will approve your request in 1 day', 'success');

                registerForm.reset();

                //redirectam la homepage
                setTimeout(() => {
                    window.location.href = '/homepage';
                }, 3000);
            } else {
                if (data.errors && Array.isArray(data.errors)) {
                    showMessage(data.errors.join(', '), 'error');
                } else {
                    showMessage(data.message || 'Registration request failed', 'error');
                }
            }
        } catch (error) {
            showMessage('Network error', 'error');
        }
    });

    function validateForm(data) {
        if (!data.first_name || data.first_name.length < 2) {
            showMessage('First name must be at least 2 characters', 'error');
            return false;
        }
        if (!data.last_name || data.last_name.length < 2) {
            showMessage('Last name must be at least 2 characters', 'error');
            return false;
        }
        if (!data.email || !isValidEmail(data.email)) {
            showMessage('Please enter a valid email', 'error');
            return false;
        }
        if (!data.phone || !data.phone.match(/^0\d{9}$/)) {
            showMessage('Phone number must have format 07xxxxxxxx', 'error');
            return false;
        }
        if (!data.password || data.password.length < 6) {
            showMessage('Password must be at least 6 characters', 'error');
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
            }, 8000);
        }
    }
});