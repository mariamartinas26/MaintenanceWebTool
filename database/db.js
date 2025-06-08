const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'MaT',
    password: process.env.DB_PASSWORD || 'student',
    port: process.env.DB_PORT || 5432,
});

// Test connection
pool.on('connect', () => {
    //console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    //console.error('Unexpected error on idle client:', err);
    process.exit(-1);
});

module.exports = { pool };