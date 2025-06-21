const ImportExportModel = require('../models/importExportModel');
const PDFGenerator = require('../utils/pdfGenerator');

const hasImportExportAccess = (userRole) => {
    return ['admin', 'manager', 'accountant'].includes(userRole);
};

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Import functionality
const importData = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasImportExportAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Import/Export access required.'
            });
        }

        const { dataType, format, data } = req.body;

        if (!dataType || !format || !data) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Missing required fields: dataType, format, data'
            });
        }

        const allowedDataTypes = ['suppliers', 'parts', 'appointments'];
        const allowedFormats = ['csv', 'json'];

        if (!allowedDataTypes.includes(dataType)) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Invalid data type. Allowed: suppliers, parts, appointments'
            });
        }

        if (!allowedFormats.includes(format)) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Invalid format. Allowed: csv, json'
            });
        }

        let parsedData;

        if (format === 'json') {
            try {
                parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (error) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid JSON format'
                });
            }
        } else if (format === 'csv') {
            parsedData = parseCSVManual(data);
        }

        if (!Array.isArray(parsedData)) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Data must be an array'
            });
        }

        const result = await processImport(dataType, parsedData, req.user.id);

        sendJSON(res, 200, {
            success: true,
            message: `Successfully imported ${result.imported} ${dataType}`,
            data: result
        });

    } catch (error) {
        console.error('Error in importData:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Failed to import data: ' + error.message
        });
    }
};

// Export functionality
const exportData = async (req, res) => {
    try {
        console.log('=== exportData called ===');
        console.log('Query params:', req.query);
        console.log('User:', req.user);

        const userRole = req.user.role;

        if (!hasImportExportAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Import/Export access required.'
            });
        }

        const { dataType, format } = req.query;

        if (!dataType || !format) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Missing required parameters: dataType, format'
            });
        }

        const allowedDataTypes = ['suppliers', 'parts', 'appointments'];
        const allowedFormats = ['csv', 'json', 'pdf'];

        if (!allowedDataTypes.includes(dataType)) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Invalid data type. Allowed: suppliers, parts, appointments'
            });
        }

        if (!allowedFormats.includes(format)) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Invalid format. Allowed: csv, json, pdf'
            });
        }

        console.log('Getting export data for:', dataType);
        const data = await getExportData(dataType);
        console.log('Export data retrieved, count:', data.length);

        if (format === 'json') {
            sendJSON(res, 200, {
                success: true,
                data: data,
                exported_at: new Date().toISOString(),
                total: data.length
            });
        } else if (format === 'csv') {
            const csvData = convertToCSVManual(data, dataType);
            res.writeHead(200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${dataType}_export_${new Date().toISOString().split('T')[0]}.csv"`
            });
            res.end(csvData);
        } else if (format === 'pdf') {
            try {
                console.log('Generating PDF...');
                const pdfBuffer = await PDFGenerator.generatePDF(data, dataType);

                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${dataType}_export_${new Date().toISOString().split('T')[0]}.pdf"`,
                    'Content-Length': pdfBuffer.length
                });
                res.end(pdfBuffer);
                console.log('PDF generated successfully');
            } catch (pdfError) {
                console.error('PDF generation error:', pdfError);
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Failed to generate PDF: ' + pdfError.message
                });
            }
        }

    } catch (error) {
        console.error('Error in exportData:', error);
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to export data: ' + error.message
            });
        }
    }
};

// ===== HELPER FUNCTIONS =====

// CSV parsing
function parseCSVManual(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
    }

    const headers = parseCSVLine(lines[0]);
    const results = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index] ? values[index].trim() : '';
            });
            results.push(obj);
        }
    }

    return results;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}

// CSV conversion
function convertToCSVManual(data, dataType) {
    if (!data || data.length === 0) {
        return '';
    }

    const headers = getCSVHeaders(dataType);
    const headerKeys = Object.keys(headers);
    const headerValues = Object.values(headers);

    let csv = headerValues.map(h => `"${h}"`).join(',') + '\n';

    data.forEach(row => {
        const values = headerKeys.map(key => {
            let value = row[key] || '';
            if (typeof value === 'string') {
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                    value = `"${value}"`;
                }
            }
            return value;
        });
        csv += values.join(',') + '\n';
    });

    return csv;
}

function getCSVHeaders(dataType) {
    switch (dataType) {
        case 'suppliers':
            return {
                id: 'ID',
                company_name: 'Company Name',
                contact_person: 'Contact Person',
                email: 'Email',
                phone: 'Phone',
                address: 'Address',
                delivery_time_days: 'Delivery Time (Days)',
                created_at: 'Created At'
            };
        case 'parts':
            return {
                id: 'ID',
                name: 'Name',
                description: 'Description',
                part_number: 'Part Number',
                category: 'Category',
                price: 'Price',
                stock_quantity: 'Stock Quantity',
                minimum_stock_level: 'Minimum Stock',
                supplier_id: 'Supplier ID',
                created_at: 'Created At'
            };
        case 'appointments':
            return {
                id: 'ID',
                user_id: 'User ID',
                vehicle_id: 'Vehicle ID',
                appointment_date: 'Appointment Date',
                status: 'Status',
                problem_description: 'Problem Description',
                estimated_price: 'Estimated Price',
                created_at: 'Created At'
            };
        default:
            return {};
    }
}

// Data export using model
async function getExportData(dataType) {
    try {
        switch (dataType) {
            case 'suppliers':
                console.log('Getting suppliers data...');
                return await ImportExportModel.getAllSuppliers();

            case 'parts':
                console.log('Getting parts data...');
                return await ImportExportModel.getAllParts();

            case 'appointments':
                console.log('Getting appointments data...');
                return await ImportExportModel.getAllAppointments();

            default:
                console.log('Unknown data type:', dataType);
                return [];
        }
    } catch (error) {
        console.error('Error in getExportData:', error);
        throw new Error('Failed to retrieve export data: ' + error.message);
    }
}

// Data import using model
async function processImport(dataType, data, userId) {
    const results = {
        imported: 0,
        skipped: 0,
        errors: []
    };

    for (const item of data) {
        try {
            switch (dataType) {
                case 'suppliers':
                    await importSupplier(item, userId);
                    results.imported++;
                    break;

                case 'parts':
                    await importPart(item, userId);
                    results.imported++;
                    break;

                case 'appointments':
                    await importAppointment(item, userId);
                    results.imported++;
                    break;

                default:
                    results.skipped++;
            }
        } catch (error) {
            console.error('Import error for item:', item, error);
            results.errors.push({
                item: item,
                error: error.message
            });
            results.skipped++;
        }
    }

    return results;
}

async function importSupplier(item, userId) {
    const { company_name, contact_person, email, phone, address, delivery_time_days } = item;

    if (!company_name || !contact_person || !email) {
        throw new Error('Missing required fields: company_name, contact_person, email');
    }

    // Check if supplier already exists
    const existingSupplier = await ImportExportModel.findSupplierByEmail(email);
    if (existingSupplier) {
        throw new Error(`Supplier with email ${email} already exists`);
    }

    // Create new supplier
    await ImportExportModel.createSupplier({
        company_name,
        contact_person,
        email,
        phone,
        address,
        delivery_time_days
    });
}

async function importPart(item, userId) {
    const { name, description, part_number, category, price, stock_quantity, minimum_stock_level, supplier_id } = item;

    if (!name || !price) {
        throw new Error('Missing required fields: name, price');
    }

    // Check if part already exists (if part_number is provided)
    if (part_number) {
        const existingPart = await ImportExportModel.findPartByPartNumber(part_number);
        if (existingPart) {
            throw new Error(`Part with part_number ${part_number} already exists`);
        }
    }

    // Validate supplier_id if provided
    if (supplier_id) {
        const supplierExists = await ImportExportModel.supplierExists(supplier_id);
        if (!supplierExists) {
            throw new Error(`Supplier with id ${supplier_id} does not exist`);
        }
    }

    // Create new part
    await ImportExportModel.createPart({
        name,
        description,
        part_number,
        category,
        price,
        stock_quantity,
        minimum_stock_level,
        supplier_id
    });
}

async function importAppointment(item, userId) {
    const { user_id, vehicle_id, appointment_date, status, problem_description, estimated_price } = item;

    if (!user_id || !appointment_date || !problem_description) {
        throw new Error('Missing required fields: user_id, appointment_date, problem_description');
    }

    // Validate user exists
    const userExists = await ImportExportModel.userExists(user_id);
    if (!userExists) {
        throw new Error(`User with id ${user_id} does not exist`);
    }

    // Validate vehicle exists (if provided)
    if (vehicle_id) {
        const vehicleExists = await ImportExportModel.vehicleExists(vehicle_id);
        if (!vehicleExists) {
            throw new Error(`Vehicle with id ${vehicle_id} does not exist`);
        }
    }

    // Create new appointment
    await ImportExportModel.createAppointment({
        user_id,
        vehicle_id,
        appointment_date,
        status,
        problem_description,
        estimated_price
    });
}

module.exports = {
    importData,
    exportData
};