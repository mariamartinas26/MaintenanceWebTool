const url = require('url');
const vehicleController = require('../controllers/vehicleController');

/**
 * Gestionează rutele pentru vehicule
 */
async function handleVehicleRoutes(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const queryParams = parsedUrl.query;

    // Extrage ID-ul din path dacă există (ex: /api/vehicles/123)
    const pathParts = path.split('/');
    const vehicleId = pathParts[3]; // /api/vehicles/[id]

    try {
        if (method === 'GET' && path === '/api/vehicles') {
            // GET /api/vehicles - Obține toate vehiculele utilizatorului
            await vehicleController.getUserVehicles(req, res);
        }
        else if (method === 'GET' && path === '/api/vehicles/stats') {
            // GET /api/vehicles/stats - Obține statistici despre vehicule
            await vehicleController.getUserVehicleStats(req, res);
        }
        else if (method === 'GET' && vehicleId && pathParts.length === 4 && vehicleId !== 'stats') {
            // GET /api/vehicles/:id - Obține un vehicul specific
            await vehicleController.getVehicleById(req, res, vehicleId);
        }
        else if (method === 'POST' && path === '/api/vehicles') {
            // POST /api/vehicles - Creează un vehicul nou
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    await vehicleController.createVehicle(req, res, parsedBody);
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid JSON format'
                    }));
                }
            });
        }
        else if (method === 'PUT' && vehicleId && pathParts.length === 4) {
            // PUT /api/vehicles/:id - Actualizează un vehicul
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    await vehicleController.updateVehicle(req, res, vehicleId, parsedBody);
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid JSON format'
                    }));
                }
            });
        }
        else if (method === 'DELETE' && vehicleId && pathParts.length === 4) {
            // DELETE /api/vehicles/:id - Șterge un vehicul
            await vehicleController.deleteVehicle(req, res, vehicleId);
        }
        else {
            // Rută necunoscută
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Route not found'
            }));
        }
    } catch (error) {
        console.error('Error in vehicle routes:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error'
        }));
    }
}

module.exports = {
    handleVehicleRoutes
};