const vehicleService = require('../services/vehicleService');
const { getUserIdFromToken } = require('../utils/authUtils');
const { sendSuccess, sendError, sendCreated } = require('../utils/response');

/**
 * GET /api/vehicles - Obține vehiculele utilizatorului
 */
async function getUserVehicles(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Token invalid sau lipsă');
        }

        console.log(`Getting vehicles for user ID: ${userId}`);

        const vehicles = await vehicleService.getUserVehicles(userId);

        console.log(`Found ${vehicles.length} vehicles for user ${userId}`);

        sendSuccess(res, { vehicles }, 'Vehiculele au fost încărcate cu succes');

    } catch (error) {
        console.error('Error getting vehicles:', error);
        sendError(res, 500, 'Eroare la obținerea vehiculelor');
    }
}

/**
 * POST /api/vehicles - Creează un vehicul nou
 */
async function createVehicle(req, res, body) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Token invalid sau lipsă');
        }

        console.log('Creating vehicle with data:', body);
        console.log('For user ID:', userId);

        const vehicle = await vehicleService.createVehicle(userId, body);

        console.log('Vehicle created successfully:', vehicle);

        sendCreated(res, { vehicle }, 'Vehiculul a fost creat cu succes');

    } catch (error) {
        console.error('Error creating vehicle:', error);

        // Trimite mesajul de eroare specific din service
        if (error.message.includes('sunt obligatorii') ||
            error.message.includes('Tipul vehiculului trebuie să fie') ||
            error.message.includes('Anul trebuie să fie') ||
            error.message.includes('nu poate avea mai mult de')) {
            return sendError(res, 400, error.message);
        }

        sendError(res, 500, 'Eroare la crearea vehiculului');
    }
}

/**
 * PUT /api/vehicles/:id - Actualizează un vehicul existent
 */
async function updateVehicle(req, res, vehicleId, body) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Token invalid sau lipsă');
        }

        console.log(`Updating vehicle ${vehicleId} for user ${userId}`);

        const vehicle = await vehicleService.updateVehicle(userId, parseInt(vehicleId), body);

        console.log('Vehicle updated successfully:', vehicle);

        sendSuccess(res, { vehicle }, 'Vehiculul a fost actualizat cu succes');

    } catch (error) {
        console.error('Error updating vehicle:', error);

        // Trimite mesajul de eroare specific din service
        if (error.message.includes('nu a fost găsit') ||
            error.message.includes('nu îți aparține') ||
            error.message.includes('sunt obligatorii') ||
            error.message.includes('Tipul vehiculului trebuie să fie') ||
            error.message.includes('Anul trebuie să fie') ||
            error.message.includes('nu poate avea mai mult de')) {
            return sendError(res, 400, error.message);
        }

        sendError(res, 500, 'Eroare la actualizarea vehiculului');
    }
}

/**
 * DELETE /api/vehicles/:id - Șterge un vehicul
 */
async function deleteVehicle(req, res, vehicleId) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Token invalid sau lipsă');
        }

        console.log(`Deleting vehicle ${vehicleId} for user ${userId}`);

        await vehicleService.deleteVehicle(userId, parseInt(vehicleId));

        console.log('Vehicle deleted successfully');

        sendSuccess(res, {}, 'Vehiculul a fost șters cu succes');

    } catch (error) {
        console.error('Error deleting vehicle:', error);

        // Trimite mesajul de eroare specific din service
        if (error.message.includes('nu a fost găsit') ||
            error.message.includes('nu îți aparține') ||
            error.message.includes('Nu poți șterge vehiculul')) {
            return sendError(res, 400, error.message);
        }

        sendError(res, 500, 'Eroare la ștergerea vehiculului');
    }
}

/**
 * GET /api/vehicles/:id - Obține un vehicul specific
 */
async function getVehicleById(req, res, vehicleId) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Token invalid sau lipsă');
        }

        console.log(`Getting vehicle ${vehicleId} for user ${userId}`);

        const vehicle = await vehicleService.getVehicleById(userId, parseInt(vehicleId));

        sendSuccess(res, { vehicle }, 'Vehiculul a fost găsit');

    } catch (error) {
        console.error('Error getting vehicle:', error);

        if (error.message.includes('nu a fost găsit')) {
            return sendError(res, 404, error.message);
        }

        sendError(res, 500, 'Eroare la obținerea vehiculului');
    }
}

/**
 * GET /api/vehicles/stats - Obține statistici despre vehiculele utilizatorului
 */
async function getUserVehicleStats(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendError(res, 401, 'Token invalid sau lipsă');
        }

        console.log(`Getting vehicle stats for user ${userId}`);

        const stats = await vehicleService.getUserVehicleStats(userId);

        sendSuccess(res, { stats }, 'Statisticile vehiculelor au fost încărcate');

    } catch (error) {
        console.error('Error getting vehicle stats:', error);
        sendError(res, 500, 'Eroare la obținerea statisticilor vehiculelor');
    }
}

module.exports = {
    getUserVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleById,
    getUserVehicleStats
};