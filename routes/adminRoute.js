const url = require('url');
const AdminAppointmentsController = require('../controllers/adminAppointmentsController');
const PartsController = require('../controllers/partsController');
const SupplierController = require('../controllers/supplierController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const runMiddleware = (req, res, fn) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
};

const requireAdminAccess = async (req, res, next) => {
    try {
        await runMiddleware(req, res, verifyToken);
        await runMiddleware(req, res, requireAdmin);

        req.admin = {
            id: req.user.id,
            email: req.user.email,
            name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
            role: req.user.role
        };

        next();
    } catch (error) {
        console.error('Admin access denied:', error.message);
        return sendJSON(res, 401, {
            success: false,
            message: 'Admin access required'
        });
    }
};

const adminRoutes = (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method;

    req.query = query;

    if (path.startsWith('/admin/api')) {
        return handleAdminApiRoutes(req, res, path, method);
    }

    if (path.startsWith('/admin')) {
        return handleAdminPageRoutes(req, res, path, method);
    }

    return sendJSON(res, 404, {
        success: false,
        message: 'Admin route not found'
    });
};

const handleAdminApiRoutes = (req, res, path, method) => {
    requireAdminAccess(req, res, () => {
        // APPOINTMENTS ROUTES
        if (path === '/admin/api/appointments' && method === 'GET') {
            return AdminAppointmentsController.getAppointmentsForAdmin(req, res);
        }

        if (path === '/admin/api/appointments/statistics' && method === 'GET') {
            return AdminAppointmentsController.getAppointmentStatistics(req, res);
        }

        if (path.match(/^\/admin\/api\/appointments\/(\d+)$/) && method === 'GET') {
            const matches = path.match(/^\/admin\/api\/appointments\/(\d+)$/);
            req.params = { id: matches[1] };
            return AdminAppointmentsController.getAppointmentDetails(req, res);
        }

        if (path.match(/^\/admin\/api\/appointments\/(\d+)\/status$/) && method === 'PUT') {
            const matches = path.match(/^\/admin\/api\/appointments\/(\d+)\/status$/);
            req.params = { id: matches[1] };

            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    req.body = JSON.parse(body);
                    return AdminAppointmentsController.updateAppointmentStatus(req, res);
                } catch (error) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Invalid JSON in request body'
                    });
                }
            });
            return;
        }

        // PARTS ROUTES
        if (path === '/admin/api/parts' && method === 'GET') {
            return PartsController.getAllParts(req, res);
        }

        if (path === '/admin/api/parts/categories' && method === 'GET') {
            return PartsController.getCategories(req, res);
        }

        if (path.match(/^\/admin\/api\/parts\/(\d+)$/) && method === 'GET') {
            const matches = path.match(/^\/admin\/api\/parts\/(\d+)$/);
            req.params = { id: matches[1] };
            return PartsController.getPartById(req, res);
        }

        // ORDERS ROUTES
        if (path === '/admin/api/orders' && method === 'GET') {
            return SupplierController.getAllOrders(req, res, req.query);
        }

        return sendJSON(res, 404, {
            success: false,
            message: 'Admin API endpoint not found'
        });
    });
};

const handleAdminPageRoutes = (req, res, path, method) => {
    const fs = require('fs');
    const pathModule = require('path');

    if (path === '/admin' || path === '/admin/' || path === '/admin/dashboard') {
        if (method === 'GET') {
            try {
                const adminDashboardPath = pathModule.join(__dirname, '../frontend/pages/admin-dashboard.html');

                if (!fs.existsSync(adminDashboardPath)) {
                    return sendJSON(res, 404, {
                        success: false,
                        message: 'Admin dashboard page not found'
                    });
                }

                const html = fs.readFileSync(adminDashboardPath, 'utf8');

                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                });
                res.end(html);
                return;
            } catch (error) {
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Error loading admin dashboard'
                });
            }
        }
    }

    if (path === '/admin/login') {
        if (method === 'GET') {
            try {
                const loginPath = pathModule.join(__dirname, '../frontend/pages/login.html');

                const html = fs.readFileSync(loginPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            } catch (error) {
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Error loading login page'
                });
            }
        }
    }

    // Serve static files for admin (CSS, JS, images)
    if (path.startsWith('/css/') || path.startsWith('/js/')) {
        return serveStaticFile(req, res, path);
    }

    return sendJSON(res, 404, {
        success: false,
        message: 'Admin page not found'
    });
};

const serveStaticFile = (req, res, path) => {
    const fs = require('fs');
    const pathModule = require('path');

    try {
        const fullPath = pathModule.join(__dirname, '../frontend', path);

        if (!fs.existsSync(fullPath)) {
            return sendJSON(res, 404, {
                success: false,
                message: 'File not found'
            });
        }

        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
            return sendJSON(res, 404, {
                success: false,
                message: 'File not found'
            });
        }

        const ext = pathModule.extname(fullPath).toLowerCase();
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        const fileContent = fs.readFileSync(fullPath);

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600'
        });

        res.end(fileContent);

    } catch (error) {
        return sendJSON(res, 500, {
            success: false,
            message: 'Error serving file'
        });
    }
};

module.exports = adminRoutes;