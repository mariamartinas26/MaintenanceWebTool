const url = require('url');
const AppointmentController = require('../controllers/appointmentController');

/**
 * Funcție helper pentru a extrage body-ul din request
 */
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

/**
 * Routes for appointments
 */
async function handleAppointmentRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    console.log(`Appointment route: ${method} ${path}`);

    // Extracts id from path
    const pathParts = path.split('/');
    const appointmentId = pathParts[3]; // /api/appointments/[id]

    try {
        if (method === 'GET' && path === '/api/appointments') {
            // Gets all user appointments
            console.log('Handling GET /api/appointments');
            await AppointmentController.getAppointments(req, res);
        }
        else if (method === 'POST' && path === '/api/appointments') {
            // Creates new appointment
            console.log('Handling POST /api/appointments');
            try {
                const body = await getRequestBody(req);
                console.log('Body extracted in routes:', body);

                // Apelează controller-ul cu body-ul deja extras
                await AppointmentController.createAppointmentWithBody(req, res, body);
            } catch (error) {
                console.error('Error extracting body in routes:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid JSON format'
                }));
            }
        }
        else if (method === 'PUT' && appointmentId && pathParts.length === 4) {
            // Updates appointment
            console.log(`Handling PUT /api/appointments/${appointmentId}`);
            try {
                const body = await getRequestBody(req);
                console.log('Body extracted for update:', body);

                await AppointmentController.updateAppointmentWithBody(req, res, appointmentId, body);
            } catch (error) {
                console.error('Error extracting body for update:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid JSON format'
                }));
            }
        }
        else {
            console.log(`Route not found: ${method} ${path}`);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Route not found'
            }));
        }
    } catch (error) {
        console.error('Error in appointment routes:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error'
        }));
    }
}

module.exports = {
    handleAppointmentRoutes
};