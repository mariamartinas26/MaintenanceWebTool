const { pool } = require('../database/db');
const bcrypt = require('bcryptjs');

class User {
    static async create(userData) {
        const { email, password, first_name, last_name, phone, role = 'client' } = userData;

        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const password_hash = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO "Users" (email, password_hash, first_name, last_name, phone, role, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING id, email, first_name, last_name, phone, role, created_at
        `;

        const values = [email, password_hash, first_name, last_name, phone, role];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                throw new Error('Email already exists');
            }
            throw error;
        }
    }

    static async findByEmail(email) {
        const query = 'SELECT * FROM "Users" WHERE email = $1';
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }

    static async findById(id) {
        const query = 'SELECT id, email, first_name, last_name, phone, role, created_at FROM "Users" WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;