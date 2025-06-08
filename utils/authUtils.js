const jwt = require('jsonwebtoken');

/**
 * Extrage user ID din token JWT
 * @param {string} authHeader - Authorization header
 * @returns {number|null} - User ID sau null dacă token-ul este invalid
 */
function getUserIdFromToken(authHeader) {
    console.log('Auth header received:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Invalid auth header format');
        return null;
    }

    const token = authHeader.substring(7);
    console.log('Token extracted:', token);

    try {
        // Decodează JWT-ul real
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id || decoded.userId || decoded.id || decoded.sub;
        console.log('User ID extracted from JWT:', userId);
        return userId ? parseInt(userId) : null;
    } catch (error) {
        console.log('Error decoding token:', error.message);
        return null;
    }
}

/**
 * Middleware pentru autentificare
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
function authenticateToken(req, res, next) {
    const userId = getUserIdFromToken(req.headers.authorization);

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Token invalid sau lipsă'
        });
    }

    req.userId = userId;
    next();
}

module.exports = {
    getUserIdFromToken,
    authenticateToken
};