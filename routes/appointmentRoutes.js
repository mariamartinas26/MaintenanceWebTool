const url = require('url');
const AppointmentController = require('../controllers/appointmentController');

/**
 * Gestionează rutele pentru programări
 */
async function handleAppointmentRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    // Extrage ID-ul din path dacă există (ex: /api/appointments/123)
    const pathParts = path.split('/');
    const appointmentId = pathParts[3]; // /api/appointments/[id]

    try {
        if (method === 'GET' && path === '/api/appointments') {
            // GET /api/appointments - Obține toate programările utilizatorului
            await AppointmentController.getAppointments(req, res);
        }
        else if (method === 'POST' && path === '/api/appointments') {
            // POST /api/appointments - Creează o programare nouă
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    await AppointmentController.createAppointment(req, res, parsedBody);
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid JSON format'
                    }));
                }
            });
        }
        else if (method === 'PUT' && appointmentId && pathParts.length === 4) {
            // PUT /api/appointments/:id - Actualizează o programare
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    await AppointmentController.updateAppointment(req, res, appointmentId, parsedBody);
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid JSON format'
                    }));
                }
            });
        }
        else {
            // Rută necunoscută
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