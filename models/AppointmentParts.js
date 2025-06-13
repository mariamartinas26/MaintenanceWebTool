const { pool } = require('../database/db');

class AppointmentParts {
    // Save selected parts for an appointment
    static async saveAppointmentParts(appointmentId, partsList, client = null) {
        const dbClient = client || pool;

        try {
            // Delete existing parts for this appointment
            await dbClient.query(
                'DELETE FROM "AppointmentParts" WHERE appointment_id = $1',
                [appointmentId]
            );

            // Insert new parts
            if (partsList && partsList.length > 0) {
                const insertQuery = `
                    INSERT INTO "AppointmentParts"
                        (appointment_id, part_id, quantity, unit_price, subtotal, created_at)
                    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                `;

                for (const part of partsList) {
                    const subtotal = part.quantity * part.unitPrice;
                    await dbClient.query(insertQuery, [
                        appointmentId,
                        part.partId,
                        part.quantity,
                        part.unitPrice,
                        subtotal
                    ]);
                }
            }

            return true;
        } catch (error) {
            throw new Error(`Database error saving appointment parts: ${error.message}`);
        }
    }

    // Get parts for an appointment
    static async getAppointmentParts(appointmentId) {
        const query = `
            SELECT
                ap.id,
                ap.appointment_id,
                ap.part_id,
                ap.quantity,
                ap.unit_price,
                ap.subtotal,
                ap.created_at,
                p.name as part_name,
                p.part_number,
                p.category,
                p.description
            FROM "AppointmentParts" ap
                     JOIN "Parts" p ON ap.part_id = p.id
            WHERE ap.appointment_id = $1
            ORDER BY ap.created_at ASC
        `;

        try {
            const result = await pool.query(query, [appointmentId]);
            return result.rows;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    // Get total cost of parts for an appointment
    static async getAppointmentPartsTotal(appointmentId) {
        const query = `
            SELECT
                COALESCE(SUM(subtotal), 0) as total_parts_cost,
                COUNT(*) as parts_count
            FROM "AppointmentParts"
            WHERE appointment_id = $1
        `;

        try {
            const result = await pool.query(query, [appointmentId]);
            return {
                totalCost: parseFloat(result.rows[0].total_parts_cost) || 0,
                partsCount: parseInt(result.rows[0].parts_count) || 0
            };
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    // Delete parts for an appointment
    static async deleteAppointmentParts(appointmentId) {
        const query = `
            DELETE FROM "AppointmentParts"
            WHERE appointment_id = $1
        `;

        try {
            await pool.query(query, [appointmentId]);
            return true;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }
}

module.exports = AppointmentParts;