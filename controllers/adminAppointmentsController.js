const AdminAppointment = require('../models/AdminAppointment');
const AppointmentParts = require('../models/AppointmentParts');
const Part = require('../models/Part');

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class AdminAppointmentsController {
    // GET /admin/api/appointments - Get all appointments for admin dashboard
    static async getAppointmentsForAdmin(req, res) {
        try {
            console.log('Getting appointments for admin...');
            const { status, date_filter, search } = req.query;
            console.log('Query params:', { status, date_filter, search });

            const filters = {};
            if (status && status !== 'all') {
                filters.status = status;
            }
            if (date_filter && date_filter !== 'all') {
                filters.date_filter = date_filter;
            }

            console.log('Filters:', filters);
            const appointments = await AdminAppointment.getAllForAdmin(filters); // ✅ Using AdminAppointment
            console.log('Appointments retrieved:', appointments.length);

            // Format appointments for admin dashboard
            let formattedAppointments = appointments.map(appointment => ({
                id: appointment.id,
                clientName: `${appointment.first_name} ${appointment.last_name}`,
                clientEmail: appointment.email,
                clientPhone: appointment.phone,
                appointmentDate: appointment.appointment_date,
                status: appointment.status,
                problemDescription: appointment.problem_description,
                adminResponse: appointment.admin_response,
                rejectionReason: appointment.rejection_reason,
                retryDays: appointment.retry_days,
                estimatedPrice: appointment.estimated_price,
                estimatedCompletionTime: appointment.estimated_completion_time,
                warrantyInfo: appointment.warranty_info,
                serviceType: appointment.vehicle_type ?
                    `${appointment.vehicle_type} ${appointment.brand} ${appointment.model}${appointment.year ? ` (${appointment.year})` : ''}` :
                    'Unknown vehicle type',
                vehicleInfo: {
                    type: appointment.vehicle_type,
                    brand: appointment.brand,
                    model: appointment.model,
                    year: appointment.year,
                    isElectric: appointment.is_electric
                },
                createdAt: appointment.created_at,
                updatedAt: appointment.updated_at
            }));

            // Apply search filter
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
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // GET /admin/api/appointments/:id - Get single appointment details for admin
    static async getAppointmentDetails(req, res) {
        try {
            const appointmentId = parseInt(req.params.id);

            if (!appointmentId || appointmentId <= 0) {
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

            // Get appointment media files
            const mediaFiles = await AdminAppointment.getAppointmentMedia(appointmentId);

            // Get appointment parts
            const appointmentParts = await AppointmentParts.getAppointmentParts(appointmentId);

            // Format appointment details for admin
            const formattedAppointment = {
                id: appointment.id,
                clientInfo: {
                    name: `${appointment.first_name} ${appointment.last_name}`,
                    email: appointment.email,
                    phone: appointment.phone
                },
                appointmentDate: appointment.appointment_date,
                status: appointment.status,
                problemDescription: appointment.problem_description,
                adminResponse: appointment.admin_response,
                rejectionReason: appointment.rejection_reason,
                retryDays: appointment.retry_days,
                estimatedPrice: appointment.estimated_price,
                estimatedCompletionTime: appointment.estimated_completion_time,
                warrantyInfo: appointment.warranty_info,
                vehicleInfo: {
                    type: appointment.vehicle_type,
                    brand: appointment.brand,
                    model: appointment.model,
                    year: appointment.year,
                    isElectric: appointment.is_electric,
                    notes: appointment.vehicle_notes
                },
                mediaFiles: mediaFiles.map(file => ({
                    id: file.id,
                    fileName: file.original_filename,
                    fileType: file.file_type,
                    filePath: file.file_path,
                    mimeType: file.mime_type,
                    uploadedAt: file.uploaded_at
                })),
                selectedParts: appointmentParts.map(part => ({
                    id: part.id,
                    partId: part.part_id,
                    partName: part.part_name,
                    partNumber: part.part_number,
                    category: part.category,
                    description: part.description,
                    quantity: part.quantity,
                    unitPrice: part.unit_price,
                    subtotal: part.subtotal
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
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // PUT /admin/api/appointments/:id/status - Update appointment status with stock management
    static async updateAppointmentStatus(req, res) {
        try {
            const appointmentId = parseInt(req.params.id);
            const {
                status,
                adminResponse,
                estimatedPrice,
                warranty,
                rejectionReason,
                retryDays,
                selectedParts = []
            } = req.body;

            if (!appointmentId || appointmentId <= 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid appointment id',
                });
            }

            if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Invalid status'
                });
            }

            // Validate required fields based on status
            if (status === 'approved') {
                if (!estimatedPrice || estimatedPrice <= 0) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Estimated price is mandatory for approval'
                    });
                }
                if (warranty === undefined || warranty === null || warranty < 0) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Warranty is mandatory for approval'
                    });
                }

                // Validate selected parts
                if (selectedParts && selectedParts.length > 0) {
                    const partValidation = await Part.checkAvailability(selectedParts);
                    if (!partValidation.available) {
                        const errorDetails = partValidation.unavailableParts.map(part => {
                            if (part.reason === 'Part not found') {
                                return `Part ID ${part.partId}: Not found`;
                            } else {
                                return `${part.name}: Requested ${part.requested}, Available ${part.available}`;
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

            // Build update data object
            const updateData = {
                status,
                adminResponse: null,
                rejectionReason: null,
                retryDays: null,
                estimatedPrice: null,
                warrantyInfo: null
            };

            // Handle admin response (for non-rejected statuses)
            if (status !== 'rejected') {
                updateData.adminResponse = adminResponse && adminResponse.trim() ? adminResponse.trim() : null;
            }

            // Handle rejection-specific fields
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

            // Handle approval-specific fields
            if (status === 'approved') {
                updateData.estimatedPrice = estimatedPrice;
                updateData.warrantyInfo = `${warranty} warranty months`;
            }

            const updatedAppointment = await AdminAppointment.updateStatusWithParts( // ✅ Using AdminAppointment
                appointmentId,
                updateData,
                selectedParts
            );

            if (!updatedAppointment) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Appointment was not found'
                });
            }

            const statusMessages = {
                'approved': 'Appointment was approved successfully',
                'rejected': 'Appointment was rejected',
                'pending': 'Appointment was set to pending',
            };

            // Get the parts total and stock update info
            let partsInfo = null;
            let stockInfo = null;

            if (status === 'approved' && selectedParts && selectedParts.length > 0) {
                const partsTotal = await AppointmentParts.getAppointmentPartsTotal(appointmentId);
                partsInfo = {
                    partsCount: partsTotal.partsCount,
                    totalPartsCost: partsTotal.totalCost
                };

                // Include stock update information
                if (updatedAppointment.stockUpdateResult) {
                    stockInfo = {
                        partsUpdated: updatedAppointment.stockUpdateResult.totalPartsUpdated,
                        updatedParts: updatedAppointment.stockUpdateResult.updatedParts.map(part => ({
                            name: part.name,
                            quantityUsed: part.quantityUsed,
                            remainingStock: part.stock_quantity,
                            previousStock: part.previous_stock
                        }))
                    };
                }
            }

            // Check for low stock warnings
            let lowStockWarnings = null;
            if (stockInfo && stockInfo.updatedParts) {
                const lowStockParts = stockInfo.updatedParts.filter(part => {
                    // You can adjust this threshold or get it from the database
                    return part.remainingStock <= 5; // Warning when stock is 5 or below
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
                    status: updatedAppointment.status,
                    adminResponse: updatedAppointment.admin_response,
                    rejectionReason: updatedAppointment.rejection_reason,
                    retryDays: updatedAppointment.retry_days,
                    estimatedPrice: updatedAppointment.estimated_price,
                    warrantyInfo: updatedAppointment.warranty_info,
                    updatedAt: updatedAppointment.updated_at
                }
            };

            // Add parts and stock info to response
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

            if (error.message.includes('Insufficient stock') || error.message.includes('Stock validation failed')) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Stock validation error',
                    details: error.message
                });
            }

            sendJSON(res, 500, {
                success: false,
                message: 'Error updating appointment status',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // GET /admin/api/appointments/statistics - Get appointment statistics
    static async getAppointmentStatistics(req, res) {
        try {
            const statistics = await AdminAppointment.getStatistics(); // ✅ Using AdminAppointment

            sendJSON(res, 200, {
                success: true,
                statistics: statistics
            });

        } catch (error) {
            console.error('Error in getAppointmentStatistics:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading statistics',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // GET /admin/api/parts/low-stock - Get parts with low stock levels
    static async getLowStockParts(req, res) {
        try {
            const lowStockParts = await Part.getLowStockParts();

            sendJSON(res, 200, {
                success: true,
                message: 'Low stock parts loaded successfully',
                parts: lowStockParts,
                count: lowStockParts.length
            });

        } catch (error) {
            console.error('Error in getLowStockParts:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading low stock parts',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    static async getAppointmentsForExport(req, res) {
        try {
            const result = await AdminAppointmentsController.getAppointmentsForExportData(req);

            sendJSON(res, 200, {
                success: true,
                data: result,
                total: result.length,
                exported_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Export appointments error:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Failed to export appointments data'
            });
        }
    }

    static async getAppointmentsForExportData(req) {
        try {

            const appointments = await AdminAppointment.getAllForAdmin({});

            return appointments.map(appointment => ({
                id: appointment.id,
                client_name: `${appointment.first_name || ''} ${appointment.last_name || ''}`.trim(),
                client_email: appointment.email,
                client_phone: appointment.phone,
                appointment_date: appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleString() : null,
                status: appointment.status,
                problem_description: appointment.problem_description,
                admin_response: appointment.admin_response,
                rejection_reason: appointment.rejection_reason,
                retry_days: appointment.retry_days,
                estimated_price: appointment.estimated_price ? parseFloat(appointment.estimated_price) : null,
                warranty_info: appointment.warranty_info,
                service_type: appointment.vehicle_type ?
                    `${appointment.vehicle_type} ${appointment.brand || ''} ${appointment.model || ''}${appointment.year ? ` (${appointment.year})` : ''}`.trim() :
                    'Unknown Service',
                vehicle_type: appointment.vehicle_type,
                vehicle_brand: appointment.brand,
                vehicle_model: appointment.model,
                vehicle_year: appointment.year,
                is_electric: appointment.is_electric,
                created_at: appointment.created_at ? new Date(appointment.created_at).toLocaleString() : null,
                updated_at: appointment.updated_at ? new Date(appointment.updated_at).toLocaleString() : null
            }));

        } catch (error) {
            console.error('Error getting appointments for export:', error);
            throw error;
        }
    }
}


module.exports = AdminAppointmentsController;