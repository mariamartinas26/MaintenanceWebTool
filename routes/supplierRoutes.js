const url = require('url');
const supplierController = require('../controllers/supplierController');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

async function requireAuth(req, res) {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');

    const authHeader = req.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
        return securePath.sendJSON(res, 401, {
            success: false,
            message: 'No token provided'
        });
    }

    const sanitizedAuthHeader = securePath.sanitizeInput(authHeader);

    if (!sanitizedAuthHeader.startsWith('Bearer ')) {
        return securePath.sendJSON(res, 401, {
            success: false,
            message: 'No token provided'
        });
    }

    const token = sanitizedAuthHeader.substring(7);

    if (!token || token.trim().length === 0) {
        return securePath.sendJSON(res, 401, {
            success: false,
            message: 'No token provided'
        });
    }

    try {
        const secret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        const sanitizedDecoded = securePath.sanitizeObject(decoded);
        const userId = sanitizedDecoded.userId || sanitizedDecoded.user_id;

        const user = await User.findById(userId);

        if (!user) {
            return securePath.sendJSON(res, 401, {
                success: false,
                message: 'User not found'
            });
        }

        if (user.role !== 'admin' && user.role !== 'manager') {
            return securePath.sendJSON(res, 403, {
                success: false,
                message: 'Admin access required'
            });
        }

        req.userId = securePath.sanitizeInput(user.id);
        req.user = securePath.sanitizeObject(user);
        return true;

    } catch (error) {
        console.error('Auth error:', securePath.sanitizeInput(error.message || ''));
        return securePath.sendJSON(res, 401, {
            success: false,
            message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        });
    }
}

async function handleSupplierRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;

    try {
        const sanitizedQuery = securePath.sanitizeQuery(query);

        if (!await requireAuth(req, res)) {
            return;
        }

        securePath.setSecurityHeaders(res);

        if (pathname === '/api/suppliers' && method === 'GET') {
            await supplierController.getAllSuppliers(req, res, sanitizedQuery);
        }
        else if (pathname === '/api/parts' && method === 'GET') {
            await supplierController.getAllParts(req, res, sanitizedQuery);
        }
        else if (pathname === '/api/orders' && method === 'POST') {
            return securePath.processRequestBody(req, async (error, sanitizedBody) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 400, {
                        success: false,
                        message: securePath.sanitizeInput(error.message)
                    });
                }

                await supplierController.createOrder(req, res, sanitizedBody);
            });
        }
        else if (pathname === '/api/orders' && method === 'GET') {
            await supplierController.getAllOrders(req, res, sanitizedQuery);
        }
        else if (pathname.match(/^\/api\/orders\/(\d+)\/status$/) && method === 'PUT') {
            const params = securePath.extractPathParams(pathname, /^\/api\/orders\/(\d+)\/status$/);
            if (!params) {
                return securePath.sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid order ID'
                });
            }

            return securePath.processRequestBody(req, async (error, sanitizedBody) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 400, {
                        success: false,
                        message: securePath.sanitizeInput(error.message)
                    });
                }

                const requestData = { orderId: params.id, ...sanitizedBody };
                await supplierController.updateOrderStatus(req, res, requestData);
            });
        }
        else {
            return securePath.sendJSON(res, 404, {
                success: false,
                message: 'Supplier route not found'
            });
        }

    } catch (error) {
        console.error('Supplier routes error:', securePath.sanitizeInput(error.message || ''));
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Internal server error in supplier routes',
            error: process.env.NODE_ENV === 'development' ? securePath.sanitizeInput(error.message) : undefined
        });
    }
}

module.exports = { handleSupplierRoutes };