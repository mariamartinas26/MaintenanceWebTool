// routes/supplierRoutes.js
const url = require('url');
const supplierController = require('../controllers/supplierController');

// Adaugă funcția de autentificare
async function requireAuth(req, res) {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');

    const authHeader = req.headers.authorization;
    console.log('Supplier route - checking auth:', authHeader?.substring(0, 20) + '...');

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

        // Verifică user-ul în baza de date
        const user = await User.findById(decoded.userId || decoded.user_id);

        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'User not found'
            }));
            return false;
        }

        // Verifică dacă e admin sau manager
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
        console.log('Supplier route auth successful for:', user.email);
        return true;

    } catch (error) {
        console.log('Supplier route auth failed:', error.message);
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

    console.log('=== SUPPLIER ROUTE ===');
    console.log('Path:', pathname);
    console.log('Method:', method);

    // Verifică autentificarea pentru toate rutele supplier
    if (!await requireAuth(req, res)) {
        return; // Răspunsul a fost deja trimis cu eroare de autentificare
    }

    try {
        // GET /api/suppliers - Get all suppliers
        if (pathname === '/api/suppliers' && method === 'GET') {
            console.log('Getting all suppliers...');
            await supplierController.getAllSuppliers(req, res, query);
        }

        // GET /api/suppliers/:id - Get supplier by ID
        else if (pathname.match(/^\/api\/suppliers\/(\d+)$/) && method === 'GET') {
            const id = pathname.split('/')[3];
            await supplierController.getSupplierById(req, res, { id });
        }

        // POST /api/suppliers - Create new supplier
        else if (pathname === '/api/suppliers' && method === 'POST') {
            const body = await getRequestBody(req);
            await supplierController.createSupplier(req, res, body);
        }

        // PUT /api/suppliers/:id - Update supplier
        else if (pathname.match(/^\/api\/suppliers\/(\d+)$/) && method === 'PUT') {
            const id = pathname.split('/')[3];
            const body = await getRequestBody(req);
            await supplierController.updateSupplier(req, res, { id, ...body });
        }

        // DELETE /api/suppliers/:id - Delete supplier
        else if (pathname.match(/^\/api\/suppliers\/(\d+)$/) && method === 'DELETE') {
            const id = pathname.split('/')[3];
            await supplierController.deleteSupplier(req, res, { id });
        }

        // GET /api/suppliers/:id/orders - Get orders by supplier
        else if (pathname.match(/^\/api\/suppliers\/(\d+)\/orders$/) && method === 'GET') {
            const supplierId = pathname.split('/')[3];
            await supplierController.getOrdersBySupplier(req, res, { supplierId, ...query });
        }

        // GET /api/parts - Get all parts
        else if (pathname === '/api/parts' && method === 'GET') {
            console.log('Getting all parts...');
            await supplierController.getAllParts(req, res, query);
        }

        // POST /api/orders - Create new order
        else if (pathname === '/api/orders' && method === 'POST') {
            const body = await getRequestBody(req);
            await supplierController.createOrder(req, res, body);
        }

        // GET /api/orders - Get all orders
        else if (pathname === '/api/orders' && method === 'GET') {
            console.log('Getting all orders...');
            await supplierController.getAllOrders(req, res, query);
        }

        // PUT /api/orders/:id/status - Update order status
        else if (pathname.match(/^\/api\/orders\/(\d+)\/status$/) && method === 'PUT') {
            const orderId = pathname.split('/')[3];
            const body = await getRequestBody(req);
            await supplierController.updateOrderStatus(req, res, { orderId, ...body });
        }

        else {
            console.log('Supplier route not found:', pathname);
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