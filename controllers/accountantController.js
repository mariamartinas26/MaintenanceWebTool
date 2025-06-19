const User = require('../models/User');
const { sendSuccess, sendBadRequest, sendServerError, sendNotFound } = require('../utils/response');

const hasAccountantAccess = (userRole) => {
    return ['admin', 'manager', 'accountant'].includes(userRole);
};

const hasImportExportAccess = (userRole) => {
    return ['admin', 'manager', 'accountant'].includes(userRole);
};


const canDeleteSuppliers = (userRole) => {
    return ['admin', 'manager'].includes(userRole);
};

const getDashboard = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Accountant role required.');
        }

        const stats = await getDashboardStats(req.user.id);

        sendSuccess(res, {
            user: {
                id: req.user.id,
                name: `${req.user.first_name} ${req.user.last_name}`,
                role: req.user.role
            },
            stats: stats,
            permissions: {
                suppliers: hasAccountantAccess(userRole),
                importExport: hasImportExportAccess(userRole),
                canDelete: canDeleteSuppliers(userRole)
            }
        }, 'Accountant dashboard data retrieved successfully');

    } catch (error) {
        sendServerError(res, 'Failed to retrieve dashboard data');
    }
};

const getDashboardStats = async (userId) => {
    try {
        const db = require('../database/db');

        const suppliersResult = await db.query('SELECT COUNT(*) as total FROM suppliers');
        const totalSuppliers = suppliersResult.rows[0]?.total || 0;

        const activeSuppliersResult = await db.query(
            'SELECT COUNT(*) as total FROM suppliers WHERE status = $1',
            ['active']
        );
        const activeSuppliers = activeSuppliersResult.rows[0]?.total || 0;

        let recentImports = 0;
        try {
            const importsResult = await db.query(
                'SELECT COUNT(*) as total FROM import_export_logs WHERE created_at >= NOW() - INTERVAL \'30 days\''
            );
            recentImports = importsResult.rows[0]?.total || 0;
        } catch (err) {
            console.log('import_export_logs table not found, skipping...');
        }

        // Furnizori inactivi
        const inactiveSuppliersResult = await db.query(
            'SELECT COUNT(*) as total FROM suppliers WHERE status = $1',
            ['inactive']
        );
        const inactiveSuppliers = inactiveSuppliersResult.rows[0]?.total || 0;

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
};

const getSuppliers = async (req, res) => {
    try {
        console.log('=== getSuppliers called ===');
        console.log('Query params:', req.query);
        console.log('User role:', req.user?.role);

        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Suppliers access required.');
        }

        const { search, status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const db = require('../database/db');
        let query = 'SELECT * FROM suppliers WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Filtru de căutare
        if (search && search.trim()) {
            query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR contact_person ILIKE $${paramIndex})`;
            params.push(`%${search.trim()}%`);
            paramIndex++;
        }

        // Filtru de status
        if (status && status !== 'all') {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        // Ordonare și paginare
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        console.log('Final query:', query);
        console.log('Query params:', params);

        const result = await db.query(query, params);

        // Numărul total pentru paginare
        let countQuery = 'SELECT COUNT(*) as total FROM suppliers WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (search && search.trim()) {
            countQuery += ` AND (name ILIKE $${countParamIndex} OR email ILIKE $${countParamIndex} OR contact_person ILIKE $${countParamIndex})`;
            countParams.push(`%${search.trim()}%`);
            countParamIndex++;
        }

        if (status && status !== 'all') {
            countQuery += ` AND status = $${countParamIndex}`;
            countParams.push(status);
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0]?.total || 0);

        console.log('Suppliers found:', result.rows.length);
        console.log('Total suppliers:', total);

        sendSuccess(res, {
            suppliers: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        }, 'Suppliers retrieved successfully');

    } catch (error) {
        console.error('=== ERROR in getSuppliers ===');
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        sendServerError(res, 'Failed to retrieve suppliers');
    }
};

const getSupplierById = async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Suppliers access required.');
        }

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid supplier ID');
        }

        const db = require('../database/db');
        const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [parseInt(id)]);

        if (result.rows.length === 0) {
            return sendNotFound(res, 'Supplier not found');
        }

        sendSuccess(res, {
            supplier: result.rows[0]
        }, 'Supplier retrieved successfully');

    } catch (error) {
        console.error('Error fetching supplier:', error);
        sendServerError(res, 'Failed to retrieve supplier');
    }
};

const addSupplier = async (req, res) => {
    try {
        console.log('=== addSupplier called ===');
        console.log('Request body:', req.body);
        console.log('User role:', req.user?.role);

        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Suppliers access required.');
        }

        const { name, email, phone, address, contact_person, status = 'active' } = req.body;

        // Validări
        if (!name || name.trim().length === 0) {
            return sendBadRequest(res, 'Supplier name is required');
        }

        if (!email || email.trim().length === 0) {
            return sendBadRequest(res, 'Email is required');
        }

        // Validare format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return sendBadRequest(res, 'Invalid email format');
        }

        const validStatuses = ['active', 'inactive', 'pending'];
        if (!validStatuses.includes(status)) {
            return sendBadRequest(res, 'Invalid status. Must be active, inactive, or pending');
        }

        const db = require('../database/db');

        // Verifică dacă email-ul există deja
        const existingSupplier = await db.query(
            'SELECT id FROM suppliers WHERE email = $1',
            [email.trim()]
        );

        if (existingSupplier.rows.length > 0) {
            return sendBadRequest(res, 'Supplier with this email already exists');
        }

        const result = await db.query(
            `INSERT INTO suppliers (name, email, phone, address, contact_person, status, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             RETURNING *`,
            [
                name.trim(),
                email.trim(),
                phone?.trim() || null,
                address?.trim() || null,
                contact_person?.trim() || null,
                status,
                req.user.id
            ]
        );

        console.log('Supplier added successfully:', result.rows[0]);

        sendSuccess(res, {
            supplier: result.rows[0]
        }, 'Supplier added successfully');

    } catch (error) {
        console.error('=== ERROR in addSupplier ===');
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        sendServerError(res, 'Failed to add supplier');
    }
};

const updateSupplier = async (req, res) => {
    try {
        console.log('=== updateSupplier called ===');
        console.log('Supplier ID:', req.params.id);
        console.log('Request body:', req.body);

        const { id } = req.params;
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Suppliers access required.');
        }

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid supplier ID');
        }

        const { name, email, phone, address, contact_person, status } = req.body;

        // Validări
        if (!name || name.trim().length === 0) {
            return sendBadRequest(res, 'Supplier name is required');
        }

        if (!email || email.trim().length === 0) {
            return sendBadRequest(res, 'Email is required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return sendBadRequest(res, 'Invalid email format');
        }

        const validStatuses = ['active', 'inactive', 'pending'];
        if (status && !validStatuses.includes(status)) {
            return sendBadRequest(res, 'Invalid status. Must be active, inactive, or pending');
        }

        const db = require('../database/db');

        // Verifică dacă furnizorul există
        const existingSupplier = await db.query(
            'SELECT * FROM suppliers WHERE id = $1',
            [parseInt(id)]
        );

        if (existingSupplier.rows.length === 0) {
            return sendNotFound(res, 'Supplier not found');
        }

        // Verifică dacă alt furnizor are același email
        const emailCheck = await db.query(
            'SELECT id FROM suppliers WHERE email = $1 AND id != $2',
            [email.trim(), parseInt(id)]
        );

        if (emailCheck.rows.length > 0) {
            return sendBadRequest(res, 'Another supplier with this email already exists');
        }

        const result = await db.query(
            `UPDATE suppliers 
             SET name = $1, email = $2, phone = $3, address = $4, 
                 contact_person = $5, status = $6, updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [
                name.trim(),
                email.trim(),
                phone?.trim() || null,
                address?.trim() || null,
                contact_person?.trim() || null,
                status || existingSupplier.rows[0].status,
                parseInt(id)
            ]
        );

        console.log('Supplier updated successfully:', result.rows[0]);

        sendSuccess(res, {
            supplier: result.rows[0]
        }, 'Supplier updated successfully');

    } catch (error) {
        console.error('=== ERROR in updateSupplier ===');
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        sendServerError(res, 'Failed to update supplier');
    }
};

const deleteSupplier = async (req, res) => {
    try {
        console.log('=== deleteSupplier called ===');
        console.log('Supplier ID:', req.params.id);
        console.log('User role:', req.user?.role);

        const { id } = req.params;
        const userRole = req.user.role;

        // Doar admin și manager pot șterge furnizori
        if (!canDeleteSuppliers(userRole)) {
            return sendBadRequest(res, 'Access denied. Admin or manager role required.');
        }

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid supplier ID');
        }

        const db = require('../database/db');

        const result = await db.query(
            'DELETE FROM suppliers WHERE id = $1 RETURNING *',
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return sendNotFound(res, 'Supplier not found');
        }

        console.log('Supplier deleted successfully:', result.rows[0]);

        sendSuccess(res, {
            deletedSupplier: result.rows[0]
        }, 'Supplier deleted successfully');

    } catch (error) {
        console.error('=== ERROR in deleteSupplier ===');
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        sendServerError(res, 'Failed to delete supplier');
    }
};

const exportSuppliers = async (req, res) => {
    try {
        console.log('=== exportSuppliers called ===');
        console.log('Query params:', req.query);

        const userRole = req.user.role;

        if (!hasImportExportAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Import/Export access required.');
        }

        const { format = 'json' } = req.query;

        const db = require('../database/db');
        const result = await db.query(
            'SELECT id, name, email, phone, address, contact_person, status, created_at, updated_at FROM suppliers ORDER BY name'
        );

        if (format === 'csv') {
            // Export CSV
            const csv = convertToCSV(result.rows);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=suppliers.csv');
            return res.send(csv);
        } else {
            // Export JSON
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=suppliers.json');
            return res.json({
                success: true,
                data: result.rows,
                exportDate: new Date().toISOString(),
                exportedBy: req.user.id
            });
        }

    } catch (error) {
        console.error('=== ERROR in exportSuppliers ===');
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        sendServerError(res, 'Failed to export suppliers');
    }
};

// Helper function pentru conversie CSV
const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma
            if (value === null || value === undefined) return '';
            const stringValue = value.toString();
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
};

const importSuppliers = async (req, res) => {
    try {
        console.log('=== importSuppliers called ===');

        const userRole = req.user.role;

        if (!hasImportExportAccess(userRole)) {
            return sendBadRequest(res, 'Access denied. Import/Export access required.');
        }

        const { suppliers } = req.body;

        if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
            return sendBadRequest(res, 'Suppliers array is required and must not be empty');
        }

        const db = require('../database/db');
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        for (let i = 0; i < suppliers.length; i++) {
            const supplier = suppliers[i];

            try {
                // Validări pentru fiecare furnizor
                if (!supplier.name || !supplier.email) {
                    results.errors.push(`Row ${i + 1}: Name and email are required`);
                    results.skipped++;
                    continue;
                }

                // Verifică dacă există deja
                const existing = await db.query(
                    'SELECT id FROM suppliers WHERE email = $1',
                    [supplier.email.trim()]
                );

                if (existing.rows.length > 0) {
                    results.errors.push(`Row ${i + 1}: Supplier with email ${supplier.email} already exists`);
                    results.skipped++;
                    continue;
                }

                // Inserează furnizorul
                await db.query(
                    `INSERT INTO suppliers (name, email, phone, address, contact_person, status, created_by, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                    [
                        supplier.name.trim(),
                        supplier.email.trim(),
                        supplier.phone?.trim() || null,
                        supplier.address?.trim() || null,
                        supplier.contact_person?.trim() || null,
                        supplier.status || 'active',
                        req.user.id
                    ]
                );

                results.imported++;

            } catch (error) {
                results.errors.push(`Row ${i + 1}: ${error.message}`);
                results.skipped++;
            }
        }

        console.log('Import results:', results);

        sendSuccess(res, {
            results: results
        }, `Import completed. ${results.imported} suppliers imported, ${results.skipped} skipped`);

    } catch (error) {
        sendServerError(res, 'Failed to import suppliers');
    }
};

module.exports = {
    getDashboard,
    getSuppliers,
    getSupplierById,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    exportSuppliers,
    importSuppliers
};