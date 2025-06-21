const Part = require('../models/Part');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

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

function validateCategory(category) {
    if (!category || typeof category !== 'string') return null;
    const cleanCategory = sanitizeInput(category.trim());
    if (cleanCategory.length > 100 || cleanCategory.length < 1) return null;
    if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanCategory)) return null;
    return cleanCategory;
}

function validateSearchTerm(search) {
    if (!search || typeof search !== 'string') return null;
    const cleanSearch = sanitizeInput(search.trim());
    if (cleanSearch.length > 100 || cleanSearch.length < 1) return null;
    if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanSearch)) return null;
    return cleanSearch;
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

            const search = validateSearchTerm(req.query.search);
            const category = validateCategory(req.query.category);
            const availableOnly = req.query.available_only === 'true';

            const filters = {};

            if (search) {
                filters.search = search;
            }

            if (category && category !== 'all') {
                filters.category = category;
            }

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

    static async getCategories(req, res) {
        try {
            setSecurityHeaders(res);

            const categories = await Part.getCategories();

            const sanitizedCategories = categories.map(category => ({
                id: category.id,
                name: validateInput(category.name),
                count: validateInteger(category.count, 0, 100000)
            }));

            sendJSON(res, 200, {
                success: true,
                categories: sanitizedCategories
            });

        } catch (error) {
            console.error('Error in getCategories:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading categories'
            });
        }
    }

    static async getPartsForExport(req, res) {
        try {
            setSecurityHeaders(res);

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

            return parts.map(part => {
                const price = validateNumber(part.price, 0, 1000000);
                const stockQuantity = validateInteger(part.stock_quantity, 0, 100000) || 0;
                const minLevel = validateInteger(part.minimum_stock_level, 0, 10000) || 0;

                let stockStatus = 'In Stock';
                if (stockQuantity <= 0) {
                    stockStatus = 'Out of Stock';
                } else if (stockQuantity <= minLevel) {
                    stockStatus = 'Low Stock';
                }

                const stockValue = Math.round((price * stockQuantity) * 100) / 100;

                return {
                    id: part.id,
                    name: validateInput(part.name) || 'Unknown Part',
                    description: validateInput(part.description) || '',
                    part_number: validateInput(part.part_number) || 'N/A',
                    category: validateInput(part.category) || 'Uncategorized',
                    price: price,
                    stock_quantity: stockQuantity,
                    minimum_stock_level: minLevel,
                    supplier_name: validateInput(part.supplier_name) || 'Unknown Supplier',
                    supplier_contact: validateInput(part.supplier_contact) || '',
                    supplier_email: validateInput(part.supplier_email) || '',
                    supplier_phone: validateInput(part.supplier_phone) || '',
                    stock_status: stockStatus,
                    stock_value: stockValue,
                    created_at: part.created_at ? new Date(part.created_at).toLocaleString() : null,
                    updated_at: part.updated_at ? new Date(part.updated_at).toLocaleString() : null
                };
            });

        } catch (error) {
            console.error('Error getting parts for export:', error);
            throw error;
        }
    }

    static async createPart(req, res) {
        try {
            setSecurityHeaders(res);

            const name = validateInput(req.body.name);
            const description = validateInput(req.body.description);
            const partNumber = validateInput(req.body.part_number);
            const category = validateCategory(req.body.category);
            const price = validateNumber(req.body.price, 0, 1000000);
            const stockQuantity = validateInteger(req.body.stock_quantity, 0, 100000);
            const minLevel = validateInteger(req.body.minimum_stock_level, 0, 10000);
            const supplierName = validateInput(req.body.supplier_name);

            if (!name || name.length < 2 || name.length > 100) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Part name must be 2-100 characters long'
                });
            }

            if (!partNumber || partNumber.length < 1 || partNumber.length > 50) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Part number must be 1-50 characters long'
                });
            }

            if (!category) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid category is required'
                });
            }

            if (price <= 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Price must be greater than 0'
                });
            }

            if (stockQuantity === null) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid stock quantity is required'
                });
            }

            const partData = {
                name,
                description: description || '',
                part_number: partNumber,
                category,
                price,
                stock_quantity: stockQuantity,
                minimum_stock_level: minLevel || 0,
                supplier_name: supplierName || 'Unknown Supplier'
            };

            const newPart = await Part.create(partData);
            const sanitizedPart = sanitizePart(newPart);

            sendJSON(res, 201, {
                success: true,
                message: 'Part created successfully',
                part: sanitizedPart
            });

        } catch (error) {
            console.error('Error in createPart:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error creating part'
            });
        }
    }

    static async updatePart(req, res) {
        try {
            setSecurityHeaders(res);

            const partId = validateInteger(req.params.id, 1);

            if (!partId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }

            const existingPart = await Part.getById(partId);
            if (!existingPart) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Part not found'
                });
            }

            const name = validateInput(req.body.name);
            const description = validateInput(req.body.description);
            const category = validateCategory(req.body.category);
            const price = validateNumber(req.body.price, 0, 1000000);
            const stockQuantity = validateInteger(req.body.stock_quantity, 0, 100000);
            const minLevel = validateInteger(req.body.minimum_stock_level, 0, 10000);

            const updateData = {};

            if (name && name.length >= 2 && name.length <= 100) {
                updateData.name = name;
            }

            if (description !== undefined) {
                updateData.description = description || '';
            }

            if (category) {
                updateData.category = category;
            }

            if (price > 0) {
                updateData.price = price;
            }

            if (stockQuantity !== null) {
                updateData.stock_quantity = stockQuantity;
            }

            if (minLevel !== null) {
                updateData.minimum_stock_level = minLevel;
            }

            if (Object.keys(updateData).length === 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'No valid fields to update'
                });
            }

            const updatedPart = await Part.update(partId, updateData);
            const sanitizedPart = sanitizePart(updatedPart);

            sendJSON(res, 200, {
                success: true,
                message: 'Part updated successfully',
                part: sanitizedPart
            });

        } catch (error) {
            console.error('Error in updatePart:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error updating part'
            });
        }
    }

    static async deletePart(req, res) {
        try {
            setSecurityHeaders(res);

            const partId = validateInteger(req.params.id, 1);

            if (!partId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid part ID'
                });
            }

            const existingPart = await Part.getById(partId);
            if (!existingPart) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Part not found'
                });
            }

            await Part.delete(partId);

            sendJSON(res, 200, {
                success: true,
                message: 'Part deleted successfully',
                deletedPart: {
                    id: partId,
                    name: validateInput(existingPart.name)
                }
            });

        } catch (error) {
            console.error('Error in deletePart:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error deleting part'
            });
        }
    }
}

module.exports = PartsController;