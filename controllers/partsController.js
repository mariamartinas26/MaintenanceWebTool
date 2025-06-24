const Part = require('../models/Part');
const { sanitizeInput,  setSecurityHeaders } = require('../middleware/auth');

function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateNumber(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseFloat(input);
    if (isNaN(num) || num < min || num > max) return 0;
    return num;
}

function validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function sanitizePart(part) {
    if (!part) return null;

    return {
        id: part.id,
        name: validateInput(part.name),
        description: validateInput(part.description),
        part_number: validateInput(part.part_number),
        category: validateInput(part.category),
        price: validateNumber(part.price, 0, 1000000),
        stock_quantity: validateInteger(part.stock_quantity, 0, 100000),
        minimum_stock_level: validateInteger(part.minimum_stock_level, 0, 10000),
        supplier_name: validateInput(part.supplier_name),
        supplier_contact: validateInput(part.supplier_contact),
        supplier_email: validateInput(part.supplier_email),
        supplier_phone: validateInput(part.supplier_phone),
        created_at: part.created_at,
        updated_at: part.updated_at
    };
}

function sendJSON(res, statusCode, data) {
    setSecurityHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class PartsController {
    static async getAllParts(req, res) {
        try {
            setSecurityHeaders(res);
            const availableOnly = req.query.available_only === 'true';

            const filters = {};
            if (availableOnly) {
                filters.available_only = true;
            }

            const parts = await Part.getAll(filters);

            const sanitizedParts = parts.map(sanitizePart).filter(part => part !== null);

            sendJSON(res, 200, {
                success: true,
                message: 'Parts loaded successfully',
                parts: sanitizedParts,
                total: sanitizedParts.length
            });

        } catch (error) {
            console.error('Error in getAllParts:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading parts'
            });
        }
    }

    static async getPartById(req, res) {
        try {
            setSecurityHeaders(res);

            const partId = validateInteger(req.params.id, 1);

            if (!partId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }

            const part = await Part.getById(partId);

            if (!part) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Part not found'
                });
            }

            const sanitizedPart = sanitizePart(part);

            sendJSON(res, 200, {
                success: true,
                part: sanitizedPart
            });

        } catch (error) {
            console.error('Error in getPartById:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading part details'
            });
        }
    }

}

module.exports = PartsController;