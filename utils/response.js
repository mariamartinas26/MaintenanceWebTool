const sendJSON = (res, statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

const sendSuccess = (res, data, message = 'Success') => {
    sendJSON(res, 200, {
        success: true,
        message: message,
        ...data
    });
};

const sendCreated = (res, data, message = 'Created') => {
    sendJSON(res, 201, {
        success: true,
        message: message,
        ...data
    });
};

const sendError = (res, statusCode, message, errors = null) => {
    const response = {
        success: false,
        message: message
    };

    if (errors) {
        response.errors = errors;
    }

    sendJSON(res, statusCode, response);
};

const sendBadRequest = (res, message, errors = null) => {
    sendError(res, 400, message, errors);
};

const sendUnauthorized = (res, message = 'Unauthorized') => {
    sendError(res, 401, message);
};

const sendServerError = (res, message = 'Internal server error') => {
    sendError(res, 500, message);
};

module.exports = {
    sendJSON,
    sendSuccess,
    sendCreated,
    sendError,
    sendBadRequest,
    sendUnauthorized,
    sendServerError
};