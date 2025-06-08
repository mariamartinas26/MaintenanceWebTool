const calendarService = require('../services/calendarService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/calendar/available-slots - Obține sloturile disponibile pentru o dată
 */
async function getAvailableSlots(req, res, queryParams) {
    try {
        const { date } = queryParams;

        console.log(`[DEBUG] CalendarController.getAvailableSlots called for date: ${date}`);

        const result = await calendarService.getAvailableSlots(date);

        console.log(`[DEBUG] Found ${result.availableSlots?.length || 0} available slots for date ${date}`);

        sendSuccess(res, result, 'Sloturile disponibile au fost încărcate cu succes');

    } catch (error) {
        console.error('[ERROR] Error getting available slots:', error);

        // Trimite mesajul de eroare specific din service
        if (error.message.includes('Date is necessary!') ||
            error.message.includes('You can not make an appointment in the past')) {
            return sendError(res, 400, error.message);
        }

        sendError(res, 500, 'Eroare la obținerea sloturilor disponibile');
    }
}

/**
 * GET /api/calendar/slot-availability - Verifică disponibilitatea unui slot specific
 */
async function checkSlotAvailability(req, res, queryParams) {
    try {
        const { date, time } = queryParams;

        if (!date || !time) {
            return sendError(res, 400, 'Date and hour are necesarry');
        }

        const availability = await calendarService.checkSlotAvailability(date, time);

        sendSuccess(res, availability, 'Disponibilitatea slot-ului a fost verificată');

    } catch (error) {
        console.error('[ERROR] Error checking slot availability:', error);
        sendError(res, 500, 'Eroare la verificarea disponibilității slot-ului');
    }
}

module.exports = {
    getAvailableSlots,
    checkSlotAvailability
};