const Appointment = require('../models/AdminAppointment');
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
            const { status, date_filter, search } = req.query;

            const filters = {};
            if (status && status !== 'all') {
                filters.status = status;
            }
            if (date_filter && date_filter !== 'all') {
                filters.date_filter = date_filter;
            }

            const appointments = await Appointment.getAllForAdmin(filters);

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
            console.error('Error loading appointments:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading appointments for admin',
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

            const appointment = await Appointment.getByIdForAdmin(appointmentId);

            if (!appointment) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Appointment was not found'
                });
            }

            // Get appointment media files
            const mediaFiles = await Appointment.getAppointmentMedia(appointmentId);

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
            console.error('Error loading appointment details:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading appointment details'
            });
        }
    }

    // PUT /admin/api/appointments/:id/status - Update appointment status (approve/reject)
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
                selectedParts = [] // New field for selected parts
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

                // Validate selected parts if any
                if (selectedParts && selectedParts.length > 0) {
                    const partValidation = await Part.checkAvailability(selectedParts);
                    if (!partValidation.available) {
                        return sendJSON(res, 400, {
                            success: false,
                            message: 'Some selected parts are not available',
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

            // Update appointment status and parts in a transaction
            const updatedAppointment = await Appointment.updateStatusWithParts(
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

            // Get the parts total if parts were selected
            let partsInfo = null;
            if (status === 'approved' && selectedParts && selectedParts.length > 0) {
                const partsTotal = await AppointmentParts.getAppointmentPartsTotal(appointmentId);
                partsInfo = {
                    partsCount: partsTotal.partsCount,
                    totalPartsCost: partsTotal.totalCost
                };
            }

            sendJSON(res, 200, {
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
                    updatedAt: updatedAppointment.updated_at,
                    partsInfo: partsInfo
                }
            });

        } catch (error) {
            console.error('Error updating appointment status:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error updating appointment status',
            });
        }
    }

    // GET /admin/api/appointments/statistics - Get appointment statistics
    static async getAppointmentStatistics(req, res) {
        try {
            const statistics = await Appointment.getStatistics();

            sendJSON(res, 200, {
                success: true,
                statistics: statistics
            });

        } catch (error) {
            console.error('Error loading statistics:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Error loading statistics'
            });
        }
    }
}

module.exports = AdminAppointmentsController;