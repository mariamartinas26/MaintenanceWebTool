const { pool } = require('../database/db');

class SupplierModel {

    static async initializeStorage() {
        try {
            // Test connection
            const client = await pool.connect();
            client.release();
        } catch (error) {
            throw error;
        }
    }

    static async getAllSuppliers(filters = {}) {
        let query = `
            SELECT s.*,
                   COUNT(DISTINCT p.id) as parts_count,
                   COUNT(DISTINCT o.id) as orders_count
            FROM "Suppliers" s
                     LEFT JOIN "Parts" p ON s.id = p.supplier_id
                     LEFT JOIN "Orders" o ON s.id = o.supplier_id
        `;

        const conditions = [];
        const values = [];
        let paramCount = 0;

        if (filters.search) {
            paramCount++;
            conditions.push(`(
                LOWER(s.company_name) LIKE $${paramCount} OR 
                LOWER(s.contact_person) LIKE $${paramCount} OR 
                LOWER(s.email) LIKE $${paramCount}
            )`);
            values.push(`%${filters.search.toLowerCase()}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY s.id ORDER BY s.company_name';

        const result = await pool.query(query, values);
        return result.rows;
    }

    static async getSupplierById(id) {
        const query = 'SELECT * FROM "Suppliers" WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    static async createSupplier(supplierData) {
        // Check for duplicate email
        const emailCheck = await pool.query(
            'SELECT id FROM "Suppliers" WHERE email = $1',
            [supplierData.email]
        );

        if (emailCheck.rows.length > 0) {
            throw new Error('Supplier with this email already exists');
        }

        const query = `
            INSERT INTO "Suppliers" (
                company_name, contact_person, email, phone,
                address, delivery_time_days
            ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
        `;

        const values = [
            supplierData.name,
            supplierData.contact_person,
            supplierData.email,
            supplierData.phone || '',
            supplierData.address || '',
            supplierData.delivery_time || 7
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async updateSupplier(id, updateData) {
        // Check if supplier exists
        const existingSupplier = await this.getSupplierById(id);
        if (!existingSupplier) {
            throw new Error('Supplier not found');
        }

        // Check for duplicate email
        if (updateData.email) {
            const emailCheck = await pool.query(
                'SELECT id FROM "Suppliers" WHERE email = $1 AND id != $2',
                [updateData.email, id]
            );

            if (emailCheck.rows.length > 0) {
                throw new Error('Supplier with this email already exists');
            }
        }

        const query = `
            UPDATE "Suppliers" SET
                                   company_name = COALESCE($1, company_name),
                                   contact_person = COALESCE($2, contact_person),
                                   email = COALESCE($3, email),
                                   phone = COALESCE($4, phone),
                                   address = COALESCE($5, address),
                                   delivery_time_days = COALESCE($6, delivery_time_days),
                                   updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
                RETURNING *
        `;

        const values = [
            updateData.name,
            updateData.contact_person,
            updateData.email,
            updateData.phone,
            updateData.address,
            updateData.delivery_time,
            id
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async deleteSupplier(id) {
        // Check dependencies
        const partsCheck = await pool.query(
            'SELECT COUNT(*) FROM "Parts" WHERE supplier_id = $1',
            [id]
        );

        const ordersCheck = await pool.query(
            'SELECT COUNT(*) FROM "Orders" WHERE supplier_id = $1',
            [id]
        );

        if (parseInt(partsCheck.rows[0].count) > 0 || parseInt(ordersCheck.rows[0].count) > 0) {
            throw new Error('Cannot delete supplier with associated parts or orders');
        }

        const query = 'DELETE FROM "Suppliers" WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            throw new Error('Supplier not found');
        }

        return result.rows[0];
    }

    // Parts operations
    static async getAllParts(filters = {}) {
        let query = `
            SELECT p.*, s.company_name as supplier_name,
                   p.price::numeric as price,
                    p.stock_quantity::integer as stock_quantity,
                    p.minimum_stock_level::integer as minimum_stock_level
            FROM "Parts" p
                     LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
        `;

        const conditions = [];
        const values = [];
        let paramCount = 0;

        if (filters.supplier_id) {
            paramCount++;
            conditions.push(`p.supplier_id = $${paramCount}`);
            values.push(filters.supplier_id);
        }

        if (filters.category) {
            paramCount++;
            conditions.push(`p.category = $${paramCount}`);
            values.push(filters.category);
        }

        if (filters.low_stock === 'true') {
            conditions.push('p.stock_quantity <= p.minimum_stock_level');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY p.name';

        const result = await pool.query(query, values);

        return result.rows.map(part => ({
            ...part,
            price: parseFloat(part.price) || 0,
            stock_quantity: parseInt(part.stock_quantity) || 0,
            minimum_stock_level: parseInt(part.minimum_stock_level) || 0
        }));
    }

    static async getAllOrders(filters = {}) {
        let query = `
            SELECT o.*, s.company_name as supplier_name,
                   o.total_amount::numeric as total_amount,
                    o.product_name,
                   o.product_quantity,
                   o.product_unit_price::numeric as product_unit_price,
                    COALESCE(
                            json_agg(
                                    json_build_object(
                                            'id', oi.id,
                                            'part_id', oi.part_id,
                                            'name', COALESCE(p.name, 'Unknown Item'),
                                            'quantity', oi.quantity::integer,
                                            'unit_price', oi.unit_price::numeric,
                                            'subtotal', oi.subtotal::numeric
                                    )
                            ) FILTER (WHERE oi.id IS NOT NULL),
                            '[]'
                    ) as items
            FROM "Orders" o
                     LEFT JOIN "Suppliers" s ON o.supplier_id = s.id
                     LEFT JOIN "OrderItems" oi ON o.id = oi.order_id
                     LEFT JOIN "Parts" p ON oi.part_id = p.id
        `;

        const conditions = [];
        const values = [];
        let paramCount = 0;

        if (filters.status) {
            paramCount++;
            conditions.push(`o.status = $${paramCount}`);
            values.push(filters.status);
        }

        if (filters.supplier_id) {
            paramCount++;
            conditions.push(`o.supplier_id = $${paramCount}`);
            values.push(filters.supplier_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY o.id, s.company_name ORDER BY o.order_date DESC';

        const result = await pool.query(query, values);

        return result.rows.map(order => ({
            ...order,
            total_amount: parseFloat(order.total_amount) || 0,
            product_unit_price: parseFloat(order.product_unit_price) || 0,
            items: Array.isArray(order.items) ? order.items.map(item => ({
                ...item,
                quantity: parseInt(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                subtotal: parseFloat(item.subtotal) || 0
            })) : []
        }));
    }

    static async createPart(partData) {
        const query = `
            INSERT INTO "Parts" (
                name, description, part_number, category, price,
                stock_quantity, minimum_stock_level, supplier_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
        `;

        const values = [
            partData.name,
            partData.description || '',
            partData.part_number || `PN-${Date.now()}`,
            partData.category || 'General',
            parseFloat(partData.price),
            parseInt(partData.stock_quantity) || 0,
            parseInt(partData.minimum_stock_level) || 5,
            parseInt(partData.supplier_id)
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Orders operations
    static async getAllOrders(filters = {}) {
        let query = `
            SELECT o.*, s.company_name as supplier_name,
                   COALESCE(
                           json_agg(
                                   json_build_object(
                                           'id', oi.id,
                                           'part_id', oi.part_id,
                                           'name', p.name,
                                           'quantity', oi.quantity,
                                           'unit_price', oi.unit_price,
                                           'subtotal', oi.subtotal
                                   )
                           ) FILTER (WHERE oi.id IS NOT NULL),
                           '[]'
                   ) as items
            FROM "Orders" o
                     LEFT JOIN "Suppliers" s ON o.supplier_id = s.id
                     LEFT JOIN "OrderItems" oi ON o.id = oi.order_id
                     LEFT JOIN "Parts" p ON oi.part_id = p.id
        `;

        const conditions = [];
        const values = [];
        let paramCount = 0;

        if (filters.status) {
            paramCount++;
            conditions.push(`o.status = $${paramCount}`);
            values.push(filters.status);
        }

        if (filters.supplier_id) {
            paramCount++;
            conditions.push(`o.supplier_id = $${paramCount}`);
            values.push(filters.supplier_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY o.id, s.company_name ORDER BY o.order_date DESC';

        const result = await pool.query(query, values);
        return result.rows;
    }

    static async createOrder(orderData) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            if (!orderData.supplier_id) {
                throw new Error('supplier_id is required');
            }

            if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
                throw new Error('items array is required and must not be empty');
            }

            const total_amount = orderData.items.reduce((sum, item) => {
                const quantity = parseFloat(item.quantity) || 0;
                const unitPrice = parseFloat(item.unit_price) || 0;
                return sum + (quantity * unitPrice);
            }, 0);

            const firstItem = orderData.items[0];
            const productName = orderData.items.length === 1 ?
                (firstItem.name || 'Unknown Product') :
                `${firstItem.name || 'Mixed Items'} +${orderData.items.length - 1} more`;
            const productQuantity = orderData.items.length === 1 ?
                (parseInt(firstItem.quantity) || 1) :
                orderData.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
            const productUnitPrice = orderData.items.length === 1 ?
                (parseFloat(firstItem.unit_price) || 0) :
                (total_amount / productQuantity);


            const orderQuery = `
                INSERT INTO "Orders" (
                    supplier_id,
                    order_date,
                    expected_delivery_date,
                    status,
                    total_amount,
                    notes,
                    product_name,
                    product_quantity,
                    product_unit_price
                ) VALUES ($1, NOW(), $2, 'ordered', $3, $4, $5, $6, $7)
                    RETURNING *
            `;

            const orderValues = [
                parseInt(orderData.supplier_id),
                orderData.expected_delivery_date || null,
                total_amount,
                orderData.notes || '',
                productName,
                productQuantity,
                productUnitPrice
            ];

            const orderResult = await client.query(orderQuery, orderValues);
            const newOrder = orderResult.rows[0];


            for (const item of orderData.items) {
                let partId = null;
                if (item.part_id) {
                    partId = parseInt(item.part_id);
                } else if (item.name) {

                    const partQuery = 'SELECT id FROM "Parts" WHERE name = $1 LIMIT 1';
                    const partResult = await client.query(partQuery, [item.name]);
                    if (partResult.rows.length > 0) {
                        partId = partResult.rows[0].id;
                    }
                }

                const itemQuery = `
                    INSERT INTO "OrderItems" (
                        order_id,
                        part_id,
                        quantity,
                        unit_price,
                        subtotal
                    ) VALUES ($1, $2, $3, $4, $5)
                `;

                const quantity = parseInt(item.quantity) || 1;
                const unitPrice = parseFloat(item.unit_price) || 0;
                const subtotal = quantity * unitPrice;

                await client.query(itemQuery, [
                    newOrder.id,
                    partId,
                    quantity,
                    unitPrice,
                    subtotal
                ]);

            }

            await client.query('COMMIT');

            return {
                ...newOrder,
                items: orderData.items.map(item => ({
                    ...item,
                    subtotal: (parseInt(item.quantity) || 1) * (parseFloat(item.unit_price) || 0)
                }))
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateOrderStatus(orderId, status, actualDeliveryDate = null, notes = null) {
        try {
            const allOrdersQuery = 'SELECT id, status FROM "Orders" ORDER BY id';
            const allOrders = await pool.query(allOrdersQuery);
            allOrders.rows.forEach(row => {
                console.log(`  ID: ${row.id} (${typeof row.id}), Status: ${row.status}`);
            });

            let query, values;

            if (notes && notes.trim() !== '') {
                query = `
                    UPDATE "Orders" SET
                                        status = $1,
                                        actual_delivery_date = $2,
                                        notes = CONCAT(COALESCE(notes, ''), CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE '\n' END, $3),
                                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                        RETURNING *
                `;
                values = [status, actualDeliveryDate, notes, orderId];
            } else {
                query = `
                    UPDATE "Orders" SET
                                        status = $1,
                                        actual_delivery_date = $2,
                                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                        RETURNING *
                `;
                values = [status, actualDeliveryDate, orderId];
            }

            const result = await pool.query(query, values);


            if (result.rows.length === 0) {
                throw new Error(`Order with ID ${orderId} not found`);
            }

            if (status === 'delivered') {
                await this.updateInventoryFromOrder(result.rows[0]);
            }

            return result.rows[0];

        } catch (error) {
            throw error;
        }
    }

    static async updateInventoryFromOrder(order) {
        try {
            const itemsQuery = `
                SELECT oi.*, p.name, p.id as part_id
                FROM "OrderItems" oi
                         LEFT JOIN "Parts" p ON oi.part_id = p.id
                WHERE oi.order_id = $1
            `;

            const itemsResult = await pool.query(itemsQuery, [order.id]);

            for (const item of itemsResult.rows) {
                if (item.part_id) {

                    const updateStockQuery = `
                        UPDATE "Parts"
                        SET stock_quantity = stock_quantity + $1,
                            updated_at     = CURRENT_TIMESTAMP
                        WHERE id = $2 RETURNING name, stock_quantity
                    `;

                    const result = await pool.query(updateStockQuery, [item.quantity, item.part_id]);

                }
            }
        } catch (error) {
            console.error('Model - Error updating inventory:', error);
        }
    }

    static async initializeSampleData() {
        const suppliersCount = await pool.query('SELECT COUNT(*) FROM "Suppliers"');

        if (parseInt(suppliersCount.rows[0].count) === 0) {
            const sampleSuppliers = [
                {
                    company_name: 'AutoParts Pro',
                    contact_person: 'John Smith',
                    email: 'john@autopartspro.com',
                    phone: '+1-555-0123',
                    address: '123 Industrial Ave, Detroit, MI',
                    delivery_time_days: 3
                },
                {
                    company_name: 'BrakeMaster Supply',
                    contact_person: 'Sarah Johnson',
                    email: 'sarah@brakemaster.com',
                    phone: '+1-555-0456',
                    address: '456 Commerce St, Chicago, IL',
                    delivery_time_days: 2
                }
            ];

            for (const supplier of sampleSuppliers) {
                await pool.query(
                    `INSERT INTO "Suppliers" (company_name, contact_person, email, phone, address, delivery_time_days)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [supplier.company_name, supplier.contact_person, supplier.email,
                        supplier.phone, supplier.address, supplier.delivery_time_days]
                );
            }
        }

        const partsCount = await pool.query('SELECT COUNT(*) FROM "Parts"');

        if (parseInt(partsCount.rows[0].count) === 0) {
            const suppliersResult = await pool.query('SELECT id FROM "Suppliers" ORDER BY id LIMIT 2');
            const supplierIds = suppliersResult.rows.map(row => row.id);

            if (supplierIds.length >= 2) {
                const sampleParts = [
                    {
                        name: 'Engine Oil Filter',
                        description: 'High-quality engine oil filter',
                        part_number: 'EOF-001',
                        category: 'Engine Parts',
                        price: 15.99,
                        stock_quantity: 150,
                        minimum_stock_level: 20,
                        supplier_id: supplierIds[0]
                    },
                    {
                        name: 'Brake Pads Set',
                        description: 'Premium brake pads set',
                        part_number: 'BPS-001',
                        category: 'Brakes',
                        price: 89.99,
                        stock_quantity: 45,
                        minimum_stock_level: 10,
                        supplier_id: supplierIds[1]
                    }
                ];

                for (const part of sampleParts) {
                    await pool.query(
                        `INSERT INTO "Parts" (name, description, part_number, category, price, stock_quantity, minimum_stock_level, supplier_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [part.name, part.description, part.part_number, part.category,
                            part.price, part.stock_quantity, part.minimum_stock_level, part.supplier_id]
                    );
                }
            }
        }
    }
}

module.exports = SupplierModel;