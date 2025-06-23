class AppointmentCalendar {
    constructor() {
        this.token = null;
        this.user = null;
        this.currentDate = new Date();
        this.selectedDate = null;
        this.selectedTimeSlot = null;
        this.userVehicles = [];

        // DOM elements cache
        this.elements = {};

        // Configuration
        this.config = {
            monthNames: [
                'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
                'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
            ],
            minDescriptionLength: 10,
            messageDisplayTime: 4000
        };

        // Security utilities
        this.security = window.SecurityUtils ;
    }

    /**
     * Safely set text content
     */
    safeSetText(element, text) {
        if (!element) return;
        element.textContent = this.security.sanitizeInput(text);
    }

    /**
     * Initialize the calendar application
     */
    async init() {
        try {
            if (!this.checkAuthentication()) {
                return;
            }

            this.cacheElements();
            this.setupEventListeners();
            this.initializeCalendar();
            await this.loadUserVehicles();

            console.log('AppointmentCalendar initialized successfully');
        } catch (error) {
            console.error('Error initializing AppointmentCalendar:', error);
            this.showMessage('Eroare la inițializarea aplicației', 'error');
        }
    }

    /**
     * Check if user is authenticated
     */
    checkAuthentication() {
        this.token = localStorage.getItem('token');
        const userString = localStorage.getItem('user');

        // Safely parse user data
        this.user = this.security.safeJsonParse(userString) || {};

        if (!this.token || !this.user.id) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        const elementIds = [
            'monthYear', 'calendarDays', 'prevMonth', 'nextMonth',
            'timeSlotSection', 'timeSlots', 'selectedDate',
            'appointmentModal', 'appointmentForm', 'cancel-btn',
            'appointment-date', 'appointment-time', 'slot-id',
            'attachment', 'file-list', 'loading', 'message-toast', 'message-text'
        ];

        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });

        // Cache elements with class selectors
        this.elements.closeModal = document.querySelector('.close-modal');
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Navigation buttons
        this.elements.prevMonth?.addEventListener('click', () => this.navigateMonth(-1));
        this.elements.nextMonth?.addEventListener('click', () => this.navigateMonth(1));

        // Modal controls
        this.elements.closeModal?.addEventListener('click', () => this.closeAppointmentModal());
        this.elements['cancel-btn']?.addEventListener('click', () => this.closeAppointmentModal());
        this.elements.appointmentForm?.addEventListener('submit', (e) => this.handleAppointmentSubmit(e));

        // File upload
        this.elements.attachment?.addEventListener('change', (e) => this.handleFileUpload(e));

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.appointmentModal) {
                this.closeAppointmentModal();
            }
        });
    }

    /**
     * Initialize the calendar display
     */
    initializeCalendar() {
        this.updateCalendarDisplay();
        this.hideTimeSlots();
    }

    /**
     * Navigate to previous or next month
     */
    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.updateCalendarDisplay();
        this.hideTimeSlots();
    }

    /**
     * Load user vehicles from API
     */
    async loadUserVehicles() {
        try {
            const response = await this.apiRequest('/api/vehicles', 'GET');
            const data = await response.json();

            if (data.success) {
                this.userVehicles = data.vehicles;
                this.populateVehicleSelect();
            } else {
                console.error('Error loading vehicles:', data.message);
            }
        } catch (error) {
            console.error('Error loading vehicles:', error);
        }
    }

    populateVehicleSelect() {
        const vehicleSelect = document.getElementById('vehicle-select');
        if (!vehicleSelect || this.userVehicles.length === 0) return;

        while (vehicleSelect.firstChild) {
            vehicleSelect.removeChild(vehicleSelect.firstChild);
        }

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selectează vehiculul (opțional)';
        vehicleSelect.appendChild(defaultOption);


        this.userVehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = this.security.sanitizeInput(vehicle.id);

            const brand = this.security.sanitizeInput(vehicle.brand || '');
            const model = this.security.sanitizeInput(vehicle.model || '');
            const year = this.security.sanitizeInput(vehicle.year || '');
            const vehicleType = this.security.sanitizeInput(vehicle.vehicle_type || '');

            option.textContent = `${brand} ${model} (${year}) - ${vehicleType}`;
            vehicleSelect.appendChild(option);
        });
    }

    /**
     * Update the calendar display
     */
    updateCalendarDisplay() {
        this.updateMonthHeader();
        this.renderCalendarDays();
    }

    /**
     * Update month/year header
     */
    updateMonthHeader() {
        if (!this.elements.monthYear) return;

        const monthName = this.config.monthNames[this.currentDate.getMonth()];
        const year = this.currentDate.getFullYear();
        const headerText = `${monthName} ${year}`;

        this.safeSetText(this.elements.monthYear, headerText);
    }

    /**
     * Render calendar days
     */
    renderCalendarDays() {
        if (!this.elements.calendarDays) return;

        // Clear previous days safely
        this.safeClearElement(this.elements.calendarDays);

        const { firstDay, daysInMonth, startingDayOfWeek } = this.getMonthData();
        const today = this.getTodayDate();

        // Add empty cells for days before month starts
        this.addEmptyDays(startingDayOfWeek);

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            this.addCalendarDay(day, today);
        }
    }

    /**
     * Get month data for rendering
     */
    getMonthData() {
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Adjust for Monday as first day
        let startingDayOfWeek = firstDay.getDay();
        startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

        return { firstDay, lastDay, daysInMonth, startingDayOfWeek };
    }

    /**
     * Get today's date with time reset
     */
    getTodayDate() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    /**
     * Add empty day cells
     */
    addEmptyDays(count) {
        for (let i = 0; i < count; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            this.elements.calendarDays.appendChild(emptyDay);
        }
    }

    /**
     * Add a calendar day element
     */
    addCalendarDay(day, today) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        this.safeSetText(dayElement, day.toString());

        const dayDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
        dayDate.setHours(0, 0, 0, 0);

        // Disable past dates and weekends
        if (this.isDayDisabled(dayDate, today)) {
            dayElement.classList.add('disabled');
        } else {
            dayElement.addEventListener('click', () => this.selectDate(dayDate, dayElement));
        }

        this.elements.calendarDays.appendChild(dayElement);
    }

    /**
     * Check if a day should be disabled
     */
    isDayDisabled(dayDate, today) {
        return dayDate < today || dayDate.getDay() === 0 || dayDate.getDay() === 6;
    }

    /**
     * Select a date
     */
    selectDate(date, element) {
        this.selectedDate = date;
        this.updateDateSelection(element);
        this.showTimeSlots(date);
    }

    /**
     * Update visual date selection
     */
    updateDateSelection(selectedElement) {
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        selectedElement.classList.add('selected');
    }

    /**
     * Show available time slots for selected date
     */
    async showTimeSlots(date) {
        if (!this.elements.timeSlotSection || !this.elements.selectedDate || !this.elements.timeSlots) {
            return;
        }

        const dateString = this.formatDate(date);
        this.safeSetText(this.elements.selectedDate, dateString);
        this.elements.timeSlotSection.style.display = 'block';

        // Clear and show loading message safely
        this.safeClearElement(this.elements.timeSlots);
        const loadingMessage = this.createSafeTextElement('p', '', 'Se încarcă sloturile disponibile...');
        this.elements.timeSlots.appendChild(loadingMessage);

        try {
            const dateParam = date.toISOString().split('T')[0];
            const response = await this.apiRequest(`/api/calendar/available-slots?date=${dateParam}`, 'GET');
            const data = await response.json();

            if (data.success) {
                this.displayTimeSlots(data.availableSlots);
            } else {
                this.safeClearElement(this.elements.timeSlots);
                const errorMessage = this.security.sanitizeInput(data.message);
                const errorElement = this.createSafeTextElement('p', 'error-message', errorMessage);
                this.elements.timeSlots.appendChild(errorElement);
            }
        } catch (error) {
            console.error('Error loading time slots:', error);
            this.safeClearElement(this.elements.timeSlots);
            const errorElement = this.createSafeTextElement('p', 'error-message', 'Eroare la încărcarea sloturilor disponibile');
            this.elements.timeSlots.appendChild(errorElement);
        }
    }

    /**
     * Display available time slots
     */
    displayTimeSlots(availableSlots) {
        if (!this.elements.timeSlots) return;

        // Clear previous content safely
        while (this.elements.timeSlots.firstChild) {
            this.elements.timeSlots.removeChild(this.elements.timeSlots.firstChild);
        }

        if (availableSlots.length === 0) {
            // Create safe no-slots message
            const noSlotsMessage = document.createElement('p');
            noSlotsMessage.className = 'no-slots-message';
            this.safeSetText(noSlotsMessage, 'Nu sunt sloturile disponibile pentru această dată');
            this.elements.timeSlots.appendChild(noSlotsMessage);
            return;
        }

        availableSlots.forEach(slot => {
            const slotElement = this.createTimeSlotElement(slot);
            this.elements.timeSlots.appendChild(slotElement);
        });
    }

    /**
     * Create a time slot element
     */
    createTimeSlotElement(slot) {
        const slotElement = document.createElement('div');
        slotElement.className = 'time-slot';

        const startTime = this.security.sanitizeInput(slot.startTime.substring(0, 5));
        const endTime = this.security.sanitizeInput(slot.endTime.substring(0, 5));
        const availableSpots = this.security.sanitizeInput(slot.availableSpots.toString());

        // Create safe HTML structure
        const timeSpan = document.createElement('span');
        timeSpan.className = 'slot-time';
        this.safeSetText(timeSpan, `${startTime} - ${endTime}`);

        const availabilitySpan = document.createElement('span');
        availabilitySpan.className = 'slot-availability';
        this.safeSetText(availabilitySpan, `${availableSpots} locuri disponibile`);

        slotElement.appendChild(timeSpan);
        slotElement.appendChild(availabilitySpan);

        slotElement.addEventListener('click', () => this.selectTimeSlot(startTime, slotElement));
        return slotElement;
    }

    /**
     * Hide time slots section
     */
    hideTimeSlots() {
        if (this.elements.timeSlotSection) {
            this.elements.timeSlotSection.style.display = 'none';
        }
        this.selectedDate = null;
        this.selectedTimeSlot = null;
    }

    /**
     * Select a time slot
     */
    selectTimeSlot(time, element) {
        this.selectedTimeSlot = time;
        this.updateTimeSlotSelection(element);
        this.openAppointmentModal(this.selectedDate, time);
    }

    /**
     * Update visual time slot selection
     */
    updateTimeSlotSelection(selectedElement) {
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        selectedElement.classList.add('selected');
    }

    /**
     * Open appointment modal
     */
    openAppointmentModal(date, time) {
        if (!this.elements.appointmentModal) return;

        if (this.elements['appointment-date']) {
            this.elements['appointment-date'].value = this.security.sanitizeInput(this.formatDate(date));
        }
        if (this.elements['appointment-time']) {
            this.elements['appointment-time'].value = this.security.sanitizeInput(time);
        }
        if (this.elements['slot-id']) {
            this.elements['slot-id'].value = this.security.sanitizeInput(`${date.getTime()}_${time}`);
        }

        this.elements.appointmentModal.style.display = 'flex';
    }

    closeAppointmentModal() {
        if (!this.elements.appointmentModal) return;

        this.elements.appointmentModal.style.display = 'none';
        this.elements.appointmentForm?.reset();

        if (this.elements['file-list']) {
            while (this.elements['file-list'].firstChild) {
                this.elements['file-list'].removeChild(this.elements['file-list'].firstChild);
            }
        }
    }

    /**
     * Handle appointment form submission
     */
    async handleAppointmentSubmit(e) {
        e.preventDefault();

        const appointmentData = this.getAppointmentData(e.target);

        if (!this.validateAppointmentForm(appointmentData)) {
            return;
        }

        try {
            this.showLoading(true);

            const response = await this.apiRequest('/api/appointments', 'POST', appointmentData);
            const data = await response.json();

            if (data.success) {
                this.handleAppointmentSuccess();
            } else {
                const errorMessage = this.security.sanitizeInput(data.message || 'Eroare la crearea programării');
                this.showMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error creating appointment:', error);
            this.showMessage('Eroare de rețea. Te rog încearcă din nou.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Get appointment data from form
     */
    getAppointmentData(form) {
        const formData = new FormData(form);

        // Sanitize all form inputs
        const serviceType = this.security.sanitizeInput(formData.get('serviceType'));
        const description = this.security.sanitizeInput(formData.get('description'));
        const vehicleId = formData.get('vehicleId') ? this.security.sanitizeInput(formData.get('vehicleId')) : null;

        return {
            date: this.selectedDate.toISOString().split('T')[0],
            time: this.selectedTimeSlot,
            serviceType: serviceType,
            description: description,
            vehicleId: vehicleId
        };
    }

    /**
     * Handle successful appointment creation
     */
    handleAppointmentSuccess() {
        this.showMessage('Programarea a fost creată cu succes!', 'success');
        this.closeAppointmentModal();

        // Refresh time slots
        setTimeout(() => {
            if (this.selectedDate) {
                this.showTimeSlots(this.selectedDate);
            }
        }, 1000);

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
    }

    /**
     * Validate appointment form data
     */
    validateAppointmentForm(data) {
        if (!data.serviceType) {
            this.showMessage('Te rog selectează tipul serviciului', 'error');
            return false;
        }

        if (!data.description || data.description.trim().length < this.config.minDescriptionLength) {
            this.showMessage(`Descrierea trebuie să conțină cel puțin ${this.config.minDescriptionLength} caractere`, 'error');
            return false;
        }

        if (!data.date || !data.time) {
            this.showMessage('Te rog selectează data și ora', 'error');
            return false;
        }

        // Additional security validation
        if (/<script|javascript:|on\w+\s*=/i.test(data.description) ||
            /<script|javascript:|on\w+\s*=/i.test(data.serviceType)) {
            this.showMessage('Conținut invalid detectat', 'error');
            return false;
        }

        return true;
    }

    /**
     * Handle file upload
     */
    handleFileUpload(e) {
        const files = Array.from(e.target.files);
        const fileList = this.elements['file-list'];

        if (!fileList) return;

        // Clear previous files safely
        this.safeClearElement(fileList);

        files.forEach((file, index) => {
            const fileItem = this.createFileItem(file, index);
            fileList.appendChild(fileItem);
        });

        this.setupFileRemoveListeners(fileList);
    }

    /**
     * Create file item element
     */
    createFileItem(file, index) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        // Create safe file name display
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'file-name';
        this.safeSetText(fileNameSpan, file.name);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-file';
        removeBtn.setAttribute('data-index', index.toString());
        this.safeSetText(removeBtn, '×');

        fileItem.appendChild(fileNameSpan);
        fileItem.appendChild(removeBtn);

        return fileItem;
    }

    /**
     * Setup file remove listeners
     */
    setupFileRemoveListeners(fileList) {
        fileList.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.removeFile(index);
            });
        });
    }

    removeFile(index) {
        const fileInput = this.elements.attachment;
        if (!fileInput) return;

        const dt = new DataTransfer();
        const files = Array.from(fileInput.files);

        files.forEach((file, i) => {
            if (i !== index) {
                dt.items.add(file);
            }
        });

        fileInput.files = dt.files;
        this.handleFileUpload({ target: fileInput });
    }

    showLoading(show) {
        if (this.elements.loading) {
            this.elements.loading.style.display = show ? 'flex' : 'none';
        }
    }

    showMessage(message, type = 'info') {
        const toast = this.elements['message-toast'];
        const messageText = this.elements['message-text'];

        if (toast && messageText) {
            // Sanitize the message before displaying
            const sanitizedMessage = this.security.sanitizeInput(message);
            this.safeSetText(messageText, sanitizedMessage);

            // Sanitize the type class
            const sanitizedType = this.security.sanitizeInput(type);
            toast.className = `message-toast ${sanitizedType}`;
            toast.style.display = 'block';

            setTimeout(() => {
                toast.style.display = 'none';
            }, this.config.messageDisplayTime);
        }
    }

    async apiRequest(url, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        return fetch(url, config);
    }

}
const calendar = new AppointmentCalendar();