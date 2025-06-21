const SupplierController = require('./supplierController');
const AccountantModel = require('../models/accountantModel');
const PDFGenerator = require('../utils/pdfGenerator');

const hasAccountantAccess = (userRole) => {
    return ['accountant'].includes(userRole);
};

const hasImportExportAccess = (userRole) => {
    return ['accountant'].includes(userRole);
};

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const getDashboard = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        sendJSON(res, 200, {
            success: true,
            data: {
                user: {
                    id: req.user.id,
                    name: `${req.user.first_name} ${req.user.last_name}`,
                    role: req.user.role
                },
                permissions: {
                    suppliers: hasAccountantAccess(userRole),
                    importExport: hasImportExportAccess(userRole),
                }
            },
            message: 'Accountant dashboard data retrieved successfully'
        });

    } catch (error) {
        console.error('Error in getDashboard:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Failed to retrieve dashboard data'
        });
    }
};

const getSuppliers = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            console.log('Access denied for role:', userRole);
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        // Apelează getAllSuppliers din supplierController
        await SupplierController.getAllSuppliers(req, res, req.query || {});

    } catch (error) {
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to retrieve suppliers: ' + error.message
            });
        }
    }
};

const getSupplierById = async (req, res) => {
    try {
        const userRole = req.user.role;

        if (!hasAccountantAccess(userRole)) {
            return sendJSON(res, 403, {
                success: false,
                message: 'Access denied. Accountant role required.'
            });
        }

        await SupplierController.getSupplierById(req, res, req.params);

    } catch (error) {
        console.error('Error in getSupplierById:', error);
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to retrieve supplier: ' + error.message
            });
        }
    }
};


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

        console.log('Import request:', { dataType, format, dataLength: data.length });

        let parsedData;

        // Parse data bazat pe format
        if (format === 'json') {
            try {
                parsedData = JSON.parse(data);
            } catch (error) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid JSON format: ' + error.message
                });
            }
        } else if (format === 'csv') {
            try {
                parsedData = parseCSV(data);
            } catch (error) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid CSV format: ' + error.message
                });
            }
        } else {
            return sendJSON(res, 400, {
                success: false,
                message: 'Unsupported format. Use json or csv'
            });
        }

        if (!Array.isArray(parsedData)) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Data must be an array of objects'
            });
        }

        // Import în baza de date bazat pe tip
        let importResult;

        switch (dataType) {
            case 'suppliers':
                importResult = await AccountantModel.importSuppliers(parsedData);
                break;
            case 'parts':
                importResult = await AccountantModel.importParts(parsedData);
                break;
            case 'appointments':
                importResult = await AccountantModel.importAppointments(parsedData);
                break;
            default:
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid data type. Supported: suppliers, parts, appointments'
                });
        }

        return sendJSON(res, 200, {
            success: true,
            message: `Successfully imported ${importResult.imported} ${dataType} records`,
            data: {
                imported: importResult.imported,
                failed: importResult.failed,
                errors: importResult.errors
            }
        });

    } catch (error) {
        console.error('Error in importData:', error);
        if (!res.headersSent) {
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to import data: ' + error.message
            });
        }
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

        console.log('Export request:', { dataType, format });

        // Obține date reale din baza de date
        let exportData;

        switch (dataType) {
            case 'suppliers':
                exportData = await AccountantModel.getSuppliers();
                break;
            case 'parts':
                exportData = await AccountantModel.getParts();
                break;
            case 'appointments':
                exportData = await AccountantModel.getAppointments();
                break;
            default:
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid data type. Supported: suppliers, parts, appointments'
                });
        }

        if (!exportData || exportData.length === 0) {
            return sendJSON(res, 404, {
                success: false,
                message: `No ${dataType} data found for export`
            });
        }

        // Returnează datele în formatul cerut
        if (format === 'json') {
            return sendJSON(res, 200, {
                success: true,
                data: exportData,
                count: exportData.length
            });
        } else if (format === 'csv') {
            const csv = convertToCSV(exportData);
            res.writeHead(200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${dataType}_export_${getCurrentDate()}.csv"`
            });
            res.end(csv);
        } else if (format === 'pdf') {
            try {
                const pdfBuffer = await PDFGenerator.generatePDF(exportData, dataType);

                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${dataType}_export_${getCurrentDate()}.pdf"`
                });
                res.end(pdfBuffer);
            } catch (pdfError) {
                console.error('PDF generation error:', pdfError);
                return sendJSON(res, 500, {
                    success: false,
                    message: 'Failed to generate PDF: ' + pdfError.message
                });
            }
        } else {
            return sendJSON(res, 400, {
                success: false,
                message: 'Invalid format. Supported: json, csv, pdf'
            });
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


function parseCSV(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV must have at least header and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }
    }

    return data;
}

function convertToCSV(data) {
    if (!data || data.length === 0) {
        return 'No data available';
    }

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row => {
        return headers.map(header => {
            let cell = row[header];
            if (cell === null || cell === undefined) {
                cell = '';
            }
            // Escape commas and quotes
            cell = String(cell).replace(/"/g, '""');
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                cell = `"${cell}"`;
            }
            return cell;
        }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
}

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

module.exports = {
    getDashboard,
    getSuppliers,
    getSupplierById,
    importData,
    exportData
};