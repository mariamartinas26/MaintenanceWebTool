const { pool } = require('../database/db');
const AppointmentModel = require('../models/appointmentModel');
const CalendarModel = require('../models/calendarModel');
const { getUserIdFromToken } = require('../utils/authUtils');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateStatus(status) {
    const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
    return validStatuses.includes(status) ? status : null;
}

function sendJSON(res, statusCode, data) {
    setSecurityHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendSuccess(res, data, message) {
    sendJSON(res, 200, {
        success: true,
        message: validateInput(message),
        ...data
    });
}

function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, {
        success: false,
        message: validateInput(message)
    });
}

function sendCreated(res, data, message) {
    sendJSON(res, 201, {
        success: true,
        message: validateInput(message),
        ...data
    });
}

async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let totalSize = 0;
        const maxSize = 10 * 1024 * 1024; // 10MB limit

        req.on('data', chunk => {
            totalSize += chunk.length;
            if (totalSize > maxSize) {
                reject(new Error('Request body too large'));
                return;
            }
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                if (!body.trim()) {
                    resolve({});
                    return;
                }

                const parsed = safeJsonParse(body);
                if (parsed === null) {
                    reject(new Error('Invalid or potentially malicious JSON'));
                    return;
                }

                resolve(parsed);
            } catch (error) {
                reject(new Error('Invalid JSON in request body'));
            }
        });

        req.on('error', (error) => {
            reject(error);
        });
    });
}

class AppointmentController {
    static async getAppointments(req, res) {
        try {
            setSecurityHeaders(res);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const appointments = await AppointmentModel.getUserAppointments(userId);

            const formattedAppointments = appointments.map(row => ({
                id: row.id,
                date: row.appointment_date.toISOString().split('T')[0],
                time: row.appointment_date.toTimeString().slice(0, 5),
                status: validateInput(row.status),
                serviceType: 'general',
                description: validateInput(row.problem_description),
                adminResponse: validateInput(row.admin_response),
                estimatedPrice: row.estimated_price,
                estimatedCompletionTime: validateInput(row.estimated_completion_time),
                createdAt: row.created_at,
                vehicle: row.vehicle_type ? {
                    type: validateInput(row.vehicle_type),
                    brand: validateInput(row.brand),
                    model: validateInput(row.model),
                    year: validateInteger(row.year, 1900, new Date().getFullYear() + 10)
                } : null
            }));

            sendSuccess(res, { appointments: formattedAppointments }, 'Appointments loaded successfully');

        } catch (error) {
            console.error('Error in getAppointments:', error);
            sendError(res, 500, 'Error getting appointments: ' + validateInput(error.message));
        }
    }

    static async createAppointment(req, res) {
        try {
            setSecurityHeaders(res);

            const body = await getRequestBody(req);
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const date = validateInput(body.date);
            const time = validateInput(body.time);
            const description = validateInput(body.description);
            const vehicleId = validateInteger(body.vehicleId, 1);

            AppointmentController.validateAppointmentData(date, time, description);
            const appointmentDateTime = AppointmentController.createValidDateTime(date, time);
            await AppointmentController.validateAppointmentRules(userId, appointmentDateTime, date, time);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const newAppointment = await AppointmentModel.createAppointment(
                    userId,
                    vehicleId,
                    appointmentDateTime,
                    description
                );

                await CalendarModel.updateSlotAppointments(date, time, 1);

                await AppointmentModel.addAppointmentHistory(
                    client,
                    newAppointment.id,
                    userId,
                    'created',
                    'pending',
                    'Appointment created'
                );

                await client.query('COMMIT');

                const response = {
                    id: newAppointment.id,
                    date: newAppointment.appointment_date.toISOString().split('T')[0],
                    time: newAppointment.appointment_date.toTimeString().slice(0, 5),
                    status: validateInput(newAppointment.status),
                    description: validateInput(newAppointment.problem_description),
                    createdAt: newAppointment.created_at
                };

                sendCreated(res, { appointment: response }, 'Appointment created successfully!');

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error in createAppointment:', error);
            sendError(res, 500, 'Error creating appointment: ' + validateInput(error.message));
        }
    }

    static async updateAppointment(req, res, appointmentId) {
        try {
            setSecurityHeaders(res);

            const validAppointmentId = validateInteger(appointmentId, 1);
            if (!validAppointmentId) {
                return sendError(res, 400, 'Invalid appointment ID');
            }

            const body = await getRequestBody(req);
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const status = validateInput(body.status);

            if (status !== 'cancelled') {
                return sendError(res, 400, 'You can only cancel the appointment');
            }

            const appointment = await AppointmentModel.getAppointmentById(validAppointmentId, userId);

            if (!appointment) {
                return sendError(res, 404, 'Appointment not found');
            }

            AppointmentController.validateCancellation(appointment);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const updatedAppointment = await AppointmentModel.updateAppointmentStatus(validAppointmentId, 'cancelled');

                const appointmentDateTime = updatedAppointment.appointment_date;
                const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0];
                const appointmentTimeStr = appointmentDateTime.toTimeString().slice(0, 5);

                await CalendarModel.updateSlotAppointments(appointmentDateStr, appointmentTimeStr, -1);

                await AppointmentModel.addAppointmentHistory(
                    client,
                    validAppointmentId,
                    userId,
                    'cancelled',
                    'cancelled',
                    'Appointment cancelled',
                    appointment.status
                );

                await client.query('COMMIT');

                sendSuccess(res, {}, 'Appointment cancelled successfully!');

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error in updateAppointment:', error);
            sendError(res, 500, 'Error updating appointment: ' + validateInput(error.message));
        }
    }

    static validateAppointmentData(date, time, description) {
        if (!date || !time || !description) {
            throw new Error('Date, hour and description are required');
        }

        const cleanDescription = description.trim();
        if (cleanDescription.length < 10) {
            throw new Error('Description should be at least 10 characters long');
        }

        if (cleanDescription.length > 2000) {
            throw new Error('Description too long (max 2000 characters)');
        }

        if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanDescription)) {
            throw new Error('Invalid description content');
        }
    }

    static createValidDateTime(date, time) {
        if (!date || !time) {
            throw new Error('Date and hour are required');
        }

        const dateStr = String(date).trim();
        const timeStr = String(time).trim();

        if (dateStr.length > 10 || timeStr.length > 8) {
            throw new Error('Date or time format too long');
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
            throw new Error(`Invalid data format: ${dateStr}. Use YYYY-MM-DD`);
        }

        const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
        if (!timeRegex.test(timeStr)) {
            throw new Error(`Time format invalid: ${timeStr}. Use HH:MM sau HH:MM:SS`);
        }

        const dateParts = dateStr.split('-').map(num => parseInt(num));
        const year = dateParts[0];
        const month = dateParts[1];
        const day = dateParts[2];

        if (year < 2020 || year > 2030 || month < 1 || month > 12 || day < 1 || day > 31) {
            throw new Error('Invalid date values');
        }

        const timeParts = timeStr.split(':').map(num => parseInt(num));
        const hour = timeParts[0];
        const minute = timeParts[1];

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new Error('Invalid time values');
        }

        const fullTimeStr = timeStr.includes(':') && timeStr.split(':').length === 2
            ? `${timeStr}:00`
            : timeStr;

        const dateTimeString = `${dateStr}T${fullTimeStr}`;
        const appointmentDateTime = new Date(dateTimeString);

        if (isNaN(appointmentDateTime.getTime())) {
            throw new Error(`Date and hour not valid: ${dateStr} ${timeStr}`);
        }

        return appointmentDateTime;
    }

    static async validateAppointmentRules(userId, appointmentDateTime, date, time) {
        const now = new Date();
        const maxFutureDate = new Date();
        maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);

        if (appointmentDateTime <= now) {
            throw new Error('Date and hour of the appointment should be in the future');
        }

        if (appointmentDateTime > maxFutureDate) {
            throw new Error('Appointment cannot be scheduled more than 1 year in advance');
        }

        const hasExistingAppointment = await AppointmentModel.checkExistingAppointment(userId, appointmentDateTime);

        if (hasExistingAppointment) {
            throw new Error('You already have an appointment at this hour!');
        }

        await AppointmentController.ensureSlotsExistForDate(date);
        const slot = await CalendarModel.getSlotByDateTime(date, time);

        if (!slot) {
            throw new Error('Occupied slot');
        }

        if (!slot.is_available) {
            throw new Error('Occupied slot');
        }

        if (slot.current_appointments >= slot.max_appointments) {
            throw new Error('Occupied slot');
        }
    }

    static validateCancellation(appointment) {
        const validStatus = validateStatus(appointment.status);

        if (validStatus === 'cancelled') {
            throw new Error('Appointment already cancelled');
        }

        if (validStatus === 'completed') {
            throw new Error('You can not cancel a completed appointment');
        }

        const appointmentDate = new Date(appointment.appointment_date);
        const now = new Date();
        const timeDiff = appointmentDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        if (hoursDiff < 1) {
            throw new Error('You can not cancel the appointment at this hour!');
        }
    }

    static async ensureSlotsExistForDate(date) {
        const existingCount = await CalendarModel.getSlotsCountForDate(date);

        if (existingCount > 0) {
            return;
        }

        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return;
        }

        const workingHours = [
            { start: '08:00:00', end: '09:00:00', maxAppointments: 2 },
            { start: '09:00:00', end: '10:00:00', maxAppointments: 2 },
            { start: '10:00:00', end: '11:00:00', maxAppointments: 2 },
            { start: '11:00:00', end: '12:00:00', maxAppointments: 2 },
            { start: '13:00:00', end: '14:00:00', maxAppointments: 2 },
            { start: '14:00:00', end: '15:00:00', maxAppointments: 2 },
            { start: '15:00:00', end: '16:00:00', maxAppointments: 2 },
            { start: '16:00:00', end: '17:00:00', maxAppointments: 2 }
        ];

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await CalendarModel.createSlotsForDate(client, date, workingHours);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = AppointmentController;