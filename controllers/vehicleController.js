const VehicleModel = require('../models/vehicleModel');
const { getUserIdFromToken } = require('../utils/authUtils');
const { sendSuccess, sendError, sendCreated } = require('../utils/response');

class VehicleController {
    /**
     * GET /api/vehicles - Get user vehicles
     */
    static async getUserVehicles(req, res) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }
            const vehicles = await VehicleModel.getUserVehicles(userId);

            sendSuccess(res, { vehicles }, 'Vehicles loaded successfully');

        } catch (error) {
            sendError(res, 500, 'Error retrieving vehicles');
        }
    }

    /**
     * POST /api/vehicles - Create a new vehicle
     */
    static async createVehicle(req, res, body) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            // Validate data
            VehicleController.validateVehicleData(body);

            const vehicle = await VehicleModel.createVehicle(userId, body);

            sendCreated(res, { vehicle }, 'Vehicle created successfully');

        } catch (error) {
            sendError(res, 500, 'Error creating vehicle');
        }
    }

    /**
     * PUT /api/vehicles/:id - Update an existing vehicle
     */
    static async updateVehicle(req, res, vehicleId, body) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            // Check if vehicle belongs to user
            const vehicleExists = await VehicleModel.checkVehicleOwnership(userId, parseInt(vehicleId));
            if (!vehicleExists) {
                return sendError(res, 404, 'Vehicle not found or does not belong to you');
            }

            // Validate data
            VehicleController.validateVehicleData(body);

            const vehicle = await VehicleModel.updateVehicle(userId, parseInt(vehicleId), body);

            if (!vehicle) {
                return sendError(res, 500, 'Vehicle could not be updated');
            }

            sendSuccess(res, { vehicle }, 'Vehicle updated successfully');

        } catch (error) {
            sendError(res, 500, 'Error updating vehicle');
        }
    }

    /**
     * DELETE /api/vehicles/:id - Delete a vehicle
     */
    static async deleteVehicle(req, res, vehicleId) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            // Check if vehicle belongs to user
            const vehicleExists = await VehicleModel.checkVehicleOwnership(userId, parseInt(vehicleId));
            if (!vehicleExists) {
                return sendError(res, 404, 'Vehicle not found or does not belong to you');
            }

            // Check if vehicle is not used in active appointments
            const inUse = await VehicleModel.checkVehicleInUse(parseInt(vehicleId));
            if (inUse) {
                return sendError(res, 400, 'Cannot delete vehicle because it is used in active appointments');
            }

            const deletedVehicle = await VehicleModel.deleteVehicle(userId, parseInt(vehicleId));

            if (!deletedVehicle) {
                return sendError(res, 500, 'Vehicle could not be deleted');
            }

            sendSuccess(res, {}, 'Vehicle deleted successfully');

        } catch (error) {
            sendError(res, 500, 'Error deleting vehicle');
        }
    }

    /**
     * GET /api/vehicles/:id - Get a specific vehicle
     */
    static async getVehicleById(req, res, vehicleId) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const vehicle = await VehicleModel.getVehicleById(userId, parseInt(vehicleId));

            if (!vehicle) {
                return sendError(res, 404, 'Vehicle not found');
            }

            sendSuccess(res, { vehicle }, 'Vehicle found');

        } catch (error) {
            sendError(res, 500, 'Error retrieving vehicle');
        }
    }

    /**
     * GET /api/vehicles/stats - Get user vehicle statistics
     */
    static async getUserVehicleStats(req, res) {
        try {
            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const statsRows = await VehicleModel.getUserVehicleStats(userId);

            const stats = {
                total: 0,
                totalElectric: 0,
                byType: {}
            };

            statsRows.forEach(row => {
                const count = parseInt(row.count);
                const electricCount = parseInt(row.electric_count);

                stats.total += count;
                stats.totalElectric += electricCount;
                stats.byType[row.vehicle_type] = {
                    total: count,
                    electric: electricCount
                };
            });

            sendSuccess(res, { stats }, 'Vehicle statistics loaded');

        } catch (error) {
            sendError(res, 500, 'Error retrieving vehicle statistics');
        }
    }

    /**
     * Validate vehicle data
     */
    static validateVehicleData(vehicleData) {
        const { vehicle_type, brand, model, year } = vehicleData;

        if (!vehicle_type || !brand || !model || !year) {
            throw new Error('Vehicle type, brand, model and year are required');
        }


        const validTypes = ['motocicleta', 'bicicleta', 'trotineta'];
        if (!validTypes.includes(vehicle_type)) {
            throw new Error('Vehicle type must be: motocicleta, bicicleta or trotineta');
        }

        // Validate year
        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear + 1) {
            throw new Error(`Year must be between 1900 and ${currentYear + 1}`);
        }

        // Validate string lengths
        if (brand.length > 100) {
            throw new Error('Brand cannot be longer than 100 characters');
        }

        if (model.length > 100) {
            throw new Error('Model cannot be longer than 100 characters');
        }
    }
}

module.exports = VehicleController;