const { pool } = require('../database/db');

class AppointmentParts {
    static async saveAppointmentParts(appointmentId, partsList, client = null) {
        const db = client || pool;

        try {
            if (!appointmentId) {
                throw new Error('appointmentId is required');
            }

            //sterge tot ca sa insereze ce e nou
            await db.query(
                'DELETE FROM "AppointmentParts" WHERE appointment_id = $1',
                [appointmentId]
            );

            if (partsList && Array.isArray(partsList) && partsList.length > 0) {
                const insertQuery = `
                    INSERT INTO "AppointmentParts"
                        (appointment_id, part_id, quantity, unit_price, subtotal, created_at)
                    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                `;

                for (let i = 0; i < partsList.length; i++) {
                    const part = partsList[i];

                    if (!part) {
                        throw new Error(`Part at index ${i} is null or undefined`);
                    }

                    if (!part.partId) {
                        throw new Error(`Part at index ${i} is missing partId. Part data: ${JSON.stringify(part)}`);
                    }

                    if (!part.quantity || part.quantity <= 0) {
                        throw new Error(`Part at index ${i} has invalid quantity (${part.quantity}). Part data: ${JSON.stringify(part)}`);
                    }

                    let unitPrice = part.unitPrice;
                    if (unitPrice === null || unitPrice === undefined || isNaN(unitPrice)) {
                        unitPrice = part.unit_price;
                    }

                    const partId = parseInt(part.partId);
                    const quantity = parseInt(part.quantity);
                    const price = parseFloat(unitPrice);
                    const subtotal = quantity * price;

                    if (isNaN(partId) || partId <= 0) {
                        throw new Error(`Invalid partId after parsing: ${partId}`);
                    }
                    if (isNaN(quantity) || quantity <= 0) {
                        throw new Error(`Invalid quantity after parsing: ${quantity}`);
                    }
                    if (isNaN(price) || price < 0) {
                        throw new Error(`Invalid price after parsing: ${price}`);
                    }

                    await db.query(insertQuery, [
                        appointmentId,
                        partId,
                        quantity,
                        price,
                        subtotal
                    ]);
                }
            }
            return true;
        } catch (error) {

            throw new Error(`Database error saving appointment parts: ${error.message}`);
        }
    }

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
            console.error('Error in getAppointmentParts:', error);
            throw new Error(`Database error: ${error.message}`);
        }
    }

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
            console.error('Error in getAppointmentPartsTotal:', error);
            throw new Error(`Database error: ${error.message}`);
        }
    }

}

module.exports = AppointmentParts;