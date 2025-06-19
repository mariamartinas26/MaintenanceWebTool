const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getCurrentUserRole() {
    try {
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            return userData.role;
        }

        // Fallback: extrage din token
        const token = localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.role;
        }

        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}
function getCurrentUserName() {
    try {
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            return `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
        }
        return null;
    } catch (error) {
        console.error('Error getting user name:', error);
        return null;
    }
}

// Funcție pentru logout (dacă nu există deja)
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Export pentru window object
if (typeof window !== 'undefined') {
    window.getCurrentUserRole = getCurrentUserRole;
    window.getCurrentUserName = getCurrentUserName;
    window.logout = logout;
}
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

// Funcție pentru autentificare completă cu datele utilizatorului
async function authenticateToken(req, res, next) {
    try {
        console.log('=== authenticateToken called ===');

        // Primul pas: verifică token-ul
        await new Promise((resolve, reject) => {
            verifyToken(req, res, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        // Al doilea pas: obține datele complete ale utilizatorului
        if (!req.userId) {
            const error = new Error('User ID not found after token verification');
            error.statusCode = 401;
            return next(error);
        }

        console.log('Getting user data for ID:', req.userId);
        const user = await User.findById ? await User.findById(req.userId) : null;

        if (!user) {
            console.log('User not found in database');
            const error = new Error('User not found');
            error.statusCode = 401;
            return next(error);
        }

        // Completează req.user cu toate datele necesare
        req.user = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            phone: user.phone,
            created_at: user.created_at
        };

        console.log('User authenticated successfully:', {
            id: user.id,
            email: user.email,
            role: user.role
        });

        return next();

    } catch (error) {
        console.error('Error in authenticateToken:', error);
        const authError = new Error('Authentication failed');
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

// Funcție pentru verificarea accesului de accountant
async function requireAccountant(req, res, next) {
    try {
        console.log('Checking accountant access for user:', req.userId);

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

        // Verifică dacă utilizatorul are acces (admin, manager sau accountant)
        if (!['admin', 'manager', 'accountant'].includes(user.role)) {
            console.log('User does not have accountant access');
            const error = new Error('Accountant access required');
            error.statusCode = 403;
            return next(error);
        }

        req.user = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            phone: user.phone
        };

        console.log('Accountant access granted for:', user.email, 'with role:', user.role);
        return next();

    } catch (error) {
        console.error('Error checking accountant access:', error);
        const accountantError = new Error('Failed to verify accountant access');
        accountantError.statusCode = 500;
        return next(accountantError);
    }
}

// Funcție pentru verificarea accesului de manager
async function requireManager(req, res, next) {
    try {
        console.log('Checking manager access for user:', req.userId);

        if (!req.userId) {
            const error = new Error('User ID not found');
            error.statusCode = 401;
            return next(error);
        }

        const user = await User.findById ? await User.findById(req.userId) : null;

        if (!user) {
            console.log('User not found in database');
            const error = new Error('User not found');
            error.statusCode = 401;
            return next(error);
        }

        console.log('User role:', user.role);

        if (!['admin', 'manager'].includes(user.role)) {
            console.log('User is not admin or manager');
            const error = new Error('Manager access required');
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

        console.log('Manager access granted for:', user.email);
        return next();

    } catch (error) {
        console.error('Error checking manager access:', error);
        const managerError = new Error('Failed to verify manager access');
        managerError.statusCode = 500;
        return next(managerError);
    }
}

module.exports = {
    verifyToken,
    authenticateToken,  // Pentru autentificare completă cu datele utilizatorului
    requireAdmin,       // Pentru acces admin/manager
    requireAccountant,  // Pentru acces accountant/manager/admin
    requireManager      // Pentru acces manager/admin
};