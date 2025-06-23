const { pool } = require('../database/db');
const AppointmentModel = require('../models/appointmentModel');
const CalendarModel = require('../models/calendarModel');
const { getUserIdFromToken } = require('../middleware/auth');
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

function sendJSON(res, statusCode, data) {
    setSecurityHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendSuccess(res, data, message) {
    sendJSON(res, 200, { success: true, message: validateInput(message), ...data });
}

function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, { success: false, message: validateInput(message) });
}

function sendCreated(res, data, message) {
    sendJSON(res, 201, { success: true, message: validateInput(message), ...data });
}

async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let totalSize = 0;
        const maxSize = 10 * 1024 * 1024;

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
            const userId = getUserIdFromToken(req.headers.authorization);
            if (!userId) return sendError(res, 401, 'Invalid or missing token');

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
            sendError(res, 500, 'Error getting appointments: ' + validateInput(error.message));
        }
    }

    static async createAppointment(req, res) {
        try {
            const body = await getRequestBody(req);
            const userId = getUserIdFromToken(req.headers.authorization);

            if (!userId) return sendError(res, 401, 'Invalid or missing token');

            const { date, time, description, vehicleId } = body;

            // Validate and create datetime
            const appointmentDateTime = AppointmentController.validateAndCreateDateTime(
                validateInput(date),
                validateInput(time)
            );

            // Validate description
            AppointmentController.validateDescription(validateInput(description));

            // Validate business rules
            await AppointmentController.validateAppointmentRules(userId, appointmentDateTime, date, time);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const newAppointment = await AppointmentModel.createAppointment(
                    userId,
                    validateInteger(vehicleId, 1),
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
            sendError(res, 500, 'Error creating appointment: ' + validateInput(error.message));
        }
    }

    static validateAndCreateDateTime(date, time) {
        if (!date || !time) {
            throw new Error('Date and time are required');
        }

        // Simple format validation
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
        }

        // Accept both HH:MM and HH:MM:SS formats
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
            throw new Error('Invalid time format. Use HH:MM');
        }

        // Ensure time has seconds for proper datetime construction
        const timeWithSeconds = time.includes(':') && time.split(':').length === 2
            ? `${time}:00`
            : time;

        const appointmentDateTime = new Date(`${date}T${timeWithSeconds}`);

        if (isNaN(appointmentDateTime.getTime())) {
            throw new Error('Invalid date or time');
        }

        // Check if in future
        const now = new Date();
        if (appointmentDateTime <= now) {
            throw new Error('Appointment must be in the future');
        }

        // Check if not too far in future
        const maxFuture = new Date();
        maxFuture.setFullYear(maxFuture.getFullYear() + 1);
        if (appointmentDateTime > maxFuture) {
            throw new Error('Cannot schedule more than 1 year in advance');
        }

        return appointmentDateTime;
    }

    static validateDescription(description) {
        if (!description) {
            throw new Error('Description is required');
        }

        const cleanDescription = description.trim();
        if (cleanDescription.length < 10) {
            throw new Error('Description should be at least 10 characters long');
        }
    }

    static async validateAppointmentRules(userId, appointmentDateTime, date, time) {
        // Check for existing appointment at same time
        const hasExistingAppointment = await AppointmentModel.checkExistingAppointment(userId, appointmentDateTime);
        if (hasExistingAppointment) {
            throw new Error('You already have an appointment at this time!');
        }

        // Ensure slots exist and check availability
        await AppointmentController.ensureSlotsExistForDate(date);
        const slot = await CalendarModel.getSlotByDateTime(date, time);

        if (!slot || !slot.is_available || slot.current_appointments >= slot.max_appointments) {
            throw new Error('Time slot is not available');
        }
    }

    static async ensureSlotsExistForDate(date) {
        const existingCount = await CalendarModel.getSlotsCountForDate(date);
        if (existingCount > 0) return;

        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        //nu se lucreaza in weekend
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

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