const AdminAppointment = require('../models/AdminAppointment');
const AppointmentParts = require('../models/AppointmentParts');
const Part = require('../models/Part');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateNumber(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseFloat(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateStatus(status) {
    const validStatuses = ['pending', 'approved', 'rejected'];
    return validStatuses.includes(status) ? status : null;
}

function sendJSON(res, statusCode, data) {
    setSecurityHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class AdminAppointmentsController {
    static async getAppointmentsForAdmin(req, res) {
        try {
            setSecurityHeaders(res);

            const status = validateInput(req.query.status);
            const date_filter = validateInput(req.query.date_filter);
            const search = validateInput(req.query.search);

            const filters = {};
            if (status && status !== 'all' && validateStatus(status)) {
                filters.status = status;
            }
            if (date_filter && date_filter !== 'all') {
                filters.date_filter = date_filter;
            }

            const appointments = await AdminAppointment.getAllForAdmin(filters);

            let formattedAppointments = appointments.map(appointment => ({
                id: appointment.id,
                clientName: `${validateInput(appointment.first_name) || ''} ${validateInput(appointment.last_name) || ''}`.trim(),
                clientEmail: validateInput(appointment.email),
                clientPhone: validateInput(appointment.phone),
                appointmentDate: appointment.appointment_date,
                status: validateInput(appointment.status),
                problemDescription: validateInput(appointment.problem_description),
                adminResponse: validateInput(appointment.admin_response),
                rejectionReason: validateInput(appointment.rejection_reason),
                retryDays: validateInteger(appointment.retry_days),
                estimatedPrice: validateNumber(appointment.estimated_price),
                estimatedCompletionTime: validateInput(appointment.estimated_completion_time),
                warrantyInfo: validateInput(appointment.warranty_info),
                serviceType: appointment.vehicle_type ?
                    `${validateInput(appointment.vehicle_type)} ${validateInput(appointment.brand) || ''} ${validateInput(appointment.model) || ''}${appointment.year ? ` (${validateInteger(appointment.year)})` : ''}`.trim() :
                    'Unknown vehicle type',
                vehicleInfo: {
                    type: validateInput(appointment.vehicle_type),
                    brand: validateInput(appointment.brand),
                    model: validateInput(appointment.model),
                    year: validateInteger(appointment.year),
                    isElectric: Boolean(appointment.is_electric)
                },
                createdAt: appointment.created_at,
                updatedAt: appointment.updated_at
            }));

            if (search && search.trim()) {
                const searchTerm = search.toLowerCase().trim();
                formattedAppointments = formattedAppointments.filter(appointment =>
                    appointment.clientName.toLowerCase().includes(searchTerm) ||
                    appointment.clientEmail.toLowerCase().includes(searchTerm) ||
                    appointment.problemDescription.toLowerCase().includes(searchTerm) ||
                    appointment.serviceType.toLowerCase().includes(searchTerm)
                );
            }

            sendJSON(res, 200, {
                success: true,
                message: 'Appointments loaded successfully.',
                appointments: formattedAppointments,
                total: formattedAppointments.length
            });

        } catch (error) {
            console.error('Error in getAppointmentsForAdmin:', error);
            console.error('Stack trace:', error.stack);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading appointments for admin',
                error: process.env.NODE_ENV === 'development' ? validateInput(error.message) : undefined
            });
        }
    }

    static async getAppointmentDetails(req, res) {
        try {
            setSecurityHeaders(res);

            const appointmentId = validateInteger(req.params.id, 1);

            if (!appointmentId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid appointment ID'
                });
            }

            const appointment = await AdminAppointment.getByIdForAdmin(appointmentId);
            if (!appointment) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Appointment was not found'
                });
            }

            const appointmentParts = await AppointmentParts.getAppointmentParts(appointmentId);

            const formattedAppointment = {
                id: appointment.id,
                clientInfo: {
                    name: `${validateInput(appointment.first_name) || ''} ${validateInput(appointment.last_name) || ''}`.trim(),
                    email: validateInput(appointment.email),
                    phone: validateInput(appointment.phone)
                },
                appointmentDate: appointment.appointment_date,
                status: validateInput(appointment.status),
                problemDescription: validateInput(appointment.problem_description),
                adminResponse: validateInput(appointment.admin_response),
                rejectionReason: validateInput(appointment.rejection_reason),
                retryDays: validateInteger(appointment.retry_days),
                estimatedPrice: validateNumber(appointment.estimated_price),
                estimatedCompletionTime: validateInput(appointment.estimated_completion_time),
                warrantyInfo: validateInput(appointment.warranty_info),
                vehicleInfo: {
                    type: validateInput(appointment.vehicle_type),
                    brand: validateInput(appointment.brand),
                    model: validateInput(appointment.model),
                    year: validateInteger(appointment.year),
                    isElectric: Boolean(appointment.is_electric),
                    notes: validateInput(appointment.vehicle_notes)
                },
                selectedParts: appointmentParts.map(part => ({
                    id: part.id,
                    partId: part.part_id,
                    partName: validateInput(part.part_name),
                    partNumber: validateInput(part.part_number),
                    category: validateInput(part.category),
                    description: validateInput(part.description),
                    quantity: validateInteger(part.quantity, 0),
                    unitPrice: validateNumber(part.unit_price, 0),
                    subtotal: validateNumber(part.subtotal, 0)
                })),
                createdAt: appointment.created_at,
                updatedAt: appointment.updated_at
            };

            sendJSON(res, 200, {
                success: true,
                message: 'Appointment details loaded successfully',
                appointment: formattedAppointment
            });

        } catch (error) {
            console.error('Error in getAppointmentDetails:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading appointment details',
                error: process.env.NODE_ENV === 'development' ? validateInput(error.message) : undefined
            });
        }
    }

    static async updateAppointmentStatus(req, res) {
        try {
            setSecurityHeaders(res);

            const appointmentId = validateInteger(req.params.id, 1);

            if (!appointmentId) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid appointment id',
                });
            }

            const currentAppointment = await AdminAppointment.getByIdForAdmin(appointmentId);

            if (!currentAppointment) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Appointment not found'
                });
            }

            if (currentAppointment.status === 'approved' || currentAppointment.status === 'rejected') {
                return sendJSON(res, 400, {
                    success: false,
                    message: `Cannot modify appointment: already ${currentAppointment.status}`,
                    currentStatus: currentAppointment.status
                });
            }

            const status = validateInput(req.body.status);
            const adminResponse = validateInput(req.body.adminResponse);
            const estimatedPrice = validateNumber(req.body.estimatedPrice, 0);
            const warranty = validateInteger(req.body.warranty, 0);
            const rejectionReason = validateInput(req.body.rejectionReason);
            const retryDays = validateInteger(req.body.retryDays, 1);
            const selectedParts = Array.isArray(req.body.selectedParts) ? req.body.selectedParts : [];

            if (!validateStatus(status)) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid status'
                });
            }

            if (status === 'approved') {
                if (!estimatedPrice || estimatedPrice <= 0) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Estimated price is mandatory for approval'
                    });
                }
                if (warranty === null || warranty < 0) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Warranty is mandatory for approval'
                    });
                }

                if (selectedParts && selectedParts.length > 0) {
                    if (selectedParts.length > 100) {
                        return sendJSON(res, 400, {
                            success: false,
                            message: 'Too many parts selected'
                        });
                    }

                    const sanitizedParts = selectedParts.map(part => ({
                        partId: validateInteger(part.partId, 1),
                        quantity: validateInteger(part.quantity, 1, 1000),
                        unitPrice: validateNumber(part.unitPrice, 0)
                    })).filter(part => part.partId && part.quantity && part.unitPrice !== null);

                    const partValidation = await Part.checkAvailability(sanitizedParts);
                    if (!partValidation.available) {
                        const errorDetails = partValidation.unavailableParts.map(part => {
                            if (part.reason === 'Part not found') {
                                return `Part ID ${part.partId}: Not found`;
                            } else {
                                return `${validateInput(part.name)}: Requested ${part.requested}, Available ${part.available}`;
                            }
                        }).join('; ');

                        return sendJSON(res, 400, {
                            success: false,
                            message: 'Cannot approve appointment due to insufficient stock',
                            details: errorDetails,
                            unavailableParts: partValidation.unavailableParts
                        });
                    }
                }
            }

            if (status === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Reason for rejection is mandatory'
                });
            }

            const updateData = {
                status,
                adminResponse: null,
                rejectionReason: null,
                retryDays: null,
                estimatedPrice: null,
                warrantyInfo: null
            };

            if (status !== 'rejected') {
                updateData.adminResponse = adminResponse && adminResponse.trim() ? adminResponse.trim() : null;
            }

            if (status === 'rejected') {
                const rejectionReasons = {
                    'parts': 'Unavailable mechanic parts',
                    'schedule': 'Full schedule',
                    'expertise': 'Beyond our area of expertise',
                    'other': 'Another reason'
                };

                const reasonText = rejectionReasons[rejectionReason] || rejectionReason;
                updateData.rejectionReason = reasonText;
                updateData.retryDays = retryDays && retryDays > 0 ? retryDays : null;
            }

            if (status === 'approved') {
                updateData.estimatedPrice = estimatedPrice;
                updateData.warrantyInfo = `${warranty} warranty months`;
            }

            const sanitizedParts = selectedParts.map(part => ({
                partId: validateInteger(part.partId, 1),
                quantity: validateInteger(part.quantity, 1, 1000),
                unitPrice: validateNumber(part.unitPrice, 0)
            })).filter(part => part.partId && part.quantity && part.unitPrice !== null);

            const updatedAppointment = await AdminAppointment.updateStatusWithParts(
                appointmentId,
                updateData,
                sanitizedParts
            );

            const statusMessages = {
                'approved': 'Appointment was approved successfully',
                'rejected': 'Appointment was rejected',
                'pending': 'Appointment was set to pending',
            };

            let partsInfo = null;
            let stockInfo = null;

            if (status === 'approved' && sanitizedParts && sanitizedParts.length > 0) {
                const partsTotal = await AppointmentParts.getAppointmentPartsTotal(appointmentId);
                partsInfo = {
                    partsCount: validateInteger(partsTotal.partsCount, 0),
                    totalPartsCost: validateNumber(partsTotal.totalCost, 0)
                };

                if (updatedAppointment.stockUpdateResult) {
                    stockInfo = {
                        partsUpdated: validateInteger(updatedAppointment.stockUpdateResult.totalPartsUpdated, 0),
                        updatedParts: updatedAppointment.stockUpdateResult.updatedParts.map(part => ({
                            name: validateInput(part.name),
                            quantityUsed: validateInteger(part.quantityUsed, 0),
                            remainingStock: validateInteger(part.stock_quantity, 0),
                            previousStock: validateInteger(part.previous_stock, 0)
                        }))
                    };
                }
            }

            let lowStockWarnings = null;
            if (stockInfo && stockInfo.updatedParts) {
                const lowStockParts = stockInfo.updatedParts.filter(part => {
                    return part.remainingStock <= 5;
                });

                if (lowStockParts.length > 0) {
                    lowStockWarnings = lowStockParts.map(part =>
                        `${part.name}: Only ${part.remainingStock} remaining`
                    );
                }
            }

            const responseData = {
                success: true,
                message: statusMessages[status],
                appointment: {
                    id: updatedAppointment.id,
                    status: validateInput(updatedAppointment.status),
                    adminResponse: validateInput(updatedAppointment.admin_response),
                    rejectionReason: validateInput(updatedAppointment.rejection_reason),
                    retryDays: validateInteger(updatedAppointment.retry_days),
                    estimatedPrice: validateNumber(updatedAppointment.estimated_price),
                    warrantyInfo: validateInput(updatedAppointment.warranty_info),
                    updatedAt: updatedAppointment.updated_at
                }
            };

            if (partsInfo) {
                responseData.partsInfo = partsInfo;
            }
            if (stockInfo) {
                responseData.stockInfo = stockInfo;
            }
            if (lowStockWarnings) {
                responseData.lowStockWarnings = lowStockWarnings;
                responseData.message += ` (Warning: Low stock detected on ${lowStockWarnings.length} parts)`;
            }

            sendJSON(res, 200, responseData);

        } catch (error) {
            console.error('Error in updateAppointmentStatus:', error);

            if (error.message.includes('Cannot modify appointment: already')) {
                return sendJSON(res, 400, {
                    success: false,
                    message: error.message,
                    reason: 'appointment_finalized'
                });
            }

            if (error.message.includes('Insufficient stock') || error.message.includes('Stock validation failed')) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Stock validation error',
                    details: validateInput(error.message)
                });
            }

            sendJSON(res, 500, {
                success: false,
                message: 'Error updating appointment status',
                details: process.env.NODE_ENV === 'development' ? validateInput(error.message) : undefined
            });
        }
    }

    static async getLowStockParts(req, res) {
        try {
            setSecurityHeaders(res);

            const lowStockParts = await Part.getLowStockParts();

            const sanitizedParts = lowStockParts.map(part => ({
                ...part,
                name: validateInput(part.name),
                part_number: validateInput(part.part_number),
                category: validateInput(part.category),
                description: validateInput(part.description),
                stock_quantity: validateInteger(part.stock_quantity, 0),
                min_stock_level: validateInteger(part.min_stock_level, 0)
            }));

            sendJSON(res, 200, {
                success: true,
                message: 'Low stock parts loaded successfully',
                parts: sanitizedParts,
                count: sanitizedParts.length
            });

        } catch (error) {
            console.error('Error in getLowStockParts:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading low stock parts',
                error: process.env.NODE_ENV === 'development' ? validateInput(error.message) : undefined
            });
        }
    }
}

module.exports = AdminAppointmentsController;