const { pool } = require('../database/db');

class Part {
    static async getAll(filters = {}) {
        let query = `
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
                p.created_at,
                p.updated_at
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
        `;

        const conditions = [];
        const params = [];

        if (filters.search) {
            conditions.push(`(
                LOWER(p.name) LIKE LOWER($${params.length + 1}) OR 
                LOWER(p.part_number) LIKE LOWER($${params.length + 2}) OR 
                LOWER(p.description) LIKE LOWER($${params.length + 3}) OR
                LOWER(p.category) LIKE LOWER($${params.length + 4})
            )`);
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (filters.category) {
            conditions.push(`p.category = $${params.length + 1}`);
            params.push(filters.category);
        }

        if (filters.available_only) {
            conditions.push(`p.stock_quantity > 0`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY p.name ASC`;

        try {
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    static async getById(id) {
        const query = `
            SELECT
                p.*,
                s.company_name as supplier_name,
                s.contact_person as supplier_contact,
                s.email as supplier_email,
                s.phone as supplier_phone
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            WHERE p.id = $1
        `;

        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    static async getCategories() {
        const query = `
            SELECT DISTINCT category
            FROM "Parts"
            WHERE category IS NOT NULL
            ORDER BY category ASC
        `;

        try {
            const result = await pool.query(query);
            return result.rows.map(row => row.category);
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    static async updateStock(partId, quantityUsed, client = null) {
        const db = client || pool;

        const query = `
            UPDATE "Parts"
            SET 
                stock_quantity = stock_quantity - $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND stock_quantity >= $2
            RETURNING id, name, stock_quantity, (stock_quantity + $2) as previous_stock
        `;

        try {
            const result = await db.query(query, [partId, quantityUsed]);

            if (result.rows.length === 0) {
                const checkQuery = `SELECT id, name, stock_quantity FROM "Parts" WHERE id = $1`;
                const checkResult = await db.query(checkQuery, [partId]);

                if (checkResult.rows.length === 0) {
                    throw new Error(`Part with ID ${partId} not found`);
                } else {
                    const part = checkResult.rows[0];
                    throw new Error(`Insufficient stock for part "${part.name}". Required: ${quantityUsed}, Available: ${part.stock_quantity}`);
                }
            }

            return result.rows[0];
        } catch (error) {
            throw new Error(`Database error updating stock: ${error.message}`);
        }
    }

    static async updateMultipleStock(partsList, client = null) {
        const db = client || pool;
        const updatedParts = [];
        const errors = [];

        try {
            for (const part of partsList) {
                const checkQuery = `
                    SELECT id, name, stock_quantity 
                    FROM "Parts" 
                    WHERE id = $1
                `;

                const checkResult = await db.query(checkQuery, [part.partId]);

                if (checkResult.rows.length === 0) {
                    errors.push(`Part with ID ${part.partId} not found`);
                    continue;
                }

                const currentPart = checkResult.rows[0];
                if (currentPart.stock_quantity < part.quantity) {
                    errors.push(`Insufficient stock for part "${currentPart.name}". Required: ${part.quantity}, Available: ${currentPart.stock_quantity}`);
                }
            }

            if (errors.length > 0) {
                throw new Error(`Stock validation failed:\n${errors.join('\n')}`);
            }

            for (const part of partsList) {
                const updatedPart = await this.updateStock(part.partId, part.quantity, db);
                updatedParts.push({
                    ...updatedPart,
                    quantityUsed: part.quantity
                });
            }

            return {
                success: true,
                updatedParts: updatedParts,
                totalPartsUpdated: updatedParts.length
            };

        } catch (error) {
            throw error;
        }
    }

    static async checkAvailability(partsList) {
        const partIds = partsList.map(part => part.partId);

        const query = `
            SELECT id, name, stock_quantity
            FROM "Parts"
            WHERE id = ANY($1)
        `;

        try {
            const result = await pool.query(query, [partIds]);
            const availableParts = result.rows;

            const unavailableParts = [];

            for (const requestedPart of partsList) {
                const availablePart = availableParts.find(p => p.id === requestedPart.partId);

                if (!availablePart) {
                    unavailableParts.push({
                        partId: requestedPart.partId,
                        reason: 'Part not found'
                    });
                } else if (availablePart.stock_quantity < requestedPart.quantity) {
                    unavailableParts.push({
                        partId: requestedPart.partId,
                        name: availablePart.name,
                        requested: requestedPart.quantity,
                        available: availablePart.stock_quantity,
                        reason: 'Insufficient stock'
                    });
                }
            }

            return {
                available: unavailableParts.length === 0,
                unavailableParts: unavailableParts
            };
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }

    static async getLowStockParts() {
        const query = `
            SELECT 
                p.id,
                p.name,
                p.part_number,
                p.stock_quantity,
                p.minimum_stock_level,
                s.company_name as supplier_name
            FROM "Parts" p
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id
            WHERE p.stock_quantity <= p.minimum_stock_level
            ORDER BY (p.stock_quantity - p.minimum_stock_level) ASC
        `;

        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }
}

module.exports = Part;