const { pool } = require('../database/db');

class AppointmentModel {
    //toate programarile unui user
    static async getUserAppointments(userId) {
        try {
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
                    v.year,
                    v.is_electric
                FROM "Appointments" a
                LEFT JOIN "Vehicles" v ON a.vehicle_id = v.id
                WHERE a.user_id = $1
                ORDER BY a.appointment_date DESC
            `;

            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    //creare noua programare
    static async createAppointment(userId, vehicleId, appointmentDateTime, description) {
        try {
            const query = `
                INSERT INTO "Appointments" 
                (user_id, vehicle_id, appointment_date, problem_description, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `;

            const result = await pool.query(query, [userId, vehicleId, appointmentDateTime, description]);

            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }


    //verific daca utilizatorul are deja o programare la aceasi ora
    static async checkExistingAppointment(userId, appointmentDateTime) {
        try {
            const query = `
                SELECT id FROM "Appointments" 
                WHERE user_id = $1 AND appointment_date = $2 AND status != 'cancelled'
            `;

            const result = await pool.query(query, [userId, appointmentDateTime]);
            return result.rows.length > 0;
        } catch (error) {
            throw error;
        }
    }

    static async addAppointmentHistory(client, appointmentId, userId, action, newStatus, comment, oldStatus = null) {
        try {
            const query = `
                INSERT INTO "AppointmentHistory"
                (appointment_id, user_id, action, old_status, new_status, comment, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            `;

            await client.query(query, [appointmentId, userId, action, oldStatus, newStatus, comment]);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AppointmentModel;