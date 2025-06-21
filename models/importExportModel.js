const { query } = require('../database/db');

class ImportExportModel {
    static async getAllSuppliers() {
        const result = await query('SELECT * FROM "Suppliers" ORDER BY id');
        return result.rows || [];
    }

    static async getAllParts() {
        const result = await query(`
            SELECT p.*, s.company_name as supplier_name 
            FROM "Parts" p 
            LEFT JOIN "Suppliers" s ON p.supplier_id = s.id 
            ORDER BY p.id
        `);
        return result.rows || [];
    }

    static async getAllAppointments() {
        const result = await query(`
            SELECT a.*, u.first_name, u.last_name, u.email as user_email,
                   v.brand, v.model, v.year, v.vehicle_type
            FROM "Appointments" a
            LEFT JOIN "Users" u ON a.user_id = u.id
            LEFT JOIN "Vehicles" v ON a.vehicle_id = v.id
            ORDER BY a.id
        `);
        return result.rows || [];
    }

    // Suppliers
    static async findSupplierByEmail(email) {
        const result = await query('SELECT id FROM "Suppliers" WHERE email = $1', [email]);
        return result.rows[0] || null;
    }

    static async createSupplier(supplierData) {
        const { company_name, contact_person, email, phone, address, delivery_time_days } = supplierData;

        const result = await query(`
            INSERT INTO "Suppliers"
            (company_name, contact_person, email, phone, address, delivery_time_days, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id
        `, [company_name, contact_person, email, phone || null, address || null, delivery_time_days || 7]);

        return result.rows[0];
    }

    // Parts
    static async findPartByPartNumber(part_number) {
        const result = await query('SELECT id FROM "Parts" WHERE part_number = $1', [part_number]);
        return result.rows[0] || null;
    }

    static async createPart(partData) {
        const { name, description, part_number, category, price, stock_quantity, minimum_stock_level, supplier_id } = partData;

        const result = await query(`
            INSERT INTO "Parts"
            (name, description, part_number, category, price, stock_quantity, minimum_stock_level, supplier_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING id
        `, [name, description || null, part_number || null, category || null, price, stock_quantity || 0, minimum_stock_level || 5, supplier_id || null]);

        return result.rows[0];
    }

    // Appointments
    static async createAppointment(appointmentData) {
        const { user_id, vehicle_id, appointment_date, status, problem_description, estimated_price } = appointmentData;

        const result = await query(`
            INSERT INTO "Appointments"
            (user_id, vehicle_id, appointment_date, status, problem_description, estimated_price, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id
        `, [user_id, vehicle_id || null, appointment_date, status || 'pending', problem_description, estimated_price || null]);

        return result.rows[0];
    }

    static async userExists(user_id) {
        const result = await query('SELECT id FROM "Users" WHERE id = $1', [user_id]);
        return result.rows.length > 0;
    }

    static async vehicleExists(vehicle_id) {
        const result = await query('SELECT id FROM "Vehicles" WHERE id = $1', [vehicle_id]);
        return result.rows.length > 0;
    }

    static async supplierExists(supplier_id) {
        const result = await query('SELECT id FROM "Suppliers" WHERE id = $1', [supplier_id]);
        return result.rows.length > 0;
    }
}

module.exports = ImportExportModel;