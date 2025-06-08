const { pool } = require('../database/db');
const AppointmentModel = require('../models/appointmentModel');
const CalendarModel = require('../models/calendarModel');
const { getUserIdFromToken } = require('../utils/authUtils');
const { sendSuccess, sendError, sendCreated } = require('../utils/response');

class AppointmentController {
    /**
     * GET /api/appointments - Obține programările utilizatorului
     */
    static async getAppointments(req, res) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const appointments = await AppointmentModel.getUserAppointments(userId);

            // Formatează datele pentru răspuns
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

            sendSuccess(res, { appointments: formattedAppointments }, 'Programările au fost încărcate cu succes');

        } catch (error) {
            console.error('Error getting appointments:', error);
            sendError(res, 500, 'Eroare la obținerea programărilor');
        }
    }

    /**
     * POST /api/appointments - Creează o programare nouă
     */
    static async createAppointment(req, res, body) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const { date, time, description, vehicleId } = body;

            console.log('[DEBUG] Creating appointment with:', { userId, date, time, description, vehicleId });

            // Validare date
            AppointmentController.validateAppointmentData(date, time, description);

            // Creează timestamp-ul corect
            const appointmentDateTime = AppointmentController.createValidDateTime(date, time);

            // Verificări business logic
            await AppointmentController.validateAppointmentBusinessRules(userId, appointmentDateTime, date, time);

            // Creează programarea în tranzacție
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Inserează programarea
                const newAppointment = await AppointmentModel.createAppointment(
                    userId,
                    vehicleId,
                    appointmentDateTime,
                    description
                );

                console.log('[DEBUG] Appointment created:', newAppointment.id);

                // Actualizează calendarul
                await CalendarModel.updateSlotAppointments(date, time, 1);

                // Adaugă în istoric
                await AppointmentModel.addAppointmentHistory(
                    client,
                    newAppointment.id,
                    userId,
                    'created',
                    'pending',
                    'Programare creată de client'
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
            console.error('Error creating appointment:', error);

            // Trimite mesajul de eroare specific
            if (error.message.includes('Data, ora și descrierea sunt obligatorii') ||
                error.message.includes('Descrierea trebuie să conțină') ||
                error.message.includes('Data și ora programării trebuie să fie în viitor') ||
                error.message.includes('Ai deja o programare activă') ||
                error.message.includes('Slot indisponibil')) {
                return sendError(res, 400, error.message);
            }

            sendError(res, 500, 'Eroare la crearea programării');
        }
    }

    /**
     * PUT /api/appointments/:id - Actualizează statusul unei programări
     */
    static async updateAppointment(req, res, appointmentId, body) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const { status } = body;

            // Doar anularea este permisă pentru clienți
            if (status !== 'cancelled') {
                return sendError(res, 400, 'You can only cancel the appointment');
            }

            // Verifică dacă programarea aparține utilizatorului
            const appointment = await AppointmentModel.getAppointmentById(appointmentId, userId);

            if (!appointment) {
                return sendError(res, 404, 'Programarea nu a fost găsită');
            }

            // Validează posibilitatea anulării
            AppointmentController.validateCancellation(appointment);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Actualizează statusul programării
                const updatedAppointment = await AppointmentModel.updateAppointmentStatus(appointmentId, 'cancelled');

                // Actualizează calendarul
                const appointmentDateTime = updatedAppointment.appointment_date;
                const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0];
                const appointmentTimeStr = appointmentDateTime.toTimeString().slice(0, 5);

                await CalendarModel.updateSlotAppointments(appointmentDateStr, appointmentTimeStr, -1);

                // Adaugă în istoric
                await AppointmentModel.addAppointmentHistory(
                    client,
                    appointmentId,
                    userId,
                    'cancelled',
                    'cancelled',
                    'Programare anulată de client',
                    appointment.status
                );

                await client.query('COMMIT');

                sendSuccess(res, {}, 'Programarea a fost anulată cu succes');

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error updating appointment:', error);

            if (error.message.includes('Programarea nu a fost găsită') ||
                error.message.includes('Programarea este deja anulată') ||
                error.message.includes('Nu poți anula o programare completată') ||
                error.message.includes('Nu poți anula programarea cu mai puțin de')) {
                return sendError(res, 400, error.message);
            }

            sendError(res, 500, 'Eroare la actualizarea programării');
        }
    }

    /**
     * Validare date programare
     */
    static validateAppointmentData(date, time, description) {
        if (!date || !time || !description) {
            throw new Error('Data, ora și descrierea sunt obligatorii');
        }

        if (description.trim().length < 10) {
            throw new Error('Descrierea trebuie să conțină cel puțin 10 caractere');
        }
    }

    /**
     * Creează un DateTime valid din string-uri
     */
    static createValidDateTime(date, time) {
        if (!date || !time) {
            throw new Error('Data și ora sunt obligatorii');
        }

        const dateStr = String(date).trim();
        const timeStr = String(time).trim();

        // Validează formatul datei (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
            throw new Error(`Format dată invalid: ${dateStr}. Folosește YYYY-MM-DD`);
        }

        // Validează formatul timpului (HH:MM sau HH:MM:SS)
        const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
        if (!timeRegex.test(timeStr)) {
            throw new Error(`Format timp invalid: ${timeStr}. Folosește HH:MM sau HH:MM:SS`);
        }

        // Adaugă secunde dacă lipsesc
        const fullTimeStr = timeStr.includes(':') && timeStr.split(':').length === 2
            ? `${timeStr}:00`
            : timeStr;

        const dateTimeString = `${dateStr}T${fullTimeStr}`;
        const appointmentDateTime = new Date(dateTimeString);

        if (isNaN(appointmentDateTime.getTime())) {
            throw new Error(`Data și ora nu sunt valide: ${dateStr} ${timeStr}`);
        }

        return appointmentDateTime;
    }

    /**
     * Validare reguli business pentru programare
     */
    static async validateAppointmentBusinessRules(userId, appointmentDateTime, date, time) {
        // Verifică dacă data nu e în trecut
        const now = new Date();
        if (appointmentDateTime <= now) {
            throw new Error('Data și ora programării trebuie să fie în viitor');
        }

        // Verifică dacă utilizatorul nu are deja o programare la același timp
        const hasExistingAppointment = await AppointmentModel.checkExistingAppointment(userId, appointmentDateTime);

        if (hasExistingAppointment) {
            throw new Error('Ai deja o programare activă la această dată și oră');
        }

        // Verifică disponibilitatea în calendar
        await AppointmentController.ensureSlotsExistForDate(date);
        const slot = await CalendarModel.getSlotByDateTime(date, time);

        if (!slot) {
            throw new Error('Slot indisponibil: Slot inexistent');
        }

        if (!slot.is_available) {
            throw new Error('Slot indisponibil: Slot dezactivat');
        }

        if (slot.current_appointments >= slot.max_appointments) {
            throw new Error('Slot indisponibil: Slot complet ocupat');
        }
    }

    /**
     * Validează posibilitatea anulării
     */
    static validateCancellation(appointment) {
        if (appointment.status === 'cancelled') {
            throw new Error('Programarea este deja anulată');
        }

        if (appointment.status === 'completed') {
            throw new Error('Nu poți anula o programare completată');
        }

        // Verifică regula de 1h
        const appointmentDate = new Date(appointment.appointment_date);
        const now = new Date();
        const timeDiff = appointmentDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        if (hoursDiff < 1) {
            throw new Error('Nu poți anula programarea cu mai puțin de 1 oră înainte');
        }
    }

    /**
     * Creează sloturile pentru o dată dacă nu există
     */
    static async ensureSlotsExistForDate(date) {
        const existingCount = await CalendarModel.getSlotsCountForDate(date);

        if (existingCount > 0) {
            return;
        }

        // Verifică dacă este weekend
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return;
        }

        // Creează sloturile
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