const InventoryModel = require('../models/inventoryModel');

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class InventoryController {
    // GET /inventory/api/parts - Get all parts
    static async getAllParts(req, res) {
        try {
            const { category, low_stock, search, sort_by, sort_order } = req.query;

            let parts;

            // Filter by category if specified
            if (category && category !== 'all') {
                const result = await InventoryModel.getPartsByCategory(category);
                if (!result.success) {
                    return sendJSON(res, 500, {
                        success: false,
                        message: result.error
                    });
                }
                parts = result.data;
            } else {
                const result = await InventoryModel.getAllParts();
                if (!result.success) {
                    return sendJSON(res, 500, {
                        success: false,
                        message: result.error
                    });
                }
                parts = result.data;
            }

            // Filter by low stock if specified
            if (low_stock === 'true') {
                parts = parts.filter(part => part.is_low_stock === true);
            }

            // Apply search filter
            if (search && search.trim()) {
                const searchTerm = search.toLowerCase().trim();
                parts = parts.filter(part =>
                    part.name.toLowerCase().includes(searchTerm) ||
                    part.part_number.toLowerCase().includes(searchTerm) ||
                    (part.description && part.description.toLowerCase().includes(searchTerm)) ||
                    (part.supplier_name && part.supplier_name.toLowerCase().includes(searchTerm))
                );
            }

            // Sort parts
            if (sort_by) {
                const sortField = sort_by;
                const order = sort_order === 'desc' ? -1 : 1;

                parts.sort((a, b) => {
                    let aVal = a[sortField];
                    let bVal = b[sortField];

                    if (typeof aVal === 'string') {
                        aVal = aVal.toLowerCase();
                        bVal = bVal.toLowerCase();
                    }

                    if (aVal < bVal) return -1 * order;
                    if (aVal > bVal) return 1 * order;
                    return 0;
                });
            }

            // Format parts for frontend
            const formattedParts = parts.map(part => ({
                id: part.id,
                name: part.name,
                description: part.description,
                partNumber: part.part_number,
                category: part.category,
                price: parseFloat(part.price),
                stockQuantity: part.stock_quantity,
                minimumStockLevel: part.minimum_stock_level,
                isLowStock: part.is_low_stock,
                supplier: {
                    id: part.supplier_id,
                    name: part.supplier_name,
                    contact: part.supplier_contact,
                    phone: part.supplier_phone,
                    email: part.supplier_email
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

    // GET /inventory/api/parts/:id - Get single part details
    static async getPartById(req, res) {
        try {
            const partId = parseInt(req.params.id);

            if (!partId || partId <= 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }

            const result = await InventoryModel.getPartById(partId);

            if (!result.success) {
                return sendJSON(res, 404, {
                    success: false,
                    message: result.error
                });
            }

            const part = result.data;

            // Format part details
            const formattedPart = {
                id: part.id,
                name: part.name,
                description: part.description,
                partNumber: part.part_number,
                category: part.category,
                price: parseFloat(part.price),
                stockQuantity: part.stock_quantity,
                minimumStockLevel: part.minimum_stock_level,
                isLowStock: part.is_low_stock,
                supplier: {
                    id: part.supplier_id,
                    name: part.supplier_name,
                    contact: part.supplier_contact,
                    phone: part.supplier_phone,
                    email: part.supplier_email
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


    // DELETE /inventory/api/parts/:id - Delete part
    static async deletePart(req, res) {
        try {
            const partId = parseInt(req.params.id);

            if (!partId || partId <= 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }

            const result = await InventoryModel.deletePart(partId);

            if (!result.success) {
                return sendJSON(res, 400, {
                    success: false,
                    message: result.error
                });
            }

            sendJSON(res, 200, {
                success: true,
                message: result.message,
                deletedPart: {
                    id: result.data.id,
                    name: result.data.name,
                    partNumber: result.data.part_number
                }
            });

        } catch (error) {
            console.error('Error deleting part:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error deleting part'
            });
        }
    }


    // GET /inventory/api/parts/low-stock - Get parts with low stock
    static async getLowStockParts(req, res) {
        try {
            const result = await InventoryModel.getLowStockParts();

            if (!result.success) {
                return sendJSON(res, 500, {
                    success: false,
                    message: result.error
                });
            }

            // Format low stock parts
            const formattedParts = result.data.map(part => ({
                id: part.id,
                name: part.name,
                partNumber: part.part_number,
                category: part.category,
                price: parseFloat(part.price),
                stockQuantity: part.stock_quantity,
                minimumStockLevel: part.minimum_stock_level,
                supplier: {
                    id: part.supplier_id,
                    name: part.supplier_name,
                    contact: part.supplier_contact,
                    phone: part.supplier_phone,
                    email: part.supplier_email
                },
                urgency: part.stock_quantity === 0 ? 'critical' :
                    part.stock_quantity <= Math.floor(part.minimum_stock_level / 2) ? 'high' : 'medium'
            }));

            sendJSON(res, 200, {
                success: true,
                message: 'Low stock parts loaded successfully',
                parts: formattedParts,
                total: formattedParts.length
            });

        } catch (error) {
            console.error('Error getting low stock parts:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading low stock parts'
            });
        }
    }

    // GET /inventory/api/parts/categories - Get all categories
    static async getCategories(req, res) {
        try {
            const result = await InventoryModel.getCategories();

            if (!result.success) {
                return sendJSON(res, 500, {
                    success: false,
                    message: result.error
                });
            }

            sendJSON(res, 200, {
                success: true,
                message: 'Categories loaded successfully',
                categories: result.data
            });

        } catch (error) {
            console.error('Error getting categories:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading categories'
            });
        }
    }

    // GET /inventory/api/parts/category/:category - Get parts by category
    static async getPartsByCategory(req, res) {
        try {
            const category = decodeURIComponent(req.params.category);

            if (!category || !category.trim()) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Category is required'
                });
            }

            const result = await InventoryModel.getPartsByCategory(category);

            if (!result.success) {
                return sendJSON(res, 500, {
                    success: false,
                    message: result.error
                });
            }

            // Format parts
            const formattedParts = result.data.map(part => ({
                id: part.id,
                name: part.name,
                description: part.description,
                partNumber: part.part_number,
                category: part.category,
                price: parseFloat(part.price),
                stockQuantity: part.stock_quantity,
                minimumStockLevel: part.minimum_stock_level,
                isLowStock: part.is_low_stock,
                supplier: {
                    id: part.supplier_id,
                    name: part.supplier_name
                }
            }));

            sendJSON(res, 200, {
                success: true,
                message: `Parts in category "${category}" loaded successfully`,
                parts: formattedParts,
                category: category,
                total: formattedParts.length
            });

        } catch (error) {
            console.error('Error getting parts by category:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading parts by category'
            });
        }
    }
    // GET /inventory/api/parts/statistics - Get inventory statistics
    static async getInventoryStats(req, res) {
        try {
            const result = await InventoryModel.getInventoryStats();

            if (!result.success) {
                return sendJSON(res, 500, {
                    success: false,
                    message: result.error
                });
            }

            const stats = result.data;

            // Format statistics
            const formattedStats = {
                totalParts: parseInt(stats.total_parts) || 0,
                lowStockCount: parseInt(stats.low_stock_count) || 0,
                totalInventoryValue: parseFloat(stats.total_inventory_value) || 0,
                totalCategories: parseInt(stats.total_categories) || 0,
                averagePrice: parseFloat(stats.average_price) || 0,
                lowStockPercentage: stats.total_parts > 0 ?
                    ((stats.low_stock_count / stats.total_parts) * 100).toFixed(1) : '0.0'
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