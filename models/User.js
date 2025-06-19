const { pool } = require('../database/db');
const bcrypt = require('bcryptjs');

class User {
    static async create(userData) {
        try {
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

            const query = `
                INSERT INTO "Users" (email, password_hash, first_name, last_name, phone, role)
                VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
            `;

            const values = [
                userData.email,
                hashedPassword,
                userData.first_name,
                userData.last_name,
                userData.phone,
                userData.role || 'client'
            ];

            const result = await pool.query(query, values);
            return { id: result.rows[0].id, ...userData };
        } catch (error) {
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM "Users" WHERE email = $1';
            const result = await pool.query(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            throw error;
        }
    }

    static async findById(id) {
        try {
            const query = 'SELECT * FROM "Users" WHERE id = $1';
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            throw error;
        }
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;