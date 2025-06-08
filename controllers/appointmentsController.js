// Acest fișier înlocuiește vechiul appointmentsController.js
const appointmentService = require('../services/appointmentService');
const { getUserIdFromToken } = require('../utils/authUtils');
const { sendSuccess, sendError, sendCreated } = require('../utils/response');

/**
 * GET /api/appointments - Obține programările utilizatorului
 */
async function getAppointments(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Invalid or missing token');
        }
        const appointments = await appointmentService.getUserAppointments(userId);

        sendSuccess(res, { appointments }, 'Programările au fost încărcate cu succes');

    } catch (error) {
        console.error('Error getting appointments:', error);
        sendError(res, 500, 'Eroare la obținerea programărilor');
    }
}

/**
 * POST /api/appointments - Creează o programare nouă
 */
async function createAppointment(req, res, body) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Invalid or missing token');
        }

        const appointment = await appointmentService.createAppointment(userId, body);

        console.log('Appointment created successfully:', appointment);

        sendCreated(res, { appointment }, 'Appointment created successfully!');

    } catch (error) {
        console.error('Error creating appointment:', error);

        // Trimite mesajul de eroare specific din service
        if (error.message.includes('Data, ora și descrierea sunt obligatorii') ||
            error.message.includes('Descrierea trebuie să conțină') ||
            error.message.includes('Data și ora programării trebuie să fie în viitor') ||
            error.message.includes('Ai deja o programare activă') ||
            error.message.includes('Nu există sloturi disponibile') ||
            error.message.includes('Acest slot este complet ocupat')) {
            return sendError(res, 400, error.message);
        }

        sendError(res, 500, 'Eroare la crearea programării');
    }
}

/**
 * PUT /api/appointments/:id - Actualizează statusul unei programări
 */
async function updateAppointment(req, res, appointmentId, body) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Invalid or missing token');
        }

        const { status } = body;

        // Doar anularea este permisă pentru clienți
        if (status !== 'cancelled') {
            return sendError(res, 400, 'You can only cancel the appointment');
        }

        await appointmentService.cancelAppointment(userId, appointmentId);

        sendSuccess(res, {}, 'Programarea a fost anulată cu succes');

    } catch (error) {
        console.error('Error updating appointment:', error);

        // Trimite mesajul de eroare specific din service
        if (error.message.includes('Programarea nu a fost găsită') ||
            error.message.includes('Programarea este deja anulată') ||
            error.message.includes('Nu poți anula o programare completată') ||
            error.message.includes('Nu poți anula programarea cu mai puțin de')) {
            return sendError(res, 400, error.message);
        }

        if (error.message.includes('Programarea nu a fost găsită')) {
            return sendError(res, 404, error.message);
        }

        sendError(res, 500, 'Eroare la actualizarea programării');
    }
}

module.exports = {
    getAppointments,
    createAppointment,
    updateAppointment
};