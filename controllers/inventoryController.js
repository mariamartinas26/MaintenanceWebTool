const InventoryModel = require('../models/inventoryModel');
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

function sendJSON(res, statusCode, data) {
    setSecurityHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class InventoryController {
    static async getAllParts(req, res) {
        try {
            setSecurityHeaders(res);

            const lowStock = req.query.low_stock === 'true';
            let parts;

            const result = await InventoryModel.getAllParts();
            if (!result.success) {
                return sendJSON(res, 500, {
                        success: false,
                        message: validateInput(result.error)
                });
            }
            parts = result.data;

            if (lowStock) {
                parts = parts.filter(part => part.is_low_stock === true);
            }


            const formattedParts = parts.map(part => ({
                id: part.id,
                name: validateInput(part.name),
                description: validateInput(part.description),
                partNumber: validateInput(part.part_number),
                category: validateInput(part.category),
                price: validateNumber(part.price, 0, 1000000),
                stockQuantity: validateInteger(part.stock_quantity, 0, 100000),
                minimumStockLevel: validateInteger(part.minimum_stock_level, 0, 10000),
                isLowStock: Boolean(part.is_low_stock),
                supplier: {
                    id: part.supplier_id,
                    name: validateInput(part.supplier_name),
                    contact: validateInput(part.supplier_contact),
                    phone: validateInput(part.supplier_phone),
                    email: validateInput(part.supplier_email)
                },
                createdAt: part.created_at,
                updatedAt: part.updated_at
            }));

            sendJSON(res, 200, {
                success: true,
                message: 'Parts loaded successfully',
                parts: formattedParts,
                total: formattedParts.length
            });

        } catch (error) {
            console.error('Error getting all parts:', error);
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

            const result = await InventoryModel.getPartById(partId);

            if (!result.success) {
                return sendJSON(res, 404, {
                    success: false,
                    message: validateInput(result.error)
                });
            }

            const part = result.data;

            const formattedPart = {
                id: part.id,
                name: validateInput(part.name),
                description: validateInput(part.description),
                partNumber: validateInput(part.part_number),
                category: validateInput(part.category),
                price: validateNumber(part.price, 0, 1000000),
                stockQuantity: validateInteger(part.stock_quantity, 0, 100000),
                minimumStockLevel: validateInteger(part.minimum_stock_level, 0, 10000),
                isLowStock: Boolean(part.is_low_stock),
                supplier: {
                    id: part.supplier_id,
                    name: validateInput(part.supplier_name),
                    contact: validateInput(part.supplier_contact),
                    phone: validateInput(part.supplier_phone),
                    email: validateInput(part.supplier_email)
                },
                createdAt: part.created_at,
                updatedAt: part.updated_at
            };

            sendJSON(res, 200, {
                success: true,
                message: 'Part details loaded successfully',
                part: formattedPart
            });

        } catch (error) {
            console.error('Error getting part details:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading part details'
            });
        }
    }

    static async getCategories(req, res) {
        try {
            setSecurityHeaders(res);

            const result = await InventoryModel.getCategories();

            if (!result.success) {
                return sendJSON(res, 500, {
                    success: false,
                    message: validateInput(result.error)
                });
            }

            const sanitizedCategories = result.data.map(category => ({
                id: category.id,
                name: validateInput(category.name),
                count: validateInteger(category.count, 0, 100000)
            }));

            sendJSON(res, 200, {
                success: true,
                message: 'Categories loaded successfully',
                categories: sanitizedCategories
            });

        } catch (error) {
            console.error('Error getting categories:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading categories'
            });
        }
    }

    static async getInventoryStats(req, res) {
        try {
            setSecurityHeaders(res);

            const result = await InventoryModel.getInventoryStats();

            if (!result.success) {
                return sendJSON(res, 500, {
                    success: false,
                    message: validateInput(result.error)
                });
            }

            const stats = result.data;

            const totalParts = validateInteger(stats.total_parts, 0, 1000000);
            const lowStockCount = validateInteger(stats.low_stock_count, 0, 1000000);

            const formattedStats = {
                totalParts: totalParts,
                lowStockCount: lowStockCount,
                totalInventoryValue: validateNumber(stats.total_inventory_value, 0, 100000000),
                totalCategories: validateInteger(stats.total_categories, 0, 1000)
            };

            sendJSON(res, 200, {
                success: true,
                message: 'Inventory statistics loaded successfully',
                statistics: formattedStats
            });

        } catch (error) {
            console.error('Error getting inventory statistics:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading inventory statistics'
            });
        }
    }


}

module.exports = InventoryController;