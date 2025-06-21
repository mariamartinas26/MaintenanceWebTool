const SupplierModel = require('../models/supplierModel');
const { sanitizeInput, setSecurityHeaders } = require('../middleware/auth');

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

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = sanitizeInput(email);
    return emailRegex.test(cleanEmail) && !/<|>|script/i.test(cleanEmail) ? cleanEmail : null;
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
            console.error('Error getting suppliers:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error fetching suppliers: ' + validateInput(error.message)
            });
        }
    }

    async getSupplierById(req, res, params) {
        try {
            setSecurityHeaders(res);

            const id = validateInteger(params.id, 1);

            if (!id) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid supplier ID is required'
                });
            }

            const supplier = await SupplierModel.getSupplierById(id);

            if (!supplier) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Supplier not found'
                });
            }

            const sanitizedSupplier = sanitizeSupplier(supplier);

            sendJSON(res, 200, {
                success: true,
                data: sanitizedSupplier
            });

        } catch (error) {
            console.error('Error getting supplier by ID:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error fetching supplier: ' + validateInput(error.message)
            });
        }
    }

    async createSupplier(req, res, data) {
        try {
            setSecurityHeaders(res);

            const name = validateTextLength(data.name, 2, 100);
            const contactPerson = validateTextLength(data.contact_person, 2, 100);
            const email = validateEmail(data.email);
            const phone = validateTextLength(data.phone, 5, 20);
            const address = validateTextLength(data.address, 0, 500);
            const deliveryTime = validateInteger(data.delivery_time, 1, 365);

            if (!name) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Company name is required (2-100 characters)'
                });
            }

            if (!contactPerson) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Contact person is required (2-100 characters)'
                });
            }

            if (!email) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid email address is required'
                });
            }

            if (deliveryTime === null) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Delivery time must be a number between 1-365 days'
                });
            }

            const supplierData = {
                name: name,
                contact_person: contactPerson,
                email: email,
                phone: phone || null,
                address: address || null,
                delivery_time: deliveryTime
            };

            const supplier = await SupplierModel.createSupplier(supplierData);
            const sanitizedSupplier = sanitizeSupplier(supplier);

            sendJSON(res, 201, {
                success: true,
                data: sanitizedSupplier,
                message: 'Supplier created successfully'
            });

        } catch (error) {
            console.error('Error creating supplier:', error);

            if (error.message.includes('email already exists')) {
                sendJSON(res, 400, {
                    success: false,
                    message: 'A supplier with this email already exists'
                });
            } else {
                sendJSON(res, 500, {
                    success: false,
                    message: 'Error creating supplier: ' + validateInput(error.message)
                });
            }
        }
    }

    async updateSupplier(req, res, data) {
        try {
            setSecurityHeaders(res);

            const id = validateInteger(data.id, 1);

            if (!id) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid supplier ID is required'
                });
            }

            const updateData = {};

            if (data.name) {
                const name = validateTextLength(data.name, 2, 100);
                if (name) updateData.name = name;
            }

            if (data.contact_person) {
                const contactPerson = validateTextLength(data.contact_person, 2, 100);
                if (contactPerson) updateData.contact_person = contactPerson;
            }

            if (data.email) {
                const email = validateEmail(data.email);
                if (!email) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Valid email address is required'
                    });
                }
                updateData.email = email;
            }

            if (data.phone) {
                const phone = validateTextLength(data.phone, 5, 20);
                if (phone) updateData.phone = phone;
            }

            if (data.address !== undefined) {
                const address = validateTextLength(data.address, 0, 500);
                updateData.address = address;
            }

            if (data.delivery_time) {
                const deliveryTime = validateInteger(data.delivery_time, 1, 365);
                if (deliveryTime === null) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Delivery time must be between 1-365 days'
                    });
                }
                updateData.delivery_time = deliveryTime;
            }

            if (Object.keys(updateData).length === 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'No valid fields to update'
                });
            }

            const supplier = await SupplierModel.updateSupplier(id, updateData);
            const sanitizedSupplier = sanitizeSupplier(supplier);

            sendJSON(res, 200, {
                success: true,
                data: sanitizedSupplier,
                message: 'Supplier updated successfully'
            });

        } catch (error) {
            console.error('Error updating supplier:', error);

            if (error.message.includes('not found')) {
                sendJSON(res, 404, {
                    success: false,
                    message: 'Supplier not found'
                });
            } else if (error.message.includes('email already exists')) {
                sendJSON(res, 400, {
                    success: false,
                    message: 'A supplier with this email already exists'
                });
            } else {
                sendJSON(res, 500, {
                    success: false,
                    message: 'Error updating supplier: ' + validateInput(error.message)
                });
            }
        }
    }

    async deleteSupplier(req, res, params) {
        try {
            setSecurityHeaders(res);

            const id = validateInteger(params.id, 1);

            if (!id) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid supplier ID is required'
                });
            }

            await SupplierModel.deleteSupplier(id);

            sendJSON(res, 200, {
                success: true,
                message: 'Supplier deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting supplier:', error);

            if (error.message.includes('not found')) {
                sendJSON(res, 404, {
                    success: false,
                    message: 'Supplier not found'
                });
            } else if (error.message.includes('associated parts or orders')) {
                sendJSON(res, 400, {
                    success: false,
                    message: 'Cannot delete supplier with associated parts or orders'
                });
            } else {
                sendJSON(res, 500, {
                    success: false,
                    message: 'Error deleting supplier: ' + validateInput(error.message)
                });
            }
        }
    }

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
            console.error('Error getting orders:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error fetching orders: ' + validateInput(error.message)
            });
        }
    }

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
            console.error('Error getting parts:', error);
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

                const name = validateTextLength(item.name, 1, 100);
                const quantity = validateInteger(item.quantity, 1, 10000);
                const unitPrice = validateNumber(item.unit_price, 0, 100000);

                if (!name) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: `Item ${i + 1}: name is required (1-100 characters)`
                    });
                }

                if (!quantity) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: `Item ${i + 1}: quantity must be between 1-10000`
                    });
                }

                if (unitPrice === null) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: `Item ${i + 1}: unit_price must be a valid number`
                    });
                }

                validatedItems.push({
                    name: name,
                    quantity: quantity,
                    unit_price: unitPrice,
                    description: validateTextLength(item.description, 0, 500) || ''
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
            console.error('Controller - Error creating order:', error);

            sendJSON(res, 500, {
                success: false,
                message: 'Error creating order: ' + validateInput(error.message)
            });
        }
    }

    async updateOrderStatus(req, res, data) {
        try {
            setSecurityHeaders(res);

            const orderId = validateInteger(data.orderId, 1);
            const status = validateStatus(data.status);
            const notes = validateTextLength(data.notes, 0, 1000);

            if (!orderId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid order ID is required'
                });
            }

            if (!status) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Valid status is required (ordered, confirmed, in_transit, delivered, cancelled)'
                });
            }

            let actualDeliveryDate = null;
            if (data.actual_delivery_date) {
                const date = new Date(data.actual_delivery_date);
                if (!isNaN(date.getTime())) {
                    actualDeliveryDate = data.actual_delivery_date;
                }
            }

            const order = await SupplierModel.updateOrderStatus(orderId, status, actualDeliveryDate, notes);
            const sanitizedOrder = sanitizeOrder(order);

            sendJSON(res, 200, {
                success: true,
                data: sanitizedOrder,
                message: `Order status updated to ${status} successfully`
            });

        } catch (error) {
            console.error('Controller - Error updating order status:', error);

            if (error.message.includes('not found')) {
                sendJSON(res, 404, {
                    success: false,
                    message: 'Order not found'
                });
            } else {
                sendJSON(res, 500, {
                    success: false,
                    message: 'Error updating order status: ' + validateInput(error.message)
                });
            }
        }
    }
}

module.exports = new SupplierController();