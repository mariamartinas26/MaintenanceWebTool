const { pool } = require('../database/db');

class InventoryModel {

    // Get all parts with stock information
    static async getAllParts() {
        const query = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.part_number,
                p.category,
                p.price,
                p.stock_quantity,
                p.minimum_stock_level,
                p.supplier_id,
                s.company_name as supplier_name,
                s.contact_person as supplier_contact,
                s.phone as supplier_phone,
                s.email as supplier_email,
                CASE 
                    WHEN p.stock_quantity <= p.minimum_stock_level THEN true 
                    ELSE false 
                END as is_low_stock,
                p.created_at,
                p.updated_at
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            ORDER BY p.name ASC
        `;

        try {
            const result = await pool.query(query);
            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Error fetching all parts:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get parts by category
    static async getPartsByCategory(category) {
        const query = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.part_number,
                p.category,
                p.price,
                p.stock_quantity,
                p.minimum_stock_level,
                p.supplier_id,
                s.company_name as supplier_name,
                CASE 
                    WHEN p.stock_quantity <= p.minimum_stock_level THEN true 
                    ELSE false 
                END as is_low_stock,
                p.created_at,
                p.updated_at
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            WHERE p.category = $1
            ORDER BY p.name ASC
        `;

        try {
            const result = await pool.query(query, [category]);
            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Error fetching parts by category:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get parts with low stock (below minimum level)
    static async getLowStockParts() {
        const query = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.part_number,
                p.category,
                p.price,
                p.stock_quantity,
                p.minimum_stock_level,
                p.supplier_id,
                s.company_name as supplier_name,
                s.contact_person as supplier_contact,
                s.phone as supplier_phone,
                s.email as supplier_email,
                p.created_at,
                p.updated_at
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            WHERE p.stock_quantity <= p.minimum_stock_level
            ORDER BY p.stock_quantity ASC, p.name ASC
        `;

        try {
            const result = await pool.query(query);
            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Error fetching low stock parts:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get single part by ID
    static async getPartById(partId) {
        const query = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.part_number,
                p.category,
                p.price,
                p.stock_quantity,
                p.minimum_stock_level,
                p.supplier_id,
                s.company_name as supplier_name,
                s.contact_person as supplier_contact,
                s.phone as supplier_phone,
                s.email as supplier_email,
                CASE 
                    WHEN p.stock_quantity <= p.minimum_stock_level THEN true 
                    ELSE false 
                END as is_low_stock,
                p.created_at,
                p.updated_at
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            WHERE p.id = $1
        `;

        try {
            const result = await pool.query(query, [partId]);
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Part not found'
                };
            }
            return {
                success: true,
                data: result.rows[0]
            };
        } catch (error) {
            console.error('Error fetching part by ID:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Add new part
    static async addPart(partData) {
        const {
            name,
            description,
            part_number,
            category,
            price,
            stock_quantity,
            minimum_stock_level,
            supplier_id
        } = partData;

        const query = `
            INSERT INTO "Parts" (
                name, 
                description, 
                part_number, 
                category, 
                price, 
                stock_quantity, 
                minimum_stock_level, 
                supplier_id,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
            RETURNING *
        `;

        try {
            const result = await pool.query(query, [
                name,
                description,
                part_number,
                category,
                price,
                stock_quantity || 0,
                minimum_stock_level || 5,
                supplier_id
            ]);

            return {
                success: true,
                data: result.rows[0],
                message: 'Part added successfully'
            };
        } catch (error) {
            console.error('Error adding part:', error);
            if (error.code === '23505') { // Unique constraint violation
                return {
                    success: false,
                    error: 'Part number already exists'
                };
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update existing part
    static async updatePart(partId, updateData) {
        const {
            name,
            description,
            part_number,
            category,
            price,
            stock_quantity,
            minimum_stock_level,
            supplier_id
        } = updateData;

        const query = `
            UPDATE "Parts" 
            SET 
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                part_number = COALESCE($4, part_number),
                category = COALESCE($5, category),
                price = COALESCE($6, price),
                stock_quantity = COALESCE($7, stock_quantity),
                minimum_stock_level = COALESCE($8, minimum_stock_level),
                supplier_id = COALESCE($9, supplier_id),
                updated_at = now()
            WHERE id = $1
            RETURNING *
        `;

        try {
            const result = await pool.query(query, [
                partId,
                name,
                description,
                part_number,
                category,
                price,
                stock_quantity,
                minimum_stock_level,
                supplier_id
            ]);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Part not found'
                };
            }

            return {
                success: true,
                data: result.rows[0],
                message: 'Part updated successfully'
            };
        } catch (error) {
            console.error('Error updating part:', error);
            if (error.code === '23505') { // Unique constraint violation
                return {
                    success: false,
                    error: 'Part number already exists'
                };
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delete part
    static async deletePart(partId) {
        // First check if part is used in any orders or work orders
        const checkUsageQuery = `
            SELECT 
                (SELECT COUNT(*) FROM "OrderItems" WHERE part_id = $1) as order_count,
                (SELECT COUNT(*) FROM "WorkOrders" WHERE parts_used::text LIKE '%"' || $1 || '"%') as work_order_count
        `;

        try {
            const usageResult = await pool.query(checkUsageQuery, [partId]);
            const { order_count, work_order_count } = usageResult.rows[0];

            if (parseInt(order_count) > 0 || parseInt(work_order_count) > 0) {
                return {
                    success: false,
                    error: 'Cannot delete part: it is referenced in existing orders or work orders'
                };
            }

            const deleteQuery = `DELETE FROM "Parts" WHERE id = $1 RETURNING *`;
            const result = await pool.query(deleteQuery, [partId]);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Part not found'
                };
            }

            return {
                success: true,
                data: result.rows[0],
                message: 'Part deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting part:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update stock quantity (for when parts are used or restocked)
    static async updateStock(partId, quantityChange, operation = 'subtract') {
        const query = `
            UPDATE "Parts" 
            SET 
                stock_quantity = CASE 
                    WHEN $3 = 'add' THEN stock_quantity + $2
                    WHEN $3 = 'subtract' THEN GREATEST(0, stock_quantity - $2)
                    WHEN $3 = 'set' THEN $2
                    ELSE stock_quantity
                END,
                updated_at = now()
            WHERE id = $1
            RETURNING *, 
                CASE 
                    WHEN stock_quantity <= minimum_stock_level THEN true 
                    ELSE false 
                END as is_low_stock
        `;

        try {
            const result = await pool.query(query, [partId, quantityChange, operation]);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Part not found'
                };
            }

            return {
                success: true,
                data: result.rows[0],
                message: `Stock ${operation}ed successfully`
            };
        } catch (error) {
            console.error('Error updating stock:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get distinct categories
    static async getCategories() {
        const query = `
            SELECT DISTINCT category 
            FROM "Parts" 
            WHERE category IS NOT NULL 
            ORDER BY category ASC
        `;

        try {
            const result = await pool.query(query);
            return {
                success: true,
                data: result.rows.map(row => row.category)
            };
        } catch (error) {
            console.error('Error fetching categories:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Search parts by name or part number
    static async searchParts(searchTerm) {
        const query = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.part_number,
                p.category,
                p.price,
                p.stock_quantity,
                p.minimum_stock_level,
                p.supplier_id,
                s.company_name as supplier_name,
                CASE 
                    WHEN p.stock_quantity <= p.minimum_stock_level THEN true 
                    ELSE false 
                END as is_low_stock,
                p.created_at,
                p.updated_at
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            WHERE 
                p.name ILIKE $1 OR 
                p.part_number ILIKE $1 OR 
                p.description ILIKE $1
            ORDER BY p.name ASC
        `;

        try {
            const searchPattern = `%${searchTerm}%`;
            const result = await pool.query(query, [searchPattern]);
            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Error searching parts:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get inventory statistics
    static async getInventoryStats() {
        const query = `
            SELECT 
                COUNT(*) as total_parts,
                COUNT(CASE WHEN stock_quantity <= minimum_stock_level THEN 1 END) as low_stock_count,
                SUM(stock_quantity * price) as total_inventory_value,
                COUNT(DISTINCT category) as total_categories,
                AVG(price) as average_price
            FROM "Parts"
        `;

        try {
            const result = await pool.query(query);
            return {
                success: true,
                data: result.rows[0]
            };
        } catch (error) {
            console.error('Error fetching inventory stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = InventoryModel;