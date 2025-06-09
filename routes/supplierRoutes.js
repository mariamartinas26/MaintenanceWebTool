// routes/supplierRoutes.js
const url = require('url');
const supplierController = require('../controllers/supplierController');

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

    try {
        // GET /api/suppliers - Get all suppliers
        if (pathname === '/api/suppliers' && method === 'GET') {
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

        // GET /api/suppliers/:id/parts - Get parts by supplier
        else if (pathname.match(/^\/api\/suppliers\/(\d+)\/parts$/) && method === 'GET') {
            const supplierId = pathname.split('/')[3];
            await supplierController.getPartsBySupplier(req, res, { supplierId, ...query });
        }

        // GET /api/suppliers/:id/orders - Get orders by supplier
        else if (pathname.match(/^\/api\/suppliers\/(\d+)\/orders$/) && method === 'GET') {
            const supplierId = pathname.split('/')[3];
            await supplierController.getOrdersBySupplier(req, res, { supplierId, ...query });
        }

        // GET /api/suppliers/:id/evaluation - Get supplier evaluation
        else if (pathname.match(/^\/api\/suppliers\/(\d+)\/evaluation$/) && method === 'GET') {
            const supplierId = pathname.split('/')[3];
            await supplierController.getSupplierEvaluation(req, res, { supplierId });
        }

        // PUT /api/suppliers/:id/evaluation - Update supplier evaluation
        else if (pathname.match(/^\/api\/suppliers\/(\d+)\/evaluation$/) && method === 'PUT') {
            const supplierId = pathname.split('/')[3];
            const body = await getRequestBody(req);
            await supplierController.updateSupplierEvaluation(req, res, { supplierId, ...body });
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

        // GET /api/parts - Get all parts
        else if (pathname === '/api/parts' && method === 'GET') {
            await supplierController.getAllParts(req, res, query);
        }

        // GET /api/parts/low-stock - Get low stock parts
        else if (pathname === '/api/parts/low-stock' && method === 'GET') {
            await supplierController.getLowStockParts(req, res, query);
        }

        // POST /api/parts/auto-order - Create auto orders for low stock
        else if (pathname === '/api/parts/auto-order' && method === 'POST') {
            const body = await getRequestBody(req);
            await supplierController.createAutoOrders(req, res, body);
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