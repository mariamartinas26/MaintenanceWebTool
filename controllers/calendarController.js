const CalendarModel = require('../models/calendarModel');
const { sendSuccess, sendError } = require('../utils/response');

class CalendarController {
    /**
     * GET /api/calendar/available-slots - gets available slots for a date
     */
    static async getAvailableSlots(req, res, queryParams) {
        try {
            const { date } = queryParams;

            // Validate date
            CalendarController.validateDate(date);

            // Check if it is weekend
            const requestedDate = new Date(date);
            const dayOfWeek = requestedDate.getDay();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                return sendSuccess(res, {
                    date: date,
                    availableSlots: [],
                    message: 'We do not work on weekends'
                }, 'We do not work on weekends');
            }

            // Ensure slots exist for this date
            await CalendarController.ensureSlotsExistForDate(date);

            // Get available slots
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

            sendSuccess(res, result, 'Available slots loaded successfully');

        } catch (error) {
            if (error.message.includes('Date is necessary') ||
                error.message.includes('You can not schedule an appointment in the past')) {
                return sendError(res, 400, error.message);
            }

            sendError(res, 500, 'Error retrieving available slots');
        }
    }

    /**
     * GET /api/calendar/slot-availability - checks availability for a specific slot
     */
    static async checkSlotAvailability(req, res, queryParams) {
        try {
            const { date, time } = queryParams;

            if (!date || !time) {
                return sendError(res, 400, 'Date and hour are necessary');
            }

            // Ensure slots exist for this date
            await CalendarController.ensureSlotsExistForDate(date);

            const slot = await CalendarModel.getSlotByDateTime(date, time);

            let availability;

            if (!slot) {
                availability = {
                    available: false,
                    reason: 'Slot does not exist'
                };
            } else if (!slot.is_available) {
                availability = {
                    available: false,
                    reason: 'Slot not available'
                };
            } else if (slot.current_appointments >= slot.max_appointments) {
                availability = {
                    available: false,
                    reason: 'Slot fully booked'
                };
            } else {
                availability = {
                    available: true,
                    slot: slot,
                    availableSpots: slot.max_appointments - slot.current_appointments
                };
            }

            sendSuccess(res, availability, 'Slot availability checked');

        } catch (error) {
            sendError(res, 500, 'Error checking slot availability');
        }
    }

    /**
     * Validates date
     */
    static validateDate(date) {
        if (!date) {
            throw new Error('Date is necessary');
        }

        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestedDate < today) {
            throw new Error('You can not schedule an appointment in the past');
        }
    }

    /**
     * Creates slots for a date if they don't exist
     */
    static async ensureSlotsExistForDate(date) {
        const existingCount = await CalendarModel.getSlotsCountForDate(date);

        if (existingCount > 0) {
            return;
        }

        // Check if it is weekend
        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return;
        }

        // Create slots for working day
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