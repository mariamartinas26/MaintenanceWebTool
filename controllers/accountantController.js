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

module.exports = {
    getSuppliers,
    exportSuppliers
};