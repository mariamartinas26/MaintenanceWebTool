const url = require('url');
const accountantController = require('../controllers/accountantController');
const { verifyToken, requireAccountant } = require('../middleware/auth');

const accountantRoutes = async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;

    try {
        // Verify token
        await new Promise((resolve, reject) => {
            verifyToken(req, res, (error) => {
                if (error) {
                    res.writeHead(error.statusCode || 401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: error.message
                    }));
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        // Verify accountant access
        await new Promise((resolve, reject) => {
            requireAccountant(req, res, (error) => {
                if (error) {
                    res.writeHead(error.statusCode || 403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: error.message
                    }));
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        if (path === '/api/accountant/dashboard' && method === 'GET') {
            return await accountantController.getDashboard(req, res);
        }

        // Supplier routes
        if (path === '/api/accountant/suppliers' && method === 'GET') {
            req.query = query;
            return await accountantController.getSuppliers(req, res);
        }

        if (path === '/api/accountant/suppliers' && method === 'POST') {
            return await parseBodyAndExecute(req, res, accountantController.addSupplier);
        }

        // Supplier by ID routes
        const supplierByIdMatch = path.match(/^\/api\/accountant\/suppliers\/(\d+)$/);
        if (supplierByIdMatch) {
            req.params = { id: supplierByIdMatch[1] };

            if (method === 'GET') {
                return await accountantController.getSupplierById(req, res);
            }

            if (method === 'PUT') {
                return await parseBodyAndExecute(req, res, accountantController.updateSupplier);
            }

            if (method === 'DELETE') {
                return await accountantController.deleteSupplier(req, res);
            }
        }

        // Export suppliers
        if (path === '/api/accountant/suppliers/export' && method === 'GET') {
            req.query = query;
            return await accountantController.exportSuppliers(req, res);
        }

        // Import suppliers
        if (path === '/api/accountant/suppliers/import' && method === 'POST') {
            return await parseBodyAndExecute(req, res, accountantController.importSuppliers);
        }

    } catch (error) {
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Internal server error in accountant routes',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            }));
        }
    }
};

const parseBodyAndExecute = (req, res, controllerFunction) => {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                if (body) {
                    req.body = JSON.parse(body);
                } else {
                    req.body = {};
                }

                await controllerFunction(req, res);
                resolve();
            } catch (error) {
                console.error('Error parsing body or executing controller:', error);
                if (!res.headersSent) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid JSON in request body'
                    }));
                }
                resolve();
            }
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });
    });
};

module.exports = {
    accountantRoutes
};