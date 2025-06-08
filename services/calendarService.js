const { pool } = require('../database/db');

class CalendarService {
    /**
     * default config
     */
    getDefaultWorkingHours() {
        return [
            { start: '08:00:00', end: '09:00:00', maxAppointments: 2 },
            { start: '09:00:00', end: '10:00:00', maxAppointments: 2 },
            { start: '10:00:00', end: '11:00:00', maxAppointments: 2 },
            { start: '11:00:00', end: '12:00:00', maxAppointments: 2 },
            { start: '13:00:00', end: '14:00:00', maxAppointments: 2 },
            { start: '14:00:00', end: '15:00:00', maxAppointments: 2 },
            { start: '15:00:00', end: '16:00:00', maxAppointments: 2 },
            { start: '16:00:00', end: '17:00:00', maxAppointments: 2 }
        ];
    }

    /**
     * Creează sloturile pentru o dată dacă nu există
     */
    async ensureSlotsExistForDate(date) {

        // Verifică dacă există deja sloturi pentru această dată
        const existingQuery = `
            SELECT COUNT(*) as count 
            FROM "Calendar" 
            WHERE date = $1
        `;

        const existingResult = await pool.query(existingQuery, [date]);
        const existingCount = parseInt(existingResult.rows[0].count);

        if (existingCount > 0) {
            return; // Există deja sloturi
        }

        // Verifică dacă este weekend
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return; // Nu creăm sloturi pentru weekend
        }

        // Creează sloturile pentru ziua de lucru
        const workingHours = this.getDefaultWorkingHours();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (const slot of workingHours) {
                const insertQuery = `
                    INSERT INTO "Calendar" 
                    (date, start_time, end_time, max_appointments, current_appointments, is_available, notes)
                    VALUES ($1, $2, $3, $4, 0, true, 'Auto-generated slot')
                `;

                await client.query(insertQuery, [
                    date,
                    slot.start,
                    slot.end,
                    slot.maxAppointments
                ]);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obține sloturile disponibile pentru o anumită dată
     */
    async getAvailableSlots(date) {
        // Validare date
        this.validateDate(date);

        // Verifică dacă e weekend
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return {
                availableSlots: [],
                message: 'We do not work on weekends'
            };
        }

        // Asigură-te că există sloturi pentru această dată
        await this.ensureSlotsExistForDate(date);

        // Interrogează tabela Calendar pentru sloturile disponibile
        const query = `
            SELECT
                start_time,
                end_time,
                max_appointments,
                current_appointments,
                (max_appointments - current_appointments) as available_spots,
                is_available
            FROM "Calendar"
            WHERE date = $1
              AND is_available = true
              AND current_appointments < max_appointments
            ORDER BY start_time
        `;

        const result = await pool.query(query, [date]);

        const availableSlots = result.rows.map(row => ({
            startTime: row.start_time,
            endTime: row.end_time,
            availableSpots: row.available_spots,
            maxAppointments: row.max_appointments
        }));

        return {
            date: date,
            availableSlots: availableSlots
        };
    }

    /**
     * Validează data introdusă
     */
    validateDate(date) {
        if (!date) {
            throw new Error('Date is necesarry');
        }

        // Verifică dacă data nu e în trecut
        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestedDate < today) {
            throw new Error('You can not schedule an appointment in the past');
        }
    }

    /**
     * Verifică disponibilitatea unui slot specific
     */
    async checkSlotAvailability(date, time) {

        // Asigură-te că există sloturi pentru această dată
        await this.ensureSlotsExistForDate(date);

        const query = `
            SELECT
                id,
                start_time,
                end_time,
                max_appointments,
                current_appointments,
                is_available
            FROM "Calendar"
            WHERE date = $1
              AND start_time <= $2::time
              AND end_time > $2::time
        `;

        const result = await pool.query(query, [date, time]);

        if (result.rows.length === 0) {
            return {
                available: false,
                reason: 'Slot inexistent'
            };
        }

        const slot = result.rows[0];

        if (!slot.is_available) {
            return {
                available: false,
                reason: 'Slot indisponibil'
            };
        }

        if (slot.current_appointments >= slot.max_appointments) {
            return {
                available: false,
                reason: 'Slot complet ocupat'
            };
        }

        return {
            available: true,
            slot: slot,
            availableSpots: slot.max_appointments - slot.current_appointments
        };
    }

    /**
     * Actualizează numărul de programări pentru un slot
     */
    async updateSlotAppointments(date, time, increment) {

        // Asigură-te că există sloturi pentru această dată
        await this.ensureSlotsExistForDate(date);

        const query = `
            UPDATE "Calendar"
            SET current_appointments = current_appointments + $3
            WHERE date = $1::date
              AND start_time <= $2::time
              AND end_time > $2::time
            RETURNING *
        `;

        const result = await pool.query(query, [date, time, increment]);

        if (result.rows.length === 0) {
            throw new Error(`Nu s-a găsit slot-ul pentru ${date} la ora ${time}`);
        }

        return result.rows[0];
    }
}

module.exports = new CalendarService();