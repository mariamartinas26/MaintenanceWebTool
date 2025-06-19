const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendUnauthorized, sendServerError, sendForbidden } = require('../utils/response');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendUnauthorized(res, 'Access token is required');
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return sendUnauthorized(res, 'Invalid token');
        }

        // Verifică dacă contul este activ
        if (user.status !== 'active') {
            return sendUnauthorized(res, 'Account is not active');
        }

        req.user = user;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return sendUnauthorized(res, 'Invalid token');
        }

        if (error.name === 'TokenExpiredError') {
            return sendUnauthorized(res, 'Token expired');
        }

        sendServerError(res, 'Server error');
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return sendForbidden(res, 'Admin access required');
    }
    next();
};

const requireManager = (req, res, next) => {
    if (req.user.role !== 'manager') {
        return sendForbidden(res, 'Manager access required');
    }
    next();
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return sendForbidden(res, `${role} access required`);
        }
        next();
    };
};

const requireAnyRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return sendForbidden(res, `Access denied. Required roles: ${allowedRoles.join(', ')}`);
        }
        next();
    };
};

module.exports = {
    verifyToken,
    requireAdmin,
    requireManager,
    requireRole,
    requireAnyRole
};