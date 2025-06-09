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

    // Get all parts
    async getAllParts(req, res, query = {}) {
        try {
            const parts = await SupplierModel.getAllParts(query);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: parts }));

        } catch (error) {
            console.error('Error getting parts:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching parts: ' + error.message }));
        }
    }

    // Create part
    async createPart(req, res, data) {
        try {
            // Validate required fields
            if (!data.name || !data.price || !data.supplier_id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Name, price, and supplier ID are required'
                }));
                return;
            }

            // Validate price
            if (isNaN(data.price) || data.price < 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Price must be a valid positive number'
                }));
                return;
            }

            // Validate supplier exists
            const supplier = await SupplierModel.getSupplierById(data.supplier_id);
            if (!supplier) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Supplier not found'
                }));
                return;
            }

            const part = await SupplierModel.createPart(data);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: part,
                message: 'Part created successfully'
            }));

        } catch (error) {
            console.error('Error creating part:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error creating part: ' + error.message }));
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

    // Create order
    async createOrder(req, res, data) {
        try {
            // Validate required fields
            if (!data.supplier_id || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Supplier ID and at least one item are required'
                }));
                return;
            }

            // Validate supplier exists
            const supplier = await SupplierModel.getSupplierById(data.supplier_id);
            if (!supplier) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Supplier not found'
                }));
                return;
            }

            // Validate order items
            for (let i = 0; i < data.items.length; i++) {
                const item = data.items[i];
                if (!item.name || !item.quantity || !item.unit_price) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: `Item ${i + 1}: name, quantity, and unit_price are required`
                    }));
                    return;
                }

                if (isNaN(item.quantity) || item.quantity < 1) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: `Item ${i + 1}: quantity must be a positive number`
                    }));
                    return;
                }

                if (isNaN(item.unit_price) || item.unit_price < 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: `Item ${i + 1}: unit_price must be a valid positive number`
                    }));
                    return;
                }
            }

            const order = await SupplierModel.createOrder(data);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: order,
                message: 'Order created successfully'
            }));

        } catch (error) {
            console.error('Error creating order:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error creating order: ' + error.message }));
        }
    }

    async updateOrderStatus(req, res, data) {
        try {
            const { orderId, status, actual_delivery_date, notes } = data;

            if (!orderId || !status) {
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
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
                }));
                return;
            }

            const order = await SupplierModel.updateOrderStatus(orderId, status, actual_delivery_date, notes);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: order,
                message: `Order status updated to ${status} successfully`
            }));

        } catch (error) {
            console.error('Error updating order status:', error);

            if (error.message.includes('not found')) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error updating order status: ' + error.message }));
            }
        }
    }

    // Get supplier evaluation
    async getSupplierEvaluation(req, res, params) {
        try {
            const { supplierId } = params;

            if (!supplierId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Supplier ID is required' }));
                return;
            }

            const evaluation = await SupplierModel.calculateSupplierEvaluation(supplierId);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: evaluation }));

        } catch (error) {
            console.error('Error getting supplier evaluation:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching evaluation: ' + error.message }));
        }
    }

    // Get low stock parts
    async getLowStockParts(req, res, query = {}) {
        try {
            const parts = await SupplierModel.getAllParts({ ...query, low_stock: 'true' });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: parts }));

        } catch (error) {
            console.error('Error getting low stock parts:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching low stock parts: ' + error.message }));
        }
    }

    // Initialize sample data
    async initializeSampleData(req, res) {
        try {
            await SupplierModel.initializeSampleData();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Sample data initialized successfully'
            }));

        } catch (error) {
            console.error('Error initializing sample data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error initializing sample data: ' + error.message }));
        }
    }

    // Compatibility methods for existing routes
    async getPartsBySupplier(req, res, params) {
        try {
            const { supplierId } = params;
            await this.getAllParts(req, res, { supplier_id: supplierId });
        } catch (error) {
            console.error('Error in getPartsBySupplier:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error fetching parts by supplier: ' + error.message }));
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

    async updateSupplierEvaluation(req, res, data) {
        try {
            const { supplierId, quality, punctuality, delivery, overall } = data;

            if (!supplierId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Supplier ID is required' }));
                return;
            }

            // For now, just return success - could implement manual evaluation updates in model
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Evaluation update received (manual evaluation updates not yet implemented)'
            }));

        } catch (error) {
            console.error('Error updating supplier evaluation:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error updating evaluation: ' + error.message }));
        }
    }

    async createAutoOrders(req, res, data) {
        try {
            // Get low stock parts
            const lowStockParts = await SupplierModel.getAllParts({ low_stock: 'true' });

            if (lowStockParts.length === 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: { ordersCreated: 0 },
                    message: 'No low stock parts found'
                }));
                return;
            }

            // Group parts by supplier
            const partsBySupplier = {};
            for (const part of lowStockParts) {
                if (!partsBySupplier[part.supplier_id]) {
                    partsBySupplier[part.supplier_id] = [];
                }
                partsBySupplier[part.supplier_id].push(part);
            }

            let ordersCreated = 0;

            // Create orders for each supplier
            for (const [supplierId, parts] of Object.entries(partsBySupplier)) {
                try {
                    const supplier = await SupplierModel.getSupplierById(supplierId);
                    if (!supplier) {
                        console.warn(`Supplier ${supplierId} not found, skipping auto order`);
                        continue;
                    }

                    // Calculate delivery date
                    const expectedDeliveryDate = new Date();
                    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + (supplier.delivery_time_days || 7));

                    // Prepare order items
                    const orderItems = parts.map(part => {
                        const orderQuantity = Math.max(part.minimum_stock_level * 2, 10);
                        return {
                            name: part.name,
                            quantity: orderQuantity,
                            unit_price: part.price
                        };
                    });

                    // Create auto order
                    const orderData = {
                        supplier_id: parseInt(supplierId),
                        items: orderItems,
                        notes: 'Auto-generated order for low stock items',
                        expected_delivery_date: expectedDeliveryDate.toISOString().split('T')[0]
                    };

                    await SupplierModel.createOrder(orderData);
                    ordersCreated++;

                } catch (orderError) {
                    console.error(`Error creating auto order for supplier ${supplierId}:`, orderError);
                    // Continue with other suppliers
                }
            }

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: { ordersCreated },
                message: `${ordersCreated} auto orders created successfully`
            }));

        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error creating auto orders: ' + error.message }));
        }
    }
}

module.exports = new SupplierController();