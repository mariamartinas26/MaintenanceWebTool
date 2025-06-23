const url = require('url');
const { requireAuth } = require('../middleware/auth');
const ManagerContoller = require('../controllers/managerController');

async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
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

async function handleManagerRoutes(req, res) {
    try {
        if (!requireAuth(req, res)) {
            return;
        }

        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;
        const queryParams = parsedUrl.query;

        // GET /api/manager/requests toate cererile de conturi
        if (pathname === '/api/manager/requests' && method === 'GET') {
            req.query = queryParams || {};
            await ManagerContoller.getAccountRequests(req, res);
        }

        // POST /api/manager/requests/:id/approve aproba o cerere
        else if (pathname.startsWith('/api/manager/requests/') && pathname.endsWith('/approve') && method === 'POST') {
            const id = pathname.split('/')[4];
            req.params = { id: id };

            const body = await getRequestBody(req);
            req.body = body;

            await ManagerContoller.approveAccountRequest(req, res);
        }

        // POST /api/manager/requests/:id/reject resignem o cerere
        else if (pathname.startsWith('/api/manager/requests/') && pathname.endsWith('/reject') && method === 'POST') {
            const id = pathname.split('/')[4];
            req.params = { id: id };

            const body = await getRequestBody(req);
            req.body = body;

            await ManagerContoller.rejectAccountRequest(req, res);
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Manager API route not found'
            }));
        }

    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error in manager routes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
}

module.exports = {
    handleManagerRoutes
};