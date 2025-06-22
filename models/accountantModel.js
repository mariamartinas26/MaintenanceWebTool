const db = require('../database/db');

class AccountantModel {
    static async getDashboardStats() {
        try {
            let recentImports = 0;
            try {
                const importsResult = await db.query(
                    'SELECT COUNT(*) as total FROM import_export_logs WHERE created_at >= NOW() - INTERVAL \'30 days\''
                );
                recentImports = importsResult.rows[0]?.total || 0;
            } catch (err) {
                console.log('import_export_logs table not found, skipping...');
            }

            return {
                totalSuppliers: parseInt(totalSuppliers),
                activeSuppliers: parseInt(activeSuppliers),
                inactiveSuppliers: parseInt(inactiveSuppliers),
                recentImports: parseInt(recentImports),
                lastLoginDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return {
                totalSuppliers: 0,
                activeSuppliers: 0,
                inactiveSuppliers: 0,
                recentImports: 0,
                lastLoginDate: new Date().toISOString()
            };
        }
    }

}

module.exports = AccountantModel;