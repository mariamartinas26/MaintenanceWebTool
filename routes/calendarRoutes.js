const url = require('url');
const CalendarController = require('../controllers/calendarController');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

async function handleCalendarRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    try {
        const sanitizedQueryParams = securePath.sanitizeQuery(queryParams);

        if (method === 'GET' && path === '/api/calendar/available-slots') {
            securePath.setSecurityHeaders(res);
            await CalendarController.getAvailableSlots(req, res, sanitizedQueryParams);
        }
        else if (method === 'GET' && path === '/api/calendar/slot-availability') {
            securePath.setSecurityHeaders(res);
            await CalendarController.checkSlotAvailability(req, res, sanitizedQueryParams);
        }
        else {
            return securePath.sendJSON(res, 404, {
                success: false,
                message: 'Route not found'
            });
        }
    } catch (error) {
        console.error('Error in calendar routes:', securePath.sanitizeInput(error.message || ''));
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    handleCalendarRoutes
};