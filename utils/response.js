/**
 * Response utility functions for consistent API responses
 */

/**
 * Send success response
 */
function sendSuccess(res, data = null, message = 'Success') {
    const response = {
        success: true,
        message: message
    };

    if (data) {
        response.data = data;
        Object.assign(response, data);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

/**
 * Send created response (201)
 */
function sendCreated(res, data = null, message = 'Created successfully') {
    const response = {
        success: true,
        message: message
    };

    if (data) {
        response.data = data;
        Object.assign(response, data);
    }

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

/**
 * Send bad request response (400)
 */
function sendBadRequest(res, message = 'Bad Request', errors = null) {
    const response = {
        success: false,
        message: message
    };

    if (errors) {
        response.errors = Array.isArray(errors) ? errors : [errors];
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

/**
 * Send unauthorized response (401)
 */
function sendUnauthorized(res, message = 'Unauthorized') {
    const response = {
        success: false,
        message: message
    };

    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

/**
 * Send forbidden response (403)
 */
function sendForbidden(res, message = 'Forbidden') {
    const response = {
        success: false,
        message: message
    };

    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

/**
 * Send not found response (404)
 */
function sendNotFound(res, message = 'Not Found') {
    const response = {
        success: false,
        message: message
    };

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

/**
 * Send server error response (500)
 */
function sendServerError(res, message = 'Internal Server Error', error = null) {
    const response = {
        success: false,
        message: message
    };

    // Only include error details in development
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error.message;
        response.stack = error.stack;
    }

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

/**
 * Send custom status response
 */
function sendResponse(res, statusCode, success, message, data = null) {
    const response = {
        success: success,
        message: message
    };

    if (data) {
        response.data = data;
        Object.assign(response, data);
    }

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

module.exports = {
    sendSuccess,
    sendCreated,
    sendBadRequest,
    sendUnauthorized,
    sendForbidden,
    sendNotFound,
    sendServerError,
    sendResponse
};