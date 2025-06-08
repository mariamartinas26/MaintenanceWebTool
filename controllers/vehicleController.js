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

            console.log(`Getting vehicles for user ID: ${userId}`);

            const vehicles = await VehicleModel.getUserVehicles(userId);

            console.log(`Found ${vehicles.length} vehicles for user ${userId}`);

            sendSuccess(res, { vehicles }, 'Vehicles loaded successfully');

        } catch (error) {
            console.error('Error getting vehicles:', error);
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

            console.log('Creating vehicle with data:', body);
            console.log('For user ID:', userId);

            // Validate data
            VehicleController.validateVehicleData(body);

            const vehicle = await VehicleModel.createVehicle(userId, body);

            console.log('Vehicle created successfully:', vehicle);

            sendCreated(res, { vehicle }, 'Vehicle created successfully');

        } catch (error) {
            console.error('Error creating vehicle:', error);

            // Send specific error messages from validation
            if (error.message.includes('required') ||
                error.message.includes('Vehicle type must be') ||
                error.message.includes('Year must be between') ||
                error.message.includes('cannot be longer than')) {
                return sendError(res, 400, error.message);
            }

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

            console.log(`Updating vehicle ${vehicleId} for user ${userId}`);

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

            console.log('Vehicle updated successfully:', vehicle);

            sendSuccess(res, { vehicle }, 'Vehicle updated successfully');

        } catch (error) {
            console.error('Error updating vehicle:', error);

            if (error.message.includes('not found') ||
                error.message.includes('does not belong') ||
                error.message.includes('required') ||
                error.message.includes('Vehicle type must be') ||
                error.message.includes('Year must be between') ||
                error.message.includes('cannot be longer than')) {
                return sendError(res, 400, error.message);
            }

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

            console.log(`Deleting vehicle ${vehicleId} for user ${userId}`);

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

            console.log('Vehicle deleted successfully');

            sendSuccess(res, {}, 'Vehicle deleted successfully');

        } catch (error) {
            console.error('Error deleting vehicle:', error);

            if (error.message.includes('not found') ||
                error.message.includes('does not belong') ||
                error.message.includes('Cannot delete vehicle')) {
                return sendError(res, 400, error.message);
            }

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

            console.log(`Getting vehicle ${vehicleId} for user ${userId}`);

            const vehicle = await VehicleModel.getVehicleById(userId, parseInt(vehicleId));

            if (!vehicle) {
                return sendError(res, 404, 'Vehicle not found');
            }

            sendSuccess(res, { vehicle }, 'Vehicle found');

        } catch (error) {
            console.error('Error getting vehicle:', error);
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

            console.log(`Getting vehicle stats for user ${userId}`);

            const statsRows = await VehicleModel.getUserVehicleStats(userId);

            // Process results to form stats object
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
            console.error('Error getting vehicle stats:', error);
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

        // Validate vehicle type (from enum)
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