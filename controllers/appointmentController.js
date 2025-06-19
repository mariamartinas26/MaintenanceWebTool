const { pool } = require('../database/db');
const AppointmentModel = require('../models/appointmentModel');
const CalendarModel = require('../models/calendarModel');
const { getUserIdFromToken } = require('../utils/authUtils');

// Funcții helper pentru răspunsuri HTTP native
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendSuccess(res, data, message) {
    sendJSON(res, 200, {
        success: true,
        message: message,
        ...data
    });
}

function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, {
        success: false,
        message: message
    });
}

function sendCreated(res, data, message) {
    sendJSON(res, 201, {
        success: true,
        message: message,
        ...data
    });
}

// Funcție pentru a extrage body-ul din request
async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
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

class AppointmentController {
    /**
     * GET /api/appointments - gets all appointments for a user
     */
    static async getAppointments(req, res) {
        try {
            console.log('Getting appointments for user...');

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                console.log('No valid user ID from token');
                return sendError(res, 401, 'Invalid or missing token');
            }

            console.log('User ID:', userId);
            const appointments = await AppointmentModel.getUserAppointments(userId);
            console.log('Retrieved appointments:', appointments.length);

            //format data for response
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
            console.error('Error in getAppointments:', error);
            sendError(res, 500, 'Error getting appointments: ' + error.message);
        }
    }

    /**
     * POST /api/appointments - creates a new appointment (original method)
     */
    static async createAppointment(req, res) {
        try {
            console.log('Creating new appointment...');

            const body = await getRequestBody(req);
            console.log('Request body received:', body);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                console.log('No user ID found, sending 401');
                return sendError(res, 401, 'Invalid or missing token');
            }

            console.log('User ID for new appointment:', userId);
            const { date, time, description, vehicleId } = body;
            console.log('Appointment data:', { date, time, description, vehicleId });

            //data validation
            console.log('Starting data validation...');
            AppointmentController.validateAppointmentData(date, time, description);
            console.log('Data validation passed');

            console.log('Creating valid date time...');
            const appointmentDateTime = AppointmentController.createValidDateTime(date, time);
            console.log('Valid date time created:', appointmentDateTime);

            console.log('Validating appointment rules...');
            await AppointmentController.validateAppointmentRules(userId, appointmentDateTime, date, time);
            console.log('Appointment rules validation passed');

            const client = await pool.connect();
            console.log('Database connection acquired');

            try {
                await client.query('BEGIN');
                console.log('Transaction started');

                //insert appointment
                console.log('Creating appointment in database...');
                const newAppointment = await AppointmentModel.createAppointment(
                    userId,
                    vehicleId,
                    appointmentDateTime,
                    description
                );
                console.log('Appointment created in database:', newAppointment.id);

                //updates calendar
                console.log('Updating calendar...');
                await CalendarModel.updateSlotAppointments(date, time, 1);
                console.log('Calendar updated');

                //add to appointment history
                console.log('Adding to appointment history...');
                await AppointmentModel.addAppointmentHistory(
                    client,
                    newAppointment.id,
                    userId,
                    'created',
                    'pending',
                    'Appointment created'
                );
                console.log('Appointment history added');

                await client.query('COMMIT');
                console.log('Transaction committed');

                const response = {
                    id: newAppointment.id,
                    date: newAppointment.appointment_date.toISOString().split('T')[0],
                    time: newAppointment.appointment_date.toTimeString().slice(0, 5),
                    status: newAppointment.status,
                    description: newAppointment.problem_description,
                    createdAt: newAppointment.created_at
                };

                console.log('Sending success response...');
                sendCreated(res, { appointment: response }, 'Appointment created successfully!');
                console.log('Success response sent');

            } catch (error) {
                console.log('Error in transaction, rolling back:', error.message);
                await client.query('ROLLBACK');
                throw error;
            } finally {
                console.log('Releasing database connection');
                client.release();
            }

        } catch (error) {
            console.error('Error in createAppointment:', error);
            console.error('Error stack:', error.stack);
            sendError(res, 500, 'Error creating appointment: ' + error.message);
        }
    }

    /**
     * POST /api/appointments - creates a new appointment (with body already extracted)
     */
    static async createAppointmentWithBody(req, res, body) {
        try {
            console.log('Creating new appointment with extracted body...');
            console.log('Request body received:', body);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                console.log('No user ID found, sending 401');
                return sendError(res, 401, 'Invalid or missing token');
            }

            console.log('User ID for new appointment:', userId);
            const { date, time, description, vehicleId } = body;
            console.log('Appointment data:', { date, time, description, vehicleId });

            //data validation
            console.log('Starting data validation...');
            AppointmentController.validateAppointmentData(date, time, description);
            console.log('Data validation passed');

            console.log('Creating valid date time...');
            const appointmentDateTime = AppointmentController.createValidDateTime(date, time);
            console.log('Valid date time created:', appointmentDateTime);

            console.log('Validating appointment rules...');
            await AppointmentController.validateAppointmentRules(userId, appointmentDateTime, date, time);
            console.log('Appointment rules validation passed');

            const client = await pool.connect();
            console.log('Database connection acquired');

            try {
                await client.query('BEGIN');
                console.log('Transaction started');

                //insert appointment
                console.log('Creating appointment in database...');
                const newAppointment = await AppointmentModel.createAppointment(
                    userId,
                    vehicleId,
                    appointmentDateTime,
                    description
                );
                console.log('Appointment created in database:', newAppointment.id);

                //updates calendar
                console.log('Updating calendar...');
                await CalendarModel.updateSlotAppointments(date, time, 1);
                console.log('Calendar updated');

                //add to appointment history
                console.log('Adding to appointment history...');
                await AppointmentModel.addAppointmentHistory(
                    client,
                    newAppointment.id,
                    userId,
                    'created',
                    'pending',
                    'Appointment created'
                );
                console.log('Appointment history added');

                await client.query('COMMIT');
                console.log('Transaction committed');

                const response = {
                    id: newAppointment.id,
                    date: newAppointment.appointment_date.toISOString().split('T')[0],
                    time: newAppointment.appointment_date.toTimeString().slice(0, 5),
                    status: newAppointment.status,
                    description: newAppointment.problem_description,
                    createdAt: newAppointment.created_at
                };

                console.log('Sending success response...');
                sendCreated(res, { appointment: response }, 'Appointment created successfully!');
                console.log('Success response sent');

            } catch (error) {
                console.log('Error in transaction, rolling back:', error.message);
                await client.query('ROLLBACK');
                throw error;
            } finally {
                console.log('Releasing database connection');
                client.release();
            }

        } catch (error) {
            console.error('Error in createAppointmentWithBody:', error);
            console.error('Error stack:', error.stack);
            sendError(res, 500, 'Error creating appointment: ' + error.message);
        }
    }

    /**
     * PUT /api/appointments/:id - updates appointment status (original method)
     */
    static async updateAppointment(req, res, appointmentId) {
        try {
            console.log('Updating appointment:', appointmentId);

            const body = await getRequestBody(req);
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const { status } = body;

            //only cancelling available for clients
            if (status !== 'cancelled') {
                return sendError(res, 400, 'You can only cancel the appointment');
            }

            //checks if appointment belongs to client
            const appointment = await AppointmentModel.getAppointmentById(appointmentId, userId);

            if (!appointment) {
                return sendError(res, 404, 'Appointment not found');
            }

            AppointmentController.validateCancellation(appointment);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                //updates appointment status
                const updatedAppointment = await AppointmentModel.updateAppointmentStatus(appointmentId, 'cancelled');

                //updates calendar
                const appointmentDateTime = updatedAppointment.appointment_date;
                const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0];
                const appointmentTimeStr = appointmentDateTime.toTimeString().slice(0, 5);

                await CalendarModel.updateSlotAppointments(appointmentDateStr, appointmentTimeStr, -1);

                //add to appointment history
                await AppointmentModel.addAppointmentHistory(
                    client,
                    appointmentId,
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
            sendError(res, 500, 'Error updating appointment: ' + error.message);
        }
    }

    /**
     * PUT /api/appointments/:id - updates appointment status (with body already extracted)
     */
    static async updateAppointmentWithBody(req, res, appointmentId, body) {
        try {
            console.log('Updating appointment with extracted body:', appointmentId);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const { status } = body;

            //only cancelling available for clients
            if (status !== 'cancelled') {
                return sendError(res, 400, 'You can only cancel the appointment');
            }

            //checks if appointment belongs to client
            const appointment = await AppointmentModel.getAppointmentById(appointmentId, userId);

            if (!appointment) {
                return sendError(res, 404, 'Appointment not found');
            }

            AppointmentController.validateCancellation(appointment);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                //updates appointment status
                const updatedAppointment = await AppointmentModel.updateAppointmentStatus(appointmentId, 'cancelled');

                //updates calendar
                const appointmentDateTime = updatedAppointment.appointment_date;
                const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0];
                const appointmentTimeStr = appointmentDateTime.toTimeString().slice(0, 5);

                await CalendarModel.updateSlotAppointments(appointmentDateStr, appointmentTimeStr, -1);

                //add to appointment history
                await AppointmentModel.addAppointmentHistory(
                    client,
                    appointmentId,
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
            console.error('Error in updateAppointmentWithBody:', error);
            sendError(res, 500, 'Error updating appointment: ' + error.message);
        }
    }

    /**
     * validating appointment dates
     */
    static validateAppointmentData(date, time, description) {
        if (!date || !time || !description) {
            throw new Error('Date, hour and description are required');
        }

        if (description.trim().length < 10) {
            throw new Error('Description should be at least 10 characters long');
        }
    }

    static createValidDateTime(date, time) {
        if (!date || !time) {
            throw new Error('Date and hour are required');
        }

        const dateStr = String(date).trim();
        const timeStr = String(time).trim();

        //validates date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
            throw new Error(`Invalid data format: ${dateStr}. Use YYYY-MM-DD`);
        }

        //validates time format (HH:MM sau HH:MM:SS)
        const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
        if (!timeRegex.test(timeStr)) {
            throw new Error(`Time format invalid: ${timeStr}. Use HH:MM sau HH:MM:SS`);
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

    /**
     * Validare reguli business pentru programare
     */
    static async validateAppointmentRules(userId, appointmentDateTime, date, time) {
        //checks if date is not in the past
        const now = new Date();
        if (appointmentDateTime <= now) {
            throw new Error('Date and hour of the appointment should be in the future');
        }

        //checks if user doesn't have another appointment at the same time
        const hasExistingAppointment = await AppointmentModel.checkExistingAppointment(userId, appointmentDateTime);

        if (hasExistingAppointment) {
            throw new Error('You already have an appointment at this hour!');
        }

        //checks availability in calendar
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

    /**
     * checks possibility of cancellation
     */
    static validateCancellation(appointment) {
        if (appointment.status === 'cancelled') {
            throw new Error('Appointment already cancelled');
        }

        if (appointment.status === 'completed') {
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

    /**
     * creates slots for a date if they don't exist
     */
    static async ensureSlotsExistForDate(date) {
        const existingCount = await CalendarModel.getSlotsCountForDate(date);

        if (existingCount > 0) {
            return;
        }

        //checks if it is weekend
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return;
        }

        //creates slots
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