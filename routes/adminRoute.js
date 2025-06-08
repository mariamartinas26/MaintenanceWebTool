const url = require('url');
const AdminAppointmentsController = require('../controllers/adminAppointmentsController');
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
        // GET /admin/api/appointments - Get all appointments
        if (path === '/admin/api/appointments' && method === 'GET') {
            return AdminAppointmentsController.getAppointmentsForAdmin(req, res);
        }

        // GET /admin/api/appointments/statistics - Get appointment statistics
        if (path === '/admin/api/appointments/statistics' && method === 'GET') {
            return AdminAppointmentsController.getAppointmentStatistics(req, res);
        }

        // GET /admin/api/appointments/:id - Get single appointment details
        if (path.match(/^\/admin\/api\/appointments\/(\d+)$/) && method === 'GET') {
            const matches = path.match(/^\/admin\/api\/appointments\/(\d+)$/);
            req.params = { id: matches[1] };
            return AdminAppointmentsController.getAppointmentDetails(req, res);
        }

        // PUT /admin/api/appointments/:id/status - Update appointment status
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
                        message: 'JSON invalid in body'
                    });
                }
            });
            return;
        }

        return sendJSON(res, 404, {
            success: false,
            message: 'Endpoint admin API was not found'
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
                        message: 'Admin page dashboard was not found'
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
                    message: 'Error at loading admin dashboard'
                });
            }
        }
    }

    if (path === '/admin/login') {
        if (method === 'GET') {
            try {
                const loginPath = pathModule.join(__dirname, '../frontend/pages/login.html');

                if (!fs.existsSync(loginPath)) {
                    const redirectHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Admin Login - Repair Queens</title>
                            <meta charset="UTF-8">
                            <meta http-equiv="refresh" content="3;url=/login">
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    display: flex; 
                                    justify-content: center; 
                                    align-items: center; 
                                    height: 100vh; 
                                    margin: 0; 
                                    background-color: #f5f5f5;
                                }
                                .message-box { 
                                    padding: 30px; 
                                    border: 1px solid #ddd; 
                                    border-radius: 8px; 
                                    background: white;
                                    text-align: center;
                                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                                }
                                .btn {
                                    padding: 10px 20px; 
                                    background: #ff6b6b; 
                                    color: white; 
                                    border: none; 
                                    border-radius: 4px; 
                                    cursor: pointer;
                                    text-decoration: none;
                                    display: inline-block;
                                    margin-top: 15px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="message-box">
                                <h2>🔐 Admin Login</h2>
                                <p>To acces the admin dashboard, please login.</p>
                                <p>If you are an admin you will be automatically redirected after login.</p>
                                <a href="/login" class="btn">Go to Login Page</a>
                                <p><small>Automatic redirecting in 3 seconds...</small></p>
                            </div>
                        </body>
                        </html>
                    `;

                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(redirectHtml);
                    return;
                }

                const html = fs.readFileSync(loginPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            } catch (error) {
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Error at loading login page'
                });
            }
        }
    }

    // Serve static files for admin (CSS, JS, images)
    if (path.startsWith('/css/') || path.startsWith('/js/')) {
        return serveStaticFile(req, res, path);
    }

    // If no admin page route matches
    return sendJSON(res, 404, {
        success: false,
        message: 'Admin page was not found'
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
                message: 'File was not found'
            });
        }

        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
            return sendJSON(res, 404, {
                success: false,
                message: 'Did not find any file'
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

        // Read and serve file
        const fileContent = fs.readFileSync(fullPath);

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        });

        res.end(fileContent);

    } catch (error) {
        return sendJSON(res, 500, {
            success: false,
            message: 'Error at the file'
        });
    }
};

module.exports = adminRoutes;