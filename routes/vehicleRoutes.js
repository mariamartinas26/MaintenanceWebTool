const url = require('url');
const vehicleController = require('../controllers/vehicleController');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

async function handleVehicleRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    const pathParts = path.split('/');
    const vehicleIdString = pathParts[3];

    let vehicleId = null;
    if (vehicleIdString && vehicleIdString !== 'stats') {
        vehicleId = securePath.validateNumericId(vehicleIdString);
        if (!vehicleId && vehicleIdString) {
            return securePath.sendJSON(res, 400, {
                success: false,
                message: 'Invalid vehicle ID'
            });
        }
    }

    try {
        const sanitizedQuery = securePath.sanitizeQuery(queryParams);
        req.query = sanitizedQuery;

        if (method === 'GET' && path === '/api/vehicles') {
            securePath.setSecurityHeaders(res);
            await vehicleController.getUserVehicles(req, res);
        }
        else if (method === 'GET' && path === '/api/vehicles/stats') {
            securePath.setSecurityHeaders(res);
            await vehicleController.getUserVehicleStats(req, res);
        }
        else if (method === 'GET' && vehicleId && pathParts.length === 4) {
            securePath.setSecurityHeaders(res);
            await vehicleController.getVehicleById(req, res, vehicleId);
        }
        else if (method === 'POST' && path === '/api/vehicles') {
            securePath.setSecurityHeaders(res);

            return securePath.processRequestBody(req, async (error, sanitizedBody) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 400, {
                        success: false,
                        message: securePath.sanitizeInput(error.message)
                    });
                }

                await vehicleController.createVehicle(req, res, sanitizedBody);
            });
        }
        else if (method === 'PUT' && vehicleId && pathParts.length === 4) {
            securePath.setSecurityHeaders(res);

            return securePath.processRequestBody(req, async (error, sanitizedBody) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 400, {
                        success: false,
                        message: securePath.sanitizeInput(error.message)
                    });
                }

                await vehicleController.updateVehicle(req, res, vehicleId, sanitizedBody);
            });
        }
        else if (method === 'DELETE' && vehicleId && pathParts.length === 4) {
            securePath.setSecurityHeaders(res);
            await vehicleController.deleteVehicle(req, res, vehicleId);
        }
        else {
            return securePath.sendJSON(res, 404, {
                success: false,
                message: 'Route not found'
            });
        }
    } catch (error) {
        console.error('Error in vehicle routes:', securePath.sanitizeInput(error.message || ''));
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    handleVehicleRoutes
};