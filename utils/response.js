/**
 * Trimite răspuns JSON
 * @param {Object} res - Response object
 * @param {number} statusCode - Codul de status HTTP
 * @param {Object} data - Datele de trimis
 */
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

/**
 * Trimite răspuns de succes
 * @param {Object} res - Response object
 * @param {Object} data - Datele de trimis
 * @param {string} message - Mesajul de succes
 */
function sendSuccess(res, data = {}, message = 'Success') {
    sendJSON(res, 200, {
        success: true,
        message: message,
        ...data
    });
}

/**
 * Trimite răspuns de eroare
 * @param {Object} res - Response object
 * @param {number} statusCode - Codul de eroare
 * @param {string} message - Mesajul de eroare
 */
function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, {
        success: false,
        message: message
    });
}

/**
 * Trimite răspuns pentru resursă creată
 * @param {Object} res - Response object
 * @param {Object} data - Datele de trimis
 * @param {string} message - Mesajul de succes
 */
function sendCreated(res, data = {}, message = 'Created successfully') {
    sendJSON(res, 201, {
        success: true,
        message: message,
        ...data
    });
}

/**
 * Trimite răspuns de unauthorized
 * @param {Object} res - Response object
 * @param {string} message - Mesajul de eroare
 */
function sendUnauthorized(res, message = 'Unauthorized') {
    sendJSON(res, 401, {
        success: false,
        message: message
    });
}

/**
 * Trimite răspuns de forbidden
 * @param {Object} res - Response object
 * @param {string} message - Mesajul de eroare
 */
function sendForbidden(res, message = 'Forbidden') {
    sendJSON(res, 403, {
        success: false,
        message: message
    });
}

/**
 * Trimite răspuns de server error
 * @param {Object} res - Response object
 * @param {string} message - Mesajul de eroare
 */
function sendServerError(res, message = 'Internal server error') {
    sendJSON(res, 500, {
        success: false,
        message: message
    });
}

module.exports = {
    sendJSON,
    sendSuccess,
    sendError,
    sendCreated,
    sendUnauthorized,
    sendForbidden,
    sendServerError
};