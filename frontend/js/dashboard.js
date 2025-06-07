document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || !user.id) {
        // Redirect to login if not authenticated
        window.location.href = '/login';
        return;
    }

    // Initialize dashboard
    initializeDashboard();
    loadUserInfo();
    loadAppointments();
    setupEventListeners();
    setMinDate();

    function initializeDashboard() {
        console.log('Dashboard initialized for user:', user.first_name);
    }

    function loadUserInfo() {
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && user.first_name) {
            userNameElement.textContent = user.first_name;
        }
    }

    function setupEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');

                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Update active tab pane
                tabPanes.forEach(pane => pane.classList.remove('active'));
                document.getElementById(targetTab).classList.add('active');
            });
        });

        // New appointment button - redirect to schedule page
        const newAppointmentBtn = document.getElementById('new-appointment-btn');
        newAppointmentBtn.addEventListener('click', function() {
            window.location.href = '/schedule';
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', logout);

        // Cancel button
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn.addEventListener('click', function() {
            // Switch back to appointments tab
            document.querySelector('[data-tab="appointments"]').click();
            clearForm();
        });

        // Appointment form
        const appointmentForm = document.getElementById('appointment-form');
        appointmentForm.addEventListener('submit', handleAppointmentSubmit);

        // File upload handling
        const fileInput = document.getElementById('attachment');
        fileInput.addEventListener('change', handleFileUpload);

        // Modal close
        const closeModal = document.querySelector('.close-modal');
        const modal = document.getElementById('appointment-modal');

        closeModal.addEventListener('click', function() {
            modal.style.display = 'none';
        });

        window.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    function setMinDate() {
        const dateInput = document.getElementById('appointment-date');
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const minDate = tomorrow.toISOString().split('T')[0];
        dateInput.setAttribute('min', minDate);
    }

    async function loadAppointments() {
        try {
            showLoading(true);

            // This would be an API call to get user's appointments
            // For now, we'll show a placeholder
            const appointmentsContainer = document.getElementById('appointments-container');

            // Simulate API call
            setTimeout(() => {
                appointmentsContainer.innerHTML = `
                    <div class="empty-message">
                        <p>Nu ai încă programări. Creează prima ta programare!</p>
                    </div>
                `;
                showLoading(false);
            }, 1000);

        } catch (error) {
            console.error('Error loading appointments:', error);
            showMessage('Eroare la încărcarea programărilor', 'error');
            showLoading(false);
        }
    }

    async function handleAppointmentSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const appointmentData = {
            serviceType: formData.get('serviceType'),
            appointmentDate: formData.get('appointmentDate'),
            appointmentTime: formData.get('appointmentTime'),
            description: formData.get('description')
        };

        // Validate form
        if (!validateAppointmentForm(appointmentData)) {
            return;
        }

        try {
            showLoading(true);

            // This would be an API call to create appointment
            // For now, we'll simulate success
            setTimeout(() => {
                showMessage('Programarea a fost trimisă cu succes!', 'success');
                clearForm();
                // Switch back to appointments tab
                document.querySelector('[data-tab="appointments"]').click();
                // Reload appointments
                loadAppointments();
                showLoading(false);
            }, 1500);

        } catch (error) {
            console.error('Error creating appointment:', error);
            showMessage('Eroare la crearea programării', 'error');
            showLoading(false);
        }
    }

    function validateAppointmentForm(data) {
        if (!data.serviceType) {
            showMessage('Te rog selectează tipul serviciului', 'error');
            return false;
        }

        if (!data.appointmentDate) {
            showMessage('Te rog selectează data', 'error');
            return false;
        }

        if (!data.appointmentTime) {
            showMessage('Te rog selectează ora', 'error');
            return false;
        }

        if (!data.description || data.description.trim().length < 10) {
            showMessage('Descrierea trebuie să conțină cel puțin 10 caractere', 'error');
            return false;
        }

        // Check if date is not in the past
        const selectedDate = new Date(data.appointmentDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate <= today) {
            showMessage('Data programării trebuie să fie în viitor', 'error');
            return false;
        }

        return true;
    }

    function handleFileUpload(e) {
        const files = Array.from(e.target.files);
        const fileList = document.getElementById('file-list');

        fileList.innerHTML = '';

        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">${file.name}</span>
                <button type="button" class="remove-file" data-index="${index}">&times;</button>
            `;
            fileList.appendChild(fileItem);
        });

        // Add event listeners for remove buttons
        fileList.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeFile(index);
            });
        });
    }

    function removeFile(index) {
        const fileInput = document.getElementById('attachment');
        const dt = new DataTransfer();
        const files = Array.from(fileInput.files);

        files.forEach((file, i) => {
            if (i !== index) {
                dt.items.add(file);
            }
        });

        fileInput.files = dt.files;
        handleFileUpload({ target: fileInput });
    }

    function clearForm() {
        const form = document.getElementById('appointment-form');
        form.reset();
        document.getElementById('file-list').innerHTML = '';
    }

    function logout() {
        if (confirm('Ești sigur că vrei să te deconectezi?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }

    function showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'flex' : 'none';
    }

    function showMessage(message, type = 'info') {
        const toast = document.getElementById('message-toast');
        const messageText = document.getElementById('message-text');

        messageText.textContent = message;
        toast.className = `message-toast ${type}`;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    }

    // Check token validity periodically
    setInterval(function() {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            window.location.href = '/login';
        }
    }, 60000); // Check every minute
});