const http = require('http');
const url = require('url');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const authController = require('./controllers/authController');

const { accountantRoutes } = require('./routes/accountantRoutes');
const { handleAppointmentRoutes } = require('./routes/appointmentRoutes');
const { handleCalendarRoutes } = require('./routes/calendarRoutes');
const { handleVehicleRoutes } = require('./routes/vehicleRoutes');
const adminRoutes = require('./routes/adminRoute');
const inventoryRoutes = require('./routes/inventoryRoutes');
const { handleSupplierRoutes } = require('./routes/supplierRoutes');
const { handleManagerRoutes } = require('./routes/managerRoutes');

const PORT = process.env.PORT;

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        if (pathname.startsWith('/admin')) {
            return adminRoutes(req, res);
        }

        // Inventory routes
        if (pathname.startsWith('/inventory')) {
            return inventoryRoutes(req, res);
        }

        if (pathname === '/' || pathname === '/homepage') {
            await serveFile(res, 'frontend/pages/homepage.html', 'text/html');
        }
        else if (pathname === '/register') {
            await serveFile(res, 'frontend/pages/register.html', 'text/html');
        }
        else if (pathname === '/login') {
            await serveFile(res, 'frontend/pages/login.html', 'text/html');
        }
        else if (pathname === '/suppliers') {
            await serveFile(res, 'frontend/pages/suppliers.html', 'text/html');
        }
        else if (pathname === '/client/dashboard' || pathname === '/dashboard') {
            await serveFile(res, 'frontend/pages/dashboard.html', 'text/html');
        }
        else if (pathname === '/manager/dashboard') {
            await serveFile(res, 'frontend/pages/manager-dashboard.html', 'text/html');
        }
        else if (pathname === '/accountant/dashboard') {
            await serveFile(res, 'frontend/pages/accountant-dashboard.html', 'text/html');
        }
        else if (pathname === '/schedule') {
            await serveFile(res, 'frontend/pages/schedule.html', 'text/html');
        }

        //fisierele statice
        else if (pathname.startsWith('/css/')) {
            await serveFile(res, `frontend${pathname}`, 'text/css');
        }
        else if (pathname.startsWith('/js/')) {
            await serveFile(res, `frontend${pathname}`, 'application/javascript');
        }
        else if (pathname.startsWith('/images/') || pathname.startsWith('/assets/')) {
            await serveFile(res, `frontend${pathname}`, getImageMimeType(pathname));
        }

        //api routes
        else if (pathname.startsWith('/api/')) {
            await handleApiRoutes(req, res, pathname, method, parsedUrl.query);
        }
        else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Internal server error' }));
    }
});

async function handleApiRoutes(req, res, pathname, method, queryParams) {
    try {
        // Auth routes
        if (pathname === '/api/auth/register' && method === 'POST') {
            try {
                const body = await getRequestBody(req);
                await authController.register(req, res, body);
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid JSON in request body'
                }));
            }
        }
        else if (pathname === '/api/auth/register-request' && method === 'POST') {
            try {
                const body = await getRequestBody(req);
                await authController.submitRegistrationRequest(req, res, body);
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid JSON in request body'
                }));
            }
        }
        else if (pathname === '/api/auth/login' && method === 'POST') {
            try {
                const body = await getRequestBody(req);
                await authController.login(req, res, body);
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid JSON in request body'
                }));
            }
        }
        else if (pathname.startsWith('/api/accountant')) {

            req.query = queryParams || {};
            return await accountantRoutes(req, res);
        }
        else if (pathname.startsWith('/api/manager')) {
            await handleManagerRoutes(req, res);
        }
        else if (pathname.startsWith('/api/appointments')) {
            await handleAppointmentRoutes(req, res);
        }
        else if (pathname.startsWith('/api/calendar')) {
            await handleCalendarRoutes(req, res);
        }
        else if (pathname.startsWith('/api/vehicles')) {
            await handleVehicleRoutes(req, res);
        }
        else if (pathname.startsWith('/api/suppliers') || pathname.startsWith('/api/orders') || pathname.startsWith('/api/parts')) {
            await handleSupplierRoutes(req, res);
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'API route not found' }));
        }

    } catch (error) {
        console.error('API route error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error in API route',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }));
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
                // Check if body is empty
                if (!body.trim()) {
                    resolve({});
                    return;
                }
                const parsed = JSON.parse(body);
                resolve(parsed);
            } catch (error) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
        req.on('error', (error) => {
            reject(error);
        });
    });
}

async function serveFile(res, filePath, contentType) {
    try {
        const data = await fs.readFile(path.join(__dirname, filePath));
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (error) {
        console.error('File serve error:', error);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
    }
}

function getImageMimeType(pathname) {
    const ext = path.extname(pathname).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});