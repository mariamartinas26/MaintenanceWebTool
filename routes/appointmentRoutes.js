const url = require('url');
const AppointmentController = require('../controllers/appointmentController');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

async function handleAppointmentRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    try {
        const sanitizedQuery = securePath.sanitizeQuery(parsedUrl.query);
        req.query = sanitizedQuery;

        if (method === 'GET' && path === '/api/appointments') {
            securePath.setSecurityHeaders(res);
            await AppointmentController.getAppointments(req, res);
        }
        else if (method === 'POST' && path === '/api/appointments') {
            securePath.setSecurityHeaders(res);
            await AppointmentController.createAppointment(req, res);
        }
        else {
            return securePath.sendJSON(res, 404, {
                success: false,
                message: 'Route not found'
            });
        }
    } catch (error) {
        console.error('Error in appointment routes:', securePath.sanitizeInput(error.message || ''));
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    handleAppointmentRoutes
};