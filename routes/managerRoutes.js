const jwt = require('jsonwebtoken');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

function verifyToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') {
        return { valid: false, error: 'No token provided' };
    }

    const sanitizedAuthHeader = securePath.sanitizeInput(authHeader);

    if (!sanitizedAuthHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'No token provided' };
    }

    const token = sanitizedAuthHeader.substring(7);

    if (!token || token.trim().length === 0) {
        return { valid: false, error: 'No token provided' };
    }

    try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-key';
        const decoded = jwt.verify(token, secret);

        const sanitizedDecoded = securePath.sanitizeObject(decoded);

        return {
            valid: true,
            userId: sanitizedDecoded.userId || sanitizedDecoded.user_id,
            user: sanitizedDecoded
        };
    } catch (error) {
        const sanitizedErrorMessage = securePath.sanitizeInput(error.message || '');
        console.error('Token verification error:', sanitizedErrorMessage);

        return {
            valid: false,
            error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        };
    }
}

function requireAuth(req, res, next) {
    try {
        const authResult = verifyToken(req.headers.authorization);

        if (!authResult.valid) {
            return securePath.sendJSON(res, 401, {
                success: false,
                message: securePath.sanitizeInput(authResult.error)
            });
        }

        req.userId = authResult.userId;
        req.user = authResult.user;

        if (typeof next === 'function') {
            next();
        }

        return true;
    } catch (error) {
        console.error('Auth middleware error:', securePath.sanitizeInput(error.message || ''));
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Authentication error'
        });
    }
}

module.exports = {
    verifyToken,
    requireAuth
};