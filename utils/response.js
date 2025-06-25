function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendSuccess(res, data = {}, message = 'Success') {
    sendJSON(res, 200, {
        success: true,
        message: message,
        ...data
    });
}

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

function sendBadRequest(res, message = 'Bad Request', errors = null) {
    sendError(res, 400, message, errors);
}

function sendCreated(res, data = {}, message = 'Created successfully') {
    sendJSON(res, 201, {
        success: true,
        message: message,
        ...data
    });
}

function sendNotFound(res, message = 'Not Found') {
    sendError(res, 404, message);
}
function sendServerError(res, message = 'Internal server error') {
    sendError(res, 500, message);
}

function sendUnauthorized(res, message = 'Unauthorized') {
    sendError(res, 401, message);
}
module.exports = {
    sendJSON,
    sendSuccess,
    sendError,
    sendBadRequest,
    sendCreated,
    sendNotFound,
    sendServerError,
    sendUnauthorized
};