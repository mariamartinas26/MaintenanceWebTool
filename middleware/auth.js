const jwt = require('jsonwebtoken');
const User = require('../models/User');

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    console.log('Verifying token, auth header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No valid auth header');
        const error = new Error('No token provided');
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.substring(7);
    console.log('Token extracted:', token.substring(0, 20) + '...');

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.log('JWT_SECRET not found');
            const error = new Error('Server configuration error');
            error.statusCode = 500;
            return next(error);
        }

        const decoded = jwt.verify(token, secret);
        console.log('Token decoded successfully:', decoded);

        // Compatibilitate cu token-ul generat în authController
        req.userId = decoded.userId || decoded.user_id;
        req.user = {
            id: decoded.userId || decoded.user_id,
            userId: decoded.userId || decoded.user_id
        };

        console.log('Auth successful for user:', req.userId);
        return next();
    } catch (error) {
        console.log('Token verification failed:', error.message);
        const authError = new Error(error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
        authError.statusCode = 401;
        return next(authError);
    }
}

async function requireAdmin(req, res, next) {
    try {
        console.log('Checking admin role for user:', req.userId);

        if (!req.userId) {
            const error = new Error('User ID not found');
            error.statusCode = 401;
            return next(error);
        }

        // Caută user-ul în baza de date pentru a verifica rolul
        const user = await User.findById ? await User.findById(req.userId) : null;

        if (!user) {
            console.log('User not found in database');
            const error = new Error('User not found');
            error.statusCode = 401;
            return next(error);
        }

        console.log('User role:', user.role);

        if (user.role !== 'admin' && user.role !== 'manager') {
            console.log('User is not admin or manager');
            const error = new Error('Admin access required');
            error.statusCode = 403;
            return next(error);
        }

        req.user = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
        };

        console.log('Admin access granted for:', user.email);
        return next();

    } catch (error) {
        console.error('Error checking admin role:', error);
        const adminError = new Error('Failed to verify admin status');
        adminError.statusCode = 500;
        return next(adminError);
    }
}

module.exports = {
    verifyToken,
    requireAdmin
};