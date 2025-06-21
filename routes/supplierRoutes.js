const url = require('url');
const supplierController = require('../controllers/supplierController');

async function requireAuth(req, res) {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'No token provided'
        }));
        return false;
    }

    const token = authHeader.substring(7);

    try {
        const secret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        const user = await User.findById(decoded.userId || decoded.user_id);

        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'User not found'
            }));
            return false;
        }

        if (user.role !== 'admin' && user.role !== 'manager') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Admin access required'
            }));
            return false;
        }

        req.userId = user.id;
        req.user = user;
        return true;

    } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        }));
        return false;
    }
}

async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const parsed = body.trim() ? JSON.parse(body) : {};
                resolve(parsed);
            } catch (error) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
        req.on('error', reject);
    });
}

async function handleSupplierRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;

    if (!await requireAuth(req, res)) {
        return;
    }

    try {
        // GET /api/parts - Get all parts
        if (pathname === '/api/parts' && method === 'GET') {
            await supplierController.getAllParts(req, res, query);
        }

        // POST /api/orders - Create new order
        else if (pathname === '/api/orders' && method === 'POST') {
            const body = await getRequestBody(req);
            await supplierController.createOrder(req, res, body);
        }

        // GET /api/orders - Get all orders
        else if (pathname === '/api/orders' && method === 'GET') {
            await supplierController.getAllOrders(req, res, query);
        }

        // PUT /api/orders/:id/status - Update order status
        else if (pathname.match(/^\/api\/orders\/(\d+)\/status$/) && method === 'PUT') {
            const orderId = pathname.split('/')[3];
            const body = await getRequestBody(req);
            await supplierController.updateOrderStatus(req, res, { orderId, ...body });
        }

        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Supplier route not found' }));
        }

    } catch (error) {
        console.error('Supplier routes error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error in supplier routes',
            error: error.message
        }));
    }
}

module.exports = { handleSupplierRoutes };