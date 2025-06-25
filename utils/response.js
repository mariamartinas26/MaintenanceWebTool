/**
 * Sends JSON response
 * @param {Object} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Data to send
 */
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

/**
 * Sends success response
 * @param {Object} res - Response object
 * @param {Object} data - Data to send
 * @param {string} message - Success message
 */
function sendSuccess(res, data = {}, message = 'Success') {
    sendJSON(res, 200, {
        success: true,
        message: message,
        ...data
    });
}

/**
 * Sends error response
 * @param {Object} res - Response object
 * @param {number} statusCode - Error status code
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors (optional)
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
 * Sends bad request response (400)
 * @param {Object} res - Response object
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors (optional)
 */
function sendBadRequest(res, message = 'Bad Request', errors = null) {
    sendError(res, 400, message, errors);
}

/**
 * Sends created resource response
 * @param {Object} res - Response object
 * @param {Object} data - Data to send
 * @param {string} message - Success message
 */
function sendCreated(res, data = {}, message = 'Created successfully') {
    sendJSON(res, 201, {
        success: true,
        message: message,
        ...data
    });
}

/**
 * Sends unauthorized response
 * @param {Object} res - Response object
 * @param {string} message - Error message
 */
function sendUnauthorized(res, message = 'Unauthorized') {
    sendError(res, 401, message);
}

/**
 * Sends forbidden response
 * @param {Object} res - Response object
 * @param {string} message - Error message
 */
function sendForbidden(res, message = 'Forbidden') {
    sendError(res, 403, message);
}

/**
 * Sends not found response
 * @param {Object} res - Response object
 * @param {string} message - Error message
 */
function sendNotFound(res, message = 'Not Found') {
    sendError(res, 404, message);
}

/**
 * Sends server error response
 * @param {Object} res - Response object
 * @param {string} message - Error message
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
    sendNotFound,
    sendServerError
};