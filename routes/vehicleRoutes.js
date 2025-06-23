const url = require('url');
const vehicleController = require('../controllers/vehicleController');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

//toate rutele vehiculelor
async function handleVehicleRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    try {
        const sanitizedQuery = securePath.sanitizeQuery(queryParams);
        req.query = sanitizedQuery;

        if (method === 'GET' && path === '/api/vehicles') {
            securePath.setSecurityHeaders(res);
            await vehicleController.getUserVehicles(req, res);
        }
        else if (method === 'POST' && path === '/api/vehicles') {
            securePath.setSecurityHeaders(res);

            try {
                const sanitizedBody = await new Promise((resolve, reject) => {
                    securePath.processRequestBody(req, (error, body) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(body);
                        }
                    });
                });
                //apelez metoda din controller
                await vehicleController.createVehicle(req, res, sanitizedBody);
            } catch (error) {
                return securePath.sendJSON(res, error.statusCode || 400, {
                    success: false,
                    message: securePath.sanitizeInput(error.message)
                });
            }
        }
        else {
            return securePath.sendJSON(res, 404, {
                success: false,
                message: 'Route not found'
            });
        }
    } catch (error) {
        return securePath.sendJSON(res, 500, {
            success: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    handleVehicleRoutes
};