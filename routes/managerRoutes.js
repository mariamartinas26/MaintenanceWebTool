const jwt = require('jsonwebtoken');

function verifyToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'No token provided' };
    }

    const token = authHeader.substring(7);

    try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-key';
        const decoded = jwt.verify(token, secret);
        return {
            valid: true,
            userId: decoded.userId || decoded.user_id,
            user: decoded
        };
    } catch (error) {
        return {
            valid: false,
            error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        };
    }
}

function requireAuth(req, res, next) {
    const authResult = verifyToken(req.headers.authorization);

    if (!authResult.valid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: authResult.error
        }));
        return false;
    }

    req.userId = authResult.userId;
    req.user = authResult.user;
    return true;
}

module.exports = {
    verifyToken,
    requireAuth
};