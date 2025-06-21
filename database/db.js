const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'MaT',
    password: process.env.DB_PASSWORD || 'student',
    port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {});

pool.on('error', (err) => {
    process.exit(-1);
});


const query = async (text, params) => {
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    pool,
    query
};