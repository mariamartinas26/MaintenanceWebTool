// routes/adminRoute.js
const url = require('url');
const AdminAppointmentsController = require('../controllers/adminAppointmentsController');

// Helper function pentru response JSON (similar cu cea din client)
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Simple middleware to check if user is admin (adaptat la stilul tau)
const requireAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const adminToken = req.headers['x-admin-token'];

    console.log('Admin auth check - Authorization header:', authHeader);
    console.log('Admin auth check - X-Admin-Token header:', adminToken);

    // Verifică Bearer token din localStorage (compatibil cu login-ul tău)
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Aici poți adăuga validarea reală a token-ului JWT
        // Pentru acum, verifică dacă token-ul există
        if (token) {
            // Poți extrage user info din token dacă e JWT
            try {
                // Pentru testare, acceptă orice token Bearer
                // În producție, validează JWT-ul aici
                req.admin = { id: 1, role: 'admin', token: token };
                return next();
            } catch (error) {
                console.error('Error validating admin token:', error);
            }
        }
    }

    // Fallback pentru X-Admin-Token (pentru testare)
    if (adminToken) {
        req.admin = { id: 1, role: 'admin' };
        return next();
    }

    return sendJSON(res, 401, {
        success: false,
        message: 'Acces interzis. Autentificare admin necesară.'
    });
};

const adminRoutes = (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method;

    // Add query parameters to req object
    req.query = query;

    console.log(`Admin route: ${method} ${path}`);

    // Admin API routes
    if (path.startsWith('/admin/api')) {
        return handleAdminApiRoutes(req, res, path, method);
    }

    // Admin page routes (serving HTML)
    if (path.startsWith('/admin')) {
        return handleAdminPageRoutes(req, res, path, method);
    }

    // If no admin route matches, return 404
    return sendJSON(res, 404, {
        success: false,
        message: 'Ruta admin nu a fost găsită'
    });
};

const handleAdminApiRoutes = (req, res, path, method) => {
    // Apply admin middleware to all admin API routes
    requireAdmin(req, res, () => {
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

            // Parse request body for PUT requests
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    req.body = JSON.parse(body);
                    console.log('Request body parsed:', req.body);
                    return AdminAppointmentsController.updateAppointmentStatus(req, res);
                } catch (error) {
                    console.error('Error parsing JSON body:', error);
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'JSON invalid în request body'
                    });
                }
            });
            return; // Don't send response yet, wait for body parsing
        }

        // If no API route matches
        return sendJSON(res, 404, {
            success: false,
            message: 'Endpoint admin API nu a fost găsit'
        });
    });
};

const handleAdminPageRoutes = (req, res, path, method) => {
    const fs = require('fs');
    const pathModule = require('path');

    // Serve admin dashboard page
    if (path === '/admin' || path === '/admin/' || path === '/admin/dashboard') {
        if (method === 'GET') {
            try {
                // Adaptează calea la structura ta de fișiere
                const adminDashboardPath = pathModule.join(__dirname, '../frontend/pages/admin-dashboard.html');

                // Verifică dacă fișierul există
                if (!fs.existsSync(adminDashboardPath)) {
                    console.error('Admin dashboard file not found at:', adminDashboardPath);
                    return sendJSON(res, 404, {
                        success: false,
                        message: 'Pagina admin dashboard nu a fost găsită'
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
                console.error('Error serving admin dashboard:', error);
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Eroare la încărcarea admin dashboard'
                });
            }
        }
    }

    // Serve admin login page (if you have one)
    if (path === '/admin/login') {
        if (method === 'GET') {
            try {
                const loginPath = pathModule.join(__dirname, '../frontend/pages/login.html');

                if (!fs.existsSync(loginPath)) {
                    // Return a simple login form if no file exists
                    const simpleLoginHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Admin Login - Repair Queens</title>
                            <meta charset="UTF-8">
                            <style>
                                body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                                .login-form { padding: 20px; border: 1px solid #ccc; border-radius: 5px; }
                                input { display: block; margin: 10px 0; padding: 10px; width: 200px; }
                                button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
                            </style>
                        </head>
                        <body>
                            <div class="login-form">
                                <h2>Admin Login</h2>
                                <form action="/admin/auth" method="post">
                                    <input type="email" name="email" placeholder="Email" required>
                                    <input type="password" name="password" placeholder="Password" required>
                                    <button type="submit">Login</button>
                                </form>
                            </div>
                        </body>
                        </html>
                    `;

                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(simpleLoginHtml);
                    return;
                }

                const html = fs.readFileSync(loginPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            } catch (error) {
                console.error('Error serving login page:', error);
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Eroare la încărcarea paginii de login'
                });
            }
        }
    }

    // Serve static files for admin (CSS, JS, images) - adaptează la structura ta
    if (path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/assets/')) {
        return serveStaticFile(req, res, path);
    }

    // If no admin page route matches
    return sendJSON(res, 404, {
        success: false,
        message: 'Pagina admin nu a fost găsită'
    });
};

const serveStaticFile = (req, res, path) => {
    const fs = require('fs');
    const pathModule = require('path');

    try {
        // Construct full file path based on your project structure
        const fullPath = pathModule.join(__dirname, '../frontend', path);

        console.log('Trying to serve static file:', fullPath);

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            console.log('Static file not found:', fullPath);
            return sendJSON(res, 404, {
                success: false,
                message: 'Fișierul nu a fost găsit'
            });
        }

        // Get file stats
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
            return sendJSON(res, 404, {
                success: false,
                message: 'Nu este un fișier'
            });
        }

        // Determine content type based on file extension
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
        console.error('Error serving static file:', error);
        return sendJSON(res, 500, {
            success: false,
            message: 'Eroare la servirea fișierului'
        });
    }
};

module.exports = adminRoutes;