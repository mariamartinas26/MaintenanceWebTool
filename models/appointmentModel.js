const { pool } = require('../database/db');

class AppointmentModel {
    // Get all appointments for a specific user (this is what your controller needs)
    static async getUserAppointments(userId) {
        try {
            console.log('[DEBUG] AppointmentModel.getUserAppointments called with userId:', userId);

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

            console.log('[DEBUG] Executing query for user:', userId);
            const result = await pool.query(query, [userId]);
            console.log('[DEBUG] Query result:', result.rows.length, 'appointments found');

            return result.rows;
        } catch (error) {
            console.error('[ERROR] Error in getUserAppointments:', error);
            throw error;
        }
    }

    // Create a new appointment
    static async createAppointment(userId, vehicleId, appointmentDateTime, description) {
        try {
            console.log('[DEBUG] Creating appointment for user:', userId);

            const query = `
                INSERT INTO "Appointments" 
                (user_id, vehicle_id, appointment_date, problem_description, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `;

            const result = await pool.query(query, [userId, vehicleId, appointmentDateTime, description]);
            console.log('[DEBUG] Appointment created with ID:', result.rows[0].id);

            return result.rows[0];
        } catch (error) {
            console.error('[ERROR] Error in createAppointment:', error);
            throw error;
        }
    }

    // Get appointment by ID and user ID (for security - ensures user can only access their own appointments)
    static async getAppointmentById(appointmentId, userId) {
        try {
            const query = `
                SELECT * FROM "Appointments" 
                WHERE id = $1 AND user_id = $2
            `;

            const result = await pool.query(query, [appointmentId, userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('[ERROR] Error in getAppointmentById:', error);
            throw error;
        }
    }

    // Update appointment status (for client cancellations)
    static async updateAppointmentStatus(appointmentId, status) {
        try {
            const query = `
                UPDATE "Appointments" 
                SET status = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const result = await pool.query(query, [appointmentId, status]);
            return result.rows[0];
        } catch (error) {
            console.error('[ERROR] Error in updateAppointmentStatus:', error);
            throw error;
        }
    }

    // Check if user has existing appointment at the same time
    static async checkExistingAppointment(userId, appointmentDateTime) {
        try {
            const query = `
                SELECT id FROM "Appointments" 
                WHERE user_id = $1 AND appointment_date = $2 AND status != 'cancelled'
            `;

            const result = await pool.query(query, [userId, appointmentDateTime]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('[ERROR] Error in checkExistingAppointment:', error);
            throw error;
        }
    }

    // Add appointment history
    static async addAppointmentHistory(client, appointmentId, userId, action, newStatus, comment, oldStatus = null) {
        try {
            const query = `
                INSERT INTO "AppointmentHistory"
                (appointment_id, user_id, action, old_status, new_status, comment, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            `;

            await client.query(query, [appointmentId, userId, action, oldStatus, newStatus, comment]);
        } catch (error) {
            console.error('[ERROR] Error in addAppointmentHistory:', error);
            throw error;
        }
    }
}

module.exports = AppointmentModel;