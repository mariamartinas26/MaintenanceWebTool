const CalendarModel = require('../models/calendarModel');
const { sendSuccess, sendError } = require('../utils/response');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return null;
    }

    const cleanDate = sanitizeInput(dateString.trim());

    if (cleanDate.length > 10) {
        return null;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(cleanDate)) {
        return null;
    }

    const dateParts = cleanDate.split('-').map(num => parseInt(num));
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];

    if (year < 2020 || year > 2030 || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    const date = new Date(cleanDate);
    if (isNaN(date.getTime())) {
        return null;
    }

    return cleanDate;
}

function validateTime(timeString) {
    if (!timeString || typeof timeString !== 'string') {
        return null;
    }

    const cleanTime = sanitizeInput(timeString.trim());

    if (cleanTime.length > 8) {
        return null;
    }

    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (!timeRegex.test(cleanTime)) {
        return null;
    }

    const timeParts = cleanTime.split(':').map(num => parseInt(num));
    const hour = timeParts[0];
    const minute = timeParts[1];

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
    }

    return cleanTime;
}

function validateInteger(input, min = 0, max = 100) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

class CalendarController {
    static async getAvailableSlots(req, res, queryParams) {
        try {
            setSecurityHeaders(res);

            const dateParam = validateDate(queryParams.date);

            if (!dateParam) {
                return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD');
            }

            CalendarController.validateDateRules(dateParam);

            const requestedDate = new Date(dateParam);
            const dayOfWeek = requestedDate.getDay();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                return sendSuccess(res, {
                    date: dateParam,
                    availableSlots: [],
                    message: 'We do not work on weekends'
                }, 'We do not work on weekends');
            }

            await CalendarController.ensureSlotsExistForDate(dateParam);

            const slots = await CalendarModel.getAvailableSlots(dateParam);

            const availableSlots = slots.map(row => ({
                startTime: validateInput(row.start_time),
                endTime: validateInput(row.end_time),
                availableSpots: validateInteger(row.available_spots, 0, 10),
                maxAppointments: validateInteger(row.max_appointments, 0, 10)
            }));

            const result = {
                date: dateParam,
                availableSlots: availableSlots
            };

            sendSuccess(res, result, 'Available slots loaded successfully');

        } catch (error) {
            console.error('Error in getAvailableSlots:', error);

            if (error.message.includes('Date is necessary') ||
                error.message.includes('You can not schedule an appointment in the past') ||
                error.message.includes('Date too far in the future')) {
                return sendError(res, 400, validateInput(error.message));
            }

            sendError(res, 500, 'Error retrieving available slots');
        }
    }

    static async checkSlotAvailability(req, res, queryParams) {
        try {
            setSecurityHeaders(res);

            const dateParam = validateDate(queryParams.date);
            const timeParam = validateTime(queryParams.time);

            if (!dateParam) {
                return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD');
            }

            if (!timeParam) {
                return sendError(res, 400, 'Invalid time format. Use HH:MM');
            }

            CalendarController.validateDateRules(dateParam);

            await CalendarController.ensureSlotsExistForDate(dateParam);

            const slot = await CalendarModel.getSlotByDateTime(dateParam, timeParam);

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
                const sanitizedSlot = {
                    id: slot.id,
                    date: validateInput(slot.date),
                    start_time: validateInput(slot.start_time),
                    end_time: validateInput(slot.end_time),
                    is_available: Boolean(slot.is_available),
                    max_appointments: validateInteger(slot.max_appointments, 0, 10),
                    current_appointments: validateInteger(slot.current_appointments, 0, 10)
                };

                availability = {
                    available: true,
                    slot: sanitizedSlot,
                    availableSpots: sanitizedSlot.max_appointments - sanitizedSlot.current_appointments
                };
            }

            sendSuccess(res, availability, 'Slot availability checked');

        } catch (error) {
            console.error('Error in checkSlotAvailability:', error);
            sendError(res, 500, 'Error checking slot availability');
        }
    }

    static validateDateRules(date) {
        if (!date) {
            throw new Error('Date is necessary');
        }

        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestedDate < today) {
            throw new Error('You can not schedule an appointment in the past');
        }

        const maxFutureDate = new Date();
        maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);

        if (requestedDate > maxFutureDate) {
            throw new Error('Date too far in the future (max 1 year)');
        }

        if (isNaN(requestedDate.getTime())) {
            throw new Error('Invalid date');
        }
    }

    static async ensureSlotsExistForDate(date) {
        const validDate = validateDate(date);
        if (!validDate) {
            throw new Error('Invalid date for slot creation');
        }

        const existingCount = await CalendarModel.getSlotsNumberForDate(validDate);

        if (existingCount > 0) {
            return;
        }

        const requestedDate = new Date(validDate);
        const dayOfWeek = requestedDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return;
        }

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

        const validatedWorkingHours = workingHours.map(hour => ({
            start: validateTime(hour.start) || '08:00:00',
            end: validateTime(hour.end) || '09:00:00',
            maxAppointments: validateInteger(hour.maxAppointments, 1, 10) || 2
        }));

        const { pool } = require('../database/db');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            await CalendarModel.createSlotsForDate(client, validDate, validatedWorkingHours);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async getCalendarStats(req, res) {
        try {
            setSecurityHeaders(res);

            const startDate = validateDate(req.query.startDate);
            const endDate = validateDate(req.query.endDate);

            if (!startDate || !endDate) {
                return sendError(res, 400, 'Valid start and end dates are required');
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const today = new Date();

            if (start > end) {
                return sendError(res, 400, 'Start date must be before end date');
            }

            const maxRange = 90 * 24 * 60 * 60 * 1000; // 90 days
            if (end.getTime() - start.getTime() > maxRange) {
                return sendError(res, 400, 'Date range too large (max 90 days)');
            }

            const stats = await CalendarModel.getCalendarStats(startDate, endDate);

            const sanitizedStats = {
                totalSlots: validateInteger(stats.totalSlots, 0, 10000),
                availableSlots: validateInteger(stats.availableSlots, 0, 10000),
                bookedSlots: validateInteger(stats.bookedSlots, 0, 10000),
                occupancyRate: Math.round((stats.occupancyRate || 0) * 100) / 100
            };

            sendSuccess(res, sanitizedStats, 'Calendar statistics retrieved');

        } catch (error) {
            console.error('Error in getCalendarStats:', error);
            sendError(res, 500, 'Error retrieving calendar statistics');
        }
    }

    static async updateSlotAvailability(req, res) {
        try {
            setSecurityHeaders(res);

            const slotId = validateInteger(req.params.id, 1);
            const isAvailable = Boolean(req.body.isAvailable);

            if (!slotId) {
                return sendError(res, 400, 'Invalid slot ID');
            }

            const updatedSlot = await CalendarModel.updateSlotAvailability(slotId, isAvailable);

            if (!updatedSlot) {
                return sendError(res, 404, 'Slot not found');
            }

            const sanitizedSlot = {
                id: updatedSlot.id,
                date: validateInput(updatedSlot.date),
                start_time: validateInput(updatedSlot.start_time),
                end_time: validateInput(updatedSlot.end_time),
                is_available: Boolean(updatedSlot.is_available),
                max_appointments: validateInteger(updatedSlot.max_appointments, 0, 10),
                current_appointments: validateInteger(updatedSlot.current_appointments, 0, 10)
            };

            sendSuccess(res, { slot: sanitizedSlot }, 'Slot availability updated');

        } catch (error) {
            console.error('Error in updateSlotAvailability:', error);
            sendError(res, 500, 'Error updating slot availability');
        }
    }
}

module.exports = CalendarController;