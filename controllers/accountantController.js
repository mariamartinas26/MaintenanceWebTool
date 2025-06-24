const SupplierController = require('./supplierController');

//doar pentru a incarca suppliers
class AccountantController {

    static hasAccountantAccess(userRole) {
        return ['accountant'].includes(userRole);
    }

    static hasImportExportAccess(userRole) {
        return ['accountant'].includes(userRole);
    }

    static sendJSON(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    static async getDashboard(req, res) {
        try {
            const userRole = req.user.role;

            if (!this.hasAccountantAccess(userRole)) {
                return this.sendJSON(res, 403, {
                    success: false,
                    message: 'Access denied. Accountant role required.'
                });
            }

            this.sendJSON(res, 200, {
                success: true,
                data: {
                    user: {
                        id: req.user.id,
                        name: `${req.user.first_name} ${req.user.last_name}`,
                        role: req.user.role
                    },
                    permissions: {
                        suppliers: this.hasAccountantAccess(userRole),
                        importExport: this.hasImportExportAccess(userRole),
                    }
                },
                message: 'Accountant dashboard loaded successfully'
            });

        } catch (error) {
            this.sendJSON(res, 500, {
                success: false,
                message: 'Failed to retrieve dashboard data'
            });
        }
    }

    static async getSuppliers(req, res) {
        try {
            const userRole = req.user.role;

            if (!this.hasAccountantAccess(userRole)) {
                return this.sendJSON(res, 403, {
                    success: false,
                    message: 'Access denied. Accountant role required.'
                });
            }

            //apeleaza getAllSuppliers din supplierController
            await SupplierController.getAllSuppliers(req, res, req.query || {});

        } catch (error) {
            if (!res.headersSent) {
                this.sendJSON(res, 500, {
                    success: false,
                    message: 'Failed to retrieve suppliers: ' + error.message
                });
            }
        }
    }
}

module.exports = AccountantController;