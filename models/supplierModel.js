const { pool } = require('../database/db');

class SupplierModel {

    static async getAllSuppliers() {
        const query = 'SELECT * FROM "Suppliers" ORDER BY company_name';
        const result = await pool.query(query);
        return result.rows;
    }

    static async getSupplierById(id) {
        const query = 'SELECT * FROM "Suppliers" WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    static async createSupplier(supplierData) {
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

    static async getAllParts() {
        const query = `
            SELECT p.*, s.company_name as supplier_name
            FROM "Parts" p
                     LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            ORDER BY p.name
        `;

        const result = await pool.query(query);

        return result.rows.map(part => ({
            ...part,
            price: parseFloat(part.price) || 0,
            stock_quantity: parseInt(part.stock_quantity) || 0,
            minimum_stock_level: parseInt(part.minimum_stock_level) || 0
        }));
    }
    static async getPartById(id) {
        const query = `
        SELECT p.*, s.company_name as supplier_name
        FROM "Parts" p
        LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
        WHERE p.id = $1
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        const part = result.rows[0];
        return {
            ...part,
            price: parseFloat(part.price) || 0,
            stock_quantity: parseInt(part.stock_quantity) || 0,
            minimum_stock_level: parseInt(part.minimum_stock_level) || 0
        };
    }
    static async getAllOrders() {
        const query = `
            SELECT o.*, s.company_name as supplier_name,
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
            GROUP BY o.id, s.company_name
            ORDER BY o.order_date DESC
        `;

        const result = await pool.query(query);

        return result.rows.map(order => ({
            ...order,
            total_amount: parseFloat(order.total_amount) || 0,
            items: Array.isArray(order.items) ? order.items.map(item => ({
                ...item,
                quantity: parseInt(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                subtotal: parseFloat(item.subtotal) || 0
            })) : []
        }));
    }
    static async createOrder(orderData) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            //total
            const total_amount = orderData.items.reduce((sum, item) => {
                return sum + (item.quantity * item.unit_price);
            }, 0);

            const orderQuery = `
            INSERT INTO "Orders" (
                supplier_id,
                order_date,
                expected_delivery_date,
                status,
                total_amount,
                notes
            ) VALUES ($1, NOW(), $2, 'ordered', $3, $4)
            RETURNING *
        `;

            const orderValues = [
                orderData.supplier_id,
                orderData.expected_delivery_date || null,
                total_amount,
                orderData.notes || null
            ];

            const orderResult = await client.query(orderQuery, orderValues);
            const newOrder = orderResult.rows[0];

            //adaug items in OrderItems
            for (const item of orderData.items) {
                const itemQuery = `
                INSERT INTO "OrderItems" (
                    order_id,
                    part_id,
                    quantity,
                    unit_price,
                    subtotal
                ) VALUES ($1, $2, $3, $4, $5)
            `;

                const subtotal = item.quantity * item.unit_price;

                await client.query(itemQuery, [
                    newOrder.id,
                    item.part_id,
                    item.quantity,
                    item.unit_price,
                    subtotal
                ]);
            }

            await client.query('COMMIT');

            //returneaza comanda cu items
            return {
                ...newOrder,
                total_amount: parseFloat(newOrder.total_amount),
                items: orderData.items.map(item => ({
                    part_id: item.part_id,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    subtotal: item.quantity * item.unit_price
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
            const query = `
            UPDATE "Orders" SET
                status = $1,
                actual_delivery_date = $2,
                notes = CASE 
                    WHEN $3 IS NOT NULL THEN 
                        CONCAT(COALESCE(notes, ''), 
                               CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE '\n' END, 
                               $3)
                    ELSE notes 
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `;

            const values = [status, actualDeliveryDate, notes, orderId];
            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                throw new Error(`Order not found`);
            }

            //daca comanda s-a livrat crete stocul
            if (status === 'delivered') {
                await this.updateInventoryFromOrder(result.rows[0]);
            }

            return result.rows[0];

        } catch (error) {
            throw error;
        }
    }

    static async updateInventoryFromOrder(order) {
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

                    await pool.query(updateStockQuery, [item.quantity, item.part_id]);
                }
            }
    }
}

module.exports = SupplierModel;