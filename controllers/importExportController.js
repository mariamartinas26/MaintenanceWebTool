const ImportExportModel = require('../models/importExportModel');
const PDFGenerator = require('../utils/pdfGenerator');

const hasImportExportAccess = (userRole) => {
    return userRole==='accountant';
};

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}


function parseCSV(csvData) {
    try {
        const lines = csvData.trim().split('\n').filter(line => line.trim());

        const headers = parseCSVLine(lines[0]);
        const results = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = parseCSVLine(lines[i]);

                if (values.length !== headers.length) {
                    errors.push(`Line ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
                    continue;
                }

                const obj = {};
                headers.forEach((header, index) => {
                    const cleanHeader = header.trim().toLowerCase().replace(/\s+/g, '_');
                    obj[cleanHeader] = values[index] ? values[index].trim() : '';
                });
                results.push(obj);
            } catch (lineError) {
                errors.push(`Line ${i + 1}: ${lineError.message}`);
            }
        }
        return results;
    } catch (error) {
        throw new Error(`CSV parsing failed: ${error.message}`);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i += 2;
            } else {
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }

    result.push(current);
    return result;
}


function convertToCSVManual(data, dataType) {
    if (!data || data.length === 0) {
        return '';
    }

    const headers = getCSVHeaders(dataType);
    const headerKeys = Object.keys(headers);
    const headerValues = Object.values(headers);

    // Create header row
    let csv = headerValues.map(h => escapeCSVValue(h)).join(',') + '\n';

    // Create data rows
    data.forEach(row => {
        const values = headerKeys.map(key => {
            let value = row[key];

            // Handle different data types
            if (value === null || value === undefined) {
                return '';
            }

            if (value instanceof Date) {
                return escapeCSVValue(value.toISOString());
            }

            return escapeCSVValue(String(value));
        });
        csv += values.join(',') + '\n';
    });

    return csv;
}

function escapeCSVValue(value) {
    if (typeof value !== 'string') {
        value = String(value);
    }

    // Escape quotes by doubling them
    value = value.replace(/"/g, '""');

    // Wrap in quotes if contains comma, newline, or quote
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`;
    }

    return value;
}


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

        // Validation
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
                message: `Invalid data type. Allowed: ${allowedDataTypes.join(', ')}`
            });
        }

        if (!allowedFormats.includes(format)) {
            return sendJSON(res, 400, {
                success: false,
                message: `Invalid format. Allowed: ${allowedFormats.join(', ')}`
            });
        }

        let parsedData;

        if (format === 'json') {
            try {
                parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (error) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid JSON format: ' + error.message
                });
            }
        } else if (format === 'csv') {
            parsedData = parseCSV(data);
        }

        if (!Array.isArray(parsedData)) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Data must be an array'
            });
        }

        if (parsedData.length === 0) {
            return sendJSON(res, 400, {
                success: false,
                message: 'No data to import'
            });
        }

        const result = await processImport(dataType, parsedData, req.user.id);

        const response = {
            success: true,
            message: `Import completed: ${result.imported} imported`,
        };

        sendJSON(res, 200, response);

    } catch (error) {
        sendJSON(res, 500, {
            success: false,
            message: 'Failed to import data: ' + error.message
        });
    }
};

const exportData = async (req, res) => {
    try {
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
                message: `Invalid data type.`
            });
        }

        if (!allowedFormats.includes(format)) {
            return sendJSON(res, 400, {
                success: false,
                message: `Invalid format.`
            });
        }

        const data = await getExportData(dataType);

        if (data.length === 0) {
            return sendJSON(res, 404, {
                success: false,
                message: `No ${dataType} data found to export`
            });
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${dataType}_export_${timestamp}`;

        if (format === 'json') {
            sendJSON(res, 200, {
                success: true,
                data: data,
            });
        } else if (format === 'csv') {
            const csvData = convertToCSVManual(data, dataType);
            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}.csv"`,
                'Content-Length': Buffer.byteLength(csvData, 'utf8')
            });
            res.end(csvData);
        } else if (format === 'pdf') {
            try {
                const pdfBuffer = await PDFGenerator.generatePDF(data, dataType);

                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}.pdf"`,
                    'Content-Length': pdfBuffer.length
                });
                res.end(pdfBuffer);
            } catch (pdfError) {
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Failed to generate PDF'
                });
            }
        }

    } catch (error) {
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to export data'
            });
        }
    }
};

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
                supplier_id: 'Supplier ID',
                supplier_name: 'Supplier Name',
            };
        case 'appointments':
            return {
                id: 'ID',
                user_id: 'User ID',
                first_name: 'First Name',
                last_name: 'Last Name',
                user_email: 'User Email',
                vehicle_id: 'Vehicle ID',
                brand: 'Vehicle Brand',
                model: 'Vehicle Model',
                year: 'Vehicle Year',
                appointment_date: 'Appointment Date',
                status: 'Status',
                problem_description: 'Problem Description',
                estimated_price: 'Estimated Price',
            };
        default:
            return {};
    }
}

async function getExportData(dataType) {
    try {
        switch (dataType) {
            case 'suppliers':
                return await ImportExportModel.getAllSuppliers();
            case 'parts':
                return await ImportExportModel.getAllParts();
            case 'appointments':
                return await ImportExportModel.getAllAppointments();
        }
    } catch (error) {
        throw new Error('Failed to retrieve export data');
    }
}

async function processImport(dataType, data, userId) {
    const results = {
        imported: 0,
        skipped: 0,
        errors: []
    };

    for (const [index, item] of data.entries()) {
        try {
            switch (dataType) {
                case 'suppliers':
                    await importSupplier(item, userId);
                    break;
                case 'parts':
                    await importPart(item, userId);
                    break;
                case 'appointments':
                    await importAppointment(item, userId);
                    break;
            }
            results.imported++;
        } catch (error) {
            results.errors.push({
                row: index + 1,
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

    const existingSupplier = await ImportExportModel.findSupplierByEmail(email);
    if (existingSupplier) {
        throw new Error(`Supplier with email ${email} already exists`);
    }

    await ImportExportModel.createSupplier({
        company_name,
        contact_person,
        email,
        phone,
        address,
        delivery_time_days: delivery_time_days || 7
    });
}

async function importPart(item, userId) {
    const { name, description, part_number, category, price, stock_quantity, minimum_stock_level, supplier_id } = item;

    if (!name || !price) {
        throw new Error('Missing required fields: name, price');
    }

    if (part_number) {
        const existingPart = await ImportExportModel.findPartByPartNumber(part_number);
        if (existingPart) {
            throw new Error(`Part with part_number ${part_number} already exists`);
        }
    }

    if (supplier_id) {
        const supplierExists = await ImportExportModel.supplierExists(supplier_id);
        if (!supplierExists) {
            throw new Error(`Supplier with id ${supplier_id} does not exist`);
        }
    }

    await ImportExportModel.createPart({
        name,
        description,
        part_number,
        category,
        price: parseFloat(price),
        stock_quantity: parseInt(stock_quantity) || 0,
        minimum_stock_level: parseInt(minimum_stock_level) || 5,
        supplier_id
    });
}

async function importAppointment(item, userId) {
    const { user_id, vehicle_id, appointment_date, status, problem_description, estimated_price } = item;

    if (!user_id || !appointment_date || !problem_description) {
        throw new Error('Missing required fields: user_id, appointment_date, problem_description');
    }

    const userExists = await ImportExportModel.userExists(user_id);
    if (!userExists) {
        throw new Error(`User with id ${user_id} does not exist`);
    }

    if (vehicle_id) {
        const vehicleExists = await ImportExportModel.vehicleExists(vehicle_id);
        if (!vehicleExists) {
            throw new Error(`Vehicle with id ${vehicle_id} does not exist`);
        }
    }

    await ImportExportModel.createAppointment({
        user_id,
        vehicle_id,
        appointment_date,
        status: status || 'pending',
        problem_description,
        estimated_price: estimated_price ? parseFloat(estimated_price) : null
    });
}

module.exports = {
    importData,
    exportData
};