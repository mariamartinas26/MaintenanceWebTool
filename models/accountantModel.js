const db = require('../database/db');

class AccountantModel {
    // Dashboard statistics
    static async getDashboardStats() {
        try {
            // Get total suppliers
            const suppliersResult = await db.query('SELECT COUNT(*) as total FROM suppliers');
            const totalSuppliers = suppliersResult.rows[0]?.total || 0;

            // Get active suppliers
            const activeSuppliersResult = await db.query(
                'SELECT COUNT(*) as total FROM suppliers WHERE status = $1',
                ['active']
            );
            const activeSuppliers = activeSuppliersResult.rows[0]?.total || 0;

            // Get inactive suppliers
            const inactiveSuppliersResult = await db.query(
                'SELECT COUNT(*) as total FROM suppliers WHERE status = $1',
                ['inactive']
            );
            const inactiveSuppliers = inactiveSuppliersResult.rows[0]?.total || 0;

            // Get recent imports (handle table not existing)
            let recentImports = 0;
            try {
                const importsResult = await db.query(
                    'SELECT COUNT(*) as total FROM import_export_logs WHERE created_at >= NOW() - INTERVAL \'30 days\''
                );
                recentImports = importsResult.rows[0]?.total || 0;
            } catch (err) {
                console.log('import_export_logs table not found, skipping...');
            }

            return {
                totalSuppliers: parseInt(totalSuppliers),
                activeSuppliers: parseInt(activeSuppliers),
                inactiveSuppliers: parseInt(inactiveSuppliers),
                recentImports: parseInt(recentImports),
                lastLoginDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return {
                totalSuppliers: 0,
                activeSuppliers: 0,
                inactiveSuppliers: 0,
                recentImports: 0,
                lastLoginDate: new Date().toISOString()
            };
        }
    }

    // Suppliers functionality - reutilizează logica existentă din SupplierModel
    static async getSuppliers(options = {}) {
        try {
            const { page = 1, limit = 10, search = '', status = '' } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    s.*,
                    COUNT(DISTINCT o.id) as total_orders,
                    SUM(o.total_amount) as total_order_value,
                    MAX(o.order_date) as last_order_date
                FROM suppliers s
                LEFT JOIN orders o ON s.id = o.supplier_id
                WHERE 1=1
            `;

            const queryParams = [];
            let paramIndex = 1;

            if (search) {
                query += ` AND (
                    s.company_name ILIKE $${paramIndex} OR 
                    s.contact_person ILIKE $${paramIndex} OR 
                    s.email ILIKE $${paramIndex}
                )`;
                queryParams.push(`%${search}%`);
                paramIndex++;
            }

            if (status) {
                query += ` AND s.status = $${paramIndex}`;
                queryParams.push(status);
                paramIndex++;
            }

            query += `
                GROUP BY s.id
                ORDER BY s.created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            queryParams.push(limit, offset);

            const result = await db.query(query, queryParams);

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(DISTINCT s.id) as total
                FROM suppliers s
                WHERE 1=1
            `;

            const countParams = [];
            let countParamIndex = 1;

            if (search) {
                countQuery += ` AND (
                    s.company_name ILIKE $${countParamIndex} OR 
                    s.contact_person ILIKE $${countParamIndex} OR 
                    s.email ILIKE $${countParamIndex}
                )`;
                countParams.push(`%${search}%`);
                countParamIndex++;
            }

            if (status) {
                countQuery += ` AND s.status = $${countParamIndex}`;
                countParams.push(status);
            }

            const countResult = await db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0]?.total || 0);

            return {
                suppliers: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            console.error('Error getting suppliers:', error);
            throw error;
        }
    }

    static async getSupplierById(id) {
        try {
            const query = `
                SELECT 
                    s.*,
                    COUNT(DISTINCT o.id) as total_orders,
                    SUM(o.total_amount) as total_order_value,
                    MAX(o.order_date) as last_order_date
                FROM suppliers s
                LEFT JOIN orders o ON s.id = o.supplier_id
                WHERE s.id = $1
                GROUP BY s.id
            `;

            const result = await db.query(query, [id]);
            return result.rows[0] || null;

        } catch (error) {
            console.error('Error getting supplier by ID:', error);
            throw error;
        }
    }

    static async getSupplierByEmail(email) {
        try {
            const result = await db.query(
                'SELECT * FROM suppliers WHERE email = $1',
                [email]
            );
            return result.rows[0] || null;

        } catch (error) {
            console.error('Error getting supplier by email:', error);
            throw error;
        }
    }

    static async addSupplier(supplierData) {
        try {
            const {
                company_name,
                contact_person,
                phone,
                email,
                address,
                specialization,
                delivery_time_days,
                status,
                created_by
            } = supplierData;

            const query = `
                INSERT INTO suppliers (
                    company_name, contact_person, phone, email, address, 
                    specialization, delivery_time_days, status, created_by, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                RETURNING *
            `;

            const values = [
                company_name,
                contact_person,
                phone,
                email,
                address,
                specialization || 'General',
                delivery_time_days || 7,
                status || 'active',
                created_by
            ];

            const result = await db.query(query, values);
            return result.rows[0];

        } catch (error) {
            if (error.code === '23505' && error.constraint === 'suppliers_email_key') {
                throw new Error('A supplier with this email already exists');
            }
            console.error('Error adding supplier:', error);
            throw error;
        }
    }

    static async updateSupplier(id, supplierData) {
        try {
            // Verifică dacă supplierul există
            const existingSupplier = await AccountantModel.getSupplierById(id);
            if (!existingSupplier) {
                throw new Error('Supplier not found');
            }

            // Construiește query-ul de update dinamic
            const updateFields = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(supplierData)) {
                if (key !== 'id' && value !== undefined) {
                    updateFields.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            // Adaugă updated_at
            updateFields.push(`updated_at = NOW()`);

            const query = `
                UPDATE suppliers 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            values.push(id);

            const result = await db.query(query, values);
            return result.rows[0];

        } catch (error) {
            if (error.code === '23505' && error.constraint === 'suppliers_email_key') {
                throw new Error('A supplier with this email already exists');
            }
            console.error('Error updating supplier:', error);
            throw error;
        }
    }

    static async deleteSupplier(id) {
        try {
            // Verifică dacă supplierul există
            const existingSupplier = await AccountantModel.getSupplierById(id);
            if (!existingSupplier) {
                throw new Error('Supplier not found');
            }

            // Verifică dacă are comenzi asociate
            const ordersResult = await db.query(
                'SELECT COUNT(*) as count FROM orders WHERE supplier_id = $1',
                [id]
            );

            if (parseInt(ordersResult.rows[0]?.count || 0) > 0) {
                throw new Error('Cannot delete supplier with associated orders');
            }

            // Verifică dacă are piese asociate
            const partsResult = await db.query(
                'SELECT COUNT(*) as count FROM parts WHERE supplier_id = $1',
                [id]
            );

            if (parseInt(partsResult.rows[0]?.count || 0) > 0) {
                throw new Error('Cannot delete supplier with associated parts');
            }

            // Șterge supplierul
            const result = await db.query(
                'DELETE FROM suppliers WHERE id = $1 RETURNING *',
                [id]
            );

            return result.rows[0];

        } catch (error) {
            console.error('Error deleting supplier:', error);
            throw error;
        }
    }

    // Metode utilitare pentru formatarea datelor
    static formatSupplierData(supplier) {
        if (!supplier) return null;

        return {
            id: supplier.id,
            company_name: supplier.company_name,
            contact_person: supplier.contact_person,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            specialization: supplier.specialization,
            delivery_time_days: supplier.delivery_time_days,
            status: supplier.status,
            total_orders: parseInt(supplier.total_orders || 0),
            total_order_value: parseFloat(supplier.total_order_value || 0),
            last_order_date: supplier.last_order_date,
            created_at: supplier.created_at,
            updated_at: supplier.updated_at
        };
    }

    static formatSuppliersArray(suppliers) {
        if (!Array.isArray(suppliers)) return [];
        return suppliers.map(supplier => AccountantModel.formatSupplierData(supplier));
    }

    // Metodă pentru export
    static async getSuppliersForExport() {
        try {
            const result = await AccountantModel.getSuppliers({ limit: 1000 }); // Export max 1000
            return AccountantModel.formatSuppliersArray(result.suppliers);
        } catch (error) {
            console.error('Error getting suppliers for export:', error);
            throw error;
        }
    }

    // Metodă pentru validarea datelor supplier
    static validateSupplierData(data) {
        const errors = [];

        if (!data.company_name || data.company_name.trim().length < 2) {
            errors.push('Company name is required and must be at least 2 characters');
        }

        if (!data.contact_person || data.contact_person.trim().length < 2) {
            errors.push('Contact person is required and must be at least 2 characters');
        }

        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Valid email is required');
        }

        if (data.delivery_time_days && (data.delivery_time_days < 1 || data.delivery_time_days > 365)) {
            errors.push('Delivery time must be between 1 and 365 days');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = AccountantModel;