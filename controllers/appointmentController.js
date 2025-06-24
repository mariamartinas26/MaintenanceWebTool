const { pool } = require('../database/db');
const AppointmentModel = require('../models/appointmentModel');
const CalendarModel = require('../models/calendarModel');
const { getUserIdFromToken } = require('../middleware/auth');
const { sanitizeInput, setSecurityHeaders } = require('../middleware/auth');
const { validateAppointmentData, sanitizeUserInput } = require('../utils/validation');

class AppointmentController {
    static async getAppointments(req, res) {
        try {

            const userId = getUserIdFromToken(req.headers.authorization);
            if (!userId) return sendError(res, 401, 'Invalid or missing token');

            //extragem toate programarile user-ului din bd
            const appointments = await AppointmentModel.getUserAppointments(userId);

            //formateaza datele pentru a fi trimise la client
            const formattedAppointments = appointments.map(row => ({
                id: row.id,
                date: row.appointment_date.toISOString().split('T')[0],
                time: row.appointment_date.toTimeString().slice(0, 5),
                status: row.status,
                serviceType: 'general',
                description: row.problem_description,
                adminResponse: row.admin_response,
                estimatedPrice: row.estimated_price,
                estimatedCompletionTime: row.estimated_completion_time,
                createdAt: row.created_at,
                vehicle: row.vehicle_type ? {
                    type: row.vehicle_type,
                    brand: row.brand,
                    model: row.model,
                    year: row.year
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

            const sanitizedData = sanitizeUserInput(body);
            const validation = validateAppointmentData(sanitizedData);

            if (!validation.isValid) {
                return sendError(res, 400, validation.errors.join(', '));
            }

            const { date, time, description, vehicleId } = sanitizedData;

            const appointmentDateTime = AppointmentController.validateAndCreateDateTime(date, time);

            await AppointmentController.validateAppointmentRules(userId, appointmentDateTime, date, time);

            //incepem o tranzactie in bd
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                //creez programarea in bd
                const newAppointment = await AppointmentModel.createAppointment(
                    userId,
                    validateInteger(vehicleId, 1),
                    appointmentDateTime,
                    description
                );
                //updatez calendarul
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
                    status: newAppointment.status,
                    description: newAppointment.problem_description,
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
        const withoutSec = time.includes(':') && time.split(':').length === 3
            ? time.substring(0, 5)  //elimin secundele
            : time;

        const appointmentDateTime = new Date(`${date}T${withoutSec}:00`);

        //returneaza true daca nu e un nr valid
        if (isNaN(appointmentDateTime.getTime())) {
            throw new Error('Invalid date or time');
        }

        //verificam daca programarea e in viitor
        const now = new Date(); //data curenta
        if (appointmentDateTime <= now) {
            throw new Error('Appointment must be in the future');
        }

        //sa nu putem programa cu mai mult de 1 an in avans
        const maxFuture = new Date();
        maxFuture.setFullYear(maxFuture.getFullYear() + 1);
        if (appointmentDateTime > maxFuture) {
            throw new Error('Cannot schedule more than 1 year in advance');
        }

        return appointmentDateTime;
    }

    static async validateAppointmentRules(userId, appointmentDateTime, date, time) {
        //verific daca mai exista o programare a aceluiasi client la aceasi ora
        const hasExistingAppointment = await AppointmentModel.checkExistingAppointment(userId, appointmentDateTime);
        if (hasExistingAppointment) {
            throw new Error('You already have an appointment at this time!');
        }

        //ne asiguram ca avem solt-uri disponibile
        await AppointmentController.ensureSlotsExistForDate(date);
        const slot = await CalendarModel.getSlotByDateTime(date, time);
        //verificam sa fie valabil slot-ul
        if (!slot || !slot.is_available || slot.current_appointments >= slot.max_appointments) {
            throw new Error('Time slot is not available');
        }
    }

    static async ensureSlotsExistForDate(date) {
        //verific daca exista deja sloturi pentru acea data
        const existingCount = await CalendarModel.getSlotsNumberForDate(date);
        if (existingCount > 0) return;

        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        //nu se lucreaza in weekend
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

        const workingHours = [
            { start: '08:00', end: '09:00', maxAppointments: 3 },
            { start: '09:00', end: '10:00', maxAppointments: 3 },
            { start: '10:00', end: '11:00', maxAppointments: 3 },
            { start: '11:00', end: '12:00', maxAppointments: 3 },
            { start: '13:00', end: '14:00', maxAppointments: 3 },
            { start: '14:00', end: '15:00', maxAppointments: 3 },
            { start: '15:00', end: '16:00', maxAppointments: 3 },
            { start: '16:00', end: '17:00', maxAppointments: 3 }
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
        //toate datele pe care le primim
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                //procesam datele complete
                if (!body.trim()) {
                    resolve({});
                    return;
                }
                const parsed = JSON.parse(body);
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

module.exports = AppointmentController;