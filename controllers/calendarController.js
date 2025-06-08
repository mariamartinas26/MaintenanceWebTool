const CalendarModel = require('../models/calendarModel');
const { sendSuccess, sendError } = require('../utils/response');

class CalendarController {
    /**
     * GET /api/calendar/available-slots - Obține sloturile disponibile pentru o dată
     */
    static async getAvailableSlots(req, res, queryParams) {
        try {
            const { date } = queryParams;

            console.log(`[DEBUG] Getting available slots for date: ${date}`);

            // Validare date
            CalendarController.validateDate(date);

            // Verifică dacă e weekend
            const requestedDate = new Date(date);
            const dayOfWeek = requestedDate.getDay();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                return sendSuccess(res, {
                    date: date,
                    availableSlots: [],
                    message: 'We do not work on weekends'
                }, 'Weekend - nu lucrăm');
            }

            // Asigură-te că există sloturi pentru această dată
            await CalendarController.ensureSlotsExistForDate(date);

            // Obține sloturile disponibile
            const slots = await CalendarModel.getAvailableSlots(date);

            const availableSlots = slots.map(row => ({
                startTime: row.start_time,
                endTime: row.end_time,
                availableSpots: row.available_spots,
                maxAppointments: row.max_appointments
            }));

            const result = {
                date: date,
                availableSlots: availableSlots
            };

            console.log(`[DEBUG] Found ${availableSlots.length} available slots`);

            sendSuccess(res, result, 'Sloturile disponibile au fost încărcate cu succes');

        } catch (error) {
            console.error('[ERROR] Error getting available slots:', error);

            if (error.message.includes('Date is necessary') ||
                error.message.includes('You can not schedule an appointment in the past')) {
                return sendError(res, 400, error.message);
            }

            sendError(res, 500, 'Eroare la obținerea sloturilor disponibile');
        }
    }

    /**
     * GET /api/calendar/slot-availability - Verifică disponibilitatea unui slot specific
     */
    static async checkSlotAvailability(req, res, queryParams) {
        try {
            const { date, time } = queryParams;

            if (!date || !time) {
                return sendError(res, 400, 'Date and hour are necessary');
            }

            // Asigură-te că există sloturi pentru această dată
            await CalendarController.ensureSlotsExistForDate(date);

            const slot = await CalendarModel.getSlotByDateTime(date, time);

            let availability;

            if (!slot) {
                availability = {
                    available: false,
                    reason: 'Slot inexistent'
                };
            } else if (!slot.is_available) {
                availability = {
                    available: false,
                    reason: 'Slot indisponibil'
                };
            } else if (slot.current_appointments >= slot.max_appointments) {
                availability = {
                    available: false,
                    reason: 'Slot complet ocupat'
                };
            } else {
                availability = {
                    available: true,
                    slot: slot,
                    availableSpots: slot.max_appointments - slot.current_appointments
                };
            }

            sendSuccess(res, availability, 'Disponibilitatea slot-ului a fost verificată');

        } catch (error) {
            console.error('[ERROR] Error checking slot availability:', error);
            sendError(res, 500, 'Eroare la verificarea disponibilității slot-ului');
        }
    }

    /**
     * Validează data introdusă
     */
    static validateDate(date) {
        if (!date) {
            throw new Error('Date is necessary');
        }

        // Verifică dacă data nu e în trecut
        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestedDate < today) {
            throw new Error('You can not schedule an appointment in the past');
        }
    }

    /**
     * Creează sloturile pentru o dată dacă nu există
     */
    static async ensureSlotsExistForDate(date) {
        const existingCount = await CalendarModel.getSlotsCountForDate(date);

        if (existingCount > 0) {
            return;
        }

        // Verifică dacă este weekend
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return;
        }

        // Creează sloturile pentru ziua de lucru
        const workingHours = [
            { start: '08:00:00', end: '09:00:00', maxAppointments: 2 },
            { start: '09:00:00', end: '10:00:00', maxAppointments: 2 },
            { start: '10:00:00', end: '11:00:00', maxAppointments: 2 },
            { start: '11:00:00', end: '12:00:00', maxAppointments: 2 },
            { start: '13:00:00', end: '14:00:00', maxAppointments: 2 },
            { start: '14:00:00', end: '15:00:00', maxAppointments: 2 },
            { start: '15:00:00', end: '16:00:00', maxAppointments: 2 },
            { start: '16:00:00', end: '17:00:00', maxAppointments: 2 }
        ];

        const { pool } = require('../database/db');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            await CalendarModel.createSlotsForDate(client, date, workingHours);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = CalendarController;