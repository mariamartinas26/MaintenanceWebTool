const url = require('url');
const AdminAppointmentsController = require('../controllers/adminAppointmentsController');
const PartsController = require('../controllers/partsController');
const SupplierController = require('../controllers/supplierController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

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
            id: securePath.sanitizeInput(req.user.id),
            email: securePath.sanitizeInput(req.user.email),
            name: securePath.sanitizeInput(`${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email),
            role: securePath.sanitizeInput(req.user.role)
        };

        next();
    } catch (error) {
        console.error('Admin access denied:', securePath.sanitizeInput(error.message));
        return securePath.sendJSON(res, 401, {
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

    const sanitizedQuery = securePath.sanitizeQuery(query);
    req.query = sanitizedQuery;

    if (path.startsWith('/admin/api')) {
        return handleAdminApiRoutes(req, res, path, method);
    }

    if (path.startsWith('/admin')) {
        return handleAdminPageRoutes(req, res, path, method);
    }

    return securePath.sendJSON(res, 404, {
        success: false,
        message: 'Admin route not found'
    });
};

const handleAdminApiRoutes = (req, res, path, method) => {
    requireAdminAccess(req, res, () => {
        securePath.setSecurityHeaders(res);

        if (path === '/admin/api/appointments' && method === 'GET') {
            return AdminAppointmentsController.getAppointmentsForAdmin(req, res);
        }

        if (path.match(/^\/admin\/api\/appointments\/(\d+)$/) && method === 'GET') {
            const matches = path.match(/^\/admin\/api\/appointments\/(\d+)$/);
            const appointmentId = securePath.validateNumericId(matches[1]);
            if (!appointmentId) {
                return securePath.sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid appointment ID'
                });
            }
            req.params = { id: appointmentId };
            return AdminAppointmentsController.getAppointmentDetails(req, res);
        }

        if (path.match(/^\/admin\/api\/appointments\/(\d+)\/status$/) && method === 'PUT') {
            const matches = path.match(/^\/admin\/api\/appointments\/(\d+)\/status$/);
            const appointmentId = securePath.validateNumericId(matches[1]);
            if (!appointmentId) {
                return securePath.sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid appointment ID'
                });
            }
            req.params = { id: appointmentId };

            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    const sanitizedBody = securePath.sanitizeObject(parsedBody);
                    req.body = sanitizedBody;
                    return AdminAppointmentsController.updateAppointmentStatus(req, res);
                } catch (error) {
                    return securePath.sendJSON(res, 400, {
                        success: false,
                        message: 'Invalid JSON in request body'
                    });
                }
            });
            return;
        }

        if (path === '/admin/api/parts' && method === 'GET') {
            return PartsController.getAllParts(req, res);
        }

        if (path.match(/^\/admin\/api\/parts\/(\d+)$/) && method === 'GET') {
            const matches = path.match(/^\/admin\/api\/parts\/(\d+)$/);
            const partId = securePath.validateNumericId(matches[1]);
            if (!partId) {
                return securePath.sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }
            req.params = { id: partId };
            return PartsController.getPartById(req, res);
        }


        return securePath.sendJSON(res, 404, {
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
                    return securePath.sendJSON(res, 404, {
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
                return securePath.sendJSON(res, 500, {
                    success: false,
                    message: 'Error loading admin dashboard'
                });
            }
        }
    }

    if (path.startsWith('/css/') || path.startsWith('/js/')) {
        return serveStaticFile(req, res, path);
    }

    return securePath.sendJSON(res, 404, {
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
            return securePath.sendJSON(res, 404, {
                success: false,
                message: 'File not found'
            });
        }

        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
            return securePath.sendJSON(res, 404, {
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
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Error serving file'
        });
    }
};

module.exports = adminRoutes;