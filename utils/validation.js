function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const valid1 = /^0\d{9}$/;
    const valid2 = /^[\d\s\+\-\(\)]{10,15}$/;
    return valid1.test(phone) || valid2.test(phone);
}

function isValidName(name) {
    const validName = /^[a-zA-ZÀ-ÿ\s\-']{2,50}$/;
    return validName.test(name);
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

function validateSupplierData(data) {
    const { company_name, contact_person, email, phone, address, delivery_time_days } = data;
    const errors = [];

    if (!company_name || company_name.trim() === '') {
        errors.push('Company name is required');
    } else if (company_name.length > 100) {
        errors.push('Company name cannot exceed 100 characters');
    }

    if (!contact_person || contact_person.trim() === '') {
        errors.push('Contact person is required');
    } else if (contact_person.length > 100) {
        errors.push('Contact person name cannot exceed 100 characters');
    }

    if (!email || email.trim() === '') {
        errors.push('Email is required');
    } else if (!isValidEmail(email)) {
        errors.push('Please enter a valid email address');
    }

    if (phone && phone.trim() !== '' && !isValidPhone(phone)) {
        errors.push('Please enter a valid phone number');
    }

    if (address && address.length > 255) {
        errors.push('Address cannot exceed 255 characters');
    }

    if (delivery_time_days !== undefined && delivery_time_days !== null && delivery_time_days !== '') {
        const days = parseInt(delivery_time_days);
        if (isNaN(days) || days < 1 || days > 365) {
            errors.push('Delivery time must be between 1 and 365 days');
        }
    }
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

//pt import
function validatePartData(data) {
    const { name, description, part_number, category, price, stock_quantity, minimum_stock_level, supplier_id } = data;
    const errors = [];

    if (!name || name.trim() === '') {
        errors.push('Part name is required');
    } else if (name.length > 100) {
        errors.push('Part name cannot exceed 100 characters');
    }

    if (!price || price.toString().trim() === '') {
        errors.push('Price is required');
    } else {
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
            errors.push('Price must be a valid positive number');
        }
    }
    if (description && description.length > 500) {
        errors.push('Description cannot exceed 500 characters');
    }

    if (part_number && part_number.length > 50) {
        errors.push('Part number cannot exceed 50 characters');
    }

    if (category && category.length > 50) {
        errors.push('Category cannot exceed 50 characters');
    }

    if (stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== '') {
        const quantity = parseInt(stock_quantity);
        if (isNaN(quantity) || quantity < 0) {
            errors.push('Stock quantity must be a valid non-negative number');
        }
    }

    if (minimum_stock_level !== undefined && minimum_stock_level !== null && minimum_stock_level !== '') {
        const minLevel = parseInt(minimum_stock_level);
        if (isNaN(minLevel) || minLevel < 0) {
            errors.push('Minimum stock level must be a valid non-negative number');
        }
    }

    if (supplier_id !== undefined && supplier_id !== null && supplier_id !== '') {
        const supplierId = parseInt(supplier_id);
        if (isNaN(supplierId) || supplierId < 1) {
            errors.push('Supplier ID must be a valid positive number');
        }
    }
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateImportAppointmentData(data) {
    const { user_id, vehicle_id, appointment_date, status, problem_description, estimated_price } = data;
    const errors = [];

    if (!user_id || user_id.toString().trim() === '') {
        errors.push('User ID is required');
    } else {
        const userId = parseInt(user_id);
        if (isNaN(userId) || userId < 1) {
            errors.push('User ID must be a valid positive number');
        }
    }

    if (!appointment_date || appointment_date.trim() === '') {
        errors.push('Appointment date is required');
    } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}(:\d{2})?)?$/;
        if (!dateRegex.test(appointment_date)) {
            errors.push('Appointment date');
        } else {
            const date = new Date(appointment_date);
            if (isNaN(date.getTime())) {
                errors.push('Invalid appointment date');
            }
        }
    }
    if (!problem_description || problem_description.trim() === '') {
        errors.push('Problem description is required');
    } else if (problem_description.trim().length < 10) {
        errors.push('Problem description must be at least 10 characters long');
    } else if (problem_description.length > 1000) {
        errors.push('Problem description cannot exceed 1000 characters');
    }

    if (vehicle_id !== undefined && vehicle_id !== null && vehicle_id !== '') {
        const vehicleId = parseInt(vehicle_id);
        if (isNaN(vehicleId) || vehicleId < 1) {
            errors.push('Vehicle ID must be a valid positive number');
        }
    }

    if (status && status.trim() !== '') {
        const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status.toLowerCase())) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
    }

    if (estimated_price !== undefined && estimated_price !== null && estimated_price !== '') {
        const price = parseFloat(estimated_price);
        if (isNaN(price) || price < 0) {
            errors.push('Estimated price must be a valid non-negative number');
        }
    }
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateRegisterData(data) {
    const { email, password, first_name, last_name, phone } = data;
    const errors = [];

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
        errors.push('Please enter a valid phone number');
    }
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateAppointmentData(data) {
    const { date, time, description, vehicleId } = data;
    const errors = [];

    if (!date) {
        errors.push('Appointment date is required');
    } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            errors.push('Invalid date format');
        } else {
            const appointmentDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (isNaN(appointmentDate.getTime())) {
                errors.push('Invalid date');
            } else if (appointmentDate < today) {
                errors.push('Appointment date cannot be in the past');
            }
        }
    }
    //validare ora
    if (!time) {
        errors.push('Appointment time is required');
    }

    if (!description) {
        errors.push('Problem description is required');
    } else if (description.trim().length < 10) {
        errors.push('Problem description must be at least 10 characters long');
    } else if (description.trim().length > 500) {
        errors.push('Problem description cannot exceed 500 characters');
    }

    if (vehicleId !== undefined) {
        const vehicleIdNum = parseInt(vehicleId);
        if (isNaN(vehicleIdNum) || vehicleIdNum < 1) {
            errors.push('Valid vehicle ID is required');
        }
    }
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateVehicleData(data) {
    const { vehicle_type, brand, model, year } = data;
    const errors = [];

    if (!vehicle_type) {
        errors.push('Vehicle type is required');
    } else {
        const validTypes = ['motocicleta', 'bicicleta', 'trotineta'];
        if (!validTypes.includes(vehicle_type)) {
            errors.push('Vehicle type ');
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
            errors.push(`Year must be between 1900 and ${currentYear }`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

module.exports = {
    isValidEmail,
    isValidPhone,
    isValidName,
    validateRegisterData,
    validateAppointmentData,
    validateVehicleData,
    sanitizeString,
    sanitizeUserInput,
    validateSupplierData,
    validatePartData,
    validateImportAppointmentData
};