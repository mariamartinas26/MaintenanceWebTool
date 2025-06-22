const url = require('url');
const AppointmentController = require('../controllers/appointmentController');

async function handleAppointmentRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    const pathParts = path.split('/');
    const appointmentId = pathParts[3];

    try {
        if (method === 'GET' && path === '/api/appointments') {
            await AppointmentController.getAppointments(req, res);
        }
        else if (method === 'POST' && path === '/api/appointments') {
            await AppointmentController.createAppointment(req, res);
        }
        else if (method === 'PUT' && appointmentId && pathParts.length === 4) {
            await AppointmentController.updateAppointment(req, res, appointmentId);
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