const { pool } = require('../database/db');
const calendarService = require('./calendarService');

class AppointmentService {
    /**
     * gets user appointments
     */
    async getUserAppointments(userId) {
        const query = `
            SELECT
                a.id,
                a.appointment_date,
                a.status,
                a.problem_description,
                a.admin_response,
                a.estimated_price,
                a.estimated_completion_time,
                a.created_at,
                a.updated_at,
                v.vehicle_type,
                v.brand,
                v.model,
                v.year
            FROM "Appointments" a
                     LEFT JOIN "Vehicles" v ON a.vehicle_id = v.id
            WHERE a.user_id = $1
            ORDER BY a.appointment_date DESC
        `;

        const result = await pool.query(query, [userId]);

        return result.rows.map(row => ({
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
    }

    /**
     * Creează o programare nouă
     */
    async createAppointment(userId, appointmentData) {
        const { date, time, description, vehicleId } = appointmentData;

        console.log('[DEBUG] AppointmentService.createAppointment called with:', {
            userId,
            date,
            time,
            description,
            vehicleId
        });

        // Validare date
        this.validateAppointmentData(date, time, description);

        // Creează timestamp-ul corect
        console.log('[DEBUG] Creating appointment timestamp...');
        const appointmentDateTime = this.createValidDateTime(date, time);

        // Verificări business logic
        await this.validateAppointmentBusinessRules(userId, appointmentDateTime, date, time);

        // Creează programarea în tranzacție
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            console.log('[DEBUG] Inserting appointment with timestamp:', appointmentDateTime.toISOString());

            // Inserează programarea
            const insertQuery = `
                INSERT INTO "Appointments" 
                (user_id, vehicle_id, appointment_date, status, problem_description, created_at, updated_at)
                VALUES ($1, $2, $3, 'pending', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `;

            const appointmentResult = await client.query(insertQuery, [
                userId,
                vehicleId || null,
                appointmentDateTime,
                description.trim()
            ]);

            const newAppointment = appointmentResult.rows[0];
            console.log('[DEBUG] Appointment inserted successfully:', newAppointment.id);

            // Actualizează calendarul folosind calendarService
            await calendarService.updateSlotAppointments(date, time, 1);
            console.log('[DEBUG] Calendar slot updated successfully');

            // Adaugă în istoric
            await this.addAppointmentHistory(client, newAppointment.id, userId, 'created', 'pending', 'Programare creată de client');

            await client.query('COMMIT');
            console.log('[DEBUG] Transaction committed successfully');

            return {
                id: newAppointment.id,
                date: newAppointment.appointment_date.toISOString().split('T')[0],
                time: newAppointment.appointment_date.toTimeString().slice(0, 5),
                status: newAppointment.status,
                description: newAppointment.problem_description,
                createdAt: newAppointment.created_at
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[ERROR] Transaction rolled back:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Creează un DateTime valid din string-uri
     */
    createValidDateTime(date, time) {
        console.log('[DEBUG] Creating DateTime from:', { date, time });

        if (!date || !time) {
            throw new Error('Data și ora sunt obligatorii');
        }

        // Asigură-te că sunt string-uri
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
        console.log('[DEBUG] DateTime string:', dateTimeString);

        const appointmentDateTime = new Date(dateTimeString);

        console.log('[DEBUG] Created Date object:', appointmentDateTime);
        console.log('[DEBUG] Date is valid:', !isNaN(appointmentDateTime.getTime()));

        if (isNaN(appointmentDateTime.getTime())) {
            throw new Error(`Data și ora nu sunt valide: ${dateStr} ${timeStr}`);
        }

        return appointmentDateTime;
    }

    /**
     * Anulează o programare
     */
    async cancelAppointment(userId, appointmentId) {
        // Verifică dacă programarea aparține utilizatorului
        const appointment = await this.getAppointmentById(appointmentId, userId);

        // Validează posibilitatea anulării
        this.validateCancellation(appointment);

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Actualizează statusul programării
            const updateQuery = `
                UPDATE "Appointments"
                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const updateResult = await client.query(updateQuery, [appointmentId]);

            // Actualizează calendarul
            const appointmentDateTime = updateResult.rows[0].appointment_date;
            const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0];
            const appointmentTimeStr = appointmentDateTime.toTimeString().slice(0, 5);

            await calendarService.updateSlotAppointments(appointmentDateStr, appointmentTimeStr, -1);

            // Adaugă în istoric
            await this.addAppointmentHistory(client, appointmentId, userId, 'cancelled', 'cancelled', 'Programare anulată de client', appointment.status);

            await client.query('COMMIT');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Validare date programare
     */
    validateAppointmentData(date, time, description) {
        console.log('[DEBUG] Validating appointment data:', { date, time, description });

        if (!date || !time || !description) {
            throw new Error('Data, ora și descrierea sunt obligatorii');
        }

        if (description.trim().length < 10) {
            throw new Error('Descrierea trebuie să conțină cel puțin 10 caractere');
        }

        console.log('[DEBUG] Appointment data validation passed');
    }

    /**
     * Validare reguli business pentru programare
     */
    async validateAppointmentBusinessRules(userId, appointmentDateTime, date, time) {
        console.log('[DEBUG] Validating business rules...');

        // Verifică dacă data nu e în trecut
        const now = new Date();
        if (appointmentDateTime <= now) {
            throw new Error('Data și ora programării trebuie să fie în viitor');
        }

        // Verifică dacă utilizatorul nu are deja o programare la același timp
        const existingQuery = `
            SELECT id FROM "Appointments"
            WHERE user_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled', 'rejected')
        `;

        const existingResult = await pool.query(existingQuery, [userId, appointmentDateTime]);

        if (existingResult.rows.length > 0) {
            throw new Error('Ai deja o programare activă la această dată și oră');
        }

        // Verifică disponibilitatea în calendar folosind calendarService
        const availability = await calendarService.checkSlotAvailability(date, time);

        if (!availability.available) {
            throw new Error(`Slot indisponibil: ${availability.reason}`);
        }

        console.log('[DEBUG] Business rules validation passed');
    }

    /**
     * Obține programare după ID
     */
    async getAppointmentById(appointmentId, userId) {
        const query = `
            SELECT id, status, appointment_date
            FROM "Appointments"
            WHERE id = $1 AND user_id = $2
        `;

        const result = await pool.query(query, [appointmentId, userId]);

        if (result.rows.length === 0) {
            throw new Error('Programarea nu a fost găsită');
        }

        return result.rows[0];
    }

    /**
     * Validează posibilitatea anulării
     */
    validateCancellation(appointment) {
        if (appointment.status === 'cancelled') {
            throw new Error('Programarea este deja anulată');
        }

        if (appointment.status === 'completed') {
            throw new Error('Nu poți anula o programare completată');
        }

        // Verifică regula de 1h (relaxată pentru testare)
        const appointmentDate = new Date(appointment.appointment_date);
        const now = new Date();
        const timeDiff = appointmentDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        if (hoursDiff < 1) {
            throw new Error('Nu poți anula programarea cu mai puțin de 1 oră înainte');
        }
    }

    /**
     * Adaugă intrare în istoricul programărilor
     */
    async addAppointmentHistory(client, appointmentId, userId, action, newStatus, comment, oldStatus = null) {
        const historyQuery = `
            INSERT INTO "AppointmentHistory"
            (appointment_id, user_id, action, old_status, new_status, comment, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `;

        await client.query(historyQuery, [appointmentId, userId, action, oldStatus, newStatus, comment]);
    }
}

module.exports = new AppointmentService();