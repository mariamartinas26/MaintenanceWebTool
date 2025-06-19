
const User = require('../models/User');
const { sendUnauthorized, sendServerError, sendForbidden } = require('../utils/response');

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('Auth header:', authHeader); // Debug
    console.log('Token extracted:', token ? token.substring(0, 20) + '...' : 'None'); // Debug

    if (!token) {
        console.log('No token provided');
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-key';
        const decoded = jwt.verify(token, secret);

        console.log('Token decoded:', decoded); // Debug

        req.userId = decoded.userId || decoded.user_id;
        req.user = decoded;

        next();
    } catch (error) {
        console.log('Token verification failed:', error.message); // Debug

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }

        return res.status(403).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

module.exports = { authenticateToken };
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