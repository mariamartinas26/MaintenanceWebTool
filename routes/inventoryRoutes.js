const url = require('url');
const InventoryController = require('../controllers/inventoryController');
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

const inventoryRoutes = (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method;

    try {
        const sanitizedQuery = securePath.sanitizeQuery(query);
        req.query = sanitizedQuery;

        if (path.startsWith('/inventory/api')) {
            return handleInventoryApiRoutes(req, res, path, method);
        }

        if (path.startsWith('/inventory')) {
            return handleInventoryPageRoutes(req, res, path, method);
        }

        return securePath.sendJSON(res, 404, {
            success: false,
            message: 'Inventory route not found'
        });
    } catch (error) {
        console.error('Error in inventory routes:', securePath.sanitizeInput(error.message || ''));
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Internal server error in inventory routes'
        });
    }
};

const handleInventoryApiRoutes = (req, res, path, method) => {
    requireAdminAccess(req, res, () => {
        securePath.setSecurityHeaders(res);

        if (path === '/inventory/api/parts' && method === 'GET') {
            return InventoryController.getAllParts(req, res);
        }

        if (path === '/inventory/api/parts/categories' && method === 'GET') {
            return InventoryController.getCategories(req, res);
        }

        if (path === '/inventory/api/parts/statistics' && method === 'GET') {
            return InventoryController.getInventoryStats(req, res);
        }


        const partByIdMatch = path.match(/^\/inventory\/api\/parts\/(\d+)$/);
        if (partByIdMatch && method === 'GET') {
            const partId = securePath.validateNumericId(partByIdMatch[1]);
            if (!partId) {
                return securePath.sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }
            req.params = { id: partId };
            return InventoryController.getPartById(req, res);
        }

        const stockUpdateMatch = path.match(/^\/inventory\/api\/parts\/(\d+)\/stock$/);
        if (stockUpdateMatch && method === 'PUT') {
            const partId = securePath.validateNumericId(stockUpdateMatch[1]);
            if (!partId) {
                return securePath.sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }
            req.params = { id: partId };
            return InventoryController.updatePartStock(req, res);
        }

        return securePath.sendJSON(res, 404, {
            success: false,
            message: 'Inventory API endpoint not found'
        });
    });
};

const handleInventoryPageRoutes = (req, res, path, method) => {
    const fs = require('fs');
    const pathModule = require('path');

    if (path === '/inventory' || path === '/inventory/' || path === '/inventory/dashboard') {
        if (method === 'GET') {
            try {
                const inventoryDashboardPath = pathModule.join(__dirname, '../frontend/pages/inventory-dashboard.html');

                if (!fs.existsSync(inventoryDashboardPath)) {
                    return securePath.sendJSON(res, 404, {
                        success: false,
                        message: 'Inventory dashboard page not found'
                    });
                }

                const html = fs.readFileSync(inventoryDashboardPath, 'utf8');
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                });
                res.end(html);
                return;
            } catch (error) {
                return securePath.sendJSON(res, 500, {
                    success: false,
                    message: 'Error loading inventory dashboard'
                });
            }
        }
    }

    if (path === '/inventory/parts') {
        if (method === 'GET') {
            try {
                const partsPagePath = pathModule.join(__dirname, '../frontend/pages/inventory-parts.html');

                if (!fs.existsSync(partsPagePath)) {
                    return securePath.sendJSON(res, 404, {
                        success: false,
                        message: 'Parts management page not found'
                    });
                }

                const html = fs.readFileSync(partsPagePath, 'utf8');
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                });
                res.end(html);
                return;
            } catch (error) {
                return securePath.sendJSON(res, 500, {
                    success: false,
                    message: 'Error loading parts management page'
                });
            }
        }
    }

    if (path.startsWith('/css/') || path.startsWith('/js/')) {
        return serveStaticFile(req, res, path);
    }

    return securePath.sendJSON(res, 404, {
        success: false,
        message: 'Inventory page not found'
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

        const staticHeaders = {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff'
        };

        if (ext === '.html') {
            staticHeaders['Content-Security-Policy'] = [
                "default-src 'self'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
                "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
                "script-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "connect-src 'self'"
            ].join('; ');
            staticHeaders['X-Frame-Options'] = 'DENY';
        }

        const fileContent = fs.readFileSync(fullPath);

        res.writeHead(200, staticHeaders);
        res.end(fileContent);

    } catch (error) {
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Error serving file'
        });
    }
};

module.exports = inventoryRoutes;