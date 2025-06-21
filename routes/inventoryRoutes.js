const url = require('url');
const InventoryController = require('../controllers/inventoryController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Security headers helper function
function getSecurityHeaders() {
    return {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        // CSP allowing external fonts and styles
        'Content-Security-Policy': [
            "default-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
            "script-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self'"
        ].join('; '),
        // Security headers
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-XSS-Protection': '1; mode=block'
    };
}

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...getSecurityHeaders()
    });
    res.end(JSON.stringify(data));
}

function sendHTML(res, statusCode, html) {
    res.writeHead(statusCode, getSecurityHeaders());
    res.end(html);
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

const inventoryRoutes = (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method;

    req.query = query;

    if (path.startsWith('/inventory/api')) {
        return handleInventoryApiRoutes(req, res, path, method);
    }

    if (path.startsWith('/inventory')) {
        return handleInventoryPageRoutes(req, res, path, method);
    }

    return sendJSON(res, 404, {
        success: false,
        message: 'Inventory route not found'
    });
};

const handleInventoryApiRoutes = (req, res, path, method) => {
    requireAdminAccess(req, res, () => {

        // GET /inventory/api/parts - Get all parts
        if (path === '/inventory/api/parts' && method === 'GET') {
            return InventoryController.getAllParts(req, res);
        }

        // GET /inventory/api/parts/categories - Get all categories
        if (path === '/inventory/api/parts/categories' && method === 'GET') {
            return InventoryController.getCategories(req, res);
        }

        // GET /inventory/api/parts/statistics - Get inventory statistics
        if (path === '/inventory/api/parts/statistics' && method === 'GET') {
            return InventoryController.getInventoryStats(req, res);
        }

        // GET /inventory/api/parts/category/:category - Get parts by category
        if (path.match(/^\/inventory\/api\/parts\/category\/(.+)$/) && method === 'GET') {
            const matches = path.match(/^\/inventory\/api\/parts\/category\/(.+)$/);
            req.params = { category: decodeURIComponent(matches[1]) };
            return InventoryController.getPartsByCategory(req, res);
        }

        // GET /inventory/api/parts/:id - Get single part details
        if (path.match(/^\/inventory\/api\/parts\/(\d+)$/) && method === 'GET') {
            const matches = path.match(/^\/inventory\/api\/parts\/(\d+)$/);
            req.params = { id: matches[1] };
            return InventoryController.getPartById(req, res);
        }

        // PUT /inventory/api/parts/:id/stock - Update part stock
        if (path.match(/^\/inventory\/api\/parts\/(\d+)\/stock$/) && method === 'PUT') {
            const matches = path.match(/^\/inventory\/api\/parts\/(\d+)\/stock$/);
            req.params = { id: matches[1] };
            return InventoryController.updatePartStock(req, res);
        }

        // DELETE /inventory/api/parts/:id - Delete part
        if (path.match(/^\/inventory\/api\/parts\/(\d+)$/) && method === 'DELETE') {
            const matches = path.match(/^\/inventory\/api\/parts\/(\d+)$/);
            req.params = { id: matches[1] };
            return InventoryController.deletePart(req, res);
        }

        return sendJSON(res, 404, {
            success: false,
            message: 'Inventory API endpoint not found'
        });
    });
};

const handleInventoryPageRoutes = (req, res, path, method) => {
    const fs = require('fs');
    const pathModule = require('path');

    // Main inventory dashboard
    if (path === '/inventory' || path === '/inventory/' || path === '/inventory/dashboard') {
        if (method === 'GET') {
            try {
                const inventoryDashboardPath = pathModule.join(__dirname, '../frontend/pages/inventory-dashboard.html');

                if (!fs.existsSync(inventoryDashboardPath)) {
                    return sendJSON(res, 404, {
                        success: false,
                        message: 'Inventory dashboard page not found'
                    });
                }

                const html = fs.readFileSync(inventoryDashboardPath, 'utf8');
                return sendHTML(res, 200, html);
            } catch (error) {
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Error loading inventory dashboard'
                });
            }
        }
    }

    // Parts management page
    if (path === '/inventory/parts') {
        if (method === 'GET') {
            try {
                const partsPagePath = pathModule.join(__dirname, '../frontend/pages/inventory-parts.html');

                if (!fs.existsSync(partsPagePath)) {
                    return sendJSON(res, 404, {
                        success: false,
                        message: 'Parts management page not found'
                    });
                }

                const html = fs.readFileSync(partsPagePath, 'utf8');
                return sendHTML(res, 200, html);
            } catch (error) {
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Error loading parts management page'
                });
            }
        }
    }

    // Serve static files for inventory (CSS, JS, images)
    if (path.startsWith('/css/') || path.startsWith('/js/')) {
        return serveStaticFile(req, res, path);
    }

    // If no inventory page route matches
    return sendJSON(res, 404, {
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

        // Add security headers for static files too
        const staticHeaders = {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'X-Content-Type-Options': 'nosniff'
        };

        // Add CSP for HTML files
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

        // Read and serve file
        const fileContent = fs.readFileSync(fullPath);

        res.writeHead(200, staticHeaders);
        res.end(fileContent);

    } catch (error) {
        return sendJSON(res, 500, {
            success: false,
            message: 'Error serving file'
        });
    }
};

module.exports = inventoryRoutes;