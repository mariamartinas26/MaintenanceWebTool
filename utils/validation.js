const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePhone = (phone) => {
    const phoneRegex = /^0\d{9}$/;
    return phoneRegex.test(phone);
};

const validateName = (name) => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    const nameRegex = /^[a-zA-Z\s]+$/;
    return nameRegex.test(trimmed);
};

const validatePassword = (password) => {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 6;
};

const validateRegisterData = (data) => {
    const errors = [];

    if (!validateEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (!validatePassword(data.password)) {
        errors.push('Password must be at least 6 characters long');
    }

    if (!validateName(data.first_name)) {
        errors.push('First name must be between 2 and 50 characters and contain only letters');
    }

    if (!validateName(data.last_name)) {
        errors.push('Last name must be between 2 and 50 characters and contain only letters');
    }

    if (!validatePhone(data.phone)) {
        errors.push('Phone number must have format 07xxxxxxxx');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

module.exports = {
    validateEmail,
    validatePhone,
    validateName,
    validatePassword,
    validateRegisterData
};