const { pool } = require('../database/db');
const bcrypt = require('bcryptjs');

class AccountRequest {
    static async create(requestData) {
        try {
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(requestData.password_hash, saltRounds);

            const query = `
                INSERT INTO "AccountRequests" (
                    email, password_hash, first_name, last_name, phone,
                    role, message, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    RETURNING id
            `;

            const values = [
                requestData.email,
                hashedPassword,
                requestData.first_name,
                requestData.last_name,
                requestData.phone,
                requestData.role,
                requestData.message,
                requestData.status || 'pending'
            ];

            const result = await pool.query(query, values);
            return { id: result.rows[0].id, ...requestData };

        } catch (error) {
            console.error('Error creating account request:', error);
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM "AccountRequests" WHERE email = $1';
            const result = await pool.query(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding request by email:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const query = 'SELECT * FROM "AccountRequests" WHERE id = $1';
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding request by ID:', error);
            throw error;
        }
    }

    static async findAll() {
        try {
            const query = `
                SELECT
                    id, email, first_name, last_name, phone, role,
                    message, status, created_at, processed_at,
                    manager_message, approved_user_id
                FROM "AccountRequests"
                ORDER BY created_at DESC
            `;
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error finding all requests:', error);
            throw error;
        }
    }

    static async updateStatus(id, status, additionalData = {}) {
        try {
            let query = 'UPDATE "AccountRequests" SET status = $1';
            const values = [status];
            let paramCount = 1;

            if (additionalData.manager_message) {  // Changed from admin_message
                paramCount++;
                query += `, manager_message = $${paramCount}`;  // Fixed: Added $
                values.push(additionalData.manager_message);
            }

            if (additionalData.processed_at) {
                paramCount++;
                query += `, processed_at = $${paramCount}`;     // Fixed: Added $
                values.push(additionalData.processed_at);
            }

            if (additionalData.approved_user_id) {
                paramCount++;
                query += `, approved_user_id = $${paramCount}`;  // Fixed: Added $
                values.push(additionalData.approved_user_id);
            }

            paramCount++;
            query += ` WHERE id = $${paramCount}`;               // Fixed: Added $
            values.push(id);

            const result = await pool.query(query, values);
            return result.rowCount > 0;

        } catch (error) {
            console.error('Error updating request status:', error);
            throw error;
        }
    }

    static async getStats() {
        try {
            const query = `
                SELECT
                    status,
                    COUNT(*) as count
                FROM "AccountRequests"
                GROUP BY status
            `;
            const result = await pool.query(query);

            const stats = {
                pending: 0,
                approved: 0,
                rejected: 0,
                total: 0
            };

            result.rows.forEach(row => {
                stats[row.status] = parseInt(row.count);
                stats.total += parseInt(row.count);
            });

            return stats;
        } catch (error) {
            console.error('Error getting request stats:', error);
            throw error;
        }
    }

    static async deleteOldRejected(daysOld = 30) {
        try {
            const query = `
                DELETE FROM "AccountRequests"
                WHERE status = 'rejected'
                  AND processed_at < NOW() - INTERVAL '${daysOld} days'
            `;
            const result = await db.query(query);
            return result.rowCount;
        } catch (error) {
            console.error('Error deleting old rejected requests:', error);
            throw error;
        }
    }
}

module.exports = AccountRequest;