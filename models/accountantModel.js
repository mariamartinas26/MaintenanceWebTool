const db = require('../database/db');

class AccountantModel {
    static async getSuppliers() {
        try {
            const query = 'SELECT * FROM suppliers ORDER BY created_at DESC';
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting suppliers:', error);
            throw error;
        }
    }
}

module.exports = AccountantModel;