const http = require('http');
const url = require('url');
const fs = require('fs').promises;
const path = require('path');
const querystring = require('querystring');
require('dotenv').config();

const authController = require('./controllers/authController');
const appointmentsController = require('./controllers/appointmentsController');
const adminRoutes = require('./routes/adminRoute');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log(`${method} ${pathname}`);

    try {
        // Admin routes - IMPORTANT: Trebuie să fie înaintea API routes
        if (pathname.startsWith('/admin')) {
            return adminRoutes(req, res);
        }

        // API Routes (client routes)
        if (pathname.startsWith('/api/')) {
            await handleApiRoutes(req, res, pathname, method, parsedUrl.query);
        }
        // Static file routes
        else if (pathname === '/' || pathname === '/homepage') {
            await serveFile(res, 'frontend/pages/homepage.html', 'text/html');
        }
        else if (pathname === '/register') {
            await serveFile(res, 'frontend/pages/register.html', 'text/html');
        }
        else if (pathname === '/login') {
            await serveFile(res, 'frontend/pages/login.html', 'text/html');
        }
        // Static assets
        else if (pathname.startsWith('/css/')) {
            await serveFile(res, `frontend${pathname}`, 'text/css');
        }
        else if (pathname.startsWith('/js/')) {
            await serveFile(res, `frontend${pathname}`, 'application/javascript');
        }
        else if (pathname.startsWith('/images/') || pathname.startsWith('/assets/')) {
            await serveFile(res, `frontend${pathname}`, getImageMimeType(pathname));
        }
        else if (pathname === '/client/dashboard' || pathname === '/dashboard') {
            await serveFile(res, 'frontend/pages/dashboard.html', 'text/html');
        }
        else if (pathname === '/schedule') {
            await serveFile(res, 'frontend/pages/schedule.html', 'text/html');
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
    // Auth routes
    if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await getRequestBody(req);
        await authController.register(req, res, body);
    }
    else if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await getRequestBody(req);
        await authController.login(req, res, body);
    }

    // Appointments routes (client)
    else if (pathname === '/api/appointments' && method === 'GET') {
        await appointmentsController.getAppointments(req, res);
    }
    else if (pathname === '/api/appointments' && method === 'POST') {
        const body = await getRequestBody(req);
        await appointmentsController.createAppointment(req, res, body);
    }
    else if (pathname.startsWith('/api/appointments/') && method === 'PUT') {
        const appointmentId = pathname.split('/')[3];
        const body = await getRequestBody(req);
        await appointmentsController.updateAppointment(req, res, appointmentId, body);
    }
    else if (pathname.startsWith('/api/appointments/') && method === 'DELETE') {
        const appointmentId = pathname.split('/')[3];
        await appointmentsController.updateAppointment(req, res, appointmentId, { status: 'cancelled' });
    }

    // Calendar routes
    else if (pathname === '/api/calendar/available-slots' && method === 'GET') {
        await appointmentsController.getAvailableSlots(req, res, queryParams);
    }

    // Vehicles routes
    else if (pathname === '/api/vehicles' && method === 'GET') {
        await appointmentsController.getUserVehicles(req, res);
    }

    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'API route not found' }));
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
                resolve(JSON.parse(body));
            } catch (error) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

async function serveFile(res, filePath, contentType) {
    try {
        const data = await fs.readFile(path.join(__dirname, filePath));
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (error) {
        console.error('Error serving file:', filePath, error);
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
    console.log(`Admin dashboard available at: http://localhost:${PORT}/admin`);
    console.log(`Client dashboard available at: http://localhost:${PORT}/dashboard`);
});