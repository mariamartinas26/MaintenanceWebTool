const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendUnauthorized, sendServerError } = require('../utils/response');

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
        return sendUnauthorized(res, 'Admin access required');
    }
    next();
};

module.exports = { verifyToken, requireAdmin };