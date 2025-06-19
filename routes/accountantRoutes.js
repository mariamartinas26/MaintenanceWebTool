const url = require('url');
const querystring = require('querystring');
const accountantController = require('../controllers/accountantController');
const { requireAccountant } = require('../middleware/auth');

const accountantRoutes = async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;

    try {
        await new Promise((resolve, reject) => {
            requireAccountant(req, res, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        // Dashboard accountant
        if (path === '/api/accountant/dashboard' && method === 'GET') {
            return await accountantController.getDashboard(req, res);
        }

        // Suppliers routes
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

        // Import/Export routes placeholder (pentru viitoare funcționalități)
        if (path === '/api/accountant/import-export' && method === 'GET') {
            return await getImportExportOptions(req, res);
        }

        // Reports routes placeholder (pentru viitoare funcționalități)
        if (path === '/api/accountant/reports' && method === 'GET') {
            return await getReports(req, res);
        }

        // Dacă nu se potrivește nicio rută
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Accountant route not found'
        }));

    } catch (error) {
        console.error('=== ERROR in accountantRoutes ===');
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error in accountant routes'
        }));
    }
};

// Helper function pentru parsarea body-ului
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
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid JSON in request body'
                }));
                resolve();
            }
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });
    });
};

// Placeholder pentru opțiuni import/export (pentru dezvoltare viitoare)
const getImportExportOptions = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!['admin', 'manager', 'accountant'].includes(userRole)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: false,
                message: 'Access denied. Import/Export access required.'
            }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: {
                availableFormats: ['json', 'csv', 'xlsx'],
                supportedEntities: ['suppliers', 'transactions', 'reports'],
                maxFileSize: '10MB',
                note: 'Import/Export functionality will be implemented here'
            },
            message: 'Import/Export options retrieved successfully'
        }));

    } catch (error) {
        console.error('Error getting import/export options:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Failed to retrieve import/export options'
        }));
    }
};

// Placeholder pentru rapoarte (pentru dezvoltare viitoare)
const getReports = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!['admin', 'manager', 'accountant'].includes(userRole)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: false,
                message: 'Access denied. Reports access required.'
            }));
        }

        // Obține date simple pentru rapoarte
        const db = require('../database/db');

        const suppliersStats = await db.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM suppliers 
            GROUP BY status
        `);

        const monthlyStats = await db.query(`
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as suppliers_added
            FROM suppliers 
            WHERE created_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: {
                suppliersByStatus: suppliersStats.rows,
                monthlySupplierGrowth: monthlyStats.rows,
                reportTypes: [
                    'suppliers_summary',
                    'monthly_activity',
                    'status_distribution',
                    'contact_analysis'
                ],
                note: 'More detailed reports will be implemented here'
            },
            message: 'Reports data retrieved successfully'
        }));

    } catch (error) {
        console.error('Error getting reports:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Failed to retrieve reports'
        }));
    }
};

module.exports = {
    accountantRoutes
};