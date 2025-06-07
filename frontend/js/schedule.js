document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || !user.id) {
        window.location.href = '/login';
        return;
    }

    // Initialize calendar
    let currentDate = new Date();
    let selectedDate = null;
    let selectedTimeSlot = null;

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

    // Working hours (9 AM to 5 PM)
    const workingHours = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00'
    ];

    // Initialize
    initializeCalendar();
    setupEventListeners();

    function initializeCalendar() {
        updateCalendarDisplay();
        hideTimeSlots();
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
        fileInput.addEventListener('change', handleFileUpload);

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

    function showTimeSlots(date) {
        const dateString = formatDate(date);
        document.getElementById('selectedDate').textContent = dateString;

        timeSlotSection.style.display = 'block';
        timeSlotsElement.innerHTML = '';

        workingHours.forEach(time => {
            const slotElement = document.createElement('div');
            slotElement.className = 'time-slot';
            slotElement.textContent = time;

            // Check if slot is available (simplified - in real app, check with server)
            const isAvailable = Math.random() > 0.3; // 70% chance of being available

            if (!isAvailable) {
                slotElement.classList.add('occupied');
                slotElement.textContent += ' (Ocupat)';
            } else {
                slotElement.addEventListener('click', () => selectTimeSlot(time, date));
            }

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
        document.getElementById('file-list').innerHTML = '';
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
            serviceType: formData.get('serviceType'),
            appointmentDate: formData.get('appointmentDate'),
            appointmentTime: formData.get('appointmentTime'),
            slotId: formData.get('slotId'),
            description: formData.get('description')
        };

        if (!validateAppointmentForm(appointmentData)) {
            return;
        }

        try {
            showLoading(true);

            // This would be an API call to create appointment
            // For now, simulate success
            setTimeout(() => {
                showMessage('Programarea a fost creată cu succes!', 'success');
                closeAppointmentModal();

                // Redirect back to dashboard after success
                setTimeout(() => {
                    window.location.href = '/client/dashboard';
                }, 2000);

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

        if (!data.description || data.description.trim().length < 10) {
            showMessage('Descrierea trebuie să conțină cel puțin 10 caractere', 'error');
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
});