const SupplierModel = require('../models/supplierModel');

class SupplierController {

    async getAllSuppliers(req, res, query = {}) {
        try {
            const suppliers = await SupplierModel.getAllSuppliers(query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: suppliers }));

        } catch (error) {
            console.error('Error getting suppliers:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching suppliers: ' + error.message }));
        }
    }

    // Get supplier by ID
    async getSupplierById(req, res, params) {
        try {
            const { id } = params;

            if (!id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Supplier ID is required' }));
                return;
            }

            const supplier = await SupplierModel.getSupplierById(id);

            if (!supplier) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Supplier not found' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: supplier }));

        } catch (error) {
            console.error('Error getting supplier by ID:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching supplier: ' + error.message }));
        }
    }

    // Create new supplier
    async createSupplier(req, res, data) {
        try {
            // Validate required fields
            if (!data.name || !data.contact_person || !data.email) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Name, contact person, and email are required'
                }));
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Please provide a valid email address'
                }));
                return;
            }

            // Validate delivery time
            if (data.delivery_time && (isNaN(data.delivery_time) || data.delivery_time < 1)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Delivery time must be a positive number'
                }));
                return;
            }

            const supplier = await SupplierModel.createSupplier(data);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: supplier,
                message: 'Supplier created successfully'
            }));

        } catch (error) {
            if (error.message.includes('email already exists')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error creating supplier: ' + error.message }));
            }
        }
    }

    // Update supplier
    async updateSupplier(req, res, data) {
        try {
            const { id } = data;

            if (!id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Supplier ID is required' }));
                return;
            }

            // Email validation if email is provided
            if (data.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(data.email)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Please provide a valid email address'
                    }));
                    return;
                }
            }

            // Validate delivery time if provided
            if (data.delivery_time && (isNaN(data.delivery_time) || data.delivery_time < 1)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Delivery time must be a positive number'
                }));
                return;
            }

            const supplier = await SupplierModel.updateSupplier(id, data);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: supplier,
                message: 'Supplier updated successfully'
            }));

        } catch (error) {
            console.error('Error updating supplier:', error);

            if (error.message.includes('not found')) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            } else if (error.message.includes('email already exists')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error updating supplier: ' + error.message }));
            }
        }
    }

    // Delete supplier
    async deleteSupplier(req, res, params) {
        try {
            const { id } = params;

            if (!id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Supplier ID is required' }));
                return;
            }

            await SupplierModel.deleteSupplier(id);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Supplier deleted successfully' }));

        } catch (error) {
            console.error('Error deleting supplier:', error);

            if (error.message.includes('not found')) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            } else if (error.message.includes('associated parts or orders')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error deleting supplier: ' + error.message }));
            }
        }
    }




    // Get all orders
    async getAllOrders(req, res, query = {}) {
        try {
            const orders = await SupplierModel.getAllOrders(query);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: orders }));

        } catch (error) {
            console.error('Error getting orders:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching orders: ' + error.message }));
        }
    }
    async getAllParts(req, res, query = {}) {
        try {
            const parts = await SupplierModel.getAllParts(query);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: parts,
                message: 'Parts retrieved successfully'
            }));

        } catch (error) {
            console.error('Error getting parts:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error fetching parts: ' + error.message
            }));
        }
    }

    async createOrder(req, res, data) {
        try {
            console.log('=== CREATE ORDER CONTROLLER DEBUG ===');
            console.log('Controller - Received data:', JSON.stringify(data, null, 2));

            // Validate required fields
            if (!data.supplier_id || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
                console.log('Controller - Validation failed: missing required fields');
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Supplier ID and at least one item are required'
                }));
                return;
            }

            console.log('Controller - Basic validation passed');

            // Validate supplier exists
            const supplier = await SupplierModel.getSupplierById(data.supplier_id);
            if (!supplier) {
                console.log('Controller - Supplier not found:', data.supplier_id);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Supplier not found'
                }));
                return;
            }

            console.log('Controller - Supplier found:', supplier.company_name);

            // Validate order items
            for (let i = 0; i < data.items.length; i++) {
                const item = data.items[i];
                console.log(`Controller - Validating item ${i + 1}:`, item);

                if (!item.name || !item.quantity || !item.unit_price) {
                    console.log(`Controller - Item ${i + 1} validation failed: missing fields`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: `Item ${i + 1}: name, quantity, and unit_price are required`
                    }));
                    return;
                }

                if (isNaN(item.quantity) || item.quantity < 1) {
                    console.log(`Controller - Item ${i + 1} validation failed: invalid quantity`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: `Item ${i + 1}: quantity must be a positive number`
                    }));
                    return;
                }

                if (isNaN(item.unit_price) || item.unit_price < 0) {
                    console.log(`Controller - Item ${i + 1} validation failed: invalid unit_price`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: `Item ${i + 1}: unit_price must be a valid positive number`
                    }));
                    return;
                }
            }

            console.log('Controller - All validations passed, calling SupplierModel.createOrder');

            const order = await SupplierModel.createOrder(data);

            console.log('Controller - Order created successfully:', order.id);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: order,
                message: 'Order created successfully'
            }));

        } catch (error) {
            console.error('Controller - Error creating order:', error);
            console.error('Controller - Error stack:', error.stack);

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error creating order: ' + error.message,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }));
        }
    }

    async updateOrderStatus(req, res, data) {
        try {
            console.log('=== BACKEND DEBUG ===');
            console.log('Controller - Request data:', JSON.stringify(data, null, 2));

            const { orderId, status, actual_delivery_date, notes } = data;

            console.log('Controller - Extracted values:');
            console.log('  orderId:', orderId, 'Type:', typeof orderId);
            console.log('  status:', status);
            console.log('  actual_delivery_date:', actual_delivery_date);
            console.log('  notes:', notes);

            if (!orderId || !status) {
                console.log('Controller - Missing required fields');
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Order ID and status are required'
                }));
                return;
            }

            // Validate status
            const validStatuses = ['ordered', 'confirmed', 'in_transit', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
                console.log('Controller - Invalid status:', status);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
                }));
                return;
            }

            console.log('Controller - Calling SupplierModel.updateOrderStatus...');

            // POSIBILĂ PROBLEMĂ: Convertește orderId la număr pentru backend
            const numericOrderId = parseInt(orderId);
            if (isNaN(numericOrderId)) {
                throw new Error(`Invalid order ID: ${orderId}`);
            }
            console.log('Controller - Using numeric order ID:', numericOrderId);

            const order = await SupplierModel.updateOrderStatus(numericOrderId, status, actual_delivery_date, notes);

            console.log('Controller - Model returned:', order);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: order,
                message: `Order status updated to ${status} successfully`
            }));

        } catch (error) {
            console.error('Controller - Error updating order status:', error);
            console.error('Controller - Error stack:', error.stack);

            if (error.message.includes('not found')) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Error updating order status: ' + error.message,
                    error: error.stack
                }));
            }
        }
    }

    async getOrdersBySupplier(req, res, params) {
        try {
            const { supplierId } = params;
            await this.getAllOrders(req, res, { supplier_id: supplierId });
        } catch (error) {
            console.error('Error in getOrdersBySupplier:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching orders by supplier: ' + error.message }));
        }
    }
}

module.exports = new SupplierController();