const url = require('url');
const CalendarController = require('../controllers/calendarController');

/**
 * Gestionează rutele pentru calendar
 */
async function handleCalendarRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    try {
        if (method === 'GET' && path === '/api/calendar/available-slots') {
            // GET /api/calendar/available-slots?date=YYYY-MM-DD
            await CalendarController.getAvailableSlots(req, res, queryParams);
        }
        else if (method === 'GET' && path === '/api/calendar/slot-availability') {
            // GET /api/calendar/slot-availability?date=YYYY-MM-DD&time=HH:MM
            await CalendarController.checkSlotAvailability(req, res, queryParams);
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
        console.error('Error in calendar routes:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error'
        }));
    }
}

module.exports = {
    handleCalendarRoutes
};