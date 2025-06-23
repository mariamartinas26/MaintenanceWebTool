const VehicleModel = require('../models/vehicleModel');
const { getUserIdFromToken } = require('../middleware/auth');
const { sendSuccess, sendError, sendCreated } = require('../utils/response');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateTextLength(text, minLength = 0, maxLength = 1000) {
    if (!text || typeof text !== 'string') return null;
    const cleanText = sanitizeInput(text.trim());
    if (cleanText.length < minLength || cleanText.length > maxLength) return null;
    if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanText)) return null;
    return cleanText;
}

function validateVehicleType(type) {
    const validTypes = ['motocicleta', 'bicicleta', 'trotineta'];
    const cleanType = sanitizeInput(type);
    return validTypes.includes(cleanType) ? cleanType : null;
}

function validateYear(year) {
    const currentYear = new Date().getFullYear();
    const yearNum = validateInteger(year, 1900, currentYear + 1);
    return yearNum;
}

function sanitizeVehicle(vehicle) {
    if (!vehicle) return null;

    return {
        id: vehicle.id,
        vehicle_type: validateInput(vehicle.vehicle_type),
        brand: validateInput(vehicle.brand),
        model: validateInput(vehicle.model),
        year: validateInteger(vehicle.year, 1900, new Date().getFullYear() + 1),
        is_electric: Boolean(vehicle.is_electric),
        notes: validateInput(vehicle.notes),
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at
    };
}

class VehicleController {
    static async getUserVehicles(req, res) {
        try {
            setSecurityHeaders(res);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const vehicles = await VehicleModel.getUserVehicles(userId);
            const sanitizedVehicles = vehicles.map(sanitizeVehicle).filter(v => v !== null);

            sendSuccess(res, {
                vehicles: sanitizedVehicles,
                total: sanitizedVehicles.length
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

            const validationResult = VehicleController.validateVehicleData(body);
            if (!validationResult.isValid) {
                return sendError(res, 400, validationResult.error);
            }

            const vehicleData = {
                vehicle_type: validationResult.data.vehicle_type,
                brand: validationResult.data.brand,
                model: validationResult.data.model,
                year: validationResult.data.year,
                is_electric: Boolean(body.is_electric),
                notes: validateTextLength(body.notes, 0, 500) || null
            };

            const vehicle = await VehicleModel.createVehicle(userId, vehicleData);
            const sanitizedVehicle = sanitizeVehicle(vehicle);

            sendCreated(res, { vehicle: sanitizedVehicle }, 'Vehicle created successfully');

        } catch (error) {
            sendError(res, 500, 'Error creating vehicle');
        }
    }

    static async getVehicleById(req, res, vehicleId) {
        try {
            setSecurityHeaders(res);

            const authHeader = req.headers.authorization;
            const userId = getUserIdFromToken(authHeader);

            if (!userId) {
                return sendError(res, 401, 'Invalid or missing token');
            }

            const validVehicleId = validateInteger(vehicleId, 1);
            if (!validVehicleId) {
                return sendError(res, 400, 'Invalid vehicle ID');
            }

            const vehicle = await VehicleModel.getVehicleById(userId, validVehicleId);

            if (!vehicle) {
                return sendError(res, 404, 'Vehicle not found');
            }

            const sanitizedVehicle = sanitizeVehicle(vehicle);

            sendSuccess(res, { vehicle: sanitizedVehicle }, 'Vehicle found');

        } catch (error) {
            sendError(res, 500, 'Error retrieving vehicle');
        }
    }

    static validateVehicleData(vehicleData) {
        const errors = [];

        const vehicleType = validateVehicleType(vehicleData.vehicle_type);
        const brand = validateTextLength(vehicleData.brand, 1, 100);
        const model = validateTextLength(vehicleData.model, 1, 100);
        const year = validateYear(vehicleData.year);

        if (!vehicleType) {
            errors.push('Vehicle type must be: motocicleta, bicicleta or trotineta');
        }

        if (!brand) {
            errors.push('Brand is required and must be 1-100 characters');
        }

        if (!model) {
            errors.push('Model is required and must be 1-100 characters');
        }

        if (!year) {
            const currentYear = new Date().getFullYear();
            errors.push(`Year must be between 1900 and ${currentYear + 1}`);
        }

        if (vehicleData.notes && vehicleData.notes.length > 500) {
            errors.push('Notes cannot be longer than 500 characters');
        }

        if (errors.length > 0) {
            return {
                isValid: false,
                error: errors.join('; ')
            };
        }

        return {
            isValid: true,
            data: {
                vehicle_type: vehicleType,
                brand: brand,
                model: model,
                year: year
            }
        };
    }


}

module.exports = VehicleController;