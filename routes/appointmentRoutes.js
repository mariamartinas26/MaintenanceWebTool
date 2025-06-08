const url = require('url');
const AppointmentController = require('../controllers/appointmentController');

/**
 * routs for appointments
 */
async function handleAppointmentRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    //extracts id from path
    const pathParts = path.split('/');
    const appointmentId = pathParts[3]; // /api/appointments/[id]

    try {
        if (method === 'GET' && path === '/api/appointments') {
            //gets all user appointments
            await AppointmentController.getAppointments(req, res);
        }
        else if (method === 'POST' && path === '/api/appointments') {
            //creates new appointment
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
            //updates appointment
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
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Route not found'
            }));
        }
    } catch (error) {
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