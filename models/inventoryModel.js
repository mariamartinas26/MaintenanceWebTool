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