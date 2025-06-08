
/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function isValidPassword(password) {
    return password && password.length >= 6;
}

/**
 * Validate phone number
 */
function isValidPhone(phone) {
    const romanianPhoneRegex = /^0\d{9}$/;
    const internationalPhoneRegex = /^[\d\s\+\-\(\)]{10,15}$/;

    return romanianPhoneRegex.test(phone) || internationalPhoneRegex.test(phone);
}

/**
 * Validate name
 */
function isValidName(name) {
    const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,50}$/;
    return nameRegex.test(name);
}

/**
 * Validate registration data
 */
function validateRegisterData(data) {
    const { email, password, first_name, last_name, phone } = data;
    const errors = [];

    // Check required fields
    if (!email) {
        errors.push('Email is required');
    } else if (!isValidEmail(email)) {
        errors.push('Please enter a valid email address');
    }

    if (!password) {
        errors.push('Password is required');
    } else if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (!first_name) {
        errors.push('First name is required');
    } else if (!isValidName(first_name)) {
        errors.push('First name must be between 2-50 characters and contain only letters');
    }

    if (!last_name) {
        errors.push('Last name is required');
    } else if (!isValidName(last_name)) {
        errors.push('Last name must be between 2-50 characters and contain only letters');
    }

    if (!phone) {
        errors.push('Phone number is required');
    } else if (!isValidPhone(phone)) {
        errors.push('Please enter a valid phone number (format: 07xxxxxxxx)');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validate login data
 */
function validateLoginData(data) {
    const { email, password } = data;
    const errors = [];

    if (!email) {
        errors.push('Email is required');
    } else if (!isValidEmail(email)) {
        errors.push('Please enter a valid email address');
    }

    if (!password) {
        errors.push('Password is required');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validate appointment data
 */
function validateAppointmentData(data) {
    const { date, time, description } = data;
    const errors = [];

    if (!date) {
        errors.push('Appointment date is required');
    } else {
        const appointmentDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (appointmentDate < today) {
            errors.push('Appointment date cannot be in the past');
        }
    }

    if (!time) {
        errors.push('Appointment time is required');
    }

    if (!description) {
        errors.push('Problem description is required');
    } else if (description.trim().length < 10) {
        errors.push('Problem description must be at least 10 characters long');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validate vehicle data
 */
function validateVehicleData(data) {
    const { vehicle_type, brand, model, year } = data;
    const errors = [];

    if (!vehicle_type) {
        errors.push('Vehicle type is required');
    } else {
        const validTypes = ['motocicleta', 'bicicleta', 'trotineta'];
        if (!validTypes.includes(vehicle_type)) {
            errors.push('Vehicle type must be: motocicleta, bicicleta, or trotineta');
        }
    }

    if (!brand) {
        errors.push('Brand is required');
    } else if (brand.length > 100) {
        errors.push('Brand cannot be longer than 100 characters');
    }

    if (!model) {
        errors.push('Model is required');
    } else if (model.length > 100) {
        errors.push('Model cannot be longer than 100 characters');
    }

    if (!year) {
        errors.push('Year is required');
    } else {
        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear + 1) {
            errors.push(`Year must be between 1900 and ${currentYear + 1}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}


function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
}


function sanitizeUserInput(data) {
    const sanitized = {};

    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

module.exports = {
    isValidEmail,
    isValidPassword,
    isValidPhone,
    isValidName,
    validateRegisterData,
    validateLoginData,
    validateAppointmentData,
    validateVehicleData,
    sanitizeString,
    sanitizeUserInput
};