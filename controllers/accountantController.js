const AccountantModel = require('../models/accountantModel');
const SupplierController = require('./supplierController');

const hasAccountantAccess = (userRole) => {
    return userRole === 'accountant';
};

const hasImportExportAccess = (userRole) => {
    return userRole === 'accountant';
};

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const getDashboard = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        const stats = await AccountantModel.getDashboardStats();

        sendJSON(res, 200, {
            success: true,
            data: {
                user: {
                    id: req.user.id,
                    name: `${req.user.first_name} ${req.user.last_name}`,
                    role: req.user.role
                },
                stats: stats,
                permissions: {
                    suppliers: hasAccountantAccess(userRole),
                    importExport: hasImportExportAccess(userRole),
                }
            },
            message: 'Accountant dashboard data retrieved successfully'
        });

    } catch (error) {
        sendJSON(res, 500, {
            success: false,
            message: 'Failed to retrieve dashboard data'
        });
    }
};

const getSuppliers = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        await SupplierController.getAllSuppliers(req, res, req.query || {});

    } catch (error) {
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to retrieve suppliers: ' + error.message
            });
        }
    }
};

const getSupplierById = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        await SupplierController.getSupplierById(req, res, req.params);

    } catch (error) {
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to retrieve supplier: ' + error.message
            });
        }
    }
};

const addSupplier = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        req.body.created_by = req.user.id;

        await SupplierController.createSupplier(req, res, req.body);

    } catch (error) {
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to add supplier: ' + error.message
            });
        }
    }
};

const exportSuppliers = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasImportExportAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Import/Export access required.'
            });
        }

        await SupplierController.getSuppliersForExport(req, res);

    } catch (error) {
        console.error('Error in exportSuppliers:', error);
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to export suppliers: ' + error.message
            });
        }
    }
};

const importSuppliers = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasImportExportAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Import/Export access required.'
            });
        }

        sendJSON(res, 200, {
            success: true,
            message: 'Import functionality will be implemented soon',
            data: {
                imported: 0,
                skipped: 0,
                errors: []
            }
        });

    } catch (error) {
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to import suppliers: ' + error.message
            });
        }
    }
};

module.exports = {
    getDashboard,
    getSuppliers,
    getSupplierById,
    addSupplier,
    exportSuppliers,
    importSuppliers
};