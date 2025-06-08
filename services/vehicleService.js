const { pool } = require('../database/db');

class VehicleService {
    /**
     * Obține toate vehiculele unui utilizator
     * @param {number} userId - ID-ul utilizatorului
     * @returns {Array} - Lista vehiculelor
     */
    async getUserVehicles(userId) {
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
     * Creează un vehicul nou
     * @param {number} userId - ID-ul utilizatorului
     * @param {Object} vehicleData - Datele vehiculului
     * @returns {Object} - Vehiculul creat
     */
    async createVehicle(userId, vehicleData) {
        const {
            vehicle_type,
            brand,
            model,
            year,
            is_electric = false,
            notes = null
        } = vehicleData;

        // Validare date
        this.validateVehicleData(vehicleData);

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
     * Actualizează un vehicul existent
     * @param {number} userId - ID-ul utilizatorului
     * @param {number} vehicleId - ID-ul vehiculului
     * @param {Object} vehicleData - Datele de actualizat
     * @returns {Object} - Vehiculul actualizat
     */
    async updateVehicle(userId, vehicleId, vehicleData) {
        // Verifică dacă vehiculul aparține utilizatorului
        await this.checkVehicleOwnership(userId, vehicleId);

        // Validare date
        this.validateVehicleData(vehicleData);

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

        return result.rows[0];
    }

    /**
     * Șterge un vehicul
     * @param {number} userId - ID-ul utilizatorului
     * @param {number} vehicleId - ID-ul vehiculului
     */
    async deleteVehicle(userId, vehicleId) {
        // Verifică dacă vehiculul aparține utilizatorului
        await this.checkVehicleOwnership(userId, vehicleId);

        // Verifică dacă vehiculul nu este folosit în programări active
        await this.checkVehicleInUse(vehicleId);

        const query = `
            DELETE FROM "Vehicles"
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [vehicleId, userId]);

        if (result.rows.length === 0) {
            throw new Error('Vehiculul nu a putut fi șters');
        }

        return result.rows[0];
    }

    /**
     * Obține un vehicul specific
     * @param {number} userId - ID-ul utilizatorului
     * @param {number} vehicleId - ID-ul vehiculului
     * @returns {Object} - Vehiculul găsit
     */
    async getVehicleById(userId, vehicleId) {
        const query = `
            SELECT id, vehicle_type, brand, model, year, is_electric, notes, created_at
            FROM "Vehicles"
            WHERE id = $1 AND user_id = $2
        `;

        const result = await pool.query(query, [vehicleId, userId]);

        if (result.rows.length === 0) {
            throw new Error('Vehiculul nu a fost găsit');
        }

        return result.rows[0];
    }

    /**
     * Validează datele vehiculului
     * @param {Object} vehicleData - Datele de validat
     */
    validateVehicleData(vehicleData) {
        const { vehicle_type, brand, model, year } = vehicleData;

        if (!vehicle_type || !brand || !model || !year) {
            throw new Error('Tipul vehiculului, marca, modelul și anul sunt obligatorii');
        }

        // Validare tipul vehiculului (din enum)
        const validTypes = ['motocicleta', 'bicicleta', 'trotineta'];
        if (!validTypes.includes(vehicle_type)) {
            throw new Error('Tipul vehiculului trebuie să fie: motocicleta, bicicleta sau trotineta');
        }

        // Validare an
        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear + 1) {
            throw new Error(`Anul trebuie să fie între 1900 și ${currentYear + 1}`);
        }

        // Validare lungime string-uri
        if (brand.length > 100) {
            throw new Error('Marca nu poate avea mai mult de 100 de caractere');
        }

        if (model.length > 100) {
            throw new Error('Modelul nu poate avea mai mult de 100 de caractere');
        }
    }

    /**
     * Verifică dacă vehiculul aparține utilizatorului
     * @param {number} userId - ID-ul utilizatorului
     * @param {number} vehicleId - ID-ul vehiculului
     */
    async checkVehicleOwnership(userId, vehicleId) {
        const query = `
            SELECT id FROM "Vehicles"
            WHERE id = $1 AND user_id = $2
        `;

        const result = await pool.query(query, [vehicleId, userId]);

        if (result.rows.length === 0) {
            throw new Error('Vehiculul nu a fost găsit sau nu îți aparține');
        }
    }

    /**
     * Verifică dacă vehiculul este folosit în programări active
     * @param {number} vehicleId - ID-ul vehiculului
     */
    async checkVehicleInUse(vehicleId) {
        const query = `
            SELECT COUNT(*) as count
            FROM "Appointments"
            WHERE vehicle_id = $1 AND status NOT IN ('cancelled', 'completed', 'rejected')
        `;

        const result = await pool.query(query, [vehicleId]);
        const count = parseInt(result.rows[0].count);

        if (count > 0) {
            throw new Error('Nu poți șterge vehiculul deoarece este folosit în programări active');
        }
    }

    /**
     * Obține statistici despre vehiculele utilizatorului
     * @param {number} userId - ID-ul utilizatorului
     * @returns {Object} - Statistici
     */
    async getUserVehicleStats(userId) {
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

        const stats = {
            total: 0,
            totalElectric: 0,
            byType: {}
        };

        result.rows.forEach(row => {
            const count = parseInt(row.count);
            const electricCount = parseInt(row.electric_count);

            stats.total += count;
            stats.totalElectric += electricCount;
            stats.byType[row.vehicle_type] = {
                total: count,
                electric: electricCount
            };
        });

        return stats;
    }
}

module.exports = new VehicleService();