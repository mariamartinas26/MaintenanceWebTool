const jwt = require('jsonwebtoken');
const User = require('../models/User');

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .replace(/&/g, '&amp;');
}

function safeJsonParse(jsonString) {
    try {
        if (!jsonString || typeof jsonString !== 'string') {
            return null;
        }

        if (/<script|javascript:|on\w+\s*=|data:/i.test(jsonString)) {
            console.warn('Potentially malicious content detected in JSON');
            return null;
        }

        const parsed = JSON.parse(jsonString);
        if (typeof parsed === 'object' && parsed !== null) {
            return sanitizeObject(parsed);
        }

        return parsed;
    } catch (error) {
        console.error('Error parsing JSON safely:', error);
        return null;
    }
}

function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return typeof obj === 'string' ? sanitizeInput(obj) : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizeInput(key);
        sanitized[sanitizedKey] = sanitizeObject(value);
    }

    return sanitized;
}

function validateToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return false;
    }

    const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    return jwtRegex.test(token);
}

function safeDecodeJWT(token) {
    try {
        if (!validateToken(token)) {
            return null;
        }

        const parts = token.split('.');
        const payload = parts[1];

        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return safeJsonParse(decoded);
    } catch (error) {
        console.error('Error decoding JWT safely:', error);
        return null;
    }
}

function getCurrentUserRole() {
    try {

        const userString = localStorage.getItem('user');
        if (userString) {
            const userData = safeJsonParse(userString);
            if (userData && userData.role) {
                return sanitizeInput(userData.role);
            }
        }

        const token = localStorage.getItem('token');
        if (token) {
            const payload = safeDecodeJWT(token);
            if (payload && payload.role) {
                return sanitizeInput(payload.role);
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

function getCurrentUserName() {
    try {

        const userString = localStorage.getItem('user');
        if (userString) {
            const userData = safeJsonParse(userString);
            if (userData) {
                const firstName = userData.first_name ? sanitizeInput(userData.first_name) : '';
                const lastName = userData.last_name ? sanitizeInput(userData.last_name) : '';
                return `${firstName} ${lastName}`.trim() || null;
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting user name:', error);
        return null;
    }
}

function logout() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userPreferences');
            localStorage.removeItem('sessionData');
        }

        if (typeof window !== 'undefined') {
            const loginUrl = '/login';
            if (loginUrl.startsWith('/') || loginUrl.startsWith(window.location.origin)) {
                window.location.href = loginUrl;
            } else {
                window.location.href = '/login'; // fallback sigur
            }
        }
    } catch (error) {
        console.error('Error during logout:', error);
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }
}

function setSecurityHeaders(res) {
    if (res && res.setHeader) {
        res.setHeader('Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self'; " +
            "font-src 'self'; " +
            "object-src 'none'; " +
            "base-uri 'self';"
        );

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
}

if (typeof window !== 'undefined') {
    if (window.document && window.location) {
        window.getCurrentUserRole = getCurrentUserRole;
        window.getCurrentUserName = getCurrentUserName;
        window.logout = logout;
    }
}

function verifyToken(req, res, next) {
    setSecurityHeaders(res);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('No token provided');
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.substring(7);

    if (!validateToken(token)) {
        const error = new Error('Invalid token format');
        error.statusCode = 401;
        return next(error);
    }


    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            const error = new Error('Server configuration error');
            error.statusCode = 500;
            return next(error);
        }

        const decoded = jwt.verify(token, secret);

        const sanitizedDecoded = sanitizeObject(decoded);

        req.userId = sanitizedDecoded.userId || sanitizedDecoded.user_id;
        req.user = {
            id: sanitizedDecoded.userId || sanitizedDecoded.user_id,
            userId: sanitizedDecoded.userId || sanitizedDecoded.user_id
        };

        return next();
    } catch (error) {
        const authError = new Error(error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
        authError.statusCode = 401;
        return next(authError);
    }
}

async function authenticateToken(req, res, next) {
    try {

        setSecurityHeaders(res);

        await new Promise((resolve, reject) => {
            verifyToken(req, res, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        if (!req.userId) {
            const error = new Error('User ID not found after token verification');
            error.statusCode = 401;
            return next(error);
        }

        const user = await User.findById ? await User.findById(req.userId) : null;

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 401;
            return next(error);
        }

        req.user = {
            id: user.id,
            email: sanitizeInput(user.email || ''),
            first_name: sanitizeInput(user.first_name || ''),
            last_name: sanitizeInput(user.last_name || ''),
            role: sanitizeInput(user.role || ''),
            phone: sanitizeInput(user.phone || ''),
            created_at: user.created_at
        };

        return next();

    } catch (error) {
        const authError = new Error('Authentication failed');
        authError.statusCode = 401;
        return next(authError);
    }
}

function validateRole(role, allowedRoles) {
    if (!role || typeof role !== 'string') {
        return false;
    }

    const sanitizedRole = sanitizeInput(role.toLowerCase());
    return allowedRoles.includes(sanitizedRole);
}

async function requireAdmin(req, res, next) {
    try {

        setSecurityHeaders(res);

        if (!req.userId) {
            const error = new Error('User ID not found');
            error.statusCode = 401;
            return next(error);
        }

        const user = await User.findById ? await User.findById(req.userId) : null;

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 401;
            return next(error);
        }


        if (!validateRole(user.role, ['admin', 'manager'])) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            return next(error);
        }

        req.user = {
            id: user.id,
            email: sanitizeInput(user.email || ''),
            first_name: sanitizeInput(user.first_name || ''),
            last_name: sanitizeInput(user.last_name || ''),
            role: sanitizeInput(user.role || '')
        };

        return next();

    } catch (error) {
        const adminError = new Error('Failed to verify admin status');
        adminError.statusCode = 500;
        return next(adminError);
    }
}

async function requireAccountant(req, res, next) {
    try {

        setSecurityHeaders(res);

        if (!req.userId) {
            const error = new Error('User ID not found');
            error.statusCode = 401;
            return next(error);
        }

        const user = await User.findById ? await User.findById(req.userId) : null;

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 401;
            return next(error);
        }


        if (!validateRole(user.role, ['admin', 'manager', 'accountant'])) {
            const error = new Error('Accountant access required');
            error.statusCode = 403;
            return next(error);
        }

        req.user = {
            id: user.id,
            email: sanitizeInput(user.email || ''),
            first_name: sanitizeInput(user.first_name || ''),
            last_name: sanitizeInput(user.last_name || ''),
            role: sanitizeInput(user.role || ''),
            phone: sanitizeInput(user.phone || '')
        };

        return next();

    } catch (error) {
        const accountantError = new Error('Failed to verify accountant access');
        accountantError.statusCode = 500;
        return next(accountantError);
    }
}

async function requireManager(req, res, next) {
    try {

        setSecurityHeaders(res);

        if (!req.userId) {
            const error = new Error('User ID not found');
            error.statusCode = 401;
            return next(error);
        }

        const user = await User.findById ? await User.findById(req.userId) : null;

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 401;
            return next(error);
        }


        if (!validateRole(user.role, ['admin', 'manager'])) {
            const error = new Error('Manager access required');
            error.statusCode = 403;
            return next(error);
        }

        req.user = {
            id: user.id,
            email: sanitizeInput(user.email || ''),
            first_name: sanitizeInput(user.first_name || ''),
            last_name: sanitizeInput(user.last_name || ''),
            role: sanitizeInput(user.role || '')
        };

        return next();

    } catch (error) {
        const managerError = new Error('Failed to verify manager access');
        managerError.statusCode = 500;
        return next(error);
    }
}

module.exports = {
    verifyToken,
    authenticateToken,
    requireAdmin,
    requireAccountant,
    requireManager,
    sanitizeInput,
    safeJsonParse,
    setSecurityHeaders
};