const { pool } = require('../database/db');
const AppointmentParts = require('./AppointmentParts');
const Part = require('./Part');

class AdminAppointment {
    // Get all appointments for admin dashboard
    static async getAllForAdmin(filters = {}) {
        let query = `
            SELECT
                a.id,
                a.appointment_date,
                a.status,
                a.problem_description,
                a.admin_response,
                a.rejection_reason,
                a.retry_days,
                a.estimated_price,
                a.estimated_completion_time,
                a.warranty_info,
                a.created_at,
                a.updated_at,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                v.vehicle_type,
                v.brand,
                v.model,
                v.year,
                v.is_electric
            FROM "Appointments" a
                     JOIN "Users" u ON a.user_id = u.id
                     LEFT JOIN "Vehicles" v ON a.vehicle_id = v.id
        `;

        const conditions = [];
        const params = [];

        if (filters.status) {
            conditions.push(`a.status = $${params.length + 1}`);
            params.push(filters.status);
        }

        if (filters.date_filter) {
            const now = new Date();
            let dateCondition = '';

            switch (filters.date_filter) {
                case 'today':
                    dateCondition = `DATE(a.appointment_date) = DATE($${params.length + 1})`;
                    params.push(now.toISOString().split('T')[0]);
                    break;
                case 'tomorrow':
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    dateCondition = `DATE(a.appointment_date) = DATE($${params.length + 1})`;
                    params.push(tomorrow.toISOString().split('T')[0]);
                    break;
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    dateCondition = `a.appointment_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
                    params.push(weekStart.toISOString(), weekEnd.toISOString());
                    break;
                case 'month':
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    dateCondition = `a.appointment_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
                    params.push(monthStart.toISOString(), monthEnd.toISOString());
                    break;
            }

            if (dateCondition) {
                conditions.push(dateCondition);
            }
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY a.created_at DESC`;

        try {
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    // Get single appointment details for admin
    static async getByIdForAdmin(id) {
        const query = `
            SELECT
                a.*,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                v.vehicle_type,
                v.brand,
                v.model,
                v.year,
                v.is_electric,
                v.notes as vehicle_notes
            FROM "Appointments" a
                     JOIN "Users" u ON a.user_id = u.id
                     LEFT JOIN "Vehicles" v ON a.vehicle_id = v.id
            WHERE a.id = $1
        `;

        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    // Get appointment media files
    static async getAppointmentMedia(appointmentId) {
        const query = `
            SELECT
                id,
                file_path,
                file_type,
                original_filename,
                mime_type,
                uploaded_at
            FROM "AppointmentMedia"
            WHERE appointment_id = $1
            ORDER BY uploaded_at ASC
        `;

        try {
            const result = await pool.query(query, [appointmentId]);
            return result.rows;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    static async updateStatusWithParts(id, updateData, selectedParts = [], adminId = null) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const getCurrentQuery = `
                SELECT user_id, status as old_status, appointment_date
                FROM "Appointments"
                WHERE id = $1
            `;

            const currentResult = await client.query(getCurrentQuery, [id]);

            if (currentResult.rows.length === 0) {
                throw new Error('Appointment not found');
            }

            const currentAppointment = currentResult.rows[0];

            if (currentAppointment.old_status === 'approved' || currentAppointment.old_status === 'rejected') {
                throw new Error(`Cannot modify appointment: already ${currentAppointment.old_status}`);
            }

            let stockUpdateResult = null;
            if (updateData.status === 'approved' && selectedParts && selectedParts.length > 0) {


                const availability = await Part.checkAvailability(selectedParts);
                if (!availability.available) {
                    const errorMessage = availability.unavailableParts
                        .map(p => `${p.name || 'Unknown part'}: needed ${p.requested}, available ${p.available}`)
                        .join('; ');
                    throw new Error(`Cannot approve appointment. Insufficient stock: ${errorMessage}`);
                }

                stockUpdateResult = await Part.updateMultipleStock(selectedParts, client);
            }

            const updateQuery = `
                UPDATE "Appointments"
                SET
                    status = $2,
                    admin_response = $3,
                    rejection_reason = $4,
                    retry_days = $5,
                    estimated_price = $6,
                    warranty_info = $7,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                    RETURNING *
            `;

            const updateResult = await client.query(updateQuery, [
                id,
                updateData.status,
                updateData.adminResponse,
                updateData.rejectionReason,
                updateData.retryDays,
                updateData.estimatedPrice,
                updateData.warrantyInfo
            ]);

            const updatedAppointment = updateResult.rows[0];

            if (updateData.status === 'approved' && selectedParts && selectedParts.length > 0) {
                await AppointmentParts.saveAppointmentParts(id, selectedParts, client);
            } else {
                await AppointmentParts.saveAppointmentParts(id, [], client);
            }

            if (updateData.status === 'rejected' && currentAppointment.old_status !== 'rejected') {
                const appointmentDateTime = currentAppointment.appointment_date;
                const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0];
                const appointmentTimeStr = appointmentDateTime.toTimeString().slice(0, 8);

                const updateCalendarQuery = `
                    UPDATE "Calendar"
                    SET current_appointments = current_appointments - 1
                    WHERE date = $1::date
                      AND start_time <= $2::time
                      AND end_time > $2::time
                      AND current_appointments > 0
                `;

                await client.query(updateCalendarQuery, [appointmentDateStr, appointmentTimeStr]);
            }

            const historyQuery = `
                INSERT INTO "AppointmentHistory"
                (appointment_id, user_id, action, old_status, new_status, comment, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            `;

            const action = updateData.status === 'approved' ? 'approved' :
                updateData.status === 'rejected' ? 'rejected' : 'updated';

            let comment;
            if (updateData.status === 'rejected' && updateData.rejectionReason) {
                comment = `Appointment rejected: ${updateData.rejectionReason}`;
            } else if (updateData.adminResponse) {
                comment = updateData.adminResponse;
            } else {
                comment = `Appointment ${action} by admin`;
            }

            if (updateData.status === 'approved' && stockUpdateResult && stockUpdateResult.updatedParts.length > 0) {
                const partsCount = stockUpdateResult.updatedParts.length;
                const totalPartsCost = selectedParts.reduce((sum, part) => sum + (part.quantity * part.unitPrice), 0);
                const stockInfo = stockUpdateResult.updatedParts.map(p =>
                    `${p.name}: used ${p.quantityUsed}, remaining ${p.stock_quantity}`
                ).join('; ');

                comment += ` (${partsCount} parts allocated, total cost: ${totalPartsCost.toFixed(2)} RON. Stock updated: ${stockInfo})`;
            }

            await client.query(historyQuery, [
                id,
                currentAppointment.user_id,
                action,
                currentAppointment.old_status,
                updateData.status,
                comment
            ]);

            await client.query('COMMIT');

            return {
                ...updatedAppointment,
                stockUpdateResult: stockUpdateResult
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in updateStatusWithParts:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateStatus(id, updateData, adminId = null) {
        return this.updateStatusWithParts(id, updateData, [], adminId);
    }

    // Get appointment statistics for admin dashboard
    static async getStatistics() {
        try {
            const query = `
                SELECT
                    status,
                    COUNT(*) as count
                FROM "Appointments"
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY status
            `;

            const result = await pool.query(query);

            const stats = {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                completed: 0,
                cancelled: 0
            };

            result.rows.forEach(row => {
                stats[row.status] = parseInt(row.count);
                stats.total += parseInt(row.count);
            });

            return stats;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }
}

module.exports = AdminAppointment;