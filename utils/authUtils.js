const jwt = require('jsonwebtoken');

function verifyToken(authHeader) {
    console.log('Verifying token, auth header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No valid auth header');
        return { valid: false, error: 'No token provided' };
    }

    const token = authHeader.substring(7);
    console.log('Token extracted:', token.substring(0, 20) + '...');

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.log('JWT_SECRET not found in environment');
            return { valid: false, error: 'Server configuration error' };
        }

        const decoded = jwt.verify(token, secret);
        console.log('Token decoded successfully:', decoded);

        return {
            valid: true,
            userId: decoded.userId || decoded.user_id,
            user: decoded
        };
    } catch (error) {
        console.log('Token verification failed:', error.message);
        return {
            valid: false,
            error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        };
    }
}

function requireAuth(req, res) {
    const authHeader = req.headers.authorization;
    console.log('Checking auth, header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No valid auth header');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'No token provided'
        }));
        return false;
    }

    const token = authHeader.substring(7);
    console.log('Token extracted:', token.substring(0, 20) + '...');

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.log('JWT_SECRET not found');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Server configuration error'
            }));
            return false;
        }

        const decoded = jwt.verify(token, secret);
        console.log('Token decoded successfully:', decoded);

        req.userId = decoded.userId || decoded.user_id;
        req.user = decoded;
        console.log('Auth successful for user:', req.userId);
        return true;
    } catch (error) {
        console.log('Token verification failed:', error.message);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        }));
        return false;
    }
}


module.exports = {
    verifyToken,
    requireAuth
};