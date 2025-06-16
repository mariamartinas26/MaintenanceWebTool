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
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading categories'
            });
        }
    }

    static async getPartsForExport(req, res) {
        try {
            const result = await PartsController.getPartsForExportData(req);

            sendJSON(res, 200, {
                success: true,
                data: result,
                total: result.length,
                exported_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Export parts error:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to export parts data'
            });
        }
    }

    static async getPartsForExportData(req) {
        try {

            const parts = await Part.getAll({});

            return parts.map(part => ({
                id: part.id,
                name: part.name,
                description: part.description,
                part_number: part.part_number,
                category: part.category,
                price: parseFloat(part.price) || 0,
                stock_quantity: parseInt(part.stock_quantity) || 0,
                minimum_stock_level: parseInt(part.minimum_stock_level) || 0,
                supplier_name: part.supplier_name || 'Unknown Supplier',
                supplier_contact: part.supplier_contact,
                supplier_email: part.supplier_email,
                supplier_phone: part.supplier_phone,
                stock_status: part.stock_quantity <= 0 ? 'Out of Stock' :
                    part.stock_quantity <= part.minimum_stock_level ? 'Low Stock' : 'In Stock',
                stock_value: (parseFloat(part.price) || 0) * (parseInt(part.stock_quantity) || 0),
                created_at: part.created_at ? new Date(part.created_at).toLocaleString() : null,
                updated_at: part.updated_at ? new Date(part.updated_at).toLocaleString() : null
            }));

        } catch (error) {
            console.error('Error getting parts for export:', error);
            throw error;
        }
    }
}

module.exports = PartsController;