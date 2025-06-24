const url = require('url');
const supplierController = require('../controllers/supplierController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

async function handleSupplierRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;

    try {
        const sanitizedQuery = securePath.sanitizeQuery(query);
        req.query = sanitizedQuery;

        //verific autentificarea
        await new Promise((resolve) => {
            verifyToken(req, res, (error) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 401, {
                        success: false,
                        message: error.message
                    });
                }
                resolve();
            });
        });

        // Verifică rolul (admin sau manager)
        await new Promise((resolve) => {
            requireAdmin(req, res, (error) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 403, {
                        success: false,
                        message: error.message
                    });
                }
                resolve();
            });
        });

        securePath.setSecurityHeaders(res);

        if (pathname === '/api/suppliers' && method === 'GET') {
            return await supplierController.getAllSuppliers(req, res);
        }

        if (pathname === '/api/parts' && method === 'GET') {
            return await supplierController.getAllParts(req, res);
        }

        if (pathname === '/api/orders' && method === 'GET') {
            return await supplierController.getAllOrders(req, res);
        }

        if (pathname === '/api/orders' && method === 'POST') {
            return await parseBodyAndExecute(req, res, supplierController.createOrder);
        }

        // PUT /api/orders/:id/status
        if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && method === 'PUT') {
            const orderId = pathname.slice(12, -7); //elimin /api/orders/ și /status

            if (!orderId || isNaN(parseInt(orderId))) {
                return securePath.sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid order ID'
                });
            }

            return await parseBodyAndExecute(req, res, (req, res) => {
                req.body.orderId = parseInt(orderId);
                return supplierController.updateOrderStatus(req, res);
            });
        }
        return securePath.sendJSON(res, 404, {
            success: false,
            message: 'Route not found'
        });

    } catch (error) {
        if (!res.headersSent) {
            return securePath.sendJSON(res, 500, {
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}
//citeste si parseaza body ul requestului si il trimite la controller(pt post si put)
const parseBodyAndExecute = (req, res, controllerFunction) => {
    return new Promise((resolve) => {
        securePath.processRequestBody(req, async (error, sanitizedBody) => {
            if (error) {
                return securePath.sendJSON(res, error.statusCode || 400, {
                    success: false,
                    message: error.message
                });
            }

            try {
                req.body = sanitizedBody;
                await controllerFunction(req, res);
                resolve();
            } catch (controllerError) {
                if (!res.headersSent) {
                    return securePath.sendJSON(res, 500, {
                        success: false,
                        message: 'Controller execution error'
                    });
                }
                resolve();
            }
        });
    });
};

module.exports = { handleSupplierRoutes };