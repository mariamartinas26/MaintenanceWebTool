const User = require('../models/User');
const AccountantModel = require('../models/accountantModel');
const { sendSuccess, sendBadRequest, sendServerError } = require('../utils/response');

const hasAccountantAccess = (userRole) => {
    return ['admin', 'manager', 'accountant'].includes(userRole);
};

const hasImportExportAccess = (userRole) => {
    return ['admin', 'manager', 'accountant'].includes(userRole);
};

const canDeleteSuppliers = (userRole) => {
    return ['admin', 'manager'].includes(userRole);
};

const getDashboard = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Accountant role required.');
        }

        const stats = await AccountantModel.getDashboardStats();

        sendSuccess(res, {
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
        }, 'Accountant dashboard data retrieved successfully');

    } catch (error) {
        console.error('Error in getDashboard:', error);
        sendServerError(res, 'Failed to retrieve dashboard data');
    }
};

module.exports = {
    getDashboard
};