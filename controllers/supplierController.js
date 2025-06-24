const SupplierModel = require('../models/supplierModel');
const { sanitizeInput, setSecurityHeaders } = require('../middleware/auth');
//supplier din pagina admin!!!
function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateNumber(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseFloat(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateTextLength(text, minLength = 0, maxLength = 1000) {
    if (!text || typeof text !== 'string') return null;
    const cleanText = sanitizeInput(text.trim());
    if (cleanText.length < minLength || cleanText.length > maxLength) return null;
    if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanText)) return null;
    return cleanText;
}

function validateStatus(status) {
    const validStatuses = ['ordered', 'confirmed', 'in_transit', 'delivered', 'cancelled'];
    const cleanStatus = sanitizeInput(status);
    return validStatuses.includes(cleanStatus) ? cleanStatus : null;
}

function sanitizeSupplier(supplier) {
    if (!supplier) return null;

    return {
        id: supplier.id,
        company_name: validateInput(supplier.company_name),
        contact_person: validateInput(supplier.contact_person),
        email: validateInput(supplier.email),
        phone: validateInput(supplier.phone),
        address: validateInput(supplier.address),
        delivery_time_days: validateInteger(supplier.delivery_time_days, 1, 365),
        parts_count: validateInteger(supplier.parts_count, 0, 1000000),
        orders_count: validateInteger(supplier.orders_count, 0, 100000),
        created_at: supplier.created_at,
        updated_at: supplier.updated_at
    };
}

function sanitizeOrder(order) {
    if (!order) return null;

    return {
        id: order.id,
        supplier_id: order.supplier_id,
        supplier_name: validateInput(order.supplier_name),
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date,
        actual_delivery_date: order.actual_delivery_date,
        status: validateInput(order.status),
        total_amount: validateNumber(order.total_amount, 0, 100000000),
        notes: validateInput(order.notes),
        product_name: validateInput(order.product_name),
        product_quantity: validateInteger(order.product_quantity, 0, 10000),
        product_unit_price: validateNumber(order.product_unit_price, 0, 1000000),
        items: order.items || []
    };
}

function sendJSON(res, statusCode, data) {
    setSecurityHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class SupplierController {

    // GET /api/suppliers
    async getAllSuppliers(req, res, query = {}) {
        try {
            setSecurityHeaders(res);

            const sanitizedQuery = {};
            if (query.search) {
                const search = validateTextLength(query.search, 1, 100);
                if (search) sanitizedQuery.search = search;
            }

            const suppliers = await SupplierModel.getAllSuppliers(sanitizedQuery);
            const sanitizedSuppliers = suppliers.map(sanitizeSupplier).filter(s => s !== null);

            sendJSON(res, 200, {
                success: true,
                data: sanitizedSuppliers,
                total: sanitizedSuppliers.length
            });

        } catch (error) {
            sendJSON(res, 500, {
                success: false,
                message: 'Error fetching suppliers: ' + validateInput(error.message)
            });
        }
    }

    //toate comenzile
    async getAllOrders(req, res, query = {}) {
        try {
            setSecurityHeaders(res);

            const sanitizedQuery = {};
            if (query.supplier_id) {
                const supplierId = validateInteger(query.supplier_id, 1);
                if (supplierId) sanitizedQuery.supplier_id = supplierId;
            }
            if (query.status) {
                const status = validateStatus(query.status);
                if (status) sanitizedQuery.status = status;
            }

            const orders = await SupplierModel.getAllOrders(sanitizedQuery);
            const sanitizedOrders = orders.map(sanitizeOrder).filter(o => o !== null);

            sendJSON(res, 200, {
                success: true,
                data: sanitizedOrders,
                total: sanitizedOrders.length
            });
        } catch (error) {
            sendJSON(res, 500, {
                success: false,
                message: 'Error fetching orders: ' + validateInput(error.message)
            });
        }
    }
    //toate piesele
    async getAllParts(req, res, query = {}) {
        try {
            setSecurityHeaders(res);

            const sanitizedQuery = {};
            if (query.search) {
                const search = validateTextLength(query.search, 1, 100);
                if (search) sanitizedQuery.search = search;
            }
            if (query.category) {
                const category = validateTextLength(query.category, 1, 50);
                if (category) sanitizedQuery.category = category;
            }

            const parts = await SupplierModel.getAllParts(sanitizedQuery);

            const sanitizedParts = parts.map(part => ({
                id: part.id,
                name: validateInput(part.name),
                description: validateInput(part.description),
                part_number: validateInput(part.part_number),
                category: validateInput(part.category),
                price: validateNumber(part.price, 0, 1000000),
                stock_quantity: validateInteger(part.stock_quantity, 0, 100000),
                minimum_stock_level: validateInteger(part.minimum_stock_level, 0, 100000),
                supplier_name: validateInput(part.supplier_name)
            })).filter(part => part.name);

            sendJSON(res, 200, {
                success: true,
                data: sanitizedParts,
                total: sanitizedParts.length
            });
        } catch (error) {
            sendJSON(res, 500, {
                success: false,
                message: 'Error fetching parts: ' + validateInput(error.message)
            });
        }
    }

    async createOrder(req, res, data) {
        try {
            setSecurityHeaders(res);

            const supplierId = validateInteger(data.supplier_id, 1);
            const items = Array.isArray(data.items) ? data.items : [];

            if (!supplierId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid supplier ID is required'
                });
            }

            if (!items || items.length === 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'At least one item is required'
                });
            }

            if (items.length > 100) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Maximum 100 items allowed per order'
                });
            }

            const supplier = await SupplierModel.getSupplierById(supplierId);
            if (!supplier) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Supplier not found'
                });
            }

            const validatedItems = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                const partId = validateInteger(item.part_id, 1);
                const quantity = validateInteger(item.quantity, 1, 10000);
                const unitPrice = validateNumber(item.unit_price, 0, 100000);

                if (!partId) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: `Valid part selection is required`
                    });
                }

                if (!quantity) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: `Quantity must be between 1-10000`
                    });
                }

                if (unitPrice === null) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: `unit_price must be a valid number`
                    });
                }

                //verific daca piesa exista in bd
                const part = await SupplierModel.getPartById(partId);
                if (!part) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: `part not found`
                    });
                }

                validatedItems.push({
                    part_id: partId,
                    name: part.name,
                    quantity: quantity,
                    unit_price: unitPrice,
                    description: validateTextLength(item.description, 0, 500) || part.description || ''
                });
            }

            const orderData = {
                supplier_id: supplierId,
                items: validatedItems,
                notes: validateTextLength(data.notes, 0, 1000) || null,
                expected_delivery_date: data.expected_delivery_date || null
            };

            const order = await SupplierModel.createOrder(orderData);
            const sanitizedOrder = sanitizeOrder(order);

            sendJSON(res, 201, {
                success: true,
                data: sanitizedOrder,
                message: 'Order created successfully'
            });
        } catch (error) {
            sendJSON(res, 500, {
                success: false,
                message: 'Error creating order: ' + validateInput(error.message)
            });
        }
    }

    async updateOrderStatus(req, res, data, orderId) {
        try {
            setSecurityHeaders(res);

            if (!orderId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Order ID is required'
                });
            }

            const orderIdInt = validateInteger(orderId, 1);
            if (!orderIdInt) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid order ID'
                });
            }

            if (!data || !data.status) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Status is required'
                });
            }

            const allowedStatuses = ['ordered', 'in_transit', 'delivered', 'cancelled'];
            if (!allowedStatuses.includes(data.status)) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid status. Allowed: ' + allowedStatuses.join(', ')
                });
            }

            //verific daca comanda exista
            const existingOrder = await SupplierModel.getOrderById(orderIdInt);
            if (!existingOrder) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Order not found'
                });
            }

            //actualizez statusul
            const updatedOrder = await SupplierModel.updateOrderStatus(
                orderIdInt,
                data.status,
                data.actual_delivery_date || null
            );

            sendJSON(res, 200, {
                success: true,
                data: updatedOrder,
                message: 'Order status updated successfully'
            });

        } catch (error) {
            sendJSON(res, 500, {
                success: false,
                message: 'Error updating order status: ' + validateInput(error.message)
            });
        }
    }
}

module.exports = new SupplierController();