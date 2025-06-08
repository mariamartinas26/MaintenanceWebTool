const { pool } = require('../database/db');

class VehicleModel {
    /**
     * gets all user vehicles
     */
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

    /**
     * creates new vehicle
     */
    static async createVehicle(userId, vehicleData) {
        const {
            vehicle_type,
            brand,
            model,
            year,
            is_electric = false,
            notes = null
        } = vehicleData;

        const query = `
            INSERT INTO "Vehicles" 
            (user_id, vehicle_type, brand, model, year, is_electric, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            RETURNING *
        `;

        const result = await pool.query(query, [
            userId,
            vehicle_type,
            brand,
            model,
            year,
            is_electric,
            notes
        ]);

        return result.rows[0];
    }

    /**
     * updates existing vehicle
     */
    static async updateVehicle(userId, vehicleId, vehicleData) {
        const {
            vehicle_type,
            brand,
            model,
            year,
            is_electric,
            notes
        } = vehicleData;

        const query = `
            UPDATE "Vehicles"
            SET 
                vehicle_type = $3,
                brand = $4,
                model = $5,
                year = $6,
                is_electric = $7,
                notes = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [
            vehicleId,
            userId,
            vehicle_type,
            brand,
            model,
            year,
            is_electric || false,
            notes
        ]);

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * deletes vehicle
     */
    static async deleteVehicle(userId, vehicleId) {
        const query = `
            DELETE FROM "Vehicles"
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [vehicleId, userId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    static async getVehicleById(userId, vehicleId) {
        const query = `
            SELECT id, vehicle_type, brand, model, year, is_electric, notes, created_at
            FROM "Vehicles"
            WHERE id = $1 AND user_id = $2
        `;

        const result = await pool.query(query, [vehicleId, userId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    static async checkVehicleOwnership(userId, vehicleId) {
        const query = `
            SELECT id FROM "Vehicles"
            WHERE id = $1 AND user_id = $2
        `;

        const result = await pool.query(query, [vehicleId, userId]);
        return result.rows.length > 0;
    }

    static async checkVehicleInUse(vehicleId) {
        const query = `
            SELECT COUNT(*) as count
            FROM "Appointments"
            WHERE vehicle_id = $1 AND status NOT IN ('cancelled', 'completed', 'rejected')
        `;

        const result = await pool.query(query, [vehicleId]);
        return parseInt(result.rows[0].count) > 0;
    }

    static async getUserVehicleStats(userId) {
        const query = `
            SELECT 
                vehicle_type,
                COUNT(*) as count,
                COUNT(CASE WHEN is_electric = true THEN 1 END) as electric_count
            FROM "Vehicles"
            WHERE user_id = $1
            GROUP BY vehicle_type
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }
}

module.exports = VehicleModel;