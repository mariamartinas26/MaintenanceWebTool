const ImportExportModel = require('../models/importExportModel');
const PDFGenerator = require('../utils/pdfGenerator');
const {validateSupplierData, validatePartData, validateImportAppointmentData, sanitizeUserInput} = require('../utils/validation');

class ImportExportController {
    static hasImportExportAccess(userRole) {
        return userRole === 'accountant';
    }

    static sendJSON(res, statusCode, data) {
        res.writeHead(statusCode, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data));
    }

    static async importData(req, res) {
        try {
            const userRole = req.user.role;

            if (!ImportExportController.hasImportExportAccess(userRole)) {
                return ImportExportController.sendJSON(res, 403, {
                    success: false,
                    message: 'Access denied'
                });
            }
            //extrag parametrii
            //extrag din cerere tipul de date de importat(suppliers,parts,appointments), formatul si datele efective
            const {dataType, format, data} = req.body;

            if (!dataType || !format || !data) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: 'Missing required fields: dataType, format, data'
                });
            }

            const allowedDataTypes = ['suppliers', 'parts', 'appointments'];
            const allowedFormats = ['csv', 'json'];

            if (!allowedDataTypes.includes(dataType)) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: `Invalid data type`
                });
            }
            if (!allowedFormats.includes(format)) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: `Invalid format`
                });
            }
            let parsedData;
            if (format === 'json') {
                try {
                    parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                } catch (error) {
                    return ImportExportController.sendJSON(res, 400, {
                        success: false,
                        message: 'Invalid JSON format: ' + error.message
                    });
                }
            } else if (format === 'csv') {
                parsedData = ImportExportController.parseCSV(data);
            }

            if (!Array.isArray(parsedData)) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: 'Data must be an array'
                });
            }
            if (parsedData.length === 0) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: 'No data to import'
                });
            }
            //apelez functia care face importul in bd
            const result = await ImportExportController.processImport(dataType, parsedData, req.user.id);
            const response = {
                success: true,
                message: `Import completed`,
                details: {
                    imported: result.imported,
                    skipped: result.skipped,
                    errors: result.errors
                }
            };
            ImportExportController.sendJSON(res, 200, response);
        } catch (error) {
            ImportExportController.sendJSON(res, 500, {
                success: false,
                message: 'Failed to import data: ' + error.message
            });
        }
    }

    static async exportData(req, res) {
        try {
            const userRole = req.user.role;
            if (!ImportExportController.hasImportExportAccess(userRole)) {
                return ImportExportController.sendJSON(res, 403, {
                    success: false,
                    message: 'Access denied'
                });
            }
            //extragem parametrii
            //supplier/parts/appointments+formatul de export
            const {dataType, format} = req.body;

            if (!dataType || !format) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: 'Missing required fields: dataType, format'
                });
            }
            const allowedDataTypes = ['suppliers', 'parts', 'appointments'];
            const allowedFormats = ['csv', 'json', 'pdf'];

            if (!allowedDataTypes.includes(dataType)) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: `Invalid data type.`
                });
            }

            if (!allowedFormats.includes(format)) {
                return ImportExportController.sendJSON(res, 400, {
                    success: false,
                    message: `Invalid format.`
                });
            }
            //obtinem datele de export din bd
            const data = await ImportExportController.getExportData(dataType);

            if (data.length === 0) {
                return ImportExportController.sendJSON(res, 404, {
                    success: false,
                    message: `No data found to export`
                });
            }
            //numele fisierului
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `${dataType}_export_${timestamp}`;

            if (format === 'json') {
                const jsonData = JSON.stringify(data, null, 2);
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}.json"`,
                    'Content-Length': Buffer.byteLength(jsonData, 'utf8')
                });
                res.end(jsonData);
            } else if (format === 'csv') {
                //convertim in format csv
                const csvData = ImportExportController.convertToCSV(data, dataType);
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
                    return ImportExportController.sendJSON(res, 500, {
                        success: false,
                        message: 'Failed to generate PDF'
                    });
                }
            }

        } catch (error) {
            if (!res.headersSent) {
                ImportExportController.sendJSON(res, 500, {
                    success: false,
                    message: 'Failed to export data'
                });
            }
        }
    }

    static parseCSV(csvData) {
        try {
            //iau textul il impart pe linii fara spatii si linii goale
            const lines = csvData.trim().split('\n').filter(line => line.trim());

            //prima linie contine header-ele
            const headers = ImportExportController.parseCSVLine(lines[0]);
            const results = [];
            const errors = [];
            //parcurg fiecare linie de date si o parsez
            for (let i = 1; i < lines.length; i++) {
                try {
                    const values = ImportExportController.parseCSVLine(lines[i]);
                    //verific daca nr de coloane la linia curenta = nr col headere
                    if (values.length !== headers.length) {
                        errors.push(`Not equal column number`);
                        continue;
                    }
                    //pt fiecare linie valida fac un obiect
                    //fac match intre header si valoare
                    const obj = {};
                    headers.forEach((header, index) => {
                        const cleanHeader = header.trim().toLowerCase().replace(/\s+/g, '_');
                        obj[cleanHeader] = values[index] ? values[index].trim() : '';
                    });
                    results.push(obj);
                } catch (lineError) {
                    errors.push(`Error`);
                }
            }
            return results;
        } catch (error) {
            throw new Error(`CSV parsing failed: ${error.message}`);
        }
    }

    //parsare linie csv
    static parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            //gestionam ghilimelele
            if (char === '"') {
                inQuotes = !inQuotes;
                i++;
                //gestionare virgula ( separator)
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
                i++;
                //caracter nromal
            } else {
                current += char;
                i++;
            }
        }
        result.push(current);
        return result;
    }

    static addQuotes(value) {
        //convertesc tot la string
        if (typeof value !== 'string') {
            value = String(value);
        }
        //daca valoarea mea are virgule sau newline o pun intre ghilimele
        if (value.includes(',') || value.includes('\n')) {
            value = `"${value}"`;
        }
        return value;
    }

    static convertToCSV(data, dataType) {
        if (!data || data.length === 0) {
            return '';
        }

        const headers = ImportExportController.getCSVHeaders(dataType);//headere in functie de ce dorim sa exportam
        const headerKeys = Object.keys(headers);
        const headerValues = Object.values(headers);

        //creez linia de header
        let csv = headerValues.map(h => ImportExportController.addQuotes(h)).join(',') + '\n';

        //liniile de date
        data.forEach(row => {
            const values = headerKeys.map(key => {
                let value = row[key];

                //valori invalide
                if (value === null || value === undefined) {
                    return '';
                }

                if (value instanceof Date) {
                    return ImportExportController.addQuotes(value.toISOString());
                }
                //convertim tot la string si punem ghilimele daca e necesar
                return ImportExportController.addQuotes(String(value));
            });
            csv += values.join(',') + '\n';
        });

        return csv;
    }

    static getCSVHeaders(dataType) {
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
    //exportul din bd
    static async getExportData(dataType) {
        try {
            switch (dataType) {
                case 'suppliers':
                    return await ImportExportModel.getAllSuppliers();
                case 'parts':
                    return await ImportExportModel.getAllParts();
                case 'appointments':
                    return await ImportExportModel.getAllAppointments();
                default:
                    throw new Error('Invalid data type');
            }
        } catch (error) {
            throw new Error('Failed to export data');
        }
    }

    //functia care face efectiv importul in bd
    static async processImport(dataType, data, userId) {
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };
        //parcurg fiecare entry din array
        for (const [index, item] of data.entries()) {
            try {
                const sanitizedItem = sanitizeUserInput(item);
                switch (dataType) {
                    case 'suppliers':
                        await ImportExportController.importSupplier(sanitizedItem, userId);
                        break;
                    case 'parts':
                        await ImportExportController.importPart(sanitizedItem, userId);
                        break;
                    case 'appointments':
                        await ImportExportController.importAppointment(sanitizedItem, userId);
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

    static async importSupplier(item) {
        //validation.js
        const validation = validateSupplierData(item);
        if (!validation.isValid) {
            throw new Error(`Validation error`);
        }
        //extrag parametriii
        const {company_name, contact_person, email, phone, address, delivery_time_days} = item;

        //verific daca exista deja
        const existingSupplier = await ImportExportModel.findSupplierByEmail(email);
        if (existingSupplier) {
            throw new Error(`Supplier already exists`);
        }
        //import supplierul
        await ImportExportModel.createSupplier({
            company_name,
            contact_person,
            email,
            phone,
            address,
            delivery_time_days: delivery_time_days
        });
    }

    static async importPart(item) {
        const validation = validatePartData(item);
        if (!validation.isValid) {
            throw new Error(`Validation error`);
        }
        const {
            name,
            description,
            part_number,
            category,
            price,
            stock_quantity,
            minimum_stock_level,
            supplier_id
        } = item;

        //verific daca piesa deja exista
        if (part_number) {
            const existingPart = await ImportExportModel.findPartByPartNumber(part_number);
            if (existingPart) {
                throw new Error(`Part already exists`);
            }
        }

        //verific daca supplierul exista
        if (supplier_id) {
            const supplierExists = await ImportExportModel.supplierExists(supplier_id);
            if (!supplierExists) {
                throw new Error(`Supplier does not exist`);
            }
        }

        await ImportExportModel.createPart({
            name,
            description,
            part_number,
            category,
            price: parseFloat(price),
            stock_quantity: parseInt(stock_quantity),
            minimum_stock_level: parseInt(minimum_stock_level),
            supplier_id
        });
    }

    static async importAppointment(item, userId) {
        const validation = validateImportAppointmentData(item);
        if (!validation.isValid) {
            throw new Error(`Validation error`);
        }

        const {user_id, vehicle_id, appointment_date, status, problem_description, estimated_price} = item;

        //verific daca exista userul
        const userExists = await ImportExportModel.userExists(user_id);
        if (!userExists) {
            throw new Error(`User does not exist`);
        }

        //verific daca exista vehiculul
        if (vehicle_id) {
            const vehicleExists = await ImportExportModel.vehicleExists(vehicle_id);
            if (!vehicleExists) {
                throw new Error(`Vehicle does not exist`);
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
}

module.exports = ImportExportController;