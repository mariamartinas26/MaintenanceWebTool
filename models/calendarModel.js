const { pool } = require('../database/db');

class CalendarModel {

    static async getSlotsCountForDate(date) {
        const query = `
            SELECT COUNT(*) as count 
            FROM "Calendar" 
            WHERE date = $1
        `;

        const result = await pool.query(query, [date]);
        return parseInt(result.rows[0].count);
    }

    /**
     * creates slots for a date
     */
    static async createSlotsForDate(client, date, workingHours) {
        for (const slot of workingHours) {
            const query = `
                INSERT INTO "Calendar" 
                (date, start_time, end_time, max_appointments, current_appointments, is_available, notes)
                VALUES ($1, $2, $3, $4, 0, true, 'Auto-generated slot')
            `;

            await client.query(query, [
                date,
                slot.start,
                slot.end,
                slot.maxAppointments
            ]);
        }
    }

    static async getAvailableSlots(date) {
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
        return result.rows;
    }

    static async getSlotByDateTime(date, time) {
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
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    static async updateSlotAppointments(date, time, increment) {
        const query = `
            UPDATE "Calendar"
            SET current_appointments = current_appointments + $3
            WHERE date = $1::date
              AND start_time <= $2::time
              AND end_time > $2::time
            RETURNING *
        `;

        const result = await pool.query(query, [date, time, increment]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
}

module.exports = CalendarModel;