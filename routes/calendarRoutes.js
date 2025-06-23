const url = require('url');
const CalendarController = require('../controllers/calendarController');


async function handleCalendarRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    try {
        //GET /api/calendar/available-slots (data)
        if (method === 'GET' && path === '/api/calendar/available-slots') {
            await CalendarController.getAvailableSlots(req, res, queryParams);
        }
        else if (method === 'GET' && path === '/api/calendar/slot-availability') {
            // GET /api/calendar/slot-availability?date=YYYY-MM-DD&time=HH:MM
            await CalendarController.checkSlotAvailability(req, res, queryParams);
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
    handleCalendarRoutes
};