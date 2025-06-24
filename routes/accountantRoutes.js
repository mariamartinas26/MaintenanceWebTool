const url = require('url');
const accountantController = require('../controllers/accountantController');
const ImportExportController = require('../controllers/importExportController');
const { verifyToken, requireAccountant } = require('../middleware/auth');
const SecurePath = require('./SecurePath');

const securePath = new SecurePath();

const accountantRoutes = async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;

    try {
        const sanitizedQuery = securePath.sanitizeQuery(query);
        req.query = sanitizedQuery;
        //verifica tokenul
        await new Promise((resolve) => {
            verifyToken(req, res, (error) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 401, {
                        success: false,
                        message: securePath.sanitizeInput(error.message)
                    });
                } else {
                    resolve();
                }
            });
        });
        //verifica rolul
        await new Promise((resolve) => {
            requireAccountant(req, res, (error) => {
                if (error) {
                    return securePath.sendJSON(res, error.statusCode || 403, {
                        success: false,
                        message: securePath.sanitizeInput(error.message)
                    });
                } else {
                    resolve();
                }
            });
        });

        if (path === '/api/accountant/dashboard' && method === 'GET') {
            securePath.setSecurityHeaders(res);
            return await accountantController.getDashboard(req, res);
        }

        //get la suppliers
        if (path === '/api/accountant/suppliers' && method === 'GET') {
            securePath.setSecurityHeaders(res);
            return await accountantController.getSuppliers(req, res);
        }

        //rute import/export
        if (path === '/api/accountant/import' && method === 'POST') {
            securePath.setSecurityHeaders(res);
            return await parseBodyAndExecute(req, res, ImportExportController.importData);
        }
        if (path === '/api/accountant/export' && method === 'POST') {
            securePath.setSecurityHeaders(res);
            return await parseBodyAndExecute(req, res, ImportExportController.exportData);
        }
        return securePath.sendJSON(res, 404, {
            success: false,
            message: 'Route not found'
        });

    } catch (error) {
        if (!res.headersSent) {
            return securePath.sendJSON(res, 500, {
                success: false,
                message: 'Internal server error in accountant routes',
                error: process.env.NODE_ENV === 'development' ? securePath.sanitizeInput(error.message) : undefined
            });
        }
    }
};
//citeste si parseaza body ul requestului si il trimite la controller la importData()
const parseBodyAndExecute = (req, res, controllerFunction) => {
    return new Promise((resolve) => {
        securePath.processRequestBody(req, async (error, sanitizedBody) => {
            if (error) {
                return securePath.sendJSON(res, error.statusCode || 400, {
                    success: false,
                    message: securePath.sanitizeInput(error.message)
                });
            }
            try {
                req.body = sanitizedBody;
                await controllerFunction(req, res);
                resolve();
            } catch (controllerError) {
                if (!res.headersSent) {
                    return securePath.sendJSON(res, 500, {
                        success: false,
                        message: 'Controller execution error'
                    });
                }
                resolve();
            }
        });
    });
};

module.exports = {
    accountantRoutes
};