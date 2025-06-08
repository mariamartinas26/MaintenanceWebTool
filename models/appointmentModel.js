const { pool } = require('../database/db');

class AppointmentModel {
    /**
     * Obține programările unui utilizator
     */
    static async getUserAppointments(userId) {
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
        return result.rows;
    }

    /**
     * Creează o programare nouă
     */
    static async createAppointment(userId, vehicleId, appointmentDateTime, description) {
        const query = `
            INSERT INTO "Appointments" 
            (user_id, vehicle_id, appointment_date, status, problem_description, created_at, updated_at)
            VALUES ($1, $2, $3, 'pending', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `;

        const result = await pool.query(query, [
            userId,
            vehicleId || null,
            appointmentDateTime,
            description.trim()
        ]);

        return result.rows[0];
    }

    /**
     * Verifică dacă utilizatorul are o programare la același timp
     */
    static async checkExistingAppointment(userId, appointmentDateTime) {
        const query = `
            SELECT id FROM "Appointments"
            WHERE user_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled', 'rejected')
        `;

        const result = await pool.query(query, [userId, appointmentDateTime]);
        return result.rows.length > 0;
    }

    /**
     * Obține programare după ID și userId
     */
    static async getAppointmentById(appointmentId, userId) {
        const query = `
            SELECT id, status, appointment_date
            FROM "Appointments"
            WHERE id = $1 AND user_id = $2
        `;

        const result = await pool.query(query, [appointmentId, userId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Actualizează statusul unei programări
     */
    static async updateAppointmentStatus(appointmentId, status) {
        const query = `
            UPDATE "Appointments"
            SET status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [appointmentId, status]);
        return result.rows[0];
    }

    /**
     * Adaugă intrare în istoricul programărilor
     */
    static async addAppointmentHistory(client, appointmentId, userId, action, newStatus, comment, oldStatus = null) {
        const query = `
            INSERT INTO "AppointmentHistory"
            (appointment_id, user_id, action, old_status, new_status, comment, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `;

        await client.query(query, [appointmentId, userId, action, oldStatus, newStatus, comment]);
    }
}

module.exports = AppointmentModel;