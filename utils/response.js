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
 * @param {Object} errors - Erorile de validare (opțional)
 */
function sendError(res, statusCode, message, errors = null) {
    const response = {
        success: false,
        message: message
    };

    if (errors) {
        response.errors = errors;
    }

    sendJSON(res, statusCode, response);
}

/**
 * Trimite răspuns pentru cerere invalidă (400)
 * @param {Object} res - Response object
 * @param {string} message - Mesajul de eroare
 * @param {Object} errors - Erorile de validare (opțional)
 */
function sendBadRequest(res, message = 'Bad Request', errors = null) {
    sendError(res, 400, message, errors);
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
    sendError(res, 401, message);
}

/**
 * Trimite răspuns de forbidden
 * @param {Object} res - Response object
 * @param {string} message - Mesajul de eroare
 */
function sendForbidden(res, message = 'Forbidden') {
    sendError(res, 403, message);
}

/**
 * Trimite răspuns de not found
 * @param {Object} res - Response object
 * @param {string} message - Mesajul de eroare
 */
function sendNotFound(res, message = 'Not Found') {
    sendError(res, 404, message);
}

/**
 * Trimite răspuns de server error
 * @param {Object} res - Response object
 * @param {string} message - Mesajul de eroare
 */
function sendServerError(res, message = 'Internal server error') {
    sendError(res, 500, message);
}

module.exports = {
    sendJSON,
    sendSuccess,
    sendError,
    sendBadRequest,
    sendCreated,
    sendUnauthorized,
    sendForbidden,
    sendNotFound,
    sendServerError
};