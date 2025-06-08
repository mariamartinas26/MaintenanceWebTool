/**
 * Trimite un răspuns JSON cu status code și date
 * @param {Object} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Date de trimis
 */
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

/**
 * Trimite răspuns de succes
 * @param {Object} res - Response object
 * @param {Object} data - Date de trimis
 * @param {string} message - Mesaj opțional
 */
function sendSuccess(res, data, message = 'Success') {
    sendJSON(res, 200, {
        success: true,
        message,
        ...data
    });
}

/**
 * Trimite răspuns de eroare
 * @param {Object} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Mesajul de eroare
 */
function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, {
        success: false,
        message
    });
}

/**
 * Trimite răspuns pentru resurse create
 * @param {Object} res - Response object
 * @param {Object} data - Date de trimis
 * @param {string} message - Mesaj opțional
 */
function sendCreated(res, data, message = 'Created successfully') {
    sendJSON(res, 201, {
        success: true,
        message,
        ...data
    });
}

module.exports = {
    sendJSON,
    sendSuccess,
    sendError,
    sendCreated
};