const { pool } = require('../database/db');

class VehicleModel {

    static async getUserVehicles(userId) {
        const query = `
            SELECT id, vehicle_type, brand, model, year, is_electric, notes, created_at
            FROM "Vehicles"
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async createVehicle(userId, vehicleData) {
        const {vehicle_type, brand, model, year, is_electric = false, notes = null} = vehicleData;

        const query = `
            INSERT INTO "Vehicles" 
            (user_id, vehicle_type, brand, model, year, is_electric, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            RETURNING *
        `;

        const result = await pool.query(query, [userId, vehicle_type, brand, model, year, is_electric, notes]);

        return result.rows[0];
    }
}

module.exports = VehicleModel;