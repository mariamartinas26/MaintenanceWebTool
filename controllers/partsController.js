const Part = require('../models/Part');

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class PartsController {
    // GET /admin/api/parts - Get all parts for selection
    static async getAllParts(req, res) {
        try {
            const { search, category, available_only } = req.query;

            const filters = {};
            if (search && search.trim()) {
                filters.search = search.trim();
            }
            if (category && category !== 'all') {
                filters.category = category;
            }
            if (available_only === 'true') {
                filters.available_only = true;
            }

            const parts = await Part.getAll(filters);

            sendJSON(res, 200, {
                success: true,
                message: 'Parts loaded successfully',
                parts: parts
            });

        } catch (error) {
            console.error('Error loading parts:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading parts'
            });
        }
    }

    // GET /admin/api/parts/:id - Get single part details
    static async getPartById(req, res) {
        try {
            const partId = parseInt(req.params.id);

            if (!partId || partId <= 0) {
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

            sendJSON(res, 200, {
                success: true,
                part: part
            });

        } catch (error) {
            console.error('Error loading part details:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading part details'
            });
        }
    }

    // GET /admin/api/parts/categories - Get all categories
    static async getCategories(req, res) {
        try {
            const categories = await Part.getCategories();

            sendJSON(res, 200, {
                success: true,
                categories: categories
            });

        } catch (error) {
            console.error('Error loading categories:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading categories'
            });
        }
    }
}

module.exports = PartsController;