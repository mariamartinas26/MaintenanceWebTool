document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || !user.id) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize calendar
    let currentDate = new Date();
    let selectedDate = null;
    let selectedTimeSlot = null;
    let userVehicles = [];

    // Calendar elements
    const monthYearElement = document.getElementById('monthYear');
    const calendarDaysElement = document.getElementById('calendarDays');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const timeSlotSection = document.getElementById('timeSlotSection');
    const timeSlotsElement = document.getElementById('timeSlots');

    // Modal elements
    const modal = document.getElementById('appointmentModal');
    const closeModal = document.querySelector('.close-modal');
    const appointmentForm = document.getElementById('appointmentForm');
    const cancelBtn = document.getElementById('cancel-btn');

    // Initialize
    initializeCalendar();
    loadUserVehicles();
    setupEventListeners();

    function initializeCalendar() {
        updateCalendarDisplay();
        hideTimeSlots();
    }

    async function loadUserVehicles() {
        try {
            const response = await fetch('/api/vehicles', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                userVehicles = data.vehicles;
                populateVehicleSelect();
            } else {
                console.error('Error loading vehicles:', data.message);
            }
        } catch (error) {
            console.error('Error loading vehicles:', error);
        }
    }

    function populateVehicleSelect() {
        // Dacă există un select pentru vehicule în modal, îl populează
        const vehicleSelect = document.getElementById('vehicle-select');
        if (vehicleSelect && userVehicles.length > 0) {
            vehicleSelect.innerHTML = '<option value="">Selectează vehiculul (opțional)</option>';
            userVehicles.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle.id;
                option.textContent = `${vehicle.brand} ${vehicle.model} (${vehicle.year}) - ${vehicle.vehicle_type}`;
                vehicleSelect.appendChild(option);
            });
        }
    }

    function setupEventListeners() {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            updateCalendarDisplay();
            hideTimeSlots();
        });

        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            updateCalendarDisplay();
            hideTimeSlots();
        });

        closeModal.addEventListener('click', closeAppointmentModal);
        cancelBtn.addEventListener('click', closeAppointmentModal);
        appointmentForm.addEventListener('submit', handleAppointmentSubmit);

        // File upload handling
        const fileInput = document.getElementById('attachment');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileUpload);
        }

        // Close modal on outside click
        window.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeAppointmentModal();
            }
        });
    }

    function updateCalendarDisplay() {
        // Update month/year header
        const monthNames = [
            'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
            'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
        ];
        monthYearElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

        // Clear previous days
        calendarDaysElement.innerHTML = '';

        // Get first day of month and number of days
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Adjust for Monday as first day (0 = Sunday, 1 = Monday, etc.)
        let startingDayOfWeek = firstDay.getDay();
        startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarDaysElement.appendChild(emptyDay);
        }

        // Add days of the month
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;

            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            dayDate.setHours(0, 0, 0, 0);

            // Disable past dates and weekends
            if (dayDate < today || dayDate.getDay() === 0 || dayDate.getDay() === 6) {
                dayElement.classList.add('disabled');
            } else {
                dayElement.addEventListener('click', () => selectDate(dayDate));
            }

            calendarDaysElement.appendChild(dayElement);
        }
    }

    function selectDate(date) {
        selectedDate = date;

        // Update visual selection
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        event.target.classList.add('selected');

        // Show time slots
        showTimeSlots(date);
    }

    async function showTimeSlots(date) {
        const dateString = formatDate(date);
        document.getElementById('selectedDate').textContent = dateString;

        timeSlotSection.style.display = 'block';
        timeSlotsElement.innerHTML = '<p>Se încarcă sloturile disponibile...</p>';

        try {
            const dateParam = date.toISOString().split('T')[0];
            const response = await fetch(`/api/calendar/available-slots?date=${dateParam}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                displayTimeSlots(data.availableSlots);
            } else {
                timeSlotsElement.innerHTML = `<p class="error-message">${data.message}</p>`;
            }

        } catch (error) {
            console.error('Error loading time slots:', error);
            timeSlotsElement.innerHTML = '<p class="error-message">Eroare la încărcarea sloturilor disponibile</p>';
        }
    }

    function displayTimeSlots(availableSlots) {
        timeSlotsElement.innerHTML = '';

        if (availableSlots.length === 0) {
            timeSlotsElement.innerHTML = '<p class="no-slots-message">Nu sunt sloturile disponibile pentru această dată</p>';
            return;
        }

        availableSlots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = 'time-slot';

            const startTime = slot.startTime.substring(0, 5); // HH:MM format
            const endTime = slot.endTime.substring(0, 5);

            slotElement.innerHTML = `
                <span class="slot-time">${startTime} - ${endTime}</span>
                <span class="slot-availability">${slot.availableSpots} locuri disponibile</span>
            `;

            slotElement.addEventListener('click', () => selectTimeSlot(startTime, selectedDate));
            timeSlotsElement.appendChild(slotElement);
        });
    }

    function hideTimeSlots() {
        timeSlotSection.style.display = 'none';
        selectedDate = null;
        selectedTimeSlot = null;
    }

    function selectTimeSlot(time, date) {
        selectedTimeSlot = time;

        // Update visual selection
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        event.target.classList.add('selected');

        // Open appointment modal
        openAppointmentModal(date, time);
    }

    function openAppointmentModal(date, time) {
        document.getElementById('appointment-date').value = formatDate(date);
        document.getElementById('appointment-time').value = time;
        document.getElementById('slot-id').value = `${date.getTime()}_${time}`;

        modal.style.display = 'flex';
    }

    function closeAppointmentModal() {
        modal.style.display = 'none';
        appointmentForm.reset();
        const fileList = document.getElementById('file-list');
        if (fileList) {
            fileList.innerHTML = '';
        }
    }

    function formatDate(date) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return date.toLocaleDateString('ro-RO', options);
    }

    async function handleAppointmentSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const appointmentData = {
            date: selectedDate.toISOString().split('T')[0],
            time: selectedTimeSlot,
            serviceType: formData.get('serviceType'),
            description: formData.get('description'),
            vehicleId: formData.get('vehicleId') || null
        };

        if (!validateAppointmentForm(appointmentData)) {
            return;
        }

        try {
            showLoading(true);

            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appointmentData)
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Programarea a fost creată cu succes!', 'success');
                closeAppointmentModal();

                // Refresh time slots to show updated availability
                setTimeout(() => {
                    showTimeSlots(selectedDate);
                }, 1000);

                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);

            } else {
                showMessage(data.message || 'Eroare la crearea programării', 'error');
            }

            showLoading(false);

        } catch (error) {
            console.error('Error creating appointment:', error);
            showMessage('Eroare de rețea. Te rog încearcă din nou.', 'error');
            showLoading(false);
        }
    }

    function validateAppointmentForm(data) {
        if (!data.serviceType) {
            showMessage('Te rog selectează tipul serviciului', 'error');
            return false;
        }

        if (!data.description || data.description.trim().length < 10) {
            showMessage('Descrierea trebuie să conțină cel puțin 10 caractere', 'error');
            return false;
        }

        if (!data.date || !data.time) {
            showMessage('Te rog selectează data și ora', 'error');
            return false;
        }

        return true;
    }

    function handleFileUpload(e) {
        const files = Array.from(e.target.files);
        const fileList = document.getElementById('file-list');

        if (!fileList) return;

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
        if (!fileInput) return;

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

    function showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }

    function showMessage(message, type = 'info') {
        const toast = document.getElementById('message-toast');
        const messageText = document.getElementById('message-text');

        if (toast && messageText) {
            messageText.textContent = message;
            toast.className = `message-toast ${type}`;
            toast.style.display = 'block';

            setTimeout(() => {
                toast.style.display = 'none';
            }, 4000);
        }
    }
});