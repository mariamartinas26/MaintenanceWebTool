const { pool } = require('../database/db');
const bcrypt = require('bcryptjs');

class AccountRequest {
    static async create(requestData) {
        try {
            let finalPasswordHash;
            if (requestData.password_hash) {
                finalPasswordHash = requestData.password_hash;
            } else if (requestData.password) {
                const saltRounds = 12;
                finalPasswordHash = await bcrypt.hash(requestData.password, saltRounds);
            } else {
                throw new Error('Password or password_hash required');
            }

            const query = `
                INSERT INTO "AccountRequests" (
                    email, password_hash, first_name, last_name, phone,
                    role, message, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    RETURNING id
            `;

            const values = [
                requestData.email,
                finalPasswordHash,
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
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM "AccountRequests" WHERE email = $1';
            const result = await pool.query(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            throw error;
        }
    }

    static async findById(id) {
        try {
            const query = 'SELECT * FROM "AccountRequests" WHERE id = $1';
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            throw error;
        }
    }

    static async findAll() {
        try {
            const query = `
                SELECT
                    id, email, first_name, last_name, phone, role,
                    message, status, created_at, processed_at,
                    manager_message, approved_user_id, assigned_role
                FROM "AccountRequests"
                ORDER BY created_at DESC
            `;
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async updateStatus(id, status, additionalData = {}) {
        try {
            let query = 'UPDATE "AccountRequests" SET status = $1';
            const values = [status];
            let paramCount = 1;

            if (additionalData.manager_message) {
                paramCount++;
                query += `, manager_message = $${paramCount}`;
                values.push(additionalData.manager_message);
            }

            if (additionalData.processed_at) {
                paramCount++;
                query += `, processed_at = $${paramCount}`;
                values.push(additionalData.processed_at);
            }

            if (additionalData.approved_user_id) {
                paramCount++;
                query += `, approved_user_id = $${paramCount}`;
                values.push(additionalData.approved_user_id);
            }

            if (additionalData.assigned_role) {
                paramCount++;
                query += `, assigned_role = $${paramCount}`;
                values.push(additionalData.assigned_role);
            }

            paramCount++;
            query += ` WHERE id = $${paramCount}`;
            values.push(id);

            const result = await pool.query(query, values);
            return result.rowCount > 0;

        } catch (error) {
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
            const result = await pool.query(query);
            return result.rowCount;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AccountRequest;