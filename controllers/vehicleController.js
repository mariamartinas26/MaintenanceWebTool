const VehicleModel = require('../models/vehicleModel');
const { getUserIdFromToken } = require('../middleware/auth');
const { sendSuccess, sendError, sendCreated } = require('../utils/response');
const { setSecurityHeaders } = require('../middleware/auth');
const {validateVehicleData, sanitizeUserInput} = require('../utils/validation');

class VehicleController {
    static async getUserVehicles(req, res) {
        try {
            setSecurityHeaders(res);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            //toate vehiculele utilizatorului
            const vehicles = await VehicleModel.getUserVehicles(userId);

            sendSuccess(res, {
                vehicles: vehicles,
                total: vehicles.length
            }, 'Vehicles loaded successfully');

        } catch (error) {
            sendError(res, 500, 'Error retrieving vehicles');
        }
    }

    static async createVehicle(req, res, body) {
        try {
            setSecurityHeaders(res);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const sanitizedData = sanitizeUserInput(body);

            const validationResult = validateVehicleData(sanitizedData);

            if (!validationResult.isValid) {
                return sendError(res, 400, validationResult.errors.join('; '));
            }

            //pregatim datele pt bd
            const vehicleData = {
                vehicle_type: sanitizedData.vehicle_type,
                brand: sanitizedData.brand,
                model: sanitizedData.model,
                year: parseInt(sanitizedData.year),
                is_electric: Boolean(sanitizedData.is_electric),
                notes: sanitizedData.notes || null
            };

            //inseram vehicul nou in bd
            const vehicle = await VehicleModel.createVehicle(userId, vehicleData);

            sendCreated(res, { vehicle: vehicle }, 'Vehicle created successfully');

        } catch (error) {
            sendError(res, 500, 'Error creating vehicle');
        }
    }
}

module.exports = VehicleController;