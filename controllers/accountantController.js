const AccountantModel = require('../models/accountantModel');
const SupplierController = require('./supplierController');

const hasAccountantAccess = (userRole) => {
    return ['admin', 'manager', 'accountant'].includes(userRole);
};

const hasImportExportAccess = (userRole) => {
    return ['admin', 'manager', 'accountant'].includes(userRole);
};

const canDeleteSuppliers = (userRole) => {
    return ['admin', 'manager'].includes(userRole);
};

// Helper function pentru response
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const getDashboard = async (req, res) => {
    try {
        console.log('=== getDashboard called ===');
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
                    canDelete: canDeleteSuppliers(userRole)
                }
            },
            message: 'Accountant dashboard data retrieved successfully'
        });

    } catch (error) {
        console.error('Error in getDashboard:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Failed to retrieve dashboard data'
        });
    }
};

const getSuppliers = async (req, res) => {
    try {
        console.log('=== getSuppliers called ===');
        console.log('User role:', req.user?.role);

        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            console.log('Access denied for role:', userRole);
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        console.log('Calling SupplierController.getAllSuppliers...');

        await SupplierController.getAllSuppliers(req, res, req.query || {});

    } catch (error) {
        console.error('Error in getSuppliers:', error);
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
        console.error('Error in getSupplierById:', error);
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

const updateSupplier = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        req.body.id = req.params.id;
        req.body.updated_by = req.user.id;

        await SupplierController.updateSupplier(req, res, req.body);

    } catch (error) {
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to update supplier: ' + error.message
            });
        }
    }
};

const deleteSupplier = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!canDeleteSuppliers(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Only admin and manager can delete suppliers.'
            });
        }

        await SupplierController.deleteSupplier(req, res, req.params);

    } catch (error) {
        console.error('Error in deleteSupplier:', error);
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to delete supplier: ' + error.message
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
    updateSupplier,
    deleteSupplier,
    exportSuppliers,
    importSuppliers
};